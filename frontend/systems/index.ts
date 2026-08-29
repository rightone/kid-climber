// 系统集成
export { connectionSystem, ConnectionSystem } from './ConnectionSystem';
export type { ConnectionPointWorld, ConnectionCandidate } from './ConnectionSystem';

export { structuralAnalysisSystem, StructuralAnalysisSystem } from './StructuralAnalysisSystem';
export type { StructuralAnalysisResult, StructuralIssue, StructureStatistics } from './StructuralAnalysisSystem';
export {
  auditTopology,
  createRepairPatch,
  resolvePlacementContacts,
  topologyIntegritySystem,
} from './TopologyIntegritySystem';
export type {
  ContactResolution,
  TopologyAuditReport,
  TopologyIssue,
  TopologyIssueKind,
} from './TopologyIntegritySystem';
export {
  assemblyStepSystem,
  createAssemblyDesignSignature,
  generateAssemblyGuide,
  validateAssemblyGuide,
} from './AssemblyStepSystem';
export type {
  AssemblyConnectionCallout,
  AssemblyGuide,
  AssemblyGuideIssue,
  AssemblyGuideResult,
  AssemblyGuideStep,
  AssemblyGuideValidation,
  AssemblyPhase,
  AssemblySubassembly,
} from './AssemblyStepSystem';

export { materialCostSystem, MaterialCostSystem } from './MaterialCostSystem';
export type { MaterialCost, CostAnalysisResult, CostSaving } from './MaterialCostSystem';

export { drawingSystem, DrawingSystem } from './DrawingSystem';
export type { DrawingConfig, DrawingElement, DrawingResult } from './DrawingSystem';

export { beginnerDemoSystem } from './BeginnerDemoSystem';
export type {
  BeginnerDemoCheck,
  BeginnerDemoDesign,
  BeginnerDemoDimensionSpec,
  BeginnerDemoPracticeState,
  BeginnerDemoProgress,
  BeginnerDemoStep,
} from './BeginnerDemoSystem';

export { constructionWizardSystem, createInitialConstructionWizardState } from './ConstructionWizardSystem';
export type {
  ConstructionWizardDimensionSpec,
  ConstructionWizardInput,
  ConstructionWizardModuleRecord,
  ConstructionWizardProgress,
  ConstructionWizardProgressCheck,
  ConstructionWizardSessionState,
  WizardActionKind,
  WizardGoal,
  WizardGoalId,
  WizardLayer,
  WizardModuleCandidate,
} from './ConstructionWizardSystem';

export { advancedStructureSystem } from './AdvancedStructureSystem';
export type {
  AdvancedAFrameAssembly,
  AdvancedTriangleAssembly,
  AFrameModuleSize,
  AFramePlane,
  RecipeMountPort,
  StructureRecipe,
  TriangleModuleSize,
  TrianglePlane,
} from './AdvancedStructureSystem';

export {
  createGroundRecipeMountSite,
  createRecipePlacementPatch,
  listDiagonalCandidates,
  listRecipeMountSites,
  structureMountSystem,
} from './StructureMountSystem';
export type {
  DiagonalCandidate,
  DiagonalConnectorPreview,
  DiagonalEndpointRef,
  RecipeMountAnchor,
  RecipeMountSite,
  StandardDiagonalPipeId,
  StructureRecipeId,
} from './StructureMountSystem';

export {
  curvedTubeMountSystem,
  U_CURVED_TUBE_COMPONENT_ID,
} from './CurvedTubeMountSystem';
export type {
  CurvedTubeMountEndpoint,
  CurvedTubeMountSite,
} from './CurvedTubeMountSystem';

export { rampMountSystem, RAMP_PRODUCT_SPECS } from './RampMountSystem';
export type {
  RampComponentId,
  RampMountEndpoint,
  RampMountSite,
  RampProductSpec,
} from './RampMountSystem';

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
