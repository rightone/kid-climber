import React, { useState, useMemo } from 'react';
import { Table, Button, Space, InputNumber, message, Modal, Form, Input } from 'antd';
import { PrinterOutlined, ExportOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { calculateMaterialRequirement, generateMaterialList } from '../../utils/calculationUtils';
import { exportMaterialListToPDF } from '../../utils/fileUtils';
import type { MaterialListItem } from '../../utils/calculationUtils';

const MaterialPanel: React.FC = () => {
  const { components, inventory, updateInventoryItem } = useDesignStore();
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialListItem | null>(null);
  const [form] = Form.useForm();
  
  // 计算材料需求
  const materialList = useMemo(() => {
    // 将inventory转换为简单的数量映射
    const inventoryMap: Record<string, number> = {};
    Object.entries(inventory).forEach(([key, value]) => {
      inventoryMap[key] = value.quantity || 0;
    });
    
    const materials = calculateMaterialRequirement(components, inventoryMap);
    return generateMaterialList(materials);
  }, [components, inventory]);
  
  // 计算统计信息
  const statistics = useMemo(() => {
    const totalItems = materialList.length;
    const totalRequired = materialList.reduce((sum, item) => sum + item.required, 0);
    const totalAvailable = materialList.reduce((sum, item) => sum + item.available, 0);
    const totalShortage = materialList.reduce((sum, item) => sum + item.shortage, 0);
    const totalCost = materialList.reduce((sum, item) => sum + item.totalPrice, 0);
    
    return {
      totalItems,
      totalRequired,
      totalAvailable,
      totalShortage,
      totalCost,
    };
  }, [materialList]);
  
  // 刷新数据
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('数据已刷新');
    }, 500);
  };
  
  // 打印清单
  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  // 导出清单
  const handleExport = () => {
    const materials: Record<string, { required: number; available: number; shortage: number }> = {};
    
    materialList.forEach(item => {
      materials[item.componentId] = {
        required: item.required,
        available: item.available,
        shortage: item.shortage,
      };
    });
    
    exportMaterialListToPDF(materials, '攀爬架设计');
  };
  
  // 生成打印内容
  const generatePrintContent = () => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>攀爬架材料清单</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .info { margin-bottom: 20px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .shortage { color: #ff4d4f; font-weight: bold; }
          .total { font-weight: bold; background-color: #f0f0f0; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>攀爬架材料清单</h1>
        <div class="info">
          <p><strong>生成日期：</strong>${new Date().toLocaleDateString()}</p>
          <p><strong>组件总数：</strong>${statistics.totalItems} 种</p>
          <p><strong>需要总数：</strong>${statistics.totalRequired} 个</p>
          <p><strong>缺少数量：</strong>${statistics.totalShortage} 个</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>组件名称</th>
              <th>规格</th>
              <th>需要数量</th>
              <th>已有数量</th>
              <th>缺少数量</th>
              <th>单价</th>
              <th>总价</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    materialList.forEach(item => {
      html += `
        <tr>
          <td>${item.componentName}</td>
          <td>${item.specifications}</td>
          <td>${item.required}</td>
          <td>${item.available}</td>
          <td class="${item.shortage > 0 ? 'shortage' : ''}">${item.shortage}</td>
          <td>¥${item.unitPrice.toFixed(2)}</td>
          <td>¥${item.totalPrice.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += `
          <tr class="total">
            <td colspan="2">合计</td>
            <td>${statistics.totalRequired}</td>
            <td>${statistics.totalAvailable}</td>
            <td>${statistics.totalShortage}</td>
            <td></td>
            <td>¥${statistics.totalCost.toFixed(2)}</td>
          </tr>
          </tbody>
        </table>
        <div class="no-print" style="margin-top: 20px;">
          <button onclick="window.print()">打印</button>
        </div>
      </body>
      </html>
    `;
    
    return html;
  };
  
  // 编辑库存
  const handleEditInventory = (item: MaterialListItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      quantity: item.available,
    });
    setEditModalVisible(true);
  };
  
  // 保存库存
  const handleSaveInventory = () => {
    form.validateFields().then(values => {
      if (editingItem) {
        updateInventoryItem(editingItem.componentId, values.quantity);
        message.success('库存已更新');
        setEditModalVisible(false);
        setEditingItem(null);
      }
    });
  };
  
  // 表格列定义
  const columns = [
    {
      title: '组件名称',
      dataIndex: 'componentName',
      key: 'componentName',
      render: (text: string, record: MaterialListItem) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.componentType}</div>
        </div>
      ),
    },
    {
      title: '规格',
      dataIndex: 'specifications',
      key: 'specifications',
      render: (text: string) => (
        <span style={{ fontSize: 12 }}>{text}</span>
      ),
    },
    {
      title: '需要',
      dataIndex: 'required',
      key: 'required',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '已有',
      dataIndex: 'available',
      key: 'available',
      width: 80,
      align: 'center' as const,
      render: (text: number) => (
        <span style={{ color: text > 0 ? '#52c41a' : '#999' }}>
          {text}
        </span>
      ),
    },
    {
      title: '缺少',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 80,
      align: 'center' as const,
      render: (text: number) => (
        <span style={{ color: text > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          {text}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: MaterialListItem) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEditInventory(record)}
        >
          编辑
        </Button>
      ),
    },
  ];
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和操作按钮 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>材料清单</h3>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              icon={<PrinterOutlined />}
              size="small"
              onClick={handlePrint}
            >
              打印
            </Button>
            <Button
              icon={<ExportOutlined />}
              size="small"
              onClick={handleExport}
            >
              导出
            </Button>
          </Space>
        </div>
        
        {/* 统计信息 */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
          <span>组件种类: {statistics.totalItems}</span>
          <span>需要总数: {statistics.totalRequired}</span>
          <span style={{ color: statistics.totalShortage > 0 ? '#ff4d4f' : '#52c41a' }}>
            缺少: {statistics.totalShortage}
          </span>
        </div>
      </div>
      
      {/* 材料列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        <Table
          dataSource={materialList}
          columns={columns}
          rowKey="componentId"
          size="small"
          pagination={false}
          loading={loading}
          style={{ marginTop: 16 }}
        />
      </div>
      
      {/* 编辑库存弹窗 */}
      <Modal
        title="编辑库存"
        open={editModalVisible}
        onOk={handleSaveInventory}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingItem(null);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="组件名称">
            <Input value={editingItem?.componentName} disabled />
          </Form.Item>
          <Form.Item label="规格">
            <Input value={editingItem?.specifications} disabled />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="已有数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaterialPanel;
