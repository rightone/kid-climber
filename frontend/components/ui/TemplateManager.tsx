import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Typography,
} from 'antd';
import { PictureOutlined, PlusOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import { useBuildPreferencesStore } from '../../stores/buildPreferencesStore';
import {
  createTemplatePatch,
  instantiateTemplate,
  templateManager,
  templateUtils,
  validateTemplate,
  type DesignTemplateV2,
  type TemplateCategory,
} from '../../utils/templateUtils';
import TemplatePreview from './TemplatePreview';
import {
  clearTemplateThumbnailCache,
  renderTemplateThumbnail,
} from '../../utils/thumbnailUtils';
import type { PipeColorMode } from '../../systems/PipeColorSystem';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface TemplateManagerProps {
  onPlacementStart?: () => void;
}

interface TemplateThumbnailProps {
  template: DesignTemplateV2;
  pipeColorMode: PipeColorMode;
}

const TemplateThumbnail = memo<TemplateThumbnailProps>(({
  template,
  pipeColorMode,
}) => {
  const [thumbnail, setThumbnail] = useState('');

  useEffect(() => {
    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      const nextThumbnail = renderTemplateThumbnail(template, {
        size: 128,
        pipeColorMode,
      });
      if (!cancelled) setThumbnail(nextThumbnail);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [pipeColorMode, template]);

  if (!thumbnail) {
    return (
      <span className="template-card-thumbnail template-card-thumbnail-loading">
        <PictureOutlined aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className="template-card-thumbnail"
      src={thumbnail}
      alt={`${template.name}结构缩略图`}
    />
  );
});

TemplateThumbnail.displayName = 'TemplateThumbnail';

const TemplateManager: React.FC<TemplateManagerProps> = ({ onPlacementStart }) => {
  const designStore = useDesignStore();
  const startTemplatePlacement = useInteractionStore(
    state => state.startTemplatePlacement
  );
  const pipeColorMode = useBuildPreferencesStore(state => state.pipeColorMode);
  const [templates, setTemplates] = useState<DesignTemplateV2[]>(() =>
    templateManager.getTemplates()
  );
  const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplateV2 | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const refreshTemplates = useCallback(() => {
    clearTemplateThumbnailCache();
    setTemplates(templateManager.getTemplates());
  }, []);

  const groupedTemplates = useMemo(() => {
    return templates.reduce<Record<string, DesignTemplateV2[]>>((groups, template) => {
      const categoryName = templateUtils.getCategoryName(template.category);
      groups[categoryName] = [...(groups[categoryName] ?? []), template];
      return groups;
    }, {});
  }, [templates]);

  const commitTemplate = useCallback((
    template: DesignTemplateV2,
    replace: boolean
  ) => {
    const validation = validateTemplate(template);
    if (!validation.valid) {
      message.error(`模板连接不完整：${validation.errors[0] ?? '无法应用'}`);
      return;
    }
    const currentComponents = designStore.components;
    const currentConnections = designStore.connections;
    const origin: [number, number, number] = replace || currentComponents.length === 0
      ? [0, 0, 0]
      : [
          Math.max(...currentComponents.map(component => component.position[0]), 0) + 70,
          0,
          0,
        ];
    const patch = createTemplatePatch({
      template,
      existingComponents: currentComponents,
      existingConnections: currentConnections,
      replace,
      origin,
      mode: pipeColorMode,
    });
    designStore.commitTopologyPatch(patch);
    setSelectedTemplate(null);
    onPlacementStart?.();
    message.success(replace ? `已应用模板：${template.name}` : `已添加模板：${template.name}`);
  }, [designStore, onPlacementStart, pipeColorMode]);

  const handleCreateNew = useCallback((template: DesignTemplateV2) => {
    if (designStore.components.length > 0 || designStore.connections.length > 0) {
      Modal.confirm({
        title: '替换当前设计？',
        content: '当前画布内容会被模板替换；可通过撤销恢复。',
        okText: '替换',
        cancelText: '取消',
        onOk: () => commitTemplate(template, true),
      });
      return;
    }
    commitTemplate(template, true);
  }, [commitTemplate, designStore.components.length, designStore.connections.length]);

  const handleAddToCurrent = useCallback((template: DesignTemplateV2) => {
    const validation = validateTemplate(template);
    if (!validation.valid) {
      message.error(`模板连接不完整：${validation.errors[0] ?? '无法应用'}`);
      return;
    }
    const instance = instantiateTemplate({
      template,
      existingComponents: designStore.components,
      existingConnections: designStore.connections,
      mode: pipeColorMode,
    });
    startTemplatePlacement({
      templateId: template.id,
      templateName: template.name,
      components: instance.components,
      connections: instance.connections,
    });
    setSelectedTemplate(null);
    onPlacementStart?.();
    message.info('模板已进入整体放置：移动鼠标定位，可旋转 90° 后提交');
  }, [
    designStore.components,
    designStore.connections,
    onPlacementStart,
    pipeColorMode,
    startTemplatePlacement,
  ]);

  const handleSaveAsTemplate = useCallback(() => {
    form.validateFields().then(values => {
      if (designStore.components.length === 0) {
        message.warning('当前没有可保存的组件');
        return;
      }
      templateManager.createTemplateFromDesign(
        values.name,
        values.description ?? '',
        values.category as TemplateCategory,
        designStore.components,
        designStore.connections,
        []
      );
      refreshTemplates();
      form.resetFields();
      setCreateModalVisible(false);
      message.success('模板保存成功');
    });
  }, [designStore.components, designStore.connections, form, refreshTemplates]);

  return (
    <>
      <div className="template-manager">
        <div className="template-manager-header">
          <Title level={5} style={{ margin: 0 }}>设计模板</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setCreateModalVisible(true)}
          >
            保存为模板
          </Button>
        </div>
        <div className="template-manager-list">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <section key={category} className="template-category" aria-labelledby={`template-category-${category}`}>
              <Text
                id={`template-category-${category}`}
                strong
                className="template-category-title"
              >
                {category}
              </Text>
              <div className="template-card-list">
                {categoryTemplates.map(template => {
                  const validation = validateTemplate(template);
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className="template-card"
                      onClick={() => setSelectedTemplate(template)}
                      aria-label={`预览模板：${template.name}`}
                    >
                      <TemplateThumbnail
                        key={`${template.id}:${pipeColorMode}`}
                        template={template}
                        pipeColorMode={pipeColorMode}
                      />
                      <span className="template-card-content">
                        <span className="template-card-title">{template.name}</span>
                        <span className="template-card-description">{template.description}</span>
                        <span className="template-card-meta">
                          <span>{template.components.length}组件 · {template.connections.length}连接</span>
                          <span
                            className={validation.valid
                              ? 'template-card-status is-valid'
                              : 'template-card-status is-invalid'}
                          >
                            {validation.valid ? '结构完整' : '连接不完整'}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <TemplatePreview
        template={selectedTemplate}
        open={Boolean(selectedTemplate)}
        onClose={() => setSelectedTemplate(null)}
        onCreateNew={handleCreateNew}
        onAddToCurrent={handleAddToCurrent}
      />

      <Modal
        title="保存为模板"
        open={createModalVisible}
        onOk={handleSaveAsTemplate}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <TextArea rows={3} placeholder="请输入模板描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="custom">
            <Select>
              <Select.Option value="basic">基础</Select.Option>
              <Select.Option value="playground">游乐场</Select.Option>
              <Select.Option value="fitness">健身</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
              <Select.Option value="community">社区</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TemplateManager;
