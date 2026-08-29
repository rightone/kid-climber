import React from 'react';
import { Button, Divider, Form, Modal, Select, Space, Switch, Typography, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import { useBuildPreferencesStore } from '../../stores/buildPreferencesStore';
import { PIPE_COLOR_MODE_OPTIONS, type PipeColorMode } from '../../systems/PipeColorSystem';

const { Title } = Typography;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SettingsFormValues {
  gridSize: number;
  snapToGrid: boolean;
  snapToComponent: boolean;
  pipeColorMode: PipeColorMode;
}

const DEFAULT_SETTINGS: SettingsFormValues = {
  gridSize: 20,
  snapToGrid: true,
  snapToComponent: true,
  pipeColorMode: 'auto',
};

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { editor, setEditorState } = useDesignStore();
  const {
    interaction,
    setSnapToGrid,
    setSnapToComponent,
  } = useInteractionStore();
  const {
    pipeColorMode,
    setPipeColorMode,
    hydrateFromLocalStorage,
  } = useBuildPreferencesStore();
  const [form] = Form.useForm<SettingsFormValues>();

  React.useEffect(() => {
    if (!visible) return;

    hydrateFromLocalStorage();
    form.setFieldsValue({
      gridSize: editor.gridSize,
      snapToGrid: interaction.snapToGrid,
      snapToComponent: interaction.snapToComponent,
      pipeColorMode,
    });
  }, [
    editor.gridSize,
    form,
    hydrateFromLocalStorage,
    interaction.snapToComponent,
    interaction.snapToGrid,
    pipeColorMode,
    visible,
  ]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setEditorState({ gridSize: values.gridSize });
    setSnapToGrid(values.snapToGrid);
    setSnapToComponent(values.snapToComponent);
    setPipeColorMode(values.pipeColorMode);
    message.success('搭建设置已保存');
    onClose();
  };

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_SETTINGS);
    message.info('已恢复推荐设置，点击保存后生效');
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined />
          <span>搭建设置</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={handleReset}>恢复推荐</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存设置
          </Button>
        </Space>
      }
      width={520}
    >
      <Form<SettingsFormValues>
        form={form}
        layout="vertical"
        initialValues={DEFAULT_SETTINGS}
      >
        <Title level={5}>网格</Title>

        <Form.Item
          name="gridSize"
          label="网格间距"
          extra="决定地面网格和网格吸附的步长"
        >
          <Select
            options={[
              { value: 5, label: '5cm' },
              { value: 10, label: '10cm' },
              { value: 20, label: '20cm（推荐）' },
              { value: 50, label: '50cm' },
            ]}
          />
        </Form.Item>

        <Divider />

        <Title level={5}>放置与吸附</Title>

        <Form.Item
          name="snapToComponent"
          label="连接点吸附"
          valuePropName="checked"
          extra="放置或移动组件时优先对齐兼容的连接点"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="snapToGrid"
          label="网格吸附"
          valuePropName="checked"
          extra="没有可连接位置时，按当前网格间距对齐"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="pipeColorMode"
          label="新管件颜色"
          extra="只影响之后新放置的管件，不改变已有设计和撤销历史"
        >
          <Select
            options={PIPE_COLOR_MODE_OPTIONS.map(option => ({
              value: option.id,
              label: `${option.name} · ${option.description}`,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
