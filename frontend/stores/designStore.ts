import { create } from 'zustand';
import type { ComponentInstance, Connection, Design, EditorState, MaterialInventory, MaterialRequirement } from '../types';
import { useInteractionStore } from './interactionStore';
import { beginnerDemoSystem, type BeginnerDemoDesign } from '../systems/BeginnerDemoSystem';
import {
  constructionWizardSystem,
  createInitialConstructionWizardState,
  type ConstructionWizardModuleRecord,
  type ConstructionWizardSessionState,
  type WizardGoalId,
  type WizardLayer,
  type WizardModuleCandidate,
} from '../systems/ConstructionWizardSystem';
import {
  connectorTopologySystem,
  type TopologyPatch,
} from '../systems/ConnectorTopologySystem';
import {
  auditTopology,
  createRepairPatch,
  type TopologyAuditReport,
} from '../systems/TopologyIntegritySystem';
import {
  assignAutomaticPipeColors,
  normalizeComponentInstanceColor,
} from '../systems/PipeColorSystem';
import { useBuildPreferencesStore } from './buildPreferencesStore';
import {
  migrateBoardMountData,
  normalizeBoardComponentInstance,
} from '../systems/BoardMountSystem';
import { migrateReferenceProductData } from '../systems/ReferenceProductMigrationSystem';

// 历史记录快照
interface HistorySnapshot {
  components: ComponentInstance[];
  connections: Connection[];
  beginnerDemo: BeginnerDemoSessionState;
  constructionWizard: ConstructionWizardSessionState;
  timestamp: number;
}

export interface BeginnerDemoSessionState {
  active: boolean;
  sessionId: string | null;
  loadedSample: 'starter' | 'target' | null;
  endpointGrowthPracticed: boolean;
  lastPracticeAt: number | null;
  scopeComponentIds: string[];
  scopeConnectionIds: string[];
  practiceComponentIds: string[];
  practiceConnectionIds: string[];
}

interface CommitComponentsPlacementOptions {
  beginnerDemoPractice?: boolean;
  constructionWizardModule?: ConstructionWizardModuleRecord;
}

// 设计状态接口
interface DesignState {
  // 当前设计
  currentDesign: Design | null;
  
  // 组件实例列表
  components: ComponentInstance[];
  
  // 连接关系列表
  connections: Connection[];
  
  // 材料库存
  inventory: MaterialInventory;
  
  // 编辑器状态
  editor: EditorState;
  
  // 操作历史（用于撤销/重做）
  history: HistorySnapshot[];
  historyIndex: number;
  maxHistorySize: number;
  
  // 剪贴板
  clipboard: ComponentInstance[];
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  topologyAudit: TopologyAuditReport;

  // 新手 demo 练习状态：结构完成度和真实端点生长练习分开记录
  beginnerDemo: BeginnerDemoSessionState;

  // 结构向导状态：记录模块级搭建 provenance，避免任意散件误算为向导完成
  constructionWizard: ConstructionWizardSessionState;
  
  // Actions
  setCurrentDesign: (design: Design | null) => void;
  hydrateDesign: (design: Design) => void;
  
  // 组件操作
  addComponent: (component: ComponentInstance) => void;
  commitComponentPlacement: (component: ComponentInstance, newConnections?: Connection[]) => void;
  commitComponentsPlacement: (
    newComponents: ComponentInstance[],
    newConnections?: Connection[],
    options?: CommitComponentsPlacementOptions
  ) => void;
  commitTopologyPatch: (
    patch: TopologyPatch,
    options?: CommitComponentsPlacementOptions
  ) => void;
  auditTopology: () => TopologyAuditReport;
  repairTopology: () => boolean;
  commitComponentsDeletion: (instanceIds: string[]) => void;
  commitComponentUpdate: (instanceId: string, updates: Partial<ComponentInstance>) => void;
  commitComponentsPaste: (newComponents: ComponentInstance[]) => void;
  removeComponent: (instanceId: string) => void;
  updateComponent: (instanceId: string, updates: Partial<ComponentInstance>) => void;
  moveComponent: (instanceId: string, position: [number, number, number]) => void;
  commitComponentMove: (
    instanceId: string,
    position: [number, number, number],
    rotation?: [number, number, number],
    newConnections?: Connection[],
    replaceComponentConnections?: boolean
  ) => void;
  rotateComponent: (instanceId: string, rotation: [number, number, number]) => void;
  batchUpdateComponents: (updates: { instanceId: string; changes: Partial<ComponentInstance> }[]) => void;
  
  // 连接操作
  addConnection: (connection: Connection) => void;
  removeConnection: (connectionId: string) => void;
  removeConnectionsByComponent: (instanceId: string) => void;
  
  /** @deprecated Session drag state lives in interactionStore. */
  setDragging: (isDragging: boolean, instanceId?: string, componentId?: string) => void;
  /** @deprecated Session snap feedback lives in interactionStore. */
  setSnapTarget: (target: { instanceId: string; pointId: string; position: [number, number, number] } | null) => void;
  
  /** @deprecated Session selection lives in interactionStore. */
  selectComponent: (instanceId: string) => void;
  /** @deprecated Session selection lives in interactionStore. */
  deselectComponent: (instanceId: string) => void;
  /** @deprecated Session selection lives in interactionStore. */
  toggleSelectComponent: (instanceId: string) => void;
  /** @deprecated Session selection lives in interactionStore. */
  selectAll: () => void;
  /** @deprecated Session selection lives in interactionStore. */
  clearSelection: () => void;
  /** @deprecated Session selection lives in interactionStore. */
  selectComponents: (instanceIds: string[]) => void;
  
  // 编辑器状态
  setEditorState: (updates: Partial<EditorState>) => void;
  
  // 剪贴板操作
  copySelected: (instanceIds?: string[]) => void;
  paste: () => void;
  duplicateSelected: (instanceIds?: string[]) => void;
  
  // 历史操作
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearHistory: () => void;
  
  // 材料库存
  setInventory: (inventory: MaterialInventory) => void;
  updateInventoryItem: (componentId: string, quantity: number) => void;
  calculateMaterials: () => MaterialRequirement;

  // 新手 demo 操作
  loadBeginnerDemoStarter: () => BeginnerDemoDesign;
  loadBeginnerDemoTarget: () => BeginnerDemoDesign;
  recordBeginnerDemoEndpointGrowthPractice: (placement: {
    components: ComponentInstance[];
    connections: Connection[];
  }) => void;
  clearBeginnerDemoPractice: () => void;

  // 结构向导操作
  startConstructionWizard: (goalId?: WizardGoalId) => ConstructionWizardSessionState;
  stopConstructionWizard: () => void;
  selectConstructionWizardCandidate: (candidateId: string | null) => void;
  setConstructionWizardLayer: (layer: WizardLayer) => void;
  commitConstructionWizardCandidate: (candidate: WizardModuleCandidate) => void;
  
  // 加载状态
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 重置
  reset: () => void;
}

// 初始编辑器状态
const initialEditorState: EditorState = {
  viewMode: 'realistic',
  showGrid: true,
  showConnections: false,
  gridSize: 20,
};

const createEmptyTopologyAudit = (): TopologyAuditReport => ({
  issues: [],
  repairableCount: 0,
  freeEndpointCount: 0,
});

const createInitialBeginnerDemoState = (): BeginnerDemoSessionState => ({
  active: false,
  sessionId: null,
  loadedSample: null,
  endpointGrowthPracticed: false,
  lastPracticeAt: null,
  scopeComponentIds: [],
  scopeConnectionIds: [],
  practiceComponentIds: [],
  practiceConnectionIds: [],
});

const cloneBeginnerDemoState = (beginnerDemo: BeginnerDemoSessionState): BeginnerDemoSessionState => ({
  ...beginnerDemo,
  scopeComponentIds: [...beginnerDemo.scopeComponentIds],
  scopeConnectionIds: [...beginnerDemo.scopeConnectionIds],
  practiceComponentIds: [...beginnerDemo.practiceComponentIds],
  practiceConnectionIds: [...beginnerDemo.practiceConnectionIds],
});

const cloneSnapshot = (
  components: ComponentInstance[],
  connections: Connection[],
  beginnerDemo: BeginnerDemoSessionState,
  constructionWizard: ConstructionWizardSessionState
): HistorySnapshot => ({
  components: JSON.parse(JSON.stringify(components)),
  connections: JSON.parse(JSON.stringify(connections)),
  beginnerDemo: cloneBeginnerDemoState(beginnerDemo),
  constructionWizard: constructionWizardSystem.cloneSession(constructionWizard),
  timestamp: Date.now(),
});

const isSameConnection = (a: Connection, b: Connection) =>
  (a.source.componentId === b.source.componentId &&
    a.source.pointId === b.source.pointId &&
    a.target.componentId === b.target.componentId &&
    a.target.pointId === b.target.pointId) ||
  (a.source.componentId === b.target.componentId &&
    a.source.pointId === b.target.pointId &&
    a.target.componentId === b.source.componentId &&
    a.target.pointId === b.source.pointId);

const usesEndpoint = (connection: Connection, componentId: string, pointId: string) =>
  (connection.source.componentId === componentId && connection.source.pointId === pointId) ||
  (connection.target.componentId === componentId && connection.target.pointId === pointId);

const mergeUniqueConnections = (
  existingConnections: Connection[],
  newConnections: Connection[] = []
): Connection[] => {
  const merged = [...existingConnections];
  newConnections.forEach((connection) => {
    const duplicatesConnection = merged.some((item) => isSameConnection(item, connection));
    const endpointAlreadyUsed = merged.some(
      (item) =>
        usesEndpoint(item, connection.source.componentId, connection.source.pointId) ||
        usesEndpoint(item, connection.target.componentId, connection.target.pointId)
    );

    if (!duplicatesConnection && !endpointAlreadyUsed) {
      merged.push(connection);
    }
  });
  return merged;
};

const mergeIds = (existing: string[], additions: string[]) => {
  const ids = new Set(existing);
  additions.forEach((id) => ids.add(id));
  return [...ids];
};

const createBeginnerDemoSessionId = (sample: 'starter' | 'target') =>
  `beginner_demo_${sample}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const applyBeginnerDemoPracticePlacement = (
  beginnerDemo: BeginnerDemoSessionState,
  components: ComponentInstance[],
  connections: Connection[]
): BeginnerDemoSessionState => {
  if (!beginnerDemo.active || components.length === 0 || connections.length === 0) {
    return beginnerDemo;
  }

  const componentIds = components.map((component) => component.instanceId);
  const connectionIds = connections.map((connection) => connection.id);

  return {
    ...beginnerDemo,
    endpointGrowthPracticed: true,
    lastPracticeAt: Date.now(),
    scopeComponentIds: mergeIds(beginnerDemo.scopeComponentIds, componentIds),
    scopeConnectionIds: mergeIds(beginnerDemo.scopeConnectionIds, connectionIds),
    practiceComponentIds: componentIds,
    practiceConnectionIds: connectionIds,
  };
};

const applyConstructionWizardModulePlacement = (
  constructionWizard: ConstructionWizardSessionState,
  moduleRecord: ConstructionWizardModuleRecord | undefined
): ConstructionWizardSessionState => {
  if (!moduleRecord || !constructionWizard.active) return constructionWizard;

  const existingIndex = constructionWizard.moduleHistory.findIndex(record => record.id === moduleRecord.id);
  const moduleHistory =
    existingIndex >= 0
      ? constructionWizard.moduleHistory.map((record, index) =>
          index === existingIndex ? moduleRecord : record
        )
      : [...constructionWizard.moduleHistory, moduleRecord];

  return {
    ...constructionWizard,
    currentLayer: constructionWizardSystem.getNextLayerAfterCommit(moduleRecord.kind),
    selectedCandidateId: null,
    moduleHistory,
  };
};

// 创建设计状态管理
export const useDesignStore = create<DesignState>((set, get) => ({
  // 初始状态
  currentDesign: null,
  components: [],
  connections: [],
  inventory: {},
  editor: initialEditorState,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  clipboard: [],
  isLoading: false,
  error: null,
  topologyAudit: createEmptyTopologyAudit(),
  beginnerDemo: createInitialBeginnerDemoState(),
  constructionWizard: createInitialConstructionWizardState(),
  
  // 设置当前设计
  setCurrentDesign: (design) => set({ currentDesign: design }),
  hydrateDesign: (design) => {
    const importedComponents = (JSON.parse(JSON.stringify(design.components)) as ComponentInstance[])
      .map(normalizeComponentInstanceColor);
    const importedConnections = JSON.parse(JSON.stringify(design.connections)) as Connection[];
    const migratedReferenceData = migrateReferenceProductData({
      components: importedComponents,
      connections: importedConnections,
      productProfileVersion: design.productProfileVersion,
    });
    const migratedBoardData = migrateBoardMountData({
      components: migratedReferenceData.components,
      connections: migratedReferenceData.connections,
    });
    const components = migratedBoardData.components;
    const connections = migratedBoardData.connections;
    const beginnerDemo = createInitialBeginnerDemoState();
    const constructionWizard = createInitialConstructionWizardState();
    const gridSize =
      Number.isFinite(design.settings.gridSize) && design.settings.gridSize > 0
        ? design.settings.gridSize
        : initialEditorState.gridSize;
    const editor: EditorState = {
      ...initialEditorState,
      gridSize,
      showConnections: design.settings.showConnections,
      viewMode: design.settings.viewMode,
    };
    const currentDesign: Design = {
      ...design,
      productProfileVersion: migratedReferenceData.productProfileVersion,
      components,
      connections,
      settings: {
        ...design.settings,
        gridSize,
      },
    };
    const topologyAudit = auditTopology({ components, connections });

    set({
      currentDesign,
      components,
      connections,
      editor,
      history: [cloneSnapshot(components, connections, beginnerDemo, constructionWizard)],
      historyIndex: 0,
      clipboard: [],
      isLoading: false,
      error: null,
      topologyAudit,
      beginnerDemo,
      constructionWizard,
    });

    useInteractionStore.getState().resetDocumentSession();
  },
  
  // 添加组件
  addComponent: (component) => {
    const { components } = get();
    set({ components: [...components, component] });
    get().saveToHistory();
  },

  // 原子提交新组件与随附连接，避免一次放置产生多条撤销记录
  commitComponentPlacement: (component, newConnections = []) => {
    const { connections } = get();
    const acceptedConnections = mergeUniqueConnections(
      connections,
      newConnections
    ).filter(
      connection => !connections.some(item => item.id === connection.id)
    );
    get().commitTopologyPatch({
      addComponents: [component],
      updateComponents: [],
      removeComponentIds: [],
      addConnections: acceptedConnections,
      updateConnections: [],
      removeConnectionIds: [],
    });
  },

  // 原子提交多个组件与连接，用于端点生长一次生成“连接件 + 管子”
  commitComponentsPlacement: (newComponents, newConnections = [], options = {}) => {
    if (newComponents.length === 0) return;

    const { connections } = get();
    const acceptedConnections = mergeUniqueConnections(
      connections,
      newConnections
    ).filter(
      connection => !connections.some(item => item.id === connection.id)
    );
    get().commitTopologyPatch(
      {
        addComponents: newComponents,
        updateComponents: [],
        removeComponentIds: [],
        addConnections: acceptedConnections,
        updateConnections: [],
        removeConnectionIds: [],
      },
      options
    );
  },

  commitTopologyPatch: (patch, options = {}) => {
    const hasDocumentChange =
      patch.addComponents.length > 0 ||
      patch.updateComponents.length > 0 ||
      patch.removeComponentIds.length > 0 ||
      patch.addConnections.length > 0 ||
      patch.updateConnections.length > 0 ||
      patch.removeConnectionIds.length > 0;
    if (!hasDocumentChange) return;

    const {
      components,
      connections,
      beginnerDemo,
      constructionWizard,
    } = get();
    const colorizedPatch: TopologyPatch = {
      ...patch,
      addComponents: assignAutomaticPipeColors({
        existingComponents: components,
        existingConnections: connections,
        newComponents: patch.addComponents,
        newConnections: patch.addConnections,
        mode: useBuildPreferencesStore.getState().pipeColorMode,
      }).map(normalizeBoardComponentInstance),
    };

    const nextDocument = connectorTopologySystem.applyTopologyPatch({
      components,
      connections,
      patch: colorizedPatch,
    });
    const nextTopologyAudit = auditTopology(nextDocument);
    const nextBeginnerDemo = options.beginnerDemoPractice
      ? applyBeginnerDemoPracticePlacement(
          beginnerDemo,
          colorizedPatch.addComponents,
          colorizedPatch.addConnections
        )
      : beginnerDemo;
    const nextConstructionWizard = applyConstructionWizardModulePlacement(
      constructionWizard,
      options.constructionWizardModule
    );

    set({
      components: nextDocument.components,
      connections: nextDocument.connections,
      topologyAudit: nextTopologyAudit,
      beginnerDemo: nextBeginnerDemo,
      constructionWizard: nextConstructionWizard,
    });
    get().saveToHistory();
    const interactionStore = useInteractionStore.getState();
    interactionStore.reconcileDocumentComponents(
      nextDocument.components,
      nextDocument.connections
    );
    if (colorizedPatch.selectInstanceId) {
      interactionStore.selectComponents([colorizedPatch.selectInstanceId]);
    }
    if (colorizedPatch.nextEndpoint) {
      interactionStore.selectGrowthEndpoint(colorizedPatch.nextEndpoint);
    }
  },

  auditTopology: () => {
    const { components, connections } = get();
    const report = auditTopology({ components, connections });
    set({ topologyAudit: report });
    return report;
  },
  
  commitComponentsDeletion: (instanceIds) => {
    if (instanceIds.length === 0) return;

    const { components, connections } = get();
    const existingIds = new Set(components.map(component => component.instanceId));
    const removeComponentIds = [
      ...new Set(instanceIds.filter(instanceId => existingIds.has(instanceId))),
    ];
    if (removeComponentIds.length === 0) {
      return;
    }

    const removeIdSet = new Set(removeComponentIds);
    get().commitTopologyPatch({
      addComponents: [],
      updateComponents: [],
      removeComponentIds,
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: connections
        .filter(
          connection =>
            removeIdSet.has(connection.source.componentId) ||
            removeIdSet.has(connection.target.componentId)
        )
        .map(connection => connection.id),
    });
  },

  commitComponentUpdate: (instanceId, updates) => {
    const { components } = get();
    if (!components.some(component => component.instanceId === instanceId)) return;

    get().commitTopologyPatch({
      addComponents: [],
      updateComponents: [{ instanceId, updates }],
      removeComponentIds: [],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: [],
    });
  },

  commitComponentsPaste: (newComponents) => {
    if (newComponents.length === 0) return;

    const { components } = get();
    set({
      components: [...components, ...newComponents],
    });
    get().saveToHistory();
  },

  // 移除组件
  removeComponent: (instanceId) => {
    get().commitComponentsDeletion([instanceId]);
    useInteractionStore.getState().deselectComponent(instanceId);
  },
  
  // 更新组件
  updateComponent: (instanceId, updates) => {
    const { components } = get();
    set({
      components: components.map(c =>
        c.instanceId === instanceId ? { ...c, ...updates } : c
      ),
    });
  },
  
  // 移动组件
  moveComponent: (instanceId, position) => {
    const { components } = get();
    set({
      components: components.map(c =>
        c.instanceId === instanceId ? { ...c, position } : c
      ),
    });
  },

  // 原子提交移动结果，可选择替换该组件原有连接
  commitComponentMove: (
    instanceId,
    position,
    rotation,
    newConnections = [],
    replaceComponentConnections = false
  ) => {
    const { components, connections } = get();
    const component = components.find(item => item.instanceId === instanceId);
    if (!component) return;
    const removedConnectionIds = replaceComponentConnections
      ? connections
          .filter(
            connection =>
              connection.source.componentId === instanceId ||
              connection.target.componentId === instanceId
          )
          .map(connection => connection.id)
      : [];
    const retainedConnections = connections.filter(
      connection => !removedConnectionIds.includes(connection.id)
    );
    const acceptedConnections = mergeUniqueConnections(
      retainedConnections,
      newConnections
    ).filter(
      connection =>
        !retainedConnections.some(item => item.id === connection.id)
    );

    get().commitTopologyPatch({
      addComponents: [],
      updateComponents: [
        {
          instanceId,
          updates: {
            position,
            rotation: rotation ?? component.rotation,
          },
        },
      ],
      removeComponentIds: [],
      addConnections: acceptedConnections,
      updateConnections: [],
      removeConnectionIds: removedConnectionIds,
    });
  },
  
  // 旋转组件
  rotateComponent: (instanceId, rotation) => {
    const { components } = get();
    set({
      components: components.map(c =>
        c.instanceId === instanceId ? { ...c, rotation } : c
      ),
    });
  },
  
  // 批量更新组件
  batchUpdateComponents: (updates) => {
    const { components } = get();
    const updateMap = new Map(updates.map(u => [u.instanceId, u.changes]));
    
    set({
      components: components.map(c => {
        const changes = updateMap.get(c.instanceId);
        return changes ? { ...c, ...changes } : c;
      }),
    });
    
    get().saveToHistory();
  },
  
  // 添加连接
  addConnection: (connection) => {
    const { connections } = get();
    
    // 检查是否已存在相同连接
    const exists = connections.some(c => isSameConnection(c, connection));
    
    if (!exists) {
      get().commitTopologyPatch({
        addComponents: [],
        updateComponents: [],
        removeComponentIds: [],
        addConnections: [connection],
        updateConnections: [],
        removeConnectionIds: [],
      });
    }
  },
  
  // 移除连接
  removeConnection: (connectionId) => {
    const { connections } = get();
    if (!connections.some(connection => connection.id === connectionId)) {
      return;
    }
    get().commitTopologyPatch({
      addComponents: [],
      updateComponents: [],
      removeComponentIds: [],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: [connectionId],
    });
  },
  
  // 移除组件的所有连接
  removeConnectionsByComponent: (instanceId) => {
    const { connections } = get();
    const removeConnectionIds = connections
      .filter(
        connection =>
          connection.source.componentId === instanceId ||
          connection.target.componentId === instanceId
      )
      .map(connection => connection.id);
    if (removeConnectionIds.length === 0) return;
    get().commitTopologyPatch({
      addComponents: [],
      updateComponents: [],
      removeComponentIds: [],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds,
    });
  },

  repairTopology: () => {
    const { components, connections } = get();
    const patch = createRepairPatch({
      components,
      connections,
      idFactory: (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    });
    if (!patch) {
      set({ topologyAudit: auditTopology({ components, connections }) });
      return false;
    }
    get().commitTopologyPatch(patch);
    return true;
  },
  
  // 设置拖拽状态
  setDragging: (isDragging, instanceId, componentId) => {
    const interactionStore = useInteractionStore.getState();
    if (isDragging && instanceId) {
      interactionStore.startDrag(instanceId, [0, 0, 0]);
      return;
    }
    interactionStore.endDrag();
    void componentId;
  },
  
  // 设置吸附目标
  setSnapTarget: (target) => {
    useInteractionStore.getState().setDragSnapTarget(target);
  },
  
  // 选择组件
  selectComponent: (instanceId) => {
    useInteractionStore.getState().selectComponent(instanceId);
  },
  
  // 取消选择组件
  deselectComponent: (instanceId) => {
    useInteractionStore.getState().deselectComponent(instanceId);
  },
  
  // 切换选择状态
  toggleSelectComponent: (instanceId) => {
    useInteractionStore.getState().toggleSelectComponent(instanceId);
  },
  
  // 全选
  selectAll: () => {
    useInteractionStore.getState().selectComponents(get().components.map(c => c.instanceId));
  },
  
  // 清空选择
  clearSelection: () => {
    useInteractionStore.getState().clearSelection();
  },
  
  // 选择多个组件
  selectComponents: (instanceIds) => {
    useInteractionStore.getState().selectComponents(instanceIds);
  },
  
  // 设置编辑器状态
  setEditorState: (updates) => {
    const { editor } = get();
    set({ editor: { ...editor, ...updates } });
  },
  
  // 复制选中组件
  copySelected: (instanceIds = []) => {
    const { components } = get();
    const selectedComponents = components.filter(c =>
      instanceIds.includes(c.instanceId)
    );
    set({ clipboard: selectedComponents });
  },
  
  // 粘贴
  paste: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    
    // 创建新组件实例
    const newComponents = clipboard.map(comp => ({
      ...comp,
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: [
        comp.position[0] + 20,
        comp.position[1],
        comp.position[2] + 20,
      ] as [number, number, number],
    }));
    
    get().commitComponentsPaste(newComponents);
    useInteractionStore.getState().selectComponents(newComponents.map(c => c.instanceId));
  },
  
  // 复制选中组件
  duplicateSelected: (instanceIds = []) => {
    get().copySelected(instanceIds);
    get().paste();
  },
  
  // 撤销
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    const snapshot = history[newIndex];
    
    set({
      components: snapshot.components,
      connections: snapshot.connections,
      topologyAudit: auditTopology({
        components: snapshot.components,
        connections: snapshot.connections,
      }),
      beginnerDemo: cloneBeginnerDemoState(snapshot.beginnerDemo),
      constructionWizard: constructionWizardSystem.cloneSession(snapshot.constructionWizard),
      historyIndex: newIndex,
    });
    useInteractionStore
      .getState()
      .reconcileDocumentComponents(snapshot.components, snapshot.connections);
  },
  
  // 重做
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const snapshot = history[newIndex];
    
    set({
      components: snapshot.components,
      connections: snapshot.connections,
      topologyAudit: auditTopology({
        components: snapshot.components,
        connections: snapshot.connections,
      }),
      beginnerDemo: cloneBeginnerDemoState(snapshot.beginnerDemo),
      constructionWizard: constructionWizardSystem.cloneSession(snapshot.constructionWizard),
      historyIndex: newIndex,
    });
    useInteractionStore
      .getState()
      .reconcileDocumentComponents(snapshot.components, snapshot.connections);
  },
  
  // 保存到历史
  saveToHistory: () => {
    const { components, connections, beginnerDemo, constructionWizard, history, historyIndex, maxHistorySize } = get();
    
    // 创建快照
    const snapshot = cloneSnapshot(components, connections, beginnerDemo, constructionWizard);
    
    // 截断后续历史（如果有新的操作）
    const newHistory = history.slice(0, historyIndex + 1);
    if (newHistory.length === 0 && (components.length > 0 || connections.length > 0)) {
      newHistory.push(cloneSnapshot([], [], createInitialBeginnerDemoState(), createInitialConstructionWizardState()));
    }
    newHistory.push(snapshot);
    
    // 限制历史大小
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },
  
  // 清空历史
  clearHistory: () => {
    set({ history: [], historyIndex: -1 });
  },
  
  // 设置材料库存
  setInventory: (inventory) => set({ inventory }),
  
  // 更新库存项
  updateInventoryItem: (componentId, quantity) => {
    const { inventory } = get();
    set({
      inventory: {
        ...inventory,
        [componentId]: {
          ...inventory[componentId],
          quantity,
        },
      },
    });
  },
  
  // 计算材料需求
  calculateMaterials: () => {
    const { components, inventory } = get();
    const requirement: MaterialRequirement = {};
    
    // 统计各组件数量
    components.forEach(component => {
      if (!requirement[component.componentId]) {
        requirement[component.componentId] = {
          required: 0,
          available: inventory[component.componentId]?.quantity || 0,
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
  },

  loadBeginnerDemoStarter: () => {
    const demo = beginnerDemoSystem.createStarterDesign();
    const gridSize = beginnerDemoSystem.getDimensionSpec().gridCm;
    const { inventory } = get();
    set({
      currentDesign: null,
      components: demo.components,
      connections: demo.connections,
      inventory,
      editor: {
        ...initialEditorState,
        gridSize,
        showGrid: true,
        showConnections: true,
      },
      history: [],
      historyIndex: -1,
      clipboard: [],
      isLoading: false,
      error: null,
      topologyAudit: auditTopology({ components: demo.components, connections: demo.connections }),
      beginnerDemo: {
        active: true,
        sessionId: createBeginnerDemoSessionId('starter'),
        loadedSample: 'starter',
        endpointGrowthPracticed: false,
        lastPracticeAt: null,
        scopeComponentIds: demo.components.map((component) => component.instanceId),
        scopeConnectionIds: demo.connections.map((connection) => connection.id),
        practiceComponentIds: [],
        practiceConnectionIds: [],
      },
      constructionWizard: createInitialConstructionWizardState(),
    });
    useInteractionStore.getState().selectComponents(demo.selectInstanceId ? [demo.selectInstanceId] : []);
    get().saveToHistory();
    return demo;
  },

  loadBeginnerDemoTarget: () => {
    const demo = beginnerDemoSystem.createTargetDesign();
    const gridSize = beginnerDemoSystem.getDimensionSpec().gridCm;
    const { inventory } = get();
    set({
      currentDesign: null,
      components: demo.components,
      connections: demo.connections,
      inventory,
      editor: {
        ...initialEditorState,
        gridSize,
        showGrid: true,
        showConnections: true,
      },
      history: [],
      historyIndex: -1,
      clipboard: [],
      isLoading: false,
      error: null,
      topologyAudit: auditTopology({ components: demo.components, connections: demo.connections }),
      beginnerDemo: {
        active: true,
        sessionId: createBeginnerDemoSessionId('target'),
        loadedSample: 'target',
        endpointGrowthPracticed: false,
        lastPracticeAt: null,
        scopeComponentIds: demo.components.map((component) => component.instanceId),
        scopeConnectionIds: demo.connections.map((connection) => connection.id),
        practiceComponentIds: [],
        practiceConnectionIds: [],
      },
      constructionWizard: createInitialConstructionWizardState(),
    });
    useInteractionStore.getState().selectComponents(demo.selectInstanceId ? [demo.selectInstanceId] : []);
    get().saveToHistory();
    return demo;
  },

  recordBeginnerDemoEndpointGrowthPractice: (placement) => {
    const { beginnerDemo } = get();
    if (!beginnerDemo.active || !placement) return;

    const nextBeginnerDemo = applyBeginnerDemoPracticePlacement(
      beginnerDemo,
      placement.components,
      placement.connections
    );

    set({
      beginnerDemo: nextBeginnerDemo,
    });
  },

  clearBeginnerDemoPractice: () => {
    const { beginnerDemo } = get();
    set({
      beginnerDemo: {
        ...beginnerDemo,
        endpointGrowthPracticed: false,
        lastPracticeAt: null,
        practiceComponentIds: [],
        practiceConnectionIds: [],
      },
    });
  },

  startConstructionWizard: (goalId = 'basic-platform-frame') => {
    const session = constructionWizardSystem.createSession(goalId);
    const gridSize = constructionWizardSystem.getDimensionSpec().gridCm;
    const { editor } = get();

    set({
      constructionWizard: session,
      editor: {
        ...editor,
        gridSize,
        showGrid: true,
        showConnections: false,
      },
    });
    const state = get();
    if (state.historyIndex >= 0) {
      const history = [...state.history];
      history[state.historyIndex] = cloneSnapshot(
        state.components,
        state.connections,
        state.beginnerDemo,
        state.constructionWizard
      );
      set({ history });
    } else {
      set({
        history: [cloneSnapshot(
          state.components,
          state.connections,
          state.beginnerDemo,
          state.constructionWizard
        )],
        historyIndex: 0,
      });
    }
    return session;
  },

  stopConstructionWizard: () => {
    if (!get().constructionWizard.active) return;
    set({ constructionWizard: createInitialConstructionWizardState() });
    const state = get();
    if (state.historyIndex >= 0) {
      const history = [...state.history];
      history[state.historyIndex] = cloneSnapshot(
        state.components,
        state.connections,
        state.beginnerDemo,
        state.constructionWizard
      );
      set({ history });
    }
  },

  selectConstructionWizardCandidate: (candidateId) => {
    const { constructionWizard } = get();
    set({
      constructionWizard: {
        ...constructionWizard,
        selectedCandidateId: candidateId,
      },
    });
  },

  setConstructionWizardLayer: (layer) => {
    const { constructionWizard } = get();
    set({
      constructionWizard: {
        ...constructionWizard,
        currentLayer: layer,
      },
    });
  },

  commitConstructionWizardCandidate: (candidate) => {
    const moduleRecord = constructionWizardSystem.createModuleRecord(candidate);
    if (candidate.topologyPatch) {
      get().commitTopologyPatch(candidate.topologyPatch, {
        constructionWizardModule: moduleRecord,
      });
      return;
    }
    get().commitComponentsPlacement(
      candidate.commitComponents,
      candidate.commitConnections,
      { constructionWizardModule: moduleRecord }
    );
  },
  
  // 设置加载状态
  setLoading: (loading) => set({ isLoading: loading }),
  
  // 设置错误
  setError: (error) => set({ error }),
  
  // 重置状态
  reset: () => {
    set({
      currentDesign: null,
      components: [],
      connections: [],
      inventory: {},
      editor: initialEditorState,
      history: [],
      historyIndex: -1,
      clipboard: [],
      isLoading: false,
      error: null,
      topologyAudit: createEmptyTopologyAudit(),
      beginnerDemo: createInitialBeginnerDemoState(),
      constructionWizard: createInitialConstructionWizardState(),
    });
    useInteractionStore.getState().reset();
  },
}));

export default useDesignStore;
