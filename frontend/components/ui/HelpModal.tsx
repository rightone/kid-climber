import React from 'react';
import { Modal, Tabs, Table, Typography, Divider, Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { getShortcutHelp, getShortcutDescription } from '../../utils/shortcutUtils';
import type { ShortcutConfig } from '../../utils/shortcutUtils';

const { Title, Paragraph, Text } = Typography;

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  activeTab?: HelpTabKey;
  onTabChange?: (tab: HelpTabKey) => void;
}

export type HelpTabKey = 'shortcuts' | 'usage' | 'about';

const PROJECT_URL = 'https://github.com/rightone/kid-climber';

const ABOUT_INFO = {
  name: 'Kid Climber',
  version: __APP_VERSION__,
  description: '攀爬架结构设计软件',
  features: [
    '3D可视化设计',
    '任务式高级结构搭建',
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

const HelpModal: React.FC<HelpModalProps> = ({
  visible,
  onClose,
  activeTab = 'shortcuts',
  onTabChange,
}) => {
  // 快捷键帮助数据
  const shortcutHelp = getShortcutHelp();
  
  // 快捷键表格列定义
  const shortcutColumns: TableColumnsType<ShortcutConfig> = [
    {
      title: '快捷键',
      dataIndex: 'key',
      key: 'key',
      render: (_, record) => (
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
        '点击“添加组件”打开组件库，再点击或拖拽组件到3D视图',
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
        '选择、移动、旋转工具会在顶部明确显示当前状态',
        '选中组件后，画布右侧显示轻量属性面板',
        '支持复制、粘贴和删除组件',
        '管件可通过右键快速切换红、黄、蓝、绿四种颜色',
        '放置时会按当前搭建设置执行网格和连接点吸附',
      ],
    },
    {
      title: '材料管理',
      items: [
        '点击“清单与分析”打开项目抽屉',
        '查看设计所需的材料清单',
        '编辑已有材料数量',
        '系统自动计算缺少的材料',
        '支持打印和导出材料清单',
      ],
    },
    {
      title: '文件操作',
      items: [
        '按Ctrl+S或点击“保存”保存当前设计',
        '在“文件”菜单中打开已保存的设计',
        '支持导入和导出设计文件',
        '支持导出KCD设计文件、PNG图片和OBJ模型',
      ],
    },
    {
      title: '视图控制',
      items: [
        '在“显示”菜单中切换地面网格、垂直网格和连接点标记',
        '按1/2/3/4切换真实感、线框、X光和黑白模式',
        '按G切换网格显示',
        '按L切换连接点显示',
        '连接预测和管长在画布命令栏中直接调整',
      ],
    },
  ];
  
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
                rowKey={getShortcutDescription}
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
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {section.items.map(item => (
                  <li key={item} style={{ marginBottom: 10 }}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
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
          <Title level={3}>{ABOUT_INFO.name}</Title>
          <Paragraph>
            <Text strong>版本: </Text>
            <Text>{ABOUT_INFO.version}</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>描述: </Text>
            <Text>{ABOUT_INFO.description}</Text>
          </Paragraph>

          <Paragraph>
            <Text strong>许可证: </Text>
            <Text>AGPL-3.0-only</Text>
          </Paragraph>
          <Paragraph>
            Kid Climber — an open-source climbing-frame design project by Kid Climber contributors.
          </Paragraph>
          <Paragraph>
            <Typography.Link href={PROJECT_URL} target="_blank" rel="noreferrer">
              {PROJECT_URL}
            </Typography.Link>
          </Paragraph>
          <Paragraph type="secondary">
            修改版不得歪曲项目来源，并应清楚标明所作修改。
            {' '}
            <Typography.Link
              href={`${PROJECT_URL}/blob/main/THIRD-PARTY-LICENSES.md`}
              target="_blank"
              rel="noreferrer"
            >
              查看第三方许可
            </Typography.Link>
            。
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>主要功能</Title>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {ABOUT_INFO.features.map(item => (
              <li key={item} style={{ marginBottom: 10 }}>
                <Text>{item}</Text>
              </li>
            ))}
          </ul>
          
          <Divider />
          
          <Title level={5}>技术栈</Title>
          <Space wrap size={[8, 8]}>
            {ABOUT_INFO.techStack.map(item => (
              <Tag key={item} color="blue">{item}</Tag>
            ))}
          </Space>
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
        onChange={key => onTabChange?.(key as HelpTabKey)}
        items={tabItems}
      />
    </Modal>
  );
};

export default HelpModal;
