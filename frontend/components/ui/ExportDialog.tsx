import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Button, Space, Typography, List, Tag, message, Radio, Input, Alert } from 'antd';
import { 
  DownloadOutlined, 
  PrinterOutlined, 
  FileExcelOutlined,
  FileTextOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { exportManager } from '../../systems/ExportManager';

const { Text } = Typography;

// 导出格式选项
const exportFormats = [
  {
    key: 'csv',
    name: 'CSV 文件',
    description: '可用 Excel 打开的表格文件',
    icon: <FileExcelOutlined />,
    extension: '.csv',
    mimeType: 'text/csv',
  },
  {
    key: 'json',
    name: 'JSON 文件',
    description: '结构化数据格式，便于程序处理',
    icon: <CodeOutlined />,
    extension: '.json',
    mimeType: 'application/json',
  },
  {
    key: 'html',
    name: 'HTML 文件',
    description: '可打印的网页格式',
    icon: <FileTextOutlined />,
    extension: '.html',
    mimeType: 'text/html',
  },
  {
    key: 'markdown',
    name: 'Markdown 文件',
    description: '轻量级标记语言格式',
    icon: <FileTextOutlined />,
    extension: '.md',
    mimeType: 'text/markdown',
  },
];

// 导出对话框
export const ExportDialog: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const { components, connections, currentDesign, inventory } = useDesignStore();
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [designName, setDesignName] = useState(currentDesign?.name || '攀爬架设计');
  
  // 生成材料清单
  const materials = useMemo(() => {
    return exportManager.generateMaterialList(components, connections, inventory);
  }, [components, connections, inventory]);

  const assemblySteps = useMemo(() => {
    return exportManager.generateExportBundle(components, connections, inventory).assemblySteps;
  }, [components, connections, inventory]);
  
  // 计算统计信息
  const stats = useMemo(() => {
    const totalItems = materials.length;
    const totalQuantity = materials.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = materials.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalShortage = materials.reduce((sum, item) => sum + item.shortage, 0);
    
    return { totalItems, totalQuantity, totalCost, totalShortage };
  }, [materials]);
  
  // 处理导出
  const handleExport = useCallback(() => {
    const format = exportFormats.find(f => f.key === selectedFormat);
    if (!format) return;
    
    let content: string;
    
    switch (selectedFormat) {
      case 'csv':
        content = exportManager.exportToCSV(materials);
        break;
      case 'json':
        content = exportManager.exportToJSON(materials, designName, assemblySteps);
        break;
      case 'html':
        content = exportManager.exportToHTML(materials, designName, assemblySteps);
        break;
      case 'markdown':
        content = exportManager.exportToMarkdown(materials, designName, assemblySteps);
        break;
      default:
        return;
    }
    
    const filename = `材料清单_${designName}_${new Date().toISOString().split('T')[0]}${format.extension}`;
    exportManager.downloadFile(content, filename, format.mimeType);
    
    message.success(`已导出 ${format.name}`);
    onClose();
  }, [selectedFormat, materials, designName, assemblySteps, onClose]);
  
  // 处理打印
  const handlePrint = useCallback(() => {
    exportManager.printMaterialList(materials, designName, assemblySteps);
    onClose();
  }, [materials, designName, assemblySteps, onClose]);
  
  return (
    <Modal
      title="导出材料清单"
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            打印
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      }
      width={600}
    >
      {/* 设计名称 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>设计名称</Text>
        <Input
          value={designName}
          onChange={(e) => setDesignName(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </div>
      
      {/* 统计信息 */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 16,
        padding: 12,
        background: '#f5f5f5',
        borderRadius: 8,
      }}>
        <div>
          <Text type="secondary">组件种类</Text>
          <div><Text strong>{stats.totalItems}</Text></div>
        </div>
        <div>
          <Text type="secondary">总数量</Text>
          <div><Text strong>{stats.totalQuantity}</Text></div>
        </div>
        <div>
          <Text type="secondary">预计成本</Text>
          <div><Text strong>¥{stats.totalCost.toFixed(2)}</Text></div>
        </div>
        <div>
          <Text type="secondary">库存缺口</Text>
          <div>
            <Text strong type={stats.totalShortage > 0 ? 'danger' : 'success'}>
              {stats.totalShortage}
            </Text>
          </div>
        </div>
      </div>

      {stats.totalShortage > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="库存不足仅作为提示，不会阻止搭建或导出。"
        />
      )}
      
      {/* 导出格式选择 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>导出格式</Text>
        <div style={{ marginTop: 8 }}>
          <Radio.Group
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
          >
            <Space orientation="vertical">
              {exportFormats.map(format => (
                <Radio key={format.key} value={format.key}>
                  <Space>
                    {format.icon}
                    <div>
                      <div>{format.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {format.description}
                      </Text>
                    </div>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
      </div>
      
      {/* 材料预览 */}
      <div>
        <Text strong>材料预览</Text>
        <List
          style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}
          dataSource={materials.slice(0, 10)}
          renderItem={(item) => (
            <List.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <Text>{item.componentName}</Text>
                  <Tag style={{ marginLeft: 8 }}>{item.quantity} {item.unit}</Tag>
                  {item.shortage > 0 && (
                    <Tag color="warning" style={{ marginLeft: 4 }}>
                      缺 {item.shortage}
                    </Tag>
                  )}
                </div>
                <Text>¥{item.totalPrice.toFixed(2)}</Text>
              </div>
            </List.Item>
          )}
        />
        {materials.length > 10 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            ... 还有 {materials.length - 10} 种组件
          </Text>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Text strong>组装步骤预览</Text>
        <List
          style={{ marginTop: 8, maxHeight: 160, overflow: 'auto' }}
          dataSource={assemblySteps}
          renderItem={(step) => (
            <List.Item>
              <div>
                <Text strong>第 {step.order} 步：{step.title}</Text>
                <div style={{ fontSize: 12, color: '#666' }}>{step.description}</div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </Modal>
  );
};

export default ExportDialog;
