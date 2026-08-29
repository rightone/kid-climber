import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Space, Spin, Typography } from 'antd';
import {
  exitDesktopApp,
  getBackendStatus,
  restartBackend,
  waitForBackend,
  type BackendStatus,
} from '../../utils/backendRuntime';

interface BackendGateProps {
  children: React.ReactNode;
}

const shellStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const panelStyle: React.CSSProperties = {
  width: 'min(520px, 100%)',
  textAlign: 'center',
};

const BackendGate: React.FC<BackendGateProps> = ({ children }) => {
  const [status, setStatus] = useState<BackendStatus>({ phase: 'starting' });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    waitForBackend()
      .then(nextStatus => {
        if (active) setStatus(nextStatus);
      })
      .catch(() => {
        if (active) {
          setStatus({ phase: 'failed', message: '无法读取本地服务状态，可以重试或退出应用。' });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status.phase !== 'ready') return undefined;
    let active = true;
    const interval = window.setInterval(() => {
      getBackendStatus()
        .then(nextStatus => {
          if (active && nextStatus.phase !== 'ready') setStatus(nextStatus);
        })
        .catch(() => {
          if (active) {
            setStatus({ phase: 'failed', message: '本地服务状态中断，可以重试或退出应用。' });
          }
        });
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [status.phase]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setStatus({ phase: 'starting' });
    try {
      setStatus(await restartBackend());
    } catch {
      setStatus({ phase: 'failed', message: '本地服务重试失败，请退出后重新打开应用。' });
    } finally {
      setRetrying(false);
    }
  }, []);

  if (status.phase === 'ready') {
    return children;
  }

  if (status.phase === 'starting') {
    return (
      <div style={shellStyle}>
        <Space direction="vertical" size="large" style={panelStyle}>
          <Spin size="large" />
          <Typography.Title level={4}>正在启动本地服务</Typography.Title>
          <Typography.Text type="secondary">
            Kid Climber 正在准备本机数据库和设计服务。
          </Typography.Text>
        </Space>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <Space direction="vertical" size="large" style={panelStyle}>
        <Alert
          type="error"
          showIcon
          message="本地服务未能启动"
          description={status.message ?? '可以重试；如果问题持续，请退出后重新打开应用。'}
        />
        <Space>
          <Button type="primary" loading={retrying} onClick={handleRetry}>
            重试
          </Button>
          <Button onClick={() => void exitDesktopApp()}>
            退出应用
          </Button>
        </Space>
      </Space>
    </div>
  );
};

export default BackendGate;
