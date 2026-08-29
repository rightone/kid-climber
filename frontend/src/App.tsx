import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from '../components/layout/MainLayout';
import BackendGate from '../components/ui/BackendGate';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BackendGate>
        <MainLayout />
      </BackendGate>
    </ConfigProvider>
  );
};

export default App;
