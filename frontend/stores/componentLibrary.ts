import type { ComponentDefinition, ConnectionPoint } from '../types';
import {
  getPipeCenterlineSpec,
  REFERENCE_PRODUCT_SPEC,
} from '../referenceProductSpec';

export const isStructuralConnectionPoint = (point: ConnectionPoint) =>
  point.role !== 'board-mount';

const PIPE_OUTER_DIAMETER_CM = REFERENCE_PRODUCT_SPEC.pipes.outerDiameterCm;
const CONNECTOR_PORT_OFFSET_CM = REFERENCE_PRODUCT_SPEC.connectors.portOffsetCm;
const U_CURVE_RADIUS_CM = REFERENCE_PRODUCT_SPEC.pipes.uCurve40cm.centerlineRadiusCm;
const U_CURVE_CENTERLINE = getPipeCenterlineSpec('pipe_curve_u_40cm');
if (!U_CURVE_CENTERLINE) throw new Error('Missing reference centerline for U curved tube');
const CONNECTOR_45_OFFSET_CM = Number(
  (CONNECTOR_PORT_OFFSET_CM / Math.SQRT2).toFixed(4)
);

export const DIAGONAL_PIPE_LENGTHS = {
  module20: Number((Math.hypot(20, 20) - CONNECTOR_PORT_OFFSET_CM * 2).toFixed(3)),
  module40: Number((Math.hypot(40, 40) - CONNECTOR_PORT_OFFSET_CM * 2).toFixed(3)),
} as const;

const PLATFORM_MOUNT_POINT = {
  id: 'platform_mount',
  position: [0, 0, 0] as [number, number, number],
  direction: [0, 1, 0] as [number, number, number],
  type: 'mount' as const,
  compatible: ['mount'],
  role: 'board-mount' as const,
  capacity: 4,
};

const createStraightPipe = (length: 15 | 25 | 35): ComponentDefinition => {
  const centerline = getPipeCenterlineSpec(`pipe_${length}cm`);
  if (!centerline) throw new Error(`Missing reference centerline for ${length}cm pipe`);
  return {
  id: `pipe_${length}cm`,
  name: `${length}cm直管`,
  type: 'pipe',
  category: 'basic',
  length,
  diameter: PIPE_OUTER_DIAMETER_CM,
  modelPath: '',
  thumbnailPath: '',
  connectionPoints: [
    { id: 'start', position: centerline.start, direction: centerline.startDirection, type: 'socket', compatible: ['socket'] },
    { id: 'end', position: centerline.end, direction: centerline.endDirection, type: 'socket', compatible: ['socket'] },
  ],
  };
};

const legacyDiagonalPipeDefinitions: ComponentDefinition[] = [
  {
    id: 'pipe_45_20cm',
    name: '20×20cm模块斜管（旧结构兼容）',
    type: 'pipe',
    category: 'basic',
    length: DIAGONAL_PIPE_LENGTHS.module20,
    diameter: PIPE_OUTER_DIAMETER_CM,
    angle: 45,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -DIAGONAL_PIPE_LENGTHS.module20 / 2], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, DIAGONAL_PIPE_LENGTHS.module20 / 2], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
    properties: { moduleSpan: [20, 20], geometryKind: 'legacy-straight-brace', publicLibrary: false },
  },
  {
    id: 'pipe_45_40cm',
    name: '40×40cm模块斜管（旧结构兼容）',
    type: 'pipe',
    category: 'basic',
    length: DIAGONAL_PIPE_LENGTHS.module40,
    diameter: PIPE_OUTER_DIAMETER_CM,
    angle: 45,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: [0, 0, -DIAGONAL_PIPE_LENGTHS.module40 / 2], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'end', position: [0, 0, DIAGONAL_PIPE_LENGTHS.module40 / 2], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
    properties: { moduleSpan: [40, 40], geometryKind: 'legacy-straight-brace', publicLibrary: false },
  },
];

const legacyArcPipeDefinition: ComponentDefinition = {
  id: 'pipe_arc_40cm',
  name: '40cm U形弯管（旧ID兼容）',
  type: 'pipe',
  category: 'basic',
  length: Number((U_CURVE_RADIUS_CM * Math.PI).toFixed(3)),
  diameter: PIPE_OUTER_DIAMETER_CM,
  angle: REFERENCE_PRODUCT_SPEC.pipes.uCurve40cm.angleDegrees,
  width: 40,
  height: U_CURVE_RADIUS_CM,
  modelPath: '',
  thumbnailPath: '',
  connectionPoints: [
    { id: 'start', position: U_CURVE_CENTERLINE.start, direction: U_CURVE_CENTERLINE.startDirection, type: 'socket', compatible: ['socket'] },
    { id: 'end', position: U_CURVE_CENTERLINE.end, direction: U_CURVE_CENTERLINE.endDirection, type: 'socket', compatible: ['socket'] },
  ],
  properties: {
    geometryKind: 'u-curve-180',
    nominalSpan: 40,
    bendRadius: U_CURVE_RADIUS_CM,
    publicLibrary: false,
  },
};

const legacyConnector45Definition: ComponentDefinition = {
  id: 'connector_45deg_legacy_v1',
  name: '45°接头（旧版兼容）',
  type: 'elbow',
  category: 'connector',
  angle: 45,
  diameter: PIPE_OUTER_DIAMETER_CM,
  modelPath: '',
  thumbnailPath: '',
  connectionPoints: [
    { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
    { id: 'output', position: [CONNECTOR_45_OFFSET_CM, 0, -CONNECTOR_45_OFFSET_CM], direction: [0.7071, 0, -0.7071], type: 'socket', compatible: ['socket'] },
    PLATFORM_MOUNT_POINT,
  ],
  properties: { publicLibrary: false, autoTopology: false, legacyCompatibility: true },
};

// 预设组件库 - 根据实际攀爬架规格定义
export const componentDefinitions: ComponentDefinition[] = [
  // ============ 管件 ============
  createStraightPipe(15),
  createStraightPipe(25),
  createStraightPipe(35),
  {
    id: 'pipe_curve_u_40cm',
    name: '40cm U形弯管',
    type: 'pipe',
    category: 'basic',
    length: Number((U_CURVE_RADIUS_CM * Math.PI).toFixed(3)),
    diameter: PIPE_OUTER_DIAMETER_CM,
    angle: REFERENCE_PRODUCT_SPEC.pipes.uCurve40cm.angleDegrees,
    width: 40,
    height: U_CURVE_RADIUS_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'start', position: U_CURVE_CENTERLINE.start, direction: U_CURVE_CENTERLINE.startDirection, type: 'socket', compatible: ['socket'] },
      { id: 'end', position: U_CURVE_CENTERLINE.end, direction: U_CURVE_CENTERLINE.endDirection, type: 'socket', compatible: ['socket'] },
    ],
    properties: {
      geometryKind: 'u-curve-180',
      nominalSpan: 40,
      bendRadius: U_CURVE_RADIUS_CM,
    },
  },
  
  // ============ 接头（通） ============
  {
    id: 'connector_straight',
    name: '一字接头（直通）',
    type: 'elbow',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [0, 0, CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_L',
    name: 'L型接头（90度）',
    type: 'elbow',
    category: 'connector',
    angle: 90,
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_T',
    name: 'T型接头（三通）',
    type: 'tee',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_45deg',
    name: '45°斜向接头',
    type: 'elbow',
    category: 'connector',
    angle: REFERENCE_PRODUCT_SPEC.connectors.connector45Degrees,
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output', position: [CONNECTOR_45_OFFSET_CM, 0, CONNECTOR_45_OFFSET_CM], direction: [0.7071, 0, 0.7071], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_3way',
    name: '三向接头',
    type: 'tee',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [0, CONNECTOR_PORT_OFFSET_CM, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_4way',
    name: '四向接头',
    type: 'cross',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output3', position: [0, 0, CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_cross',
    name: '十字接头',
    type: 'cross',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input1', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'input2', position: [0, 0, CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
    ],
  },
  {
    id: 'connector_5way',
    name: '五向接头',
    type: 'cross',
    category: 'connector',
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'input', position: [0, 0, -CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, -1], type: 'socket', compatible: ['socket'] },
      { id: 'output1', position: [CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output2', position: [-CONNECTOR_PORT_OFFSET_CM, 0, 0], direction: [-1, 0, 0], type: 'socket', compatible: ['socket'] },
      { id: 'output3', position: [0, 0, CONNECTOR_PORT_OFFSET_CM], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      { id: 'output4', position: [0, CONNECTOR_PORT_OFFSET_CM, 0], direction: [0, 1, 0], type: 'socket', compatible: ['socket'] },
      PLATFORM_MOUNT_POINT,
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
      { id: 'corner1', position: [-20, 0, -20], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner2', position: [20, 0, -20], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner3', position: [20, 0, 20], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner4', position: [-20, 0, 20], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
    ],
    properties: {
      color: 'green',
      boardStyle: 'solid',
      boardMountVersion: 2,
    },
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
      { id: 'corner1', position: [-20, 0, -10], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner2', position: [20, 0, -10], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner3', position: [20, 0, 10], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'corner4', position: [-20, 0, 10], direction: [0, -1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
    ],
    properties: {
      color: 'green',
      boardStyle: 'solid',
      boardMountVersion: 2,
    },
  },
  {
    id: 'ramp_45cm',
    name: '45cm短坡板',
    type: 'platform',
    category: 'platform',
    length: REFERENCE_PRODUCT_SPEC.ramps.short.length,
    width: REFERENCE_PRODUCT_SPEC.ramps.short.width,
    height: REFERENCE_PRODUCT_SPEC.ramps.short.rise,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top_left', position: [-20, 0, -22.5], direction: [0, 1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'top_right', position: [20, 0, -22.5], direction: [0, 1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
    ],
    properties: { geometryKind: 'reference-ramp', rampRiseCm: 20, publicLibrary: true },
  },
  {
    id: 'ramp_85cm',
    name: '85cm长坡板',
    type: 'platform',
    category: 'platform',
    length: REFERENCE_PRODUCT_SPEC.ramps.long.length,
    width: REFERENCE_PRODUCT_SPEC.ramps.long.width,
    height: REFERENCE_PRODUCT_SPEC.ramps.long.rise,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'top_left', position: [-20, 0, -42.5], direction: [0, 1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
      { id: 'top_right', position: [20, 0, -42.5], direction: [0, 1, 0], type: 'mount', compatible: ['mount'], role: 'board-mount' },
    ],
    properties: { geometryKind: 'reference-ramp', rampRiseCm: 40, publicLibrary: true },
  },

  {
    id: 'connector_double_tube_mount',
    name: '双管安装件',
    type: 'elbow',
    category: 'connector',
    width: 40,
    diameter: PIPE_OUTER_DIAMETER_CM,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      { id: 'left', position: [-20, 0, 0], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
      { id: 'right', position: [20, 0, 0], direction: [0, 0, 1], type: 'socket', compatible: ['socket'] },
    ],
    properties: { geometryKind: 'double-tube-mount', autoTopology: false, publicLibrary: true },
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
    properties: { publicLibrary: false, legacyCompatibility: true },
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
    properties: { publicLibrary: false, legacyCompatibility: true },
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
    properties: { publicLibrary: false, legacyCompatibility: true },
  },
];

const isPublicLibraryComponent = (component: ComponentDefinition) =>
  (component.properties as { publicLibrary?: boolean } | undefined)?.publicLibrary !== false;

// 获取所有组件
export const getAllComponents = (): ComponentDefinition[] => {
  return componentDefinitions.filter(isPublicLibraryComponent);
};

// 按分类获取组件
export const getComponentsByCategory = (category: string): ComponentDefinition[] => {
  return componentDefinitions.filter(
    comp => comp.category === category && isPublicLibraryComponent(comp)
  );
};

// 按类型获取组件
export const getComponentsByType = (type: string): ComponentDefinition[] => {
  return componentDefinitions.filter(
    comp => comp.type === type && isPublicLibraryComponent(comp)
  );
};

// 根据ID获取组件
export const getComponentById = (id: string): ComponentDefinition | undefined => {
  return componentDefinitions.find(comp => comp.id === id) ??
    (id === legacyConnector45Definition.id ? legacyConnector45Definition : undefined) ??
    (id === legacyArcPipeDefinition.id ? legacyArcPipeDefinition : undefined) ??
    legacyDiagonalPipeDefinitions.find(comp => comp.id === id);
};

// 搜索组件
export const searchComponents = (query: string): ComponentDefinition[] => {
  const lowerQuery = query.toLowerCase();
  return componentDefinitions.filter(comp =>
    isPublicLibraryComponent(comp) && (
      comp.name.toLowerCase().includes(lowerQuery) ||
      comp.type.toLowerCase().includes(lowerQuery) ||
      comp.category.toLowerCase().includes(lowerQuery)
    )
  );
};

// 获取组件分类
export const getCategories = (): { key: string; name: string; icon: string; color: string }[] => {
  return [
    { key: 'basic', name: '管件', icon: 'tool', color: '#4ecdc4' },
    { key: 'connector', name: '接头', icon: 'link', color: '#45b7d1' },
    { key: 'platform', name: '板件与坡道', icon: 'panel', color: '#96ceb4' },
    { key: 'accessory', name: '旧版附件', icon: 'archive', color: '#feca57' },
  ];
};

// 尺寸规格说明
export const SIZE_SPECS = {
  grid: REFERENCE_PRODUCT_SPEC.gridCm,           // 网格尺寸：20cm
  pipe35: 35,         // 35cm管
  pipe25: 25,         // 25cm管
  pipe15: 15,         // 15cm管
  pipeOuterDiameter: PIPE_OUTER_DIAMETER_CM, // 管外径：5cm
  connector: CONNECTOR_PORT_OFFSET_CM * 2,       // 接头长度：5cm
  board40x40: { width: 40, height: 40 },  // 40x40板
  board40x20: { width: 40, height: 20 },  // 40x20板
  // 节点间距：标准管长 + 两端各2.5cm接头偏移 = 20 / 30 / 40cm。
};

export default componentDefinitions;
