import React, { useState } from 'react';
import { Card, Progress, List, Tag, Button, Typography, Alert } from 'antd';
import { 
  WarningOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { structuralAnalysisSystem } from '../../systems/StructuralAnalysisSystem';
import type { StructuralAnalysisResult, StructuralIssue } from '../../systems/StructuralAnalysisSystem';

const { Text, Title } = Typography;

// 问题图标
const getIssueIcon = (type: StructuralIssue['type']) => {
  switch (type) {
    case 'error':
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'warning':
      return <WarningOutlined style={{ color: '#faad14' }} />;
    case 'info':
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    default:
      return <InfoCircleOutlined />;
  }
};

// 问题颜色
const getIssueColor = (type: StructuralIssue['type']) => {
  switch (type) {
    case 'error':
      return '#ff4d4f';
    case 'warning':
      return '#faad14';
    case 'info':
      return '#1890ff';
    default:
      return '#666';
  }
};

// 分类标签颜色
const getCategoryColor = (category: StructuralIssue['category']) => {
  switch (category) {
    case 'stability':
      return 'red';
    case 'connection':
      return 'blue';
    case 'support':
      return 'green';
    case 'balance':
      return 'orange';
    case 'safety':
      return 'purple';
    default:
      return 'default';
  }
};

// 分类名称
const getCategoryName = (category: StructuralIssue['category']) => {
  switch (category) {
    case 'stability':
      return '稳定性';
    case 'connection':
      return '连接';
    case 'support':
      return '支撑';
    case 'balance':
      return '平衡';
    case 'safety':
      return '安全';
    default:
      return category;
  }
};

// 结构分析面板
const StructuralAnalysisPanel: React.FC = () => {
  const { components, connections } = useDesignStore();
  const [analysisResult, setAnalysisResult] = useState<StructuralAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 执行分析
  const handleAnalyze = () => {
    setLoading(true);
    
    // 模拟分析延迟
    setTimeout(() => {
      const result = structuralAnalysisSystem.analyzeStructure(components, connections);
      setAnalysisResult(result);
      setLoading(false);
    }, 500);
  };
  
  // 稳定性分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };
  
  // 稳定性等级
  const getStabilityLevel = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '较差';
  };
  
  return (
    <div style={{ padding: 16 }}>
      {/* 标题和分析按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>结构分析</Title>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={handleAnalyze}
          loading={loading}
          disabled={components.length === 0}
        >
          分析
        </Button>
      </div>
      
      {/* 无组件提示 */}
      {components.length === 0 && (
        <Alert
          message="请先添加组件"
          description="添加组件后才能进行结构分析"
          type="info"
          showIcon
        />
      )}
      
      {/* 分析结果 */}
      {analysisResult && (
        <>
          {/* 稳定性分数 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={analysisResult.stabilityScore}
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: getScoreColor(percent || 0) }}>
                      {percent}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {getStabilityLevel(percent || 0)}
                    </div>
                  </div>
                )}
                strokeColor={getScoreColor(analysisResult.stabilityScore)}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  {analysisResult.isStable ? '结构稳定' : '结构不稳定'}
                </Text>
              </div>
            </div>
          </Card>
          
          {/* 统计信息 */}
          <Card size="small" title="统计信息" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={[
                { label: '组件数量', value: analysisResult.statistics.totalComponents },
                { label: '连接数量', value: analysisResult.statistics.totalConnections },
                { label: '最大高度', value: `${analysisResult.statistics.maxHeight.toFixed(1)} cm` },
                { label: '最大宽度', value: `${analysisResult.statistics.maxWidth.toFixed(1)} cm` },
                { label: '支撑点数', value: analysisResult.statistics.supportPoints },
                { label: '总重量', value: `${analysisResult.statistics.weight.toFixed(1)} kg` },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Text>{item.label}</Text>
                  <Text strong>{item.value}</Text>
                </List.Item>
              )}
            />
          </Card>
          
          {/* 问题列表 */}
          {analysisResult.issues.length > 0 && (
            <Card size="small" title={`问题 (${analysisResult.issues.length})`} style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={analysisResult.issues}
                renderItem={(issue) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                      {getIssueIcon(issue.type)}
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 4 }}>
                          <Tag color={getCategoryColor(issue.category)}>
                            {getCategoryName(issue.category)}
                          </Tag>
                          <Text style={{ color: getIssueColor(issue.type) }}>
                            {issue.message}
                          </Text>
                        </div>
                        {issue.componentIds.length > 0 && (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            涉及 {issue.componentIds.length} 个组件
                          </div>
                        )}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
          
          {/* 建议 */}
          {analysisResult.recommendations.length > 0 && (
            <Card size="small" title="改进建议" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={analysisResult.recommendations}
                renderItem={(recommendation) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                      <Text>{recommendation}</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
          
          {/* 无问题提示 */}
          {analysisResult.issues.length === 0 && (
            <Alert
              message="结构良好"
              description="未发现明显问题，结构设计合理"
              type="success"
              showIcon
            />
          )}
        </>
      )}
    </div>
  );
};

export default StructuralAnalysisPanel;
