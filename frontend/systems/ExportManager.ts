import type { ComponentDefinition, ComponentInstance, Connection, MaterialInventory } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { assemblyStepSystem, type AssemblyStep } from './AssemblyStepSystem';
import { getMaterialVariantDescriptor } from './MaterialVariantSystem';

// 导出格式
export type ExportFormat = 'csv' | 'json' | 'html' | 'markdown';

// 材料清单项
export interface MaterialItem {
  componentId: string;
  componentName: string;
  category: string;
  quantity: number;
  available: number;
  shortage: number;
  warning?: string;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications: string;
}

export interface ExportBundle {
  materials: MaterialItem[];
  assemblySteps: AssemblyStep[];
}

// 导出管理器
export class ExportManager {
  // 生成材料清单
  generateMaterialList(
    components: ComponentInstance[],
    connections: Connection[] = [],
    inventory: MaterialInventory = {}
  ): MaterialItem[] {
    void connections;
    const itemMap = new Map<string, MaterialItem>();
    
    // 统计组件数量
    components.forEach(component => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      const variant = getMaterialVariantDescriptor(component);
      const existing = itemMap.get(variant.materialKey);
      if (existing) {
        existing.quantity++;
      } else {
        itemMap.set(variant.materialKey, {
          componentId: variant.materialKey,
          componentName: variant.name,
          category: definition.category,
          quantity: 1,
          available: inventory[variant.materialKey]?.quantity || 0,
          shortage: 0,
          unit: this.getUnit(definition.type),
          unitPrice: this.getUnitPrice(component.componentId),
          totalPrice: this.getUnitPrice(component.componentId),
          specifications: [
            this.getSpecifications(definition),
            ...variant.specifications,
          ].filter(Boolean).join(', '),
        });
      }
    });
    
    // 计算总价
    itemMap.forEach(item => {
      item.totalPrice = item.quantity * item.unitPrice;
      item.shortage = Math.max(0, item.quantity - item.available);
      item.warning = item.shortage > 0
        ? `库存不足：还缺 ${item.shortage}${item.unit}`
        : undefined;
    });
    
    return Array.from(itemMap.values());
  }

  generateExportBundle(
    components: ComponentInstance[],
    connections: Connection[],
    inventory: MaterialInventory = {}
  ): ExportBundle {
    return {
      materials: this.generateMaterialList(components, connections, inventory),
      assemblySteps: assemblyStepSystem.generateSteps(components, connections),
    };
  }
  
  // 导出为CSV
  exportToCSV(materials: MaterialItem[]): string {
    const headers = ['组件名称', '分类', '数量', '已有', '缺少', '单位', '单价', '总价', '规格', '提示'];
    const rows = materials.map(item => [
      item.componentName,
      item.category,
      item.quantity.toString(),
      item.available.toString(),
      item.shortage.toString(),
      item.unit,
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
      item.specifications,
      item.warning || '',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return '\uFEFF' + csvContent; // 添加BOM支持中文
  }
  
  // 导出为JSON
  exportToJSON(
    materials: MaterialItem[],
    designName: string,
    assemblySteps: AssemblyStep[] = []
  ): string {
    const data = {
      designName,
      exportDate: new Date().toISOString(),
      totalItems: materials.length,
      totalCost: materials.reduce((sum, item) => sum + item.totalPrice, 0),
      shortageItems: materials.filter(item => item.shortage > 0).length,
      items: materials,
      assemblySteps,
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  // 导出为HTML（用于打印）
  exportToHTML(
    materials: MaterialItem[],
    designName: string,
    assemblySteps: AssemblyStep[] = []
  ): string {
    const totalCost = materials.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalShortage = materials.reduce((sum, item) => sum + item.shortage, 0);
    
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
    .shortage { color: #cf1322; font-weight: bold; }
    .steps { margin-top: 28px; }
    .step { margin: 10px 0; padding: 10px; border-left: 4px solid #1890ff; background: #f6fbff; }
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
    <p><strong>库存缺口：</strong>${totalShortage} 件（仅提示，不限制搭建）</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>组件名称</th>
        <th>分类</th>
        <th>数量</th>
        <th>已有</th>
        <th>缺少</th>
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
        <td>${item.available}</td>
        <td class="${item.shortage > 0 ? 'shortage' : ''}">${item.shortage}</td>
        <td>${item.unit}</td>
        <td>¥${item.unitPrice.toFixed(2)}</td>
        <td>¥${item.totalPrice.toFixed(2)}</td>
        <td>${item.specifications}${item.warning ? `；${item.warning}` : ''}</td>
      </tr>
      `).join('')}
      <tr class="total">
        <td colspan="7">总计</td>
        <td>¥${totalCost.toFixed(2)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  ${this.renderAssemblyStepsHTML(assemblySteps)}
</body>
</html>`;
  }
  
  // 导出为Markdown
  exportToMarkdown(
    materials: MaterialItem[],
    designName: string,
    assemblySteps: AssemblyStep[] = []
  ): string {
    const totalCost = materials.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalShortage = materials.reduce((sum, item) => sum + item.shortage, 0);
    
    let md = `# 材料清单 - ${designName}\n\n`;
    md += `**导出日期：** ${new Date().toLocaleDateString()}\n`;
    md += `**组件总数：** ${materials.length} 种\n`;
    md += `**预计成本：** ¥${totalCost.toFixed(2)}\n\n`;
    md += `**库存缺口：** ${totalShortage} 件（仅提示，不限制搭建）\n\n`;
    
    md += `| 组件名称 | 分类 | 数量 | 已有 | 缺少 | 单位 | 单价 | 总价 | 规格/提示 |\n`;
    md += `|---------|------|------|------|------|------|------|------|----------|\n`;
    
    materials.forEach(item => {
      md += `| ${item.componentName} | ${item.category} | ${item.quantity} | ${item.available} | ${item.shortage} | ${item.unit} | ¥${item.unitPrice.toFixed(2)} | ¥${item.totalPrice.toFixed(2)} | ${item.specifications}${item.warning ? `；${item.warning}` : ''} |\n`;
    });
    
    md += `\n**总计：** ¥${totalCost.toFixed(2)}\n`;
    md += this.renderAssemblyStepsMarkdown(assemblySteps);
    
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
  printMaterialList(
    materials: MaterialItem[],
    designName: string,
    assemblySteps: AssemblyStep[] = []
  ): void {
    const html = this.exportToHTML(materials, designName, assemblySteps);
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
      'pipe_25cm': 12,
      'pipe_15cm': 8,
      'pipe_curve_u_40cm': 28,
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
      'ramp_45cm': 22,
      'ramp_85cm': 38,
      'connector_double_tube_mount': 9,
      'swing': 50,
      'slide': 80,
      'rope_ladder': 40,
    };
    
    return prices[componentId] || 10;
  }
  
  // 获取规格
  private getSpecifications(definition: ComponentDefinition): string {
    const specs: string[] = [];
    
    if (definition.length) specs.push(`长度: ${definition.length}cm`);
    if (definition.width && definition.height) specs.push(`尺寸: ${definition.width}×${definition.height}cm`);
    if (definition.angle) specs.push(`角度: ${definition.angle}°`);
    if (definition.diameter) specs.push(`直径: ${definition.diameter}cm`);
    
    return specs.join(', ') || '-';
  }

  private renderAssemblyStepsHTML(steps: AssemblyStep[]): string {
    if (steps.length === 0) return '';

    return `
  <div class="steps">
    <h2>组装步骤</h2>
    ${steps.map(step => `
      <div class="step">
        <h3>第 ${step.order} 步：${step.title}</h3>
        <p>${step.description}</p>
        <p><strong>部件：</strong>${step.parts.map(part => `${part.name} × ${part.quantity}`).join('，') || '无'}</p>
        ${step.connectionRefs.length > 0 ? `<p><strong>连接：</strong>${step.connectionRefs.join('，')}</p>` : ''}
      </div>
    `).join('')}
  </div>`;
  }

  private renderAssemblyStepsMarkdown(steps: AssemblyStep[]): string {
    if (steps.length === 0) return '';

    let md = `\n## 组装步骤\n\n`;
    steps.forEach(step => {
      md += `### 第 ${step.order} 步：${step.title}\n\n`;
      md += `${step.description}\n\n`;
      md += `- 部件：${step.parts.map(part => `${part.name} × ${part.quantity}`).join('，') || '无'}\n`;
      if (step.connectionRefs.length > 0) {
        md += `- 连接：${step.connectionRefs.join('，')}\n`;
      }
      md += '\n';
    });

    return md;
  }
}

// 创建单例
export const exportManager = new ExportManager();
