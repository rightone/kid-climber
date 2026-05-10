// 组件类型定义

// 连接点类型
export interface ConnectionPoint {
  id: string;
  position: [number, number, number]; // 相对位置（厘米）
  direction: [number, number, number]; // 连接方向向量
  type: 'socket' | 'plug'; // 连接类型
  compatible: string[]; // 可兼容的连接类型
}

// 组件定义
export interface ComponentDefinition {
  id: string; // 组件唯一标识
  name: string; // 显示名称
  type: 'pipe' | 'elbow' | 'tee' | 'cross' | 'platform' | 'swing' | 'slide' | 'rope_ladder';
  category: 'basic' | 'connector' | 'platform' | 'accessory';
  length?: number; // 长度（厘米）
  diameter?: number; // 直径（厘米）
  angle?: number; // 角度（度）
  width?: number; // 宽度（厘米）
  height?: number; // 高度（厘米）
  modelPath: string; // 3D模型文件路径
  thumbnailPath: string; // 缩略图路径
  connectionPoints: ConnectionPoint[]; // 连接点定义
  properties?: Record<string, any>; // 其他属性
}

// 组件颜色
export type ComponentColor = 'red' | 'blue' | 'green' | 'yellow' | 'black';

// 颜色配置
export const COMPONENT_COLORS: Record<ComponentColor, { name: string; hex: string }> = {
  red: { name: '红色', hex: '#ff4d4f' },
  blue: { name: '蓝色', hex: '#1890ff' },
  green: { name: '绿色', hex: '#52c41a' },
  yellow: { name: '黄色', hex: '#faad14' },
  black: { name: '黑色', hex: '#333333' },
};

// 组件实例（设计中的具体组件）
export interface ComponentInstance {
  instanceId: string; // 实例ID
  componentId: string; // 关联的组件定义ID
  name?: string; // 实例名称
  position: [number, number, number]; // 位置坐标（厘米）
  rotation: [number, number, number]; // 旋转角度（度）
  scale: [number, number, number]; // 缩放比例
  color?: ComponentColor; // 颜色
  properties?: Record<string, any>; // 实例特定属性
}

// 连接关系
export interface Connection {
  id: string;
  source: {
    componentId: string; // 源组件实例ID
    pointId: string; // 源连接点ID
  };
  target: {
    componentId: string; // 目标组件实例ID
    pointId: string; // 目标连接点ID
  };
  type: string; // 连接类型
  isActive: boolean; // 连接是否有效
}

// 设计文件
export interface Design {
  id?: number;
  name: string;
  description?: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  components: ComponentInstance[];
  connections: Connection[];
  materials: MaterialRequirement;
  settings: DesignSettings;
  createdAt?: string;
  updatedAt?: string;
}

// 材料需求
export interface MaterialRequirement {
  [componentId: string]: {
    required: number; // 需要数量
    available: number; // 已有数量
    shortage: number; // 短缺数量
  };
}

// 设计设置
export interface DesignSettings {
  gridSize: number; // 网格大小（厘米）
  snapToGrid: boolean; // 吸附到网格
  showConnections: boolean; // 显示连接
  viewMode: 'realistic' | 'wireframe' | 'xray' | 'blackwhite'; // 视图模式
}

// 用户材料库存
export interface MaterialInventory {
  [componentId: string]: {
    quantity: number; // 已有数量
    purchasePrice?: number; // 购买单价
    purchaseDate?: string; // 购买日期
    notes?: string; // 备注
  };
}

// 材料清单项
export interface MaterialListItem {
  componentId: string;
  componentName: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

// 材料清单
export interface MaterialList {
  id?: number;
  designId: number;
  listType: 'required' | 'purchased' | 'shortage';
  items: MaterialListItem[];
  totalItems: number;
  totalCost: number;
  generatedAt: string;
  notes?: string;
}

// 视图状态
export interface ViewState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
  rotation: [number, number, number];
}

// 编辑器状态
export interface EditorState {
  selectedComponents: string[]; // 选中的组件实例ID列表
  hoveredComponent: string | null; // 悬停的组件实例ID
  activeTool: 'select' | 'move' | 'rotate' | 'measure'; // 当前活动工具
  viewMode: 'realistic' | 'wireframe' | 'xray' | 'blackwhite'; // 视图模式
  showGrid: boolean; // 显示网格
  showConnections: boolean; // 显示连接点
  gridSize: number; // 网格大小
}

// 操作历史
export interface HistoryAction {
  type: 'add' | 'remove' | 'move' | 'rotate' | 'connect' | 'disconnect';
  timestamp: number;
  data: any;
}

// 应用配置
export interface AppConfig {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark';
  autoSave: boolean;
  autoSaveInterval: number; // 分钟
  recentFiles: string[];
}
