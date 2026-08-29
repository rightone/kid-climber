import { create } from 'zustand';
import type {
  BuildCandidateFamily,
  GrowthPipeComponentId,
  GrowthSiteSelection,
} from '../systems/EndpointGrowthSystem';
import {
  endpointGrowthSystem,
  predictionSiteKey,
} from '../systems/EndpointGrowthSystem';
import type { BoardMountSite } from '../systems/BoardMountSystem';
import type { CurvedTubeMountSite } from '../systems/CurvedTubeMountSystem';
import type { RampMountSite } from '../systems/RampMountSystem';
import type { StructureRecipe } from '../systems/AdvancedStructureSystem';
import type { RecipeMountSite } from '../systems/StructureMountSystem';
import type { VirtualConnectorPort } from '../systems/ConnectorTopologySystem';
import type { ConstructionSuggestion } from '../systems/ConstructionEngine';
import type { ComponentInstance, Connection } from '../types';
import type { ActiveBuildTask } from '../systems/BuildTaskSystem';

// 交互模式
export type InteractionMode = 
  | 'select'      // 选择模式
  | 'place'       // 放置模式
  | 'move'        // 移动模式
  | 'rotate'      // 旋转模式
  | 'connect';    // 连接模式

export type ActiveTool = 'select' | 'move' | 'rotate' | 'measure';

// 放置状态
export interface PlaceState {
  componentId: string | null;  // 要放置的组件ID
  previewPosition: [number, number, number] | null;  // 预览位置
  previewRotation: [number, number, number];  // 预览旋转
  isValid: boolean;  // 是否可以放置
  snapType: 'connection' | 'alignment' | 'grid' | 'free' | null;
  snapTarget: { instanceId: string; pointId: string; position: [number, number, number] } | null;
  topologyTarget: VirtualConnectorPort | null;
  connectorTarget: ConstructionSuggestion['connectorTarget'] | null;
  boardMountSite: BoardMountSite | null;
  curvedTubeMountSite: CurvedTubeMountSite | null;
  rampMountSite: RampMountSite | null;
  curvedTubeFlip: boolean;
  snapSourcePointId: string | null;
  snapConfidence: number;
  message: string;
}

export interface GrowthState {
  selectedEndpoint: GrowthSiteSelection | null;
  pipeComponentId: GrowthPipeComponentId;
  candidateFamily: BuildCandidateFamily;
  hoveredCandidate: {
    id: string;
    message: string;
    connectorInstanceId?: string;
  } | null;
}

export interface DragState {
  previewPosition: [number, number, number] | null;
  snappedPosition: [number, number, number] | null;
  snapTarget: { instanceId: string; pointId: string; position: [number, number, number] } | null;
  topologyTarget: VirtualConnectorPort | null;
  connectorTarget: ConstructionSuggestion['connectorTarget'] | null;
  boardMountSite: BoardMountSite | null;
  curvedTubeMountSite: CurvedTubeMountSite | null;
  rampMountSite: RampMountSite | null;
  snapType: 'connection' | 'alignment' | 'grid' | 'free' | null;
  snapConfidence: number;
  message: string;
}

export interface TemplatePlacementState {
  templateId: string;
  templateName: string;
  components: ComponentInstance[];
  connections: Connection[];
  origin: [number, number, number];
  rotationY: 0 | 90 | 180 | 270;
  structureRecipe?: StructureRecipe;
  structureMountSite?: RecipeMountSite | null;
  replaceAssembly?: {
    componentIds: string[];
    connectionIds: string[];
  };
}

export type EditorContextMenu =
  | {
      kind: 'pipe-color';
      instanceId: string;
      clientX: number;
      clientY: number;
    }
  | {
      kind: 'board-appearance';
      instanceId: string;
      clientX: number;
      clientY: number;
    }
  | null;

// 交互状态
export interface InteractionState {
  mode: InteractionMode;
  activeTool: ActiveTool;
  selectedComponents: string[];
  hoveredComponent: string | null;
  placeState: PlaceState;
  growthState: GrowthState;
  isDragging: boolean;
  dragTarget: string | null;
  dragOffset: [number, number, number];
  dragState: DragState;
  templatePlacement: TemplatePlacementState | null;
  showPreview: boolean;
  snapToGrid: boolean;
  snapToComponent: boolean;
  showVerticalGrid: boolean;
  showAvailablePositions: boolean;
  autoConnect: boolean;
  contextMenu: EditorContextMenu;
  activeBuildTask: ActiveBuildTask | null;
  assemblyEditGroupId: string | null;
}

// 交互状态管理
interface InteractionStore {
  interaction: InteractionState;
  
  // 模式切换
  setMode: (mode: InteractionMode) => void;
  setActiveTool: (tool: ActiveTool) => void;

  // 选择和悬停
  selectComponent: (instanceId: string) => void;
  deselectComponent: (instanceId: string) => void;
  toggleSelectComponent: (instanceId: string) => void;
  selectComponents: (instanceIds: string[]) => void;
  clearSelection: () => void;
  setHoveredComponent: (instanceId: string | null) => void;
  openPipeColorMenu: (instanceId: string, clientX: number, clientY: number) => void;
  openBoardAppearanceMenu: (instanceId: string, clientX: number, clientY: number) => void;
  closeContextMenu: () => void;
  
  // 放置操作
  startPlace: (
    componentId: string,
    initialRotation?: [number, number, number]
  ) => void;
  updatePlacePreview: (preview: {
    position: [number, number, number];
    rotation?: [number, number, number];
    isValid?: boolean;
    snapType?: PlaceState['snapType'];
    snapTarget?: PlaceState['snapTarget'];
    topologyTarget?: PlaceState['topologyTarget'];
    connectorTarget?: PlaceState['connectorTarget'];
    boardMountSite?: PlaceState['boardMountSite'];
    curvedTubeMountSite?: PlaceState['curvedTubeMountSite'];
    rampMountSite?: PlaceState['rampMountSite'];
    snapSourcePointId?: string | null;
    snapConfidence?: number;
    message?: string;
  }) => void;
  confirmPlace: () => void;
  cancelPlace: () => void;
  startTemplatePlacement: (placement: Omit<TemplatePlacementState, 'origin' | 'rotationY'>) => void;
  updateTemplatePlacementOrigin: (origin: [number, number, number]) => void;
  rotateTemplatePlacement: () => void;
  setTemplateStructureMountSite: (site: RecipeMountSite | null) => void;
  cancelTemplatePlacement: () => void;
  startBuildTask: (task: ActiveBuildTask) => void;
  setBuildTaskSiteIndex: (index: number) => void;
  cycleBuildTaskSite: (direction: -1 | 1) => void;
  finishBuildTask: () => void;
  setAssemblyEditGroupId: (groupId: string | null) => void;

  // 端点生长
  selectGrowthEndpoint: (endpoint: GrowthState['selectedEndpoint']) => void;
  clearGrowthEndpoint: () => void;
  setGrowthPipeComponent: (componentId: GrowthPipeComponentId) => void;
  setGrowthCandidateFamily: (family: BuildCandidateFamily) => void;
  setHoveredGrowthCandidate: (candidate: GrowthState['hoveredCandidate']) => void;
  
  // 拖拽操作
  startDrag: (targetId: string, offset: [number, number, number]) => void;
  updateDrag: (
    position: [number, number, number],
    options?: { gridSize?: number }
  ) => { targetId: string; position: [number, number, number] } | null;
  updateDragPreview: (preview: {
    position: [number, number, number];
    snapTarget?: DragState['snapTarget'];
    topologyTarget?: DragState['topologyTarget'];
    connectorTarget?: DragState['connectorTarget'];
    boardMountSite?: DragState['boardMountSite'];
    curvedTubeMountSite?: DragState['curvedTubeMountSite'];
    rampMountSite?: DragState['rampMountSite'];
    snapType?: DragState['snapType'];
    snapConfidence?: number;
    message?: string;
  }) => void;
  setDragSnapTarget: (target: DragState['snapTarget']) => void;
  endDrag: () => void;
  
  // 设置
  setSnapToGrid: (snap: boolean) => void;
  setSnapToComponent: (snap: boolean) => void;
  /** @deprecated Grid size is durable editor state in designStore.editor.gridSize. */
  setGridSize: (size: number) => void;
  setShowPreview: (show: boolean) => void;
  /** @deprecated Grid visibility is durable editor state in designStore.editor.showGrid. */
  setShowGrid: (show: boolean) => void;
  setShowVerticalGrid: (show: boolean) => void;
  /** @deprecated Connection visibility is durable editor state in designStore.editor.showConnections. */
  setShowConnections: (show: boolean) => void;
  setShowAvailablePositions: (show: boolean) => void;
  setAutoConnect: (auto: boolean) => void;

  // 文档切换/变更后的会话协调
  resetDocumentSession: () => void;
  reconcileDocumentComponents: (
    components: ComponentInstance[],
    connections: Connection[]
  ) => void;
  
  // 重置
  reset: () => void;
}

const initialState: InteractionState = {
  mode: 'select',
  activeTool: 'select',
  selectedComponents: [],
  hoveredComponent: null,
  placeState: {
    componentId: null,
    previewPosition: null,
    previewRotation: [0, 0, 0],
    isValid: false,
    snapType: null,
    snapTarget: null,
    topologyTarget: null,
    connectorTarget: null,
    boardMountSite: null,
    curvedTubeMountSite: null,
    rampMountSite: null,
    curvedTubeFlip: false,
    snapSourcePointId: null,
    snapConfidence: 0,
    message: '',
  },
  growthState: {
    selectedEndpoint: null,
    pipeComponentId: 'pipe_35cm',
    candidateFamily: 'straight',
    hoveredCandidate: null,
  },
  isDragging: false,
  dragTarget: null,
  dragOffset: [0, 0, 0],
  dragState: {
    previewPosition: null,
    snappedPosition: null,
    snapTarget: null,
    topologyTarget: null,
    connectorTarget: null,
    boardMountSite: null,
    curvedTubeMountSite: null,
    rampMountSite: null,
    snapType: null,
    snapConfidence: 0,
    message: '',
  },
  templatePlacement: null,
  showPreview: true,
  snapToGrid: true,
  snapToComponent: true,
  showVerticalGrid: false,
  showAvailablePositions: true,
  autoConnect: true,
  contextMenu: null,
  activeBuildTask: null,
  assemblyEditGroupId: null,
};

export const useInteractionStore = create<InteractionStore>((set, get) => ({
  interaction: initialState,
  
  // 设置模式
  setMode: (mode) => {
    const { interaction } = get();
    
    // 如果切换模式，取消当前操作
    if (interaction.mode === 'place' && mode !== 'place') {
      get().cancelPlace();
    }
    
    set({
      interaction: {
        ...get().interaction,
        mode,
        contextMenu: null,
        activeTool: mode === 'select' || mode === 'move' || mode === 'rotate'
          ? mode
          : get().interaction.activeTool,
      },
    });
  },

  setActiveTool: (tool) => {
    const nextMode = tool === 'measure' ? 'select' : tool;
    const { interaction } = get();
    if (interaction.mode === 'place') {
      get().cancelPlace();
    }
    if (interaction.isDragging && nextMode !== 'move') {
      get().endDrag();
    }

    set({
      interaction: {
        ...get().interaction,
        activeTool: tool,
        mode: nextMode,
        contextMenu: null,
      },
    });
  },

  selectComponent: (instanceId) => {
    const { interaction } = get();
    if (interaction.selectedComponents.includes(instanceId)) return;
    const selectedComponents = [...interaction.selectedComponents, instanceId];

    set({
      interaction: {
        ...interaction,
        selectedComponents,
      },
    });
  },

  deselectComponent: (instanceId) => {
    const { interaction } = get();
    const selectedComponents = interaction.selectedComponents.filter(
      id => id !== instanceId
    );
    set({
      interaction: {
        ...interaction,
        selectedComponents,
      },
    });
  },

  toggleSelectComponent: (instanceId) => {
    const { interaction } = get();
    const selectedComponents = interaction.selectedComponents.includes(instanceId)
      ? interaction.selectedComponents.filter(id => id !== instanceId)
      : [...interaction.selectedComponents, instanceId];

    set({
      interaction: {
        ...interaction,
        selectedComponents,
      },
    });
  },

  selectComponents: (instanceIds) => {
    const selectedComponents = [...new Set(instanceIds)];
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        selectedComponents,
      },
    });
  },

  clearSelection: () => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        selectedComponents: [],
        contextMenu: null,
      },
    });
  },

  setHoveredComponent: (instanceId) => {
    set({
      interaction: {
        ...get().interaction,
        hoveredComponent: instanceId,
      },
    });
  },

  openPipeColorMenu: (instanceId, clientX, clientY) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        selectedComponents: [instanceId],
        contextMenu: {
          kind: 'pipe-color',
          instanceId,
          clientX,
          clientY,
        },
      },
    });
  },

  openBoardAppearanceMenu: (instanceId, clientX, clientY) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        selectedComponents: [instanceId],
        contextMenu: {
          kind: 'board-appearance',
          instanceId,
          clientX,
          clientY,
        },
      },
    });
  },

  closeContextMenu: () => {
    const { interaction } = get();
    if (!interaction.contextMenu) return;
    set({
      interaction: {
        ...interaction,
        contextMenu: null,
      },
    });
  },
  
  // 开始放置
  startPlace: (componentId, initialRotation = [0, 0, 0]) => {
    set({
      interaction: {
        ...get().interaction,
        mode: 'place',
        placeState: {
          componentId,
          previewPosition: null,
          previewRotation: initialRotation,
          isValid: false,
          snapType: null,
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: null,
          curvedTubeFlip:
            componentId === 'pipe_curve_u_40cm' &&
            Math.abs(initialRotation[1] % 360) === 180,
          snapSourcePointId: null,
          snapConfidence: 0,
          message: '',
        },
        growthState: {
          ...get().interaction.growthState,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
        contextMenu: null,
        templatePlacement: null,
        activeBuildTask: null,
        showPreview: true,
      },
    });
  },
  
  // 更新放置预览
  updatePlacePreview: (preview) => {
    const { interaction } = get();
    
    set({
      interaction: {
        ...interaction,
        placeState: {
          ...interaction.placeState,
          previewPosition: preview.position,
          previewRotation: preview.rotation ?? interaction.placeState.previewRotation,
          isValid: preview.isValid ?? true,
          snapType: preview.snapType ?? null,
          snapTarget: preview.snapTarget ?? null,
          topologyTarget: preview.topologyTarget ?? null,
          connectorTarget: preview.connectorTarget ?? null,
          boardMountSite: preview.boardMountSite ?? null,
          curvedTubeMountSite: preview.curvedTubeMountSite ?? null,
          rampMountSite: preview.rampMountSite ?? null,
          snapSourcePointId: preview.snapSourcePointId ?? null,
          snapConfidence: preview.snapConfidence ?? 0,
          message: preview.message ?? '',
        },
      },
    });
  },
  
  // 确认放置
  confirmPlace: () => {
    const { interaction } = get();
    
    if (!interaction.placeState.componentId || !interaction.placeState.previewPosition) {
      return null;
    }
    
    // 返回放置信息，由外部处理实际添加
    const result = {
      componentId: interaction.placeState.componentId,
      position: interaction.placeState.previewPosition,
    };
    
    // 重置放置状态
    set({
      interaction: {
        ...interaction,
        placeState: {
          componentId: null,
          previewPosition: null,
          previewRotation: [0, 0, 0],
          isValid: false,
          snapType: null,
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: null,
          curvedTubeFlip: false,
          snapSourcePointId: null,
          snapConfidence: 0,
          message: '',
        },
        growthState: {
          ...interaction.growthState,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
        contextMenu: null,
        activeBuildTask: null,
      },
    });
    
    return result;
  },
  
  // 取消放置
  cancelPlace: () => {
    set({
      interaction: {
        ...get().interaction,
        placeState: {
          componentId: null,
          previewPosition: null,
          previewRotation: [0, 0, 0],
          isValid: false,
          snapType: null,
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: null,
          curvedTubeFlip: false,
          snapSourcePointId: null,
          snapConfidence: 0,
          message: '',
        },
        growthState: {
          ...get().interaction.growthState,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
        contextMenu: null,
        templatePlacement: null,
        activeBuildTask: null,
        showPreview: false,
      },
    });
  },

  startTemplatePlacement: (placement) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        mode: 'place',
        activeTool: 'select',
        selectedComponents: [],
        placeState: { ...initialState.placeState },
        growthState: {
          ...interaction.growthState,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
        templatePlacement: {
          ...placement,
          origin: [0, 0, 0],
          rotationY: 0,
        },
        contextMenu: null,
        activeBuildTask: null,
        showPreview: true,
      },
    });
  },

  updateTemplatePlacementOrigin: (origin) => {
    const { interaction } = get();
    if (!interaction.templatePlacement) return;
    set({
      interaction: {
        ...interaction,
        templatePlacement: {
          ...interaction.templatePlacement,
          origin,
        },
      },
    });
  },

  rotateTemplatePlacement: () => {
    const { interaction } = get();
    if (!interaction.templatePlacement) return;
    set({
      interaction: {
        ...interaction,
        templatePlacement: {
          ...interaction.templatePlacement,
          rotationY: ((interaction.templatePlacement.rotationY + 90) % 360) as
            0 | 90 | 180 | 270,
        },
      },
    });
  },

  setTemplateStructureMountSite: (structureMountSite) => {
    const { interaction } = get();
    if (!interaction.templatePlacement?.structureRecipe) return;
    set({
      interaction: {
        ...interaction,
        templatePlacement: {
          ...interaction.templatePlacement,
          structureMountSite,
        },
      },
    });
  },

  cancelTemplatePlacement: () => {
    const { interaction } = get();
    if (!interaction.templatePlacement) return;
    set({
      interaction: {
        ...interaction,
        templatePlacement: null,
        activeBuildTask: null,
        showPreview: false,
      },
    });
  },

  startBuildTask: (task) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        activeBuildTask: {
          ...task,
          installationSiteIds: [...task.installationSiteIds],
          currentSiteIndex: Math.min(
            Math.max(task.currentSiteIndex, 0),
            Math.max(task.installationSiteIds.length - 1, 0)
          ),
        },
        selectedComponents: [],
        contextMenu: null,
        assemblyEditGroupId: null,
      },
    });
  },

  setBuildTaskSiteIndex: (index) => {
    const { interaction } = get();
    const task = interaction.activeBuildTask;
    if (!task || task.installationSiteIds.length === 0) return;
    const normalizedIndex = Math.min(
      Math.max(index, 0),
      task.installationSiteIds.length - 1
    );
    set({
      interaction: {
        ...interaction,
        activeBuildTask: { ...task, currentSiteIndex: normalizedIndex },
      },
    });
  },

  cycleBuildTaskSite: (direction) => {
    const { interaction } = get();
    const task = interaction.activeBuildTask;
    if (!task || task.installationSiteIds.length === 0) return;
    const count = task.installationSiteIds.length;
    const currentSiteIndex = (task.currentSiteIndex + direction + count) % count;
    set({
      interaction: {
        ...interaction,
        activeBuildTask: { ...task, currentSiteIndex },
      },
    });
  },

  finishBuildTask: () => {
    const { interaction } = get();
    if (!interaction.activeBuildTask) return;
    set({
      interaction: {
        ...interaction,
        activeBuildTask: null,
      },
    });
  },

  setAssemblyEditGroupId: (assemblyEditGroupId) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        assemblyEditGroupId,
      },
    });
  },

  selectGrowthEndpoint: (endpoint) => {
    set({
      interaction: {
        ...get().interaction,
        growthState: {
          ...get().interaction.growthState,
          selectedEndpoint: endpoint,
          hoveredCandidate: null,
        },
      },
    });
  },

  clearGrowthEndpoint: () => {
    set({
      interaction: {
        ...get().interaction,
        growthState: {
          ...get().interaction.growthState,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
      },
    });
  },

  setGrowthPipeComponent: (componentId) => {
    set({
      interaction: {
        ...get().interaction,
        growthState: {
          ...get().interaction.growthState,
          pipeComponentId: componentId,
          hoveredCandidate: null,
        },
      },
    });
  },

  setGrowthCandidateFamily: (candidateFamily) => {
    set({
      interaction: {
        ...get().interaction,
        growthState: {
          ...get().interaction.growthState,
          candidateFamily,
          selectedEndpoint: null,
          hoveredCandidate: null,
        },
      },
    });
  },

  setHoveredGrowthCandidate: (candidate) => {
    set({
      interaction: {
        ...get().interaction,
        growthState: {
          ...get().interaction.growthState,
          hoveredCandidate: candidate,
        },
      },
    });
  },
  
  // 开始拖拽
  startDrag: (targetId, offset) => {
    set({
      interaction: {
        ...get().interaction,
        isDragging: true,
        dragTarget: targetId,
        dragOffset: offset,
        dragState: {
          previewPosition: null,
          snappedPosition: null,
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: null,
          snapType: null,
          snapConfidence: 0,
          message: '',
        },
      },
    });
  },
  
  // 更新拖拽
  updateDrag: (position, options = {}) => {
    const { interaction } = get();
    
    if (!interaction.isDragging || !interaction.dragTarget) {
      return null;
    }
    
    // 对齐到网格
    let snappedPosition = position;
    if (interaction.snapToGrid && options.gridSize && options.gridSize > 0) {
      const gridSize = options.gridSize;
      snappedPosition = [
        Math.round(position[0] / gridSize) * gridSize,
        position[1],
        Math.round(position[2] / gridSize) * gridSize,
      ];
    }
    
    // 计算新位置（减去偏移）
    const newPosition: [number, number, number] = [
      snappedPosition[0] - interaction.dragOffset[0],
      snappedPosition[1] - interaction.dragOffset[1],
      snappedPosition[2] - interaction.dragOffset[2],
    ];

    set({
      interaction: {
        ...interaction,
        dragState: {
          ...interaction.dragState,
          previewPosition: newPosition,
          snappedPosition,
          snapType: interaction.snapToGrid && options.gridSize ? 'grid' : 'free',
          snapConfidence: interaction.snapToGrid && options.gridSize ? 0.5 : 0,
          message: '',
        },
      },
    });
    
    return {
      targetId: interaction.dragTarget,
      position: newPosition,
    };
  },

  updateDragPreview: (preview) => {
    const { interaction } = get();
    if (!interaction.isDragging || !interaction.dragTarget) return;

    set({
      interaction: {
        ...interaction,
        dragState: {
          previewPosition: preview.position,
          snappedPosition: preview.position,
          snapTarget: preview.snapTarget ?? null,
          topologyTarget: preview.topologyTarget ?? null,
          connectorTarget: preview.connectorTarget ?? null,
          boardMountSite: preview.boardMountSite ?? null,
          curvedTubeMountSite: preview.curvedTubeMountSite ?? null,
          rampMountSite: preview.rampMountSite ?? null,
          snapType: preview.snapType ?? 'free',
          snapConfidence: preview.snapConfidence ?? 0,
          message: preview.message ?? '',
        },
      },
    });
  },

  setDragSnapTarget: (target) => {
    const { interaction } = get();
    set({
      interaction: {
        ...interaction,
        dragState: {
          ...interaction.dragState,
          snapTarget: target,
          topologyTarget: target ? null : interaction.dragState.topologyTarget,
          connectorTarget: target ? null : interaction.dragState.connectorTarget,
          boardMountSite: target ? null : interaction.dragState.boardMountSite,
          curvedTubeMountSite: target ? null : interaction.dragState.curvedTubeMountSite,
          rampMountSite: target ? null : interaction.dragState.rampMountSite,
          snapType: target ? 'connection' : interaction.dragState.snapType,
          snapConfidence: target ? 1 : interaction.dragState.snapConfidence,
        },
      },
    });
  },
  
  // 结束拖拽
  endDrag: () => {
    set({
      interaction: {
        ...get().interaction,
        isDragging: false,
        dragTarget: null,
        dragOffset: [0, 0, 0],
        dragState: {
          previewPosition: null,
          snappedPosition: null,
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: null,
          snapType: null,
          snapConfidence: 0,
          message: '',
        },
      },
    });
  },
  
  // 设置网格吸附
  setSnapToGrid: (snap) => {
    set({
      interaction: {
        ...get().interaction,
        snapToGrid: snap,
      },
    });
  },
  
  // 设置组件吸附
  setSnapToComponent: (snap) => {
    set({
      interaction: {
        ...get().interaction,
        snapToComponent: snap,
      },
    });
  },
  
  // 设置网格大小
  setGridSize: (size) => {
    void size;
  },
  
  // 设置显示预览
  setShowPreview: (show) => {
    set({
      interaction: {
        ...get().interaction,
        showPreview: show,
      },
    });
  },
  
  // 设置显示网格
  setShowGrid: (show: boolean) => {
    void show;
  },
  
  // 设置显示垂直网格
  setShowVerticalGrid: (show: boolean) => {
    set({
      interaction: {
        ...get().interaction,
        showVerticalGrid: show,
      },
    });
  },
  
  // 设置显示连接
  setShowConnections: (show: boolean) => {
    void show;
  },
  
  // 设置显示可用位置
  setShowAvailablePositions: (show: boolean) => {
    set({
      interaction: {
        ...get().interaction,
        showAvailablePositions: show,
      },
    });
  },
  
  // 设置自动连接
  setAutoConnect: (auto: boolean) => {
    set({
      interaction: {
        ...get().interaction,
        autoConnect: auto,
      },
    });
  },

  resetDocumentSession: () => {
    const { interaction } = get();
    set({
      interaction: {
        ...initialState,
        placeState: { ...initialState.placeState },
        growthState: { ...initialState.growthState },
        dragState: { ...initialState.dragState },
        snapToGrid: interaction.snapToGrid,
        snapToComponent: interaction.snapToComponent,
        showVerticalGrid: interaction.showVerticalGrid,
        showAvailablePositions: interaction.showAvailablePositions,
        autoConnect: interaction.autoConnect,
      },
    });
  },

  reconcileDocumentComponents: (components, connections) => {
    const componentIds = new Set(
      components.map(component => component.instanceId)
    );
    const { interaction } = get();
    const dragTargetIsValid = !interaction.dragTarget || componentIds.has(interaction.dragTarget);
    const predictedSiteIds = new Set(
      endpointGrowthSystem
        .listPredictionSites({
          pipeComponentId: interaction.growthState.pipeComponentId,
          components,
          connections,
        })
        .map(predictionSiteKey)
    );
    const isSelectedEndpointValid = interaction.growthState.selectedEndpoint
      ? predictedSiteIds.has(
          predictionSiteKey(interaction.growthState.selectedEndpoint)
        )
      : true;

    set({
      interaction: {
        ...interaction,
        selectedComponents: interaction.selectedComponents.filter(instanceId =>
          componentIds.has(instanceId)
        ),
        hoveredComponent:
          interaction.hoveredComponent && componentIds.has(interaction.hoveredComponent)
            ? interaction.hoveredComponent
            : null,
        growthState: {
          ...interaction.growthState,
          selectedEndpoint:
            isSelectedEndpointValid ? interaction.growthState.selectedEndpoint : null,
          hoveredCandidate:
            interaction.growthState.hoveredCandidate && isSelectedEndpointValid
              ? interaction.growthState.hoveredCandidate
              : null,
        },
        isDragging: dragTargetIsValid ? interaction.isDragging : false,
        dragTarget: dragTargetIsValid ? interaction.dragTarget : null,
        dragOffset: dragTargetIsValid ? interaction.dragOffset : [0, 0, 0],
        dragState: dragTargetIsValid
          ? interaction.dragState
          : { ...initialState.dragState },
        contextMenu:
          interaction.contextMenu &&
          componentIds.has(interaction.contextMenu.instanceId)
            ? interaction.contextMenu
            : null,
      },
    });
  },
  
  // 重置
  reset: () => {
    set({
      interaction: {
        ...initialState,
        placeState: { ...initialState.placeState },
        growthState: { ...initialState.growthState },
        dragState: { ...initialState.dragState },
      },
    });
  },
}));

export default useInteractionStore;
