import { ComponentInstance, Connection, MaterialRequirement } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { materialCostSystem } from './MaterialCostSystem';

// 材料清单项
export interface MaterialListItem {
  componentId: string;
  componentName: string;
  componentType: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications: string;
  notes: string;
}

// 材料清单
export interface MaterialList {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: MaterialListItem[];
  summary: MaterialListSummary;
}

// 材料清单摘要
export interface MaterialListSummary {
  totalItems: number;
  totalQuantity: number;
  totalCost: number;
  categories: {
    name: string;
    items: number;
    quantity: number;
    cost: number;
  }[];
}

// 导出格式
export type ExportFormat = 'csv' | 'json' | 'pdf' | 'txt' | 'excel';

// 材料清单管理器
export class MaterialListManager {
  // 生成材料清单
  generateMaterialList(
    components: ComponentInstance[],
    connections: Connection[],
    inventory?: Record<string, number>
  ): MaterialList {
    // 统计组件数量
    const componentCounts: Record<string, number> = {};
    components.forEach((component) => {
      componentCounts[component.componentId] = (componentCounts[component.componentId] || 0) + 1;
    });
    
    // 生成清单项
    const items: MaterialListItem[] = [];
    let totalQuantity = 0;
    let totalCost = 0;
    
    Object.entries(componentCounts).forEach(([componentId, quantity]) => {
      const definition = getComponentById(componentId);
      const unitPrice = materialCostSystem.getPrice(componentId);
      const totalPrice = unitPrice * quantity;
      const [type] = componentId.split('_');
      const category = this.getCategoryName(type);
      const unit = this.getUnit(type);
      const specifications = this.getSpecifications(componentId, definition);
      
      items.push({
        componentId,
        componentName: definition?.name || componentId,
        componentType: type,
        category,
        quantity,
        unit,
        unitPrice,
        totalPrice,
        specifications,
        notes: inventory && inventory[componentId] ? `已有 ${inventory[componentId]} ${unit}` : '',
      });
      
      totalQuantity += quantity;
      totalCost += totalPrice;
    });
    
    // 按分类统计
    const categoryMap = new Map<string, { items: number; quantity: number; cost: number }>();
    items.forEach((item) => {
      const existing = categoryMap.get(item.category) || { items: 0, quantity: 0, cost: 0 };
      existing.items++;
      existing.quantity += item.quantity;
      existing.cost += item.totalPrice;
      categoryMap.set(item.category, existing);
    });
    
    const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
    
    return {
      id: `list_${Date.now()}`,
      name: '材料清单',
      description: `包含 ${components.length} 个组件的设计材料清单`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items,
      summary: {
        totalItems: items.length,
        totalQuantity,
        totalCost,
        categories,
      },
    };
  }
  
  // 导出材料清单
  exportMaterialList(list: MaterialList, format: ExportFormat): string {
    switch (format) {
      case 'csv':
        return this.exportToCSV(list);
      case 'json':
        return this.exportToJSON(list);
      case 'txt':
        return this.exportToTXT(list);
      default:
        return this.exportToTXT(list);
    }
  }
  
  // 导出为CSV
  private exportToCSV(list: MaterialList): string {
    const headers = ['组件名称', '分类', '数量', '单位', '单价', '总价', '规格', '备注'];
    const rows = list.items.map((item) => [
      item.componentName,
      item.category,
      item.quantity.toString(),
      item.unit,
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
      item.specifications,
      item.notes,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
    // 添加BOM头，支持中文
    return '\uFEFF' + csvContent;
  }
  
  // 导出为JSON
  private exportToJSON(list: MaterialList): string {
    return JSON.stringify(list, null, 2);
  }
  
  // 导出为TXT
  private exportToTXT(list: MaterialList): string {
    let content = `材料清单\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `生成时间: ${new Date(list.createdAt).toLocaleString()}\n`;
    content += `组件种类: ${list.summary.totalItems}\n`;
    content += `总数量: ${list.summary.totalQuantity}\n`;
    content += `总成本: ¥${list.summary.totalCost.toFixed(2)}\n\n`;
    
    // 按分类输出
    list.summary.categories.forEach((category) => {
      content += `\n${category.name}\n`;
      content += `${'-'.repeat(30)}\n`;
      
      const categoryItems = list.items.filter((item) => item.category === category.name);
      categoryItems.forEach((item) => {
        content += `${item.componentName}: ${item.quantity} ${item.unit}`;
        content += ` x ¥${item.unitPrice.toFixed(2)} = ¥${item.totalPrice.toFixed(2)}`;
        if (item.notes) {
          content += ` (${item.notes})`;
        }
        content += '\n';
      });
    });
    
    return content;
  }
  
  // 获取分类名称
  private getCategoryName(type: string): string {
    switch (type) {
      case 'pipe':
        return '管材';
      case 'elbow':
      case 'tee':
      case 'cross':
        return '连接件';
      case 'platform':
        return '平台';
      case 'swing':
      case 'slide':
      case 'rope':
      case 'climbing':
      case 'monkey':
        return '附件';
      case 'support':
      case 'base':
      case 'cap':
        return '结构件';
      default:
        return '其他';
    }
  }
  
  // 获取单位
  private getUnit(type: string): string {
    switch (type) {
      case 'pipe':
        return '根';
      case 'elbow':
      case 'tee':
      case 'cross':
        return '个';
      case 'platform':
        return '块';
      case 'swing':
      case 'slide':
      case 'rope':
      case 'climbing':
      case 'monkey':
        return '套';
      case 'support':
      case 'base':
      case 'cap':
        return '个';
      default:
        return '个';
    }
  }
  
  // 获取规格
  private getSpecifications(componentId: string, definition: any): string {
    if (!definition) return '';
    
    const specs: string[] = [];
    
    if (definition.length) {
      specs.push(`长度: ${definition.length}cm`);
    }
    
    if (definition.width && definition.height) {
      specs.push(`尺寸: ${definition.width}x${definition.height}cm`);
    }
    
    if (definition.angle) {
      specs.push(`角度: ${definition.angle}°`);
    }
    
    if (definition.diameter) {
      specs.push(`直径: ${definition.diameter}cm`);
    }
    
    return specs.join(', ');
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
  
  // 下载CSV
  downloadCSV(list: MaterialList): void {
    const content = this.exportToCSV(list);
    this.downloadFile(content, `材料清单_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
  }
  
  // 下载JSON
  downloadJSON(list: MaterialList): void {
    const content = this.exportToJSON(list);
    this.downloadFile(content, `材料清单_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  }
  
  // 下载TXT
  downloadTXT(list: MaterialList): void {
    const content = this.exportToTXT(list);
    this.downloadFile(content, `材料清单_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain;charset=utf-8');
  }
  
  // 打印清单
  printList(list: MaterialList): void {
    const content = this.exportToTXT(list);
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>材料清单</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <pre>${content}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }
}

// 创建单例
export const materialListManager = new MaterialListManager();
