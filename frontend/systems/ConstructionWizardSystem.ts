import type { ComponentInstance, Connection } from '../types';
import { getComponentById, SIZE_SPECS } from '../stores/componentLibrary';
import { boardMountSystem, type BoardComponentId } from './BoardMountSystem';
import type { TopologyPatch } from './ConnectorTopologySystem';

export type WizardGoalId = 'basic-platform-frame';

export type WizardActionKind =
  | 'extend-base'
  | 'add-supports'
  | 'add-top-frame'
  | 'add-board'
  | 'add-short-entry';

export type WizardLayer = 'base' | 'support' | 'platform';

export interface WizardGoal {
  id: WizardGoalId;
  title: string;
  description: string;
  enabled: boolean;
}

export interface ConstructionWizardDimensionSpec {
  gridCm: number;
  longPipeCm: number;
  shortPipeCm: number;
  longPipeReferenceSpan: 2;
  shortPipeReferenceSpan: 1;
}

export interface ConstructionWizardModuleRecord {
  id: string;
  candidateId: string;
  kind: WizardActionKind;
  layer: WizardLayer;
  label: string;
  componentIds: string[];
  connectionIds: string[];
  semanticIds: Record<string, string>;
  materialDelta: Record<string, number>;
  committedAt: number;
}

export interface ConstructionWizardSessionState {
  active: boolean;
  sessionId: string | null;
  goalId: WizardGoalId | null;
  currentLayer: WizardLayer;
  selectedCandidateId: string | null;
  moduleHistory: ConstructionWizardModuleRecord[];
}

export interface WizardModuleCandidate {
  id: string;
  goalId: WizardGoalId;
  moduleId: string;
  label: string;
  description: string;
  kind: WizardActionKind;
  layer: WizardLayer;
  previewComponents: ComponentInstance[];
  previewConnections: Connection[];
  commitComponents: ComponentInstance[];
  commitConnections: Connection[];
  topologyPatch?: TopologyPatch;
  materialDelta: Record<string, number>;
  semanticIds: Record<string, string>;
  selectInstanceId?: string;
  previewBounds: {
    center: [number, number, number];
    size: [number, number, number];
  };
}

export interface ConstructionWizardProgressCheck {
  id: 'goal' | WizardActionKind | 'dimensions' | 'bom-ready' | 'assembly-ready';
  label: string;
  complete: boolean;
  detail: string;
}

export interface ConstructionWizardProgress {
  checks: ConstructionWizardProgressCheck[];
  completedChecks: number;
  totalChecks: number;
  percent: number;
  isComplete: boolean;
  nextAction: string;
}

export interface ConstructionWizardInput {
  components: ComponentInstance[];
  connections: Connection[];
  wizard: ConstructionWizardSessionState;
}

type Tuple3 = [number, number, number];

interface ComponentRecipe {
  key: string;
  componentId: string;
  position: Tuple3;
  rotation: Tuple3;
}

interface ConnectionRecipe {
  key: string;
  sourceKey: string;
  sourcePointId: string;
  targetKey: string;
  targetPointId: string;
}

interface ModuleRecipe {
  kind: WizardActionKind;
  layer: WizardLayer;
  label: string;
  description: string;
  components: ComponentRecipe[];
  connections: ConnectionRecipe[];
  requiredKeys: string[];
  selectKey?: string;
  bounds: WizardModuleCandidate['previewBounds'];
}

const GRID_CM = SIZE_SPECS.grid;
const PLATFORM_HALF_SPAN_CM = SIZE_SPECS.board40x40.width / 2;
const PLATFORM_HEIGHT_CM = GRID_CM * 2;
const BOARD_PLATFORM_Y_CM = PLATFORM_HEIGHT_CM;
const SHORT_ENTRY_Z_CM = -PLATFORM_HALF_SPAN_CM - (SIZE_SPECS.pipe15 + SIZE_SPECS.connector) / 2;

const GOALS: WizardGoal[] = [
  {
    id: 'basic-platform-frame',
    title: '基础平台架',
    description: '用 5 次以内的结构动作完成底架、支撑、顶部框和平台板。',
    enabled: true,
  },
];

const MODULE_ORDER: WizardActionKind[] = [
  'extend-base',
  'add-supports',
  'add-top-frame',
  'add-board',
  'add-short-entry',
];

const MODULE_RECIPES: Record<WizardActionKind, ModuleRecipe> = {
  'extend-base': {
    kind: 'extend-base',
    layer: 'base',
    label: '① 放置 2×2 基础架',
    description: '自动放入四个底部接头和四根 35cm 管，形成 40×40cm 基础框。',
    requiredKeys: [],
    selectKey: 'base_south',
    bounds: {
      center: [0, 4, 0],
      size: [48, 12, 48],
    },
    components: [
      { key: 'bottom_sw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
      { key: 'bottom_se', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
      { key: 'bottom_nw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
      { key: 'bottom_ne', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 0, 0] },
      { key: 'base_south', componentId: 'pipe_35cm', position: [0, 0, -PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
      { key: 'base_north', componentId: 'pipe_35cm', position: [0, 0, PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
      { key: 'base_west', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, 0, 0], rotation: [0, 0, 0] },
      { key: 'base_east', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, 0, 0], rotation: [0, 0, 0] },
    ],
    connections: [
      { key: 'base_south_start', sourceKey: 'bottom_sw', sourcePointId: 'output1', targetKey: 'base_south', targetPointId: 'start' },
      { key: 'base_south_end', sourceKey: 'base_south', sourcePointId: 'end', targetKey: 'bottom_se', targetPointId: 'output2' },
      { key: 'base_north_start', sourceKey: 'bottom_nw', sourcePointId: 'output1', targetKey: 'base_north', targetPointId: 'start' },
      { key: 'base_north_end', sourceKey: 'base_north', sourcePointId: 'end', targetKey: 'bottom_ne', targetPointId: 'output2' },
      { key: 'base_west_start', sourceKey: 'bottom_sw', sourcePointId: 'output3', targetKey: 'base_west', targetPointId: 'start' },
      { key: 'base_west_end', sourceKey: 'base_west', sourcePointId: 'end', targetKey: 'bottom_nw', targetPointId: 'input' },
      { key: 'base_east_start', sourceKey: 'bottom_se', sourcePointId: 'output3', targetKey: 'base_east', targetPointId: 'start' },
      { key: 'base_east_end', sourceKey: 'base_east', sourcePointId: 'end', targetKey: 'bottom_ne', targetPointId: 'input' },
    ],
  },
  'add-supports': {
    kind: 'add-supports',
    layer: 'support',
    label: '② 向上加四根支撑',
    description: '从四个角向上补齐 35cm 支撑管和顶部接头，让平面变成立体框架。',
    requiredKeys: ['bottom_sw', 'bottom_se', 'bottom_nw', 'bottom_ne'],
    selectKey: 'vertical_sw',
    bounds: {
      center: [0, PLATFORM_HEIGHT_CM / 2, 0],
      size: [48, PLATFORM_HEIGHT_CM + 10, 48],
    },
    components: [
      { key: 'top_sw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [180, 0, 0] },
      { key: 'top_se', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [180, 0, 0] },
      { key: 'top_nw', componentId: 'connector_5way', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [180, 0, 0] },
      { key: 'top_ne', componentId: 'connector_5way', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [180, 0, 0] },
      { key: 'vertical_sw', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, GRID_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
      { key: 'vertical_se', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, GRID_CM, -PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
      { key: 'vertical_nw', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, GRID_CM, PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
      { key: 'vertical_ne', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, GRID_CM, PLATFORM_HALF_SPAN_CM], rotation: [90, 0, 0] },
    ],
    connections: [
      { key: 'vertical_sw_bottom', sourceKey: 'bottom_sw', sourcePointId: 'output4', targetKey: 'vertical_sw', targetPointId: 'end' },
      { key: 'vertical_sw_top', sourceKey: 'vertical_sw', sourcePointId: 'start', targetKey: 'top_sw', targetPointId: 'output4' },
      { key: 'vertical_se_bottom', sourceKey: 'bottom_se', sourcePointId: 'output4', targetKey: 'vertical_se', targetPointId: 'end' },
      { key: 'vertical_se_top', sourceKey: 'vertical_se', sourcePointId: 'start', targetKey: 'top_se', targetPointId: 'output4' },
      { key: 'vertical_nw_bottom', sourceKey: 'bottom_nw', sourcePointId: 'output4', targetKey: 'vertical_nw', targetPointId: 'end' },
      { key: 'vertical_nw_top', sourceKey: 'vertical_nw', sourcePointId: 'start', targetKey: 'top_nw', targetPointId: 'output4' },
      { key: 'vertical_ne_bottom', sourceKey: 'bottom_ne', sourcePointId: 'output4', targetKey: 'vertical_ne', targetPointId: 'end' },
      { key: 'vertical_ne_top', sourceKey: 'vertical_ne', sourcePointId: 'start', targetKey: 'top_ne', targetPointId: 'output4' },
    ],
  },
  'add-top-frame': {
    kind: 'add-top-frame',
    layer: 'platform',
    label: '③ 补顶部框架',
    description: '在顶部四边补齐 35cm 管，为平台板提供清晰边框。',
    requiredKeys: ['top_sw', 'top_se', 'top_nw', 'top_ne'],
    selectKey: 'top_south',
    bounds: {
      center: [0, PLATFORM_HEIGHT_CM + 4, 0],
      size: [48, 12, 48],
    },
    components: [
      { key: 'top_south', componentId: 'pipe_35cm', position: [0, PLATFORM_HEIGHT_CM, -PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
      { key: 'top_north', componentId: 'pipe_35cm', position: [0, PLATFORM_HEIGHT_CM, PLATFORM_HALF_SPAN_CM], rotation: [0, 90, 0] },
      { key: 'top_west', componentId: 'pipe_35cm', position: [-PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, 0], rotation: [0, 0, 0] },
      { key: 'top_east', componentId: 'pipe_35cm', position: [PLATFORM_HALF_SPAN_CM, PLATFORM_HEIGHT_CM, 0], rotation: [0, 0, 0] },
    ],
    connections: [
      { key: 'top_south_start', sourceKey: 'top_sw', sourcePointId: 'output1', targetKey: 'top_south', targetPointId: 'start' },
      { key: 'top_south_end', sourceKey: 'top_south', sourcePointId: 'end', targetKey: 'top_se', targetPointId: 'output2' },
      { key: 'top_north_start', sourceKey: 'top_nw', sourcePointId: 'output1', targetKey: 'top_north', targetPointId: 'start' },
      { key: 'top_north_end', sourceKey: 'top_north', sourcePointId: 'end', targetKey: 'top_ne', targetPointId: 'output2' },
      { key: 'top_west_start', sourceKey: 'top_sw', sourcePointId: 'input', targetKey: 'top_west', targetPointId: 'start' },
      { key: 'top_west_end', sourceKey: 'top_west', sourcePointId: 'end', targetKey: 'top_nw', targetPointId: 'output3' },
      { key: 'top_east_start', sourceKey: 'top_se', sourcePointId: 'input', targetKey: 'top_east', targetPointId: 'start' },
      { key: 'top_east_end', sourceKey: 'top_east', sourcePointId: 'end', targetKey: 'top_ne', targetPointId: 'output3' },
    ],
  },
  'add-board': {
    kind: 'add-board',
    layer: 'platform',
    label: '④ 放平台板',
    description: '放入 40×40cm 平台板和四个板夹，让 BOM / 组装步骤能明确平台层。',
    requiredKeys: ['top_south', 'top_north', 'top_west', 'top_east'],
    selectKey: 'platform_board',
    bounds: {
      center: [0, BOARD_PLATFORM_Y_CM + 1, 0],
      size: [44, 8, 44],
    },
    components: [
      { key: 'platform_board', componentId: 'board_40x40', position: [0, BOARD_PLATFORM_Y_CM, 0], rotation: [0, 0, 0] },
    ],
    connections: [],
  },
  'add-short-entry': {
    kind: 'add-short-entry',
    layer: 'base',
    label: '⑤ 加 15cm 入口短管',
    description: '在底部入口处补一根 15cm 管，确保 BOM 同时体现长管和短管。',
    requiredKeys: ['bottom_sw'],
    selectKey: 'short_entry',
    bounds: {
      center: [-PLATFORM_HALF_SPAN_CM, 4, SHORT_ENTRY_Z_CM],
      size: [12, 12, 24],
    },
    components: [
      { key: 'short_entry', componentId: 'pipe_15cm', position: [-PLATFORM_HALF_SPAN_CM, 0, SHORT_ENTRY_Z_CM], rotation: [0, 0, 0] },
    ],
    connections: [
      { key: 'short_entry_start', sourceKey: 'bottom_sw', sourcePointId: 'input', targetKey: 'short_entry', targetPointId: 'end' },
    ],
  },
};

export const createInitialConstructionWizardState = (): ConstructionWizardSessionState => ({
  active: false,
  sessionId: null,
  goalId: null,
  currentLayer: 'base',
  selectedCandidateId: null,
  moduleHistory: [],
});

const countMaterials = (components: ComponentInstance[]) =>
  components.reduce<Record<string, number>>((delta, component) => {
    delta[component.componentId] = (delta[component.componentId] ?? 0) + 1;
    return delta;
  }, {});

const cloneComponent = (component: ComponentInstance): ComponentInstance => ({
  ...component,
  position: [...component.position] as Tuple3,
  rotation: [...component.rotation] as Tuple3,
  scale: [...component.scale] as Tuple3,
  properties: component.properties ? { ...component.properties } : undefined,
});

const cloneConnection = (connection: Connection): Connection => ({
  ...connection,
  source: { ...connection.source },
  target: { ...connection.target },
});

const createBoardPatchCandidate = (
  module: ModuleRecipe,
  sessionId: string,
  semanticIds: Record<string, string>,
  components: ComponentInstance[],
  connections: Connection[]
): {
  topologyPatch: TopologyPatch;
  previewComponents: ComponentInstance[];
  previewConnections: Connection[];
  commitComponents: ComponentInstance[];
  commitConnections: Connection[];
  selectInstanceId: string;
} | null => {
  const boardComponentId: BoardComponentId = 'board_40x40';
  const expectedCenter = module.bounds.center;
  const site = boardMountSystem
    .listBoardMountSites({
      boardComponentId,
      components,
      connections,
    })
    .find(candidateSite =>
      Math.abs(candidateSite.position[0] - expectedCenter[0]) <= 1 &&
      Math.abs(candidateSite.position[1] - expectedCenter[1]) <= 1 &&
      Math.abs(candidateSite.position[2] - expectedCenter[2]) <= 1
    );
  if (!site) return null;
  const boardInstanceId = semanticIds.platform_board;
  let topologyIdSequence = 0;
  const topologyPatch = boardMountSystem.createBoardPlacementPatch({
    site,
    boardInstanceId,
    components,
    connections,
    idFactory: prefix =>
      `wizard_${sessionId}_${module.kind}_${prefix}_${topologyIdSequence++}`,
  });
  if (!topologyPatch) return null;

  return {
    topologyPatch,
    previewComponents: topologyPatch.addComponents.length > 0 ? topologyPatch.addComponents : [
      {
        instanceId: boardInstanceId,
        componentId: boardComponentId,
        position: site.position,
        rotation: site.rotation,
        scale: [1, 1, 1],
      },
    ],
    previewConnections: topologyPatch.addConnections,
    commitComponents: [],
    commitConnections: [],
    selectInstanceId: boardInstanceId,
  };
};

const createComponent = (
  recipe: ComponentRecipe,
  instanceId: string,
  module: ModuleRecipe
): ComponentInstance => ({
  instanceId,
  componentId: recipe.componentId,
  position: [...recipe.position] as Tuple3,
  rotation: [...recipe.rotation] as Tuple3,
  scale: [1, 1, 1],
  properties: {
    constructionWizard: {
      semanticKey: recipe.key,
      moduleKind: module.kind,
      layer: module.layer,
    },
  },
});

const createConnection = (
  recipe: ConnectionRecipe,
  semanticIds: Record<string, string>,
  module: ModuleRecipe,
  sessionId: string
): Connection => ({
  id: `wizard_${sessionId}_${module.kind}_${recipe.key}`,
  source: {
    componentId: semanticIds[recipe.sourceKey],
    pointId: recipe.sourcePointId,
  },
  target: {
    componentId: semanticIds[recipe.targetKey],
    pointId: recipe.targetPointId,
  },
  type: 'socket',
  isActive: true,
});

const activeModuleRecords = (
  wizard: ConstructionWizardSessionState,
  components: ComponentInstance[],
  connections: Connection[]
) => {
  const componentIds = new Set(components.map(component => component.instanceId));
  const connectionIds = new Set(connections.map(connection => connection.id));

  return wizard.moduleHistory.filter(record =>
    record.componentIds.every(id => componentIds.has(id)) &&
    record.connectionIds.every(id => connectionIds.has(id))
  );
};

const buildSemanticMap = (
  wizard: ConstructionWizardSessionState,
  components: ComponentInstance[],
  connections: Connection[]
) =>
  activeModuleRecords(wizard, components, connections).reduce<Record<string, string>>((map, record) => {
    Object.entries(record.semanticIds).forEach(([key, id]) => {
      map[key] = id;
    });
    return map;
  }, {});

const completedKinds = (
  wizard: ConstructionWizardSessionState,
  components: ComponentInstance[],
  connections: Connection[]
) => new Set(activeModuleRecords(wizard, components, connections).map(record => record.kind));

const nextLayerAfterCommit = (kind: WizardActionKind): WizardLayer => {
  switch (kind) {
    case 'extend-base':
      return 'support';
    case 'add-supports':
    case 'add-top-frame':
    case 'add-board':
      return 'platform';
    case 'add-short-entry':
      return 'base';
  }
};

class ConstructionWizardSystem {
  getGoals(): WizardGoal[] {
    return GOALS;
  }

  getDimensionSpec(): ConstructionWizardDimensionSpec {
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

  createSession(goalId: WizardGoalId = 'basic-platform-frame'): ConstructionWizardSessionState {
    return {
      active: true,
      sessionId: `construction_wizard_${goalId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      goalId,
      currentLayer: 'base',
      selectedCandidateId: null,
      moduleHistory: [],
    };
  }

  cloneSession(wizard: ConstructionWizardSessionState): ConstructionWizardSessionState {
    return {
      ...wizard,
      moduleHistory: wizard.moduleHistory.map(record => ({
        ...record,
        componentIds: [...record.componentIds],
        connectionIds: [...record.connectionIds],
        semanticIds: { ...record.semanticIds },
        materialDelta: { ...record.materialDelta },
      })),
    };
  }

  getNextLayerAfterCommit(kind: WizardActionKind): WizardLayer {
    return nextLayerAfterCommit(kind);
  }

  generateCandidates(input: ConstructionWizardInput): WizardModuleCandidate[] {
    const { components, connections, wizard } = input;
    if (!wizard.active || wizard.goalId !== 'basic-platform-frame' || !wizard.sessionId) return [];

    const done = completedKinds(wizard, components, connections);
    const semanticMap = buildSemanticMap(wizard, components, connections);
    const nextKind = MODULE_ORDER.find(kind => !done.has(kind));
    if (!nextKind) return [];

    const module = MODULE_RECIPES[nextKind];
    if (!module.requiredKeys.every(key => semanticMap[key])) return [];

    const moduleSemanticIds = module.components.reduce<Record<string, string>>((ids, recipe) => {
      ids[recipe.key] = `wizard_${wizard.sessionId}_${module.kind}_${recipe.key}`;
      return ids;
    }, {});
    const semanticIds = { ...semanticMap, ...moduleSemanticIds };
    const commitComponents = module.components.map(recipe =>
      createComponent(recipe, semanticIds[recipe.key], module)
    );
    const commitConnections = module.connections.map(recipe =>
      createConnection(recipe, semanticIds, module, wizard.sessionId!)
    );
    const boardPatch = module.kind === 'add-board'
      ? createBoardPatchCandidate(
          module,
          wizard.sessionId!,
          semanticIds,
          components,
          connections
        )
      : null;
    if (module.kind === 'add-board' && !boardPatch) return [];
    const candidate: WizardModuleCandidate = {
      id: `${wizard.goalId}:${module.kind}`,
      goalId: wizard.goalId,
      moduleId: `module_${wizard.sessionId}_${module.kind}`,
      label: module.label,
      description: module.description,
      kind: module.kind,
      layer: module.layer,
      previewComponents: (module.kind === 'add-board' && boardPatch
        ? boardPatch.previewComponents
        : commitComponents).map(cloneComponent),
      previewConnections: (module.kind === 'add-board' && boardPatch
        ? boardPatch.previewConnections
        : commitConnections).map(cloneConnection),
      commitComponents: module.kind === 'add-board' && boardPatch
        ? boardPatch.commitComponents
        : commitComponents,
      commitConnections: module.kind === 'add-board' ? [] : commitConnections,
      topologyPatch: module.kind === 'add-board' ? boardPatch?.topologyPatch : undefined,
      materialDelta: countMaterials(commitComponents),
      semanticIds: moduleSemanticIds,
      selectInstanceId:
        module.kind === 'add-board'
          ? boardPatch?.selectInstanceId
          : module.selectKey
            ? semanticIds[module.selectKey]
            : commitComponents[0]?.instanceId,
      previewBounds: {
        center: [...module.bounds.center] as Tuple3,
        size: [...module.bounds.size] as Tuple3,
      },
    };

    return [candidate];
  }

  createModuleRecord(candidate: WizardModuleCandidate, committedAt = Date.now()): ConstructionWizardModuleRecord {
    const hasTopologyPatch = Boolean(candidate.topologyPatch);
    const topologyPatch = hasTopologyPatch
      ? this.extractTopologyPatchForRecord(candidate)
      : null;

    return {
      id: candidate.moduleId,
      candidateId: candidate.id,
      kind: candidate.kind,
      layer: candidate.layer,
      label: candidate.label,
      componentIds: hasTopologyPatch && topologyPatch
        ? topologyPatch.componentIds
        : candidate.commitComponents.map(component => component.instanceId),
      connectionIds: hasTopologyPatch && topologyPatch
        ? topologyPatch.connectionIds
        : candidate.commitConnections.map(connection => connection.id),
      semanticIds: { ...candidate.semanticIds },
      materialDelta: { ...candidate.materialDelta },
      committedAt,
    };
  }

  private extractTopologyPatchForRecord(candidate: WizardModuleCandidate): {
    componentIds: string[];
    connectionIds: string[];
  } | null {
    if (!candidate.topologyPatch) return null;
    const componentIds = new Set<string>();
    const connectionIds = new Set<string>();

    candidate.topologyPatch.addComponents.forEach(component =>
      componentIds.add(component.instanceId)
    );
    if (candidate.kind !== 'add-board') {
      candidate.topologyPatch.addConnections.forEach(connection =>
        connectionIds.add(connection.id)
      );
    }

    const boardId = candidate.semanticIds.platform_board;
    if (boardId) {
      componentIds.add(boardId);
    }

    if (componentIds.size === 0 && connectionIds.size === 0) return null;

    return {
      componentIds: [...componentIds],
      connectionIds: [...connectionIds],
    };
  }

  evaluateProgress(input: ConstructionWizardInput): ConstructionWizardProgress {
    const { components, connections, wizard } = input;
    const done = completedKinds(wizard, components, connections);
    const componentIds = new Set(components.map(component => component.instanceId));
    const connectionIds = new Set(connections.map(connection => connection.id));
    const activeRecords = activeModuleRecords(wizard, components, connections);
    const activeRecordIds = new Set(activeRecords.map(record => record.id));
    const scopedComponents = components.filter(component =>
      activeRecords.some(record => record.componentIds.includes(component.instanceId))
    );
    const scopedConnections = connections.filter(connection =>
      activeRecords.some(record => record.connectionIds.includes(connection.id))
    );
    const hasMaterial = (componentId: string) =>
      scopedComponents.some(component => component.componentId === componentId);
    const activeConnectionsComplete = activeRecords.every(record =>
      record.componentIds.every(id => componentIds.has(id)) &&
      record.connectionIds.every(id => connectionIds.has(id))
    );

    const checks: ConstructionWizardProgressCheck[] = [
      {
        id: 'goal',
        label: '选择目标',
        complete: wizard.active && wizard.goalId === 'basic-platform-frame',
        detail: '已进入基础平台架结构向导。',
      },
      {
        id: 'dimensions',
        label: '尺寸锁定',
        complete: this.dimensionsAreLocked(),
        detail: '15cm / 25cm / 35cm 标准管和 20cm 模块参考线保持不变。',
      },
      {
        id: 'extend-base',
        label: '基础架',
        complete: done.has('extend-base'),
        detail: '底层 2×2 基础框已由向导模块生成。',
      },
      {
        id: 'add-supports',
        label: '支撑层',
        complete: done.has('add-supports'),
        detail: '四根立柱和顶部角接头已生成。',
      },
      {
        id: 'add-top-frame',
        label: '顶部框架',
        complete: done.has('add-top-frame'),
        detail: '顶部四边框已补齐。',
      },
      {
        id: 'add-board',
        label: '平台板',
        complete: done.has('add-board'),
        detail: '平台板和板夹已生成。',
      },
      {
        id: 'add-short-entry',
        label: '入口短管',
        complete: done.has('add-short-entry'),
        detail: '15cm 入口短管已生成。',
      },
      {
        id: 'bom-ready',
        label: 'BOM 就绪',
        complete:
          hasMaterial('pipe_35cm') &&
          hasMaterial('pipe_15cm') &&
          scopedComponents.some(component => component.componentId.startsWith('connector_')) &&
          hasMaterial('board_40x40'),
        detail: '真实组件数据已包含长管、短管、接头和板子。',
      },
      {
        id: 'assembly-ready',
        label: '组装步骤就绪',
        complete: done.size === MODULE_ORDER.length && scopedConnections.length >= 25 && activeConnectionsComplete,
        detail: '模块连接关系完整，可生成自底向上的组装步骤。',
      },
    ];
    const completedChecks = checks.filter(check => check.complete).length;
    const firstIncomplete = checks.find(check => !check.complete);

    return {
      checks,
      completedChecks,
      totalChecks: checks.length,
      percent: Math.round((completedChecks / checks.length) * 100),
      isComplete: checks.every(check => check.complete) && activeRecordIds.size === MODULE_ORDER.length,
      nextAction: firstIncomplete
        ? `下一步：${firstIncomplete.label}`
        : '基础平台架已完成，可以导出 BOM 和组装步骤。',
    };
  }
}

export const constructionWizardSystem = new ConstructionWizardSystem();
