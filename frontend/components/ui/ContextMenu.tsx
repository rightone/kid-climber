import React, { useCallback } from 'react';
import { Menu, Dropdown, message } from 'antd';
import {
  CopyOutlined,
  ScissorOutlined,
  DeleteOutlined,
  EditOutlined,
  RotateRightOutlined,
  AlignCenterOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

// 右键菜单项
export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

// 组件右键菜单
export const ComponentContextMenu: React.FC<{
  children: React.ReactNode;
  instanceId: string;
  onCopy?: (instanceId: string) => void;
  onCut?: (instanceId: string) => void;
  onDelete?: (instanceId: string) => void;
  onEdit?: (instanceId: string) => void;
  onRotate?: (instanceId: string, axis: 'x' | 'y' | 'z', degrees: number) => void;
  onAlign?: (instanceId: string, direction: string) => void;
  onConnect?: (instanceId: string) => void;
  onInfo?: (instanceId: string) => void;
}> = ({
  children,
  instanceId,
  onCopy,
  onCut,
  onDelete,
  onEdit,
  onRotate,
  onAlign,
  onConnect,
  onInfo,
}) => {
  const menuItems = [
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: () => onCopy?.(instanceId),
    },
    {
      key: 'cut',
      label: '剪切',
      icon: <ScissorOutlined />,
      onClick: () => onCut?.(instanceId),
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      onClick: () => onDelete?.(instanceId),
      danger: true,
    },
    { type: 'divider' as const },
    {
      key: 'edit',
      label: '编辑属性',
      icon: <EditOutlined />,
      onClick: () => onEdit?.(instanceId),
    },
    { type: 'divider' as const },
    {
      key: 'rotate',
      label: '旋转',
      icon: <RotateRightOutlined />,
      children: [
        {
          key: 'rotate_x_90',
          label: 'X轴 +90°',
          onClick: () => onRotate?.(instanceId, 'x', 90),
        },
        {
          key: 'rotate_x_-90',
          label: 'X轴 -90°',
          onClick: () => onRotate?.(instanceId, 'x', -90),
        },
        {
          key: 'rotate_y_90',
          label: 'Y轴 +90°',
          onClick: () => onRotate?.(instanceId, 'y', 90),
        },
        {
          key: 'rotate_y_-90',
          label: 'Y轴 -90°',
          onClick: () => onRotate?.(instanceId, 'y', -90),
        },
        {
          key: 'rotate_z_90',
          label: 'Z轴 +90°',
          onClick: () => onRotate?.(instanceId, 'z', 90),
        },
        {
          key: 'rotate_z_-90',
          label: 'Z轴 -90°',
          onClick: () => onRotate?.(instanceId, 'z', -90),
        },
      ],
    },
    {
      key: 'align',
      label: '对齐',
      icon: <AlignCenterOutlined />,
      children: [
        {
          key: 'align_left',
          label: '左对齐',
          onClick: () => onAlign?.(instanceId, 'left'),
        },
        {
          key: 'align_right',
          label: '右对齐',
          onClick: () => onAlign?.(instanceId, 'right'),
        },
        {
          key: 'align_top',
          label: '顶部对齐',
          onClick: () => onAlign?.(instanceId, 'top'),
        },
        {
          key: 'align_bottom',
          label: '底部对齐',
          onClick: () => onAlign?.(instanceId, 'bottom'),
        },
        {
          key: 'align_center',
          label: '居中对齐',
          onClick: () => onAlign?.(instanceId, 'center'),
        },
      ],
    },
    { type: 'divider' as const },
    {
      key: 'connect',
      label: '连接',
      icon: <LinkOutlined />,
      onClick: () => onConnect?.(instanceId),
    },
    {
      key: 'info',
      label: '查看详情',
      icon: <InfoCircleOutlined />,
      onClick: () => onInfo?.(instanceId),
    },
  ];
  
  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  );
};

// 空白区域右键菜单
export const EmptyContextMenu: React.FC<{
  children: React.ReactNode;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onViewChange?: (view: string) => void;
  onResetView?: () => void;
}> = ({
  children,
  onPaste,
  onSelectAll,
  onViewChange,
  onResetView,
}) => {
  const menuItems = [
    {
      key: 'paste',
      label: '粘贴',
      icon: <CopyOutlined />,
      onClick: () => onPaste?.(),
    },
    {
      key: 'select_all',
      label: '全选',
      icon: <SelectOutlined />,
      onClick: () => onSelectAll?.(),
    },
    { type: 'divider' as const },
    {
      key: 'view',
      label: '视图',
      children: [
        {
          key: 'view_perspective',
          label: '透视图',
          onClick: () => onViewChange?.('perspective'),
        },
        {
          key: 'view_front',
          label: '正视图',
          onClick: () => onViewChange?.('front'),
        },
        {
          key: 'view_side',
          label: '侧视图',
          onClick: () => onViewChange?.('side'),
        },
        {
          key: 'view_top',
          label: '俯视图',
          onClick: () => onViewChange?.('top'),
        },
      ],
    },
    {
      key: 'reset_view',
      label: '重置视角',
      onClick: () => onResetView?.(),
    },
  ];
  
  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  );
};

export default ComponentContextMenu;
