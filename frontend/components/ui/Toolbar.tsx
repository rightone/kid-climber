import React, { useMemo } from 'react';
import { Button, Space, Tooltip, Divider, Dropdown } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  DeleteOutlined,
  CopyOutlined,
  SnippetsOutlined,
  SelectOutlined,
  DragOutlined,
  RotateRightOutlined,
  TableOutlined,
  EyeOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ScissorOutlined,
} from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';

const Toolbar: React.FC = () => {
  const {
    editor,
    setEditorState,
    undo,
    redo,
    removeComponent,
    clearSelection,
    copySelected,
    paste,
    duplicateSelected,
    history,
    historyIndex,
    components,
    connections,
  } = useDesignStore();
  
  // 检查是否有选中组件
  const hasSelection = editor.selectedComponents.length > 0;
  
  // 检查是否可以撤销/重做
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // 处理删除
  const handleDelete = () => {
    if (hasSelection) {
      editor.selectedComponents.forEach(id => removeComponent(id));
      clearSelection();
    }
  };
  
  // 视图模式菜单项
  const viewModeMenuItems = useMemo(() => [
    {
      key: 'realistic',
      label: '真实感模式',
      onClick: () => setEditorState({ viewMode: 'realistic' }),
    },
    {
      key: 'wireframe',
      label: '线框模式',
      onClick: () => setEditorState({ viewMode: 'wireframe' }),
    },
    {
      key: 'xray',
      label: 'X光模式',
      onClick: () => setEditorState({ viewMode: 'xray' }),
    },
    {
      key: 'blackwhite',
      label: '黑白模式',
      onClick: () => setEditorState({ viewMode: 'blackwhite' }),
    },
  ], [setEditorState]);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        gap: 8,
      }}
    >
      {/* 编辑操作 */}
      <Space>
        <Tooltip title="撤销 (Ctrl+Z)">
          <Button
            icon={<UndoOutlined />}
            size="small"
            disabled={!canUndo}
            onClick={undo}
          />
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Y)">
          <Button
            icon={<RedoOutlined />}
            size="small"
            disabled={!canRedo}
            onClick={redo}
          />
        </Tooltip>
      </Space>
      
      <Divider type="vertical" />
      
      {/* 工具切换 */}
      <Space>
        <Tooltip title="选择工具 (V)">
          <Button
            icon={<SelectOutlined />}
            size="small"
            type={editor.activeTool === 'select' ? 'primary' : 'default'}
            onClick={() => setEditorState({ activeTool: 'select' })}
          />
        </Tooltip>
        <Tooltip title="移动工具 (M)">
          <Button
            icon={<DragOutlined />}
            size="small"
            type={editor.activeTool === 'move' ? 'primary' : 'default'}
            onClick={() => setEditorState({ activeTool: 'move' })}
          />
        </Tooltip>
        <Tooltip title="旋转工具 (R)">
          <Button
            icon={<RotateRightOutlined />}
            size="small"
            type={editor.activeTool === 'rotate' ? 'primary' : 'default'}
            onClick={() => setEditorState({ activeTool: 'rotate' })}
          />
        </Tooltip>
      </Space>
      
      <Divider type="vertical" />
      
      {/* 组件操作 */}
      <Space>
        <Tooltip title="复制 (Ctrl+C)">
          <Button
            icon={<CopyOutlined />}
            size="small"
            disabled={!hasSelection}
            onClick={copySelected}
          />
        </Tooltip>
        <Tooltip title="粘贴 (Ctrl+V)">
          <Button
            icon={<SnippetsOutlined />}
            size="small"
            onClick={paste}
          />
        </Tooltip>
        <Tooltip title="复制选中组件">
          <Button
            icon={<ScissorOutlined />}
            size="small"
            disabled={!hasSelection}
            onClick={duplicateSelected}
          />
        </Tooltip>
        <Tooltip title="删除 (Delete)">
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            disabled={!hasSelection}
            onClick={handleDelete}
          />
        </Tooltip>
      </Space>
      
      <Divider type="vertical" />
      
      {/* 视图控制 */}
      <Space>
        <Tooltip title={editor.showGrid ? '隐藏网格' : '显示网格'}>
          <Button
            icon={<TableOutlined />}
            size="small"
            type={editor.showGrid ? 'primary' : 'default'}
            onClick={() => setEditorState({ showGrid: !editor.showGrid })}
          />
        </Tooltip>
        <Tooltip title={editor.showConnections ? '隐藏连接点' : '显示连接点'}>
          <Button
            icon={editor.showConnections ? <LinkOutlined /> : <DisconnectOutlined />}
            size="small"
            type={editor.showConnections ? 'primary' : 'default'}
            onClick={() => setEditorState({ showConnections: !editor.showConnections })}
          />
        </Tooltip>
        <Dropdown menu={{ items: viewModeMenuItems }} trigger={['click']}>
          <Tooltip title="视图模式">
            <Button icon={<EyeOutlined />} size="small" />
          </Tooltip>
        </Dropdown>
      </Space>
      
      <div style={{ flex: 1 }} />
      
      {/* 信息显示 */}
      <Space>
        <span style={{ fontSize: 12, color: '#666' }}>
          组件: {components.length}
        </span>
        <span style={{ fontSize: 12, color: '#666' }}>
          连接: {connections.length}
        </span>
        {hasSelection && (
          <span style={{ fontSize: 12, color: '#1890ff' }}>
            选中: {editor.selectedComponents.length}
          </span>
        )}
      </Space>
    </div>
  );
};

export default Toolbar;
