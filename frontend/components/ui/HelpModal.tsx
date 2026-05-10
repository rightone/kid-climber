import React, { useState } from 'react';
import { Modal, Tabs, Table, Typography, Divider, List, Tag } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { getShortcutHelp, getShortcutDescription } from '../../utils/shortcutUtils';

const { Title, Paragraph, Text } = Typography;

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('shortcuts');
  
  // 快捷键帮助数据
  const shortcutHelp = getShortcutHelp();
  
  // 快捷键表格列定义
  const shortcutColumns = [
    {
      title: '快捷键',
      dataIndex: 'key',
      key: 'key',
      render: (_: any, record: any) => (
        <Tag color="blue">{getShortcutDescription(record)}</Tag>
      ),
    },
    {
      title: '功能',
      dataIndex: 'description',
      key: 'description',
    },
  ];
  
  // 使用说明数据
  const usageInstructions = [
    {
      title: '基本操作',
      items: [
        '从左侧组件库拖拽组件到3D视图',
        '点击组件进行选择',
        '按住Shift键多选组件',
        '使用鼠标左键旋转视角',
        '使用鼠标滚轮缩放',
        '使用鼠标右键平移视图',
      ],
    },
    {
      title: '组件操作',
      items: [
        '选中组件后，右侧属性面板显示组件属性',
        '可以修改组件的位置、旋转和缩放',
        '支持复制、粘贴和删除组件',
        '组件会自动吸附到网格',
        '连接点会自动对齐',
      ],
    },
    {
      title: '材料管理',
      items: [
        '切换到右侧"材料"标签页',
        '查看设计所需的材料清单',
        '编辑已有材料数量',
        '系统自动计算缺少的材料',
        '支持打印和导出材料清单',
      ],
    },
    {
      title: '文件操作',
      items: [
        '点击"保存"按钮保存当前设计',
        '点击"打开"按钮加载已保存的设计',
        '支持导入和导出设计文件',
        '支持导出为PNG、OBJ、GLTF格式',
        '设计文件自动保存到本地存储',
      ],
    },
    {
      title: '视图控制',
      items: [
        '按1/2/3/4切换视图模式',
        '按G切换网格显示',
        '按L切换连接点显示',
        '支持真实感、线框、X光和黑白模式',
        '可以调整网格大小',
      ],
    },
  ];
  
  // 关于信息
  const aboutInfo = {
    name: 'Kid Climber',
    version: '1.0.0',
    description: '攀爬架结构设计软件',
    features: [
      '3D可视化设计',
      '拖拽式组件放置',
      '实时预览和旋转',
      '材料清单管理',
      '多格式导出',
      '快捷键支持',
    ],
    techStack: [
      'React + TypeScript',
      'Three.js + react-three-fiber',
      'Zustand 状态管理',
      'Ant Design UI组件库',
      'Tauri 桌面打包',
      'Go + Gin 后端',
    ],
  };
  
  // 标签页配置
  const tabItems = [
    {
      key: 'shortcuts',
      label: '快捷键',
      children: (
        <div>
          {shortcutHelp.map((category) => (
            <div key={category.category} style={{ marginBottom: 24 }}>
              <Title level={5}>{category.category}</Title>
              <Table
                dataSource={category.shortcuts}
                columns={shortcutColumns}
                pagination={false}
                size="small"
                rowKey="key"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'usage',
      label: '使用说明',
      children: (
        <div>
          {usageInstructions.map((section) => (
            <div key={section.title} style={{ marginBottom: 24 }}>
              <Title level={5}>{section.title}</Title>
              <List
                dataSource={section.items}
                renderItem={(item) => (
                  <List.Item>
                    <Text>• {item}</Text>
                  </List.Item>
                )}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'about',
      label: '关于',
      children: (
        <div>
          <Title level={3}>{aboutInfo.name}</Title>
          <Paragraph>
            <Text strong>版本: </Text>
            <Text>{aboutInfo.version}</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>描述: </Text>
            <Text>{aboutInfo.description}</Text>
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>主要功能</Title>
          <List
            dataSource={aboutInfo.features}
            renderItem={(item) => (
              <List.Item>
                <Text>✓ {item}</Text>
              </List.Item>
            )}
          />
          
          <Divider />
          
          <Title level={5}>技术栈</Title>
          <List
            dataSource={aboutInfo.techStack}
            renderItem={(item) => (
              <List.Item>
                <Tag color="blue">{item}</Tag>
              </List.Item>
            )}
          />
        </div>
      ),
    },
  ];
  
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QuestionCircleOutlined />
          <span>帮助</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};

export default HelpModal;
