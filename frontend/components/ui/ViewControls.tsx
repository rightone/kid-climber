import React, { useCallback } from 'react';
import { Button, Space, Tooltip, Dropdown } from 'antd';
import {
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CompressOutlined,
} from '@ant-design/icons';

// 视角预设
export interface ViewPreset {
  name: string;
  icon: React.ReactNode;
  position: [number, number, number];
  target: [number, number, number];
  description: string;
}

// 预设视角列表
export const viewPresets: ViewPreset[] = [
  {
    name: '透视图',
    icon: <EyeOutlined />,
    position: [150, 150, 150],
    target: [0, 0, 0],
    description: '默认3D透视视角',
  },
  {
    name: '正视图',
    icon: <ArrowUpOutlined />,
    position: [0, 100, 200],
    target: [0, 0, 0],
    description: '正面视角（XY平面）',
  },
  {
    name: '侧视图',
    icon: <ArrowRightOutlined />,
    position: [200, 100, 0],
    target: [0, 0, 0],
    description: '侧面视角（YZ平面）',
  },
  {
    name: '俯视图',
    icon: <ArrowDownOutlined />,
    position: [0, 200, 0],
    target: [0, 0, 0],
    description: '顶部视角（XZ平面）',
  },
  {
    name: '左视图',
    icon: <ArrowLeftOutlined />,
    position: [-200, 100, 0],
    target: [0, 0, 0],
    description: '左侧视角',
  },
  {
    name: '后视图',
    icon: <ArrowUpOutlined />,
    position: [0, 100, -200],
    target: [0, 0, 0],
    description: '后方视角',
  },
];

// 视角预设组件
export const ViewPresets: React.FC<{
  onViewChange: (position: [number, number, number], target: [number, number, number]) => void;
}> = ({ onViewChange }) => {
  const handleViewChange = useCallback((preset: ViewPreset) => {
    onViewChange(preset.position, preset.target);
  }, [onViewChange]);
  
  return (
    <Space wrap>
      {viewPresets.map((preset) => (
        <Tooltip key={preset.name} title={preset.description}>
          <Button
            size="small"
            icon={preset.icon}
            onClick={() => handleViewChange(preset)}
          >
            {preset.name}
          </Button>
        </Tooltip>
      ))}
    </Space>
  );
};

// 视角控制面板
export const ViewControlPanel: React.FC<{
  onViewChange: (position: [number, number, number], target: [number, number, number]) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
}> = ({ onViewChange, onZoomIn, onZoomOut, onResetView }) => {
  return (
    <div style={{ 
      position: 'absolute', 
      bottom: 16, 
      right: 16,
      background: 'rgba(0, 0, 0, 0.7)',
      padding: 8,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <ViewPresets onViewChange={onViewChange} />
      
      <Divider style={{ margin: '4px 0' }} />
      
      <Space>
        <Tooltip title="放大">
          <Button size="small" icon={<CompressOutlined />} onClick={onZoomIn} />
        </Tooltip>
        <Tooltip title="缩小">
          <Button size="small" icon={<CompressOutlined />} onClick={onZoomOut} />
        </Tooltip>
        <Tooltip title="重置视角">
          <Button size="small" icon={<EyeOutlined />} onClick={onResetView} />
        </Tooltip>
      </Space>
    </div>
  );
};

// 视角信息显示
export const ViewInfoDisplay: React.FC<{
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
}> = ({ cameraPosition, cameraTarget }) => {
  if (!cameraPosition) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'rgba(0, 0, 0, 0.7)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div>📷 相机位置</div>
      <div>X: {cameraPosition[0].toFixed(0)}</div>
      <div>Y: {cameraPosition[1].toFixed(0)}</div>
      <div>Z: {cameraPosition[2].toFixed(0)}</div>
    </div>
  );
};

// 旋转锁定控制
export const RotationLockControl: React.FC<{
  lockX: boolean;
  lockY: boolean;
  lockZ: boolean;
  onToggleLock: (axis: 'x' | 'y' | 'z') => void;
}> = ({ lockX, lockY, lockZ, onToggleLock }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      background: 'rgba(0, 0, 0, 0.7)',
      padding: 8,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ color: '#fff', fontSize: 12, marginBottom: 4 }}>旋转锁定</div>
      <Space>
        <Tooltip title={lockX ? '解锁X轴' : '锁定X轴'}>
          <Button
            size="small"
            type={lockX ? 'primary' : 'default'}
            onClick={() => onToggleLock('x')}
          >
            X
          </Button>
        </Tooltip>
        <Tooltip title={lockY ? '解锁Y轴' : '锁定Y轴'}>
          <Button
            size="small"
            type={lockY ? 'primary' : 'default'}
            onClick={() => onToggleLock('y')}
          >
            Y
          </Button>
        </Tooltip>
        <Tooltip title={lockZ ? '解锁Z轴' : '锁定Z轴'}>
          <Button
            size="small"
            type={lockZ ? 'primary' : 'default'}
            onClick={() => onToggleLock('z')}
          >
            Z
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default ViewPresets;
