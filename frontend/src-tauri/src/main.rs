// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, sync::Mutex, thread, time::Duration};
use tauri::{
    api::process::{Command, CommandChild, CommandEvent},
    AppHandle, Manager, RunEvent, State,
};

const BACKEND_START_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStatus {
    phase: String,
    api_url: Option<String>,
    message: Option<String>,
}
struct BackendRuntime {
    generation: u64,
    phase: String,
    api_url: Option<String>,
    message: Option<String>,
    child: Option<CommandChild>,
}

impl Default for BackendRuntime {
    fn default() -> Self {
        Self {
            generation: 0,
            phase: "stopped".to_string(),
            api_url: None,
            message: None,
            child: None,
        }
    }
}

#[derive(Default)]
struct BackendState(Mutex<BackendRuntime>);

#[derive(Deserialize)]
struct ReadyEvent {
    event: String,
    api_url: String,
}

fn snapshot(runtime: &BackendRuntime) -> BackendStatus {
    BackendStatus {
        phase: runtime.phase.clone(),
        api_url: runtime.api_url.clone(),
        message: runtime.message.clone(),
    }
}

fn set_failed(app: &AppHandle, generation: u64, message: &str) {
    let state = app.state::<BackendState>();
    if let Ok(mut runtime) = state.0.lock() {
        if runtime.generation == generation {
            runtime.phase = "failed".to_string();
            runtime.api_url = None;
            runtime.message = Some(message.to_string());
        }
    }
}

fn stop_backend_process(app: &AppHandle) {
    let child = {
        let state = app.state::<BackendState>();
        let Ok(mut runtime) = state.0.lock() else {
            return;
        };
        runtime.generation = runtime.generation.wrapping_add(1);
        runtime.phase = "stopped".to_string();
        runtime.api_url = None;
        runtime.message = None;
        runtime.child.take()
    };

    if let Some(child) = child {
        let _ = child.kill();
    }
}

fn start_backend_process(app: &AppHandle) -> Result<BackendStatus, String> {
    stop_backend_process(app);

    let generation = {
        let state = app.state::<BackendState>();
        let mut runtime = state
            .0
            .lock()
            .map_err(|_| "本地服务状态不可用".to_string())?;
        runtime.generation = runtime.generation.wrapping_add(1);
        runtime.phase = "starting".to_string();
        runtime.api_url = None;
        runtime.message = None;
        runtime.generation
    };

    let app_data_dir = match app.path_resolver().app_data_dir() {
        Some(path) => path,
        None => {
            set_failed(app, generation, "无法确定应用数据目录");
            return Err("无法确定应用数据目录".to_string());
        }
    };
    if fs::create_dir_all(&app_data_dir).is_err() {
        set_failed(app, generation, "无法创建应用数据目录");
        return Err("无法创建应用数据目录".to_string());
    }
    let database_path = app_data_dir.join("kid_climber.db");
    let Some(database_arg) = database_path.to_str() else {
        set_failed(app, generation, "应用数据目录不是有效路径");
        return Err("应用数据目录不是有效路径".to_string());
    };

    let command = match Command::new_sidecar("kid-climber-server") {
        Ok(command) => command.args(["--listen", "127.0.0.1:0", "--database", database_arg]),
        Err(_) => {
            set_failed(app, generation, "无法定位内置本地服务");
            return Err("无法定位内置本地服务".to_string());
        }
    };
    let (mut events, child) = match command.spawn() {
        Ok(process) => process,
        Err(_) => {
            set_failed(app, generation, "无法启动内置本地服务");
            return Err("无法启动内置本地服务".to_string());
        }
    };

    {
        let state = app.state::<BackendState>();
        let mut runtime = state
            .0
            .lock()
            .map_err(|_| "本地服务状态不可用".to_string())?;
        if runtime.generation != generation {
            let _ = child.kill();
            return Err("本地服务启动已取消".to_string());
        }
        runtime.child = Some(child);
    }

    let event_app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let Ok(ready) = serde_json::from_str::<ReadyEvent>(line.trim()) else {
                        continue;
                    };
                    if ready.event != "ready"
                        || !ready.api_url.starts_with("http://127.0.0.1:")
                        || !ready.api_url.ends_with("/api")
                    {
                        continue;
                    }
                    let state = event_app.state::<BackendState>();
                    if let Ok(mut runtime) = state.0.lock() {
                        if runtime.generation == generation && runtime.phase == "starting" {
                            runtime.phase = "ready".to_string();
                            runtime.api_url = Some(ready.api_url);
                            runtime.message = None;
                        }
                    }
                }
                CommandEvent::Terminated(_) => {
                    let state = event_app.state::<BackendState>();
                    if let Ok(mut runtime) = state.0.lock() {
                        if runtime.generation == generation {
                            runtime.child = None;
                            if runtime.phase != "failed" {
                                runtime.phase = "failed".to_string();
                                runtime.api_url = None;
                                runtime.message = Some("本地服务意外退出，可以重试".to_string());
                            }
                        }
                    }
                    break;
                }
                CommandEvent::Error(_) => {
                    set_failed(&event_app, generation, "无法读取本地服务状态，可以重试");
                }
                CommandEvent::Stderr(_) => {}
                _ => {}
            }
        }
    });

    let timeout_app = app.clone();
    thread::spawn(move || {
        thread::sleep(BACKEND_START_TIMEOUT);
        let child = {
            let state = timeout_app.state::<BackendState>();
            let Ok(mut runtime) = state.0.lock() else {
                return;
            };
            if runtime.generation != generation || runtime.phase != "starting" {
                return;
            }
            runtime.phase = "failed".to_string();
            runtime.message = Some("本地服务在 10 秒内未能启动，可以重试".to_string());
            runtime.child.take()
        };
        if let Some(child) = child {
            let _ = child.kill();
        }
    });

    Ok(get_backend_status(app.state::<BackendState>()))
}

#[tauri::command]
fn get_backend_status(state: State<'_, BackendState>) -> BackendStatus {
    match state.0.lock() {
        Ok(runtime) => snapshot(&runtime),
        Err(_) => BackendStatus {
            phase: "failed".to_string(),
            api_url: None,
            message: Some("本地服务状态不可用".to_string()),
        },
    }
}

#[tauri::command]
fn restart_backend(app: AppHandle) -> Result<BackendStatus, String> {
    start_backend_process(&app)
}

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn main() {
    let app = tauri::Builder::default()
        .manage(BackendState::default())
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            restart_backend,
            get_version
        ])
        .setup(|app| {
            let handle = app.handle();
            if start_backend_process(&handle).is_err() {
                eprintln!("The embedded local service could not be started.");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            stop_backend_process(app_handle);
        }
    });
}
