import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { ComponentInstance, Connection, Design } from '../types';
import { PIPE_COLOR_OPTIONS } from '../types';
import {
  componentDefinitions,
  DIAGONAL_PIPE_LENGTHS,
  getAllComponents,
  getComponentById,
  SIZE_SPECS,
} from '../stores/componentLibrary';
import {
  getPipeCenterlineSpec,
  REFERENCE_PRODUCT_PROFILE_V1,
  REFERENCE_PRODUCT_PROFILE_VERSION,
  REFERENCE_PRODUCT_SPEC,
} from '../referenceProductSpec';
import { beginnerDemoSystem } from '../systems/BeginnerDemoSystem';
import { constructionWizardSystem } from '../systems/ConstructionWizardSystem';
import { constructionEngine, getWorldPosition } from '../systems/ConstructionEngine';
import {
  endpointGrowthSystem,
} from '../systems/EndpointGrowthSystem';
import { connectorTopologySystem } from '../systems/ConnectorTopologySystem';
import {
  auditTopology,
  createRepairPatch,
  resolvePlacementContacts,
  topologyIntegritySystem,
} from '../systems/TopologyIntegritySystem';
import { classifySceneInteractionTarget, GROWTH_HANDLE_USER_DATA } from '../systems/SceneInteractionTarget';
import { useDesignStore } from '../stores/designStore';
import { useInteractionStore } from '../stores/interactionStore';
import { calculateMaterialRequirement } from '../utils/calculationUtils';
import { exportManager } from '../systems/ExportManager';
import {
  assemblyStepSystem,
  validateAssemblyGuide,
} from '../systems/AssemblyStepSystem';
import {
  activateDefaultGrowthEndpoint,
  cancelActiveInteraction,
  commitActiveBuildTask,
  commitActivePlacement,
  commitActiveGrowthCandidate,
  commitSuggestedComponentMove,
} from '../systems/EditorInteractionCommands';
import { createComponentGeometry } from '../components/3d/utils/geometryUtils';
import {
  normalizeComponentInstanceColor,
  normalizePipeColor,
  isPipeColor,
  assignAutomaticPipeColors,
  normalizePipeColorMode,
  shouldOpenPipeColorMenu,
} from '../systems/PipeColorSystem';
import { useBuildPreferencesStore } from '../stores/buildPreferencesStore';
import {
  boardMountSystem,
  migrateBoardMountData,
} from '../systems/BoardMountSystem';
import {
  curvedTubeMountSystem,
  U_CURVED_TUBE_COMPONENT_ID,
} from '../systems/CurvedTubeMountSystem';
import { advancedStructureSystem } from '../systems/AdvancedStructureSystem';
import { structureMountSystem } from '../systems/StructureMountSystem';
import { rampMountSystem } from '../systems/RampMountSystem';
import { getMaterialVariantDescriptor } from '../systems/MaterialVariantSystem';
import {
  createTemplatePatch,
  instantiateTemplate,
  presetTemplates,
  validateTemplate,
  type DesignTemplateV2,
} from '../utils/templateUtils';
import { calculatePreviewCameraFit } from '../utils/previewCameraUtils';
import { resolveToolbarLayout } from '../utils/toolbarUtils';
import { getShortcutHelp, SAVE_SHORTCUT } from '../utils/shortcutUtils';
import { migrateReferenceProductData } from '../systems/ReferenceProductMigrationSystem';
import { buildTaskSystem } from '../systems/BuildTaskSystem';
import { assemblySelectionSystem } from '../systems/AssemblySelectionSystem';
import { startAssemblyPlacement } from '../systems/AssemblyInteractionCommands';

const component = (
  instanceId: string,
  componentId: string,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
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
  targetPointId: string
): Connection => ({
  id,
  source: { componentId: sourceComponentId, pointId: sourcePointId },
  target: { componentId: targetComponentId, pointId: targetPointId },
  type: 'socket',
  isActive: true,
});

const ensureCurvedTubeTestDefinition = () => {
  if (getComponentById(U_CURVED_TUBE_COMPONENT_ID)) return;
  componentDefinitions.push({
    id: U_CURVED_TUBE_COMPONENT_ID,
    name: '40cm U形弯管',
    type: 'pipe',
    category: 'basic',
    length: 40,
    diameter: 2.5,
    width: 40,
    height: 20,
    modelPath: '',
    thumbnailPath: '',
    connectionPoints: [
      {
        id: 'start',
        position: [-20, 0, 0],
        direction: [0, 0, -1],
        type: 'socket',
        compatible: ['socket'],
      },
      {
        id: 'end',
        position: [20, 0, 0],
        direction: [0, 0, -1],
        type: 'socket',
        compatible: ['socket'],
      },
    ],
    properties: { geometryKind: 'u-curve', nominalSpan: 40 },
  });
};

const run = (name: string, test: () => void) => {
  test();
  console.log(`✓ ${name}`);
};

run('keeps common toolbar actions visible and moves secondary actions into overflow', () => {
  const full = resolveToolbarLayout(1219);
  assert.deepEqual(full.visible, [
    'save',
    'file',
    'undo',
    'redo',
    'select',
    'move',
    'rotate',
    'components',
    'project',
    'display',
  ]);
  assert.deepEqual(full.overflow, ['settings', 'help']);

  const compact = resolveToolbarLayout(1024);
  assert.deepEqual(compact.visible, [
    'save',
    'undo',
    'redo',
    'select',
    'move',
    'rotate',
    'components',
  ]);
  assert.deepEqual(compact.overflow, ['file', 'project', 'display', 'settings', 'help']);
});

run('documents only wired toolbar and editor shortcuts', () => {
  const documented = getShortcutHelp().flatMap(category => category.shortcuts);
  assert.ok(documented.some(shortcut => (
    shortcut.key === SAVE_SHORTCUT.key &&
    shortcut.ctrl === SAVE_SHORTCUT.ctrl &&
    shortcut.description === SAVE_SHORTCUT.description
  )));
  assert.equal(documented.some(shortcut => shortcut.ctrl && ['o', 'n', 'e'].includes(shortcut.key)), false);
  assert.equal(documented.some(shortcut => shortcut.key === 't'), false);
});

const evaluateScopedBeginnerDemoFromStore = () => {
  const state = useDesignStore.getState();
  const scopedDesign = beginnerDemoSystem.scopeDesign(
    { components: state.components, connections: state.connections },
    {
      componentIds: state.beginnerDemo.scopeComponentIds,
      connectionIds: state.beginnerDemo.scopeConnectionIds,
    }
  );

  return beginnerDemoSystem.evaluateDemoProgress(scopedDesign, {
    endpointGrowthPracticed: state.beginnerDemo.endpointGrowthPracticed,
    practiceComponentIds: state.beginnerDemo.practiceComponentIds,
    practiceConnectionIds: state.beginnerDemo.practiceConnectionIds,
  });
};

const assertConnectionsAligned = (components: ComponentInstance[], connections: Connection[]) => {
  const componentsById = new Map(components.map(item => [item.instanceId, item]));

  connections.forEach((item) => {
    const source = componentsById.get(item.source.componentId);
    const target = componentsById.get(item.target.componentId);
    assert.ok(source, `missing source ${item.source.componentId}`);
    assert.ok(target, `missing target ${item.target.componentId}`);

    const sourcePoint = getComponentById(source.componentId)?.connectionPoints.find(point => point.id === item.source.pointId);
    const targetPoint = getComponentById(target.componentId)?.connectionPoints.find(point => point.id === item.target.pointId);
    assert.ok(sourcePoint, `missing source point ${source.componentId}.${item.source.pointId}`);
    assert.ok(targetPoint, `missing target point ${target.componentId}.${item.target.pointId}`);

    const sourceWorld = getWorldPosition(source.position, source.rotation, sourcePoint.position);
    const targetWorld = getWorldPosition(target.position, target.rotation, targetPoint.position);
    const distance = Math.hypot(
      sourceWorld[0] - targetWorld[0],
      sourceWorld[1] - targetWorld[1],
      sourceWorld[2] - targetWorld[2]
    );

    assert.ok(distance < 0.01, `${item.id} endpoint gap ${distance}`);
  });
};

const assertNoDuplicateConnectorCenters = (components: ComponentInstance[]) => {
  const centers = new Map<string, string[]>();
  components.forEach(item => {
    if (getComponentById(item.componentId)?.category !== 'connector') return;
    const key = item.position.map(value => value.toFixed(3)).join(',');
    centers.set(key, [...(centers.get(key) ?? []), item.instanceId]);
  });
  centers.forEach((instanceIds, center) => {
    assert.equal(
      instanceIds.length,
      1,
      `duplicate connector center ${center}: ${instanceIds.join(', ')}`
    );
  });
};

const countUnconnectedStructuralPorts = (
  components: ComponentInstance[],
  connections: Connection[],
  componentId: string
) => {
  const occupied = new Set(
    connections.flatMap(item => [
      `${item.source.componentId}:${item.source.pointId}`,
      `${item.target.componentId}:${item.target.pointId}`,
    ])
  );
  return components
    .filter(item => item.componentId === componentId)
    .reduce((count, item) => {
      const definition = getComponentById(item.componentId);
      const openPorts = definition?.connectionPoints.filter(point =>
        point.role !== 'board-mount' &&
        !occupied.has(`${item.instanceId}:${point.id}`)
      ).length ?? 0;
      return count + openPorts;
    }, 0);
};

const boardFrameComponents = (): ComponentInstance[] => [
  component('frame_sw', 'connector_5way', [-20, 40, -20]),
  component('frame_se', 'connector_5way', [20, 40, -20]),
  component('frame_ne', 'connector_5way', [20, 40, 20]),
  component('frame_nw', 'connector_5way', [-20, 40, 20]),
  component('frame_south', 'pipe_35cm', [0, 40, -20], [0, 90, 0]),
  component('frame_east', 'pipe_35cm', [20, 40, 0]),
  component('frame_north', 'pipe_35cm', [0, 40, 20], [0, 90, 0]),
  component('frame_west', 'pipe_35cm', [-20, 40, 0]),
];

const boardFrameConnections = (): Connection[] => [
  connection('frame_south_start', 'frame_sw', 'output1', 'frame_south', 'start'),
  connection('frame_south_end', 'frame_south', 'end', 'frame_se', 'output2'),
  connection('frame_east_start', 'frame_se', 'output3', 'frame_east', 'start'),
  connection('frame_east_end', 'frame_east', 'end', 'frame_ne', 'input'),
  connection('frame_north_start', 'frame_nw', 'output1', 'frame_north', 'start'),
  connection('frame_north_end', 'frame_north', 'end', 'frame_ne', 'output2'),
  connection('frame_west_start', 'frame_sw', 'output3', 'frame_west', 'start'),
  connection('frame_west_end', 'frame_west', 'end', 'frame_nw', 'input'),
];

let resolutionCounter = 0;

run('audits and repairs exactly aligned endpoints with missing connection records', () => {
  const components = [
    component('exact-connector', 'connector_5way', [0, 0, -20]),
    component('exact-pipe', 'pipe_35cm', [0, 0, 0]),
  ];
  const report = auditTopology({ components, connections: [] });

  assert.equal(
    report.issues.filter(issue => issue.kind === 'missing-connection').length,
    1
  );
  assert.equal(report.repairableCount >= 1, true);

  const patch = createRepairPatch({
    components,
    connections: [],
    idFactory: prefix => `${prefix}_exact`,
  });
  assert.ok(patch);
  assert.equal(patch.addConnections.length, 1);

  const repaired = connectorTopologySystem.applyTopologyPatch({
    components,
    connections: [],
    patch,
  });
  assertConnectionsAligned(repaired.components, repaired.connections);
});

run('resolves all exact placement contacts for a pipe bridging two connectors', () => {
  const components = [
    component('bridge-a', 'connector_5way', [0, 0, -20]),
    component('bridge-b', 'connector_5way', [0, 0, 20], [180, 0, 0]),
    component('bridge-pipe', 'pipe_35cm', [0, 0, 0]),
  ];
  const resolution = resolvePlacementContacts({
    components,
    connections: [],
    placementComponentIds: ['bridge-pipe'],
    idFactory: prefix => `${prefix}_bridge_${resolutionCounter++}`,
  });

  assert.equal(resolution.addConnections.length, 2);
  const connectedPointIds = new Set(
    resolution.addConnections.flatMap(item => [
      `${item.source.componentId}:${item.source.pointId}`,
      `${item.target.componentId}:${item.target.pointId}`,
    ])
  );
  assert.ok(connectedPointIds.has('bridge-pipe:start'));
  assert.ok(connectedPointIds.has('bridge-pipe:end'));
});

run('retains still-aligned moved component connections instead of removing all', () => {
  const components = [
    component('retain-a', 'connector_5way', [0, 0, -20]),
    component('retain-b', 'connector_5way', [0, 0, 20], [180, 0, 0]),
    component('retain-pipe', 'pipe_35cm', [0, 0, 0]),
  ];
  const connections = [
    connection('retain-start', 'retain-a', 'output3', 'retain-pipe', 'start'),
    connection('retain-end', 'retain-pipe', 'end', 'retain-b', 'output3'),
  ];
  const resolution = resolvePlacementContacts({
    components,
    connections,
    placementComponentIds: ['retain-pipe'],
  });

  assert.deepEqual(
    resolution.retainedConnectionIds.sort(),
    ['retain-end', 'retain-start']
  );
  assert.deepEqual(resolution.removeConnectionIds, []);
  assert.deepEqual(resolution.addConnections, []);
});

run('repairs a safe near miss by rigid translation without changing pipe length', () => {
  const components = [
    component('near-connector', 'connector_5way', [0, 0, -20]),
    component('near-pipe', 'pipe_35cm', [0, 0, 0.75]),
  ];
  const report = auditTopology({ components, connections: [] });
  const issue = report.issues.find(item => item.kind === 'near-miss');
  assert.ok(issue);
  assert.equal(issue.repairable, true);

  const patch = createRepairPatch({
    components,
    connections: [],
    idFactory: prefix => `${prefix}_near`,
  });
  assert.ok(patch);
  assert.equal(patch.updateComponents.length, 1);
  assert.equal(patch.addConnections.length, 1);
  assert.equal(patch.updateComponents[0].updates.scale, undefined);

  const repaired = connectorTopologySystem.applyTopologyPatch({
    components,
    connections: [],
    patch,
  });
  assertConnectionsAligned(repaired.components, repaired.connections);
  assert.equal(getComponentById('pipe_35cm')?.length, 35);
});

run('replaces invalid moved-pipe contacts with both exact contacts in one resolution', () => {
  const components = [
    component('old-left', 'connector_5way', [0, 0, -20]),
    component('old-right', 'connector_5way', [0, 0, 20], [180, 0, 0]),
    component('new-left', 'connector_5way', [100, 0, -20]),
    component('new-right', 'connector_5way', [100, 0, 20], [180, 0, 0]),
    component('moved-pipe', 'pipe_35cm', [100, 0, 0]),
  ];
  const connections = [
    connection('old-start', 'old-left', 'output3', 'moved-pipe', 'start'),
    connection('old-end', 'moved-pipe', 'end', 'old-right', 'output3'),
  ];
  const resolution = resolvePlacementContacts({
    components,
    connections,
    placementComponentIds: ['moved-pipe'],
    idFactory: prefix => `${prefix}_moved`,
  });

  assert.deepEqual(resolution.removeConnectionIds.sort(), ['old-end', 'old-start']);
  assert.equal(resolution.addConnections.length, 2);
  assert.ok(
    resolution.addConnections.every(item =>
      [item.source.componentId, item.target.componentId].some(id =>
        id === 'new-left' || id === 'new-right'
      )
    )
  );
});

run('hydrates topology audit without silent repair and repairs it as one history entry', () => {
  const store = useDesignStore.getState();
  store.reset();
  const design: Design = {
    name: 'legacy-missing-connection',
    version: '1.0',
    status: 'draft',
    components: [
      component('legacy-connector', 'connector_5way', [0, 0, -20]),
      component('legacy-pipe', 'pipe_35cm', [0, 0, 0]),
    ],
    connections: [],
    materials: {},
    settings: {
      gridSize: 20,
      showConnections: false,
      viewMode: 'realistic',
    },
  };

  store.hydrateDesign(design);
  let state = useDesignStore.getState();
  assert.equal(state.connections.length, 0);
  assert.equal(state.topologyAudit.repairableCount, 1);
  assert.equal(state.historyIndex, 0);

  assert.equal(state.repairTopology(), true);
  state = useDesignStore.getState();
  assert.equal(state.connections.length, 1);
  assert.equal(state.historyIndex, 1);
  state.undo();
  assert.equal(useDesignStore.getState().connections.length, 0);
  state.redo();
  assert.equal(useDesignStore.getState().connections.length, 1);
});

run('groups co-located connectors into one actionable topology issue', () => {
  const components = [
    component('duplicate-c', 'connector_5way', [12, 40, -8]),
    component('duplicate-a', 'connector_5way', [12, 40, -8]),
    component('duplicate-b', 'connector_5way', [12, 40, -8]),
  ];
  const duplicateIssues = auditTopology({ components, connections: [] })
    .issues.filter(issue => issue.kind === 'duplicate-node');

  assert.equal(duplicateIssues.length, 1);
  assert.deepEqual(
    duplicateIssues[0].componentIds,
    ['duplicate-a', 'duplicate-b', 'duplicate-c']
  );
  assert.deepEqual(duplicateIssues[0].location, [12, 40, -8]);
  assert.match(duplicateIssues[0].message, /3 个重叠接头/);
  assert.equal(duplicateIssues[0].repairable, true);

  const guide = assemblyStepSystem.generateAssemblyGuide({
    components,
    connections: [],
    designName: '重复接头定位测试',
  });
  const guideIssue = guide.issues.find(issue => issue.id.includes('duplicate-node'));
  assert.ok(guideIssue);
  assert.deepEqual(guideIssue.location, [12, 40, -8]);
  assert.match(guideIssue.detail ?? '', /可安全合并/);
});

run('safely merges duplicate connectors while retaining connection IDs and board mounts', () => {
  const components = [
    component('merge-a', 'connector_5way', [0, 0, -20]),
    component('merge-b', 'connector_5way', [0, 0, -20]),
    component('merge-positive', 'pipe_35cm', [0, 0, 0]),
    component('merge-negative', 'pipe_35cm', [0, 0, -40]),
    component('merge-board', 'board_40x40', [20, 0, 0]),
  ];
  const connections = [
    connection('merge-positive-id', 'merge-a', 'output3', 'merge-positive', 'start'),
    connection('merge-negative-id', 'merge-b', 'input', 'merge-negative', 'end'),
    {
      ...connection('merge-board-id', 'merge-a', 'platform_mount', 'merge-board', 'corner1'),
      type: 'board-mount',
    },
  ];
  const duplicateIssue = auditTopology({ components, connections })
    .issues.find(issue => issue.kind === 'duplicate-node');
  assert.ok(duplicateIssue);
  assert.equal(duplicateIssue.repairable, true);

  const patch = createRepairPatch({ components, connections });
  assert.ok(patch);
  const repaired = connectorTopologySystem.applyTopologyPatch({
    components,
    connections,
    patch,
    normalizeAutoConnectors: false,
  });

  assert.deepEqual(
    repaired.connections.map(item => item.id).sort(),
    ['merge-board-id', 'merge-negative-id', 'merge-positive-id']
  );
  assert.equal(
    repaired.components.filter(item => item.position.join(',') === '0,0,-20').length,
    1
  );
  assert.ok(repaired.components.some(item => item.instanceId === 'merge-a'));
  assert.equal(repaired.components.some(item => item.instanceId === 'merge-b'), false);
  assertNoDuplicateConnectorCenters(repaired.components);
  assertConnectionsAligned(repaired.components, repaired.connections);
  assert.equal(
    auditTopology(repaired).issues.some(issue => issue.kind === 'duplicate-node'),
    false
  );
});

run('keeps unsafe duplicate connectors unchanged with a concrete conflict reason', () => {
  const directionConflictComponents = [
    component('conflict-a', 'connector_5way', [0, 0, -20]),
    component('conflict-b', 'connector_5way', [0, 0, -20]),
    component('conflict-pipe-a', 'pipe_35cm', [0, 0, 0]),
    component('conflict-pipe-b', 'pipe_35cm', [0, 0, 0]),
  ];
  const directionConflictConnections = [
    connection('conflict-a-id', 'conflict-a', 'output3', 'conflict-pipe-a', 'start'),
    connection('conflict-b-id', 'conflict-b', 'output3', 'conflict-pipe-b', 'start'),
  ];
  const directionIssue = auditTopology({
    components: directionConflictComponents,
    connections: directionConflictConnections,
  }).issues.find(issue => issue.kind === 'duplicate-node');
  assert.ok(directionIssue);
  assert.equal(directionIssue.repairable, false);
  assert.match(directionIssue.detail ?? '', /同时占用/);
  assert.equal(
    createRepairPatch({
      components: directionConflictComponents,
      connections: directionConflictConnections,
    }),
    null
  );

  const groupedA = component('grouped-a', 'connector_5way', [40, 0, 0]);
  const groupedB = component('grouped-b', 'connector_5way', [40, 0, 0]);
  groupedA.properties = { assemblyGroupId: 'frame-a' };
  groupedB.properties = { assemblyGroupId: 'frame-b' };
  const propertyIssue = auditTopology({
    components: [groupedA, groupedB],
    connections: [],
  }).issues.find(issue => issue.kind === 'duplicate-node');
  assert.ok(propertyIssue);
  assert.equal(propertyIssue.repairable, false);
  assert.match(propertyIssue.detail ?? '', /冲突属性/);

  const unsupportedIssue = auditTopology({
    components: [
      component('unsupported-a', 'connector_cross', [80, 0, 0]),
      component('unsupported-b', 'connector_cross', [80, 0, 0]),
    ],
    connections: [],
  }).issues.find(issue => issue.kind === 'duplicate-node');
  assert.ok(unsupportedIssue);
  assert.equal(unsupportedIssue.repairable, false);
  assert.match(unsupportedIssue.detail ?? '', /非标准拓扑接头/);

  const boardComponents = [
    component('capacity-a', 'connector_5way', [120, 0, 0]),
    component('capacity-b', 'connector_5way', [120, 0, 0]),
    ...Array.from({ length: 5 }, (_, index) =>
      component(`capacity-board-${index}`, 'board_40x40', [140, 0, 20])
    ),
  ];
  const boardConnections = Array.from({ length: 5 }, (_, index) => ({
    ...connection(
      `capacity-connection-${index}`,
      index < 3 ? 'capacity-a' : 'capacity-b',
      'platform_mount',
      `capacity-board-${index}`,
      'corner1'
    ),
    type: 'board-mount',
  }));
  const capacityIssue = auditTopology({
    components: boardComponents,
    connections: boardConnections,
  }).issues.find(issue => issue.kind === 'duplicate-node');
  assert.ok(capacityIssue);
  assert.equal(capacityIssue.repairable, false);
  assert.match(capacityIssue.detail ?? '', /挂载数量超过/);
});

run('records duplicate connector repair as one undoable and redoable history entry', () => {
  const store = useDesignStore.getState();
  store.reset();
  const duplicateDesign: Design = {
    name: 'duplicate-connector-history',
    version: '1.0',
    status: 'draft',
    components: [
      component('history-a', 'connector_5way', [0, 0, -20]),
      component('history-b', 'connector_5way', [0, 0, -20]),
      component('history-positive', 'pipe_35cm', [0, 0, 0]),
      component('history-negative', 'pipe_35cm', [0, 0, -40]),
    ],
    connections: [
      connection('history-positive-id', 'history-a', 'output3', 'history-positive', 'start'),
      connection('history-negative-id', 'history-b', 'input', 'history-negative', 'end'),
    ],
    materials: {},
    settings: {
      gridSize: 20,
      showConnections: false,
      viewMode: 'realistic',
    },
  };

  store.hydrateDesign(duplicateDesign);
  let state = useDesignStore.getState();
  assert.equal(state.historyIndex, 0);
  assert.equal(state.repairTopology(), true);
  state = useDesignStore.getState();
  assert.equal(state.historyIndex, 1);
  assert.equal(state.components.filter(item => item.componentId === 'connector_5way').length, 1);
  assert.ok(state.components.some(item => item.instanceId === 'history-a'));
  state.undo();
  assert.equal(
    useDesignStore.getState().components.filter(item => item.componentId === 'connector_5way').length,
    2
  );
  state.redo();
  assert.equal(
    useDesignStore.getState().components.filter(item => item.componentId === 'connector_5way').length,
    1
  );
});

run('predicts and commits an exact bridge to an existing connector site', () => {
  const components = [
    component('bridge-source', 'connector_5way', [0, 0, -20]),
    component('bridge-target', 'connector_5way', [0, 0, 20], [180, 0, 0]),
  ];
  const site = endpointGrowthSystem
    .listPredictionSites({
      components,
      connections: [],
      pipeComponentId: 'pipe_35cm',
    })
    .find(item =>
      item.kind === 'endpoint' &&
      item.componentId === 'bridge-source' &&
      item.pointId === 'output3'
    );
  assert.ok(site);
  const candidate = endpointGrowthSystem
    .generateCandidates({
      site,
      components,
      connections: [],
      pipeComponentId: 'pipe_35cm',
    })
    .find(item => item.kind === 'bridge-existing-site');
  assert.ok(candidate);
  assert.equal(candidate.targetEndpoint.componentId, 'bridge-target');

  let counter = 0;
  const patch = endpointGrowthSystem.createTopologyPatch(candidate, {
    components,
    connections: [],
    idFactory: prefix => `${prefix}_closed_${counter++}`,
  });
  assert.ok(patch);
  assert.equal(patch.addComponents.length, 1);
  assert.equal(patch.addConnections.length, 2);
  assert.equal(patch.nextEndpoint, undefined);
  const closed = connectorTopologySystem.applyTopologyPatch({
    components,
    connections: [],
    patch,
  });
  assertConnectionsAligned(closed.components, closed.connections);
  const newPipeId = patch.addComponents[0].instanceId;
  assert.equal(
    topologyIntegritySystem
      .listPipeEndpointDiagnostics(closed)
      .some(item => item.endpoint.componentId === newPipeId),
    false
  );
});

run('does not predict a false bridge when standard pipe length misses by one centimeter', () => {
  const components = [
    component('gap-source', 'connector_5way', [0, 0, -20]),
    component('gap-target', 'connector_5way', [0, 0, 21], [180, 0, 0]),
  ];
  const site = endpointGrowthSystem
    .listPredictionSites({
      components,
      connections: [],
      pipeComponentId: 'pipe_35cm',
    })
    .find(item =>
      item.kind === 'endpoint' &&
      item.componentId === 'gap-source' &&
      item.pointId === 'output3'
    );
  assert.ok(site);
  const candidates = endpointGrowthSystem.generateCandidates({
    site,
    components,
    connections: [],
    pipeComponentId: 'pipe_35cm',
  });
  assert.equal(candidates.some(item => item.kind === 'bridge-existing-site'), false);
});

run('bridges two bare pipe ends with source and target connectors atomically', () => {
  const components = [
    component('bare-source', 'pipe_35cm', [0, 0, 0]),
    component('bare-target', 'pipe_35cm', [0, 0, 80]),
  ];
  const site = endpointGrowthSystem
    .listPredictionSites({
      components,
      connections: [],
      pipeComponentId: 'pipe_35cm',
    })
    .find(item =>
      item.kind === 'endpoint' &&
      item.componentId === 'bare-source' &&
      item.pointId === 'end'
    );
  assert.ok(site);
  const candidate = endpointGrowthSystem
    .generateCandidates({
      site,
      components,
      connections: [],
      pipeComponentId: 'pipe_35cm',
    })
    .find(item =>
      item.kind === 'bridge-existing-site' &&
      item.targetEndpoint.componentId === 'bare-target' &&
      item.targetEndpoint.pointId === 'start'
    );
  assert.ok(candidate);
  assert.equal(candidate.kind, 'bridge-existing-site');
  assert.ok(candidate.connector);
  assert.ok(
    candidate.kind === 'bridge-existing-site' && candidate.targetConnector
  );

  let counter = 0;
  const patch = endpointGrowthSystem.createTopologyPatch(candidate, {
    components,
    connections: [],
    idFactory: prefix => `${prefix}_double_${counter++}`,
  });
  assert.ok(patch);
  assert.equal(patch.addComponents.length, 3);
  assert.equal(patch.addConnections.length, 4);
  const closed = connectorTopologySystem.applyTopologyPatch({
    components,
    connections: [],
    patch,
  });
  assertConnectionsAligned(closed.components, closed.connections);
  assertNoDuplicateConnectorCenters(closed.components);
});

run('classifies free pipe caps separately from near-miss problem endpoints', () => {
  const freeDiagnostics = topologyIntegritySystem.listPipeEndpointDiagnostics({
    components: [component('free-pipe', 'pipe_35cm', [100, 0, 0])],
    connections: [],
  });
  assert.equal(freeDiagnostics.length, 2);
  assert.ok(freeDiagnostics.every(item => item.kind === 'free'));

  const problemDiagnostics = topologyIntegritySystem.listPipeEndpointDiagnostics({
    components: [
      component('problem-connector', 'connector_5way', [0, 0, -20]),
      component('problem-pipe', 'pipe_35cm', [0, 0, 0.75]),
    ],
    connections: [],
  });
  assert.ok(problemDiagnostics.some(item => item.kind === 'problem'));
});

const boardFrame20Components = (): ComponentInstance[] => [
  component('frame20_sw', 'connector_5way', [-20, 20, -10]),
  component('frame20_se', 'connector_5way', [20, 20, -10]),
  component('frame20_ne', 'connector_5way', [20, 20, 10]),
  component('frame20_nw', 'connector_5way', [-20, 20, 10]),
  component('frame20_south', 'pipe_35cm', [0, 20, -10], [0, 90, 0]),
  component('frame20_north', 'pipe_35cm', [0, 20, 10], [0, 90, 0]),
  component('frame20_east', 'pipe_15cm', [20, 20, 0]),
  component('frame20_west', 'pipe_15cm', [-20, 20, 0]),
];

const boardFrame20Connections = (): Connection[] => [
  connection('frame20_south_start', 'frame20_sw', 'output1', 'frame20_south', 'start'),
  connection('frame20_south_end', 'frame20_south', 'end', 'frame20_se', 'output2'),
  connection('frame20_north_start', 'frame20_nw', 'output1', 'frame20_north', 'start'),
  connection('frame20_north_end', 'frame20_north', 'end', 'frame20_ne', 'output2'),
  connection('frame20_west_start', 'frame20_sw', 'output3', 'frame20_west', 'start'),
  connection('frame20_west_end', 'frame20_west', 'end', 'frame20_nw', 'input'),
  connection('frame20_east_start', 'frame20_se', 'output3', 'frame20_east', 'start'),
  connection('frame20_east_end', 'frame20_east', 'end', 'frame20_ne', 'input'),
];

const clonedTemplate = (template: DesignTemplateV2): DesignTemplateV2 => ({
  ...template,
  components: template.components.map(item => ({
    ...item,
    position: [...item.position] as [number, number, number],
    rotation: [...item.rotation] as [number, number, number],
    scale: [...item.scale] as [number, number, number],
    properties: item.properties ? { ...item.properties } : undefined,
  })),
  connections: template.connections.map(item => ({
    ...item,
    source: { ...item.source },
    target: { ...item.target },
  })),
});

run('keeps the public pipe palette to four vivid colors', () => {
  assert.deepEqual(
    PIPE_COLOR_OPTIONS.map(option => [option.id, option.hex]),
    [
      ['red', '#E63B32'],
      ['yellow', '#F3D21F'],
      ['blue', '#2D5EB5'],
      ['green', '#3BAA50'],
    ]
  );
  assert.equal(normalizePipeColor(undefined), 'blue');
  assert.equal(normalizePipeColor('black'), 'blue');
  assert.equal(normalizePipeColor('red'), 'red');
  assert.equal(
    normalizeComponentInstanceColor({
      ...component('legacy-black-pipe', 'pipe_35cm', [0, 0, 0]),
      color: 'black',
    }).color,
    'blue'
  );
});

run('distinguishes a right click from a right-button camera drag', () => {
  const start = { clientX: 100, clientY: 100 };
  assert.equal(
    shouldOpenPipeColorMenu(start, { clientX: 106, clientY: 100 }),
    true
  );
  assert.equal(
    shouldOpenPipeColorMenu(start, { clientX: 103, clientY: 104 }),
    true
  );
  assert.equal(
    shouldOpenPipeColorMenu(start, { clientX: 106.1, clientY: 100 }),
    false
  );
});

run('keeps the pipe color menu session-only and commits color once', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(
    component('color-pipe', 'pipe_35cm', [0, 0, 0])
  );
  const historyBeforeMenu = useDesignStore.getState().historyIndex;
  const interactionStore = useInteractionStore.getState();

  interactionStore.openPipeColorMenu('color-pipe', 120, 180);
  assert.deepEqual(
    useInteractionStore.getState().interaction.selectedComponents,
    ['color-pipe']
  );
  assert.equal(
    useInteractionStore.getState().interaction.contextMenu?.kind,
    'pipe-color'
  );
  assert.equal(useDesignStore.getState().historyIndex, historyBeforeMenu);

  assert.equal(cancelActiveInteraction(), 'context-menu');
  assert.equal(useInteractionStore.getState().interaction.contextMenu, null);
  assert.deepEqual(
    useInteractionStore.getState().interaction.selectedComponents,
    ['color-pipe']
  );
  assert.equal(useDesignStore.getState().historyIndex, historyBeforeMenu);

  store.commitComponentUpdate('color-pipe', { color: 'red' });
  let colorState = useDesignStore.getState();
  assert.equal(colorState.historyIndex, historyBeforeMenu + 1);
  assert.equal(colorState.components[0].color, 'red');

  colorState.undo();
  colorState = useDesignStore.getState();
  assert.ok(isPipeColor(colorState.components[0].color));
  colorState.redo();
  assert.equal(useDesignStore.getState().components[0].color, 'red');
});

run('keeps pipe colors limited to four bright options with blue fallback', () => {
  assert.deepEqual(
    PIPE_COLOR_OPTIONS.map(option => `${option.id}:${option.hex}`),
    [
      'red:#E63B32',
      'yellow:#F3D21F',
      'blue:#2D5EB5',
      'green:#3BAA50',
    ]
  );
  assert.equal(normalizePipeColor('red'), 'red');
  assert.equal(normalizePipeColor(undefined), 'blue');
  assert.equal(normalizePipeColor('black'), 'blue');
  assert.equal(normalizePipeColor('purple'), 'blue');
});

run('normalizes imported pipe colors without changing connector black compatibility', () => {
  const store = useDesignStore.getState();
  store.reset();
  const design: Design = {
    name: 'color-import',
    version: '1.0',
    status: 'draft',
    components: [
      component('missing-color-pipe', 'pipe_35cm', [0, 0, 0]),
      { ...component('legacy-black-pipe', 'pipe_15cm', [20, 0, 0]), color: 'black' },
      { ...component('green-pipe', 'pipe_35cm', [40, 0, 0]), color: 'green' },
      { ...component('black-connector', 'connector_L', [60, 0, 0]), color: 'black' },
    ],
    connections: [],
    materials: {},
    settings: {
      gridSize: 20,
      showConnections: false,
      viewMode: 'realistic',
    },
  };

  store.hydrateDesign(design);
  const colorsById = new Map(
    useDesignStore.getState().components.map(item => [item.instanceId, item.color])
  );
  assert.equal(colorsById.get('missing-color-pipe'), 'blue');
  assert.equal(colorsById.get('legacy-black-pipe'), 'blue');
  assert.equal(colorsById.get('green-pipe'), 'green');
  assert.equal(colorsById.get('black-connector'), 'black');
});

run('assigns automatic pipe colors without matching adjacent connector pipes when possible', () => {
  const existingComponents = [
    { ...component('connector', 'connector_5way', [0, 0, 0]), color: 'black' as const },
    { ...component('existing-red', 'pipe_35cm', [0, 0, 20]), color: 'red' as const },
  ];
  const existingConnections = [
    connection('existing-red-conn', 'connector', 'output3', 'existing-red', 'start'),
  ];
  const colored = assignAutomaticPipeColors({
    existingComponents,
    existingConnections,
    newComponents: [
      component('new-pipe', 'pipe_35cm', [20, 0, 0], [0, 90, 0]),
    ],
    newConnections: [
      connection('new-pipe-conn', 'connector', 'output1', 'new-pipe', 'start'),
    ],
    mode: 'auto',
  });
  assert.ok(isPipeColor(colored[0].color));
  assert.notEqual(colored[0].color, 'red');
});

run('assigns a different automatic color to directly connected pipes when possible', () => {
  const colored = assignAutomaticPipeColors({
    existingComponents: [
      { ...component('existing-direct', 'pipe_35cm', [0, 0, 0]), color: 'yellow' as const },
    ],
    existingConnections: [],
    newComponents: [
      component('new-direct', 'pipe_35cm', [0, 0, 35]),
    ],
    newConnections: [
      connection('direct-color-conn', 'existing-direct', 'end', 'new-direct', 'start'),
    ],
    mode: 'auto',
  });

  assert.ok(isPipeColor(colored[0].color));
  assert.notEqual(colored[0].color, 'yellow');
});

run('assigns batch pipe colors using earlier new adjacent pipes', () => {
  const colored = assignAutomaticPipeColors({
    existingComponents: [],
    existingConnections: [],
    newComponents: [
      component('batch-a', 'pipe_35cm', [0, 0, 0]),
      component('batch-b', 'pipe_35cm', [0, 0, 35]),
      component('batch-c', 'pipe_35cm', [0, 0, 70]),
    ],
    newConnections: [
      connection('batch-ab', 'batch-a', 'end', 'batch-b', 'start'),
      connection('batch-bc', 'batch-b', 'end', 'batch-c', 'start'),
    ],
    mode: 'auto',
  });
  const colors = new Map(colored.map(item => [item.instanceId, item.color]));

  assert.ok(isPipeColor(colors.get('batch-a')));
  assert.ok(isPipeColor(colors.get('batch-b')));
  assert.ok(isPipeColor(colors.get('batch-c')));
  assert.notEqual(colors.get('batch-a'), colors.get('batch-b'));
  assert.notEqual(colors.get('batch-b'), colors.get('batch-c'));
});

run('chooses the least repeated adjacent color when all four colors are already adjacent', () => {
  const existingComponents = [
    component('full-connector', 'connector_5way', [0, 0, 0]),
    { ...component('full-red-a', 'pipe_35cm', [0, 0, -20]), color: 'red' as const },
    { ...component('full-red-b', 'pipe_35cm', [0, 0, 20]), color: 'red' as const },
    { ...component('full-yellow', 'pipe_35cm', [20, 0, 0], [0, 90, 0]), color: 'yellow' as const },
    { ...component('full-blue', 'pipe_35cm', [-20, 0, 0], [0, 90, 0]), color: 'blue' as const },
    { ...component('full-green', 'pipe_35cm', [0, 20, 0], [90, 0, 0]), color: 'green' as const },
  ];
  const colored = assignAutomaticPipeColors({
    existingComponents,
    existingConnections: [
      connection('full-red-a-conn', 'full-connector', 'input', 'full-red-a', 'end'),
      connection('full-red-b-conn', 'full-connector', 'output3', 'full-red-b', 'start'),
      connection('full-yellow-conn', 'full-connector', 'output1', 'full-yellow', 'start'),
      connection('full-blue-conn', 'full-connector', 'output2', 'full-blue', 'end'),
      connection('full-green-conn', 'full-connector', 'output4', 'full-green', 'start'),
    ],
    newComponents: [
      component('full-new', 'pipe_35cm', [0, -20, 0], [90, 0, 0]),
    ],
    newConnections: [
      connection('full-new-conn', 'full-connector', 'input', 'full-new', 'start'),
    ],
    mode: 'auto',
  });

  assert.notEqual(colored[0].color, 'red');
  assert.ok(['yellow', 'blue', 'green'].includes(String(colored[0].color)));
  assert.equal(existingComponents.find(item => item.instanceId === 'full-red-a')?.color, 'red');
});

run('uses blue mode for new pipes without recoloring existing pipes', () => {
  const colored = assignAutomaticPipeColors({
    existingComponents: [
      { ...component('old-green', 'pipe_35cm', [0, 0, 0]), color: 'green' as const },
    ],
    existingConnections: [],
    newComponents: [
      component('blue-mode-a', 'pipe_35cm', [40, 0, 0]),
      { ...component('blue-mode-explicit', 'pipe_35cm', [80, 0, 0]), color: 'red' as const },
      component('blue-mode-connector', 'connector_L', [120, 0, 0]),
    ],
    mode: 'blue',
  });

  assert.deepEqual(
    colored.map(item => [item.instanceId, item.color]),
    [
      ['blue-mode-a', 'blue'],
      ['blue-mode-explicit', 'blue'],
      ['blue-mode-connector', undefined],
    ]
  );
  assert.equal(normalizePipeColorMode(undefined), 'auto');
});

run('defines exact 20cm and 40cm module diagonal pipe lengths', () => {
  const expectations: Array<[string, number]> = [
    ['pipe_45_20cm', DIAGONAL_PIPE_LENGTHS.module20],
    ['pipe_45_40cm', DIAGONAL_PIPE_LENGTHS.module40],
  ];

  expectations.forEach(([componentId, expectedLength]) => {
    const definition = getComponentById(componentId);
    assert.ok(definition);
    assert.ok(Math.abs((definition.length ?? 0) - expectedLength) < 0.001);
    const [start, end] = definition.connectionPoints;
    assert.ok(start);
    assert.ok(end);
    assert.ok(Math.abs(Math.hypot(
      end.position[0] - start.position[0],
      end.position[1] - start.position[1],
      end.position[2] - start.position[2]
    ) - expectedLength) < 0.001);
  });
});

run('creates connected small and large A-frames in both vertical planes', () => {
  ([20, 40] as const).forEach(size => {
    (['vertical-x', 'vertical-z'] as const).forEach(plane => {
      ([false, true] as const).forEach(mirrored => {
        let nextId = 0;
        const assembly = advancedStructureSystem.createRightTriangle({
          size,
          plane,
          mirrored,
          idFactory: prefix => `${prefix}_${size}_${plane}_${mirrored}_${nextId++}`,
        });
        const isLarge = size === 40;
        assert.equal(assembly.components.length, isLarge ? 9 : 5);
        assert.equal(assembly.connections.length, isLarge ? 8 : 4);
        assert.equal(
          assembly.components.filter(item => getComponentById(item.componentId)?.type === 'pipe').length,
          isLarge ? 4 : 2
        );
        assert.equal(
          assembly.components.filter(item => item.componentId === 'pipe_35cm').length,
          isLarge ? 4 : 2
        );
        assert.equal(
          assembly.components.filter(item => item.componentId === 'connector_L').length,
          1
        );
        assert.equal(
          assembly.components.filter(item => item.componentId === 'connector_45deg').length,
          2
        );
        assert.equal(
          assembly.components.filter(item => item.componentId === 'connector_straight').length,
          isLarge ? 2 : 0
        );
        assert.equal(
          new Set(assembly.components.map(item => item.properties?.assemblyGroupId)).size,
          1
        );
        assert.ok(assembly.components.every(item => item.properties?.advancedStructure === 'a-frame'));
        assertConnectionsAligned(assembly.components, assembly.connections);
        const report = auditTopology({
          components: assembly.components,
          connections: assembly.connections,
        });
        assert.equal(
          report.issues.filter(issue => issue.kind !== 'free-endpoint').length,
          0
        );
        assert.equal(
          countUnconnectedStructuralPorts(
            assembly.components,
            assembly.connections,
            'connector_45deg'
          ),
          2
        );
      });
    });
  });
});

run('defines the 45-degree connector as a 135-degree outward port angle', () => {
  const definition = getComponentById('connector_45deg');
  assert.ok(definition);
  const ports = definition.connectionPoints.filter(point => point.role !== 'board-mount');
  assert.equal(ports.length, 2);
  const dot = new THREE.Vector3(...ports[0].direction).normalize().dot(
    new THREE.Vector3(...ports[1].direction).normalize()
  );
  assert.ok(Math.abs(dot + Math.SQRT1_2) < 0.001);
});

run('mounts an A-frame only when both foot anchors match', () => {
  let sequence = 0;
  const recipe = advancedStructureSystem.createAFrame({
    size: 'small',
    plane: 'vertical-x',
    idFactory: prefix => `mount_recipe_${prefix}_${sequence++}`,
  });
  const halfSpan = 40 / Math.SQRT2;
  const supports = [
    component('mount-left', 'connector_straight', [-halfSpan, -2.5, 0], [90, 0, 0]),
    component('mount-right', 'connector_straight', [halfSpan, -2.5, 0], [90, 0, 0]),
  ];
  const sites = structureMountSystem.listRecipeMountSites({
    recipe,
    components: supports,
    connections: [],
  });
  assert.equal(sites.length, 1);
  const oneFootOnly = structureMountSystem.listRecipeMountSites({
    recipe,
    components: supports.slice(0, 1),
    connections: [],
  });
  assert.equal(oneFootOnly.length, 0);
  const patch = structureMountSystem.createRecipePlacementPatch({
    recipe,
    site: sites[0],
    components: supports,
    connections: [],
    idFactory: prefix => `mount_commit_${prefix}_${sequence++}`,
  });
  assert.ok(patch);
  assert.equal(patch.addComponents.length, 5);
  assert.equal(patch.addConnections.length, 6);
});

run('derives build task availability without entering blocked placement flows', () => {
  const emptyTasks = buildTaskSystem.listAvailabilities({ components: [], connections: [] });
  assert.deepEqual(emptyTasks.map(task => task.id), [
    'base-frame',
    'extend',
    'diagonal-brace',
    'a-frame',
    'platform',
    'u-arch',
    'ramp',
  ]);
  assert.equal(emptyTasks.find(task => task.id === 'base-frame')?.status, 'available');
  assert.equal(emptyTasks.find(task => task.id === 'a-frame')?.installCount, 1);
  (['extend', 'diagonal-brace', 'platform', 'u-arch', 'ramp'] as const).forEach(id => {
    const task = emptyTasks.find(candidate => candidate.id === id);
    assert.equal(task?.status, 'blocked');
    assert.ok(task?.blockingReason);
    assert.equal(task ? buildTaskSystem.createActiveTask(task) : null, null);
  });

  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  designStore.reset();
  interactionStore.reset();
  const historyBeforeSession = useDesignStore.getState().historyIndex;
  const aFrameTask = emptyTasks.find(task => task.id === 'a-frame');
  assert.ok(aFrameTask);
  const activeTask = buildTaskSystem.createActiveTask(aFrameTask);
  assert.ok(activeTask);
  interactionStore.selectComponents(['stale-selection']);
  interactionStore.startBuildTask(activeTask);
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, []);
  interactionStore.cycleBuildTaskSite(1);
  interactionStore.finishBuildTask();
  assert.equal(useDesignStore.getState().historyIndex, historyBeforeSession);
});

run('commits each base-frame task step as exactly one undo boundary', () => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  designStore.reset();
  interactionStore.reset();
  const historyBeforeStart = useDesignStore.getState().historyIndex;
  designStore.startConstructionWizard('basic-platform-frame');
  assert.equal(
    useDesignStore.getState().historyIndex,
    Math.max(historyBeforeStart, 0),
    'starting base task may establish a baseline but must not add an undo boundary'
  );
  const availability = buildTaskSystem.getAvailability('base-frame', {
    components: [],
    connections: [],
  });
  const activeTask = buildTaskSystem.createActiveTask(availability);
  assert.ok(activeTask);
  interactionStore.startBuildTask(activeTask);
  const historyBeforeCommit = useDesignStore.getState().historyIndex;

  assert.equal(commitActiveBuildTask(), true);
  assert.equal(
    useDesignStore.getState().historyIndex,
    historyBeforeCommit + 1,
    'base task commit must add one history entry'
  );
  assert.ok(useDesignStore.getState().components.length > 0);
  assert.equal(useInteractionStore.getState().interaction.activeBuildTask?.id, 'base-frame');

  designStore.undo();
  assert.equal(
    useDesignStore.getState().components.length,
    0,
    'undoing the first base task step must restore the empty design'
  );
});

run('keeps task install counts aligned with the existing mount systems', () => {
  const demo = beginnerDemoSystem.createTargetDesign(key => `task_count_${key}`);
  const input = { components: demo.components, connections: demo.connections };
  const platform = buildTaskSystem.getAvailability('platform', input);
  const platformScan = boardMountSystem.scanBoardMountSites({
    boardComponentId: 'board_40x40',
    ...input,
  });
  assert.equal(
    platform.installCount,
    platformScan.validSites.length + platformScan.repairableSites.length
  );
  const uArch = buildTaskSystem.getAvailability('u-arch', input);
  assert.equal(
    uArch.installCount,
    curvedTubeMountSystem.listCurvedTubeMountSites(input).filter(site => !site.flip).length
  );
  const ramp = buildTaskSystem.getAvailability('ramp', input);
  assert.equal(
    ramp.installCount,
    rampMountSystem.listRampMountSites({ componentId: 'ramp_45cm', ...input }).length
  );
  const extend = buildTaskSystem.getAvailability('extend', input);
  assert.equal(
    extend.installCount,
    endpointGrowthSystem.listPredictionSites({
      pipeComponentId: 'pipe_35cm',
      family: 'straight',
      ...input,
    }).length
  );
  const diagonal = buildTaskSystem.getAvailability('diagonal-brace', input);
  assert.equal(
    diagonal.installCount,
    endpointGrowthSystem.listPredictionSites({
      pipeComponentId: 'pipe_35cm',
      family: 'diagonal',
      ...input,
    }).length
  );
});

run('derives one logical A-frame selection from any member', () => {
  let sequence = 0;
  const recipe = advancedStructureSystem.createAFrame({
    size: 'small',
    plane: 'vertical-x',
    idFactory: prefix => `assembly_selection_${prefix}_${sequence++}`,
  });
  const components = recipe.components.map(component => ({
    ...component,
    properties: {
      ...(component.properties ?? {}),
      structureRecipeId: recipe.recipeId,
    },
  }));
  const selection = assemblySelectionSystem.deriveFromMember({
    instanceId: components[2].instanceId,
    components,
    connections: recipe.connections,
  });
  assert.ok(selection);
  assert.equal(selection.structureName, '小型 A 字架');
  assert.equal(selection.memberIds.length, 5);
  assert.equal(selection.internalConnections.length, 4);
  assert.equal(selection.externalConnections.length, 0);
  assert.ok(assemblySelectionSystem.deriveFromSelection({
    selectedInstanceIds: selection.memberIds,
    components,
    connections: recipe.connections,
  }));
  assert.equal(assemblySelectionSystem.deriveFromSelection({
    selectedInstanceIds: [selection.memberIds[0]],
    components,
    connections: recipe.connections,
  }), null);
});

run('reinstalls an A-frame atomically with fresh ids and stable BOM', () => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  designStore.reset();
  interactionStore.reset();
  let sequence = 0;
  const recipe = advancedStructureSystem.createAFrame({
    size: 'small',
    plane: 'vertical-x',
    idFactory: prefix => `assembly_reinstall_${prefix}_${sequence++}`,
  });
  const originalComponents: ComponentInstance[] = recipe.components.map(component => ({
    ...component,
    properties: {
      ...(component.properties ?? {}),
      structureRecipeId: recipe.recipeId,
    },
  }));
  designStore.commitComponentsPlacement(originalComponents, recipe.connections);
  const originalIds = new Set(originalComponents.map(component => component.instanceId));
  const originalGroupId = String(originalComponents[0].properties?.assemblyGroupId);
  const originalBom = calculateMaterialRequirement(originalComponents);
  const historyBeforePlacement = useDesignStore.getState().historyIndex;

  const started = startAssemblyPlacement(originalGroupId, 'reinstall');
  assert.equal(started.ok, true);
  assert.equal(useDesignStore.getState().historyIndex, historyBeforePlacement);
  assert.equal(commitActiveBuildTask(), true);

  const committed = useDesignStore.getState();
  assert.equal(committed.historyIndex, historyBeforePlacement + 1);
  assert.equal(committed.components.length, originalComponents.length);
  assert.equal(committed.connections.length, recipe.connections.length);
  assert.ok(committed.components.every(component => !originalIds.has(component.instanceId)));
  assert.deepEqual(calculateMaterialRequirement(committed.components), originalBom);
  assert.equal(
    new Set(committed.components.map(component => component.properties?.assemblyGroupId)).size,
    1
  );
  assert.equal(
    useInteractionStore.getState().interaction.selectedComponents.length,
    originalComponents.length
  );

  designStore.undo();
  assert.ok(useDesignStore.getState().components.every(component => originalIds.has(component.instanceId)));
  assert.deepEqual(calculateMaterialRequirement(useDesignStore.getState().components), originalBom);
  designStore.redo();
  assert.ok(useDesignStore.getState().components.every(component => !originalIds.has(component.instanceId)));
});

run('copies an A-frame with fresh internal topology and no reused ids', () => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  designStore.reset();
  interactionStore.reset();
  let sequence = 0;
  const recipe = advancedStructureSystem.createAFrame({
    size: 'small',
    plane: 'vertical-x',
    idFactory: prefix => `assembly_copy_${prefix}_${sequence++}`,
  });
  const sourceComponents: ComponentInstance[] = recipe.components.map(component => ({
    ...component,
    properties: {
      ...(component.properties ?? {}),
      structureRecipeId: recipe.recipeId,
    },
  }));
  const halfSpan = 40 / Math.SQRT2;
  const supports = [
    component('assembly-copy-left', 'connector_straight', [-halfSpan, -2.5, 100], [90, 0, 0]),
    component('assembly-copy-right', 'connector_straight', [halfSpan, -2.5, 100], [90, 0, 0]),
  ];
  designStore.commitComponentsPlacement([...sourceComponents, ...supports], recipe.connections);
  const sourceComponentIds = new Set(sourceComponents.map(component => component.instanceId));
  const sourceConnectionIds = new Set(recipe.connections.map(connection => connection.id));
  const sourceGroupId = String(sourceComponents[0].properties?.assemblyGroupId);
  const historyBeforeCopy = useDesignStore.getState().historyIndex;

  const started = startAssemblyPlacement(sourceGroupId, 'copy');
  assert.equal(started.ok, true);
  assert.equal(useDesignStore.getState().historyIndex, historyBeforeCopy);
  assert.equal(commitActiveBuildTask(), true);

  const committed = useDesignStore.getState();
  assert.equal(committed.historyIndex, historyBeforeCopy + 1);
  const selectedCopy = assemblySelectionSystem.deriveFromSelection({
    selectedInstanceIds: useInteractionStore.getState().interaction.selectedComponents,
    components: committed.components,
    connections: committed.connections,
  });
  assert.ok(selectedCopy);
  assert.equal(selectedCopy.members.length, sourceComponents.length);
  assert.equal(selectedCopy.internalConnections.length, recipe.connections.length);
  assert.ok(selectedCopy.memberIds.every(id => !sourceComponentIds.has(id)));
  assert.ok(selectedCopy.internalConnections.every(connection => !sourceConnectionIds.has(connection.id)));
  assert.ok(committed.components.some(component => sourceComponentIds.has(component.instanceId)));

  designStore.undo();
  assert.equal(useDesignStore.getState().components.length, sourceComponents.length + supports.length);
  assert.equal(useDesignStore.getState().connections.length, recipe.connections.length);
});

run('separates straight and diagonal endpoint growth candidates', () => {
  const source = component('diagonal-source', 'pipe_35cm', [0, 0, 0]);
  const site = {
    kind: 'endpoint' as const,
    componentId: source.instanceId,
    pointId: 'end',
    position: getWorldPosition(source.position, source.rotation, [0, 0, 17.5]),
    direction: [0, 0, 1] as [number, number, number],
    componentName: '35cm直管',
  };
  const diagonal = endpointGrowthSystem.generateCandidates({
    site,
    pipeComponentId: 'pipe_35cm',
    family: 'diagonal',
    components: [source],
    connections: [],
  });
  assert.equal(diagonal.length, 4);
  assert.ok(diagonal.every(candidate =>
    candidate.kind === 'connector-pipe' &&
    candidate.connector.componentId === 'connector_45deg'
  ));
  const straight = endpointGrowthSystem.generateCandidates({
    site,
    pipeComponentId: 'pipe_35cm',
    family: 'straight',
    components: [source],
    connections: [],
  });
  assert.ok(straight.every(candidate =>
    candidate.kind !== 'connector-pipe' || candidate.connector.componentId !== 'connector_45deg'
  ));
});

run('commits and undoes a complete A-frame as one topology history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('a-frame-history-baseline', 'connector_L', [100, 0, 0]),
  ], []);
  let nextId = 0;
  const assembly = advancedStructureSystem.createRightTriangle({
    size: 40,
    plane: 'vertical-x',
    idFactory: prefix => `${prefix}_history_${nextId++}`,
  });
  const beforeHistory = useDesignStore.getState().historyIndex;
  store.commitTopologyPatch({
    addComponents: assembly.components,
    updateComponents: [],
    removeComponentIds: [],
    addConnections: assembly.connections,
    updateConnections: [],
    removeConnectionIds: [],
  });
  assert.equal(useDesignStore.getState().historyIndex, beforeHistory + 1);
  assert.equal(useDesignStore.getState().components.length, 10);
  assert.equal(useDesignStore.getState().connections.length, 8);
  store.undo();
  assert.equal(useDesignStore.getState().components.length, 1);
  assert.equal(useDesignStore.getState().components[0].instanceId, 'a-frame-history-baseline');
  assert.equal(useDesignStore.getState().connections.length, 0);
});

run('defines the reference public pipe palette without new diagonal pipes', () => {
  const pipeIds = getAllComponents()
    .filter(item => item.type === 'pipe' && item.category === 'basic')
    .map(item => item.id);

  assert.deepEqual(pipeIds, [
    'pipe_15cm',
    'pipe_25cm',
    'pipe_35cm',
    'pipe_curve_u_40cm',
  ]);
  assert.equal(getComponentById('pipe_25cm')?.length, 25);
  assert.equal(getComponentById('pipe_35cm')?.diameter, REFERENCE_PRODUCT_SPEC.pipes.outerDiameterCm);
  assert.equal(getComponentById('connector_45deg')?.name, '45°斜向接头');
  assert.deepEqual(REFERENCE_PRODUCT_PROFILE_V1.modulePitches, [20, 30, 40]);
  assert.equal(REFERENCE_PRODUCT_PROFILE_V1.connector.socketDiameter, 5.5);
  assert.equal(REFERENCE_PRODUCT_PROFILE_V1.connector.bodyDiameter, 6.5);
  assert.equal(REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness, 0.48);
  assert.equal(getAllComponents().some(item => item.id === 'swing'), false);
  assert.equal(getAllComponents().some(item => item.id === 'slide'), false);
  assert.equal(getAllComponents().some(item => item.id === 'rope_ladder'), false);
  assert.equal(getAllComponents().some(item => item.id === 'ramp_45cm'), true);
  assert.equal(getAllComponents().some(item => item.id === 'ramp_85cm'), true);
});

run('migrates legacy advanced pipes while preserving the first port anchor', () => {
  const legacyLength = DIAGONAL_PIPE_LENGTHS.module20;
  const legacyPipe = component('legacy-diagonal', 'pipe_45_20cm', [0, 0, 0]);
  const targetPipe = component(
    'legacy-target',
    'pipe_15cm',
    [0, 0, legacyLength / 2 + 7.5]
  );
  const migrated = migrateReferenceProductData({
    components: [legacyPipe, targetPipe],
    connections: [
      connection(
        'legacy-end-connection',
        legacyPipe.instanceId,
        'end',
        targetPipe.instanceId,
        'start'
      ),
    ],
  });
  const migratedPipe = migrated.components.find(
    item => item.instanceId === legacyPipe.instanceId
  );

  assert.equal(migrated.productProfileVersion, REFERENCE_PRODUCT_PROFILE_VERSION);
  assert.equal(migratedPipe?.componentId, 'pipe_15cm');
  assert.deepEqual(migratedPipe?.position, [0, 0, -legacyLength / 2 + 7.5]);
  assert.equal(migrated.connections.length, 0);
  assert.match(migrated.warnings.join('\n'), /需要重新连接/);

  const migratedArc = migrateReferenceProductData({
    components: [component('legacy-arc', 'pipe_arc_40cm', [12, 5, -8])],
    connections: [],
  });
  assert.equal(migratedArc.components[0].componentId, 'pipe_curve_u_40cm');
  assert.equal(getComponentById(migratedArc.components[0].componentId)?.angle, 180);
});

run('creates a 180 degree U curve geometry for the 40cm reference module', () => {
  const definition = getComponentById('pipe_curve_u_40cm');
  assert.ok(definition);
  const geometry = createComponentGeometry('pipe_curve_u_40cm', definition);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  assert.ok(bounds);
  assert.ok(bounds.max.x - bounds.min.x > 38);
  assert.ok(bounds.max.z - bounds.min.z > 18);
  assert.ok(bounds.max.y - bounds.min.y > 4);
  assert.equal(definition.connectionPoints.length, 2);
  const [start, end] = definition.connectionPoints;
  assert.deepEqual(start.position, [-20, 0, 0]);
  assert.deepEqual(end.position, [20, 0, 0]);
  assert.deepEqual(start.direction, [0, 0, -1]);
  assert.deepEqual(end.direction, [0, 0, -1]);
  assert.deepEqual(getPipeCenterlineSpec('pipe_curve_u_40cm'), {
    kind: 'circular-arc',
    radius: 20,
    sweepDegrees: 180,
    start: [-20, 0, 0],
    end: [20, 0, 0],
    startDirection: [0, 0, -1],
    endDirection: [0, 0, -1],
  });
  assert.equal(definition.angle, 180);
  geometry.dispose();
});

run('keeps U curve flip selection in session state without touching history', () => {
  const designStore = useDesignStore.getState();
  designStore.reset();
  const beforeHistory = useDesignStore.getState().historyIndex;
  useInteractionStore.getState().startPlace('pipe_curve_u_40cm', [0, 180, 0]);
  const interaction = useInteractionStore.getState().interaction;
  assert.equal(interaction.mode, 'place');
  assert.equal(interaction.placeState.componentId, 'pipe_curve_u_40cm');
  assert.deepEqual(interaction.placeState.previewRotation, [0, 180, 0]);
  assert.equal(useDesignStore.getState().historyIndex, beforeHistory);
  useInteractionStore.getState().cancelPlace();
});

run('detects only complete four-corner board mount frames', () => {
  const components = boardFrameComponents();
  const connections = boardFrameConnections();
  const sites = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections,
  });
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0].position, [0, 40, 0]);
  assert.equal(sites[0].corners.length, 4);

  const incompleteSites = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections: connections.filter(item => item.id !== 'frame_west_end'),
  });
  assert.equal(incompleteSites.length, 0);
});

run('detects 40x20 board mount frames in both supported orientations', () => {
  const components = [
    ...boardFrame20Components(),
    ...boardFrame20Components().map(item => ({
      ...item,
      instanceId: item.instanceId.replace('frame20', 'frame20_rotated'),
      position: [item.position[2] + 80, item.position[1], item.position[0]] as [number, number, number],
      rotation: item.componentId === 'pipe_35cm' ? [0, 0, 0] as [number, number, number] : item.componentId === 'pipe_15cm' ? [0, 90, 0] as [number, number, number] : item.rotation,
    })),
  ];
  const connections = [
    ...boardFrame20Connections(),
    ...boardFrame20Connections().map(item => ({
      ...item,
      id: item.id.replace('frame20', 'frame20_rotated'),
      source: {
        ...item.source,
        componentId: item.source.componentId.replace('frame20', 'frame20_rotated'),
      },
      target: {
        ...item.target,
        componentId: item.target.componentId.replace('frame20', 'frame20_rotated'),
      },
    })),
  ];

  const sites = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x20',
    components,
    connections,
  });

  assert.ok(sites.some(site => site.rotation[1] === 0));
  assert.ok(sites.some(site => site.rotation[1] === 90));
});

run('rejects board mount frames without a complete structural rectangle edge set', () => {
  const components = boardFrameComponents();
  const connections = boardFrameConnections().filter(item =>
    !['frame_south_start', 'frame_south_end'].includes(item.id)
  );

  assert.equal(
    boardMountSystem.listBoardMountSites({
      boardComponentId: 'board_40x40',
      components,
      connections,
    }).length,
    0
  );
});

run('offers a repairable board mount when geometry is exact but one record is missing', () => {
  const components = boardFrameComponents();
  const connections = boardFrameConnections().filter(
    item => item.id !== 'frame_south_start'
  );
  const scan = boardMountSystem.scanBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections,
  });
  assert.equal(scan.validSites.length, 0);
  assert.equal(scan.repairableSites.length, 1);
  assert.equal(scan.repairableSites[0].repairConnections.length, 1);
  const patch = boardMountSystem.createBoardPlacementPatch({
    site: scan.repairableSites[0],
    components,
    connections,
    idFactory: prefix => `${prefix}_repairable_board`,
  });
  assert.ok(patch);
  assert.equal(patch.addConnections.length, 5);
});

run('creates a board placement patch with four board connections', () => {
  const components = boardFrameComponents();
  const connections = boardFrameConnections();
  const site = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections,
  })[0];
  const patch = boardMountSystem.createBoardPlacementPatch({
    site,
    components,
    connections,
    idFactory: prefix => `${prefix}_test`,
  });
  assert.ok(patch);
  assert.equal(patch.addComponents.length, 1);
  assert.equal(patch.addComponents[0].componentId, 'board_40x40');
  assert.equal(patch.addComponents[0].color, 'green');
  assert.equal(patch.addComponents[0].properties?.boardStyle, 'solid');
  assert.equal(patch.addComponents[0].properties?.boardMountVersion, 2);
  assert.equal(patch.addConnections.length, 4);
  assert.equal(patch.updateComponents.length, 0);
  assert.equal(patch.addConnections.every(item => item.type === 'board-mount'), true);
  assert.equal(patch.addConnections.every(item => (
    item.source.pointId === 'platform_mount' || item.target.pointId === 'platform_mount'
  )), true);
});

run('mounts boards without upgrading or occupying connector structural ports', () => {
  const components = boardFrameComponents().map(item =>
    item.componentId === 'connector_5way'
      ? { ...item, componentId: 'connector_4way' }
      : item
  );
  const connections = boardFrameConnections();
  const site = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections,
  })[0];
  assert.ok(site);
  assert.equal(site.corners.every(corner => corner.targetPointId === 'platform_mount'), true);
  assert.equal(site.corners.every(corner => corner.virtualDirection === undefined), true);

  let nextId = 0;
  const patch = boardMountSystem.createBoardPlacementPatch({
    site,
    components,
    connections,
    idFactory: prefix => `${prefix}_virtual_${nextId++}`,
  });
  assert.ok(patch);
  assert.equal(patch.addConnections.length, 4);
  assert.equal(patch.updateComponents.length, 0);
  assert.equal(
    patch.addConnections.every(item => item.type === 'board-mount'),
    true
  );
});

run('detects U curved tube mount sites from paired free same-direction endpoints', () => {
  ensureCurvedTubeTestDefinition();
  const components = [
    component('curve-left', 'pipe_35cm', [0, 0, -20]),
    component('curve-right', 'pipe_35cm', [40, 0, -20]),
  ];
  const sites = curvedTubeMountSystem.listCurvedTubeMountSites({
    components,
    connections: [],
  });

  assert.equal(sites.length >= 1, true);
  assert.equal(
    sites.some(site =>
      site.endpoints.every(endpoint => endpoint.targetPointId === 'end') &&
      Math.abs(
        Math.hypot(
          site.endpoints[0].position[0] - site.endpoints[1].position[0],
          site.endpoints[0].position[1] - site.endpoints[1].position[1],
          site.endpoints[0].position[2] - site.endpoints[1].position[2]
        ) - 40
      ) <= 0.5
    ),
    true
  );
});

run('rejects occupied or nonparallel endpoint pairs for U curved tube mounts', () => {
  ensureCurvedTubeTestDefinition();
  const components = [
    component('curve-left', 'pipe_35cm', [0, 0, -20]),
    component('curve-right', 'pipe_35cm', [40, 0, -20], [0, 180, 0]),
    component('curve-occupier', 'pipe_35cm', [0, 0, 20]),
  ];

  assert.equal(
    curvedTubeMountSystem.listCurvedTubeMountSites({
      components,
      connections: [],
    }).some(site =>
      site.endpoints.some(endpoint =>
        endpoint.targetInstanceId === 'curve-left' &&
        endpoint.targetPointId === 'end'
      ) &&
      site.endpoints.some(endpoint =>
        endpoint.targetInstanceId === 'curve-right' &&
        endpoint.targetPointId === 'end'
      )
    ),
    false
  );
  assert.equal(
    curvedTubeMountSystem.listCurvedTubeMountSites({
      components: [
        component('curve-left', 'pipe_35cm', [0, 0, -20]),
        component('curve-right', 'pipe_35cm', [40, 0, -20]),
        component('curve-occupier', 'pipe_35cm', [0, 0, 20]),
      ],
      connections: [
        connection('occupied-curve-end', 'curve-left', 'end', 'curve-occupier', 'start'),
      ],
    }).some(site =>
      site.endpoints.some(endpoint =>
        endpoint.targetInstanceId === 'curve-left' &&
        endpoint.targetPointId === 'end'
      )
    ),
    false
  );
});

run('creates U curved tube placement patch with exactly two endpoint connections', () => {
  ensureCurvedTubeTestDefinition();
  const components = [
    component('curve-left', 'pipe_35cm', [0, 0, -20]),
    component('curve-right', 'pipe_35cm', [40, 0, -20]),
  ];
  const site = curvedTubeMountSystem.listCurvedTubeMountSites({
    components,
    connections: [],
  })[0];
  const patch = curvedTubeMountSystem.createCurvedTubePlacementPatch({
    site,
    components,
    connections: [],
    idFactory: prefix => `${prefix}_test`,
  });

  assert.ok(patch);
  assert.equal(patch.addComponents.length, 1);
  assert.equal(patch.addComponents[0].componentId, U_CURVED_TUBE_COMPONENT_ID);
  assert.equal(patch.addConnections.length, 2);
  assert.equal(
    new Set(patch.addConnections.map(item => item.target.pointId)).size,
    2
  );
});

run('mounts 45cm and 85cm ramp panels from two upper board mounts', () => {
  ([
    ['ramp_45cm', 20],
    ['ramp_85cm', 40],
  ] as const).forEach(([componentId, height]) => {
    const supports = [
      component(`${componentId}-left`, 'connector_straight', [-20, height, 0]),
      component(`${componentId}-right`, 'connector_straight', [20, height, 0]),
    ];
    const sites = rampMountSystem.listRampMountSites({
      componentId,
      components: supports,
      connections: [],
    });
    assert.equal(sites.length, 2);
    assert.ok(sites.every(site => Math.abs(site.groundHeight) < 0.001));
    const patch = rampMountSystem.createRampPlacementPatch({
      site: sites[0],
      components: supports,
      connections: [],
      idFactory: prefix => `${prefix}_${componentId}`,
    });
    assert.ok(patch);
    assert.equal(patch.addComponents[0].componentId, componentId);
    assert.equal(patch.addConnections.length, 2);
    assert.ok(patch.addConnections.every(item => item.type === 'board-mount'));
  });
});

run('upgrades both connector nodes atomically for a U curved tube mount', () => {
  const components = [
    component('curve-upgrade-left', 'connector_straight', [0, 0, 0]),
    component('curve-upgrade-right', 'connector_straight', [40, 0, 0]),
    component('curve-leg-a1', 'pipe_35cm', [0, 0, -20]),
    component('curve-leg-a2', 'pipe_35cm', [0, 0, 20]),
    component('curve-leg-b1', 'pipe_35cm', [40, 0, -20]),
    component('curve-leg-b2', 'pipe_35cm', [40, 0, 20]),
  ];
  const connections = [
    connection('curve-a-input', 'curve-upgrade-left', 'input', 'curve-leg-a1', 'end'),
    connection('curve-a-output', 'curve-upgrade-left', 'output', 'curve-leg-a2', 'start'),
    connection('curve-b-input', 'curve-upgrade-right', 'input', 'curve-leg-b1', 'end'),
    connection('curve-b-output', 'curve-upgrade-right', 'output', 'curve-leg-b2', 'start'),
  ];
  const site = curvedTubeMountSystem
    .listCurvedTubeMountSites({ components, connections })
    .find(item => item.endpoints.every(endpoint => endpoint.virtualConnectorPort));
  assert.ok(site);

  let nextId = 0;
  const patch = curvedTubeMountSystem.createCurvedTubePlacementPatch({
    site,
    components,
    connections,
    idFactory: prefix => `${prefix}_upgrade_${nextId++}`,
  });
  assert.ok(patch);
  assert.equal(patch.addComponents.length, 1);
  assert.equal(patch.addConnections.length, 2);
  assert.equal(
    new Set(
      patch.updateComponents
        .filter(update => update.instanceId.startsWith('curve-upgrade-'))
        .map(update => update.instanceId)
    ).size,
    2
  );
});

run('commits U curved tube placement only from a current double-end mount site', () => {
  ensureCurvedTubeTestDefinition();
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('curve-left', 'pipe_35cm', [0, 0, -20]),
    component('curve-right', 'pipe_35cm', [40, 0, -20]),
  ]);
  const interactionStore = useInteractionStore.getState();
  const site = curvedTubeMountSystem.listCurvedTubeMountSites({
    components: useDesignStore.getState().components,
    connections: useDesignStore.getState().connections,
  })[0];

  interactionStore.startPlace(U_CURVED_TUBE_COMPONENT_ID);
  interactionStore.updatePlacePreview({
    position: site.position,
    rotation: site.rotation,
    isValid: true,
    snapType: 'connection',
    curvedTubeMountSite: site,
    snapConfidence: 1,
  });

  assert.equal(commitActivePlacement(), true);
  assert.equal(
    useDesignStore.getState().components.some(
      item => item.componentId === U_CURVED_TUBE_COMPONENT_ID
    ),
    true
  );
  assert.equal(useDesignStore.getState().connections.length, 2);

  store.reset();
  store.commitComponentPlacement(component('single-end', 'pipe_35cm', [0, 0, -20]));
  interactionStore.startPlace(U_CURVED_TUBE_COMPONENT_ID);
  interactionStore.updatePlacePreview({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    isValid: true,
    snapType: 'connection',
    snapConfidence: 1,
  });
  assert.equal(commitActivePlacement(), false);
  assert.equal(
    useDesignStore.getState().components.some(
      item => item.componentId === U_CURVED_TUBE_COMPONENT_ID
    ),
    false
  );
});

run('keeps connector board mounts out of structural endpoint prediction', () => {
  const endpoints = endpointGrowthSystem.listAvailableEndpoints(
    [component('mount-filter-connector', 'connector_5way', [0, 0, 0])],
    []
  );
  assert.ok(endpoints.length > 0);
  assert.equal(endpoints.some(endpoint => endpoint.pointId === 'platform_mount'), false);
});

run('renders embedded solid and perforated board variants below the pipe crown', () => {
  assert.equal(40 - REFERENCE_PRODUCT_SPEC.boards.insetCm, 34.6);
  assert.equal(20 - REFERENCE_PRODUCT_SPEC.boards.insetCm, 14.6);
  assert.equal(REFERENCE_PRODUCT_SPEC.boards.pipeCrownRecessCm, 0.3);
  const definition = getComponentById('board_40x40');
  assert.ok(definition);
  const solid = createComponentGeometry('board_40x40', definition, {
    properties: { boardStyle: 'solid', boardMountVersion: 2 },
    color: 'green',
  });
  const perforated = createComponentGeometry('board_40x40', definition, {
    properties: { boardStyle: 'perforated', boardMountVersion: 2 },
    color: 'red',
  });
  solid.computeBoundingBox();
  perforated.computeBoundingBox();
  assert.ok(solid.boundingBox);
  assert.ok(perforated.boundingBox);
  assert.ok((solid.boundingBox?.max.y ?? Infinity) < REFERENCE_PRODUCT_SPEC.pipes.outerDiameterCm / 2);
  assert.ok((perforated.boundingBox?.max.y ?? Infinity) < REFERENCE_PRODUCT_SPEC.pipes.outerDiameterCm / 2);
  assert.equal(solid.getIndex(), null);
  assert.equal(perforated.getIndex(), null);
  assert.ok(solid.getAttribute('position').count > 100);
  assert.ok(
    perforated.getAttribute('position').count > solid.getAttribute('position').count
  );
  solid.dispose();
  perforated.dispose();
});

run('migrates safe legacy board connections to dedicated shared mount points', () => {
  const frame = boardFrameComponents();
  const board = {
    ...component('legacy-board', 'board_40x40', [0, 42.5, 0]),
    color: 'black' as const,
  };
  const connectorIds = frame
    .filter(item => getComponentById(item.componentId)?.category === 'connector')
    .slice(0, 4)
    .map(item => item.instanceId);
  const legacyConnections = connectorIds.map((connectorId, index): Connection => ({
    id: `legacy-board-connection-${index}`,
    source: { componentId: connectorId, pointId: 'output4' },
    target: { componentId: board.instanceId, pointId: `corner${index + 1}` },
    type: 'socket',
    isActive: true,
  }));
  const migrated = migrateBoardMountData({
    components: [...frame, board],
    connections: [...boardFrameConnections(), ...legacyConnections],
  });
  const migratedBoard = migrated.components.find(item => item.instanceId === board.instanceId);
  assert.ok(migratedBoard);
  assert.deepEqual(migratedBoard.position, [0, 40, 0]);
  assert.equal(migratedBoard.color, 'green');
  assert.equal(migratedBoard.properties?.boardStyle, 'solid');
  assert.equal(migratedBoard.properties?.boardMountVersion, 2);
  const migratedBoardConnections = migrated.connections.filter(item =>
    item.source.componentId === board.instanceId || item.target.componentId === board.instanceId
  );
  assert.equal(migratedBoardConnections.length, 4);
  assert.equal(migratedBoardConnections.every(item => item.type === 'board-mount'), true);
  assert.equal(migratedBoardConnections.every(item => (
    item.source.pointId === 'platform_mount' || item.target.pointId === 'platform_mount'
  )), true);
});

run('keeps incomplete legacy board placement intact while normalizing appearance', () => {
  const board = {
    ...component('incomplete-board', 'board_40x40', [10, 42.5, 10]),
    color: 'black' as const,
  };
  const migrated = migrateBoardMountData({ components: [board], connections: [] });
  assert.deepEqual(migrated.components[0].position, board.position);
  assert.equal(migrated.components[0].color, 'green');
  assert.equal(migrated.components[0].properties?.boardStyle, 'solid');
});

run('commits board color and style together as one undoable history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    {
      ...component('appearance-board', 'board_40x40', [0, 0, 0]),
      color: 'green',
      properties: { boardStyle: 'solid', boardMountVersion: 2 },
    },
  ], []);
  const beforeHistory = useDesignStore.getState().historyIndex;
  store.commitComponentUpdate('appearance-board', {
    color: 'red',
    properties: { boardStyle: 'perforated', boardMountVersion: 2 },
  });
  assert.equal(useDesignStore.getState().historyIndex, beforeHistory + 1);
  assert.equal(useDesignStore.getState().components[0].color, 'red');
  assert.equal(useDesignStore.getState().components[0].properties?.boardStyle, 'perforated');
  store.undo();
  assert.equal(useDesignStore.getState().components[0].color, 'green');
  assert.equal(useDesignStore.getState().components[0].properties?.boardStyle, 'solid');
  store.redo();
  assert.equal(useDesignStore.getState().components[0].properties?.boardStyle, 'perforated');
});

run('separates board BOM variants while retaining the base key for solid green', () => {
  const solidGreen = {
    ...component('variant-solid', 'board_40x40', [0, 0, 0]),
    color: 'green' as const,
    properties: { boardStyle: 'solid', boardMountVersion: 2 },
  };
  const perforatedRed = {
    ...component('variant-perforated', 'board_40x40', [40, 0, 0]),
    color: 'red' as const,
    properties: { boardStyle: 'perforated', boardMountVersion: 2 },
  };
  assert.equal(getMaterialVariantDescriptor(solidGreen).materialKey, 'board_40x40');
  assert.equal(
    getMaterialVariantDescriptor(perforatedRed).materialKey,
    'board_40x40:perforated:red'
  );
  const materials = calculateMaterialRequirement([solidGreen, perforatedRed]);
  assert.equal(materials.board_40x40?.required, 1);
  assert.equal(materials['board_40x40:perforated:red']?.required, 1);
});

run('commits a board placement patch as one undoable history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement(boardFrameComponents(), boardFrameConnections());
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;
  const state = useDesignStore.getState();
  const site = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components: state.components,
    connections: state.connections,
  })[0];
  const patch = boardMountSystem.createBoardPlacementPatch({
    site,
    components: state.components,
    connections: state.connections,
    idFactory: prefix => `${prefix}_history`,
  });
  assert.ok(patch);

  store.commitTopologyPatch(patch);
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex + 1);
  assert.equal(useDesignStore.getState().components.some(item => item.componentId === 'board_40x40'), true);
  assert.equal(useDesignStore.getState().connections.filter(item => item.target.componentId === 'board_history').length, 4);
  store.undo();
  assert.equal(useDesignStore.getState().components.some(item => item.componentId === 'board_40x40'), false);
});

run('ships connected and valid preset templates', () => {
  assert.equal(presetTemplates.length, 6);
  assert.deepEqual(
    presetTemplates.map(template => template.id),
    [
      'simple_frame',
      'cube_frame',
      'platform_structure',
      'a_frame_climber',
      'short_ramp_platform',
      'long_ramp_climber',
    ]
  );
  assert.equal(
    presetTemplates.some(template => template.components.some(component =>
      ['swing', 'slide', 'rope_ladder'].includes(component.componentId)
    )),
    false
  );
  presetTemplates.forEach(template => {
    const validation = validateTemplate(template);
    assert.equal(validation.valid, true, `${template.id}: ${validation.errors.join(', ')}`);
    assert.ok(template.connections.length > 0, `${template.id} has no connections`);
    assertConnectionsAligned(template.components, template.connections);
  });
});

run('fits template preview cameras to real geometry bounds across aspect ratios', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-20, -2, -10),
    new THREE.Vector3(20, 42, 10)
  );
  const wide = calculatePreviewCameraFit(bounds, 16 / 9, 42);
  const narrow = calculatePreviewCameraFit(bounds, 9 / 16, 42);

  assert.deepEqual(wide.center.map(value => Math.round(value)), [0, 20, 0]);
  assert.ok(wide.position.every(Number.isFinite));
  assert.ok(narrow.position.every(Number.isFinite));
  assert.ok(wide.near > 0 && wide.far > wide.near);
  assert.ok(narrow.near > 0 && narrow.far > narrow.near);
  assert.ok(
    new THREE.Vector3(...narrow.position).distanceTo(new THREE.Vector3(...narrow.center)) >
      new THREE.Vector3(...wide.position).distanceTo(new THREE.Vector3(...wide.center)),
    'a narrow viewport should move the camera farther away to avoid clipping'
  );
  assert.ok(wide.gridSize >= 60);
});

run('returns finite preview camera defaults for empty bounds', () => {
  const fit = calculatePreviewCameraFit(new THREE.Box3(), 0, Number.NaN);
  assert.ok(fit.position.every(Number.isFinite));
  assert.ok(fit.center.every(Number.isFinite));
  assert.ok(Number.isFinite(fit.near));
  assert.ok(Number.isFinite(fit.far));
  assert.ok(fit.far > fit.near);
});

run('rejects templates with incomplete board mounting before apply', () => {
  const platform = presetTemplates.find(item => item.id === 'platform_structure');
  assert.ok(platform);
  const invalid = clonedTemplate(platform);
  const board = invalid.components.find(item => item.componentId === 'board_40x40');
  assert.ok(board);
  invalid.connections = invalid.connections.filter(item =>
    !(
      item.source.componentId === board.instanceId ||
      item.target.componentId === board.instanceId
    )
  );

  const validation = validateTemplate(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(item => item.includes('四角完整连接')));
});

run('finds a replacement board mount after removing a template platform board', () => {
  const template = presetTemplates.find(item => item.id === 'platform_structure');
  assert.ok(template);
  const instance = instantiateTemplate({
    template,
    existingComponents: [],
    existingConnections: [],
    origin: [80, 0, 40],
    rotationY: 90,
    mode: 'auto',
  });
  const board = instance.components.find(item => item.componentId === 'board_40x40');
  assert.ok(board);
  const components = instance.components.filter(item => item.instanceId !== board.instanceId);
  const connections = instance.connections.filter(item =>
    item.source.componentId !== board.instanceId &&
    item.target.componentId !== board.instanceId
  );
  const sites = boardMountSystem.listBoardMountSites({
    boardComponentId: 'board_40x40',
    components,
    connections,
  });

  assert.equal(sites.length, 6);
  assert.deepEqual(new Set(sites.map(site => site.plane)), new Set(['XZ', 'XY', 'YZ']));
  const replacementSite = sites.find(site =>
    site.position.every((value, index) => Math.abs(value - board.position[index]) < 0.01)
  );
  assert.ok(replacementSite);
  assert.deepEqual(
    replacementSite.position.map(value => Math.round(value)),
    board.position.map(value => Math.round(value))
  );
  const rayOrigin: [number, number, number] = [200, 180, 200];
  const rayDirectionVector = new THREE.Vector3(
    replacementSite.position[0] - rayOrigin[0],
    replacementSite.position[1] - rayOrigin[1],
    replacementSite.position[2] - rayOrigin[2]
  ).normalize();
  const raySite = boardMountSystem.findNearestBoardMountSiteByRay({
    boardComponentId: 'board_40x40',
    components,
    connections,
    rayOrigin,
    rayDirection: [
      rayDirectionVector.x,
      rayDirectionVector.y,
      rayDirectionVector.z,
    ],
  });
  assert.equal(raySite?.id, replacementSite.id);
});

run('instantiates templates with remapped ids and automatic pipe colors', () => {
  const template = presetTemplates.find(item => item.id === 'simple_frame');
  assert.ok(template);
  const instance = instantiateTemplate({
    template,
    existingComponents: [],
    existingConnections: [],
    origin: [80, 0, 0],
    rotationY: 90,
    mode: 'auto',
  });
  assert.equal(instance.components.length, template.components.length);
  assert.equal(instance.connections.length, template.connections.length);
  assert.ok(instance.components.every(item => item.instanceId.startsWith('tpl_')));
  instance.components
    .filter(item => item.componentId.startsWith('pipe_'))
    .forEach(item => assert.ok(isPipeColor(item.color)));
  assertConnectionsAligned(instance.components, instance.connections);
});

run('instantiates templates without stale connection references after translation and rotation', () => {
  const template = presetTemplates.find(item => item.id === 'cube_frame');
  assert.ok(template);
  const instance = instantiateTemplate({
    template,
    existingComponents: [],
    existingConnections: [],
    origin: [120, 15, -80],
    rotationY: 90,
    mode: 'auto',
  });
  const componentIds = new Set(instance.components.map(item => item.instanceId));

  assert.equal(componentIds.size, template.components.length);
  instance.connections.forEach(item => {
    assert.equal(componentIds.has(item.source.componentId), true);
    assert.equal(componentIds.has(item.target.componentId), true);
    assert.notEqual(item.source.componentId, item.target.componentId);
  });
  assertConnectionsAligned(instance.components, instance.connections);
});

run('keeps automatic template preview colors stable before final placement', () => {
  const template = presetTemplates.find(item => item.id === 'platform_structure');
  assert.ok(template);
  const input = {
    template,
    existingComponents: [
      { ...component('existing-red', 'pipe_35cm', [200, 0, 0]), color: 'red' as const },
    ],
    existingConnections: [] as Connection[],
    mode: 'auto' as const,
  };
  const first = instantiateTemplate(input);
  const second = instantiateTemplate(input);

  assert.deepEqual(
    first.components.map(item => item.color),
    second.components.map(item => item.color)
  );
});

run('commits template replacement and insertion as single topology history entries', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([component('existing-template-pipe', 'pipe_35cm', [0, 0, 0])]);
  const template = presetTemplates.find(item => item.id === 'simple_frame');
  assert.ok(template);
  const replacePatch = createTemplatePatch({
    template,
    existingComponents: useDesignStore.getState().components,
    existingConnections: useDesignStore.getState().connections,
    replace: true,
    origin: [0, 0, 0],
    mode: 'auto',
  });
  const beforeReplaceHistoryIndex = useDesignStore.getState().historyIndex;

  store.commitTopologyPatch(replacePatch);
  assert.equal(useDesignStore.getState().historyIndex, beforeReplaceHistoryIndex + 1);
  assert.equal(useDesignStore.getState().components.some(item => item.instanceId === 'existing-template-pipe'), false);
  assert.equal(useDesignStore.getState().connections.length, template.connections.length);

  const beforeInsertHistoryIndex = useDesignStore.getState().historyIndex;
  const insertPatch = createTemplatePatch({
    template,
    existingComponents: useDesignStore.getState().components,
    existingConnections: useDesignStore.getState().connections,
    replace: false,
    origin: [100, 0, 0],
    rotationY: 90,
    mode: 'auto',
  });
  store.commitTopologyPatch(insertPatch);
  assert.equal(useDesignStore.getState().historyIndex, beforeInsertHistoryIndex + 1);
  assert.equal(useDesignStore.getState().connections.length, template.connections.length * 2);

  store.undo();
  assert.equal(useDesignStore.getState().connections.length, template.connections.length);
});

run('previews, rotates and commits whole-template placement as one history step', () => {
  const store = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  store.reset();
  interactionStore.reset();
  const template = presetTemplates.find(item => item.id === 'simple_frame');
  assert.ok(template);
  const instance = instantiateTemplate({
    template,
    existingComponents: [],
    existingConnections: [],
    mode: 'auto',
  });
  const previewPipeColors = new Map(
    instance.components
      .filter(item => item.componentId.startsWith('pipe_'))
      .map(item => [item.instanceId, item.color])
  );
  const historyBeforePreview = useDesignStore.getState().historyIndex;

  interactionStore.startTemplatePlacement({
    templateId: template.id,
    templateName: template.name,
    components: instance.components,
    connections: instance.connections,
  });
  interactionStore.updateTemplatePlacementOrigin([80, 0, 40]);
  interactionStore.rotateTemplatePlacement();
  assert.equal(useDesignStore.getState().historyIndex, historyBeforePreview);
  assert.equal(
    useInteractionStore.getState().interaction.templatePlacement?.rotationY,
    90
  );

  assert.equal(commitActivePlacement(), true);
  assert.equal(useDesignStore.getState().historyIndex, 1);
  assert.equal(useDesignStore.getState().history.length, 2);
  assert.equal(useDesignStore.getState().components.length, template.components.length);
  assert.equal(useDesignStore.getState().connections.length, template.connections.length);
  assert.deepEqual(
    new Map(
      useDesignStore.getState().components
        .filter(item => item.componentId.startsWith('pipe_'))
        .map(item => [item.instanceId, item.color])
    ),
    previewPipeColors
  );
  assert.equal(useInteractionStore.getState().interaction.templatePlacement, null);
  assert.equal(
    useInteractionStore.getState().interaction.selectedComponents.length,
    template.components.length
  );

  store.undo();
  assert.equal(useDesignStore.getState().components.length, 0);
  assert.equal(useDesignStore.getState().connections.length, 0);
});

run('stores automatic pipe color mode outside document history', () => {
  const store = useDesignStore.getState();
  store.reset();
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  useBuildPreferencesStore.getState().setPipeColorMode('blue');
  assert.equal(useBuildPreferencesStore.getState().pipeColorMode, 'blue');
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
  useBuildPreferencesStore.getState().setPipeColorMode('auto');
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
});

run('commits a pipe color change as one undoable history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement({ ...component('color-pipe', 'pipe_35cm', [0, 0, 0]), color: 'blue' });
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  store.commitComponentUpdate('color-pipe', { color: 'red' });
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex + 1);
  assert.equal(useDesignStore.getState().components[0].color, 'red');

  store.undo();
  assert.equal(useDesignStore.getState().components[0].color, 'blue');
  store.redo();
  assert.equal(useDesignStore.getState().components[0].color, 'red');
});

run('keeps pipe color menu state out of document history', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement({ ...component('menu-pipe', 'pipe_35cm', [0, 0, 0]), color: 'blue' });
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;
  const interactionStore = useInteractionStore.getState();

  interactionStore.openPipeColorMenu('menu-pipe', 100, 120);
  interactionStore.closeContextMenu();
  interactionStore.openPipeColorMenu('menu-pipe', 105, 125);
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, ['menu-pipe']);
  assert.equal(useInteractionStore.getState().interaction.contextMenu?.kind, 'pipe-color');
});

run('classifies short right-clicks as color menu and right-drags as camera pan', () => {
  assert.equal(
    shouldOpenPipeColorMenu({ clientX: 100, clientY: 100 }, { clientX: 106, clientY: 100 }),
    true
  );
  assert.equal(
    shouldOpenPipeColorMenu({ clientX: 100, clientY: 100 }, { clientX: 107, clientY: 100 }),
    false
  );
});

run('ranks compatible connection snap before grid snap', () => {
  const target = component('target', 'connector_L', [23, 0, 0]);
  const suggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [22, 0, -15],
    components: [target],
    connections: [],
    options: { gridSize: 20, enableConnectionSnap: true, enableGridSnap: true },
  });

  assert.equal(suggestion.snapType, 'connection');
  assert.equal(suggestion.target?.componentId, 'target');
  assert.notDeepEqual(suggestion.position, [20, 0, -20]);
});

run('uses grid snap when no compatible component snap exists', () => {
  const suggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [22, 0, 38],
    components: [],
    connections: [],
    options: { gridSize: 20, enableGridSnap: true },
  });

  assert.equal(suggestion.snapType, 'grid');
  assert.deepEqual(suggestion.position, [20, 0, 40]);
});

run('excludes the dragged instance while ranking move suggestions', () => {
  const moving = component('moving', 'pipe_35cm', [0, 0, 0]);
  const suggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [0, 0, 0],
    components: [moving],
    connections: [],
    options: { excludeInstanceId: 'moving', enableConnectionSnap: true, enableGridSnap: true },
  });

  assert.notEqual(suggestion.target?.componentId, 'moving');
});

run('does not duplicate an existing connection', () => {
  const target = component('target', 'connector_L', [0, 0, 0]);
  const suggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [0, 0, -15],
    components: [target],
    connections: [],
    options: { enableConnectionSnap: true },
  });
  const existing = connection('conn_existing', 'new', suggestion.sourcePointId!, 'target', suggestion.target!.pointId);

  assert.equal(
    constructionEngine.createConnectionForSuggestion('new', suggestion, [existing]),
    null
  );
});

run('lists only available endpoints for endpoint growth', () => {
  const pipe = component('pipe-1', 'pipe_35cm', [0, 0, 0]);
  const endpoints = endpointGrowthSystem.listAvailableEndpoints(
    [pipe],
    [connection('used', 'pipe-1', 'start', 'other', 'input')],
    ['pipe-1']
  );

  assert.deepEqual(endpoints.map(endpoint => endpoint.pointId), ['end']);
});

run('lists predictable endpoints across the whole scene in stable order', () => {
  const components = [
    component('global-a', 'pipe_35cm', [0, 0, 0]),
    component('global-b', 'pipe_35cm', [100, 0, 0]),
  ];
  const input = {
    components,
    connections: [],
    pipeComponentId: 'pipe_35cm' as const,
  };
  const first = endpointGrowthSystem.listPredictionEndpoints(input);
  const second = endpointGrowthSystem.listPredictionEndpoints(input);

  assert.deepEqual(
    first.map(endpoint => `${endpoint.componentId}:${endpoint.pointId}`),
    [
      'global-a:start',
      'global-a:end',
      'global-b:start',
      'global-b:end',
    ]
  );
  assert.deepEqual(second, first);
  first.forEach(endpoint => {
    assert.ok(
      endpointGrowthSystem.generateCandidates({
        endpoint,
        pipeComponentId: input.pipeComponentId,
        components,
        connections: [],
      }).length > 0
    );
  });
});

run('excludes occupied and non-growable endpoints from global prediction', () => {
  const pipe = component('global-filter', 'pipe_35cm', [0, 0, 0]);
  const occupied = endpointGrowthSystem.listPredictionEndpoints({
    components: [pipe],
    connections: [
      connection('used-global', pipe.instanceId, 'start', 'other', 'input'),
    ],
    pipeComponentId: 'pipe_35cm',
  });
  const noCompatibleConnector = endpointGrowthSystem.listPredictionEndpoints({
    components: [pipe],
    connections: [],
    pipeComponentId: 'pipe_35cm',
    connectorComponentId: 'missing-connector',
  });

  assert.deepEqual(occupied.map(endpoint => endpoint.pointId), ['end']);
  assert.deepEqual(noCompatibleConnector, []);
});

run('selects the smallest connector for each endpoint growth direction', () => {
  const pipe = component('pipe-1', 'pipe_35cm', [0, 0, 0]);
  const longCandidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'pipe-1', pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components: [pipe],
    connections: [],
  });
  const shortCandidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'pipe-1', pointId: 'end' },
    pipeComponentId: 'pipe_15cm',
    components: [pipe],
    connections: [],
  });

  assert.equal(longCandidates.length, 5);
  assert.equal(longCandidates[0].label, '直行');
  assert.equal(longCandidates[0].kind, 'connector-pipe');
  assert.equal(longCandidates[0].connector.componentId, 'connector_straight');
  assert.deepEqual(
    longCandidates.filter(candidate =>
      candidate.kind === 'connector-pipe' &&
      candidate.connector.componentId === 'connector_L'
    ).length,
    4
  );
  assert.equal(
    longCandidates.some(candidate =>
      candidate.kind === 'connector-pipe' &&
      ['connector_T', 'connector_3way', 'connector_4way', 'connector_5way'].includes(
        candidate.connector.componentId
      )
    ),
    false
  );
  assert.equal(longCandidates[0].referenceSpan, 2);
  assert.equal(shortCandidates[0].referenceSpan, 1);

  const placement = endpointGrowthSystem.createPlacement(longCandidates[0], {
    idFactory: (prefix) => `${prefix}_fixed`,
  });
  assert.equal(placement.components.length, 2);
  assert.equal(placement.components[0].componentId, 'connector_straight');
  assert.equal(placement.components[1].componentId, 'pipe_35cm');
  assert.equal(placement.connections.length, 2);
  assert.deepEqual(placement.nextEndpoint, {
    componentId: 'pipe_fixed',
    pointId: 'end',
  });
});

run('extends directly from an existing connector endpoint', () => {
  const connector = component('cross-1', 'connector_cross', [0, 0, 0]);
  const candidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'cross-1', pointId: 'output1' },
    pipeComponentId: 'pipe_15cm',
    components: [connector],
    connections: [],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'direct-pipe');
  assert.equal(candidates[0].label, '直行');

  const placement = endpointGrowthSystem.createPlacement(candidates[0], {
    idFactory: (prefix) => `${prefix}_direct`,
  });
  assert.deepEqual(placement.components.map(item => item.componentId), ['pipe_15cm']);
  assert.equal(placement.connections.length, 1);
  assert.equal(placement.connections[0].source.pointId, 'output1');
  assert.equal(placement.connections[0].target.pointId, 'start');
});

run('filters occupied endpoints and duplicate growth directions', () => {
  const pipe = component('pipe-filter', 'pipe_35cm', [0, 0, 0]);
  assert.deepEqual(
    endpointGrowthSystem.generateCandidates({
      endpoint: { componentId: pipe.instanceId, pointId: 'end' },
      pipeComponentId: 'pipe_35cm',
      components: [pipe],
      connections: [
        connection('occupied', pipe.instanceId, 'end', 'other', 'input'),
      ],
    }),
    []
  );

  const initialCandidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: pipe.instanceId, pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components: [pipe],
    connections: [],
  });
  const straight = initialCandidates[0];
  const duplicate = component(
    'duplicate-pipe',
    straight.pipeComponentId,
    straight.pipePosition,
    straight.pipeRotation
  );
  const filteredCandidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: pipe.instanceId, pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components: [pipe, duplicate],
    connections: [],
  });

  assert.equal(filteredCandidates.length, 4);
  assert.equal(
    filteredCandidates.some(candidate => candidate.label === '直行'),
    false
  );
});

run('chooses a predictable default endpoint for continuous building', () => {
  const pipe = component('pipe-default', 'pipe_35cm', [0, 0, 0]);
  assert.deepEqual(
    endpointGrowthSystem.chooseDefaultEndpoint({
      componentId: pipe.instanceId,
      components: [pipe],
      connections: [],
    }),
    { componentId: pipe.instanceId, pointId: 'end' }
  );
  assert.deepEqual(
    endpointGrowthSystem.chooseDefaultEndpoint({
      componentId: pipe.instanceId,
      components: [pipe],
      connections: [connection('used-end', pipe.instanceId, 'end', 'other', 'input')],
    }),
    { componentId: pipe.instanceId, pointId: 'start' }
  );

  const connector = component('connector-default', 'connector_cross', [0, 0, 0]);
  assert.equal(
    endpointGrowthSystem.chooseDefaultEndpoint({
      componentId: connector.instanceId,
      components: [connector],
      connections: [],
    }),
    null
  );
});

run('activates growth for a selected pipe and exits growth before clearing selection', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('selected-pipe', 'pipe_35cm', [0, 0, 0]));

  const interactionStore = useInteractionStore.getState();
  interactionStore.selectComponents(['selected-pipe']);
  assert.deepEqual(
    activateDefaultGrowthEndpoint('selected-pipe'),
    { componentId: 'selected-pipe', pointId: 'end' }
  );

  assert.equal(cancelActiveInteraction(), 'growth');
  assert.deepEqual(
    useInteractionStore.getState().interaction.selectedComponents,
    ['selected-pipe']
  );
  assert.equal(
    useInteractionStore.getState().interaction.growthState.selectedEndpoint,
    null
  );

  assert.equal(cancelActiveInteraction(), 'interaction');
  assert.deepEqual(
    useInteractionStore.getState().interaction.selectedComponents,
    []
  );
});

run('keeps global growth state session-only across selection changes', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('preview-a', 'pipe_35cm', [0, 0, 0]),
    component('preview-b', 'pipe_35cm', [40, 0, 0]),
  ]);
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;
  const interactionStore = useInteractionStore.getState();

  interactionStore.selectComponents(['preview-a']);
  interactionStore.selectGrowthEndpoint({
    componentId: 'preview-a',
    pointId: 'end',
  });
  interactionStore.setHoveredGrowthCandidate({
    id: 'candidate-preview',
    message: '将添加：一字接头＋35cm直管',
  });
  interactionStore.setGrowthPipeComponent('pipe_15cm');

  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
  assert.equal(
    useInteractionStore.getState().interaction.growthState.pipeComponentId,
    'pipe_15cm'
  );
  assert.equal(
    useInteractionStore.getState().interaction.growthState.hoveredCandidate,
    null
  );

  interactionStore.setHoveredGrowthCandidate({
    id: 'candidate-preview',
    message: '将添加：一字接头＋15cm直管',
  });
  interactionStore.selectComponents(['preview-a', 'preview-b']);
  assert.deepEqual(
    useInteractionStore.getState().interaction.growthState.selectedEndpoint,
    { componentId: 'preview-a', pointId: 'end' }
  );
  assert.deepEqual(
    useInteractionStore.getState().interaction.growthState.hoveredCandidate,
    {
      id: 'candidate-preview',
      message: '将添加：一字接头＋15cm直管',
    }
  );
  interactionStore.setShowAvailablePositions(false);
  interactionStore.setShowAvailablePositions(true);
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
});

run('commits endpoint growth as one undoable store step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('base', 'pipe_35cm', [0, 0, 0]));

  const candidate = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'base', pointId: 'end' },
    pipeComponentId: 'pipe_15cm',
    components: useDesignStore.getState().components,
    connections: useDesignStore.getState().connections,
  })[0];
  let idCounter = 0;
  const placement = endpointGrowthSystem.createPlacement(candidate, {
    idFactory: (prefix) => `${prefix}_${++idCounter}`,
  });

  store.commitComponentsPlacement(placement.components, placement.connections);
  assert.equal(useDesignStore.getState().components.length, 3);
  assert.equal(useDesignStore.getState().connections.length, 2);

  useDesignStore.getState().undo();
  assert.equal(useDesignStore.getState().components.length, 1);
  assert.equal(useDesignStore.getState().connections.length, 0);
});

run('scans valid prediction endpoints from whole scene without selection', () => {
  const store = useDesignStore.getState();
  store.reset();
  const source = component('source', 'pipe_35cm', [0, 0, 0]);
  const remote = component('remote', 'pipe_35cm', [40, 0, 0]);
  store.commitComponentsPlacement([source, remote]);
  const design = useDesignStore.getState();

  const predictionEndpoints = endpointGrowthSystem.listPredictionEndpoints({
    pipeComponentId: 'pipe_35cm',
    components: design.components,
    connections: design.connections,
  });
  assert.equal(predictionEndpoints.length >= 2, true);
  assert.ok(
    new Set(predictionEndpoints.map(endpoint => endpoint.componentId)).size >= 2
  );
});

run('keeps growth candidates out of history and validates active endpoint on reconcile', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([component('predict-a', 'pipe_35cm', [0, 0, 0])]);
  let design = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  interactionStore.selectGrowthEndpoint({ componentId: 'predict-a', pointId: 'end' });
  const candidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'predict-a', pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components: design.components,
    connections: design.connections,
  });
  const placement = endpointGrowthSystem.createPlacement(candidates[0], {
    idFactory: (prefix) => `preview-clean_${prefix}`,
  });
  store.commitComponentsPlacement(placement.components, placement.connections);
  design = useDesignStore.getState();
  interactionStore.selectGrowthEndpoint({ componentId: 'predict-a', pointId: 'end' });
  interactionStore.reconcileDocumentComponents(
    design.components,
    design.connections
  );
  assert.equal(
    useInteractionStore.getState().interaction.growthState.selectedEndpoint,
    null
  );
  assert.equal(design.historyIndex >= 1, true);
});

run('commits growth from an unselected global endpoint as one undoable step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('selected-source', 'pipe_35cm', [0, 0, 0]),
    component('remote-source', 'pipe_35cm', [100, 0, 0]),
  ]);
  const interactionStore = useInteractionStore.getState();
  interactionStore.selectComponents(['selected-source']);
  interactionStore.selectGrowthEndpoint({
    componentId: 'remote-source',
    pointId: 'end',
  });
  const beforeComponents = useDesignStore.getState().components.length;
  const beforeConnections = useDesignStore.getState().connections.length;
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;
  const candidate = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'remote-source', pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components: useDesignStore.getState().components,
    connections: useDesignStore.getState().connections,
  })[0];

  assert.equal(commitActiveGrowthCandidate(candidate.id), true);
  const committed = useDesignStore.getState();
  const selectedPipeId =
    useInteractionStore.getState().interaction.selectedComponents[0];
  assert.equal(committed.historyIndex, beforeHistoryIndex + 1);
  assert.equal(committed.components.length, beforeComponents + 2);
  assert.equal(committed.connections.length, beforeConnections + 2);
  assert.ok(
    committed.connections.some(
      item =>
        item.source.componentId === 'remote-source' &&
        item.source.pointId === 'end'
    )
  );
  assert.notEqual(selectedPipeId, 'selected-source');
  assert.deepEqual(
    useInteractionStore.getState().interaction.growthState.selectedEndpoint,
    { componentId: selectedPipeId, pointId: 'end' }
  );

  useDesignStore.getState().undo();
  assert.equal(useDesignStore.getState().components.length, beforeComponents);
  assert.equal(useDesignStore.getState().connections.length, beforeConnections);
});

run('keeps selection session-only across document undo and redo', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('base', 'pipe_35cm', [0, 0, 0]));

  const interactionStore = useInteractionStore.getState();
  interactionStore.selectComponents(['base']);
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  store.commitComponentMove('base', [20, 0, 0]);
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex + 1);
  assert.equal('selectedComponents' in useDesignStore.getState().editor, false);
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, ['base']);

  useDesignStore.getState().undo();
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, ['base']);

  useDesignStore.getState().redo();
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, ['base']);
});

run('keeps grid size and grid visibility out of interaction state', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.setEditorState({ gridSize: 25, showGrid: false, showConnections: true });

  const interactionStore = useInteractionStore.getState();
  interactionStore.setGridSize(40);
  interactionStore.setShowGrid(true);
  interactionStore.setShowConnections(false);

  assert.equal(useDesignStore.getState().editor.gridSize, 25);
  assert.equal(useDesignStore.getState().editor.showGrid, false);
  assert.equal(useDesignStore.getState().editor.showConnections, true);
  assert.equal('gridSize' in useInteractionStore.getState().interaction, false);
  assert.equal('showGrid' in useInteractionStore.getState().interaction, false);
  assert.equal('showConnections' in useInteractionStore.getState().interaction, false);
});

run('hydrates a loaded design as a fresh undo baseline', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('old', 'pipe_15cm', [0, 0, 0]));
  const interactionStore = useInteractionStore.getState();
  interactionStore.setSnapToGrid(false);
  interactionStore.startPlace('pipe_35cm');

  const loadedDesign: Design = {
    name: 'loaded',
    version: '1.0',
    status: 'draft',
    components: [
      component('loaded-a', 'pipe_35cm', [20, 0, 40]),
      component('loaded-b', 'connector_L', [20, 0, 60]),
    ],
    connections: [
      connection('loaded-connection', 'loaded-a', 'end', 'loaded-b', 'input'),
    ],
    materials: {},
    settings: {
      gridSize: 10,
      snapToGrid: true,
      showConnections: true,
      viewMode: 'wireframe',
    },
  };

  store.hydrateDesign(loadedDesign);
  const state = useDesignStore.getState();
  assert.deepEqual(state.components.map(item => item.instanceId), ['loaded-a', 'loaded-b']);
  assert.equal(state.connections.length, 1);
  assert.deepEqual(state.editor, {
    gridSize: 10,
    showGrid: true,
    showConnections: true,
    viewMode: 'wireframe',
  });
  assert.equal(state.history.length, 1);
  assert.equal(state.historyIndex, 0);
  assert.equal(useInteractionStore.getState().interaction.mode, 'select');
  assert.equal(useInteractionStore.getState().interaction.snapToGrid, false);

  state.undo();
  assert.deepEqual(useDesignStore.getState().components.map(item => item.instanceId), ['loaded-a', 'loaded-b']);

  state.commitComponentMove('loaded-a', [40, 0, 40]);
  assert.equal(useDesignStore.getState().historyIndex, 1);
  useDesignStore.getState().undo();
  assert.deepEqual(useDesignStore.getState().components[0].position, [20, 0, 40]);

  state.hydrateDesign({
    ...loadedDesign,
    name: 'legacy-grid',
    settings: {
      ...loadedDesign.settings,
      gridSize: 0,
    },
  });
  assert.equal(useDesignStore.getState().editor.gridSize, 20);
  assert.equal(useDesignStore.getState().currentDesign?.settings.gridSize, 20);
});

run('commits multi-delete as one undoable document step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement(
    [
      component('a', 'pipe_35cm', [0, 0, 0]),
      component('b', 'pipe_35cm', [20, 0, 0]),
      component('c', 'pipe_35cm', [40, 0, 0]),
    ],
    [
      connection('ab', 'a', 'end', 'b', 'start'),
      connection('bc', 'b', 'end', 'c', 'start'),
    ]
  );
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;
  const interactionStore = useInteractionStore.getState();
  interactionStore.selectComponents(['a', 'b']);
  interactionStore.setHoveredComponent('b');
  interactionStore.selectGrowthEndpoint({ componentId: 'a', pointId: 'end' });
  interactionStore.startDrag('b', [0, 0, 0]);

  store.commitComponentsDeletion(['a', 'b']);
  let state = useDesignStore.getState();
  assert.equal(state.historyIndex, beforeHistoryIndex + 1);
  assert.deepEqual(state.components.map(item => item.instanceId), ['c']);
  assert.deepEqual(state.connections, []);
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, []);
  assert.equal(useInteractionStore.getState().interaction.hoveredComponent, null);
  assert.equal(useInteractionStore.getState().interaction.growthState.selectedEndpoint, null);
  assert.equal(useInteractionStore.getState().interaction.isDragging, false);
  assert.equal(useInteractionStore.getState().interaction.dragTarget, null);

  state.undo();
  state = useDesignStore.getState();
  assert.deepEqual(state.components.map(item => item.instanceId), ['a', 'b', 'c']);
  assert.equal(state.connections.length, 2);
});

run('copies the explicit component ids without reading session selection', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('copy-a', 'pipe_35cm', [0, 0, 0]),
    component('copy-b', 'pipe_35cm', [20, 0, 0]),
  ]);
  useInteractionStore.getState().selectComponents(['copy-a']);

  store.copySelected(['copy-b']);

  assert.deepEqual(
    useDesignStore.getState().clipboard.map(item => item.instanceId),
    ['copy-b']
  );
});

run('commits transform changes as one undoable document step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('moving', 'pipe_35cm', [0, 0, 0]));
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  store.commitComponentMove('moving', [40, 0, 20], [0, 90, 0]);
  let state = useDesignStore.getState();
  assert.equal(state.historyIndex, beforeHistoryIndex + 1);
  assert.deepEqual(state.components[0].position, [40, 0, 20]);
  assert.deepEqual(state.components[0].rotation, [0, 90, 0]);

  state.undo();
  state = useDesignStore.getState();
  assert.deepEqual(state.components[0].position, [0, 0, 0]);
  assert.deepEqual(state.components[0].rotation, [0, 0, 0]);
});

run('updates drag preview without recording document history', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentPlacement(component('dragged', 'pipe_35cm', [0, 0, 0]));
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  const interactionStore = useInteractionStore.getState();
  interactionStore.startDrag('dragged', [2, 0, 3]);
  const update = interactionStore.updateDrag([27, 0, 44], {
    gridSize: useDesignStore.getState().editor.gridSize,
  });

  assert.deepEqual(update, { targetId: 'dragged', position: [18, 0, 37] });
  assert.equal(useDesignStore.getState().historyIndex, beforeHistoryIndex);
  assert.deepEqual(useDesignStore.getState().components[0].position, [0, 0, 0]);
});

run('commits the active placement preview as one document transaction', () => {
  const store = useDesignStore.getState();
  store.reset();
  const interactionStore = useInteractionStore.getState();
  interactionStore.startPlace('pipe_35cm');
  interactionStore.updatePlacePreview({
    position: [20, 0, 40],
    rotation: [0, 90, 0],
    isValid: true,
    snapType: 'grid',
  });

  assert.equal(commitActivePlacement(), true);
  const state = useDesignStore.getState();
  assert.equal(state.components.length, 1);
  assert.deepEqual(state.components[0].position, [20, 0, 40]);
  assert.deepEqual(state.components[0].rotation, [0, 90, 0]);
  assert.equal(state.historyIndex, 1);
  assert.equal(useInteractionStore.getState().interaction.mode, 'select');
  assert.deepEqual(
    useInteractionStore.getState().interaction.selectedComponents,
    [state.components[0].instanceId]
  );
  assert.deepEqual(
    useInteractionStore.getState().interaction.growthState.selectedEndpoint,
    { componentId: state.components[0].instanceId, pointId: 'end' }
  );
  assert.equal(commitActivePlacement(), false);

  state.undo();
  assert.equal(useDesignStore.getState().components.length, 0);
  assert.deepEqual(useInteractionStore.getState().interaction.selectedComponents, []);
});

run('generates endpoint growth candidates quickly for a 50-component scene', () => {
  const components = Array.from({ length: 50 }, (_, index) =>
    component(`pipe-${index}`, 'pipe_35cm', [index * 20, 0, 0])
  );
  const start = Date.now();
  const candidates = endpointGrowthSystem.generateCandidates({
    endpoint: { componentId: 'pipe-0', pointId: 'end' },
    pipeComponentId: 'pipe_35cm',
    components,
    connections: [],
  });
  const elapsedMs = Date.now() - start;

  assert.ok(candidates.length > 0);
  assert.ok(elapsedMs < 100, `candidate generation took ${elapsedMs}ms`);
});

run('lists global prediction endpoints quickly for a 50-component scene', () => {
  const components = Array.from({ length: 50 }, (_, index) =>
    component(`global-pipe-${index}`, 'pipe_35cm', [index * 100, 0, 0])
  );
  const start = Date.now();
  const endpoints = endpointGrowthSystem.listPredictionEndpoints({
    pipeComponentId: 'pipe_35cm',
    components,
    connections: [],
  });
  const elapsedMs = Date.now() - start;

  assert.equal(endpoints.length, 100);
  assert.ok(elapsedMs < 100, `global endpoint scan took ${elapsedMs}ms`);
  assert.ok(
    endpointGrowthSystem.generateCandidates({
      endpoint: endpoints[0],
      pipeComponentId: 'pipe_35cm',
      components,
      connections: [],
    }).length <= 5
  );
});

run('audits 50 components and resolves one placement contact set under 100ms', () => {
  const auditComponents = Array.from({ length: 50 }, (_, index) =>
    component(`audit-${index}`, 'pipe_35cm', [index * 100, 0, 0])
  );
  const auditStart = Date.now();
  const report = auditTopology({ components: auditComponents, connections: [] });
  const auditElapsed = Date.now() - auditStart;
  assert.equal(report.freeEndpointCount, 100);
  assert.ok(auditElapsed < 100, `topology audit took ${auditElapsed}ms`);

  const contactComponents = [
    component('perf-left', 'connector_5way', [0, 0, -20]),
    component('perf-right', 'connector_5way', [0, 0, 20], [180, 0, 0]),
    component('perf-bridge', 'pipe_35cm', [0, 0, 0]),
    ...Array.from({ length: 47 }, (_, index) =>
      component(`perf-far-${index}`, 'pipe_35cm', [500 + index * 100, 0, 0])
    ),
  ];
  const contactStart = Date.now();
  const resolution = resolvePlacementContacts({
    components: contactComponents,
    connections: [],
    placementComponentIds: ['perf-bridge'],
  });
  const contactElapsed = Date.now() - contactStart;
  assert.equal(resolution.addConnections.length, 2);
  assert.ok(contactElapsed < 100, `contact resolution took ${contactElapsed}ms`);
});

run('resolves the minimum canonical connector for cardinal topology', () => {
  const resolve = (
    directions: Array<[number, number, number]>
  ) =>
    connectorTopologySystem.resolveConnectorTopology({
      requiredDirections: directions,
    })?.connectorComponentId ?? null;

  assert.equal(resolve([[0, 0, -1], [0, 0, 1]]), 'connector_straight');
  assert.equal(resolve([[0, 0, -1], [1, 0, 0]]), 'connector_L');
  assert.equal(
    resolve([[0, 0, -1], [0, 0, 1], [1, 0, 0]]),
    'connector_T'
  );
  assert.equal(
    resolve([[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
    'connector_3way'
  );
  assert.equal(
    resolve([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]),
    'connector_4way'
  );
  assert.equal(
    resolve([[1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, 1, 0]]),
    'connector_5way'
  );
  assert.equal(
    resolve([
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
    ]),
    'connector_5way'
  );
  assert.equal(
    resolve([
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]),
    null
  );
  assert.equal(resolve([[0, 0, -1], [0.707, 0, 0.707]]), null);
});

run('predicts full connector upgrades and applies upgrade and downgrade topology', () => {
  let components = [
    component('adaptive-connector', 'connector_straight', [0, 0, 0]),
    component('adaptive-negative', 'pipe_35cm', [0, 0, -20]),
    component('adaptive-positive', 'pipe_35cm', [0, 0, 20]),
  ];
  let connections = [
    connection(
      'adaptive-negative-connection',
      'adaptive-connector',
      'input',
      'adaptive-negative',
      'end'
    ),
    connection(
      'adaptive-positive-connection',
      'adaptive-connector',
      'output',
      'adaptive-positive',
      'start'
    ),
  ];
  let idCounter = 0;
  const addedPipes: string[] = [];

  const extendVirtualDirection = (
    directionKey: string,
    expectedConnectorId: string
  ) => {
    const site = endpointGrowthSystem
      .listPredictionSites({
        components,
        connections,
        pipeComponentId: 'pipe_35cm',
      })
      .find(
        candidate =>
          candidate.kind === 'virtual-connector-port' &&
          candidate.connectorInstanceId === 'adaptive-connector' &&
          candidate.directionKey === directionKey
      );
    assert.ok(site, `missing virtual site ${directionKey}`);

    const candidate = endpointGrowthSystem.generateCandidates({
      site,
      pipeComponentId: 'pipe_35cm',
      components,
      connections,
    })[0];
    assert.equal(candidate.kind, 'upgrade-connector-pipe');
    const patch = endpointGrowthSystem.createTopologyPatch(candidate, {
      components,
      connections,
      idFactory: prefix => `${prefix}-${++idCounter}`,
    });
    assert.ok(patch);
    assert.equal(patch.updateComponents[0].instanceId, 'adaptive-connector');
    addedPipes.push(patch.selectInstanceId!);

    const next = connectorTopologySystem.applyTopologyPatch({
      components,
      connections,
      patch,
    });
    components = next.components;
    connections = next.connections;

    const connector = components.find(
      item => item.instanceId === 'adaptive-connector'
    );
    assert.equal(connector?.componentId, expectedConnectorId);
    assert.equal(connector?.properties?.connectorManagement, 'auto');
    assert.ok(
      connections.some(item => item.id === 'adaptive-negative-connection')
    );
    assert.ok(
      connections.some(item => item.id === 'adaptive-positive-connection')
    );
    assertConnectionsAligned(components, connections);
  };

  const initialSites = endpointGrowthSystem.listPredictionSites({
    components,
    connections,
    pipeComponentId: 'pipe_35cm',
  });
  assert.ok(
    initialSites.some(
      site =>
        site.kind === 'virtual-connector-port' &&
        site.directionKey === 'x+'
    )
  );

  extendVirtualDirection('x+', 'connector_T');
  extendVirtualDirection('x-', 'connector_4way');
  extendVirtualDirection('y+', 'connector_5way');

  const sixthDirectionSites = endpointGrowthSystem
    .listPredictionSites({
      components,
      connections,
      pipeComponentId: 'pipe_35cm',
    })
    .filter(
      site =>
        site.kind === 'virtual-connector-port' &&
        site.connectorInstanceId === 'adaptive-connector'
    );
  assert.deepEqual(sixthDirectionSites, []);

  const removePipe = (instanceId: string, expectedConnectorId: string) => {
    const next = connectorTopologySystem.applyTopologyPatch({
      components,
      connections,
      patch: {
        addComponents: [],
        updateComponents: [],
        removeComponentIds: [instanceId],
        addConnections: [],
        updateConnections: [],
        removeConnectionIds: connections
          .filter(
            item =>
              item.source.componentId === instanceId ||
              item.target.componentId === instanceId
          )
          .map(item => item.id),
      },
    });
    components = next.components;
    connections = next.connections;
    assert.equal(
      components.find(item => item.instanceId === 'adaptive-connector')
        ?.componentId,
      expectedConnectorId
    );
    assertConnectionsAligned(components, connections);
  };

  removePipe(addedPipes[2], 'connector_4way');
  removePipe(addedPipes[1], 'connector_T');
  removePipe(addedPipes[0], 'connector_straight');

  const afterSingleConnection = connectorTopologySystem.applyTopologyPatch({
    components,
    connections,
    patch: {
      addComponents: [],
      updateComponents: [],
      removeComponentIds: ['adaptive-positive'],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: ['adaptive-positive-connection'],
    },
  });
  assert.equal(
    afterSingleConnection.components.some(
      item => item.instanceId === 'adaptive-connector'
    ),
    false
  );
  assert.equal(afterSingleConnection.connections.length, 0);
  assert.ok(
    endpointGrowthSystem
      .listPredictionSites({
        ...afterSingleConnection,
        pipeComponentId: 'pipe_35cm',
      })
      .some(
        site =>
          site.kind === 'endpoint' &&
          site.componentId === 'adaptive-negative' &&
          site.pointId === 'end'
      )
  );
});

run('keeps manual connectors unchanged when a branch is removed', () => {
  const manualConnector = component(
    'manual-connector',
    'connector_T',
    [0, 0, 0]
  );
  const result = connectorTopologySystem.applyTopologyPatch({
    components: [
      manualConnector,
      component('manual-a', 'pipe_35cm', [0, 0, -20]),
      component('manual-b', 'pipe_35cm', [20, 0, 0], [0, 90, 0]),
      component('manual-c', 'pipe_35cm', [-20, 0, 0], [0, 90, 0]),
    ],
    connections: [
      connection('manual-a-connection', 'manual-connector', 'input', 'manual-a', 'end'),
      connection('manual-b-connection', 'manual-connector', 'output1', 'manual-b', 'start'),
      connection('manual-c-connection', 'manual-connector', 'output2', 'manual-c', 'end'),
    ],
    patch: {
      addComponents: [],
      updateComponents: [],
      removeComponentIds: ['manual-c'],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: ['manual-c-connection'],
    },
  });

  assert.equal(
    result.components.find(item => item.instanceId === 'manual-connector')
      ?.componentId,
    'connector_T'
  );
  assert.equal(result.connections.length, 2);
});

run('component library placement inserts the same minimum connector in one history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement([
    component('library-target', 'pipe_35cm', [0, 0, 0]),
  ]);
  const baselineHistoryIndex = useDesignStore.getState().historyIndex;
  const design = useDesignStore.getState();
  const suggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [0, 0, 35],
    draftRotation: [0, 0, 0],
    components: design.components,
    connections: design.connections,
    options: {
      enableConnectionSnap: true,
      enableAlignmentSnap: false,
      enableGridSnap: false,
    },
  });
  assert.equal(suggestion.connectorTarget?.connectorComponentId, 'connector_straight');
  assert.deepEqual(suggestion.position, [0, 0, 40]);

  const interaction = useInteractionStore.getState();
  interaction.startPlace('pipe_35cm');
  interaction.updatePlacePreview({
    position: suggestion.position,
    rotation: suggestion.rotation,
    isValid: true,
    snapType: suggestion.snapType,
    connectorTarget: suggestion.connectorTarget ?? null,
    snapSourcePointId: suggestion.sourcePointId ?? null,
    snapConfidence: suggestion.confidence,
    message: suggestion.message,
  });
  assert.equal(commitActivePlacement(), true);

  const placed = useDesignStore.getState();
  assert.equal(placed.historyIndex, baselineHistoryIndex + 1);
  assert.equal(placed.components.length, 3);
  assert.equal(placed.connections.length, 2);
  assert.equal(
    placed.components.find(item => item.componentId === 'connector_straight')
      ?.properties?.connectorManagement,
    'auto'
  );
  assertConnectionsAligned(placed.components, placed.connections);

  placed.undo();
  assert.equal(useDesignStore.getState().components.length, 1);
  assert.equal(useDesignStore.getState().connections.length, 0);
});

run('drag snap upgrades and moving away downgrades an automatic connector atomically', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement(
    [
      {
        ...component('drag-connector', 'connector_straight', [0, 0, 0]),
        properties: { connectorManagement: 'auto' },
      },
      component('drag-negative', 'pipe_35cm', [0, 0, -20]),
      component('drag-positive', 'pipe_35cm', [0, 0, 20]),
      component('drag-moving', 'pipe_35cm', [100, 0, 0]),
    ],
    [
      connection('drag-negative-connection', 'drag-connector', 'input', 'drag-negative', 'end'),
      connection('drag-positive-connection', 'drag-connector', 'output', 'drag-positive', 'start'),
    ]
  );
  let design = useDesignStore.getState();
  const upgradeSuggestion = constructionEngine.suggest({
    componentId: 'pipe_35cm',
    draftPosition: [20, 0, 0],
    draftRotation: [0, 90, 0],
    components: design.components,
    connections: design.connections,
    options: {
      excludeInstanceId: 'drag-moving',
      enableConnectionSnap: true,
      enableAlignmentSnap: false,
      enableGridSnap: false,
    },
  });
  assert.equal(upgradeSuggestion.topologyTarget?.directionKey, 'x+');
  const beforeUpgradeHistory = design.historyIndex;
  assert.equal(
    commitSuggestedComponentMove('drag-moving', upgradeSuggestion),
    true
  );

  design = useDesignStore.getState();
  assert.equal(design.historyIndex, beforeUpgradeHistory + 1);
  assert.equal(
    design.components.find(item => item.instanceId === 'drag-connector')
      ?.componentId,
    'connector_T'
  );
  assertConnectionsAligned(design.components, design.connections);

  const beforeMoveAwayHistory = design.historyIndex;
  assert.equal(
    commitSuggestedComponentMove('drag-moving', {
      componentId: 'pipe_35cm',
      position: [100, 0, 0],
      rotation: [0, 90, 0],
      snapType: 'free',
      confidence: 0,
      message: '自由放置',
    }),
    true
  );
  design = useDesignStore.getState();
  assert.equal(design.historyIndex, beforeMoveAwayHistory + 1);
  assert.equal(
    design.components.find(item => item.instanceId === 'drag-connector')
      ?.componentId,
    'connector_straight'
  );
  assert.equal(design.connections.length, 2);

  design.undo();
  assert.equal(
    useDesignStore
      .getState()
      .components.find(item => item.instanceId === 'drag-connector')
      ?.componentId,
    'connector_T'
  );
});

run('moves a two-ended pipe between connector pairs as one atomic history step', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.commitComponentsPlacement(
    [
      component('move-old-left', 'connector_5way', [0, 0, -20]),
      component('move-old-right', 'connector_5way', [0, 0, 20], [180, 0, 0]),
      component('move-new-left', 'connector_5way', [100, 0, -20]),
      component('move-new-right', 'connector_5way', [100, 0, 20], [180, 0, 0]),
      component('move-bridge', 'pipe_35cm', [0, 0, 0]),
    ],
    [
      connection('move-old-start', 'move-old-left', 'output3', 'move-bridge', 'start'),
      connection('move-old-end', 'move-bridge', 'end', 'move-old-right', 'output3'),
    ]
  );
  const beforeHistoryIndex = useDesignStore.getState().historyIndex;

  assert.equal(
    commitSuggestedComponentMove('move-bridge', {
      componentId: 'pipe_35cm',
      position: [100, 0, 0],
      rotation: [0, 0, 0],
      snapType: 'free',
      confidence: 1,
      message: '双端精确吸附',
    }),
    true
  );
  let state = useDesignStore.getState();
  assert.equal(state.historyIndex, beforeHistoryIndex + 1);
  assert.equal(state.connections.length, 2);
  assert.ok(
    state.connections.every(item =>
      [item.source.componentId, item.target.componentId].some(id =>
        id === 'move-new-left' || id === 'move-new-right'
      )
    )
  );
  assertConnectionsAligned(state.components, state.connections);

  state.undo();
  state = useDesignStore.getState();
  assert.deepEqual(
    state.components.find(item => item.instanceId === 'move-bridge')?.position,
    [0, 0, 0]
  );
  assert.deepEqual(
    state.connections.map(item => item.id).sort(),
    ['move-old-end', 'move-old-start']
  );
});

run('connector geometry contains every component-defined port direction', () => {
  [
    'connector_straight',
    'connector_L',
    'connector_T',
    'connector_3way',
    'connector_4way',
    'connector_5way',
  ].forEach(componentId => {
    const definition = getComponentById(componentId);
    assert.ok(definition);
    const geometry = createComponentGeometry(componentId, definition);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    assert.ok(bounds);
    definition.connectionPoints.forEach(point => {
      assert.equal(
        bounds.containsPoint(
          new THREE.Vector3(...point.position)
        ),
        true,
        `${componentId}.${point.id} is outside generated geometry`
      );
    });
  });
});

run('scans real and virtual prediction sites under 100ms for 50 components', () => {
  const components: ComponentInstance[] = [];
  const connections: Connection[] = [];
  for (let index = 0; index < 16; index += 1) {
    const x = index * 100;
    components.push(
      component(`perf-connector-${index}`, 'connector_straight', [x, 0, 0]),
      component(`perf-negative-${index}`, 'pipe_35cm', [x, 0, -20]),
      component(`perf-positive-${index}`, 'pipe_35cm', [x, 0, 20])
    );
    connections.push(
      connection(
        `perf-negative-connection-${index}`,
        `perf-connector-${index}`,
        'input',
        `perf-negative-${index}`,
        'end'
      ),
      connection(
        `perf-positive-connection-${index}`,
        `perf-connector-${index}`,
        'output',
        `perf-positive-${index}`,
        'start'
      )
    );
  }
  components.push(
    component('perf-extra-a', 'pipe_35cm', [2000, 0, 0]),
    component('perf-extra-b', 'pipe_35cm', [2100, 0, 0])
  );

  const start = performance.now();
  const sites = endpointGrowthSystem.listPredictionSites({
    components,
    connections,
    pipeComponentId: 'pipe_35cm',
  });
  const elapsedMs = performance.now() - start;

  assert.equal(components.length, 50);
  assert.ok(sites.some(site => site.kind === 'endpoint'));
  assert.ok(sites.some(site => site.kind === 'virtual-connector-port'));
  assert.ok(elapsedMs < 100, `prediction site scan took ${elapsedMs}ms`);
});

run('classifies growth handles so canvas mousedown does not clear selection', () => {
  assert.deepEqual(
    classifySceneInteractionTarget({ userData: GROWTH_HANDLE_USER_DATA }),
    { type: 'growth-handle' }
  );
  assert.deepEqual(
    classifySceneInteractionTarget({
      userData: {},
      parent: { userData: GROWTH_HANDLE_USER_DATA },
    }),
    { type: 'growth-handle' }
  );
  assert.deepEqual(
    classifySceneInteractionTarget({ userData: { instanceId: 'pipe-1' } }),
    { type: 'component', instanceId: 'pipe-1' }
  );
});

run('keeps beginner demo dimensions and reference rhythm locked', () => {
  const spec = beginnerDemoSystem.getDimensionSpec();

  assert.equal(getComponentById('pipe_35cm')?.length, 35);
  assert.equal(getComponentById('pipe_25cm')?.length, 25);
  assert.equal(getComponentById('pipe_15cm')?.length, 15);
  assert.equal(getComponentById('pipe_15cm')?.diameter, 5);
  assert.equal(REFERENCE_PRODUCT_PROFILE_VERSION, 2);
  assert.equal(SIZE_SPECS.grid, 20);
  assert.equal(SIZE_SPECS.pipe25, 25);
  assert.equal(SIZE_SPECS.pipeOuterDiameter, 5);
  assert.deepEqual(spec, {
    gridCm: 20,
    longPipeCm: 35,
    shortPipeCm: 15,
    longPipeReferenceSpan: 2,
    shortPipeReferenceSpan: 1,
  });
  assert.equal(beginnerDemoSystem.dimensionsAreLocked(), true);
});

run('generates first construction wizard module without changing size invariants', () => {
  const session = constructionWizardSystem.createSession('basic-platform-frame');
  const candidates = constructionWizardSystem.generateCandidates({
    components: [],
    connections: [],
    wizard: session,
  });
  const spec = constructionWizardSystem.getDimensionSpec();

  assert.equal(spec.gridCm, 20);
  assert.equal(spec.longPipeCm, 35);
  assert.equal(spec.shortPipeCm, 15);
  assert.equal(constructionWizardSystem.dimensionsAreLocked(), true);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= 3);
  assert.equal(candidates[0].kind, 'extend-base');
  assert.match(candidates[0].label, /基础架/);
  assert.equal(candidates[0].materialDelta.pipe_35cm, 4);
  assert.equal(candidates[0].materialDelta.connector_5way, 4);
  assertConnectionsAligned(candidates[0].commitComponents, candidates[0].commitConnections);
});

run('commits construction wizard modules as one-click undoable structure actions', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.startConstructionWizard('basic-platform-frame');

  let state = useDesignStore.getState();
  const firstCandidates = constructionWizardSystem.generateCandidates({
    components: state.components,
    connections: state.connections,
    wizard: state.constructionWizard,
  });
  const beforeHistoryIndex = state.historyIndex;
  assert.equal(firstCandidates.length, 1);

  state.commitConstructionWizardCandidate(firstCandidates[0]);
  state = useDesignStore.getState();
  assert.equal(state.historyIndex, beforeHistoryIndex + 1);
  assert.equal(state.components.length, firstCandidates[0].commitComponents.length);
  assert.equal(state.constructionWizard.moduleHistory.length, 1);
  assert.equal(state.constructionWizard.moduleHistory[0].kind, 'extend-base');

  state.undo();
  state = useDesignStore.getState();
  assert.equal(state.components.length, 0);
  assert.equal(state.connections.length, 0);
  assert.equal(state.constructionWizard.active, true);
  assert.equal(state.constructionWizard.moduleHistory.length, 0);

  state.redo();
  state = useDesignStore.getState();
  assert.equal(state.components.length, firstCandidates[0].commitComponents.length);
  assert.equal(state.constructionWizard.moduleHistory.length, 1);
});

run('completes basic platform frame through deterministic wizard modules', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.startConstructionWizard('basic-platform-frame');

  const committedKinds: string[] = [];
  for (let index = 0; index < 5; index++) {
    const state = useDesignStore.getState();
    const candidates = constructionWizardSystem.generateCandidates({
      components: state.components,
      connections: state.connections,
      wizard: state.constructionWizard,
    });

    assert.ok(candidates.length >= 1, `missing candidate at step ${index + 1}`);
    assert.ok(candidates.length <= 3, `too many candidates at step ${index + 1}`);
    committedKinds.push(candidates[0].kind);
    state.commitConstructionWizardCandidate(candidates[0]);
  }

  const state = useDesignStore.getState();
  const progress = constructionWizardSystem.evaluateProgress({
    components: state.components,
    connections: state.connections,
    wizard: state.constructionWizard,
  });
  const materials = exportManager.generateMaterialList(state.components, state.connections, {
    pipe_35cm: { quantity: 4 },
  });
  const assemblySteps = assemblyStepSystem.generateSteps(state.components, state.connections);
  const assemblySignature = assemblySteps.map(step => `${step.kind}:${step.componentIds.join(',')}`);

  assert.deepEqual(committedKinds, [
    'extend-base',
    'add-supports',
    'add-top-frame',
    'add-board',
    'add-short-entry',
  ]);
  assert.equal(progress.isComplete, true);
  assert.equal(state.constructionWizard.moduleHistory.length, 5);
  assert.equal(state.components.filter(item => item.componentId === 'pipe_35cm').length, 12);
  assert.equal(state.components.filter(item => item.componentId === 'pipe_15cm').length, 1);
  const platformBoard = state.components.find(item => item.componentId === 'board_40x40');
  assert.ok(platformBoard);
  assert.equal(
    state.connections.filter(item =>
      item.source.componentId === platformBoard.instanceId ||
      item.target.componentId === platformBoard.instanceId
    ).length,
    4
  );
  assert.ok(materials.some(item => item.componentId === 'pipe_35cm' && item.shortage > 0));
  assert.ok(materials.some(item => item.componentId === 'pipe_15cm'));
  assert.ok(materials.some(item => item.componentId === 'connector_5way'));
  assert.ok(materials.some(item => item.componentId === 'board_40x40'));
  assert.ok(assemblySteps.findIndex(step => step.kind === 'base') >= 0);
  assert.ok(assemblySteps.findIndex(step => step.kind === 'platform') > assemblySteps.findIndex(step => step.kind === 'base'));
  assert.deepEqual(
    assemblySignature,
    assemblyStepSystem.generateSteps(state.components, state.connections).map(step => `${step.kind}:${step.componentIds.join(',')}`)
  );
  assertConnectionsAligned(state.components, state.connections);
  assertNoDuplicateConnectorCenters(state.components);
});

run('does not count arbitrary geometry as construction wizard completion', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `wizard_out_of_scope_${key}`);
  const session = constructionWizardSystem.createSession('basic-platform-frame');
  const progress = constructionWizardSystem.evaluateProgress({
    components: demo.components,
    connections: demo.connections,
    wizard: session,
  });

  assert.equal(progress.isComplete, false);
  assert.equal(progress.checks.find(check => check.id === 'extend-base')?.complete, false);
});

run('keeps completed demo structural progress separate from endpoint-growth practice', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `demo_${key}`);
  const progressWithoutPractice = beginnerDemoSystem.evaluateDemoProgress(
    { components: demo.components, connections: demo.connections },
    { endpointGrowthPracticed: false }
  );
  const progressWithPractice = beginnerDemoSystem.evaluateDemoProgress(
    { components: demo.components, connections: demo.connections },
    {
      endpointGrowthPracticed: true,
      practiceComponentIds: demo.components.slice(0, 2).map(item => item.instanceId),
      practiceConnectionIds: demo.connections.slice(0, 2).map(item => item.id),
    }
  );
  const usedEndpoints = new Set<string>();

  demo.connections.forEach((item) => {
    [item.source, item.target].forEach((endpoint) => {
      const key = `${endpoint.componentId}:${endpoint.pointId}`;
      assert.equal(usedEndpoints.has(key), false, `duplicate endpoint ${key}`);
      usedEndpoints.add(key);
    });
  });

  assert.equal(progressWithoutPractice.structuralComplete, true);
  assert.equal(progressWithoutPractice.isComplete, false);
  assert.equal(
    progressWithoutPractice.checks.find(check => check.id === 'endpoint-growth-practice')?.complete,
    false
  );
  assert.equal(progressWithPractice.isComplete, true);
  assert.ok(demo.components.some(item => item.componentId === 'board_40x40'));
  assert.ok(demo.components.some(item => item.componentId === 'pipe_35cm'));
  assert.ok(demo.components.some(item => item.componentId === 'pipe_15cm'));
  assert.ok(demo.components.filter(item => item.componentId === 'connector_5way').length >= 8);
});

run('requires endpoint-growth placement ids before demo practice can complete', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `boolean_only_${key}`);
  const booleanOnlyProgress = beginnerDemoSystem.evaluateDemoProgress(
    { components: demo.components, connections: demo.connections },
    { endpointGrowthPracticed: true }
  );

  assert.equal(booleanOnlyProgress.structuralComplete, true);
  assert.equal(booleanOnlyProgress.checks.find(check => check.id === 'endpoint-growth-practice')?.complete, false);
  assert.equal(booleanOnlyProgress.isComplete, false);
  assert.equal(
    beginnerDemoSystem.evaluateDemoProgress(
      { components: demo.components, connections: demo.connections },
      {
        endpointGrowthPracticed: true,
        practiceComponentIds: [demo.components[0].instanceId],
        practiceConnectionIds: [demo.connections[0].id],
      }
    ).checks.find(check => check.id === 'endpoint-growth-practice')?.complete,
    false
  );

  const store = useDesignStore.getState();
  store.reset();
  store.loadBeginnerDemoStarter();
  // Compile-time callers must pass placement provenance; this runtime guard protects JS callers too.
  (store.recordBeginnerDemoEndpointGrowthPractice as unknown as () => void)();
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, false);
});

run('aligns completed beginner demo connection endpoints in world space', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `aligned_${key}`);
  assertConnectionsAligned(demo.components, demo.connections);
  assertNoDuplicateConnectorCenters(demo.components);
});

run('records beginner demo practice only through endpoint-growth provenance', () => {
  const store = useDesignStore.getState();
  store.reset();
  const starter = store.loadBeginnerDemoStarter();
  const beforeProgress = evaluateScopedBeginnerDemoFromStore();
  const candidate = endpointGrowthSystem.generateCandidates({
    endpoint: starter.starterEndpoint!,
    pipeComponentId: 'pipe_35cm',
    components: useDesignStore.getState().components,
    connections: useDesignStore.getState().connections,
  })[0];
  let idCounter = 0;
  const placement = endpointGrowthSystem.createPlacement(candidate, {
    idFactory: (prefix) => `practice_${prefix}_${++idCounter}`,
  });

  assert.equal(beforeProgress.checks.find(check => check.id === 'endpoint-growth-practice')?.complete, false);
  assert.equal(placement.components.length, 2);
  assert.equal(placement.connections.length, 2);

  store.commitComponentsPlacement(placement.components, placement.connections);
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, false);

  store.recordBeginnerDemoEndpointGrowthPractice({
    components: placement.components,
    connections: placement.connections,
  });
  const demoState = useDesignStore.getState().beginnerDemo;
  const afterProgress = evaluateScopedBeginnerDemoFromStore();

  assert.deepEqual(demoState.practiceComponentIds, placement.components.map(item => item.instanceId));
  assert.deepEqual(demoState.practiceConnectionIds, placement.connections.map(item => item.id));
  assert.equal(afterProgress.checks.find(check => check.id === 'endpoint-growth-practice')?.complete, true);
  assert.ok(afterProgress.completedChecks > beforeProgress.completedChecks);

  store.loadBeginnerDemoTarget();
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, false);
});

run('restores beginner demo practice provenance with undo and redo snapshots', () => {
  const store = useDesignStore.getState();
  store.reset();
  const starter = store.loadBeginnerDemoStarter();
  const candidate = endpointGrowthSystem.generateCandidates({
    endpoint: starter.starterEndpoint!,
    pipeComponentId: 'pipe_35cm',
    components: useDesignStore.getState().components,
    connections: useDesignStore.getState().connections,
  })[0];
  const placement = endpointGrowthSystem.createPlacement(candidate, {
    idFactory: (prefix) => `snapshot_${prefix}`,
  });

  store.commitComponentsPlacement(placement.components, placement.connections, {
    beginnerDemoPractice: true,
  });
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, true);
  assert.equal(
    evaluateScopedBeginnerDemoFromStore().checks.find(check => check.id === 'endpoint-growth-practice')?.complete,
    true
  );

  useDesignStore.getState().undo();
  assert.equal(useDesignStore.getState().components.length, 1);
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, false);
  assert.deepEqual(useDesignStore.getState().beginnerDemo.practiceComponentIds, []);

  useDesignStore.getState().redo();
  assert.equal(useDesignStore.getState().beginnerDemo.endpointGrowthPracticed, true);
  assert.deepEqual(
    useDesignStore.getState().beginnerDemo.practiceComponentIds,
    placement.components.map(item => item.instanceId)
  );
});

run('scopes beginner demo progress to demo-owned components while active', () => {
  const store = useDesignStore.getState();
  store.reset();
  store.loadBeginnerDemoStarter();
  const targetLikeDesign = beginnerDemoSystem.createTargetDesign((key) => `outside_scope_${key}`);

  store.commitComponentsPlacement(targetLikeDesign.components, targetLikeDesign.connections);
  const wholeSceneProgress = beginnerDemoSystem.evaluateDemoProgress(
    {
      components: useDesignStore.getState().components,
      connections: useDesignStore.getState().connections,
    },
    { endpointGrowthPracticed: true }
  );
  const scopedProgress = evaluateScopedBeginnerDemoFromStore();

  assert.equal(wholeSceneProgress.structuralComplete, true);
  assert.equal(scopedProgress.structuralComplete, false);
  assert.equal(scopedProgress.checks.find(check => check.id === 'base-frame')?.complete, false);
});

run('exports stable BOM and assembly steps for beginner platform-frame demo', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `export_${key}`);
  const materials = exportManager.generateMaterialList(demo.components, demo.connections, {
    pipe_35cm: { quantity: 2 },
  });
  const firstSteps = assemblyStepSystem.generateSteps(demo.components, demo.connections);
  const secondSteps = assemblyStepSystem.generateSteps(demo.components, demo.connections);
  const firstStepSignature = firstSteps.map(step => `${step.kind}:${step.componentIds.join(',')}:${step.connectionRefs.join('|')}`);
  const secondStepSignature = secondSteps.map(step => `${step.kind}:${step.componentIds.join(',')}:${step.connectionRefs.join('|')}`);

  assert.ok(materials.some(item => item.componentId === 'pipe_35cm' && item.shortage > 0));
  assert.ok(materials.some(item => item.componentId === 'pipe_15cm'));
  assert.ok(materials.some(item => item.componentId === 'connector_5way'));
  assert.ok(materials.some(item => item.componentId === 'board_40x40'));
  assert.ok(firstSteps.findIndex(step => step.kind === 'base') >= 0);
  assert.ok(firstSteps.findIndex(step => step.kind === 'platform') > firstSteps.findIndex(step => step.kind === 'base'));
  assert.ok(firstSteps.some(step => step.connectionRefs.some(ref => ref.includes('platform_board'))));
  assert.deepEqual(firstStepSignature, secondStepSignature);
});

run('evaluates beginner demo progress quickly for a 50-component scene', () => {
  const components = Array.from({ length: 50 }, (_, index) =>
    component(`demo-pipe-${index}`, index === 1 ? 'pipe_15cm' : 'pipe_35cm', [index * 20, index % 5 === 0 ? 40 : 0, 0])
  );
  const start = Date.now();
  const progress = beginnerDemoSystem.evaluateDemoProgress(
    { components, connections: [] },
    { endpointGrowthPracticed: false }
  );
  const elapsedMs = Date.now() - start;

  assert.equal(progress.totalChecks, 8);
  assert.ok(elapsedMs < 100, `beginner demo progress took ${elapsedMs}ms`);
});

run('generates construction wizard candidates quickly for a 50-component scene', () => {
  const session = constructionWizardSystem.createSession('basic-platform-frame');
  const components = Array.from({ length: 50 }, (_, index) =>
    component(`wizard-existing-${index}`, index % 3 === 0 ? 'connector_5way' : 'pipe_35cm', [index * 20, 0, 0])
  );
  const start = Date.now();
  const candidates = constructionWizardSystem.generateCandidates({
    components,
    connections: [],
    wizard: session,
  });
  const elapsedMs = Date.now() - start;

  assert.ok(candidates.length > 0);
  assert.ok(elapsedMs < 100, `wizard candidate generation took ${elapsedMs}ms`);
});

run('calculates inventory shortage as warning-only data', () => {
  const components = [
    component('pipe-1', 'pipe_35cm', [0, 0, 0]),
    component('pipe-2', 'pipe_35cm', [20, 0, 0]),
    component('pipe-3', 'pipe_35cm', [40, 0, 0]),
    component('conn-1', 'connector_L', [0, 0, 20]),
  ];
  const originalLength = components.length;
  const requirement = calculateMaterialRequirement(components, { pipe_35cm: 1 });
  const materials = exportManager.generateMaterialList(components, [], {
    pipe_35cm: { quantity: 1 },
  });
  const pipe = materials.find(item => item.componentId === 'pipe_35cm');

  assert.equal(requirement.pipe_35cm.required, 3);
  assert.equal(requirement.pipe_35cm.available, 1);
  assert.equal(requirement.pipe_35cm.shortage, 2);
  assert.equal(pipe?.shortage, 2);
  assert.match(exportManager.exportToMarkdown(materials, '测试设计'), /库存不足|缺 2|shortage|缺少/);
  assert.equal(components.length, originalLength);
});

run('generates stable bottom-up assembly steps', () => {
  const base = component('base', 'pipe_35cm', [0, 0, 0]);
  const vertical = component('vertical', 'pipe_35cm', [0, 35, 0], [90, 0, 0]);
  const upper = component('upper', 'connector_L', [0, 70, 0]);
  const board = component('board', 'board_40x40', [0, 72, 0]);
  const slide = component('slide', 'slide', [40, 72, 0]);
  const connections = [
    connection('c1', 'base', 'end', 'vertical', 'start'),
    connection('c2', 'vertical', 'end', 'upper', 'input'),
  ];

  const steps = assemblyStepSystem.generateSteps(
    [slide, board, upper, vertical, base],
    connections
  );

  assert.deepEqual(steps.map(step => step.kind), [
    'base',
    'vertical',
    'upper',
    'platform',
    'accessory',
  ]);
  assert.ok(steps[0].parts.some(part => part.componentId === 'pipe_35cm'));
  assert.ok(steps[1].connectionRefs.length > 0);

  const reshuffled = assemblyStepSystem.generateSteps(
    [base, vertical, upper, board, slide],
    connections
  );
  assert.deepEqual(
    steps.map(step => `${step.kind}:${step.componentIds.join(',')}`),
    reshuffled.map(step => `${step.kind}:${step.componentIds.join(',')}`)
  );
});

run('generates a complete topology-driven assembly guide for the platform demo', () => {
  const demo = beginnerDemoSystem.createTargetDesign((key) => `guide_${key}`);
  const result = assemblyStepSystem.generateAssemblyGuide({
    components: demo.components,
    connections: demo.connections,
    designName: '平台教程测试',
  });

  assert.notEqual(result.status, 'blocked');
  assert.ok(result.guide);
  const guide = result.guide!;
  const installedComponentIds = guide.steps.flatMap(step => step.newComponentIds);
  assert.equal(new Set(installedComponentIds).size, demo.components.length);
  assert.deepEqual(
    [...installedComponentIds].sort(),
    demo.components.map(item => item.instanceId).sort()
  );
  assert.equal(guide.steps.at(-1)?.phase, 'inspection');
  assert.ok(
    guide.steps.findIndex(step => step.phase === 'platform') >
      guide.steps.findIndex(step => step.phase === 'base')
  );
  assert.equal(
    validateAssemblyGuide(guide, demo.components, demo.connections).valid,
    true
  );

  const shuffled = assemblyStepSystem.generateAssemblyGuide({
    components: [...demo.components].reverse(),
    connections: [...demo.connections].reverse(),
    designName: '平台教程测试',
  }).guide;
  assert.ok(shuffled);
  assert.deepEqual(
    guide.steps.map(step => `${step.phase}:${step.newComponentIds.join(',')}`),
    shuffled!.steps.map(step => `${step.phase}:${step.newComponentIds.join(',')}`)
  );
});

run('keeps an atomic A-frame together in one assembly guide step', () => {
  let nextId = 0;
  const aFrame = advancedStructureSystem.createRightTriangle({
    size: 40,
    plane: 'vertical-x',
    idFactory: prefix => `${prefix}_guide_${nextId++}`,
  });
  const result = assemblyStepSystem.generateAssemblyGuide({
    components: aFrame.components,
    connections: aFrame.connections,
    designName: 'A字架教程测试',
  });
  assert.notEqual(result.status, 'blocked');
  assert.ok(result.guide);
  const aFrameStep = result.guide.steps.find(step =>
    aFrame.components.every(component => step.newComponentIds.includes(component.instanceId))
  );
  assert.ok(aFrameStep);
  assert.equal(aFrameStep.newComponentIds.length, 9);
});

run('blocks assembly guides for missing connections and floating subassemblies', () => {
  const alignedWithoutRecord = [
    component('guide-left', 'pipe_35cm', [0, 0, 0]),
    component('guide-right', 'pipe_35cm', [0, 0, 35]),
  ];
  const missingConnection = assemblyStepSystem.generateAssemblyGuide({
    components: alignedWithoutRecord,
    connections: [],
  });
  assert.equal(missingConnection.status, 'blocked');
  assert.ok(missingConnection.issues.some(issue => issue.kind === 'invalid-topology'));

  const floating = assemblyStepSystem.generateAssemblyGuide({
    components: [
      component('guide-ground', 'pipe_35cm', [0, 0, 0]),
      component('guide-floating', 'pipe_35cm', [80, 40, 0]),
    ],
    connections: [],
  });
  assert.equal(floating.status, 'blocked');
  assert.ok(floating.issues.some(issue => issue.kind === 'floating-subassembly'));
});

run('keeps legal free endpoints as assembly guide warnings', () => {
  const pipe = component('guide-free', 'pipe_35cm', [0, 0, 0]);
  const result = assemblyStepSystem.generateAssemblyGuide({
    components: [pipe],
    connections: [],
  });
  assert.equal(result.status, 'warning');
  assert.ok(result.guide?.warnings.some(warning => warning.includes('自由端点')));
});
