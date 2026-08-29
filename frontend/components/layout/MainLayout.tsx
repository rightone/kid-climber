import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout, theme, Tabs, Drawer, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import Toolbar from '../ui/Toolbar';
import ComponentLibrary from '../ui/ComponentLibrary';
import PropertiesPanel from '../ui/PropertiesPanel';
import MaterialPanel from '../ui/MaterialPanel';
import MaterialCostPanel from '../ui/MaterialCostPanel';
import StructuralAnalysisPanel from '../ui/StructuralAnalysisPanel';
import AssemblyGuidePanel from '../ui/AssemblyGuidePanel';
import FileManager from '../ui/FileManager';
import HelpModal, { type HelpTabKey } from '../ui/HelpModal';
import SettingsModal from '../ui/SettingsModal';
import TemplateManager from '../ui/TemplateManager';
import Scene3D from '../3d/Scene3D';
import { useDefaultShortcuts } from '../../utils/shortcutUtils';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';

const { Header, Sider, Content } = Layout;
const COMPONENT_SIDER_WIDTH = 248;
const COMPONENT_DRAWER_WIDTH = 260;
const PROJECT_DRAWER_WIDTH = 520;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1600 : window.innerWidth
  );
  const [isWideViewport, setIsWideViewport] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1200
  );
  const isWideViewportRef = useRef(isWideViewport);
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1200
  );
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);
  const [componentDrawerTab, setComponentDrawerTab] = useState('components');
  const [projectTab, setProjectTab] = useState('materials');
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTabKey>('shortcuts');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const { components, connections } = useDesignStore();
  const { interaction, clearSelection } = useInteractionStore();

  useDefaultShortcuts();

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      const nextIsWide = window.innerWidth >= 1200;
      if (isWideViewportRef.current !== nextIsWide) {
        isWideViewportRef.current = nextIsWide;
        setComponentLibraryOpen(nextIsWide);
      }
      setIsWideViewport(nextIsWide);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeComponentLibrary = useCallback(() => {
    setComponentLibraryOpen(false);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const projectPanelTabs = useMemo(() => [
    { key: 'materials', label: '材料', children: <MaterialPanel /> },
    { key: 'cost', label: '成本', children: <MaterialCostPanel /> },
    { key: 'analysis', label: '分析', children: <StructuralAnalysisPanel /> },
    { key: 'assembly-guide', label: '搭建教程', children: <AssemblyGuidePanel /> },
  ], []);

  const componentDrawerTabs = useMemo(() => [
    {
      key: 'components',
      label: '组件',
      children: <ComponentLibrary onPlacementStart={closeComponentLibrary} />,
    },
    {
      key: 'templates',
      label: '整套方案',
      children: <TemplateManager onPlacementStart={closeComponentLibrary} />,
    },
  ], [closeComponentLibrary]);

  const showFloatingProperties = interaction.selectedComponents.length > 0;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Header
        style={{
          padding: 0,
          background: colorBgContainer,
          height: 'auto',
          lineHeight: 'normal',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <FileManager>
          {fileCommands => (
            <Toolbar
              viewportWidth={viewportWidth}
              fileCommands={fileCommands}
              componentLibraryOpen={componentLibraryOpen}
              projectPanelOpen={projectPanelOpen}
              isFullscreen={isFullscreen}
              onOpenComponents={() => setComponentLibraryOpen(open => !open)}
              onOpenProject={() => setProjectPanelOpen(true)}
              onOpenHelp={(section = 'shortcuts') => {
                setHelpTab(section);
                setHelpModalVisible(true);
              }}
              onOpenSettings={() => setSettingsModalVisible(true)}
              onToggleFullscreen={toggleFullscreen}
            />
          )}
        </FileManager>
      </Header>

      <Layout style={{ minHeight: 0 }}>
        {isWideViewport && componentLibraryOpen && (
          <Sider
            width={COMPONENT_SIDER_WIDTH}
            style={{
              background: colorBgContainer,
              borderRight: '1px solid #f0f0f0',
            }}
          >
            <Tabs
              activeKey={componentDrawerTab}
              onChange={setComponentDrawerTab}
              items={componentDrawerTabs}
              tabBarStyle={{ margin: 0, padding: '0 12px' }}
              style={{ height: '100%' }}
            />
          </Sider>
        )}

        <Content
          style={{
            margin: 0,
            padding: 0,
            background: '#f0f2f5',
            position: 'relative',
            minWidth: 0,
          }}
        >
          <Scene3D />

          {showFloatingProperties && (
            <div
              style={{
                position: 'absolute',
                top: 64,
                right: 12,
                width: 280,
                maxHeight: 'calc(100% - 88px)',
                overflow: 'auto',
                background: '#fff',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: 12,
                boxShadow: '0 16px 36px rgba(15, 23, 42, 0.18)',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px 0 14px',
                  borderBottom: '1px solid #f1f5f9',
                  fontWeight: 700,
                }}
              >
                <span>属性</span>
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  aria-label="关闭属性面板"
                  onClick={clearSelection}
                />
              </div>
              <PropertiesPanel />
            </div>
          )}
        </Content>
      </Layout>

      <div
        style={{
          height: 26,
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
          gap: 16,
          fontSize: 12,
          color: '#64748b',
        }}
      >
        <span>组件 {components.length}</span>
        <span>连接 {connections.length}</span>
      </div>

      <Drawer
        title="组件"
        placement="left"
        size={COMPONENT_DRAWER_WIDTH}
        open={!isWideViewport && componentLibraryOpen}
        onClose={() => setComponentLibraryOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={componentDrawerTab}
          onChange={setComponentDrawerTab}
          items={componentDrawerTabs}
          tabBarStyle={{ margin: 0, padding: '0 12px' }}
        />
      </Drawer>

      <Drawer
        title="清单与分析"
        placement="right"
        size={PROJECT_DRAWER_WIDTH}
        open={projectPanelOpen}
        onClose={() => setProjectPanelOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={projectTab}
          onChange={setProjectTab}
          items={projectPanelTabs}
          tabBarStyle={{ margin: 0, padding: '0 16px' }}
        />
      </Drawer>

      <HelpModal
        visible={helpModalVisible}
        activeTab={helpTab}
        onTabChange={setHelpTab}
        onClose={() => setHelpModalVisible(false)}
      />

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />
    </Layout>
  );
};

export default MainLayout;
