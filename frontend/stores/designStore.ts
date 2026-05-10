import { create } from 'zustand';
import type { ComponentInstance, Connection, Design, EditorState, MaterialInventory, MaterialRequirement } from '../types';

// 历史记录快照
interface HistorySnapshot {
  components: ComponentInstance[];
  connections: Connection[];
  timestamp: number;
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
  
  // 拖拽状态
  isDragging: boolean;
  dragComponentId: string | null;
  dragInstanceId: string | null;
  snapTarget: { instanceId: string; pointId: string; position: [number, number, number] } | null;
  
  // 剪贴板
  clipboard: ComponentInstance[];
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentDesign: (design: Design | null) => void;
  
  // 组件操作
  addComponent: (component: ComponentInstance) => void;
  removeComponent: (instanceId: string) => void;
  updateComponent: (instanceId: string, updates: Partial<ComponentInstance>) => void;
  moveComponent: (instanceId: string, position: [number, number, number]) => void;
  rotateComponent: (instanceId: string, rotation: [number, number, number]) => void;
  batchUpdateComponents: (updates: { instanceId: string; changes: Partial<ComponentInstance> }[]) => void;
  
  // 连接操作
  addConnection: (connection: Connection) => void;
  removeConnection: (connectionId: string) => void;
  removeConnectionsByComponent: (instanceId: string) => void;
  
  // 拖拽操作
  setDragging: (isDragging: boolean, instanceId?: string, componentId?: string) => void;
  setSnapTarget: (target: { instanceId: string; pointId: string; position: [number, number, number] } | null) => void;
  
  // 选择操作
  selectComponent: (instanceId: string) => void;
  deselectComponent: (instanceId: string) => void;
  toggleSelectComponent: (instanceId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectComponents: (instanceIds: string[]) => void;
  
  // 编辑器状态
  setEditorState: (updates: Partial<EditorState>) => void;
  
  // 剪贴板操作
  copySelected: () => void;
  paste: () => void;
  duplicateSelected: () => void;
  
  // 历史操作
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearHistory: () => void;
  
  // 材料库存
  setInventory: (inventory: MaterialInventory) => void;
  updateInventoryItem: (componentId: string, quantity: number) => void;
  calculateMaterials: () => MaterialRequirement;
  
  // 加载状态
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 重置
  reset: () => void;
}

// 初始编辑器状态
const initialEditorState: EditorState = {
  selectedComponents: [],
  hoveredComponent: null,
  activeTool: 'select',
  viewMode: 'realistic',
  showGrid: true,
  showConnections: true,
  gridSize: 10,
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
  isDragging: false,
  dragComponentId: null,
  dragInstanceId: null,
  snapTarget: null,
  clipboard: [],
  isLoading: false,
  error: null,
  
  // 设置当前设计
  setCurrentDesign: (design) => set({ currentDesign: design }),
  
  // 添加组件
  addComponent: (component) => {
    const { components } = get();
    set({ components: [...components, component] });
    get().saveToHistory();
  },
  
  // 移除组件
  removeComponent: (instanceId) => {
    const { components, connections } = get();
    
    // 移除组件
    const newComponents = components.filter(c => c.instanceId !== instanceId);
    
    // 移除相关连接
    const newConnections = connections.filter(
      c => c.source.componentId !== instanceId && c.target.componentId !== instanceId
    );
    
    // 从选中列表中移除
    const newSelected = get().editor.selectedComponents.filter(id => id !== instanceId);
    
    set({
      components: newComponents,
      connections: newConnections,
      editor: {
        ...get().editor,
        selectedComponents: newSelected,
      },
    });
    
    get().saveToHistory();
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
    const exists = connections.some(
      c => c.source.componentId === connection.source.componentId &&
           c.source.pointId === connection.source.pointId &&
           c.target.componentId === connection.target.componentId &&
           c.target.pointId === connection.target.pointId
    );
    
    if (!exists) {
      set({ connections: [...connections, connection] });
      get().saveToHistory();
    }
  },
  
  // 移除连接
  removeConnection: (connectionId) => {
    const { connections } = get();
    set({ connections: connections.filter(c => c.id !== connectionId) });
    get().saveToHistory();
  },
  
  // 移除组件的所有连接
  removeConnectionsByComponent: (instanceId) => {
    const { connections } = get();
    set({
      connections: connections.filter(
        c => c.source.componentId !== instanceId && c.target.componentId !== instanceId
      ),
    });
  },
  
  // 设置拖拽状态
  setDragging: (isDragging, instanceId, componentId) => {
    set({
      isDragging,
      dragInstanceId: instanceId || null,
      dragComponentId: componentId || null,
      snapTarget: null,
    });
  },
  
  // 设置吸附目标
  setSnapTarget: (target) => {
    set({ snapTarget: target });
  },
  
  // 选择组件
  selectComponent: (instanceId) => {
    const { editor } = get();
    if (!editor.selectedComponents.includes(instanceId)) {
      set({
        editor: {
          ...editor,
          selectedComponents: [...editor.selectedComponents, instanceId],
        },
      });
    }
  },
  
  // 取消选择组件
  deselectComponent: (instanceId) => {
    const { editor } = get();
    set({
      editor: {
        ...editor,
        selectedComponents: editor.selectedComponents.filter(id => id !== instanceId),
      },
    });
  },
  
  // 切换选择状态
  toggleSelectComponent: (instanceId) => {
    const { editor } = get();
    if (editor.selectedComponents.includes(instanceId)) {
      get().deselectComponent(instanceId);
    } else {
      get().selectComponent(instanceId);
    }
  },
  
  // 全选
  selectAll: () => {
    const { components, editor } = get();
    set({
      editor: {
        ...editor,
        selectedComponents: components.map(c => c.instanceId),
      },
    });
  },
  
  // 清空选择
  clearSelection: () => {
    const { editor } = get();
    set({
      editor: {
        ...editor,
        selectedComponents: [],
      },
    });
  },
  
  // 选择多个组件
  selectComponents: (instanceIds) => {
    const { editor } = get();
    set({
      editor: {
        ...editor,
        selectedComponents: instanceIds,
      },
    });
  },
  
  // 设置编辑器状态
  setEditorState: (updates) => {
    const { editor } = get();
    set({ editor: { ...editor, ...updates } });
  },
  
  // 复制选中组件
  copySelected: () => {
    const { components, editor } = get();
    const selectedComponents = components.filter(c =>
      editor.selectedComponents.includes(c.instanceId)
    );
    set({ clipboard: selectedComponents });
  },
  
  // 粘贴
  paste: () => {
    const { clipboard, components } = get();
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
    
    // 添加到组件列表
    set({
      components: [...components, ...newComponents],
      // 选中新粘贴的组件
      editor: {
        ...get().editor,
        selectedComponents: newComponents.map(c => c.instanceId),
      },
    });
    
    get().saveToHistory();
  },
  
  // 复制选中组件
  duplicateSelected: () => {
    get().copySelected();
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
      historyIndex: newIndex,
    });
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
      historyIndex: newIndex,
    });
  },
  
  // 保存到历史
  saveToHistory: () => {
    const { components, connections, history, historyIndex, maxHistorySize } = get();
    
    // 创建快照
    const snapshot: HistorySnapshot = {
      components: JSON.parse(JSON.stringify(components)),
      connections: JSON.parse(JSON.stringify(connections)),
      timestamp: Date.now(),
    };
    
    // 截断后续历史（如果有新的操作）
    const newHistory = history.slice(0, historyIndex + 1);
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
  
  // 设置加载状态
  setLoading: (loading) => set({ isLoading: loading }),
  
  // 设置错误
  setError: (error) => set({ error }),
  
  // 重置状态
  reset: () => set({
    currentDesign: null,
    components: [],
    connections: [],
    inventory: {},
    editor: initialEditorState,
    history: [],
    historyIndex: -1,
    isDragging: false,
    dragComponentId: null,
    dragInstanceId: null,
    snapTarget: null,
    clipboard: [],
    isLoading: false,
    error: null,
  }),
}));

export default useDesignStore;
