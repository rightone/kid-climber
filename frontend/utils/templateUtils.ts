import type { ComponentInstance, Connection } from '../types';
import * as THREE from 'three';
import { getComponentById } from '../stores/componentLibrary';
import {
  getWorldDirection,
  getWorldPosition,
} from '../systems/ConstructionEngine';
import { assignAutomaticPipeColors } from '../systems/PipeColorSystem';
import type { PipeColorMode } from '../systems/PipeColorSystem';
import {
  connectorDirectionKey,
  connectorTopologySystem,
  type TopologyPatch,
  type TopologyVector3,
} from '../systems/ConnectorTopologySystem';
import { advancedStructureSystem } from '../systems/AdvancedStructureSystem';

type Vec3 = [number, number, number];

export type TemplateCategory =
  | 'basic'
  | 'playground'
  | 'fitness'
  | 'custom'
  | 'community';

export interface DesignTemplateV2 {
  version: 2;
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  thumbnail: string;
  components: ComponentInstance[];
  connections: Connection[];
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export type DesignTemplate = DesignTemplateV2;

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  componentCount: number;
  connectionCount: number;
  bounds: {
    center: Vec3;
    size: Vec3;
  };
  bom: Record<string, number>;
}

interface LegacyTemplate {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  difficulty?: DesignTemplateV2['difficulty'];
  thumbnail?: string;
  components?: Array<Partial<ComponentInstance>>;
  connections?: Connection[];
  tags?: string[];
  author?: string;
  version?: number | string;
  createdAt?: string;
  updatedAt?: string;
}

const CREATED_AT = '2026-01-01T00:00:00.000Z';

const DIRECTION_VECTORS: Record<string, TopologyVector3> = {
  'x+': [1, 0, 0],
  'x-': [-1, 0, 0],
  'y+': [0, 1, 0],
  'y-': [0, -1, 0],
  'z+': [0, 0, 1],
  'z-': [0, 0, -1],
};

const OPPOSITE_DIRECTION: Record<string, string> = {
  'x+': 'x-',
  'x-': 'x+',
  'y+': 'y-',
  'y-': 'y+',
  'z+': 'z-',
  'z-': 'z+',
};

const cloneComponent = (component: ComponentInstance): ComponentInstance => ({
  ...component,
  position: [...component.position] as Vec3,
  rotation: [...component.rotation] as Vec3,
  scale: [...component.scale] as Vec3,
  properties: component.properties ? JSON.parse(JSON.stringify(component.properties)) as Record<string, unknown> : undefined,
});

const cloneConnection = (connection: Connection): Connection => ({
  ...connection,
  source: { ...connection.source },
  target: { ...connection.target },
});

const component = (
  instanceId: string,
  componentId: string,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0]
): ComponentInstance => ({
  instanceId,
  componentId,
  position,
  rotation,
  scale: [1, 1, 1],
});

const connection = (
  id: string,
  sourceComponentId: string,
  sourcePointId: string,
  targetComponentId: string,
  targetPointId: string,
  type = 'socket'
): Connection => ({
  id,
  source: { componentId: sourceComponentId, pointId: sourcePointId },
  target: { componentId: targetComponentId, pointId: targetPointId },
  type,
  isActive: true,
});

const createTemplate = (input: Omit<DesignTemplateV2, 'version' | 'createdAt' | 'updatedAt'>): DesignTemplateV2 => ({
  ...input,
  version: 2,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
});

interface GraphNode {
  id: string;
  position: Vec3;
  extraDirections?: string[];
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

interface GraphBoard {
  id: string;
  corners: [string, string, string, string];
}

interface AccessoryConnection {
  id: string;
  nodeId: string;
  directionKey: string;
  componentId: string;
  pointId: string;
  position: Vec3;
}

const directionBetween = (from: Vec3, to: Vec3) => {
  const delta: TopologyVector3 = [
    Math.sign(to[0] - from[0]) as -1 | 0 | 1,
    Math.sign(to[1] - from[1]) as -1 | 0 | 1,
    Math.sign(to[2] - from[2]) as -1 | 0 | 1,
  ];
  return connectorDirectionKey(delta);
};

const pipeTransformForDirection = (
  from: Vec3,
  to: Vec3,
  directionKey: string
): { position: Vec3; rotation: Vec3; fromPointId: string; toPointId: string } => {
  const position: Vec3 = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  switch (directionKey) {
    case 'x+':
      return { position, rotation: [0, 90, 0], fromPointId: 'start', toPointId: 'end' };
    case 'x-':
      return { position, rotation: [0, 90, 0], fromPointId: 'end', toPointId: 'start' };
    case 'z+':
      return { position, rotation: [0, 0, 0], fromPointId: 'start', toPointId: 'end' };
    case 'z-':
      return { position, rotation: [0, 0, 0], fromPointId: 'end', toPointId: 'start' };
    case 'y+':
      return { position, rotation: [90, 0, 0], fromPointId: 'end', toPointId: 'start' };
    case 'y-':
      return { position, rotation: [90, 0, 0], fromPointId: 'start', toPointId: 'end' };
    default:
      return { position, rotation: [0, 0, 0], fromPointId: 'start', toPointId: 'end' };
  }
};

const buildGraphTemplateParts = (input: {
  prefix: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  boards?: GraphBoard[];
  accessories?: AccessoryConnection[];
}) => {
  const nodeById = new Map(input.nodes.map(node => [node.id, node]));
  const directionsByNode = new Map<string, Set<string>>();
  input.nodes.forEach(node => {
    directionsByNode.set(node.id, new Set(node.extraDirections ?? []));
  });
  input.edges.forEach(edge => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return;
    const direction = directionBetween(from.position, to.position);
    if (!direction) return;
    directionsByNode.get(edge.from)?.add(direction);
    directionsByNode.get(edge.to)?.add(OPPOSITE_DIRECTION[direction]);
  });
  input.accessories?.forEach(accessory => {
    directionsByNode.get(accessory.nodeId)?.add(accessory.directionKey);
  });

  const components: ComponentInstance[] = [];
  const connections: Connection[] = [];
  const portsByNode = new Map<string, Record<string, string>>();

  input.nodes.forEach(node => {
    const directionKeys = [...(directionsByNode.get(node.id) ?? [])];
    const resolution = connectorTopologySystem.resolveConnectorTopology({
      requiredDirections: directionKeys.map(key => DIRECTION_VECTORS[key]),
    });
    if (!resolution) {
      throw new Error(`Cannot resolve connector for template node ${node.id}`);
    }
    components.push(component(node.id, resolution.connectorComponentId, node.position, resolution.rotation));
    portsByNode.set(node.id, resolution.portsByDirection);
  });

  input.edges.forEach(edge => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return;
    const direction = directionBetween(from.position, to.position);
    if (!direction) return;
    const pipeId = `${input.prefix}_${edge.id}`;
    const pipe = pipeTransformForDirection(from.position, to.position, direction);
    components.push(component(pipeId, 'pipe_35cm', pipe.position, pipe.rotation));
    connections.push(
      connection(
        `${pipeId}_from`,
        edge.from,
        portsByNode.get(edge.from)?.[direction] ?? '',
        pipeId,
        pipe.fromPointId
      ),
      connection(
        `${pipeId}_to`,
        pipeId,
        pipe.toPointId,
        edge.to,
        portsByNode.get(edge.to)?.[OPPOSITE_DIRECTION[direction]] ?? ''
      )
    );
  });

  input.boards?.forEach(board => {
    const cornerNodes = board.corners.map(nodeId => nodeById.get(nodeId));
    if (cornerNodes.some(node => !node)) return;
    const positions = cornerNodes.map(node => node!.position);
    const boardId = `${input.prefix}_${board.id}`;
    const boardPosition: Vec3 = [
      positions.reduce((sum, position) => sum + position[0], 0) / 4,
      positions.reduce((sum, position) => sum + position[1], 0) / 4,
      positions.reduce((sum, position) => sum + position[2], 0) / 4,
    ];
    components.push(component(boardId, 'board_40x40', boardPosition));
    board.corners.forEach((nodeId, index) => {
      connections.push(
        connection(
          `${boardId}_corner_${index + 1}`,
          nodeId,
          'platform_mount',
          boardId,
          `corner${index + 1}`,
          'board-mount'
        )
      );
    });
  });

  const addedAccessoryIds = new Set<string>();
  input.accessories?.forEach(accessory => {
    const accessoryId = `${input.prefix}_${accessory.id}`;
    if (!addedAccessoryIds.has(accessoryId)) {
      components.push(component(accessoryId, accessory.componentId, accessory.position));
      addedAccessoryIds.add(accessoryId);
    }
    connections.push(
      connection(
        `${accessoryId}_connection`,
        accessory.nodeId,
        portsByNode.get(accessory.nodeId)?.[accessory.directionKey] ?? '',
        accessoryId,
        accessory.pointId
      )
    );
  });

  return { components, connections };
};

const squareNodes = (prefix: string, y: number, extra?: Partial<Record<'sw' | 'se' | 'ne' | 'nw', string[]>>): GraphNode[] => [
  { id: `${prefix}_sw`, position: [-20, y, -20], extraDirections: extra?.sw },
  { id: `${prefix}_se`, position: [20, y, -20], extraDirections: extra?.se },
  { id: `${prefix}_ne`, position: [20, y, 20], extraDirections: extra?.ne },
  { id: `${prefix}_nw`, position: [-20, y, 20], extraDirections: extra?.nw },
];

const squareEdges = (prefix: string): GraphEdge[] => [
  { id: `${prefix}_south`, from: `${prefix}_sw`, to: `${prefix}_se` },
  { id: `${prefix}_east`, from: `${prefix}_se`, to: `${prefix}_ne` },
  { id: `${prefix}_north`, from: `${prefix}_nw`, to: `${prefix}_ne` },
  { id: `${prefix}_west`, from: `${prefix}_sw`, to: `${prefix}_nw` },
];

const simpleFrameTemplate = () => {
  const frame = buildGraphTemplateParts({
    prefix: 'simple',
    nodes: squareNodes('simple', 0),
    edges: squareEdges('simple'),
  });
  return createTemplate({
    id: 'simple_frame',
    name: '简单框架',
    description: '标准 40×40cm 矩形基础框。',
    category: 'basic',
    difficulty: 'beginner',
    thumbnail: '',
    components: frame.components,
    connections: frame.connections,
    tags: ['基础', '框架', '入门'],
    author: 'Kid Climber',
  });
};

const cubeFrameTemplate = () => {
  const frame = buildGraphTemplateParts({
    prefix: 'cube',
    nodes: [
      ...squareNodes('cube_bottom', 0, {
        sw: ['y+'], se: ['y+'], ne: ['y+'], nw: ['y+'],
      }),
      ...squareNodes('cube_top', 40, {
        sw: ['y-'], se: ['y-'], ne: ['y-'], nw: ['y-'],
      }),
    ],
    edges: [
      ...squareEdges('cube_bottom'),
      ...squareEdges('cube_top'),
      { id: 'vertical_sw', from: 'cube_bottom_sw', to: 'cube_top_sw' },
      { id: 'vertical_se', from: 'cube_bottom_se', to: 'cube_top_se' },
      { id: 'vertical_ne', from: 'cube_bottom_ne', to: 'cube_top_ne' },
      { id: 'vertical_nw', from: 'cube_bottom_nw', to: 'cube_top_nw' },
    ],
  });
  return createTemplate({
    id: 'cube_frame',
    name: '立方体框架',
    description: '标准 40×40×40cm 连通立方体框架。',
    category: 'basic',
    difficulty: 'intermediate',
    thumbnail: '',
    components: frame.components,
    connections: frame.connections,
    tags: ['立方体', '框架', '练习'],
    author: 'Kid Climber',
  });
};

const platformTemplate = () => {
  const frame = buildGraphTemplateParts({
    prefix: 'platform',
    nodes: [
      ...squareNodes('platform_bottom', 0, {
        sw: ['y+'], se: ['y+'], ne: ['y+'], nw: ['y+'],
      }),
      ...squareNodes('platform_top', 40, {
        sw: ['y-', 'y+'],
        se: ['y-', 'y+'],
        ne: ['y-', 'y+'],
        nw: ['y-', 'y+'],
      }),
    ],
    edges: [
      ...squareEdges('platform_bottom'),
      ...squareEdges('platform_top'),
      { id: 'vertical_sw', from: 'platform_bottom_sw', to: 'platform_top_sw' },
      { id: 'vertical_se', from: 'platform_bottom_se', to: 'platform_top_se' },
      { id: 'vertical_ne', from: 'platform_bottom_ne', to: 'platform_top_ne' },
      { id: 'vertical_nw', from: 'platform_bottom_nw', to: 'platform_top_nw' },
    ],
    boards: [{
      id: 'board',
      corners: ['platform_top_sw', 'platform_top_se', 'platform_top_ne', 'platform_top_nw'],
    }],
  });
  return createTemplate({
    id: 'platform_structure',
    name: '平台结构',
    description: '带四角安装平台板的基础攀爬架。',
    category: 'playground',
    difficulty: 'intermediate',
    thumbnail: '',
    components: frame.components,
    connections: frame.connections,
    tags: ['平台', '攀爬架', '游乐场'],
    author: 'Kid Climber',
  });
};

const aFrameTemplate = () => {
  let sequence = 0;
  const assembly = advancedStructureSystem.createAFrame({
    size: 'small',
    plane: 'vertical-x',
    mirrored: false,
    idFactory: prefix => `preset_aframe_${prefix}_${sequence++}`,
  });
  return createTemplate({
    id: 'a_frame_climber',
    name: 'A字攀爬架',
    description: '由标准35cm直管和45°斜向接头组成的稳定A字结构。',
    category: 'playground',
    difficulty: 'intermediate',
    thumbnail: '',
    components: assembly.components,
    connections: assembly.connections,
    tags: ['A字架', '斜向', '攀爬'],
    author: 'Kid Climber',
  });
};

const rampPlatformTemplate = (kind: 'short' | 'long') => {
  const prefix = kind === 'short' ? 'short_ramp' : 'long_ramp';
  const rampId = kind === 'short' ? 'ramp_45cm' : 'ramp_85cm';
  const length = kind === 'short' ? 45 : 85;
  const rise = kind === 'short' ? 20 : 40;
  const angle = Number((Math.asin(rise / length) * 180 / Math.PI).toFixed(4));
  const run = Math.sqrt(length * length - rise * rise);
  const frame = buildGraphTemplateParts({
    prefix,
    nodes: [
      ...squareNodes(`${prefix}_bottom`, 0, {
        sw: ['y+'], se: ['y+'], ne: ['y+'], nw: ['y+'],
      }),
      ...squareNodes(`${prefix}_top`, 40, {
        sw: ['y-'], se: ['y-'], ne: ['y-'], nw: ['y-'],
      }),
    ],
    edges: [
      ...squareEdges(`${prefix}_bottom`),
      ...squareEdges(`${prefix}_top`),
      { id: 'vertical_sw', from: `${prefix}_bottom_sw`, to: `${prefix}_top_sw` },
      { id: 'vertical_se', from: `${prefix}_bottom_se`, to: `${prefix}_top_se` },
      { id: 'vertical_ne', from: `${prefix}_bottom_ne`, to: `${prefix}_top_ne` },
      { id: 'vertical_nw', from: `${prefix}_bottom_nw`, to: `${prefix}_top_nw` },
    ],
    boards: [{
      id: 'board',
      corners: [`${prefix}_top_sw`, `${prefix}_top_se`, `${prefix}_top_ne`, `${prefix}_top_nw`],
    }],
  });
  const rampInstanceId = `${prefix}_ramp_panel`;
  frame.components.push(component(
    rampInstanceId,
    rampId,
    [0, 40 - rise / 2, -20 + run / 2],
    [angle, 0, 0]
  ));
  frame.connections.push(
    connection(`${rampInstanceId}_left`, `${prefix}_top_sw`, 'platform_mount', rampInstanceId, 'top_left', 'board-mount'),
    connection(`${rampInstanceId}_right`, `${prefix}_top_se`, 'platform_mount', rampInstanceId, 'top_right', 'board-mount')
  );
  return createTemplate({
    id: kind === 'short' ? 'short_ramp_platform' : 'long_ramp_climber',
    name: kind === 'short' ? '短坡板平台' : '长坡板攀爬架',
    description: kind === 'short'
      ? '标准平台连接45cm短坡板，适合20cm落差。'
      : '标准平台连接85cm长坡板，适合40cm落差。',
    category: 'playground',
    difficulty: kind === 'short' ? 'intermediate' : 'advanced',
    thumbnail: '',
    components: frame.components,
    connections: frame.connections,
    tags: ['平台', '坡板', kind === 'short' ? '45cm' : '85cm'],
    author: 'Kid Climber',
  });
};

export const presetTemplates: DesignTemplateV2[] = [
  simpleFrameTemplate(),
  cubeFrameTemplate(),
  platformTemplate(),
  aFrameTemplate(),
  rampPlatformTemplate('short'),
  rampPlatformTemplate('long'),
];

const calculateBounds = (components: ComponentInstance[]): TemplateValidationResult['bounds'] => {
  if (components.length === 0) {
    return { center: [0, 0, 0], size: [0, 0, 0] };
  }
  const min: Vec3 = [...components[0].position] as Vec3;
  const max: Vec3 = [...components[0].position] as Vec3;
  components.forEach(component => {
    component.position.forEach((value, index) => {
      min[index] = Math.min(min[index], value);
      max[index] = Math.max(max[index], value);
    });
  });
  return {
    center: [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ],
    size: [
      Math.max(10, max[0] - min[0]),
      Math.max(10, max[1] - min[1]),
      Math.max(10, max[2] - min[2]),
    ],
  };
};

const calculateBom = (components: ComponentInstance[]) =>
  components.reduce<Record<string, number>>((bom, item) => {
    bom[item.componentId] = (bom[item.componentId] ?? 0) + 1;
    return bom;
  }, {});

const endpointWorldPosition = (component: ComponentInstance, pointId: string) => {
  const definition = getComponentById(component.componentId);
  const point = definition?.connectionPoints.find(item => item.id === pointId);
  if (!point) return null;
  return getWorldPosition(component.position, component.rotation, point.position);
};

const endpointWorldDirection = (component: ComponentInstance, pointId: string) => {
  const definition = getComponentById(component.componentId);
  const point = definition?.connectionPoints.find(item => item.id === pointId);
  if (!point) return null;
  return getWorldDirection(component.rotation, point.direction);
};

export const validateTemplate = (template: DesignTemplateV2): TemplateValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const componentIds = new Set<string>();
  const connectionEndpointUseCounts = new Map<string, number>();
  const componentById = new Map<string, ComponentInstance>();

  template.components.forEach(component => {
    if (componentIds.has(component.instanceId)) {
      errors.push(`重复组件 ID：${component.instanceId}`);
    }
    componentIds.add(component.instanceId);
    componentById.set(component.instanceId, component);
    if (!getComponentById(component.componentId)) {
      errors.push(`未知组件：${component.componentId}`);
    }
  });

  template.connections.forEach(connection => {
    const source = componentById.get(connection.source.componentId);
    const target = componentById.get(connection.target.componentId);
    if (!source || !target) {
      errors.push(`连接 ${connection.id} 引用不存在的组件`);
      return;
    }
    const sourcePosition = endpointWorldPosition(source, connection.source.pointId);
    const targetPosition = endpointWorldPosition(target, connection.target.pointId);
    const sourceDirection = endpointWorldDirection(source, connection.source.pointId);
    const targetDirection = endpointWorldDirection(target, connection.target.pointId);
    const sourceDefinition = getComponentById(source.componentId);
    const targetDefinition = getComponentById(target.componentId);
    const sourcePoint = sourceDefinition?.connectionPoints.find(
      point => point.id === connection.source.pointId
    );
    const targetPoint = targetDefinition?.connectionPoints.find(
      point => point.id === connection.target.pointId
    );
    if (
      !sourcePosition ||
      !targetPosition ||
      !sourceDirection ||
      !targetDirection ||
      !sourcePoint ||
      !targetPoint
    ) {
      errors.push(`连接 ${connection.id} 引用不存在的连接点`);
      return;
    }
    const sourceKey = `${connection.source.componentId}:${connection.source.pointId}`;
    const targetKey = `${connection.target.componentId}:${connection.target.pointId}`;
    const sourceUseCount = connectionEndpointUseCounts.get(sourceKey) ?? 0;
    const targetUseCount = connectionEndpointUseCounts.get(targetKey) ?? 0;
    if (
      sourceUseCount >= (sourcePoint.capacity ?? 1) ||
      targetUseCount >= (targetPoint.capacity ?? 1)
    ) {
      errors.push(`连接 ${connection.id} 使用了已占用端点`);
    }
    connectionEndpointUseCounts.set(sourceKey, sourceUseCount + 1);
    connectionEndpointUseCounts.set(targetKey, targetUseCount + 1);
    if (Math.hypot(
      sourcePosition[0] - targetPosition[0],
      sourcePosition[1] - targetPosition[1],
      sourcePosition[2] - targetPosition[2]
    ) > 0.6) {
      errors.push(`连接 ${connection.id} 两端没有对齐`);
    }
    const directionDot =
      sourceDirection[0] * targetDirection[0] +
      sourceDirection[1] * targetDirection[1] +
      sourceDirection[2] * targetDirection[2];
    const isBoardMount =
      connection.type === 'board-mount' ||
      (sourcePoint.role === 'board-mount' && targetPoint.role === 'board-mount');
    if (!isBoardMount && directionDot > -0.92) {
      errors.push(`连接 ${connection.id} 两端方向不兼容`);
    }
    if (
      !sourcePoint.compatible.includes(targetPoint.type) &&
      !targetPoint.compatible.includes(sourcePoint.type)
    ) {
      errors.push(`连接 ${connection.id} 接口类型不兼容`);
    }
  });

  const graph = new Map(template.components.map(component => [component.instanceId, new Set<string>()]));
  template.connections.forEach(connection => {
    graph.get(connection.source.componentId)?.add(connection.target.componentId);
    graph.get(connection.target.componentId)?.add(connection.source.componentId);
  });
  const firstId = template.components[0]?.instanceId;
  if (firstId) {
    const visited = new Set([firstId]);
    const queue = [firstId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      graph.get(current)?.forEach(next => {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      });
    }
    if (visited.size !== template.components.length) {
      errors.push('模板包含未连通组件');
    }
  }

  template.components
    .filter(component => component.componentId.startsWith('board_'))
    .forEach(board => {
      const boardConnections = template.connections.filter(connection =>
        connection.source.componentId === board.instanceId ||
        connection.target.componentId === board.instanceId
      );
      if (boardConnections.length !== 4) {
        errors.push(`${board.instanceId} 必须四角完整连接`);
      }
    });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    componentCount: template.components.length,
    connectionCount: template.connections.length,
    bounds: calculateBounds(template.components),
    bom: calculateBom(template.components),
  };
};

const normalizeCategory = (category: unknown): TemplateCategory => {
  if (category === 'basic' || category === '基础') return 'basic';
  if (category === 'playground' || category === '进阶' || category === '高级' || category === '游乐场') return 'playground';
  if (category === 'fitness') return 'fitness';
  if (category === 'community') return 'community';
  return 'custom';
};

const normalizeComponentsToOrigin = (components: ComponentInstance[]) => {
  const bounds = calculateBounds(components);
  return components.map(component => ({
    ...cloneComponent(component),
    position: [
      component.position[0] - bounds.center[0],
      component.position[1] - bounds.center[1],
      component.position[2] - bounds.center[2],
    ] as Vec3,
  }));
};

const migrateLegacyTemplate = (template: LegacyTemplate): DesignTemplateV2 | null => {
  if (!template.name || !Array.isArray(template.components)) return null;
  const components = normalizeComponentsToOrigin(
    template.components
      .filter(item => item.instanceId && item.componentId && item.position && item.rotation)
      .map((item, index) => ({
        instanceId: item.instanceId ?? `legacy_${index}`,
        componentId: item.componentId!,
        position: item.position as Vec3,
        rotation: item.rotation as Vec3,
        scale: item.scale ?? [1, 1, 1],
        color: item.color,
        properties: item.properties,
      }))
  );
  return createTemplate({
    id: template.id ?? `template_${Date.now()}`,
    name: template.name,
    description: template.description ?? '',
    category: normalizeCategory(template.category),
    difficulty: template.difficulty ?? 'beginner',
    thumbnail: template.thumbnail ?? '',
    components,
    connections: Array.isArray(template.connections) ? template.connections.map(cloneConnection) : [],
    tags: template.tags ?? [],
    author: template.author ?? 'User',
  });
};

export const transformTemplateComponents = (input: {
  components: ComponentInstance[];
  origin?: Vec3;
  rotationY?: number;
}): ComponentInstance[] => {
  const origin = input.origin ?? [0, 0, 0];
  const rotationY = input.rotationY ?? 0;
  const radians = rotationY * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const globalRotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, radians, 0, 'XYZ')
  );

  return input.components.map(component => {
    const [x, y, z] = component.position;
    const rotated: Vec3 = [
      x * cos + z * sin,
      y,
      -x * sin + z * cos,
    ];
    const localRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        component.rotation[0] * Math.PI / 180,
        component.rotation[1] * Math.PI / 180,
        component.rotation[2] * Math.PI / 180,
        'XYZ'
      )
    );
    const rotatedEuler = new THREE.Euler().setFromQuaternion(
      globalRotation.clone().multiply(localRotation),
      'XYZ'
    );
    return {
      ...cloneComponent(component),
      position: [
        rotated[0] + origin[0],
        rotated[1] + origin[1],
        rotated[2] + origin[2],
      ] as Vec3,
      rotation: [
        rotatedEuler.x * 180 / Math.PI,
        rotatedEuler.y * 180 / Math.PI,
        rotatedEuler.z * 180 / Math.PI,
      ] as Vec3,
    };
  });
};

export const instantiateTemplate = (input: {
  template: DesignTemplateV2;
  existingComponents: ComponentInstance[];
  existingConnections: Connection[];
  origin?: Vec3;
  rotationY?: number;
  mode?: PipeColorMode;
}) => {
  const idSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const idMap = new Map<string, string>();

  input.template.components.forEach(component => {
    idMap.set(component.instanceId, `tpl_${idSuffix}_${component.instanceId}`);
  });

  const transformedComponents = transformTemplateComponents({
    components: input.template.components,
    origin: input.origin,
    rotationY: input.rotationY,
  });
  const colorIdMap = new Map(
    input.template.components.map(component => [
      component.instanceId,
      `template-color:${input.template.id}:${component.instanceId}`,
    ])
  );
  const templateIdByColorId = new Map(
    [...colorIdMap.entries()].map(([templateInstanceId, colorId]) => [
      colorId,
      templateInstanceId,
    ])
  );
  const colorizedComponents = assignAutomaticPipeColors({
    existingComponents: input.existingComponents,
    existingConnections: input.existingConnections,
    newComponents: transformedComponents.map(component => ({
      ...component,
      instanceId: colorIdMap.get(component.instanceId)!,
    })),
    newConnections: input.template.connections.map(item => ({
      ...cloneConnection(item),
      id: `template-color:${input.template.id}:${item.id}`,
      source: {
        ...item.source,
        componentId: colorIdMap.get(item.source.componentId)!,
      },
      target: {
        ...item.target,
        componentId: colorIdMap.get(item.target.componentId)!,
      },
    })),
    mode: input.mode,
    preserveExplicitNewColors: true,
  });
  const colorsByTemplateInstanceId = new Map(
    colorizedComponents.map(component => [
      templateIdByColorId.get(component.instanceId)!,
      component.color,
    ])
  );
  const components: ComponentInstance[] = transformedComponents.map(component => ({
      ...component,
      instanceId: idMap.get(component.instanceId)!,
      color: colorsByTemplateInstanceId.get(component.instanceId),
    }));
  const connections = input.template.connections.map(conn => ({
    ...cloneConnection(conn),
    id: `tpl_conn_${idSuffix}_${conn.id}`,
    source: {
      ...conn.source,
      componentId: idMap.get(conn.source.componentId) ?? conn.source.componentId,
    },
    target: {
      ...conn.target,
      componentId: idMap.get(conn.target.componentId) ?? conn.target.componentId,
    },
  }));

  return {
    components,
    connections,
  };
};

export const createTemplatePatch = (input: {
  template: DesignTemplateV2;
  existingComponents: ComponentInstance[];
  existingConnections: Connection[];
  replace: boolean;
  origin?: Vec3;
  rotationY?: number;
  mode?: PipeColorMode;
}): TopologyPatch => {
  const instance = instantiateTemplate(input);
  return {
    addComponents: instance.components,
    updateComponents: [],
    removeComponentIds: input.replace
      ? input.existingComponents.map(component => component.instanceId)
      : [],
    addConnections: instance.connections,
    updateConnections: [],
    removeConnectionIds: input.replace
      ? input.existingConnections.map(connection => connection.id)
      : [],
    selectInstanceId: instance.components[0]?.instanceId,
  };
};

export class TemplateManager {
  private templates: DesignTemplateV2[] = [...presetTemplates];
  private readonly storageKey = 'kid_climber_templates';

  constructor() {
    this.loadFromStorage();
  }

  getTemplates(): DesignTemplateV2[] {
    return this.templates.map(template => ({
      ...template,
      components: template.components.map(cloneComponent),
      connections: template.connections.map(cloneConnection),
    }));
  }

  getTemplate(id: string): DesignTemplateV2 | undefined {
    return this.getTemplates().find(template => template.id === id);
  }

  searchTemplates(query: string): DesignTemplateV2[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return this.getTemplates();
    return this.getTemplates().filter(template =>
      template.name.toLowerCase().includes(normalized) ||
      template.description.toLowerCase().includes(normalized) ||
      template.tags.some(tag => tag.toLowerCase().includes(normalized))
    );
  }

  createTemplateFromDesign(
    name: string,
    description: string,
    category: TemplateCategory,
    components: ComponentInstance[],
    connections: Connection[],
    tags: string[] = []
  ): DesignTemplateV2 {
    const template = createTemplate({
      id: `template_${Date.now()}`,
      name,
      description,
      category,
      difficulty: components.length <= 10 ? 'beginner' : components.length <= 30 ? 'intermediate' : 'advanced',
      thumbnail: '',
      components: normalizeComponentsToOrigin(components),
      connections: connections.map(cloneConnection),
      tags,
      author: 'User',
    });
    this.templates.push(template);
    this.saveToStorage();
    return template;
  }

  deleteTemplate(id: string): boolean {
    if (presetTemplates.some(template => template.id === id)) return false;
    const initialLength = this.templates.length;
    this.templates = this.templates.filter(template => template.id !== id);
    if (this.templates.length === initialLength) return false;
    this.saveToStorage();
    return true;
  }

  exportTemplate(id: string): string | null {
    const template = this.getTemplate(id);
    return template ? JSON.stringify(template, null, 2) : null;
  }

  importTemplate(json: string): DesignTemplateV2 | null {
    try {
      const parsed = JSON.parse(json) as LegacyTemplate;
      const template = parsed.version === 2
        ? migrateLegacyTemplate(parsed)
        : migrateLegacyTemplate(parsed);
      if (!template) return null;
      template.id = `template_${Date.now()}`;
      this.templates.push(template);
      this.saveToStorage();
      return template;
    } catch {
      return null;
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      const saved = raw ? JSON.parse(raw) as LegacyTemplate[] : [];
      this.templates = [
        ...presetTemplates,
        ...saved
          .map(migrateLegacyTemplate)
          .filter((template): template is DesignTemplateV2 => template !== null),
      ];
    } catch {
      this.templates = [...presetTemplates];
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const customTemplates = this.templates.filter(
      template => !presetTemplates.some(preset => preset.id === template.id)
    );
    localStorage.setItem(this.storageKey, JSON.stringify(customTemplates));
  }
}

export const templateManager = new TemplateManager();

export const templateUtils = {
  getCategoryName: (category: TemplateCategory): string => {
    switch (category) {
      case 'basic': return '基础';
      case 'playground': return '游乐场';
      case 'fitness': return '健身';
      case 'custom': return '自定义';
      case 'community': return '社区';
    }
  },
  getDifficultyName: (difficulty: DesignTemplateV2['difficulty']): string => {
    switch (difficulty) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'advanced': return '高级';
    }
  },
  getDifficultyColor: (difficulty: DesignTemplateV2['difficulty']): string => {
    switch (difficulty) {
      case 'beginner': return '#52c41a';
      case 'intermediate': return '#faad14';
      case 'advanced': return '#ff4d4f';
    }
  },
  getAllCategories: (): TemplateCategory[] => ['basic', 'playground', 'fitness', 'custom', 'community'],
  getAllDifficulty: (): DesignTemplateV2['difficulty'][] => ['beginner', 'intermediate', 'advanced'],
};
