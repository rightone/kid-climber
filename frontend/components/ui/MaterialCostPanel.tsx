import React, { useState } from 'react';
import { Card, Table, Button, Space, Typography, List, Tag, Statistic, Row, Col } from 'antd';
import { 
  DollarOutlined, 
  DownloadOutlined, 
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { materialCostSystem } from '../../systems/MaterialCostSystem';
import type { CostAnalysisResult } from '../../systems/MaterialCostSystem';

const { Title, Text } = Typography;

// 材料成本面板
const MaterialCostPanel: React.FC = () => {
  const { components } = useDesignStore();
  const [costResult, setCostResult] = useState<CostAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 计算成本
  const handleCalculate = () => {
    setLoading(true);
    
    setTimeout(() => {
      const result = materialCostSystem.calculateCost(components);
      setCostResult(result);
      setLoading(false);
    }, 500);
  };
  
  // 表格列定义
  const columns = [
    {
      title: '组件名称',
      dataIndex: 'componentName',
      key: 'componentName',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center' as const,
      render: (text: number, record: any) => `${text} ${record.unit}`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 100,
      align: 'right' as const,
      render: (text: number) => `¥${text.toFixed(2)}`,
    },
    {
      title: '总价',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 100,
      align: 'right' as const,
      render: (text: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          ¥{text.toFixed(2)}
        </Text>
      ),
    },
  ];
  
  // 分类颜色
  const getCategoryColor = (category: string) => {
    switch (category) {
      case '管材':
        return '#4ecdc4';
      case '连接件':
        return '#45b7d1';
      case '平台':
        return '#96ceb4';
      case '附件':
        return '#feca57';
      case '结构件':
        return '#95a5a6';
      default:
        return '#666';
    }
  };
  
  return (
    <div style={{ padding: 16 }}>
      {/* 标题和计算按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>材料成本</Title>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={handleCalculate}
          loading={loading}
          disabled={components.length === 0}
        >
          计算
        </Button>
      </div>
      
      {/* 成本结果 */}
      {costResult && (
        <>
          {/* 总成本 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="总成本"
                  value={costResult.totalCost}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="组件种类"
                  value={costResult.items.length}
                  suffix="种"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="总数量"
                  value={costResult.items.reduce((sum, item) => sum + item.quantity, 0)}
                  suffix="个"
                />
              </Col>
            </Row>
          </Card>
          
          {/* 成本明细 */}
          <Card size="small" title="成本明细" style={{ marginBottom: 16 }}>
            <Table
              dataSource={costResult.items}
              columns={columns}
              rowKey="componentId"
              size="small"
              pagination={false}
            />
          </Card>
          
          {/* 分类统计 */}
          <Card size="small" title="分类统计" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={costResult.breakdown}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Tag color={getCategoryColor(item.category)}>{item.category}</Tag>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>¥{item.cost.toFixed(2)}</Text>
                        <Text type="secondary">{item.percentage.toFixed(1)}%</Text>
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: '#f0f0f0',
                          borderRadius: 2,
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentage}%`,
                            background: getCategoryColor(item.category),
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
          
          {/* 节省建议 */}
          {costResult.savings.length > 0 && (
            <Card size="small" title="节省建议" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={costResult.savings}
                renderItem={(saving) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <DollarOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                      <div>
                        <div>{saving.description}</div>
                        {saving.potentialSaving > 0 && (
                          <Text type="success" style={{ fontSize: 12 }}>
                            可节省 ¥{saving.potentialSaving.toFixed(2)}
                          </Text>
                        )}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
          
          {/* 操作按钮 */}
          <Space style={{ width: '100%' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                // 导出材料清单
                const content = costResult.items.map(item => 
                  `${item.componentName}: ${item.quantity}${item.unit} x ¥${item.unitPrice.toFixed(2)} = ¥${item.totalPrice.toFixed(2)}`
                ).join('\n');
                
                const blob = new Blob([`材料成本清单\n\n总成本: ¥${costResult.totalCost.toFixed(2)}\n\n${content}`], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '材料成本清单.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              导出清单
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
            >
              打印
            </Button>
          </Space>
        </>
      )}
      
      {/* 无组件提示 */}
      {!costResult && components.length === 0 && (
        <Card size="small">
          <Text type="secondary">请先添加组件，然后点击"计算"按钮</Text>
        </Card>
      )}
    </div>
  );
};

export default MaterialCostPanel;
