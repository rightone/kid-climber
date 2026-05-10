import type { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 结构分析结果
export interface StructuralAnalysisResult {
  isStable: boolean;
  stabilityScore: number; // 0-100
  issues: StructuralIssue[];
  recommendations: string[];
  statistics: StructureStatistics;
}

// 结构问题
export interface StructuralIssue {
  type: 'warning' | 'error' | 'info';
  category: 'stability' | 'connection' | 'support' | 'balance' | 'safety';
  message: string;
  componentIds: string[];
  severity: number; // 1-10
}

// 结构统计
export interface StructureStatistics {
  totalComponents: number;
  totalConnections: number;
  maxHeight: number;
  maxWidth: number;
  maxDepth: number;
  centerOfMass: [number, number, number];
  supportPoints: number;
  weight: number;
}

// 结构分析系统
export class StructuralAnalysisSystem {
  // 分析结构
  analyzeStructure(
    components: ComponentInstance[],
    connections: Connection[]
  ): StructuralAnalysisResult {
    const issues: StructuralIssue[] = [];
    const recommendations: string[] = [];
    
    // 计算统计信息
    const statistics = this.calculateStatistics(components, connections);
    
    // 检查稳定性
    const stabilityIssues = this.checkStability(components, connections, statistics);
    issues.push(...stabilityIssues);
    
    // 检查连接
    const connectionIssues = this.checkConnections(components, connections);
    issues.push(...connectionIssues);
    
    // 检查支撑
    const supportIssues = this.checkSupport(components, connections, statistics);
    issues.push(...supportIssues);
    
    // 检查平衡
    const balanceIssues = this.checkBalance(components, statistics);
    issues.push(...balanceIssues);
    
    // 检查安全性
    const safetyIssues = this.checkSafety(components, statistics);
    issues.push(...safetyIssues);
    
    // 生成建议
    recommendations.push(...this.generateRecommendations(issues, statistics));
    
    // 计算稳定性分数
    const stabilityScore = this.calculateStabilityScore(issues, statistics);
    
    return {
      isStable: stabilityScore >= 60,
      stabilityScore,
      issues,
      recommendations,
      statistics,
    };
  }
  
  // 计算统计信息
  private calculateStatistics(
    components: ComponentInstance[],
    connections: Connection[]
  ): StructureStatistics {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let totalWeight = 0;
    let supportPoints = 0;
    
    const centerOfMass = new Array(3).fill(0) as [number, number, number];
    
    components.forEach((component) => {
      const [x, y, z] = component.position;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      
      // 计算重量（简化）
      const weight = this.estimateWeight(component.componentId);
      totalWeight += weight;
      
      // 计算重心
      centerOfMass[0] += x * weight;
      centerOfMass[1] += y * weight;
      centerOfMass[2] += z * weight;
      
      // 检查是否是支撑点
      if (this.isSupportPoint(component)) {
        supportPoints++;
      }
    });
    
    // 计算平均重心
    if (totalWeight > 0) {
      centerOfMass[0] /= totalWeight;
      centerOfMass[1] /= totalWeight;
      centerOfMass[2] /= totalWeight;
    }
    
    return {
      totalComponents: components.length,
      totalConnections: connections.length,
      maxHeight: maxY - minY,
      maxWidth: maxX - minX,
      maxDepth: maxZ - minZ,
      centerOfMass,
      supportPoints,
      weight: totalWeight,
    };
  }
  
  // 估算重量
  private estimateWeight(componentId: string): number {
    const [type] = componentId.split('_');
    
    switch (type) {
      case 'pipe':
        return 2; // 2kg
      case 'elbow':
      case 'tee':
      case 'cross':
        return 1; // 1kg
      case 'platform':
        return 5; // 5kg
      case 'swing':
      case 'slide':
      case 'rope':
        return 10; // 10kg
      default:
        return 1;
    }
  }
  
  // 检查是否是支撑点
  private isSupportPoint(component: ComponentInstance): boolean {
    // 检查是否在地面附近
    return component.position[1] <= 10;
  }
  
  // 检查稳定性
  private checkStability(
    components: ComponentInstance[],
    _connections: Connection[],
    statistics: StructureStatistics
  ): StructuralIssue[] {
    const issues: StructuralIssue[] = [];
    
    // 检查重心是否在支撑范围内
    const supportComponents = components.filter((c) => this.isSupportPoint(c));
    
    if (supportComponents.length > 0) {
      const supportCenter = new Array(3).fill(0) as [number, number, number];
      supportComponents.forEach((c) => {
        supportCenter[0] += c.position[0];
        supportCenter[1] += c.position[1];
        supportCenter[2] += c.position[2];
      });
      supportCenter[0] /= supportComponents.length;
      supportCenter[1] /= supportComponents.length;
      supportCenter[2] /= supportComponents.length;
      
      const distance = Math.sqrt(
        Math.pow(statistics.centerOfMass[0] - supportCenter[0], 2) +
        Math.pow(statistics.centerOfMass[2] - supportCenter[2], 2)
      );
      
      if (distance > 50) {
        issues.push({
          type: 'warning',
          category: 'stability',
          message: '重心偏离支撑中心过远，可能导致不稳定',
          componentIds: [],
          severity: 7,
        });
      }
    }
    
    // 检查高度与支撑的比例
    if (statistics.maxHeight > 200 && statistics.supportPoints < 4) {
      issues.push({
        type: 'warning',
        category: 'stability',
        message: '高度较高但支撑点不足，建议增加支撑',
        componentIds: [],
        severity: 6,
      });
    }
    
    return issues;
  }
  
  // 检查连接
  private checkConnections(
    components: ComponentInstance[],
    connections: Connection[]
  ): StructuralIssue[] {
    const issues: StructuralIssue[] = [];
    
    // 检查孤立组件
    const connectedComponentIds = new Set<string>();
    connections.forEach((conn) => {
      connectedComponentIds.add(conn.source.componentId);
      connectedComponentIds.add(conn.target.componentId);
    });
    
    const isolatedComponents = components.filter(
      (c) => !connectedComponentIds.has(c.instanceId)
    );
    
    if (isolatedComponents.length > 0) {
      issues.push({
        type: 'warning',
        category: 'connection',
        message: `存在 ${isolatedComponents.length} 个孤立组件，未与其他组件连接`,
        componentIds: isolatedComponents.map((c) => c.instanceId),
        severity: 5,
      });
    }
    
    // 检查连接密度
    const connectionDensity = components.length > 0
      ? connections.length / components.length
      : 0;
    
    if (connectionDensity < 0.5 && components.length > 3) {
      issues.push({
        type: 'info',
        category: 'connection',
        message: '连接密度较低，建议增加连接以提高稳定性',
        componentIds: [],
        severity: 3,
      });
    }
    
    return issues;
  }
  
  // 检查支撑
  private checkSupport(
    components: ComponentInstance[],
    _connections: Connection[],
    statistics: StructureStatistics
  ): StructuralIssue[] {
    const issues: StructuralIssue[] = [];
    
    // 检查是否有足够的支撑
    if (statistics.supportPoints < 2 && statistics.totalComponents > 2) {
      issues.push({
        type: 'error',
        category: 'support',
        message: '支撑点不足，结构可能不稳定',
        componentIds: [],
        severity: 8,
      });
    }
    
    // 检查支撑分布
    const supportComponents = components.filter((c) => this.isSupportPoint(c));
    
    if (supportComponents.length >= 2) {
      const supportPositions = supportComponents.map((c) => c.position);
      const supportSpread = this.calculateSpread(supportPositions);
      
      if (supportSpread < 30 && statistics.maxHeight > 100) {
        issues.push({
          type: 'warning',
          category: 'support',
          message: '支撑点分布较窄，高度较高时可能不稳定',
          componentIds: supportComponents.map((c) => c.instanceId),
          severity: 6,
        });
      }
    }
    
    return issues;
  }
  
  // 计算分布范围
  private calculateSpread(positions: [number, number, number][]): number {
    if (positions.length < 2) return 0;
    
    let maxDistance = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const distance = Math.sqrt(
          Math.pow(positions[i][0] - positions[j][0], 2) +
          Math.pow(positions[i][2] - positions[j][2], 2)
        );
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    return maxDistance;
  }
  
  // 检查平衡
  private checkBalance(
    components: ComponentInstance[],
    statistics: StructureStatistics
  ): StructuralIssue[] {
    const issues: StructuralIssue[] = [];
    
    // 检查重心高度
    if (statistics.centerOfMass[1] > statistics.maxHeight * 0.7) {
      issues.push({
        type: 'warning',
        category: 'balance',
        message: '重心较高，可能影响稳定性',
        componentIds: [],
        severity: 5,
      });
    }
    
    // 检查左右平衡
    const leftComponents = components.filter((c) => c.position[0] < statistics.centerOfMass[0] - 20);
    const rightComponents = components.filter((c) => c.position[0] > statistics.centerOfMass[0] + 20);
    
    const balanceRatio = leftComponents.length > 0 && rightComponents.length > 0
      ? Math.min(leftComponents.length, rightComponents.length) / Math.max(leftComponents.length, rightComponents.length)
      : 1;
    
    if (balanceRatio < 0.5) {
      issues.push({
        type: 'warning',
        category: 'balance',
        message: '左右重量不平衡，可能导致倾斜',
        componentIds: [],
        severity: 4,
      });
    }
    
    return issues;
  }
  
  // 检查安全性
  private checkSafety(
    components: ComponentInstance[],
    statistics: StructureStatistics
  ): StructuralIssue[] {
    const issues: StructuralIssue[] = [];
    
    // 检查高度限制
    if (statistics.maxHeight > 300) {
      issues.push({
        type: 'warning',
        category: 'safety',
        message: '结构高度超过3米，请注意安全',
        componentIds: [],
        severity: 7,
      });
    }
    
    // 检查是否有尖锐边缘
    const sharpComponents = components.filter((c) => {
      const definition = getComponentById(c.componentId);
      return definition?.type === 'elbow' || definition?.type === 'tee';
    });
    
    if (sharpComponents.length > 0) {
      issues.push({
        type: 'info',
        category: 'safety',
        message: '存在弯头和接头，请确保边缘处理安全',
        componentIds: sharpComponents.map((c) => c.instanceId),
        severity: 3,
      });
    }
    
    return issues;
  }
  
  // 生成建议
  private generateRecommendations(
    issues: StructuralIssue[],
    statistics: StructureStatistics
  ): string[] {
    const recommendations: string[] = [];
    
    // 根据问题生成建议
    issues.forEach((issue) => {
      switch (issue.category) {
        case 'stability':
          recommendations.push('增加底部支撑点以提高稳定性');
          recommendations.push('降低重心或增加底部重量');
          break;
        case 'connection':
          recommendations.push('增加组件之间的连接以提高结构强度');
          recommendations.push('使用三通或四通接头增加连接点');
          break;
        case 'support':
          recommendations.push('在底部添加更多支撑组件');
          recommendations.push('确保支撑点均匀分布');
          break;
        case 'balance':
          recommendations.push('调整组件位置以平衡重量分布');
          recommendations.push('在轻的一侧添加更多组件');
          break;
        case 'safety':
          recommendations.push('添加防护措施，如扶手或护栏');
          recommendations.push('确保所有连接牢固');
          break;
      }
    });
    
    // 通用建议
    if (statistics.totalComponents > 20) {
      recommendations.push('结构较复杂，建议分阶段搭建');
    }
    
    if (statistics.maxHeight > 150) {
      recommendations.push('高度较高，建议添加安全网或软垫');
    }
    
    // 去重
    return [...new Set(recommendations)];
  }
  
  // 计算稳定性分数
  private calculateStabilityScore(
    issues: StructuralIssue[],
    statistics: StructureStatistics
  ): number {
    let score = 100;
    
    // 根据问题扣分
    issues.forEach((issue) => {
      switch (issue.type) {
        case 'error':
          score -= issue.severity * 2;
          break;
        case 'warning':
          score -= issue.severity;
          break;
        case 'info':
          score -= issue.severity * 0.5;
          break;
      }
    });
    
    // 根据结构特征加分
    if (statistics.supportPoints >= 4) {
      score += 10;
    }
    
    if (statistics.totalConnections >= statistics.totalComponents * 0.8) {
      score += 10;
    }
    
    if (statistics.centerOfMass[1] < statistics.maxHeight * 0.5) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}

// 创建单例
export const structuralAnalysisSystem = new StructuralAnalysisSystem();
