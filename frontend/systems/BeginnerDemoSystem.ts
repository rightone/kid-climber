import type { ComponentInstance, Connection } from '../types';
import { getComponentById, SIZE_SPECS } from '../stores/componentLibrary';

export interface BeginnerDemoPracticeState {
  endpointGrowthPracticed: boolean;
  practiceComponentIds?: string[];
  practiceConnectionIds?: string[];
}

export interface BeginnerDemoDesign {
  components: ComponentInstance[];
  connections: Connection[];
  selectInstanceId?: string;
  starterEndpoint?: { componentId: string; pointId: string };
}

export interface BeginnerDemoDimensionSpec {
  gridCm: number;
  longPipeCm: number;
  shortPipeCm: number;
  longPipeReferenceSpan: 2;
  shortPipeReferenceSpan: 1;
}

export interface BeginnerDemoCheck {
  id:
    | 'dimensions'
    | 'endpoint-growth-practice'
    | 'base-frame'
    | 'support-frame'
    | 'platform-board'
    | 'short-pipe'
    | 'bom-ready'
    | 'assembly-ready';
  label: string;
  complete: boolean;
  detail: string;
  structural: boolean;
}

export interface BeginnerDemoProgress {
  checks: BeginnerDemoCheck[];
  completedChecks: number;
  totalChecks: number;
  structuralComplete: boolean;
  isComplete: boolean;
  percent: number;
  nextAction: string;
}

export interface BeginnerDemoStep {
  id: string;
  title: string;
  description: string;
}

type Tuple3 = [number, number, number];
type DemoIdFactory = (semanticId: string) => string;

interface DemoComponentRecipe {
  key: string;
  componentId: string;
  position: Tuple3;
  rotation: Tuple3;
}

interface DemoConnectionRecipe {
  key: string;
  sourceKey: string;
  sourcePointId: string;
  targetKey: string;
  targetPointId: string;
  type?: string;
}

const GRID_CM = SIZE_SPECS.grid;
const PLATFORM_HALF_SPAN_CM = SIZE_SPECS.board40x40.width / 2;
const PLATFORM_HEIGHT_CM = GRID_CM * 2;
const BOARD_PLATFORM_Y_CM = PLATFORM_HEIGHT_CM;
const SHORT_ENTRY_Z_CM = -PLATFORM_HALF_SPAN_CM - (SIZE_SPECS.pipe15 + SIZE_SPECS.connector) / 2;

const DEMO_STEPS: BeginnerDemoStep[] = [
  {
    id: 'starter',
    title: '从第一根 35cm 管开始',
    description: '先放入一根 35cm 管，选中端点后用方向手柄继续生长。',
  },
  {
    id: 'growth',
    title: '完成一次端点生长',
    description: '选择 15cm、25cm 或 35cm，再点击方向手柄，让系统自动添加接头和管子。',
  },
  {
    id: 'base',
    title: '搭出 2×2 格基础架',
    description: '保持 20cm 参考线节奏，用 35cm 管和接头形成 40×40cm 基础框。',
  },
  {
    id: 'supports',
    title: '向上搭框架支撑',
    description: '从四个角向上生长支撑，让结构从平面变成立体框架。',
  },
  {
    id: 'platform',
    title: '放上平台板',
    description: '在顶部加入 40×40cm 板子，形成可导出 BOM 和组装步骤的样例。',
  },
];

const targetComponents: DemoComponentRecipe[] = [
  { key: 'bottom_sw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
  { key: 'bottom_se', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
  { key: 'bottom_nw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
  { key: 'bottom_ne', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
  // Rotate the five-way nodes so each top corner exposes both a downward
  // support port and an upward board port. The board therefore shares the
  // structural node instead of overlapping a second connector at the corner.
  { key: 'top_sw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
  { key: 'top_se', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
  { key: 'top_nw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [-90, 0, 0] },
  { key: 'top_ne', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [-90, 0, 0] },

  { key: 'base_south', componentId: 'pipe_35cm', position: [0, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
  { key: 'base_north', componentId: 'pipe_35cm', position: [0, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
  { key: 'base_west', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, 0, 0], rotation: [0, 0, 0] },
  { key: 'base_east', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, 0, 0], rotation: [0, 0, 0] },

  { key: 'vertical_sw', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, GRID_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
  { key: 'vertical_se', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, GRID_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
  { key: 'vertical_nw', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, GRID_CM, PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
  { key: 'vertical_ne', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, GRID_CM, PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },

  { key: 'top_south', componentId: 'pipe_35cm', position: [0, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
  { key: 'top_north', componentId: 'pipe_35cm', position: [0, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
  { key: 'top_west', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, 0], rotation: [0, 0, 0] },
  { key: 'top_east', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, 0], rotation: [0, 0, 0] },

  { key: 'short_entry', componentId: 'pipe_15cm', position: [-PLATFORM_HALF_SPAN_CM, 0, SHORT_ENTRY_Z_CM], rotation: [0, 0, 0] },
  { key: 'platform_board', componentId: 'board_40x40', position: [0, BOARD_PLATFORM_Y_CM, 0], rotation: [0, 0, 0] },
];

const targetConnections: DemoConnectionRecipe[] = [
  { key: 'base_south_start', sourceKey: 'bottom_sw', sourcePointId: 'output1', targetKey: 'base_south', targetPointId: 'start' },
  { key: 'base_south_end', sourceKey: 'base_south', sourcePointId: 'end', targetKey: 'bottom_se', targetPointId: 'output2' },
  { key: 'base_north_start', sourceKey: 'bottom_nw', sourcePointId: 'output1', targetKey: 'base_north', targetPointId: 'start' },
  { key: 'base_north_end', sourceKey: 'base_north', sourcePointId: 'end', targetKey: 'bottom_ne', targetPointId: 'output2' },
  { key: 'base_west_start', sourceKey: 'bottom_sw', sourcePointId: 'output3', targetKey: 'base_west', targetPointId: 'start' },
  { key: 'base_west_end', sourceKey: 'base_west', sourcePointId: 'end', targetKey: 'bottom_nw', targetPointId: 'input' },
  { key: 'base_east_start', sourceKey: 'bottom_se', sourcePointId: 'output3', targetKey: 'base_east', targetPointId: 'start' },
  { key: 'base_east_end', sourceKey: 'base_east', sourcePointId: 'end', targetKey: 'bottom_ne', targetPointId: 'input' },

  { key: 'vertical_sw_bottom', sourceKey: 'bottom_sw', sourcePointId: 'output4', targetKey: 'vertical_sw', targetPointId: 'end' },
  { key: 'vertical_sw_top', sourceKey: 'vertical_sw', sourcePointId: 'start', targetKey: 'top_sw', targetPointId: 'output3' },
  { key: 'vertical_se_bottom', sourceKey: 'bottom_se', sourcePointId: 'output4', targetKey: 'vertical_se', targetPointId: 'end' },
  { key: 'vertical_se_top', sourceKey: 'vertical_se', sourcePointId: 'start', targetKey: 'top_se', targetPointId: 'output3' },
  { key: 'vertical_nw_bottom', sourceKey: 'bottom_nw', sourcePointId: 'output4', targetKey: 'vertical_nw', targetPointId: 'end' },
  { key: 'vertical_nw_top', sourceKey: 'vertical_nw', sourcePointId: 'start', targetKey: 'top_nw', targetPointId: 'input' },
  { key: 'vertical_ne_bottom', sourceKey: 'bottom_ne', sourcePointId: 'output4', targetKey: 'vertical_ne', targetPointId: 'end' },
  { key: 'vertical_ne_top', sourceKey: 'vertical_ne', sourcePointId: 'start', targetKey: 'top_ne', targetPointId: 'input' },

  { key: 'top_south_start', sourceKey: 'top_sw', sourcePointId: 'output1', targetKey: 'top_south', targetPointId: 'start' },
  { key: 'top_south_end', sourceKey: 'top_south', sourcePointId: 'end', targetKey: 'top_se', targetPointId: 'output2' },
  { key: 'top_north_start', sourceKey: 'top_nw', sourcePointId: 'output1', targetKey: 'top_north', targetPointId: 'start' },
  { key: 'top_north_end', sourceKey: 'top_north', sourcePointId: 'end', targetKey: 'top_ne', targetPointId: 'output2' },
  { key: 'top_west_start', sourceKey: 'top_sw', sourcePointId: 'output4', targetKey: 'top_west', targetPointId: 'start' },
  { key: 'top_west_end', sourceKey: 'top_west', sourcePointId: 'end', targetKey: 'top_nw', targetPointId: 'output4' },
  { key: 'top_east_start', sourceKey: 'top_se', sourcePointId: 'output4', targetKey: 'top_east', targetPointId: 'start' },
  { key: 'top_east_end', sourceKey: 'top_east', sourcePointId: 'end', targetKey: 'top_ne', targetPointId: 'output4' },

  { key: 'board_sw', sourceKey: 'top_sw', sourcePointId: 'platform_mount', targetKey: 'platform_board', targetPointId: 'corner1', type: 'board-mount' },
  { key: 'board_se', sourceKey: 'top_se', sourcePointId: 'platform_mount', targetKey: 'platform_board', targetPointId: 'corner2', type: 'board-mount' },
  { key: 'board_ne', sourceKey: 'top_ne', sourcePointId: 'platform_mount', targetKey: 'platform_board', targetPointId: 'corner3', type: 'board-mount' },
  { key: 'board_nw', sourceKey: 'top_nw', sourcePointId: 'platform_mount', targetKey: 'platform_board', targetPointId: 'corner4', type: 'board-mount' },

  { key: 'short_entry_start', sourceKey: 'bottom_sw', sourcePointId: 'input', targetKey: 'short_entry', targetPointId: 'end' },
];

const defaultIdFactory = (prefix: string): DemoIdFactory => {
  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return (semanticId) => `${prefix}_${semanticId}_${seed}`;
};

const isNear = (value: number, target: number, tolerance = 1) => Math.abs(value - target) <= tolerance;
const isConnector = (component: ComponentInstance) => component.componentId.startsWith('connector_');
const isBoard = (component: ComponentInstance) => component.componentId.startsWith('board_');
const isPipe35 = (component: ComponentInstance) => component.componentId === 'pipe_35cm';
const isPipe15 = (component: ComponentInstance) => component.componentId === 'pipe_15cm';
const isVerticalPipe = (component: ComponentInstance) => {
  const [rx, , rz] = component.rotation.map((value) => Math.abs(value % 180));
  return isPipe35(component) && (rx >= 45 || rz >= 45);
};

const componentFromRecipe = (recipe: DemoComponentRecipe, instanceId: string): ComponentInstance => ({
  instanceId,
  componentId: recipe.componentId,
  position: recipe.position,
  rotation: recipe.rotation,
  scale: [1, 1, 1],
});

const connectionFromRecipe = (
  recipe: DemoConnectionRecipe,
  instanceIds: Record<string, string>,
  idFactory: DemoIdFactory
): Connection => ({
  id: idFactory(`conn_${recipe.key}`),
  source: {
    componentId: instanceIds[recipe.sourceKey],
    pointId: recipe.sourcePointId,
  },
  target: {
    componentId: instanceIds[recipe.targetKey],
    pointId: recipe.targetPointId,
  },
  type: recipe.type ?? 'socket',
  isActive: true,
});

class BeginnerDemoSystem {
  getDimensionSpec(): BeginnerDemoDimensionSpec {
    return {
      gridCm: SIZE_SPECS.grid,
      longPipeCm: getComponentById('pipe_35cm')?.length ?? SIZE_SPECS.pipe35,
      shortPipeCm: getComponentById('pipe_15cm')?.length ?? SIZE_SPECS.pipe15,
      longPipeReferenceSpan: 2,
      shortPipeReferenceSpan: 1,
    };
  }

  dimensionsAreLocked(): boolean {
    const spec = this.getDimensionSpec();
    return (
      spec.gridCm === 20 &&
      spec.longPipeCm === 35 &&
      spec.shortPipeCm === 15 &&
      spec.longPipeReferenceSpan === 2 &&
      spec.shortPipeReferenceSpan === 1
    );
  }

  getSteps(): BeginnerDemoStep[] {
    return DEMO_STEPS;
  }

  createStarterDesign(idFactory: DemoIdFactory = defaultIdFactory('beginner_starter')): BeginnerDemoDesign {
    const pipeId = idFactory('starter_pipe');
    return {
      components: [
        {
          instanceId: pipeId,
          componentId: 'pipe_35cm',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
      connections: [],
      selectInstanceId: pipeId,
      starterEndpoint: { componentId: pipeId, pointId: 'end' },
    };
  }

  createTargetDesign(idFactory: DemoIdFactory = defaultIdFactory('beginner_target')): BeginnerDemoDesign {
    const instanceIds = targetComponents.reduce<Record<string, string>>((ids, recipe) => {
      ids[recipe.key] = idFactory(recipe.key);
      return ids;
    }, {});

    return {
      components: targetComponents.map((recipe) => componentFromRecipe(recipe, instanceIds[recipe.key])),
      connections: targetConnections.map((recipe) => connectionFromRecipe(recipe, instanceIds, idFactory)),
      selectInstanceId: instanceIds.platform_board,
    };
  }

  scopeDesign(
    design: { components: ComponentInstance[]; connections: Connection[] },
    scope: { componentIds: string[]; connectionIds: string[] }
  ): { components: ComponentInstance[]; connections: Connection[] } {
    if (scope.componentIds.length === 0 && scope.connectionIds.length === 0) {
      return { components: [], connections: [] };
    }

    const scopedComponentIds = new Set(scope.componentIds);
    const scopedConnectionIds = new Set(scope.connectionIds);
    const components = design.components.filter((component) => scopedComponentIds.has(component.instanceId));
    const connections = design.connections.filter(
      (connection) =>
        scopedConnectionIds.has(connection.id) &&
        scopedComponentIds.has(connection.source.componentId) &&
        scopedComponentIds.has(connection.target.componentId)
    );

    return { components, connections };
  }

  evaluateDemoProgress(
    design: { components: ComponentInstance[]; connections: Connection[] },
    practice: BeginnerDemoPracticeState = { endpointGrowthPracticed: false }
  ): BeginnerDemoProgress {
    const { components, connections } = design;
    const activeConnections = connections.filter((connection) => connection.isActive);
    const componentIds = new Set(components.map((component) => component.instanceId));
    const activeConnectionIds = new Set(activeConnections.map((connection) => connection.id));
    const connectedComponentIds = new Set<string>();
    activeConnections.forEach((connection) => {
      connectedComponentIds.add(connection.source.componentId);
      connectedComponentIds.add(connection.target.componentId);
    });
    const practiceComponentIds = practice.practiceComponentIds ?? [];
    const practiceConnectionIds = practice.practiceConnectionIds ?? [];
    const practicePlacementPresent =
      practiceComponentIds.length >= 2 &&
      practiceConnectionIds.length >= 2 &&
      practiceComponentIds.every((id) => componentIds.has(id)) &&
      practiceConnectionIds.every((id) => activeConnectionIds.has(id));

    const pipe35Count = components.filter(isPipe35).length;
    const pipe15Count = components.filter(isPipe15).length;
    const connectorCount = components.filter(isConnector).length;
    const boardCount = components.filter(isBoard).length;
    const boardConnected = components.some((component) => isBoard(component) && connectedComponentIds.has(component.instanceId));
    const bottomConnectorCount = components.filter((component) => isConnector(component) && isNear(component.position[1], 0)).length;
    const basePipeCount = components.filter((component) => isPipe35(component) && isNear(component.position[1], 0)).length;
    const verticalSupportCount = components.filter((component) => isVerticalPipe(component) && component.position[1] >= 15).length;
    const upperFrameCount = components.filter((component) => isPipe35(component) && component.position[1] >= 35).length;

    const checks: BeginnerDemoCheck[] = [
      {
        id: 'dimensions',
        label: '尺寸锁定',
        complete: this.dimensionsAreLocked(),
        detail: '管子保持 15cm / 25cm / 35cm 标准规格，参考线保持 20cm。',
        structural: true,
      },
      {
        id: 'endpoint-growth-practice',
        label: '端点生长练习',
        complete: practice.endpointGrowthPracticed && practicePlacementPresent,
        detail: '必须在当前 demo 快照中通过端点方向手柄真实添加一次“接头 + 管子”。',
        structural: false,
      },
      {
        id: 'base-frame',
        label: '基础架',
        complete: basePipeCount >= 4 && bottomConnectorCount >= 4,
        detail: '底部至少包含 4 根 35cm 管和 4 个角接头。',
        structural: true,
      },
      {
        id: 'support-frame',
        label: '立体框架',
        complete: verticalSupportCount >= 4 && upperFrameCount >= 4,
        detail: '包含向上支撑和顶部框架管件。',
        structural: true,
      },
      {
        id: 'platform-board',
        label: '平台板连接',
        complete: boardCount >= 1 && boardConnected,
        detail: '平台板需要存在并通过连接关系挂到框架上。',
        structural: true,
      },
      {
        id: 'short-pipe',
        label: '15cm 短管',
        complete: pipe15Count >= 1,
        detail: '样例中至少包含一根 15cm 管，BOM 能体现两种管材。',
        structural: true,
      },
      {
        id: 'bom-ready',
        label: 'BOM 清单就绪',
        complete: pipe35Count > 0 && pipe15Count > 0 && connectorCount > 0 && boardCount > 0,
        detail: '物料中同时包含长管、短管、接头和板子。',
        structural: true,
      },
      {
        id: 'assembly-ready',
        label: '组装步骤就绪',
        complete: activeConnections.length >= 16 && boardConnected,
        detail: '连接关系足够生成自底向上的组装步骤。',
        structural: true,
      },
    ];

    const completedChecks = checks.filter((check) => check.complete).length;
    const structuralChecks = checks.filter((check) => check.structural);
    const structuralComplete = structuralChecks.every((check) => check.complete);
    const firstIncomplete = checks.find((check) => !check.complete);

    return {
      checks,
      completedChecks,
      totalChecks: checks.length,
      structuralComplete,
      isComplete: checks.every((check) => check.complete),
      percent: Math.round((completedChecks / checks.length) * 100),
      nextAction: firstIncomplete
        ? `下一步：完成「${firstIncomplete.label}」`
        : 'Demo 闭环完成：可以导出 BOM 和组装步骤。',
    };
  }
}

export const beginnerDemoSystem = new BeginnerDemoSystem();
