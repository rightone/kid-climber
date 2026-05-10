import React, { useState, useMemo } from 'react';
import { Layout, theme, Tabs, Button, Space, Tooltip, Badge, Typography } from 'antd';
import {
  SettingOutlined,
  QuestionCircleOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import Toolbar from '../ui/Toolbar';
import ComponentLibrary from '../ui/ComponentLibrary';
import PropertiesPanel from '../ui/PropertiesPanel';
import MaterialPanel from '../ui/MaterialPanel';
import MaterialCostPanel from '../ui/MaterialCostPanel';
import StructuralAnalysisPanel from '../ui/StructuralAnalysisPanel';
import FileManager from '../ui/FileManager';
import HelpModal from '../ui/HelpModal';
import SettingsModal from '../ui/SettingsModal';
import TemplateManager from '../ui/TemplateManager';
import Tutorial from '../ui/Tutorial';
import Scene3D from '../3d/Scene3D';
import { useDefaultShortcuts } from '../../utils/shortcutUtils';
import { useDesignStore } from '../../stores/designStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  
  // 获取状态
  const { components, connections, editor } = useDesignStore();
  
  // 初始化快捷键
  useDefaultShortcuts();
  
  // 切换全屏
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // 右侧面板标签页
  const rightPanelTabs = useMemo(() => [
    {
      key: 'properties',
      label: (
        <span>
          属性
          {editor.selectedComponents.length > 0 && (
            <Badge count={editor.selectedComponents.length} size="small" style={{ marginLeft: 4 }} />
          )}
        </span>
      ),
      children: <PropertiesPanel />,
    },
    {
      key: 'materials',
      label: '材料',
      children: <MaterialPanel />,
    },
    {
      key: 'cost',
      label: '成本',
      children: <MaterialCostPanel />,
    },
    {
      key: 'analysis',
      label: '分析',
      children: <StructuralAnalysisPanel />,
    },
    {
      key: 'templates',
      label: '模板',
      children: <TemplateManager />,
    },
  ], [editor.selectedComponents.length]);
  
  return (
    <Layout style={{ height: '100vh' }}>
      {/* 顶部工具栏 */}
      <Header
        style={{
          padding: 0,
          background: colorBgContainer,
          height: 'auto',
          lineHeight: 'normal',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* 文件管理 */}
          <div style={{ padding: '0 16px' }}>
            <FileManager />
          </div>
          
          {/* 工具栏 */}
          <div style={{ flex: 1 }}>
            <Toolbar />
          </div>
          
          {/* 右侧操作 */}
          <Space style={{ padding: '0 16px' }}>
            <Tutorial />
            <Tooltip title="设置">
              <Button
                icon={<SettingOutlined />}
                size="small"
                onClick={() => setSettingsModalVisible(true)}
              />
            </Tooltip>
            <Tooltip title="帮助">
              <Button
                icon={<QuestionCircleOutlined />}
                size="small"
                onClick={() => setHelpModalVisible(true)}
              />
            </Tooltip>
            <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
              <Button
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                size="small"
                onClick={toggleFullscreen}
              />
            </Tooltip>
          </Space>
        </div>
      </Header>
      
      <Layout>
        {/* 左侧组件库 */}
        <Sider
          width={280}
          style={{
            background: colorBgContainer,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                fontWeight: 'bold',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🧩</span>
              <span>组件库</span>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                ({components.length} 个组件)
              </Text>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ComponentLibrary />
            </div>
          </div>
        </Sider>
        
        {/* 中间3D视图 */}
        <Content
          style={{
            margin: 0,
            padding: 0,
            background: '#f0f2f5',
            position: 'relative',
          }}
        >
          <Scene3D />
        </Content>
        
        {/* 右侧属性面板 */}
        <Sider
          width={300}
          style={{
            background: colorBgContainer,
            borderLeft: '1px solid #f0f0f0',
          }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={rightPanelTabs}
              style={{ flex: 1, overflow: 'hidden' }}
              tabBarStyle={{ margin: 0, padding: '0 16px' }}
            />
          </div>
        </Sider>
      </Layout>
      
      {/* 状态栏 */}
      <div
        style={{
          height: 28,
          background: '#f0f2f5',
          borderTop: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: 12,
          color: '#666',
        }}
      >
        <span>就绪</span>
        <div style={{ flex: 1 }} />
        <Space size={16}>
          <span>组件: {components.length}</span>
          <span>连接: {connections.length}</span>
          <span>选中: {editor.selectedComponents.length}</span>
          <span>网格: {editor.gridSize}cm</span>
          <span>视图: {editor.viewMode === 'realistic' ? '真实感' : editor.viewMode === 'wireframe' ? '线框' : editor.viewMode === 'xray' ? 'X光' : '黑白'}</span>
        </Space>
      </div>
      
      {/* 帮助对话框 */}
      <HelpModal
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
      />
      
      {/* 设置对话框 */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />
    </Layout>
  );
};

export default MainLayout;
