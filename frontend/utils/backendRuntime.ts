import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

export type BackendPhase = 'starting' | 'ready' | 'failed' | 'stopped';

export interface BackendStatus {
  phase: BackendPhase;
  apiUrl?: string;
  message?: string;
}

const BROWSER_API_URL = 'http://localhost:8080/api';
const POLL_INTERVAL_MS = 200;
const START_TIMEOUT_MS = 10_000;

let cachedApiUrl: string | undefined;

export const isDesktopRuntime = (): boolean => (
  typeof window !== 'undefined' && '__TAURI_IPC__' in window
);

const browserStatus = (): BackendStatus => ({
  phase: 'ready',
  apiUrl: BROWSER_API_URL,
});

const sleep = (milliseconds: number): Promise<void> => (
  new Promise(resolve => window.setTimeout(resolve, milliseconds))
);

export const getBackendStatus = async (): Promise<BackendStatus> => {
  if (!isDesktopRuntime()) {
    return browserStatus();
  }
  return invoke<BackendStatus>('get_backend_status');
};
export const waitForBackend = async (
  timeoutMs: number = START_TIMEOUT_MS
): Promise<BackendStatus> => {
  if (!isDesktopRuntime()) {
    cachedApiUrl = BROWSER_API_URL;
    return browserStatus();
  }

  const deadline = Date.now() + timeoutMs;
  let status = await getBackendStatus();
  while (Date.now() < deadline) {
    if (status.phase === 'ready' && status.apiUrl) {
      cachedApiUrl = status.apiUrl;
      return status;
    }
    if (status.phase === 'failed') {
      return status;
    }
    await sleep(POLL_INTERVAL_MS);
    status = await getBackendStatus();
  }

  return {
    phase: 'failed',
    message: '本地服务在 10 秒内未能启动，可以重试或退出应用。',
  };
};

export const restartBackend = async (): Promise<BackendStatus> => {
  cachedApiUrl = undefined;
  if (!isDesktopRuntime()) {
    cachedApiUrl = BROWSER_API_URL;
    return browserStatus();
  }
  await invoke<BackendStatus>('restart_backend');
  return waitForBackend();
};

export const getBackendApiUrl = async (): Promise<string> => {
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  const status = await waitForBackend();
  if (status.phase !== 'ready' || !status.apiUrl) {
    throw new Error(status.message ?? '本地服务尚未就绪');
  }
  cachedApiUrl = status.apiUrl;
  return status.apiUrl;
};

export const exitDesktopApp = async (): Promise<void> => {
  if (isDesktopRuntime()) {
    await appWindow.close();
  }
};
