import type { ComponentInstance, MaterialRequirement } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 计算材料需求
export const calculateMaterialRequirement = (
  components: ComponentInstance[],
  inventory: Record<string, number> = {}
): MaterialRequirement => {
  const requirement: MaterialRequirement = {};
  
  // 统计各组件数量
  components.forEach(component => {
    if (!requirement[component.componentId]) {
      requirement[component.componentId] = {
        required: 0,
        available: inventory[component.componentId] || 0,
        shortage: 0,
      };
    }
    requirement[component.componentId].required++;
  });
  
  // 计算短缺数量
  Object.keys(requirement).forEach(componentId => {
    const item = requirement[componentId];
    item.shortage = Math.max(0, item.required - item.available);
  });
  
  return requirement;
};

// 计算连接损耗
export const calculateConnectionLoss = (
  components: ComponentInstance[],
  lossRate: number = 0.05
): Record<string, number> => {
  const loss: Record<string, number> = {};
  
  // 统计各组件数量
  const componentCounts: Record<string, number> = {};
  components.forEach(component => {
    componentCounts[component.componentId] = (componentCounts[component.componentId] || 0) + 1;
  });
  
  // 计算损耗
  Object.entries(componentCounts).forEach(([componentId, count]) => {
    loss[componentId] = Math.ceil(count * lossRate);
  });
  
  return loss;
};

// 计算总成本
export const calculateTotalCost = (
  materials: MaterialRequirement,
  prices: Record<string, number> = {}
): number => {
  let totalCost = 0;
  
  Object.entries(materials).forEach(([componentId, data]) => {
    const price = prices[componentId] || 0;
    totalCost += data.required * price;
  });
  
  return totalCost;
};

// 生成材料清单
export interface MaterialListItem {
  componentId: string;
  componentName: string;
  componentType: string;
  required: number;
  available: number;
  shortage: number;
  unitPrice: number;
  totalPrice: number;
  specifications: string;
}

export const generateMaterialList = (
  materials: MaterialRequirement,
  prices: Record<string, number> = {}
): MaterialListItem[] => {
  const list: MaterialListItem[] = [];
  
  Object.entries(materials).forEach(([componentId, data]) => {
    const componentDef = getComponentById(componentId);
    const price = prices[componentId] || 0;
    
    list.push({
      componentId,
      componentName: componentDef?.name || componentId,
      componentType: componentDef?.type || 'unknown',
      required: data.required,
      available: data.available,
      shortage: data.shortage,
      unitPrice: price,
      totalPrice: data.required * price,
      specifications: getComponentSpecifications(componentId),
    });
  });
  
  // 按组件类型排序
  list.sort((a, b) => a.componentType.localeCompare(b.componentType));
  
  return list;
};

// 获取组件规格描述
const getComponentSpecifications = (componentId: string): string => {
  const componentDef = getComponentById(componentId);
  if (!componentDef) return '';
  
  const specs: string[] = [];
  
  if (componentDef.length) {
    specs.push(`长度: ${componentDef.length}cm`);
  }
  
  if (componentDef.width && componentDef.height) {
    specs.push(`尺寸: ${componentDef.width}x${componentDef.height}cm`);
  }
  
  if (componentDef.angle) {
    specs.push(`角度: ${componentDef.angle}°`);
  }
  
  if (componentDef.diameter) {
    specs.push(`直径: ${componentDef.diameter}cm`);
  }
  
  return specs.join(', ');
};

// 计算结构稳定性（简化版本）
export interface StabilityResult {
  isStable: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export const calculateStability = (components: ComponentInstance[]): StabilityResult => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // 检查是否有平台
  const platforms = components.filter(c => c.componentId.startsWith('platform'));
  if (platforms.length === 0) {
    issues.push('没有平台组件');
    suggestions.push('添加平台作为基础支撑');
    score -= 20;
  }
  
  // 检查是否有足够的支撑
  const pipes = components.filter(c => c.componentId.startsWith('pipe'));
  if (pipes.length < 4) {
    issues.push('支撑管数量不足');
    suggestions.push('增加支撑管数量以提高稳定性');
    score -= 15;
  }
  
  // 检查是否有连接件
  const connectors = components.filter(c => 
    c.componentId.startsWith('elbow') || 
    c.componentId.startsWith('tee') || 
    c.componentId.startsWith('cross')
  );
  if (connectors.length === 0) {
    issues.push('没有连接件');
    suggestions.push('添加连接件以固定结构');
    score -= 10;
  }
  
  // 检查高度是否过高
  const maxHeight = Math.max(...components.map(c => c.position[1]), 0);
  if (maxHeight > 200) {
    issues.push('结构高度过高');
    suggestions.push('考虑降低高度或增加支撑');
    score -= 10;
  }
  
  // 检查重心是否稳定
  const centerX = components.reduce((sum, c) => sum + c.position[0], 0) / components.length;
  const centerZ = components.reduce((sum, c) => sum + c.position[2], 0) / components.length;
  
  if (Math.abs(centerX) > 50 || Math.abs(centerZ) > 50) {
    issues.push('重心偏移过大');
    suggestions.push('调整组件位置使重心居中');
    score -= 10;
  }
  
  return {
    isStable: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
  };
};

// 计算设计复杂度
export interface ComplexityResult {
  level: 'simple' | 'medium' | 'complex';
  score: number;
  factors: string[];
}

export const calculateComplexity = (components: ComponentInstance[]): ComplexityResult => {
  const factors: string[] = [];
  let score = 0;
  
  // 组件数量
  const componentCount = components.length;
  if (componentCount > 50) {
    factors.push('组件数量多');
    score += 30;
  } else if (componentCount > 20) {
    factors.push('组件数量中等');
    score += 15;
  }
  
  // 组件种类
  const componentTypes = new Set(components.map(c => c.componentId));
  if (componentTypes.size > 8) {
    factors.push('组件种类多');
    score += 20;
  } else if (componentTypes.size > 4) {
    factors.push('组件种类中等');
    score += 10;
  }
  
  // 结构高度
  const maxHeight = Math.max(...components.map(c => c.position[1]), 0);
  if (maxHeight > 150) {
    factors.push('结构高度高');
    score += 20;
  } else if (maxHeight > 80) {
    factors.push('结构高度中等');
    score += 10;
  }
  
  // 连接复杂度
  const connectors = components.filter(c => 
    c.componentId.startsWith('elbow') || 
    c.componentId.startsWith('tee') || 
    c.componentId.startsWith('cross')
  );
  if (connectors.length > 10) {
    factors.push('连接复杂');
    score += 20;
  } else if (connectors.length > 5) {
    factors.push('连接中等');
    score += 10;
  }
  
  // 确定复杂度等级
  let level: 'simple' | 'medium' | 'complex';
  if (score >= 60) {
    level = 'complex';
  } else if (score >= 30) {
    level = 'medium';
  } else {
    level = 'simple';
  }
  
  return {
    level,
    score,
    factors,
  };
};

// 生成设计报告
export interface DesignReport {
  summary: {
    totalComponents: number;
    totalConnections: number;
    estimatedCost: number;
    stabilityScore: number;
    complexityLevel: string;
  };
  materials: MaterialListItem[];
  stability: StabilityResult;
  complexity: ComplexityResult;
  recommendations: string[];
}

export const generateDesignReport = (
  components: ComponentInstance[],
  inventory: Record<string, number> = {},
  prices: Record<string, number> = {}
): DesignReport => {
  // 计算材料需求
  const materials = calculateMaterialRequirement(components, inventory);
  const materialList = generateMaterialList(materials, prices);
  
  // 计算稳定性
  const stability = calculateStability(components);
  
  // 计算复杂度
  const complexity = calculateComplexity(components);
  
  // 计算总成本
  const totalCost = calculateTotalCost(materials, prices);
  
  // 生成建议
  const recommendations: string[] = [];
  
  if (stability.score < 80) {
    recommendations.push('建议增加支撑结构以提高稳定性');
  }
  
  if (complexity.level === 'complex') {
    recommendations.push('设计较为复杂，建议分步搭建');
  }
  
  const shortageItems = materialList.filter(item => item.shortage > 0);
  if (shortageItems.length > 0) {
    recommendations.push(`需要购买 ${shortageItems.length} 种组件`);
  }
  
  return {
    summary: {
      totalComponents: components.length,
      totalConnections: 0, // 需要从连接数据中计算
      estimatedCost: totalCost,
      stabilityScore: stability.score,
      complexityLevel: complexity.level,
    },
    materials: materialList,
    stability,
    complexity,
    recommendations,
  };
};

// 格式化数字
export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals);
};

// 格式化货币
export const formatCurrency = (amount: number, currency: string = '¥'): string => {
  return `${currency}${formatNumber(amount)}`;
};

// 计算百分比
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

// 生成唯一ID
export const generateUniqueId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
