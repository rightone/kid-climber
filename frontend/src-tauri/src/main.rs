// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::Manager;

// 启动Go后端服务
#[tauri::command]
fn start_backend() -> Result<String, String> {
    let output = Command::new("go")
        .args(&["run", "./cmd/server/main.go"])
        .current_dir("../backend")
        .spawn();
    
    match output {
        Ok(_) => Ok("Backend started successfully".to_string()),
        Err(e) => Err(format!("Failed to start backend: {}", e)),
    }
}

// 停止Go后端服务
#[tauri::command]
fn stop_backend() -> Result<String, String> {
    // 这里可以实现停止后端服务的逻辑
    Ok("Backend stopped".to_string())
}

// 获取应用版本
#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            get_version
        ])
        .setup(|app| {
            // 获取主窗口
            let _window = app.get_window("main").unwrap();
            
            // 启动时自动启动后端
            std::thread::spawn(|| {
                let _ = start_backend();
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
