import * as THREE from 'three';
import type {
  ComponentDefinition,
  ComponentInstance,
  Connection,
  ConnectionPoint,
} from '../types';
import {
  getComponentById,
  getComponentsByCategory,
  isStructuralConnectionPoint,
} from '../stores/componentLibrary';
import { getWorldDirection, getWorldPosition } from './ConstructionEngine';
import {
  connectorTopologySystem,
  connectorDirectionKey,
  markConnectorAutoManaged,
  type ConnectorTopologyResolution,
  type TopologyPatch,
} from './ConnectorTopologySystem';

export type GrowthPipeComponentId = 'pipe_15cm' | 'pipe_25cm' | 'pipe_35cm';
export type BuildCandidateFamily = 'straight' | 'diagonal' | 'structure';

export interface GrowthEndpointRef {
  componentId: string;
  pointId: string;
  position: [number, number, number];
  direction: [number, number, number];
  componentName: string;
}

export interface EndpointPredictionSite extends GrowthEndpointRef {
  kind: 'endpoint';
}

export interface VirtualConnectorPortPredictionSite {
  kind: 'virtual-connector-port';
  connectorInstanceId: string;
  position: [number, number, number];
  direction: [number, number, number];
  directionKey: string;
  replacement: ConnectorTopologyResolution;
  replacementPointId: string;
  currentConnectorName: string;
}

export type PredictionSiteRef =
  | EndpointPredictionSite
  | VirtualConnectorPortPredictionSite;

export type GrowthSiteSelection =
  | {
      kind?: 'endpoint';
      componentId: string;
      pointId: string;
    }
  | {
      kind: 'virtual-connector-port';
      connectorInstanceId: string;
      directionKey: string;
    };

export interface GrowthPreviewBounds {
  center: [number, number, number];
  size: [number, number, number];
}

export interface GrowthConnectorPart {
  componentId: string;
  attachPointId: string;
  outputPointId: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

interface GrowthCandidateBase {
  id: string;
  label: string;
  rank: number;
  pipeComponentId: GrowthPipeComponentId;
  referenceSpan: 1 | 1.5 | 2;
  sourceSite: PredictionSiteRef;
  sourceEndpoint: GrowthEndpointRef;
  pipePosition: [number, number, number];
  pipeRotation: [number, number, number];
  pipeAttachPointId: string;
  pipeFreePointId: string;
  direction: [number, number, number];
  handlePosition: [number, number, number];
  previewEndPosition: [number, number, number];
  previewBounds: GrowthPreviewBounds;
  message: string;
}

export interface DirectPipeGrowthCandidate extends GrowthCandidateBase {
  kind: 'direct-pipe';
  connector: null;
}

export interface ConnectorPipeGrowthCandidate extends GrowthCandidateBase {
  kind: 'connector-pipe';
  connector: GrowthConnectorPart;
}

export interface UpgradeConnectorPipeGrowthCandidate
  extends GrowthCandidateBase {
  kind: 'upgrade-connector-pipe';
  connector: null;
  upgrade: {
    connectorInstanceId: string;
    currentConnectorComponentId: string;
    currentConnectorName: string;
    replacementConnectorComponentId: string;
    replacementConnectorName: string;
    replacementPosition: [number, number, number];
    replacementRotation: [number, number, number];
    replacementPointId: string;
    pointMapping: Record<string, string>;
  };
}

export interface BridgeExistingSiteGrowthCandidate extends GrowthCandidateBase {
  kind: 'bridge-existing-site';
  connector: GrowthConnectorPart | null;
  targetConnector: GrowthConnectorPart | null;
  targetEndpoint: GrowthEndpointRef;
  sourceKind: DirectPipeGrowthCandidate['kind'] | ConnectorPipeGrowthCandidate['kind'];
}

export type GrowthCandidate =
  | DirectPipeGrowthCandidate
  | ConnectorPipeGrowthCandidate
  | UpgradeConnectorPipeGrowthCandidate
  | BridgeExistingSiteGrowthCandidate;

export interface GrowthPlacement {
  components: ComponentInstance[];
  connections: Connection[];
  selectInstanceId: string;
  nextEndpoint: { componentId: string; pointId: string };
}

export interface GrowthInput {
  site?: PredictionSiteRef;
  endpoint?: { componentId: string; pointId: string };
  pipeComponentId: GrowthPipeComponentId;
  components: ComponentInstance[];
  connections: Connection[];
  connectorComponentId?: string;
  family?: Exclude<BuildCandidateFamily, 'structure'>;
}

export interface PredictionEndpointInput {
  pipeComponentId: GrowthPipeComponentId;
  components: ComponentInstance[];
  connections: Connection[];
  connectorComponentId?: string;
  family?: Exclude<BuildCandidateFamily, 'structure'>;
}

export interface DefaultGrowthEndpointInput {
  componentId: string;
  components: ComponentInstance[];
  connections: Connection[];
  preferredPointId?: string | null;
}

export interface GrowthPlacementOptions {
  idFactory?: (prefix: string) => string;
}

export interface GrowthTopologyPatchOptions extends GrowthPlacementOptions {
  components: ComponentInstance[];
  connections: Connection[];
}

interface GrowthSceneIndex {
  componentsById: Map<string, ComponentInstance>;
  componentsByDefinitionId: Map<string, ComponentInstance[]>;
  occupiedEndpointKeys: Set<string>;
}

interface PredictionEndpointCache {
  components: ComponentInstance[];
  connections: Connection[];
  pipeComponentId: GrowthPipeComponentId;
  connectorComponentId?: string;
  family: Exclude<BuildCandidateFamily, 'structure'>;
  endpoints: GrowthEndpointRef[];
}

interface PredictionSiteCache {
  components: ComponentInstance[];
  connections: Connection[];
  pipeComponentId: GrowthPipeComponentId;
  connectorComponentId?: string;
  family: Exclude<BuildCandidateFamily, 'structure'>;
  sites: PredictionSiteRef[];
}

const PIPE_ATTACH_POINT_ID = 'start';
const PIPE_FREE_POINT_ID = 'end';
const DIRECTION_TOLERANCE = 1e-3;
const DUPLICATE_TOLERANCE = 1e-3;
const PREVIEW_BOUNDS_PADDING = 3;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const roundedTuple = (vector: THREE.Vector3): [number, number, number] => [
  Number(vector.x.toFixed(4)),
  Number(vector.y.toFixed(4)),
  Number(vector.z.toFixed(4)),
];

const quaternionToRotation = (
  quaternion: THREE.Quaternion
): [number, number, number] => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    Number(toDegrees(euler.x).toFixed(4)),
    Number(toDegrees(euler.y).toFixed(4)),
    Number(toDegrees(euler.z).toFixed(4)),
  ];
};

const rotationToOppositeDirection = (
  localDirection: [number, number, number],
  targetWorldDirection: [number, number, number]
): [number, number, number] => {
  const source = new THREE.Vector3(...localDirection).normalize();
  const target = new THREE.Vector3(...targetWorldDirection)
    .normalize()
    .multiplyScalar(-1);

  if (source.lengthSq() === 0 || target.lengthSq() === 0) return [0, 0, 0];

  return quaternionToRotation(
    new THREE.Quaternion().setFromUnitVectors(source, target)
  );
};

const rotationForPointDirections = (
  localAttachDirection: [number, number, number],
  localOutputDirection: [number, number, number],
  sourceWorldDirection: [number, number, number],
  desiredOutputDirection: [number, number, number]
): [number, number, number] | null => {
  const localAttach = new THREE.Vector3(...localAttachDirection).normalize();
  const localOutput = new THREE.Vector3(...localOutputDirection).normalize();
  const targetAttach = new THREE.Vector3(...sourceWorldDirection)
    .normalize()
    .multiplyScalar(-1);
  const targetOutput = new THREE.Vector3(...desiredOutputDirection).normalize();

  if (
    localAttach.lengthSq() === 0 ||
    localOutput.lengthSq() === 0 ||
    targetAttach.lengthSq() === 0 ||
    targetOutput.lengthSq() === 0
  ) {
    return null;
  }

  if (
    Math.abs(localAttach.dot(localOutput) - targetAttach.dot(targetOutput)) >
    DIRECTION_TOLERANCE
  ) {
    return null;
  }

  const alignAttach = new THREE.Quaternion().setFromUnitVectors(
    localAttach,
    targetAttach
  );
  const alignedOutput = localOutput.clone().applyQuaternion(alignAttach).normalize();

  if (alignedOutput.dot(targetOutput) >= 1 - DIRECTION_TOLERANCE) {
    return quaternionToRotation(alignAttach);
  }

  const alignedProjection = alignedOutput
    .clone()
    .addScaledVector(targetAttach, -alignedOutput.dot(targetAttach));
  const targetProjection = targetOutput
    .clone()
    .addScaledVector(targetAttach, -targetOutput.dot(targetAttach));
  if (
    alignedProjection.lengthSq() <= DIRECTION_TOLERANCE ||
    targetProjection.lengthSq() <= DIRECTION_TOLERANCE
  ) {
    return null;
  }

  alignedProjection.normalize();
  targetProjection.normalize();
  const signedAngle = Math.atan2(
    targetAttach.dot(
      new THREE.Vector3().crossVectors(alignedProjection, targetProjection)
    ),
    THREE.MathUtils.clamp(alignedProjection.dot(targetProjection), -1, 1)
  );
  const roll = new THREE.Quaternion().setFromAxisAngle(targetAttach, signedAngle);
  const rotation = new THREE.Quaternion().multiplyQuaternions(roll, alignAttach);
  const transformedOutput = localOutput.clone().applyQuaternion(rotation).normalize();

  if (transformedOutput.dot(targetOutput) < 1 - DIRECTION_TOLERANCE) {
    return null;
  }

  return quaternionToRotation(rotation);
};

const componentPositionForPoint = (
  pointWorldPosition: [number, number, number],
  componentRotation: [number, number, number],
  localPointPosition: [number, number, number]
): [number, number, number] => {
  const euler = new THREE.Euler(
    toRadians(componentRotation[0]),
    toRadians(componentRotation[1]),
    toRadians(componentRotation[2]),
    'XYZ'
  );
  const rotatedLocal = new THREE.Vector3(...localPointPosition).applyEuler(euler);
  return [
    pointWorldPosition[0] - rotatedLocal.x,
    pointWorldPosition[1] - rotatedLocal.y,
    pointWorldPosition[2] - rotatedLocal.z,
  ];
};

const endpointKey = (componentId: string, pointId: string) =>
  `${componentId}:${pointId}`;

const createGrowthSceneIndex = (
  components: ComponentInstance[],
  connections: Connection[]
): GrowthSceneIndex => {
  const componentsById = new Map<string, ComponentInstance>();
  const componentsByDefinitionId = new Map<string, ComponentInstance[]>();
  const occupiedEndpointKeys = new Set<string>();

  components.forEach(component => {
    componentsById.set(component.instanceId, component);
    const matchingComponents =
      componentsByDefinitionId.get(component.componentId) ?? [];
    matchingComponents.push(component);
    componentsByDefinitionId.set(component.componentId, matchingComponents);
  });

  connections.forEach(connection => {
    occupiedEndpointKeys.add(
      endpointKey(connection.source.componentId, connection.source.pointId)
    );
    occupiedEndpointKeys.add(
      endpointKey(connection.target.componentId, connection.target.pointId)
    );
  });

  return {
    componentsById,
    componentsByDefinitionId,
    occupiedEndpointKeys,
  };
};

const findConnectionPoint = (points: ConnectionPoint[], pointId: string) =>
  points.find(point => point.id === pointId);

const areCompatible = (source: ConnectionPoint, target: ConnectionPoint) =>
  source.compatible.includes(target.type) ||
  target.compatible.includes(source.type);

const distanceBetween = (
  left: [number, number, number],
  right: [number, number, number]
) =>
  Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2]
  );

const directionDot = (
  left: [number, number, number],
  right: [number, number, number]
) =>
  new THREE.Vector3(...left)
    .normalize()
    .dot(new THREE.Vector3(...right).normalize());

const pipeReferenceSpan = (
  pipeComponentId: GrowthPipeComponentId
): 1 | 1.5 | 2 => {
  if (pipeComponentId === 'pipe_35cm') return 2;
  if (pipeComponentId === 'pipe_25cm') return 1.5;
  return 1;
};

const labelForDirection = (direction: [number, number, number]) => {
  const [x, y, z] = direction;
  const axis = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (axis === Math.abs(y)) return y >= 0 ? '上' : '下';
  if (axis === Math.abs(x)) return x >= 0 ? '右' : '左';
  return z >= 0 ? '前' : '后';
};

const defaultIdFactory = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const createTargetDirections = (
  sourceDirection: [number, number, number],
  family: Exclude<BuildCandidateFamily, 'structure'> = 'straight'
): [number, number, number][] => {
  const forward = new THREE.Vector3(...sourceDirection).normalize();
  if (forward.lengthSq() === 0) return [];

  const reference =
    Math.abs(forward.dot(new THREE.Vector3(0, 1, 0))) < 0.95
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const firstTurn = reference
    .addScaledVector(forward, -reference.dot(forward))
    .normalize();
  const secondTurn = new THREE.Vector3()
    .crossVectors(forward, firstTurn)
    .normalize();

  if (family === 'diagonal') {
    return [firstTurn, secondTurn, firstTurn.clone().multiplyScalar(-1), secondTurn.clone().multiplyScalar(-1)]
      .map(turn => roundedTuple(
        forward.clone().multiplyScalar(Math.SQRT1_2)
          .add(turn.multiplyScalar(Math.SQRT1_2))
          .normalize()
      ));
  }

  return [
    roundedTuple(forward),
    roundedTuple(firstTurn),
    roundedTuple(secondTurn),
    roundedTuple(firstTurn.clone().multiplyScalar(-1)),
    roundedTuple(secondTurn.clone().multiplyScalar(-1)),
  ];
};

const normalizedAngle = (degrees: number) => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const sameTransform = (
  component: ComponentInstance,
  componentId: string,
  position: [number, number, number],
  rotation: [number, number, number]
) =>
  component.componentId === componentId &&
  component.position.every(
    (value, index) => Math.abs(value - position[index]) <= DUPLICATE_TOLERANCE
  ) &&
  component.rotation.every((value, index) => {
    const difference = Math.abs(
      normalizedAngle(value) - normalizedAngle(rotation[index])
    );
    return (
      difference <= DUPLICATE_TOLERANCE ||
      Math.abs(difference - 360) <= DUPLICATE_TOLERANCE
    );
  });

const hasIndexedDuplicatePart = (
  sceneIndex: GrowthSceneIndex,
  componentId: string,
  position: [number, number, number],
  rotation: [number, number, number]
) =>
  (sceneIndex.componentsByDefinitionId.get(componentId) ?? []).some(component =>
    sameTransform(component, componentId, position, rotation)
  );

const resolveConnectorDefinitions = (connectorComponentId?: string) =>
  connectorComponentId
    ? [getComponentById(connectorComponentId)].filter(
        (definition): definition is ComponentDefinition => Boolean(definition)
      )
    : getComponentsByCategory('connector');

const resolveGrowthConnectorDefinitions = (
  connectorComponentId: string | undefined,
  family: Exclude<BuildCandidateFamily, 'structure'>
) => {
  const definitions = resolveConnectorDefinitions(connectorComponentId);
  const automaticDefinitions = definitions.filter(
    definition =>
      (definition.properties as { autoTopology?: boolean } | undefined)
        ?.autoTopology !== false
  );
  return family === 'diagonal'
    ? automaticDefinitions.filter(definition => definition.id === 'connector_45deg')
    : automaticDefinitions.filter(definition => definition.id !== 'connector_45deg');
};

const collectTransformedConnectionPoints = (
  componentId: string,
  position: [number, number, number],
  rotation: [number, number, number]
) => {
  const definition = getComponentById(componentId);
  if (!definition) return [new THREE.Vector3(...position)];

  return [
    new THREE.Vector3(...position),
    ...definition.connectionPoints.filter(isStructuralConnectionPoint).map(
      point =>
        new THREE.Vector3(
          ...getWorldPosition(position, rotation, point.position)
        )
    ),
  ];
};

const createPreviewBounds = (
  parts: Array<{
    componentId: string;
    position: [number, number, number];
    rotation: [number, number, number];
  }>
): GrowthPreviewBounds => {
  const points = parts.flatMap(part =>
    collectTransformedConnectionPoints(
      part.componentId,
      part.position,
      part.rotation
    )
  );
  const box = new THREE.Box3().setFromPoints(points).expandByScalar(
    PREVIEW_BOUNDS_PADDING
  );
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  size.set(
    Math.max(size.x, PREVIEW_BOUNDS_PADDING * 2),
    Math.max(size.y, PREVIEW_BOUNDS_PADDING * 2),
    Math.max(size.z, PREVIEW_BOUNDS_PADDING * 2)
  );

  return {
    center: roundedTuple(center),
    size: roundedTuple(size),
  };
};

const buildSourceEndpoint = (
  component: ComponentInstance,
  definition: ComponentDefinition,
  point: ConnectionPoint
): GrowthEndpointRef => ({
  componentId: component.instanceId,
  pointId: point.id,
  position: getWorldPosition(component.position, component.rotation, point.position),
  direction: getWorldDirection(component.rotation, point.direction),
  componentName: definition.name,
});

const endpointPredictionSite = (
  endpoint: GrowthEndpointRef
): EndpointPredictionSite => ({
  kind: 'endpoint',
  ...endpoint,
});

export const predictionSiteKey = (
  site: PredictionSiteRef | GrowthSiteSelection
) =>
  site.kind === 'virtual-connector-port'
    ? `virtual:${site.connectorInstanceId}:${site.directionKey}`
    : `endpoint:${site.componentId}:${site.pointId}`;

export const growthSelectionFromSite = (
  site: PredictionSiteRef
): GrowthSiteSelection =>
  site.kind === 'virtual-connector-port'
    ? {
        kind: 'virtual-connector-port',
        connectorInstanceId: site.connectorInstanceId,
        directionKey: site.directionKey,
      }
    : {
        kind: 'endpoint',
        componentId: site.componentId,
        pointId: site.pointId,
      };

export const predictionSiteMatchesSelection = (
  site: PredictionSiteRef,
  selection: GrowthSiteSelection
) => predictionSiteKey(site) === predictionSiteKey(selection);

class EndpointGrowthSystem {
  private predictionEndpointCache: PredictionEndpointCache | null = null;
  private predictionSiteCache: PredictionSiteCache | null = null;

  listAvailableEndpoints(
    components: ComponentInstance[],
    connections: Connection[],
    componentIds?: string[]
  ): GrowthEndpointRef[] {
    const componentIdSet = componentIds ? new Set(componentIds) : null;
    const occupiedEndpointKeys = createGrowthSceneIndex(
      components,
      connections
    ).occupiedEndpointKeys;
    const endpoints: GrowthEndpointRef[] = [];

    for (const component of components) {
      if (componentIdSet && !componentIdSet.has(component.instanceId)) continue;

      const definition = getComponentById(component.componentId);
      if (!definition) continue;

      for (const point of definition.connectionPoints.filter(isStructuralConnectionPoint)) {
        if (
          occupiedEndpointKeys.has(endpointKey(component.instanceId, point.id))
        ) {
          continue;
        }
        endpoints.push(buildSourceEndpoint(component, definition, point));
      }
    }

    return endpoints;
  }

  listPredictionEndpoints(
    input: PredictionEndpointInput
  ): GrowthEndpointRef[] {
    const family = input.family ?? 'straight';
    const cached = this.predictionEndpointCache;
    if (
      cached &&
      cached.components === input.components &&
      cached.connections === input.connections &&
      cached.pipeComponentId === input.pipeComponentId &&
      cached.connectorComponentId === input.connectorComponentId &&
      cached.family === family
    ) {
      return cached.endpoints;
    }

    const sceneIndex = createGrowthSceneIndex(
      input.components,
      input.connections
    );
    const connectorDefinitions = resolveGrowthConnectorDefinitions(
      input.connectorComponentId,
      family
    );
    const endpoints: GrowthEndpointRef[] = [];

    for (const component of input.components) {
      const definition = getComponentById(component.componentId);
      if (!definition) continue;

      for (const point of definition.connectionPoints.filter(isStructuralConnectionPoint)) {
        if (
          sceneIndex.occupiedEndpointKeys.has(
            endpointKey(component.instanceId, point.id)
          )
        ) {
          continue;
        }

        const endpoint = buildSourceEndpoint(component, definition, point);
        if (
          this.hasPredictionCandidate(
            {
              endpoint,
              pipeComponentId: input.pipeComponentId,
              components: input.components,
              connections: input.connections,
              connectorComponentId: input.connectorComponentId,
              family,
            },
            sceneIndex,
            connectorDefinitions
          )
        ) {
          endpoints.push(endpoint);
        }
      }
    }

    this.predictionEndpointCache = {
      components: input.components,
      connections: input.connections,
      pipeComponentId: input.pipeComponentId,
      connectorComponentId: input.connectorComponentId,
      family,
      endpoints,
    };
    return endpoints;
  }

  listPredictionSites(input: PredictionEndpointInput): PredictionSiteRef[] {
    const family = input.family ?? 'straight';
    const cached = this.predictionSiteCache;
    if (
      cached &&
      cached.components === input.components &&
      cached.connections === input.connections &&
      cached.pipeComponentId === input.pipeComponentId &&
      cached.connectorComponentId === input.connectorComponentId &&
      cached.family === family
    ) {
      return cached.sites;
    }

    const endpointSites = this.listPredictionEndpoints(input).map(
      endpointPredictionSite
    );
    const sceneIndex = createGrowthSceneIndex(
      input.components,
      input.connections
    );
    const virtualSites: VirtualConnectorPortPredictionSite[] = family === 'straight'
      ? connectorTopologySystem
        .listVirtualConnectorPorts({
          components: input.components,
          connections: input.connections,
        })
        .map(port => ({
          kind: 'virtual-connector-port' as const,
          ...port,
        }))
        .filter(site =>
          this.hasVirtualPredictionCandidate(
            site,
            input.pipeComponentId,
            sceneIndex
          )
        )
      : [];

    const siteKeys = new Set<string>();
    const sites = [...endpointSites, ...virtualSites].filter(site => {
      const direction = new THREE.Vector3(...site.direction).normalize();
      const key = [
        ...site.position.map(value => value.toFixed(3)),
        direction.x.toFixed(3),
        direction.y.toFixed(3),
        direction.z.toFixed(3),
      ].join(':');
      if (siteKeys.has(key)) return false;
      siteKeys.add(key);
      return true;
    });

    this.predictionSiteCache = {
      components: input.components,
      connections: input.connections,
      pipeComponentId: input.pipeComponentId,
      connectorComponentId: input.connectorComponentId,
      family,
      sites,
    };
    return sites;
  }

  chooseDefaultEndpoint(
    input: DefaultGrowthEndpointInput
  ): { componentId: string; pointId: string } | null {
    const component = input.components.find(
      item => item.instanceId === input.componentId
    );
    if (!component) return null;

    const definition = getComponentById(component.componentId);
    if (!definition) return null;

    const available = this.listAvailableEndpoints(
      input.components,
      input.connections,
      [input.componentId]
    );
    if (available.length === 0) return null;

    if (input.preferredPointId) {
      const preferred = available.find(
        endpoint => endpoint.pointId === input.preferredPointId
      );
      if (preferred) {
        return {
          componentId: preferred.componentId,
          pointId: preferred.pointId,
        };
      }
    }

    if (definition.category === 'connector') return null;

    if (available.length === 1) {
      return {
        componentId: available[0].componentId,
        pointId: available[0].pointId,
      };
    }

    if (definition.type === 'pipe') {
      const end = available.find(endpoint => endpoint.pointId === PIPE_FREE_POINT_ID);
      if (end) {
        return {
          componentId: end.componentId,
          pointId: end.pointId,
        };
      }
    }

    return null;
  }

  private hasPredictionCandidate(
    input: GrowthInput,
    sceneIndex: GrowthSceneIndex,
    connectorDefinitions: ComponentDefinition[]
  ): boolean {
    if (!input.endpoint) return false;
    const sourceComponent = sceneIndex.componentsById.get(
      input.endpoint.componentId
    );
    if (!sourceComponent) return false;

    const sourceDefinition = getComponentById(sourceComponent.componentId);
    const pipeDefinition = getComponentById(input.pipeComponentId);
    if (!sourceDefinition || !pipeDefinition) return false;

    const sourcePoint = findConnectionPoint(
      sourceDefinition.connectionPoints,
      input.endpoint.pointId
    );
    const pipeAttachPoint = findConnectionPoint(
      pipeDefinition.connectionPoints,
      PIPE_ATTACH_POINT_ID
    );
    if (!sourcePoint || !pipeAttachPoint) return false;
    if (
      sceneIndex.occupiedEndpointKeys.has(
        endpointKey(sourceComponent.instanceId, sourcePoint.id)
      )
    ) {
      return false;
    }

    const sourceEndpoint = buildSourceEndpoint(
      sourceComponent,
      sourceDefinition,
      sourcePoint
    );

    if (sourceDefinition.category === 'connector') {
      const family = input.family ?? 'straight';
      const isDiagonalPort = sourceDefinition.id === 'connector_45deg';
      if (
        (family === 'diagonal' && !isDiagonalPort) ||
        (family === 'straight' && isDiagonalPort)
      ) {
        return false;
      }
      if (!areCompatible(sourcePoint, pipeAttachPoint)) return false;

      const pipeRotation = rotationToOppositeDirection(
        pipeAttachPoint.direction,
        sourceEndpoint.direction
      );
      const pipePosition = componentPositionForPoint(
        sourceEndpoint.position,
        pipeRotation,
        pipeAttachPoint.position
      );
      return !hasIndexedDuplicatePart(
        sceneIndex,
        pipeDefinition.id,
        pipePosition,
        pipeRotation
      );
    }

    const targetDirections = createTargetDirections(
      sourceEndpoint.direction,
      input.family ?? 'straight'
    );
    for (const desiredDirection of targetDirections) {
      for (const connectorDefinition of connectorDefinitions) {
        for (const connectorAttachPoint of connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint)) {
          if (!areCompatible(connectorAttachPoint, sourcePoint)) continue;

          for (const connectorOutputPoint of connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint)) {
            if (connectorOutputPoint.id === connectorAttachPoint.id) continue;
            if (!areCompatible(connectorOutputPoint, pipeAttachPoint)) continue;

            const connectorRotation = rotationForPointDirections(
              connectorAttachPoint.direction,
              connectorOutputPoint.direction,
              sourceEndpoint.direction,
              desiredDirection
            );
            if (!connectorRotation) continue;

            const connectorPosition = componentPositionForPoint(
              sourceEndpoint.position,
              connectorRotation,
              connectorAttachPoint.position
            );
            if (
              hasIndexedDuplicatePart(
                sceneIndex,
                connectorDefinition.id,
                connectorPosition,
                connectorRotation
              )
            ) {
              continue;
            }

            const outputWorldPosition = getWorldPosition(
              connectorPosition,
              connectorRotation,
              connectorOutputPoint.position
            );
            const outputWorldDirection = getWorldDirection(
              connectorRotation,
              connectorOutputPoint.direction
            );
            if (
              new THREE.Vector3(...outputWorldDirection)
                .normalize()
                .dot(new THREE.Vector3(...desiredDirection).normalize()) <
              1 - DIRECTION_TOLERANCE
            ) {
              continue;
            }

            const pipeRotation = rotationToOppositeDirection(
              pipeAttachPoint.direction,
              outputWorldDirection
            );
            const pipePosition = componentPositionForPoint(
              outputWorldPosition,
              pipeRotation,
              pipeAttachPoint.position
            );
            if (
              hasIndexedDuplicatePart(
                sceneIndex,
                pipeDefinition.id,
                pipePosition,
                pipeRotation
              )
            ) {
              continue;
            }

            return true;
          }
        }
      }
    }

    return false;
  }

  private hasVirtualPredictionCandidate(
    site: VirtualConnectorPortPredictionSite,
    pipeComponentId: GrowthPipeComponentId,
    sceneIndex: GrowthSceneIndex
  ) {
    const pipeDefinition = getComponentById(pipeComponentId);
    const pipeAttachPoint = pipeDefinition
      ? findConnectionPoint(
          pipeDefinition.connectionPoints,
          PIPE_ATTACH_POINT_ID
        )
      : null;
    if (!pipeDefinition || !pipeAttachPoint) return false;

    const pipeRotation = rotationToOppositeDirection(
      pipeAttachPoint.direction,
      site.direction
    );
    const pipePosition = componentPositionForPoint(
      site.position,
      pipeRotation,
      pipeAttachPoint.position
    );
    return !hasIndexedDuplicatePart(
      sceneIndex,
      pipeDefinition.id,
      pipePosition,
      pipeRotation
    );
  }

  private findBridgeTarget(input: {
    candidate: DirectPipeGrowthCandidate | ConnectorPipeGrowthCandidate;
    pipeFreePoint: ConnectionPoint;
    components: ComponentInstance[];
    connections: Connection[];
  }): {
    endpoint: GrowthEndpointRef;
    targetConnector: GrowthConnectorPart | null;
  } | null {
    const pipeFreeDirection = getWorldDirection(
      input.candidate.pipeRotation,
      input.pipeFreePoint.direction
    );
    const availableTargets = this.listAvailableEndpoints(
      input.components,
      input.connections
    )
      .filter(endpoint =>
        !(
          endpoint.componentId === input.candidate.sourceEndpoint.componentId &&
          endpoint.pointId === input.candidate.sourceEndpoint.pointId
        )
      );

    const directConnectorTarget = availableTargets
      // A pipe can close directly only onto a real connector socket. Closing
      // onto another bare pipe end requires a second physical connector.
      .filter(endpoint => {
        const targetInstance = input.components.find(
          component => component.instanceId === endpoint.componentId
        );
        return targetInstance
          ? getComponentById(targetInstance.componentId)?.category === 'connector'
          : false;
      })
      .filter(endpoint =>
        distanceBetween(
          endpoint.position,
          input.candidate.previewEndPosition
        ) <= 0.5
      )
      .filter(endpoint =>
        directionDot(pipeFreeDirection, endpoint.direction) <= -0.95
      )
      .sort((left, right) =>
        distanceBetween(left.position, input.candidate.previewEndPosition) -
        distanceBetween(right.position, input.candidate.previewEndPosition)
      )[0];
    if (directConnectorTarget) {
      return {
        endpoint: directConnectorTarget,
        targetConnector: null,
      };
    }

    const pipeConnectorDirection = roundedTuple(
      new THREE.Vector3(...pipeFreeDirection).normalize().multiplyScalar(-1)
    );
    const pipeDirectionKey = connectorDirectionKey(pipeConnectorDirection);
    if (!pipeDirectionKey) return null;

    for (const endpoint of availableTargets) {
      const targetInstance = input.components.find(
        component => component.instanceId === endpoint.componentId
      );
      const targetDefinition = targetInstance
        ? getComponentById(targetInstance.componentId)
        : null;
      if (!targetInstance || targetDefinition?.category === 'connector') continue;

      const targetConnectorDirection = roundedTuple(
        new THREE.Vector3(...endpoint.direction).normalize().multiplyScalar(-1)
      );
      const targetDirectionKey = connectorDirectionKey(targetConnectorDirection);
      if (!targetDirectionKey || targetDirectionKey === pipeDirectionKey) continue;
      const resolution = connectorTopologySystem.resolveConnectorTopology({
        requiredDirections: [
          pipeConnectorDirection,
          targetConnectorDirection,
        ],
      });
      if (!resolution) continue;
      const connectorDefinition = getComponentById(
        resolution.connectorComponentId
      );
      const targetAttachPointId = resolution.portsByDirection[targetDirectionKey];
      const pipeOutputPointId = resolution.portsByDirection[pipeDirectionKey];
      const targetAttachPoint = connectorDefinition?.connectionPoints.find(
        point => point.id === targetAttachPointId
      );
      const pipeOutputPoint = connectorDefinition?.connectionPoints.find(
        point => point.id === pipeOutputPointId
      );
      if (!connectorDefinition || !targetAttachPoint || !pipeOutputPoint) continue;

      const connectorPosition = componentPositionForPoint(
        endpoint.position,
        resolution.rotation,
        targetAttachPoint.position
      );
      const pipePortPosition = getWorldPosition(
        connectorPosition,
        resolution.rotation,
        pipeOutputPoint.position
      );
      const pipePortDirection = getWorldDirection(
        resolution.rotation,
        pipeOutputPoint.direction
      );
      if (
        distanceBetween(pipePortPosition, input.candidate.previewEndPosition) > 0.5 ||
        directionDot(pipeFreeDirection, pipePortDirection) > -0.95
      ) {
        continue;
      }
      const duplicateConnector = input.components.some(component => {
        const definition = getComponentById(component.componentId);
        return definition?.category === 'connector' &&
          distanceBetween(component.position, connectorPosition) <= 0.5;
      });
      if (duplicateConnector) continue;
      if (
        input.candidate.connector &&
        distanceBetween(input.candidate.connector.position, connectorPosition) <= 0.5
      ) {
        continue;
      }

      return {
        endpoint,
        targetConnector: {
          componentId: resolution.connectorComponentId,
          attachPointId: targetAttachPoint.id,
          outputPointId: pipeOutputPoint.id,
          position: connectorPosition,
          rotation: resolution.rotation,
        },
      };
    }

    return null;
  }

  private withBridgeCandidates(input: {
    candidates: Array<DirectPipeGrowthCandidate | ConnectorPipeGrowthCandidate>;
    pipeFreePoint: ConnectionPoint;
    components: ComponentInstance[];
    connections: Connection[];
  }): GrowthCandidate[] {
    return input.candidates.map(candidate => {
      const bridgeTarget = this.findBridgeTarget({
        candidate,
        pipeFreePoint: input.pipeFreePoint,
        components: input.components,
        connections: input.connections,
      });
      if (!bridgeTarget) return candidate;
      const { endpoint: targetEndpoint, targetConnector } = bridgeTarget;
      const previewParts = [
        ...(candidate.connector
          ? [{
              componentId: candidate.connector.componentId,
              position: candidate.connector.position,
              rotation: candidate.connector.rotation,
            }]
          : []),
        {
          componentId: candidate.pipeComponentId,
          position: candidate.pipePosition,
          rotation: candidate.pipeRotation,
        },
        ...(targetConnector
          ? [{
              componentId: targetConnector.componentId,
              position: targetConnector.position,
              rotation: targetConnector.rotation,
            }]
          : []),
      ];

      return {
        ...candidate,
        kind: 'bridge-existing-site',
        sourceKind: candidate.kind,
        targetConnector,
        targetEndpoint,
        previewBounds: createPreviewBounds(previewParts),
        id: `${candidate.id}:bridge:${targetEndpoint.componentId}:${targetEndpoint.pointId}`,
        label: `${candidate.label}闭环`,
        rank: candidate.rank - 10,
        message: targetConnector
          ? `${candidate.message}＋${getComponentById(targetConnector.componentId)?.name ?? '接头'}，并闭合到${targetEndpoint.componentName}`
          : `${candidate.message}，并闭合到${targetEndpoint.componentName}`,
      };
    });
  }

  generateCandidates(input: GrowthInput): GrowthCandidate[] {
    const sceneIndex = createGrowthSceneIndex(
      input.components,
      input.connections
    );
    const legacyEndpoint = input.endpoint
      ? this.listAvailableEndpoints(
          input.components,
          input.connections,
          [input.endpoint.componentId]
        ).find(
          endpoint =>
            endpoint.componentId === input.endpoint?.componentId &&
            endpoint.pointId === input.endpoint.pointId
        )
      : undefined;
    const site: PredictionSiteRef | null =
      input.site ??
      (legacyEndpoint ? endpointPredictionSite(legacyEndpoint) : null);
    if (!site) return [];
    if (site.kind === 'virtual-connector-port') {
      return this.generateVirtualConnectorCandidates(
        site,
        input,
        sceneIndex
      );
    }

    const sourceComponent = sceneIndex.componentsById.get(
      site.componentId
    );
    if (!sourceComponent) return [];

    const sourceDefinition = getComponentById(sourceComponent.componentId);
    const pipeDefinition = getComponentById(input.pipeComponentId);
    if (!sourceDefinition || !pipeDefinition) return [];

    const sourcePoint = findConnectionPoint(
      sourceDefinition.connectionPoints,
      site.pointId
    );
    const pipeAttachPoint = findConnectionPoint(
      pipeDefinition.connectionPoints,
      PIPE_ATTACH_POINT_ID
    );
    const pipeFreePoint = findConnectionPoint(
      pipeDefinition.connectionPoints,
      PIPE_FREE_POINT_ID
    );
    if (!sourcePoint || !pipeAttachPoint || !pipeFreePoint) return [];
    if (
      sceneIndex.occupiedEndpointKeys.has(
        endpointKey(sourceComponent.instanceId, sourcePoint.id)
      )
    ) {
      return [];
    }

    const sourceEndpoint = buildSourceEndpoint(
      sourceComponent,
      sourceDefinition,
      sourcePoint
    );
    const sourceSite = endpointPredictionSite(sourceEndpoint);

    if (sourceDefinition.category === 'connector') {
      const family = input.family ?? 'straight';
      const isDiagonalPort = sourceDefinition.id === 'connector_45deg';
      if (
        (family === 'diagonal' && !isDiagonalPort) ||
        (family === 'straight' && isDiagonalPort)
      ) {
        return [];
      }
      if (!areCompatible(sourcePoint, pipeAttachPoint)) return [];

      const pipeRotation = rotationToOppositeDirection(
        pipeAttachPoint.direction,
        sourceEndpoint.direction
      );
      const pipePosition = componentPositionForPoint(
        sourceEndpoint.position,
        pipeRotation,
        pipeAttachPoint.position
      );
      if (
        hasIndexedDuplicatePart(
          sceneIndex,
          pipeDefinition.id,
          pipePosition,
          pipeRotation
        )
      ) {
        return [];
      }

      const previewEndPosition = getWorldPosition(
        pipePosition,
        pipeRotation,
        pipeFreePoint.position
      );
      const direction = roundedTuple(
        new THREE.Vector3(...sourceEndpoint.direction).normalize()
      );

      const directCandidate: DirectPipeGrowthCandidate = {
        kind: 'direct-pipe',
        connector: null,
        id: `${sourceEndpoint.componentId}:${sourceEndpoint.pointId}:${input.pipeComponentId}:direct`,
        label: '直行',
        rank: 0,
        pipeComponentId: input.pipeComponentId,
        referenceSpan: pipeReferenceSpan(input.pipeComponentId),
        sourceSite,
        sourceEndpoint,
        pipePosition,
        pipeRotation,
        pipeAttachPointId: pipeAttachPoint.id,
        pipeFreePointId: pipeFreePoint.id,
        direction,
        handlePosition: previewEndPosition,
        previewEndPosition,
        previewBounds: createPreviewBounds([
          {
            componentId: pipeDefinition.id,
            position: pipePosition,
            rotation: pipeRotation,
          },
        ]),
        message: `将添加：${pipeDefinition.name}（直接接入${sourceDefinition.name}）`,
      };

      return this.withBridgeCandidates({
        candidates: [directCandidate],
        pipeFreePoint,
        components: input.components,
        connections: input.connections,
      });
    }

    const family = input.family ?? 'straight';
    const connectorDefinitions = resolveGrowthConnectorDefinitions(
      input.connectorComponentId,
      family
    );
    const targetDirections = createTargetDirections(
      sourceEndpoint.direction,
      family
    );
    const candidates: ConnectorPipeGrowthCandidate[] = [];

    targetDirections.forEach((desiredDirection, directionIndex) => {
      let best:
        | {
            score: number;
            connector: GrowthConnectorPart;
            pipePosition: [number, number, number];
            pipeRotation: [number, number, number];
            previewEndPosition: [number, number, number];
            connectorName: string;
          }
        | undefined;

      connectorDefinitions.forEach((connectorDefinition, connectorIndex) => {
        connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint).forEach(
          (connectorAttachPoint, attachIndex) => {
            if (!areCompatible(connectorAttachPoint, sourcePoint)) return;

            connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint).forEach(
              (connectorOutputPoint, outputIndex) => {
                if (connectorOutputPoint.id === connectorAttachPoint.id) return;
                if (!areCompatible(connectorOutputPoint, pipeAttachPoint)) return;

                const connectorRotation = rotationForPointDirections(
                  connectorAttachPoint.direction,
                  connectorOutputPoint.direction,
                  sourceEndpoint.direction,
                  desiredDirection
                );
                if (!connectorRotation) return;

                const connectorPosition = componentPositionForPoint(
                  sourceEndpoint.position,
                  connectorRotation,
                  connectorAttachPoint.position
                );
                if (
                  hasIndexedDuplicatePart(
                    sceneIndex,
                    connectorDefinition.id,
                    connectorPosition,
                    connectorRotation
                  )
                ) {
                  return;
                }
                const outputWorldPosition = getWorldPosition(
                  connectorPosition,
                  connectorRotation,
                  connectorOutputPoint.position
                );
                const outputWorldDirection = getWorldDirection(
                  connectorRotation,
                  connectorOutputPoint.direction
                );
                if (
                  new THREE.Vector3(...outputWorldDirection)
                    .normalize()
                    .dot(new THREE.Vector3(...desiredDirection).normalize()) <
                  1 - DIRECTION_TOLERANCE
                ) {
                  return;
                }

                const pipeRotation = rotationToOppositeDirection(
                  pipeAttachPoint.direction,
                  outputWorldDirection
                );
                const pipePosition = componentPositionForPoint(
                  outputWorldPosition,
                  pipeRotation,
                  pipeAttachPoint.position
                );
                if (
                  hasIndexedDuplicatePart(
                    sceneIndex,
                    pipeDefinition.id,
                    pipePosition,
                    pipeRotation
                  )
                ) {
                  return;
                }

                const score =
                  connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint).length * 10_000 +
                  connectorIndex * 100 +
                  attachIndex * 10 +
                  outputIndex;
                if (best && score >= best.score) return;

                best = {
                  score,
                  connector: {
                    componentId: connectorDefinition.id,
                    attachPointId: connectorAttachPoint.id,
                    outputPointId: connectorOutputPoint.id,
                    position: connectorPosition,
                    rotation: connectorRotation,
                  },
                  pipePosition,
                  pipeRotation,
                  previewEndPosition: getWorldPosition(
                    pipePosition,
                    pipeRotation,
                    pipeFreePoint.position
                  ),
                  connectorName: connectorDefinition.name,
                };
              }
            );
          }
        );
      });

      if (!best) return;

      const label = family === 'diagonal'
        ? `45°${labelForDirection(desiredDirection)}`
        : directionIndex === 0
          ? '直行'
          : labelForDirection(desiredDirection);
      candidates.push({
        kind: 'connector-pipe',
        connector: best.connector,
        id: `${sourceEndpoint.componentId}:${sourceEndpoint.pointId}:${input.pipeComponentId}:${directionIndex}:${best.connector.componentId}:${best.connector.attachPointId}:${best.connector.outputPointId}`,
        label,
        rank: directionIndex * 100 + best.score,
        pipeComponentId: input.pipeComponentId,
        referenceSpan: pipeReferenceSpan(input.pipeComponentId),
        sourceSite,
        sourceEndpoint,
        pipePosition: best.pipePosition,
        pipeRotation: best.pipeRotation,
        pipeAttachPointId: pipeAttachPoint.id,
        pipeFreePointId: pipeFreePoint.id,
        direction: desiredDirection,
        handlePosition: best.previewEndPosition,
        previewEndPosition: best.previewEndPosition,
        previewBounds: createPreviewBounds([
          {
            componentId: best.connector.componentId,
            position: best.connector.position,
            rotation: best.connector.rotation,
          },
          {
            componentId: pipeDefinition.id,
            position: best.pipePosition,
            rotation: best.pipeRotation,
          },
        ]),
        message: `将添加：${best.connectorName}＋${pipeDefinition.name}`,
      });
    });

    return this.withBridgeCandidates({
      candidates,
      pipeFreePoint,
      components: input.components,
      connections: input.connections,
    }).sort((left, right) => left.rank - right.rank);
  }

  private generateVirtualConnectorCandidates(
    site: VirtualConnectorPortPredictionSite,
    input: GrowthInput,
    sceneIndex: GrowthSceneIndex
  ): UpgradeConnectorPipeGrowthCandidate[] {
    const connector = sceneIndex.componentsById.get(
      site.connectorInstanceId
    );
    const pipeDefinition = getComponentById(input.pipeComponentId);
    const pipeAttachPoint = pipeDefinition
      ? findConnectionPoint(
          pipeDefinition.connectionPoints,
          PIPE_ATTACH_POINT_ID
        )
      : null;
    const pipeFreePoint = pipeDefinition
      ? findConnectionPoint(
          pipeDefinition.connectionPoints,
          PIPE_FREE_POINT_ID
        )
      : null;
    if (!connector || !pipeDefinition || !pipeAttachPoint || !pipeFreePoint) {
      return [];
    }

    const currentDefinition = getComponentById(connector.componentId);
    if (!currentDefinition) return [];

    const pipeRotation = rotationToOppositeDirection(
      pipeAttachPoint.direction,
      site.direction
    );
    const pipePosition = componentPositionForPoint(
      site.position,
      pipeRotation,
      pipeAttachPoint.position
    );
    if (
      hasIndexedDuplicatePart(
        sceneIndex,
        pipeDefinition.id,
        pipePosition,
        pipeRotation
      )
    ) {
      return [];
    }

    const previewEndPosition = getWorldPosition(
      pipePosition,
      pipeRotation,
      pipeFreePoint.position
    );
    const sourceEndpoint: GrowthEndpointRef = {
      componentId: connector.instanceId,
      pointId: site.replacementPointId,
      position: site.position,
      direction: site.direction,
      componentName: site.replacement.connectorName,
    };

    return [
      {
        kind: 'upgrade-connector-pipe',
        connector: null,
        upgrade: {
          connectorInstanceId: connector.instanceId,
          currentConnectorComponentId: connector.componentId,
          currentConnectorName: currentDefinition.name,
          replacementConnectorComponentId:
            site.replacement.connectorComponentId,
          replacementConnectorName: site.replacement.connectorName,
          replacementPosition: connector.position,
          replacementRotation: site.replacement.rotation,
          replacementPointId: site.replacementPointId,
          pointMapping: site.replacement.pointMapping,
        },
        id: `upgrade:${connector.instanceId}:${site.directionKey}:${input.pipeComponentId}:${site.replacement.connectorComponentId}`,
        label: labelForDirection(site.direction),
        rank: 0,
        pipeComponentId: input.pipeComponentId,
        referenceSpan: pipeReferenceSpan(input.pipeComponentId),
        sourceSite: site,
        sourceEndpoint,
        pipePosition,
        pipeRotation,
        pipeAttachPointId: pipeAttachPoint.id,
        pipeFreePointId: pipeFreePoint.id,
        direction: site.direction,
        handlePosition: previewEndPosition,
        previewEndPosition,
        previewBounds: createPreviewBounds([
          {
            componentId: site.replacement.connectorComponentId,
            position: connector.position,
            rotation: site.replacement.rotation,
          },
          {
            componentId: pipeDefinition.id,
            position: pipePosition,
            rotation: pipeRotation,
          },
        ]),
        message: `将升级：${currentDefinition.name}→${site.replacement.connectorName}＋${pipeDefinition.name}`,
      },
    ];
  }

  createTopologyPatch(
    candidate: GrowthCandidate,
    options: GrowthTopologyPatchOptions
  ): TopologyPatch | null {
    const idFactory = options.idFactory ?? defaultIdFactory;
    const pipeInstanceId = idFactory('pipe');
    const pipe: ComponentInstance = {
      instanceId: pipeInstanceId,
      componentId: candidate.pipeComponentId,
      position: candidate.pipePosition,
      rotation: candidate.pipeRotation,
      scale: [1, 1, 1],
    };
    const nextEndpoint = {
      componentId: pipeInstanceId,
      pointId: candidate.pipeFreePointId,
    };

    if (candidate.kind === 'upgrade-connector-pipe') {
      return connectorTopologySystem.createConnectorUpgradePatch({
        connectorInstanceId: candidate.upgrade.connectorInstanceId,
        desiredDirection: candidate.direction,
        addedComponent: pipe,
        sourcePointId: candidate.pipeAttachPointId,
        components: options.components,
        connections: options.connections,
        idFactory,
        selectInstanceId: pipeInstanceId,
        nextEndpoint,
      });
    }

    if (candidate.kind === 'bridge-existing-site') {
      const addComponents: ComponentInstance[] = [pipe];
      const addConnections: Connection[] = [];
      if (candidate.sourceKind === 'direct-pipe') {
        addConnections.push({
          id: idFactory('conn_direct'),
          source: {
            componentId: candidate.sourceEndpoint.componentId,
            pointId: candidate.sourceEndpoint.pointId,
          },
          target: {
            componentId: pipeInstanceId,
            pointId: candidate.pipeAttachPointId,
          },
          type: 'socket',
          isActive: true,
        });
      } else {
        if (!candidate.connector) return null;
        const sourceConnectorInstanceId = idFactory('connector_source');
        addComponents.unshift({
          instanceId: sourceConnectorInstanceId,
          componentId: candidate.connector.componentId,
          position: candidate.connector.position,
          rotation: candidate.connector.rotation,
          scale: [1, 1, 1],
          properties: markConnectorAutoManaged(undefined),
        });
        addConnections.push(
          {
            id: idFactory('conn_source'),
            source: {
              componentId: candidate.sourceEndpoint.componentId,
              pointId: candidate.sourceEndpoint.pointId,
            },
            target: {
              componentId: sourceConnectorInstanceId,
              pointId: candidate.connector.attachPointId,
            },
            type: 'socket',
            isActive: true,
          },
          {
            id: idFactory('conn_pipe'),
            source: {
              componentId: sourceConnectorInstanceId,
              pointId: candidate.connector.outputPointId,
            },
            target: {
              componentId: pipeInstanceId,
              pointId: candidate.pipeAttachPointId,
            },
            type: 'socket',
            isActive: true,
          }
        );
      }

      if (candidate.targetConnector) {
        const targetConnectorInstanceId = idFactory('connector_target');
        addComponents.push({
          instanceId: targetConnectorInstanceId,
          componentId: candidate.targetConnector.componentId,
          position: candidate.targetConnector.position,
          rotation: candidate.targetConnector.rotation,
          scale: [1, 1, 1],
          properties: markConnectorAutoManaged(undefined),
        });
        addConnections.push(
          {
            id: idFactory('conn_bridge_pipe'),
            source: {
              componentId: pipeInstanceId,
              pointId: candidate.pipeFreePointId,
            },
            target: {
              componentId: targetConnectorInstanceId,
              pointId: candidate.targetConnector.outputPointId,
            },
            type: 'socket',
            isActive: true,
          },
          {
            id: idFactory('conn_bridge_target'),
            source: {
              componentId: targetConnectorInstanceId,
              pointId: candidate.targetConnector.attachPointId,
            },
            target: {
              componentId: candidate.targetEndpoint.componentId,
              pointId: candidate.targetEndpoint.pointId,
            },
            type: 'socket',
            isActive: true,
          }
        );
      } else {
        addConnections.push({
          id: idFactory('conn_bridge'),
          source: {
            componentId: pipeInstanceId,
            pointId: candidate.pipeFreePointId,
          },
          target: {
            componentId: candidate.targetEndpoint.componentId,
            pointId: candidate.targetEndpoint.pointId,
          },
          type: 'socket',
          isActive: true,
        });
      }

      return {
        addComponents,
        updateComponents: [],
        removeComponentIds: [],
        addConnections,
        updateConnections: [],
        removeConnectionIds: [],
        selectInstanceId: pipeInstanceId,
      };
    }

    if (candidate.kind === 'direct-pipe') {
      return {
        addComponents: [pipe],
        updateComponents: [],
        removeComponentIds: [],
        addConnections: [
          {
            id: idFactory('conn_direct'),
            source: {
              componentId: candidate.sourceEndpoint.componentId,
              pointId: candidate.sourceEndpoint.pointId,
            },
            target: {
              componentId: pipeInstanceId,
              pointId: candidate.pipeAttachPointId,
            },
            type: 'socket',
            isActive: true,
          },
        ],
        updateConnections: [],
        removeConnectionIds: [],
        selectInstanceId: pipeInstanceId,
        nextEndpoint,
      };
    }

    const connectorInstanceId = idFactory('connector');
    const connector: ComponentInstance = {
      instanceId: connectorInstanceId,
      componentId: candidate.connector.componentId,
      position: candidate.connector.position,
      rotation: candidate.connector.rotation,
      scale: [1, 1, 1],
      properties: markConnectorAutoManaged(undefined),
    };

    return {
      addComponents: [connector, pipe],
      updateComponents: [],
      removeComponentIds: [],
      addConnections: [
        {
          id: idFactory('conn_source'),
          source: {
            componentId: candidate.sourceEndpoint.componentId,
            pointId: candidate.sourceEndpoint.pointId,
          },
          target: {
            componentId: connectorInstanceId,
            pointId: candidate.connector.attachPointId,
          },
          type: 'socket',
          isActive: true,
        },
        {
          id: idFactory('conn_pipe'),
          source: {
            componentId: connectorInstanceId,
            pointId: candidate.connector.outputPointId,
          },
          target: {
            componentId: pipeInstanceId,
            pointId: candidate.pipeAttachPointId,
          },
          type: 'socket',
          isActive: true,
        },
      ],
      updateConnections: [],
      removeConnectionIds: [],
      selectInstanceId: pipeInstanceId,
      nextEndpoint,
    };
  }

  createPlacement(
    candidate: GrowthCandidate,
    options: GrowthPlacementOptions = {}
  ): GrowthPlacement {
    if (
      candidate.kind === 'upgrade-connector-pipe' ||
      candidate.kind === 'bridge-existing-site'
    ) {
      throw new Error(
        'Connector upgrade and bridge candidates must be committed with createTopologyPatch.'
      );
    }

    const idFactory = options.idFactory ?? defaultIdFactory;
    const pipeInstanceId = idFactory('pipe');
    const pipe: ComponentInstance = {
      instanceId: pipeInstanceId,
      componentId: candidate.pipeComponentId,
      position: candidate.pipePosition,
      rotation: candidate.pipeRotation,
      scale: [1, 1, 1],
    };

    if (candidate.kind === 'direct-pipe') {
      return {
        components: [pipe],
        connections: [
          {
            id: idFactory('conn_direct'),
            source: {
              componentId: candidate.sourceEndpoint.componentId,
              pointId: candidate.sourceEndpoint.pointId,
            },
            target: {
              componentId: pipeInstanceId,
              pointId: candidate.pipeAttachPointId,
            },
            type: 'socket',
            isActive: true,
          },
        ],
        selectInstanceId: pipeInstanceId,
        nextEndpoint: {
          componentId: pipeInstanceId,
          pointId: candidate.pipeFreePointId,
        },
      };
    }

    const connectorInstanceId = idFactory('connector');
    const connector: ComponentInstance = {
      instanceId: connectorInstanceId,
      componentId: candidate.connector.componentId,
      position: candidate.connector.position,
      rotation: candidate.connector.rotation,
      scale: [1, 1, 1],
      properties: markConnectorAutoManaged(undefined),
    };

    return {
      components: [connector, pipe],
      connections: [
        {
          id: idFactory('conn_source'),
          source: {
            componentId: candidate.sourceEndpoint.componentId,
            pointId: candidate.sourceEndpoint.pointId,
          },
          target: {
            componentId: connectorInstanceId,
            pointId: candidate.connector.attachPointId,
          },
          type: 'socket',
          isActive: true,
        },
        {
          id: idFactory('conn_pipe'),
          source: {
            componentId: connectorInstanceId,
            pointId: candidate.connector.outputPointId,
          },
          target: {
            componentId: pipeInstanceId,
            pointId: candidate.pipeAttachPointId,
          },
          type: 'socket',
          isActive: true,
        },
      ],
      selectInstanceId: pipeInstanceId,
      nextEndpoint: {
        componentId: pipeInstanceId,
        pointId: candidate.pipeFreePointId,
      },
    };
  }
}

export const endpointGrowthSystem = new EndpointGrowthSystem();
