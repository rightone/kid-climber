import React, { useMemo } from 'react';
import { Button, Divider, Dropdown, Space, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BorderOutlined,
  CheckOutlined,
  DragOutlined,
  EyeOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MoreOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  RotateRightOutlined,
  SaveOutlined,
  SelectOutlined,
  SettingOutlined,
  TableOutlined,
  UndoOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import type { ActiveTool } from '../../stores/interactionStore';
import type { FileManagerCommands } from './FileManager';
import {
  resolveToolbarLayout,
  type ToolbarAction,
  type ToolbarActionId,
} from '../../utils/toolbarUtils';

interface ToolbarProps {
  viewportWidth: number;
  fileCommands: FileManagerCommands;
  componentLibraryOpen?: boolean;
  projectPanelOpen?: boolean;
  isFullscreen?: boolean;
  onOpenComponents?: () => void;
  onOpenProject?: () => void;
  onOpenHelp?: (section?: 'shortcuts' | 'about') => void;
  onOpenSettings?: () => void;
  onToggleFullscreen?: () => void;
}

const statefulLabel = (label: string, active: boolean) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 18,
    }}
  >
    <span>{label}</span>
    {active ? <CheckOutlined style={{ color: '#1677ff' }} /> : null}
  </span>
);

const Toolbar: React.FC<ToolbarProps> = ({
  viewportWidth,
  fileCommands,
  componentLibraryOpen = false,
  projectPanelOpen = false,
  isFullscreen = false,
  onOpenComponents,
  onOpenProject,
  onOpenHelp,
  onOpenSettings,
  onToggleFullscreen,
}) => {
  const { editor, setEditorState, undo, redo, history, historyIndex } = useDesignStore();
  const { interaction, setActiveTool, setShowVerticalGrid } = useInteractionStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const layout = resolveToolbarLayout(viewportWidth);
  const isVisible = (id: ToolbarActionId) => layout.visible.includes(id);

  const fileMenuItems = useMemo<MenuProps['items']>(() => [
    {
      key: 'open',
      icon: <FolderOpenOutlined />,
      label: '打开设计',
      onClick: fileCommands.open,
    },
    {
      key: 'import',
      icon: <ImportOutlined />,
      label: '导入设计',
      onClick: fileCommands.importDesign,
    },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: '导出设计',
      onClick: fileCommands.exportDesign,
    },
  ], [fileCommands]);

  const displayMenuItems = useMemo<MenuProps['items']>(() => [
    {
      key: 'grid',
      icon: <TableOutlined />,
      label: statefulLabel('地面网格', editor.showGrid),
      onClick: () => setEditorState({ showGrid: !editor.showGrid }),
    },
    {
      key: 'vertical-grid',
      icon: <BorderOutlined />,
      label: statefulLabel('垂直网格', interaction.showVerticalGrid),
      onClick: () => setShowVerticalGrid(!interaction.showVerticalGrid),
    },
    {
      key: 'connections',
      icon: <LinkOutlined />,
      label: statefulLabel('连接点标记', editor.showConnections),
      onClick: () => setEditorState({ showConnections: !editor.showConnections }),
    },
    { type: 'divider' },
    {
      key: 'view-modes',
      type: 'group',
      label: '显示模式',
      children: [
        {
          key: 'realistic',
          label: statefulLabel('真实感', editor.viewMode === 'realistic'),
          onClick: () => setEditorState({ viewMode: 'realistic' }),
        },
        {
          key: 'wireframe',
          label: statefulLabel('线框', editor.viewMode === 'wireframe'),
          onClick: () => setEditorState({ viewMode: 'wireframe' }),
        },
        {
          key: 'xray',
          label: statefulLabel('X光', editor.viewMode === 'xray'),
          onClick: () => setEditorState({ viewMode: 'xray' }),
        },
        {
          key: 'blackwhite',
          label: statefulLabel('黑白', editor.viewMode === 'blackwhite'),
          onClick: () => setEditorState({ viewMode: 'blackwhite' }),
        },
      ],
    },
    { type: 'divider' },
    {
      key: 'fullscreen',
      icon: isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
      label: isFullscreen ? '退出全屏' : '全屏',
      onClick: onToggleFullscreen,
    },
  ], [
    editor.showConnections,
    editor.showGrid,
    editor.viewMode,
    interaction.showVerticalGrid,
    isFullscreen,
    onToggleFullscreen,
    setEditorState,
    setShowVerticalGrid,
  ]);

  const moreMenuItems: MenuProps['items'] = [];

  if (layout.overflow.includes('file')) {
    moreMenuItems.push({
        key: 'file',
        icon: <FileOutlined />,
        label: '文件',
        children: fileMenuItems,
    });
  }

  if (layout.overflow.includes('project')) {
    moreMenuItems.push({
        key: 'project',
        icon: <FolderOutlined />,
        label: '清单与分析',
        onClick: onOpenProject,
    });
  }

  if (layout.overflow.includes('display')) {
    moreMenuItems.push({
        key: 'display',
        icon: <EyeOutlined />,
        label: '显示',
        children: displayMenuItems,
    });
  }

  if (moreMenuItems.length > 0) {
    moreMenuItems.push({ type: 'divider' });
  }

  moreMenuItems.push(
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '搭建设置',
      onClick: onOpenSettings,
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: '帮助与快捷键',
      onClick: () => onOpenHelp?.('shortcuts'),
    },
    {
      key: 'about',
      icon: <InfoCircleOutlined />,
      label: '关于软件',
      onClick: () => onOpenHelp?.('about'),
    },
  );

  const toolActions = useMemo<ToolbarAction[]>(() => [
    {
      id: 'select',
      label: '选择',
      shortcut: 'V',
      active: interaction.activeTool === 'select' && interaction.mode === 'select',
      priority: 'primary',
      execute: () => setActiveTool('select'),
    },
    {
      id: 'move',
      label: '移动',
      shortcut: 'M',
      active: interaction.activeTool === 'move' && interaction.mode === 'move',
      priority: 'primary',
      execute: () => setActiveTool('move'),
    },
    {
      id: 'rotate',
      label: '旋转',
      shortcut: 'R',
      active: interaction.activeTool === 'rotate' && interaction.mode === 'rotate',
      priority: 'primary',
      execute: () => setActiveTool('rotate'),
    },
  ], [interaction.activeTool, interaction.mode, setActiveTool]);

  const toolIcons: Record<ActiveTool, React.ReactNode> = {
    select: <SelectOutlined />,
    move: <DragOutlined />,
    rotate: <RotateRightOutlined />,
    measure: null,
  };

  return (
    <div
      data-testid="editor-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        width: '100%',
        minHeight: 48,
        padding: '8px 12px',
        background: '#fff',
        gap: 8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <Tooltip title="保存设计 (Ctrl+S)">
        <Button
          icon={<SaveOutlined />}
          aria-label="保存设计"
          onClick={fileCommands.save}
        >
          保存
        </Button>
      </Tooltip>

      {isVisible('file') ? (
        <Dropdown menu={{ items: fileMenuItems }} trigger={['click']}>
          <Button icon={<FileOutlined />} aria-label="文件菜单">
            文件
          </Button>
        </Dropdown>
      ) : null}

      <Divider orientation="vertical" style={{ height: 24, margin: '0 2px' }} />

      <Space.Compact>
        <Tooltip title="撤销 (Ctrl+Z)">
          <Button
            icon={<UndoOutlined />}
            disabled={!canUndo}
            onClick={undo}
            aria-label="撤销"
          />
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Y)">
          <Button
            icon={<RedoOutlined />}
            disabled={!canRedo}
            onClick={redo}
            aria-label="重做"
          />
        </Tooltip>
      </Space.Compact>

      <Divider orientation="vertical" style={{ height: 24, margin: '0 2px' }} />

      <Space.Compact>
        {toolActions.map(action => (
          <Tooltip key={action.id} title={`${action.label}工具 (${action.shortcut})`}>
            <Button
              icon={toolIcons[action.id as ActiveTool]}
              type={action.active ? 'primary' : 'default'}
              onClick={action.execute}
              aria-label={`${action.label}工具`}
              aria-pressed={action.active}
            >
              {action.label}
            </Button>
          </Tooltip>
        ))}
      </Space.Compact>

      <Divider orientation="vertical" style={{ height: 24, margin: '0 2px' }} />

      <Button
        icon={<AppstoreOutlined />}
        type={componentLibraryOpen ? 'primary' : 'default'}
        onClick={onOpenComponents}
        aria-label="添加组件"
        aria-pressed={componentLibraryOpen}
      >
        添加组件
      </Button>

      {isVisible('project') ? (
        <Button
          icon={<FolderOutlined />}
          type={projectPanelOpen ? 'primary' : 'default'}
          onClick={onOpenProject}
          aria-label="打开清单与分析"
          aria-pressed={projectPanelOpen}
        >
          清单与分析
        </Button>
      ) : null}

      {isVisible('display') ? (
        <Dropdown menu={{ items: displayMenuItems }} trigger={['click']}>
          <Button icon={<EyeOutlined />} aria-label="显示菜单">
            显示
          </Button>
        </Dropdown>
      ) : null}

      <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
        <Button icon={<MoreOutlined />} aria-label="更多功能">
          更多
        </Button>
      </Dropdown>
    </div>
  );
};

export default React.memo(Toolbar);
