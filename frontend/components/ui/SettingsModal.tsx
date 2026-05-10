import React from 'react';
import { Modal, Form, Switch, Select, InputNumber, Button, Space, message, Divider, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';

const { Title } = Typography;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { editor, setEditorState } = useDesignStore();
  const [form] = Form.useForm();
  
  // 初始化表单值
  React.useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        gridSize: editor.gridSize,
        showGrid: editor.showGrid,
        showConnections: editor.showConnections,
        viewMode: editor.viewMode,
        snapToGrid: true,
        autoSave: true,
        autoSaveInterval: 5,
        language: 'zh-CN',
        theme: 'light',
      });
    }
  }, [visible, editor, form]);
  
  // 保存设置
  const handleSave = () => {
    form.validateFields().then(values => {
      // 更新编辑器状态
      setEditorState({
        gridSize: values.gridSize,
        showGrid: values.showGrid,
        showConnections: values.showConnections,
        viewMode: values.viewMode,
      });
      
      // 保存到本地存储
      localStorage.setItem('kid_climber_settings', JSON.stringify(values));
      
      message.success('设置已保存');
      onClose();
    });
  };
  
  // 重置设置
  const handleReset = () => {
    form.setFieldsValue({
      gridSize: 10,
      showGrid: true,
      showConnections: true,
      viewMode: 'realistic',
      snapToGrid: true,
      autoSave: true,
      autoSaveInterval: 5,
      language: 'zh-CN',
      theme: 'light',
    });
    
    message.info('设置已重置为默认值');
  };
  
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined />
          <span>设置</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={handleReset}>重置默认</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          gridSize: 10,
          showGrid: true,
          showConnections: true,
          viewMode: 'realistic',
          snapToGrid: true,
          autoSave: true,
          autoSaveInterval: 5,
          language: 'zh-CN',
          theme: 'light',
        }}
      >
        <Title level={5}>视图设置</Title>
        
        <Form.Item
          name="gridSize"
          label="网格大小"
          extra="3D视图中网格的间距（厘米）"
        >
          <Select>
            <Select.Option value={5}>5cm</Select.Option>
            <Select.Option value={10}>10cm</Select.Option>
            <Select.Option value={20}>20cm</Select.Option>
            <Select.Option value={50}>50cm</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          name="showGrid"
          label="显示网格"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        
        <Form.Item
          name="showConnections"
          label="显示连接点"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        
        <Form.Item
          name="snapToGrid"
          label="吸附到网格"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        
        <Form.Item
          name="viewMode"
          label="默认视图模式"
        >
          <Select>
            <Select.Option value="realistic">真实感模式</Select.Option>
            <Select.Option value="wireframe">线框模式</Select.Option>
            <Select.Option value="xray">X光模式</Select.Option>
            <Select.Option value="blackwhite">黑白模式</Select.Option>
          </Select>
        </Form.Item>
        
        <Divider />
        
        <Title level={5}>自动保存</Title>
        
        <Form.Item
          name="autoSave"
          label="启用自动保存"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        
        <Form.Item
          name="autoSaveInterval"
          label="自动保存间隔"
          extra="单位：分钟"
        >
          <InputNumber min={1} max={60} />
        </Form.Item>
        
        <Divider />
        
        <Title level={5}>界面设置</Title>
        
        <Form.Item
          name="language"
          label="语言"
        >
          <Select>
            <Select.Option value="zh-CN">简体中文</Select.Option>
            <Select.Option value="en-US">English</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          name="theme"
          label="主题"
        >
          <Select>
            <Select.Option value="light">浅色主题</Select.Option>
            <Select.Option value="dark">深色主题</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
