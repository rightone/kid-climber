import type { ComponentInstance, MaterialRequirement } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 材料成本
export interface MaterialCost {
  componentId: string;
  componentName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
}

// 成本分析结果
export interface CostAnalysisResult {
  items: MaterialCost[];
  totalCost: number;
  currency: string;
  breakdown: {
    category: string;
    cost: number;
    percentage: number;
  }[];
  savings: CostSaving[];
}

// 成本节省建议
export interface CostSaving {
  type: 'alternative' | 'bulk' | 'reuse';
  description: string;
  potentialSaving: number;
  componentId?: string;
}

// 材料成本计算系统
export class MaterialCostSystem {
  // 默认价格表（人民币）
  private defaultPrices: Record<string, number> = {
    // 管子
    'pipe_10cm': 15,
    'pipe_15cm': 20,
    'pipe_30cm': 35,
    'pipe_60cm': 60,
    
    // 连接件
    'elbow_90deg': 25,
    'elbow_45deg': 30,
    'elbow_90deg_vertical': 28,
    'tee_3way': 35,
    'tee_y_shape': 40,
    'cross_4way': 45,
    
    // 平台
    'platform_small': 120,
    'platform_medium': 200,
    'platform_large': 350,
    'platform_rectangular': 280,
    
    // 附件
    'swing': 150,
    'slide': 300,
    'rope_ladder': 180,
    'climbing_wall': 250,
    'monkey_bars': 200,
    
    // 结构件
    'support_bracket': 50,
    'base_plate': 30,
    'cap': 10,
  };
  
  // 单位
  private units: Record<string, string> = {
    'pipe': '根',
    'elbow': '个',
    'tee': '个',
    'cross': '个',
    'platform': '块',
    'swing': '套',
    'slide': '套',
    'rope_ladder': '套',
    'climbing_wall': '块',
    'monkey_bars': '根',
    'support_bracket': '个',
    'base_plate': '块',
    'cap': '个',
  };
  
  // 计算材料成本
  calculateCost(
    components: ComponentInstance[],
    customPrices?: Record<string, number>
  ): CostAnalysisResult {
    const prices = { ...this.defaultPrices, ...customPrices };
    
    // 统计各组件数量
    const componentCounts: Record<string, number> = {};
    components.forEach((component) => {
      componentCounts[component.componentId] = (componentCounts[component.componentId] || 0) + 1;
    });
    
    // 计算各项成本
    const items: MaterialCost[] = [];
    let totalCost = 0;
    
    Object.entries(componentCounts).forEach(([componentId, quantity]) => {
      const definition = getComponentById(componentId);
      const unitPrice = prices[componentId] || 0;
      const totalPrice = unitPrice * quantity;
      const [type] = componentId.split('_');
      
      items.push({
        componentId,
        componentName: definition?.name || componentId,
        quantity,
        unitPrice,
        totalPrice,
        unit: this.units[type] || '个',
      });
      
      totalCost += totalPrice;
    });
    
    // 按分类计算成本
    const categoryCosts: Record<string, number> = {};
    items.forEach((item) => {
      const [type] = item.componentId.split('_');
      const category = this.getCategoryName(type);
      categoryCosts[category] = (categoryCosts[category] || 0) + item.totalPrice;
    });
    
    const breakdown = Object.entries(categoryCosts).map(([category, cost]) => ({
      category,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }));
    
    // 生成节省建议
    const savings = this.generateSavings(components, items, prices);
    
    return {
      items,
      totalCost,
      currency: 'CNY',
      breakdown,
      savings,
    };
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
  
  // 生成节省建议
  private generateSavings(
    components: ComponentInstance[],
    items: MaterialCost[],
    prices: Record<string, number>
  ): CostSaving[] {
    const savings: CostSaving[] = [];
    
    // 批量购买建议
    items.forEach((item) => {
      if (item.quantity >= 10) {
        const bulkDiscount = 0.1; // 10%折扣
        const potentialSaving = item.totalPrice * bulkDiscount;
        
        savings.push({
          type: 'bulk',
          description: `批量购买 ${item.componentName}（${item.quantity}${item.unit}）可享受折扣`,
          potentialSaving,
          componentId: item.componentId,
        });
      }
    });
    
    // 替代方案建议
    const pipeItems = items.filter((item) => item.componentId.startsWith('pipe'));
    if (pipeItems.length > 0) {
      const longPipePrice = prices['pipe_60cm'] || 60;
      
      // 如果使用多个短管，建议使用长管
      const shortPipe30cm = pipeItems.find((item) => item.componentId === 'pipe_30cm');
      if (shortPipe30cm && shortPipe30cm.quantity >= 4) {
        const longPipeQuantity = Math.ceil(shortPipe30cm.quantity / 2);
        const longPipeCost = longPipeQuantity * longPipePrice;
        const shortPipeCost = shortPipe30cm.totalPrice;
        
        if (longPipeCost < shortPipeCost) {
          savings.push({
            type: 'alternative',
            description: `使用 ${longPipeQuantity} 根60cm管替代 ${shortPipe30cm.quantity} 根30cm管`,
            potentialSaving: shortPipeCost - longPipeCost,
          });
        }
      }
    }
    
    // 复用建议
    if (components.length > 20) {
      savings.push({
        type: 'reuse',
        description: '考虑复用现有材料，检查是否有可替代的组件',
        potentialSaving: 0,
      });
    }
    
    return savings;
  }
  
  // 生成材料清单
  generateMaterialList(
    components: ComponentInstance[],
    inventory?: Record<string, number>
  ): MaterialRequirement {
    const requirement: MaterialRequirement = {};
    
    // 统计各组件数量
    components.forEach((component) => {
      if (!requirement[component.componentId]) {
        requirement[component.componentId] = {
          required: 0,
          available: inventory?.[component.componentId] || 0,
          shortage: 0,
        };
      }
      requirement[component.componentId].required++;
    });
    
    // 计算短缺数量
    Object.keys(requirement).forEach((componentId) => {
      const item = requirement[componentId];
      item.shortage = Math.max(0, item.required - item.available);
    });
    
    return requirement;
  }
  
  // 设置价格
  setPrice(componentId: string, price: number): void {
    this.defaultPrices[componentId] = price;
  }
  
  // 获取价格
  getPrice(componentId: string): number {
    return this.defaultPrices[componentId] || 0;
  }
  
  // 获取所有价格
  getAllPrices(): Record<string, number> {
    return { ...this.defaultPrices };
  }
}

// 创建单例
export const materialCostSystem = new MaterialCostSystem();
