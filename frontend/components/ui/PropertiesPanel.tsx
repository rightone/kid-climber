import React, { useMemo } from 'react';
import { Card, Form, InputNumber, Button, Space, Typography, Divider, Tag, Empty } from 'antd';
import { DeleteOutlined, CopyOutlined, RotateLeftOutlined, RotateRightOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { getComponentById } from '../../stores/componentLibrary';
import type { ComponentColor } from '../../types';
import { COMPONENT_COLORS } from '../../types';

const { Text, Title } = Typography;

// 颜色选择器组件
const ColorSelector: React.FC<{
  value?: ComponentColor;
  onChange: (color: ComponentColor) => void;
  componentId: string;
}> = ({ value, onChange, componentId }) => {
  // 接头只能用黑色
  const [type] = componentId.split('_');
  const isConnector = type === 'connector' || type === 'elbow' || type === 'tee' || type === 'cross';
  
  if (isConnector) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: COMPONENT_COLORS.black.hex,
            border: '2px solid #1890ff',
          }}
          title="黑色（接头固定颜色）"
        />
        <Text type="secondary" style={{ fontSize: 12, lineHeight: '24px' }}>
          接头统一使用黑色
        </Text>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(Object.keys(COMPONENT_COLORS) as ComponentColor[]).filter(c => c !== 'black').map((color) => (
        <div
          key={color}
          onClick={() => onChange(color)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: COMPONENT_COLORS[color].hex,
            border: value === color ? '2px solid #1890ff' : '2px solid #d9d9d9',
            cursor: 'pointer',
          }}
          title={COMPONENT_COLORS[color].name}
        />
      ))}
    </div>
  );
};

const PropertiesPanel: React.FC = () => {
  const { components, editor, removeComponent, updateComponent, clearSelection, duplicateSelected } = useDesignStore();
  
  // 获取选中的组件
  const selectedComponents = useMemo(() => {
    return components.filter(c => editor.selectedComponents.includes(c.instanceId));
  }, [components, editor.selectedComponents]);
  
  // 如果没有选中组件
  if (selectedComponents.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>未选中任何组件</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击3D视图中的组件进行选择
              </Text>
            </div>
          }
        />
      </div>
    );
  }
  
  // 如果选中多个组件
  if (selectedComponents.length > 1) {
    return (
      <div style={{ padding: 16 }}>
        <Title level={5}>多选组件</Title>
        <div style={{ marginBottom: 16 }}>
          <Text>已选中 {selectedComponents.length} 个组件</Text>
        </div>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<CopyOutlined />}
            onClick={duplicateSelected}
          >
            复制选中组件
          </Button>
          <Button
            block
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              selectedComponents.forEach(c => removeComponent(c.instanceId));
              clearSelection();
            }}
          >
            删除选中组件
          </Button>
        </Space>
        
        <Divider />
        
        <div style={{ fontSize: 12, color: '#666' }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选中的组件：</div>
          {selectedComponents.map(c => {
            const def = getComponentById(c.componentId);
            return (
              <div key={c.instanceId} style={{ marginBottom: 4 }}>
                <Tag>{def?.name || c.componentId}</Tag>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  // 单个组件选中
  const component = selectedComponents[0];
  const definition = getComponentById(component.componentId);
  
  if (!definition) {
    return <div style={{ padding: 16 }}>组件定义未找到</div>;
  }
  
  // 处理位置变化
  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number | null) => {
    if (value === null) return;
    const newPosition = [...component.position] as [number, number, number];
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newPosition[axisIndex] = value;
    updateComponent(component.instanceId, { position: newPosition });
  };
  
  // 处理旋转变化
  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number | null) => {
    if (value === null) return;
    const newRotation = [...component.rotation] as [number, number, number];
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newRotation[axisIndex] = value % 360;
    updateComponent(component.instanceId, { rotation: newRotation });
  };
  
  // 快速旋转
  const handleQuickRotate = (axis: 'x' | 'y' | 'z', degrees: number) => {
    const newRotation = [...component.rotation] as [number, number, number];
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    newRotation[axisIndex] = ((newRotation[axisIndex] + degrees) % 360 + 360) % 360;
    updateComponent(component.instanceId, { rotation: newRotation });
  };
  
  // 处理颜色变化
  const handleColorChange = (color: ComponentColor) => {
    updateComponent(component.instanceId, { color });
  };
  
  // 获取组件图标
  const getComponentIcon = () => {
    switch (definition.type) {
      case 'pipe': return '🔧';
      case 'elbow': return '↩️';
      case 'tee': return '🔀';
      case 'cross': return '✳️';
      case 'platform': return '⬜';
      case 'swing': return '🎠';
      case 'slide': return '🛝';
      case 'rope_ladder': return '🪜';
      default: return '📦';
    }
  };
  
  // 获取组件规格
  const getSpecifications = () => {
    const specs: string[] = [];
    if (definition.length) specs.push(`长度: ${definition.length}cm`);
    if (definition.width && definition.height) specs.push(`尺寸: ${definition.width}×${definition.height}cm`);
    if (definition.angle) specs.push(`角度: ${definition.angle}°`);
    if (definition.diameter) specs.push(`直径: ${definition.diameter}cm`);
    return specs;
  };
  
  return (
    <div style={{ padding: 16 }}>
      {/* 组件信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: '#f5f5f5',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {getComponentIcon()}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{definition.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {definition.type} · {definition.category}
            </div>
          </div>
        </div>
        
        {/* 组件规格 */}
        <div style={{ fontSize: 12, color: '#666', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
          {getSpecifications().map((spec, index) => (
            <div key={index}>{spec}</div>
          ))}
        </div>
      </Card>
      
      {/* 颜色选择 */}
      <Card size="small" title="颜色" style={{ marginBottom: 16 }}>
        <ColorSelector
          value={component.color}
          onChange={handleColorChange}
          componentId={component.componentId}
        />
      </Card>
      
      {/* 位置控制 */}
      <Card size="small" title="位置" style={{ marginBottom: 16 }}>
        <Form layout="vertical" size="small">
          <Space style={{ width: '100%' }}>
            <Form.Item label="X" style={{ flex: 1, marginBottom: 8 }}>
              <InputNumber
                value={component.position[0]}
                onChange={(v) => handlePositionChange('x', v)}
                style={{ width: '100%' }}
                addonAfter="cm"
                step={20}
              />
            </Form.Item>
            <Form.Item label="Y" style={{ flex: 1, marginBottom: 8 }}>
              <InputNumber
                value={component.position[1]}
                onChange={(v) => handlePositionChange('y', v)}
                style={{ width: '100%' }}
                addonAfter="cm"
                step={20}
              />
            </Form.Item>
            <Form.Item label="Z" style={{ flex: 1, marginBottom: 8 }}>
              <InputNumber
                value={component.position[2]}
                onChange={(v) => handlePositionChange('z', v)}
                style={{ width: '100%' }}
                addonAfter="cm"
                step={20}
              />
            </Form.Item>
          </Space>
        </Form>
      </Card>
      
      {/* 旋转控制 */}
      <Card size="small" title="旋转" style={{ marginBottom: 16 }}>
        <Form layout="vertical" size="small">
          <Form.Item label="X轴" style={{ marginBottom: 8 }}>
            <Space style={{ width: '100%' }}>
              <InputNumber
                value={component.rotation[0]}
                onChange={(v) => handleRotationChange('x', v)}
                style={{ flex: 1 }}
                addonAfter="°"
                step={15}
              />
              <Button
                size="small"
                icon={<RotateLeftOutlined />}
                onClick={() => handleQuickRotate('x', -90)}
              />
              <Button
                size="small"
                icon={<RotateRightOutlined />}
                onClick={() => handleQuickRotate('x', 90)}
              />
            </Space>
          </Form.Item>
          <Form.Item label="Y轴" style={{ marginBottom: 8 }}>
            <Space style={{ width: '100%' }}>
              <InputNumber
                value={component.rotation[1]}
                onChange={(v) => handleRotationChange('y', v)}
                style={{ flex: 1 }}
                addonAfter="°"
                step={15}
              />
              <Button
                size="small"
                icon={<RotateLeftOutlined />}
                onClick={() => handleQuickRotate('y', -90)}
              />
              <Button
                size="small"
                icon={<RotateRightOutlined />}
                onClick={() => handleQuickRotate('y', 90)}
              />
            </Space>
          </Form.Item>
          <Form.Item label="Z轴" style={{ marginBottom: 8 }}>
            <Space style={{ width: '100%' }}>
              <InputNumber
                value={component.rotation[2]}
                onChange={(v) => handleRotationChange('z', v)}
                style={{ flex: 1 }}
                addonAfter="°"
                step={15}
              />
              <Button
                size="small"
                icon={<RotateLeftOutlined />}
                onClick={() => handleQuickRotate('z', -90)}
              />
              <Button
                size="small"
                icon={<RotateRightOutlined />}
                onClick={() => handleQuickRotate('z', 90)}
              />
            </Space>
          </Form.Item>
        </Form>
      </Card>
      
      {/* 操作按钮 */}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          block
          icon={<CopyOutlined />}
          onClick={duplicateSelected}
        >
          复制组件
        </Button>
        <Button
          block
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            removeComponent(component.instanceId);
            clearSelection();
          }}
        >
          删除组件
        </Button>
      </Space>
      
      {/* 连接点信息 */}
      <Divider />
      <div style={{ fontSize: 12, color: '#666' }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>连接点 ({definition.connectionPoints.length})</div>
        {definition.connectionPoints.map((point) => (
          <div key={point.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag color={point.type === 'socket' ? 'blue' : 'green'}>{point.type}</Tag>
            <span>{point.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertiesPanel;
