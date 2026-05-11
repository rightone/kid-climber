import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 导出格式
export type ExportFormat = 'csv' | 'json' | 'html' | 'markdown';

// 材料清单项
export interface MaterialItem {
  componentId: string;
  componentName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications: string;
}

// 导出管理器
export class ExportManager {
  // 生成材料清单
  generateMaterialList(
    components: ComponentInstance[],
    connections: Connection[]
  ): MaterialItem[] {
    const itemMap = new Map<string, MaterialItem>();
    
    // 统计组件数量
    components.forEach(component => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      const existing = itemMap.get(component.componentId);
      if (existing) {
        existing.quantity++;
      } else {
        itemMap.set(component.componentId, {
          componentId: component.componentId,
          componentName: definition.name,
          category: definition.category,
          quantity: 1,
          unit: this.getUnit(definition.type),
          unitPrice: this.getUnitPrice(component.componentId),
          totalPrice: this.getUnitPrice(component.componentId),
          specifications: this.getSpecifications(definition),
        });
      }
    });
    
    // 计算总价
    itemMap.forEach(item => {
      item.totalPrice = item.quantity * item.unitPrice;
    });
    
    return Array.from(itemMap.values());
  }
  
  // 导出为CSV
  exportToCSV(materials: MaterialItem[]): string {
    const headers = ['组件名称', '分类', '数量', '单位', '单价', '总价', '规格'];
    const rows = materials.map(item => [
      item.componentName,
      item.category,
      item.quantity.toString(),
      item.unit,
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
      item.specifications,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return '\uFEFF' + csvContent; // 添加BOM支持中文
  }
  
  // 导出为JSON
  exportToJSON(materials: MaterialItem[], designName: string): string {
    const data = {
      designName,
      exportDate: new Date().toISOString(),
      totalItems: materials.length,
      totalCost: materials.reduce((sum, item) => sum + item.totalPrice, 0),
      items: materials,
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  // 导出为HTML（用于打印）
  exportToHTML(materials: MaterialItem[], designName: string): string {
    const totalCost = materials.reduce((sum, item) => sum + item.totalPrice, 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>材料清单 - ${designName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .info { margin-bottom: 20px; }
    .info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .total { font-weight: bold; background-color: #e8f5e9; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>材料清单</h1>
  <div class="info">
    <p><strong>设计名称：</strong>${designName}</p>
    <p><strong>导出日期：</strong>${new Date().toLocaleDateString()}</p>
    <p><strong>组件总数：</strong>${materials.length} 种</p>
    <p><strong>预计成本：</strong>¥${totalCost.toFixed(2)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>组件名称</th>
        <th>分类</th>
        <th>数量</th>
        <th>单位</th>
        <th>单价</th>
        <th>总价</th>
        <th>规格</th>
      </tr>
    </thead>
    <tbody>
      ${materials.map(item => `
      <tr>
        <td>${item.componentName}</td>
        <td>${item.category}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>¥${item.unitPrice.toFixed(2)}</td>
        <td>¥${item.totalPrice.toFixed(2)}</td>
        <td>${item.specifications}</td>
      </tr>
      `).join('')}
      <tr class="total">
        <td colspan="5">总计</td>
        <td>¥${totalCost.toFixed(2)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
  }
  
  // 导出为Markdown
  exportToMarkdown(materials: MaterialItem[], designName: string): string {
    const totalCost = materials.reduce((sum, item) => sum + item.totalPrice, 0);
    
    let md = `# 材料清单 - ${designName}\n\n`;
    md += `**导出日期：** ${new Date().toLocaleDateString()}\n`;
    md += `**组件总数：** ${materials.length} 种\n`;
    md += `**预计成本：** ¥${totalCost.toFixed(2)}\n\n`;
    
    md += `| 组件名称 | 分类 | 数量 | 单位 | 单价 | 总价 | 规格 |\n`;
    md += `|---------|------|------|------|------|------|------|\n`;
    
    materials.forEach(item => {
      md += `| ${item.componentName} | ${item.category} | ${item.quantity} | ${item.unit} | ¥${item.unitPrice.toFixed(2)} | ¥${item.totalPrice.toFixed(2)} | ${item.specifications} |\n`;
    });
    
    md += `\n**总计：** ¥${totalCost.toFixed(2)}\n`;
    
    return md;
  }
  
  // 下载文件
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // 打印材料清单
  printMaterialList(materials: MaterialItem[], designName: string): void {
    const html = this.exportToHTML(materials, designName);
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }
  
  // 获取单位
  private getUnit(type: string): string {
    switch (type) {
      case 'pipe': return '根';
      case 'connector':
      case 'elbow':
      case 'tee':
      case 'cross': return '个';
      case 'platform':
      case 'board': return '块';
      case 'swing':
      case 'slide':
      case 'rope_ladder': return '套';
      default: return '个';
    }
  }
  
  // 获取单价（示例价格）
  private getUnitPrice(componentId: string): number {
    const prices: Record<string, number> = {
      'pipe_35cm': 15,
      'pipe_15cm': 8,
      'connector_straight': 5,
      'connector_L': 6,
      'connector_T': 7,
      'connector_45deg': 7,
      'connector_3way': 8,
      'connector_4way': 9,
      'connector_cross': 10,
      'connector_5way': 12,
      'board_40x40': 25,
      'board_40x20': 15,
      'swing': 50,
      'slide': 80,
      'rope_ladder': 40,
    };
    
    return prices[componentId] || 10;
  }
  
  // 获取规格
  private getSpecifications(definition: any): string {
    const specs: string[] = [];
    
    if (definition.length) specs.push(`长度: ${definition.length}cm`);
    if (definition.width && definition.height) specs.push(`尺寸: ${definition.width}×${definition.height}cm`);
    if (definition.angle) specs.push(`角度: ${definition.angle}°`);
    if (definition.diameter) specs.push(`直径: ${definition.diameter}cm`);
    
    return specs.join(', ') || '-';
  }
}

// 创建单例
export const exportManager = new ExportManager();
