import { create } from 'zustand';

// 交互模式
export type InteractionMode = 
  | 'select'      // 选择模式
  | 'place'       // 放置模式
  | 'move'        // 移动模式
  | 'rotate'      // 旋转模式
  | 'connect';    // 连接模式

// 放置状态
export interface PlaceState {
  componentId: string | null;  // 要放置的组件ID
  previewPosition: [number, number, number] | null;  // 预览位置
  isValid: boolean;  // 是否可以放置
}

// 交互状态
export interface InteractionState {
  mode: InteractionMode;
  placeState: PlaceState;
  isDragging: boolean;
  dragTarget: string | null;
  dragOffset: [number, number, number];
  showPreview: boolean;
  snapToGrid: boolean;
  snapToComponent: boolean;
  gridSize: number;
}

// 交互状态管理
interface InteractionStore {
  interaction: InteractionState;
  
  // 模式切换
  setMode: (mode: InteractionMode) => void;
  
  // 放置操作
  startPlace: (componentId: string) => void;
  updatePlacePreview: (position: [number, number, number]) => void;
  confirmPlace: () => void;
  cancelPlace: () => void;
  
  // 拖拽操作
  startDrag: (targetId: string, offset: [number, number, number]) => void;
  updateDrag: (position: [number, number, number]) => void;
  endDrag: () => void;
  
  // 设置
  setSnapToGrid: (snap: boolean) => void;
  setSnapToComponent: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  setShowPreview: (show: boolean) => void;
  
  // 重置
  reset: () => void;
}

const initialState: InteractionState = {
  mode: 'select',
  placeState: {
    componentId: null,
    previewPosition: null,
    isValid: false,
  },
  isDragging: false,
  dragTarget: null,
  dragOffset: [0, 0, 0],
  showPreview: true,
  snapToGrid: true,
  snapToComponent: true,
  gridSize: 20,  // 默认网格大小：20cm
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
        ...interaction,
        mode,
      },
    });
  },
  
  // 开始放置
  startPlace: (componentId) => {
    set({
      interaction: {
        ...get().interaction,
        mode: 'place',
        placeState: {
          componentId,
          previewPosition: null,
          isValid: false,
        },
        showPreview: true,
      },
    });
  },
  
  // 更新放置预览
  updatePlacePreview: (position) => {
    const { interaction } = get();
    
    // 对齐到网格
    let snappedPosition = position;
    if (interaction.snapToGrid) {
      const gridSize = interaction.gridSize;
      snappedPosition = [
        Math.round(position[0] / gridSize) * gridSize,
        position[1],
        Math.round(position[2] / gridSize) * gridSize,
      ];
    }
    
    set({
      interaction: {
        ...interaction,
        placeState: {
          ...interaction.placeState,
          previewPosition: snappedPosition,
          isValid: true,
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
          isValid: false,
        },
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
          isValid: false,
        },
        showPreview: false,
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
      },
    });
  },
  
  // 更新拖拽
  updateDrag: (position) => {
    const { interaction } = get();
    
    if (!interaction.isDragging || !interaction.dragTarget) {
      return;
    }
    
    // 对齐到网格
    let snappedPosition = position;
    if (interaction.snapToGrid) {
      const gridSize = interaction.gridSize;
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
    
    return {
      targetId: interaction.dragTarget,
      position: newPosition,
    };
  },
  
  // 结束拖拽
  endDrag: () => {
    set({
      interaction: {
        ...get().interaction,
        isDragging: false,
        dragTarget: null,
        dragOffset: [0, 0, 0],
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
    set({
      interaction: {
        ...get().interaction,
        gridSize: size,
      },
    });
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
  
  // 重置
  reset: () => {
    set({ interaction: initialState });
  },
}));

export default useInteractionStore;
