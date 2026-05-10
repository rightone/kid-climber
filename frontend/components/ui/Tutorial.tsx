import React, { useState, useCallback } from 'react';
import { Modal, Steps, Button, Typography, Space, Card, List, Tag } from 'antd';
import { 
  QuestionCircleOutlined, 
  ArrowRightOutlined, 
  ArrowLeftOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  ToolOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// 教程步骤
interface TutorialStep {
  title: string;
  content: React.ReactNode;
  icon: React.ReactNode;
}

// 教程组件
const Tutorial: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // 教程步骤
  const tutorialSteps: TutorialStep[] = [
    {
      title: '欢迎使用',
      icon: <RocketOutlined />,
      content: (
        <div>
          <Title level={4}>欢迎使用 Kid Climber</Title>
          <Paragraph>
            Kid Climber 是一款专业的攀爬架结构设计软件，帮助您轻松设计和规划攀爬架结构。
          </Paragraph>
          <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Text>本教程将引导您了解软件的基本功能和操作方法。</Text>
          </Card>
        </div>
      ),
    },
    {
      title: '组件库',
      icon: <ToolOutlined />,
      content: (
        <div>
          <Title level={4}>使用组件库</Title>
          <Paragraph>
            左侧面板是组件库，包含各种攀爬架组件：
          </Paragraph>
          <List
            size="small"
            dataSource={[
              { name: '基础管件', desc: '不同长度的直管' },
              { name: '连接件', desc: '弯头、三通、四通等' },
              { name: '平台类', desc: '各种尺寸的平台' },
              { name: '附件', desc: '秋千、滑梯等' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag color="blue">{item.name}</Tag>
                <Text>{item.desc}</Text>
              </List.Item>
            )}
          />
          <Paragraph style={{ marginTop: 16 }}>
            <Text strong>操作方法：</Text>
            <ul>
              <li>点击组件添加到设计中心</li>
              <li>拖拽组件到3D视图放置</li>
              <li>使用搜索框快速查找组件</li>
            </ul>
          </Paragraph>
        </div>
      ),
    },
    {
      title: '3D视图',
      icon: <ToolOutlined />,
      content: (
        <div>
          <Title level={4}>3D视图操作</Title>
          <Paragraph>
            中间区域是3D设计视图，支持以下操作：
          </Paragraph>
          <List
            size="small"
            dataSource={[
              { key: '左键拖拽', action: '旋转视角' },
              { key: '滚轮', action: '缩放视图' },
              { key: '右键拖拽', action: '平移视图' },
              { key: '点击组件', action: '选择组件' },
              { key: 'Shift+点击', action: '多选组件' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag>{item.key}</Tag>
                <Text>{item.action}</Text>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      title: '组件操作',
      icon: <ToolOutlined />,
      content: (
        <div>
          <Title level={4}>组件操作</Title>
          <Paragraph>
            选中组件后，可以进行以下操作：
          </Paragraph>
          <List
            size="small"
            dataSource={[
              { key: '位置调整', action: '在右侧属性面板修改X/Y/Z坐标' },
              { key: '旋转', action: '修改旋转角度或使用快速旋转按钮' },
              { key: '复制', action: 'Ctrl+C复制，Ctrl+V粘贴' },
              { key: '删除', action: '按Delete键删除选中组件' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag color="green">{item.key}</Tag>
                <Text>{item.action}</Text>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      title: '快捷键',
      icon: <ToolOutlined />,
      content: (
        <div>
          <Title level={4}>常用快捷键</Title>
          <List
            size="small"
            dataSource={[
              { key: 'V', action: '选择工具' },
              { key: 'M', action: '移动工具' },
              { key: 'R', action: '旋转工具' },
              { key: 'G', action: '切换网格显示' },
              { key: 'L', action: '切换连接点显示' },
              { key: 'Ctrl+Z', action: '撤销' },
              { key: 'Ctrl+Y', action: '重做' },
              { key: 'Ctrl+C/V', action: '复制/粘贴' },
              { key: 'Ctrl+A', action: '全选' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag color="orange">{item.key}</Tag>
                <Text>{item.action}</Text>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      title: '保存导出',
      icon: <SaveOutlined />,
      content: (
        <div>
          <Title level={4}>保存和导出</Title>
          <Paragraph>
            完成设计后，您可以：
          </Paragraph>
          <List
            size="small"
            dataSource={[
              { name: '保存设计', desc: '保存到本地，下次可继续编辑' },
              { name: '导出图片', desc: '导出为PNG图片分享' },
              { name: '导出3D模型', desc: '导出为OBJ格式用于其他软件' },
              { name: '材料清单', desc: '生成材料清单用于采购' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag color="purple">{item.name}</Tag>
                <Text>{item.desc}</Text>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      title: '开始设计',
      icon: <CheckCircleOutlined />,
      content: (
        <div>
          <Title level={4}>开始您的设计！</Title>
          <Paragraph>
            现在您已经了解了软件的基本操作，可以开始设计您的攀爬架了！
          </Paragraph>
          <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
            <Text>提示：先从组件库添加几个管子，然后尝试连接它们。</Text>
          </Card>
          <Paragraph style={{ marginTop: 16 }}>
            如需帮助，随时点击右上角的 <QuestionCircleOutlined /> 图标。
          </Paragraph>
        </div>
      ),
    },
  ];
  
  // 下一步
  const handleNext = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, tutorialSteps.length - 1));
  }, [tutorialSteps.length]);
  
  // 上一步
  const handlePrev = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);
  
  // 完成教程
  const handleFinish = useCallback(() => {
    setVisible(false);
    setCurrentStep(0);
    // 标记教程已完成
    localStorage.setItem('kid_climber_tutorial_completed', 'true');
  }, []);
  
  return (
    <>
      <Button
        icon={<QuestionCircleOutlined />}
        onClick={() => setVisible(true)}
      >
        教程
      </Button>
      
      <Modal
        title={
          <Space>
            <QuestionCircleOutlined />
            <span>使用教程</span>
          </Space>
        }
        open={visible}
        onCancel={() => setVisible(false)}
        footer={
          <Space>
            <Button
              disabled={currentStep === 0}
              onClick={handlePrev}
              icon={<ArrowLeftOutlined />}
            >
              上一步
            </Button>
            {currentStep < tutorialSteps.length - 1 ? (
              <Button
                type="primary"
                onClick={handleNext}
              >
                下一步
                <ArrowRightOutlined />
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleFinish}
                icon={<CheckCircleOutlined />}
              >
                完成
              </Button>
            )}
          </Space>
        }
        width={700}
      >
        <Steps
          current={currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={tutorialSteps.map(step => ({
            title: step.title,
            icon: step.icon,
          }))}
        />
        
        <div style={{ minHeight: 300 }}>
          {tutorialSteps[currentStep].content}
        </div>
      </Modal>
    </>
  );
};

export default Tutorial;
