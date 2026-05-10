import type { ComponentDefinition } from '../types';

// 预设组件库
export const componentDefinitions: ComponentDefinition[] = [
  // ============ 基础管件 ============
  {
    id: 'pipe_30cm',
    name: '30cm直管',
    type: 'pipe',
    category: 'basic',
    length: 30,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -15], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 15], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
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
  {
    id: 'pipe_10cm',
    name: '10cm直管',
    type: 'pipe',
    category: 'basic',
    length: 10,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'pipe_60cm',
    name: '60cm直管',
    type: 'pipe',
    category: 'basic',
    length: 60,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -30], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 30], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 连接件 ============
  {
    id: 'elbow_90deg',
    name: '90度弯头',
    type: 'elbow',
    category: 'connector',
    angle: 90,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'elbow_45deg',
    name: '45度弯头',
    type: 'elbow',
    category: 'connector',
    angle: 45,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [3.54, 0, 3.54], direction: [0.707, 0, 0.707], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'tee_3way',
    name: '三通接头',
    type: 'tee',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'cross_4way',
    name: '四通接头',
    type: 'cross',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [5, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-5, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output3', position: [0, 0, 5], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'elbow_90deg_vertical',
    name: '90度垂直弯头',
    type: 'elbow',
    category: 'connector',
    angle: 90,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [0, 5, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'tee_y_shape',
    name: 'Y型三通',
    type: 'tee',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -5], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [3.54, 0, 3.54], direction: [0.707, 0, 0.707], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-3.54, 0, 3.54], direction: [-0.707, 0, 0.707], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 平台类 ============
  {
    id: 'platform_small',
    name: '小平台 (30x30cm)',
    type: 'platform',
    category: 'platform',
    width: 30,
    height: 30,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-15, 0, -15], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [15, 0, -15], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [15, 0, 15], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-15, 0, 15], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'platform_medium',
    name: '中平台 (60x60cm)',
    type: 'platform',
    category: 'platform',
    width: 60,
    height: 60,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-30, 0, -30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [30, 0, -30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [30, 0, 30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-30, 0, 30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'platform_large',
    name: '大平台 (90x90cm)',
    type: 'platform',
    category: 'platform',
    width: 90,
    height: 90,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-45, 0, -45], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [45, 0, -45], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [45, 0, 45], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-45, 0, 45], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'platform_rectangular',
    name: '长平台 (120x60cm)',
    type: 'platform',
    category: 'platform',
    width: 120,
    height: 60,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'corner1', position: [-60, 0, -30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner2', position: [60, 0, -30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner3', position: [60, 0, 30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'corner4', position: [-60, 0, 30], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 附件 ============
  {
    id: 'swing',
    name: '秋千',
    type: 'swing',
    category: 'accessory',
    width: 30,
    height: 200,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top_left', position: [-15, 100, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'top_right', position: [15, 100, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
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
    width: 30,
    height: 180,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top', position: [0, 90, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'bottom', position: [0, -90, 0], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'climbing_wall',
    name: '攀爬墙',
    type: 'platform',
    category: 'accessory',
    width: 60,
    height: 120,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top_left', position: [-30, 60, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'top_right', position: [30, 60, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'bottom_left', position: [-30, -60, 0], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'bottom_right', position: [30, -60, 0], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'monkey_bars',
    name: '猴杆',
    type: 'pipe',
    category: 'accessory',
    length: 120,
    diameter: 3,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -60], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, 60], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
  },
  
  // ============ 结构件 ============
  {
    id: 'support_bracket',
    name: '支撑架',
    type: 'elbow',
    category: 'connector',
    angle: 90,
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'vertical', position: [0, -10, 0], direction: [0, -1, 0], type: 'socket', compatible: ['socket'] },
      { id: 'horizontal', position: [10, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'base_plate',
    name: '底座',
    type: 'platform',
    category: 'platform',
    width: 20,
    height: 20,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'center', position: [0, 0, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
    ],
  },
  {
    id: 'cap',
    name: '端盖',
    type: 'elbow',
    category: 'connector',
    diameter: 2.5,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'socket', position: [0, 0, 0], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
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
    { key: 'basic', name: '基础管件', icon: '🔧', color: '#4ecdc4' },
    { key: 'connector', name: '连接件', icon: '🔗', color: '#45b7d1' },
    { key: 'platform', name: '平台类', icon: '⬜', color: '#96ceb4' },
    { key: 'accessory', name: '附件', icon: '🎠', color: '#feca57' },
  ];
};

export default componentDefinitions;
