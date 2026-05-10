// 系统集成
export { connectionSystem, ConnectionSystem } from './ConnectionSystem';
export type { ConnectionPointWorld, ConnectionCandidate } from './ConnectionSystem';

export { structuralAnalysisSystem, StructuralAnalysisSystem } from './StructuralAnalysisSystem';
export type { StructuralAnalysisResult, StructuralIssue, StructureStatistics } from './StructuralAnalysisSystem';

export { materialCostSystem, MaterialCostSystem } from './MaterialCostSystem';
export type { MaterialCost, CostAnalysisResult, CostSaving } from './MaterialCostSystem';

export { drawingSystem, DrawingSystem } from './DrawingSystem';
export type { DrawingConfig, DrawingElement, DrawingResult } from './DrawingSystem';

// 系统管理器
export class SystemManager {
  private static instance: SystemManager;
  
  private constructor() {}
  
  static getInstance(): SystemManager {
    if (!SystemManager.instance) {
      SystemManager.instance = new SystemManager();
    }
    return SystemManager.instance;
  }
  
  // 初始化所有系统
  initialize(): void {
    console.log('Initializing systems...');
    // 这里可以添加系统初始化逻辑
  }
  
  // 获取连接系统
  getConnectionSystem() {
    return connectionSystem;
  }
  
  // 获取结构分析系统
  getStructuralAnalysisSystem() {
    return structuralAnalysisSystem;
  }
  
  // 获取材料成本系统
  getMaterialCostSystem() {
    return materialCostSystem;
  }
  
  // 获取图纸系统
  getDrawingSystem() {
    return drawingSystem;
  }
}

// 导出单例
export const systemManager = SystemManager.getInstance();
