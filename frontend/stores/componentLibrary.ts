import type { ComponentDefinition } from '../types';

// 预设组件库 - 根据实际攀爬架规格定义
export const componentDefinitions: ComponentDefinition[] = [
  // ============ 管件 ============
  {
    id: 'pipe_35cm',
    name: '35cm直管',
    type: 'pipe',
    category: 'basic',
    length: 35,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -17.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 17.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'pipe_15cm',
    name: '15cm直管',
    type: 'pipe',
    category: 'basic',
    length: 15,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -7.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 7.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 接头（通） ============
  {
    id: 'connector_straight',
    name: '一字接头（直通）',
    type: 'elbow',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [0, 0, 2.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_L',
    name: 'L型接头（90度）',
    type: 'elbow',
    category: 'connector',
    angle: 90,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_T',
    name: 'T型接头（三通）',
    type: 'tee',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-2.5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_45deg',
    name: '45度接头',
    type: 'elbow',
    category: 'connector',
    angle: 45,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [1.77, 0, 1.77], direction: [0.707, 0, 0.707], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_3way',
    name: '三向接头',
    type: 'tee',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [0, 2.5, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_4way',
    name: '四向接头',
    type: 'cross',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-2.5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output3', position: [0, 0, 2.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_cross',
    name: '十字接头',
    type: 'cross',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input1', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'input2', position: [0, 0, 2.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-2.5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'connector_5way',
    name: '五向接头',
    type: 'cross',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -2.5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [2.5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-2.5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output3', position: [0, 0, 2.5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      { id: 'output4', position: [0, 2.5, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 板子 ============
  {
    id: 'board_40x40',
    name: '40×40cm板',
    type: 'platform',
    category: 'platform',
    width: 40,
    height: 40,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-20, 0, -20], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [20, 0, -20], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [20, 0, 20], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-20, 0, 20], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'board_40x20',
    name: '40×20cm板',
    type: 'platform',
    category: 'platform',
    width: 40,
    height: 20,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-20, 0, -10], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [20, 0, -10], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [20, 0, 10], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-20, 0, 10], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 附件 ============
  {
    id: 'swing',
    name: '秋千',
    type: 'swing',
    category: 'accessory',
    width: 40,
    height: 200,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top_left', position: [-20, 100, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'top_right', position: [20, 100, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'slide',
    name: '滑梯',
    type: 'slide',
    category: 'accessory',
    width: 40,
    height: 150,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top', position: [0, 75, -20], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'bottom', position: [0, 0, 20], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'rope_ladder',
    name: '绳梯',
    type: 'rope_ladder',
    category: 'accessory',
    width: 40,
    height: 180,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top', position: [0, 90, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'bottom', position: [0, -90, 0], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
];

// 获取所有组件
export const getAllComponents = (): ComponentDefinition[] => {
  return componentDefinitions;
};

// 按分类获取组件
export const getComponentsByCategory = (category: string): ComponentDefinition[] => {
  return componentDefinitions.filter(comp => comp.category === category);
};

// 按类型获取组件
export const getComponentsByType = (type: string): ComponentDefinition[] => {
  return componentDefinitions.filter(comp => comp.type === type);
};

// 根据ID获取组件
export const getComponentById = (id: string): ComponentDefinition | undefined => {
  return componentDefinitions.find(comp => comp.id === id);
};

// 搜索组件
export const searchComponents = (query: string): ComponentDefinition[] => {
  const lowerQuery = query.toLowerCase();
  return componentDefinitions.filter(comp =>
    comp.name.toLowerCase().includes(lowerQuery) ||
    comp.type.toLowerCase().includes(lowerQuery) ||
    comp.category.toLowerCase().includes(lowerQuery)
  );
};

// 获取组件分类
export const getCategories = (): { key: string; name: string; icon: string; color: string }[] => {
  return [
    { key: 'basic', name: '管件', icon: '🔧', color: '#4ecdc4' },
    { key: 'connector', name: '接头', icon: '🔗', color: '#45b7d1' },
    { key: 'platform', name: '板子', icon: '⬜', color: '#96ceb4' },
    { key: 'accessory', name: '附件', icon: '🎠', color: '#feca57' },
  ];
};

// 尺寸规格说明
export const SIZE_SPECS = {
  grid: 20,           // 网格尺寸：20cm
  pipe35: 35,         // 35cm管
  pipe15: 15,         // 15cm管
  connector: 5,       // 接头长度：5cm
  board40x40: { width: 40, height: 40 },  // 40x40板
  board40x20: { width: 40, height: 20 },  // 40x20板
  // 计算说明：35cm管 + 2个接头 = 35 + 5 = 40cm = 2个网格
  // 15cm管 + 1个接头 = 15 + 2.5 = 17.5cm ≈ 1个网格
};

export default componentDefinitions;
