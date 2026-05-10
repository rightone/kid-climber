import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Form, Input, Select, Button, message, Typography, List, Tag, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 设计模板
interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  components: any[];
  connections: any[];
  thumbnail?: string;
}

// 预设模板
const defaultTemplates: DesignTemplate[] = [
  {
    id: 'simple_frame',
    name: '简单框架',
    description: '一个简单的矩形框架结构',
    category: '基础',
    components: [
      { componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [0, 0, 0] },
      { componentId: 'elbow_90deg', position: [0, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'elbow_90deg', position: [30, 0, 0], rotation: [0, 90, 0] },
      { componentId: 'elbow_90deg', position: [0, 0, 30], rotation: [0, -90, 0] },
      { componentId: 'elbow_90deg', position: [30, 0, 30], rotation: [0, 180, 0] },
    ],
    connections: [],
  },
  {
    id: 'cube_frame',
    name: '立方体框架',
    description: '一个立方体框架结构',
    category: '基础',
    components: [
      // 底部
      { componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [0, 0, 0] },
      // 顶部
      { componentId: 'pipe_30cm', position: [0, 30, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 30, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [0, 30, 30], rotation: [0, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 30, 30], rotation: [0, 0, 0] },
      // 立柱
      { componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [90, 0, 0] },
    ],
    connections: [],
  },
  {
    id: 'platform_structure',
    name: '平台结构',
    description: '带有平台的攀爬架结构',
    category: '进阶',
    components: [
      // 底部框架
      { componentId: 'pipe_60cm', position: [0, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_60cm', position: [60, 0, 0], rotation: [0, 0, 0] },
      { componentId: 'pipe_60cm', position: [0, 0, 60], rotation: [0, 0, 0] },
      { componentId: 'pipe_60cm', position: [60, 0, 60], rotation: [0, 0, 0] },
      // 立柱
      { componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [60, 0, 0], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [0, 0, 60], rotation: [90, 0, 0] },
      { componentId: 'pipe_30cm', position: [60, 0, 60], rotation: [90, 0, 0] },
      // 平台
      { componentId: 'platform_large', position: [30, 30, 30], rotation: [0, 0, 0] },
    ],
    connections: [],
  },
];

// 模板管理器
const TemplateManager: React.FC = () => {
  const { addComponent, reset } = useDesignStore();
  const [templates, setTemplates] = useState<DesignTemplate[]>(defaultTemplates);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 应用模板
  const applyTemplate = useCallback((template: DesignTemplate) => {
    // 清空当前设计
    reset();
    
    // 添加模板组件
    template.components.forEach((comp, index) => {
      addComponent({
        instanceId: `template_${Date.now()}_${index}`,
        componentId: comp.componentId,
        position: comp.position,
        rotation: comp.rotation,
        scale: [1, 1, 1],
      });
    });
    
    message.success(`已应用模板: ${template.name}`);
  }, [addComponent, reset]);
  
  // 保存为模板
  const saveAsTemplate = useCallback(() => {
    form.validateFields().then(values => {
      const newTemplate: DesignTemplate = {
        id: `custom_${Date.now()}`,
        name: values.name,
        description: values.description,
        category: values.category,
        components: [], // 这里应该从当前设计中获取
        connections: [],
      };
      
      setTemplates(prev => [...prev, newTemplate]);
      message.success('模板保存成功');
      setCreateModalVisible(false);
      form.resetFields();
    });
  }, [form]);
  
  // 删除模板
  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    message.success('模板已删除');
  }, []);
  
  // 按分类分组
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, DesignTemplate[]> = {};
    templates.forEach(template => {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    });
    return groups;
  }, [templates]);
  
  return (
    <>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
        
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category} style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{category}</Text>
            <List
              size="small"
              dataSource={categoryTemplates}
              renderItem={(template) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      onClick={() => applyTemplate(template)}
                    >
                      使用
                    </Button>,
                    template.id.startsWith('custom_') && (
                      <Popconfirm
                        title="确定要删除这个模板吗？"
                        onConfirm={() => deleteTemplate(template.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" danger size="small">
                          删除
                        </Button>
                      </Popconfirm>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={template.name}
                    description={
                      <div>
                        <div>{template.description}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          <Tag>{template.components.length} 个组件</Tag>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ))}
      </div>
      
      {/* 创建模板弹窗 */}
      <Modal
        title="保存为模板"
        open={createModalVisible}
        onOk={saveAsTemplate}
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
          <Form.Item
            name="description"
            label="模板描述"
          >
            <TextArea rows={3} placeholder="请输入模板描述" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            initialValue="自定义"
          >
            <Select>
              <Select.Option value="基础">基础</Select.Option>
              <Select.Option value="进阶">进阶</Select.Option>
              <Select.Option value="自定义">自定义</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TemplateManager;
