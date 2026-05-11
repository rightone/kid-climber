import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, InputNumber, Button, Space, Typography, Divider, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// 精确输入对话框
interface PreciseInputDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (position: [number, number, number], rotation: [number, number, number]) => void;
  initialPosition?: [number, number, number];
  initialRotation?: [number, number, number];
  componentName?: string;
}

export const PreciseInputDialog: React.FC<PreciseInputDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  initialPosition = [0, 0, 0],
  initialRotation = [0, 0, 0],
  componentName = '组件',
}) => {
  const [form] = Form.useForm();
  
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        x: initialPosition[0],
        y: initialPosition[1],
        z: initialPosition[2],
        rotX: initialRotation[0],
        rotY: initialRotation[1],
        rotZ: initialRotation[2],
      });
    }
  }, [visible, initialPosition, initialRotation, form]);
  
  const handleConfirm = useCallback(() => {
    form.validateFields().then(values => {
      const position: [number, number, number] = [values.x, values.y, values.z];
      const rotation: [number, number, number] = [values.rotX, values.rotY, values.rotZ];
      onConfirm(position, rotation);
      onClose();
    });
  }, [form, onConfirm, onClose]);
  
  const handleReset = useCallback(() => {
    form.setFieldsValue({
      x: 0,
      y: 0,
      z: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
    });
  }, [form]);
  
  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>精确输入 - {componentName}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={handleReset}>重置</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleConfirm}>确认</Button>
        </Space>
      }
      width={400}
    >
      <Form form={form} layout="vertical">
        <Title level={5}>位置 (厘米)</Title>
        <Space style={{ width: '100%' }}>
          <Form.Item name="x" label="X" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={20} />
          </Form.Item>
          <Form.Item name="y" label="Y" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={20} />
          </Form.Item>
          <Form.Item name="z" label="Z" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={20} />
          </Form.Item>
        </Space>
        
        <Divider />
        
        <Title level={5}>旋转 (度)</Title>
        <Space style={{ width: '100%' }}>
          <Form.Item name="rotX" label="X轴" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={15} min={-180} max={180} />
          </Form.Item>
          <Form.Item name="rotY" label="Y轴" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={15} min={-180} max={180} />
          </Form.Item>
          <Form.Item name="rotZ" label="Z轴" style={{ flex: 1 }}>
            <InputNumber style={{ width: '100%' }} step={15} min={-180} max={180} />
          </Form.Item>
        </Space>
        
        <Divider />
        
        <Text type="secondary" style={{ fontSize: 12 }}>
          提示：按 Tab 键快速切换输入框，按 Enter 键确认
        </Text>
      </Form>
    </Modal>
  );
};

// 快速旋转按钮组
export const QuickRotateButtons: React.FC<{
  onRotate: (axis: 'x' | 'y' | 'z', degrees: number) => void;
}> = ({ onRotate }) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text strong>快速旋转</Text>
      <Space wrap>
        <Button size="small" onClick={() => onRotate('y', 90)}>
          Y +90°
        </Button>
        <Button size="small" onClick={() => onRotate('y', -90)}>
          Y -90°
        </Button>
        <Button size="small" onClick={() => onRotate('x', 90)}>
          X +90°
        </Button>
        <Button size="small" onClick={() => onRotate('x', -90)}>
          X -90°
        </Button>
        <Button size="small" onClick={() => onRotate('z', 90)}>
          Z +90°
        </Button>
        <Button size="small" onClick={() => onRotate('z', -90)}>
          Z -90°
        </Button>
      </Space>
    </Space>
  );
};

// 快速位置按钮组
export const QuickPositionButtons: React.FC<{
  onMove: (axis: 'x' | 'y' | 'z', distance: number) => void;
  gridSize?: number;
}> = ({ onMove, gridSize = 20 }) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text strong>快速移动</Text>
      <Space wrap>
        <Button size="small" onClick={() => onMove('x', gridSize)}>
          X +{gridSize}
        </Button>
        <Button size="small" onClick={() => onMove('x', -gridSize)}>
          X -{gridSize}
        </Button>
        <Button size="small" onClick={() => onMove('y', gridSize)}>
          Y +{gridSize}
        </Button>
        <Button size="small" onClick={() => onMove('y', -gridSize)}>
          Y -{gridSize}
        </Button>
        <Button size="small" onClick={() => onMove('z', gridSize)}>
          Z +{gridSize}
        </Button>
        <Button size="small" onClick={() => onMove('z', -gridSize)}>
          Z -{gridSize}
        </Button>
      </Space>
    </Space>
  );
};

export default PreciseInputDialog;
