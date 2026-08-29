import * as THREE from 'three';
import type {
  ComponentInstance,
  Connection,
  ConnectionPoint,
} from '../types';
import {
  getComponentById,
  isStructuralConnectionPoint,
} from '../stores/componentLibrary';
import {
  getWorldDirection,
  getWorldPosition,
} from './ConstructionEngine';
import {
  connectorTopologySystem,
  type TopologyPatch,
  type VirtualConnectorPort,
} from './ConnectorTopologySystem';
import type {
  RecipeMountPort,
  StructureRecipe,
} from './AdvancedStructureSystem';

type Vec3 = [number, number, number];

export type StructureRecipeId = StructureRecipe['recipeId'];
export type StandardDiagonalPipeId = 'pipe_15cm' | 'pipe_25cm' | 'pipe_35cm';

export interface RecipeMountAnchor {
  mountPortId: string;
  targetInstanceId: string;
  targetPointId?: string;
  virtualDirection?: Vec3;
  position: Vec3;
  direction: Vec3;
  virtualConnectorPort?: VirtualConnectorPort;
}

export interface RecipeMountSite {
  id: string;
  recipeId: StructureRecipeId;
  position: Vec3;
  rotation: Vec3;
  anchors: RecipeMountAnchor[];
  grounded?: boolean;
  bounds: {
    center: Vec3;
    size: Vec3;
  };
}

export interface DiagonalEndpointRef {
  componentId: string;
  pointId: string;
  position: Vec3;
  direction: Vec3;
}

export interface DiagonalConnectorPreview {
  componentId: 'connector_45deg';
  position: Vec3;
  rotation: Vec3;
  attachPointId: string;
  outputPointId: string;
}

export interface DiagonalCandidate {
  id: string;
  kind: 'diagonal-extension' | 'diagonal-bridge';
  pipeComponentId: StandardDiagonalPipeId;
  source: DiagonalEndpointRef;
  target?: DiagonalEndpointRef;
  sourceConnector: DiagonalConnectorPreview;
  targetConnector?: DiagonalConnectorPreview;
  pipePosition: Vec3;
  pipeRotation: Vec3;
  pipeStartPointId: string;
  pipeEndPointId: string;
  direction: Vec3;
  previewBounds: {
    center: Vec3;
    size: Vec3;
  };
}

interface WorldEndpoint extends DiagonalEndpointRef {
  point: ConnectionPoint;
  virtualConnectorPort?: VirtualConnectorPort;
}

interface StructureMountInput {
  recipe: StructureRecipe;
  components: ComponentInstance[];
  connections: Connection[];
  excludeInstanceIds?: string[];
}

const POSITION_TOLERANCE_CM = 0.5;
const DIRECTION_DOT_TOLERANCE = 0.995;
const DIAGONAL_DOT_TOLERANCE = 0.01;

const roundedTuple = (value: THREE.Vector3): Vec3 => [
  Number(value.x.toFixed(4)),
  Number(value.y.toFixed(4)),
  Number(value.z.toFixed(4)),
];

const toQuaternion = (rotation: Vec3) =>
  new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
      'XYZ'
    )
  );

const quaternionToRotation = (quaternion: THREE.Quaternion): Vec3 => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    Number(THREE.MathUtils.radToDeg(euler.x).toFixed(4)),
    Number(THREE.MathUtils.radToDeg(euler.y).toFixed(4)),
    Number(THREE.MathUtils.radToDeg(euler.z).toFixed(4)),
  ];
};

const distance = (left: Vec3, right: Vec3) =>
  new THREE.Vector3(...left).distanceTo(new THREE.Vector3(...right));

const arePointsCompatible = (left: ConnectionPoint, right: ConnectionPoint) =>
  left.compatible.includes(right.type) || right.compatible.includes(left.type);

const isPointOccupied = (
  connections: Connection[],
  componentId: string,
  pointId: string,
  ignoredIds: Set<string>
) => connections.some(connection => {
  if (
    ignoredIds.has(connection.source.componentId) ||
    ignoredIds.has(connection.target.componentId)
  ) {
    return false;
  }
  return (
    (connection.source.componentId === componentId && connection.source.pointId === pointId) ||
    (connection.target.componentId === componentId && connection.target.pointId === pointId)
  );
});

const createBasis = (first: THREE.Vector3, second: THREE.Vector3) => {
  const xAxis = first.clone().normalize();
  const yAxis = second
    .clone()
    .addScaledVector(xAxis, -second.dot(xAxis))
    .normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  if (
    xAxis.lengthSq() === 0 ||
    yAxis.lengthSq() === 0 ||
    zAxis.lengthSq() === 0
  ) {
    return null;
  }
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
};

const rotationForDirectionPair = (
  firstLocal: THREE.Vector3,
  secondLocal: THREE.Vector3,
  firstTarget: THREE.Vector3,
  secondTarget: THREE.Vector3
) => {
  const localDot = firstLocal.clone().normalize().dot(secondLocal.clone().normalize());
  const targetDot = firstTarget.clone().normalize().dot(secondTarget.clone().normalize());
  if (Math.abs(localDot - targetDot) > 1e-3) return null;
  const localBasis = createBasis(firstLocal, secondLocal);
  const targetBasis = createBasis(firstTarget, secondTarget);
  if (!localBasis || !targetBasis) return null;
  return new THREE.Quaternion().setFromRotationMatrix(
    targetBasis.multiply(localBasis.clone().invert())
  ).normalize();
};

const rotationForMountPair = (
  firstPort: RecipeMountPort,
  secondPort: RecipeMountPort,
  firstTarget: WorldEndpoint,
  secondTarget: WorldEndpoint
) => {
  const localSpan = new THREE.Vector3(...secondPort.localPosition)
    .sub(new THREE.Vector3(...firstPort.localPosition));
  const targetSpan = new THREE.Vector3(...secondTarget.position)
    .sub(new THREE.Vector3(...firstTarget.position));
  const localDirection = new THREE.Vector3(...firstPort.localDirection);
  const targetDirection = new THREE.Vector3(...firstTarget.direction).multiplyScalar(-1);
  if (
    Math.abs(localSpan.length() - targetSpan.length()) > POSITION_TOLERANCE_CM ||
    Math.abs(localSpan.clone().normalize().dot(localDirection.clone().normalize())) > 1e-3 ||
    Math.abs(targetSpan.clone().normalize().dot(targetDirection.clone().normalize())) > 1e-3
  ) {
    return null;
  }
  const localBasis = createBasis(localSpan, localDirection);
  const targetBasis = createBasis(targetSpan, targetDirection);
  if (!localBasis || !targetBasis) return null;
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    targetBasis.multiply(localBasis.clone().invert())
  ).normalize();
  const transformedSecondDirection = new THREE.Vector3(...secondPort.localDirection)
    .applyQuaternion(quaternion)
    .normalize();
  if (
    transformedSecondDirection.dot(
      new THREE.Vector3(...secondTarget.direction).normalize().multiplyScalar(-1)
    ) < DIRECTION_DOT_TOLERANCE
  ) {
    return null;
  }
  return quaternion;
};

const translationForAnchor = (
  localPosition: Vec3,
  targetPosition: Vec3,
  quaternion: THREE.Quaternion
) => roundedTuple(
  new THREE.Vector3(...targetPosition).sub(
    new THREE.Vector3(...localPosition).applyQuaternion(quaternion)
  )
);

const transformPoint = (
  point: Vec3,
  translation: Vec3,
  quaternion: THREE.Quaternion
) => roundedTuple(
  new THREE.Vector3(...point)
    .applyQuaternion(quaternion)
    .add(new THREE.Vector3(...translation))
);

const calculateRecipeBounds = (
  recipe: StructureRecipe,
  translation: Vec3,
  quaternion: THREE.Quaternion
) => {
  const box = new THREE.Box3();
  recipe.components.forEach(component => {
    box.expandByPoint(
      new THREE.Vector3(...component.position)
        .applyQuaternion(quaternion)
        .add(new THREE.Vector3(...translation))
    );
  });
  if (box.isEmpty()) {
    return { center: translation, size: [10, 10, 10] as Vec3 };
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).addScalar(10);
  return { center: roundedTuple(center), size: roundedTuple(size) };
};

const collectWorldEndpoints = (
  input: StructureMountInput,
  mountPoints: ConnectionPoint[]
): WorldEndpoint[] => {
  const ignoredIds = new Set(input.excludeInstanceIds ?? []);
  const endpoints: WorldEndpoint[] = [];
  input.components.forEach(component => {
    if (ignoredIds.has(component.instanceId)) return;
    const definition = getComponentById(component.componentId);
    if (!definition) return;
    definition.connectionPoints
      .filter(isStructuralConnectionPoint)
      .forEach(point => {
        if (isPointOccupied(
          input.connections,
          component.instanceId,
          point.id,
          ignoredIds
        )) {
          return;
        }
        if (!mountPoints.some(mountPoint => arePointsCompatible(mountPoint, point))) {
          return;
        }
        endpoints.push({
          componentId: component.instanceId,
          pointId: point.id,
          point,
          position: getWorldPosition(component.position, component.rotation, point.position),
          direction: getWorldDirection(component.rotation, point.direction),
        });
      });
  });

  connectorTopologySystem.listVirtualConnectorPorts({
    components: input.components.filter(component => !ignoredIds.has(component.instanceId)),
    connections: input.connections.filter(connection =>
      !ignoredIds.has(connection.source.componentId) &&
      !ignoredIds.has(connection.target.componentId)
    ),
    requireFull: false,
  }).forEach(port => {
    const point: ConnectionPoint = {
      id: port.replacementPointId,
      position: [0, 0, 0],
      direction: port.direction,
      type: 'socket',
      compatible: ['socket'],
      role: 'structural',
    };
    if (!mountPoints.some(mountPoint => arePointsCompatible(mountPoint, point))) return;
    endpoints.push({
      componentId: port.connectorInstanceId,
      pointId: port.replacementPointId,
      point,
      position: port.position,
      direction: port.direction,
      virtualConnectorPort: port,
    });
  });

  const seen = new Set<string>();
  return endpoints
    .filter(endpoint => {
      const key = [
        endpoint.componentId,
        endpoint.pointId,
        endpoint.position.map(value => value.toFixed(3)).join(','),
      ].join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      left.componentId.localeCompare(right.componentId) ||
      left.pointId.localeCompare(right.pointId)
    );
};

const emptyPatch = (): TopologyPatch => ({
  addComponents: [],
  updateComponents: [],
  removeComponentIds: [],
  addConnections: [],
  updateConnections: [],
  removeConnectionIds: [],
});

const sameJson = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const diffTopology = (input: {
  beforeComponents: ComponentInstance[];
  beforeConnections: Connection[];
  afterComponents: ComponentInstance[];
  afterConnections: Connection[];
  selectInstanceId?: string;
}): TopologyPatch => {
  const patch = emptyPatch();
  const beforeComponents = new Map(
    input.beforeComponents.map(component => [component.instanceId, component])
  );
  const afterComponents = new Map(
    input.afterComponents.map(component => [component.instanceId, component])
  );
  input.afterComponents.forEach(component => {
    const previous = beforeComponents.get(component.instanceId);
    if (!previous) patch.addComponents.push(component);
    else if (!sameJson(previous, component)) {
      patch.updateComponents.push({ instanceId: component.instanceId, updates: component });
    }
  });
  input.beforeComponents.forEach(component => {
    if (!afterComponents.has(component.instanceId)) {
      patch.removeComponentIds.push(component.instanceId);
    }
  });

  const beforeConnections = new Map(
    input.beforeConnections.map(connection => [connection.id, connection])
  );
  const afterConnections = new Map(
    input.afterConnections.map(connection => [connection.id, connection])
  );
  input.afterConnections.forEach(connection => {
    const previous = beforeConnections.get(connection.id);
    if (!previous) patch.addConnections.push(connection);
    else if (!sameJson(previous, connection)) patch.updateConnections.push(connection);
  });
  input.beforeConnections.forEach(connection => {
    if (!afterConnections.has(connection.id)) {
      patch.removeConnectionIds.push(connection.id);
    }
  });
  patch.selectInstanceId = input.selectInstanceId;
  return patch;
};

const getRecipeMountPointDefinitions = (recipe: StructureRecipe) =>
  recipe.mountPorts.map(port => {
    const component = recipe.components.find(
      item => item.instanceId === port.componentInstanceId
    );
    const definition = component ? getComponentById(component.componentId) : null;
    return definition?.connectionPoints.find(point => point.id === port.pointId) ?? null;
  });

const transformRecipe = (input: {
  recipe: StructureRecipe;
  site: RecipeMountSite;
  idFactory: (prefix: string) => string;
}) => {
  const quaternion = toQuaternion(input.site.rotation);
  const instanceIdMap = new Map<string, string>();
  input.recipe.components.forEach(component => {
    instanceIdMap.set(component.instanceId, input.idFactory('recipe_part'));
  });
  const assemblyGroupId = input.idFactory('recipe_group');
  const components = input.recipe.components.map(component => ({
    ...component,
    instanceId: instanceIdMap.get(component.instanceId)!,
    position: transformPoint(component.position, input.site.position, quaternion),
    rotation: quaternionToRotation(
      quaternion.clone().multiply(toQuaternion(component.rotation))
    ),
    properties: {
      ...(component.properties ?? {}),
      assemblyGroupId,
      structureRecipeId: input.recipe.recipeId,
    },
  }));
  const connections = input.recipe.connections.map(connection => ({
    ...connection,
    id: input.idFactory('recipe_conn'),
    source: {
      ...connection.source,
      componentId: instanceIdMap.get(connection.source.componentId)!,
    },
    target: {
      ...connection.target,
      componentId: instanceIdMap.get(connection.target.componentId)!,
    },
  }));
  const mountPorts = input.recipe.mountPorts.map(port => ({
    ...port,
    componentInstanceId: instanceIdMap.get(port.componentInstanceId)!,
  }));
  return { components, connections, mountPorts };
};

const findConnectorPreview = (input: {
  endpoint: WorldEndpoint;
  outputDirection: THREE.Vector3;
}): DiagonalConnectorPreview | null => {
  const definition = getComponentById('connector_45deg');
  const points = definition?.connectionPoints.filter(isStructuralConnectionPoint) ?? [];
  if (points.length !== 2) return null;
  const attachTarget = new THREE.Vector3(...input.endpoint.direction)
    .normalize()
    .multiplyScalar(-1);
  const outputTarget = input.outputDirection.clone().normalize();
  const attempts = [
    [points[0], points[1]],
    [points[1], points[0]],
  ] as const;
  for (const [attachPoint, outputPoint] of attempts) {
    if (!arePointsCompatible(attachPoint, input.endpoint.point)) continue;
    const quaternion = rotationForDirectionPair(
      new THREE.Vector3(...attachPoint.direction),
      new THREE.Vector3(...outputPoint.direction),
      attachTarget,
      outputTarget
    );
    if (!quaternion) continue;
    const rotation = quaternionToRotation(quaternion);
    const rotatedAttach = new THREE.Vector3(...attachPoint.position)
      .applyQuaternion(quaternion);
    const position = roundedTuple(
      new THREE.Vector3(...input.endpoint.position).sub(rotatedAttach)
    );
    return {
      componentId: 'connector_45deg',
      position,
      rotation,
      attachPointId: attachPoint.id,
      outputPointId: outputPoint.id,
    };
  }
  return null;
};

const createPipePreview = (input: {
  componentId: StandardDiagonalPipeId;
  startPosition: Vec3;
  direction: THREE.Vector3;
}) => {
  const definition = getComponentById(input.componentId);
  const startPoint = definition?.connectionPoints.find(point => point.id === 'start');
  const endPoint = definition?.connectionPoints.find(point => point.id === 'end');
  if (!definition?.length || !startPoint || !endPoint) return null;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(...startPoint.direction).normalize(),
    input.direction.clone().normalize().multiplyScalar(-1)
  );
  const position = roundedTuple(
    new THREE.Vector3(...input.startPosition).sub(
      new THREE.Vector3(...startPoint.position).applyQuaternion(quaternion)
    )
  );
  return {
    definition,
    startPoint,
    endPoint,
    position,
    rotation: quaternionToRotation(quaternion),
    endPosition: getWorldPosition(
      position,
      quaternionToRotation(quaternion),
      endPoint.position
    ),
  };
};

const connectorOutputPosition = (preview: DiagonalConnectorPreview) => {
  const definition = getComponentById(preview.componentId);
  const point = definition?.connectionPoints.find(item => item.id === preview.outputPointId);
  return point
    ? getWorldPosition(preview.position, preview.rotation, point.position)
    : null;
};

const perpendicularCardinals = (direction: THREE.Vector3) => {
  const cardinals = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];
  return cardinals.filter(axis => Math.abs(axis.dot(direction)) < 1e-3);
};

class StructureMountSystem {
  listRecipeMountSites(input: StructureMountInput): RecipeMountSite[] {
    const requiredPorts = input.recipe.mountPorts.filter(port => port.required);
    if (requiredPorts.length !== 2) return [];
    const mountPointDefinitions = getRecipeMountPointDefinitions(input.recipe);
    if (mountPointDefinitions.some(point => !point)) return [];
    const mountPoints = mountPointDefinitions.filter(
      (point): point is ConnectionPoint => Boolean(point)
    );
    const endpoints = collectWorldEndpoints(input, mountPoints)
      .filter(endpoint => {
        const direction = new THREE.Vector3(...endpoint.direction).normalize();
        // A-frame mounts are upright construction operations. Horizontal or
        // downward targets would create a hanging or sideways structure.
        return direction.y >= DIRECTION_DOT_TOLERANCE;
      });
    const sites: RecipeMountSite[] = [];
    const seen = new Set<string>();

    endpoints.forEach((firstTarget, firstIndex) => {
      endpoints.slice(firstIndex + 1).forEach(secondTarget => {
        if (
          firstTarget.componentId === secondTarget.componentId &&
          firstTarget.pointId === secondTarget.pointId
        ) {
          return;
        }
        if (Math.abs(firstTarget.position[1] - secondTarget.position[1]) > POSITION_TOLERANCE_CM) {
          return;
        }
        if (
          new THREE.Vector3(...firstTarget.direction).normalize().dot(
            new THREE.Vector3(...secondTarget.direction).normalize()
          ) < DIRECTION_DOT_TOLERANCE
        ) {
          return;
        }
        if (
          !arePointsCompatible(mountPoints[0], firstTarget.point) ||
          !arePointsCompatible(mountPoints[1], secondTarget.point)
        ) {
          return;
        }
        const quaternion = rotationForMountPair(
          requiredPorts[0],
          requiredPorts[1],
          firstTarget,
          secondTarget
        );
        if (!quaternion) return;
        const translation = translationForAnchor(
          requiredPorts[0].localPosition,
          firstTarget.position,
          quaternion
        );
        const resolvedSecond = transformPoint(
          requiredPorts[1].localPosition,
          translation,
          quaternion
        );
        if (distance(resolvedSecond, secondTarget.position) > POSITION_TOLERANCE_CM) return;
        const targetKey = [
          `${firstTarget.componentId}:${firstTarget.pointId}`,
          `${secondTarget.componentId}:${secondTarget.pointId}`,
        ].sort().join('|');
        const id = `${input.recipe.recipeId}:${targetKey}`;
        if (seen.has(id)) return;
        seen.add(id);
        sites.push({
          id,
          recipeId: input.recipe.recipeId,
          position: translation,
          rotation: quaternionToRotation(quaternion),
          anchors: [
            {
              mountPortId: requiredPorts[0].id,
              targetInstanceId: firstTarget.componentId,
              targetPointId: firstTarget.pointId,
              virtualDirection: firstTarget.virtualConnectorPort?.direction,
              position: firstTarget.position,
              direction: firstTarget.direction,
              virtualConnectorPort: firstTarget.virtualConnectorPort,
            },
            {
              mountPortId: requiredPorts[1].id,
              targetInstanceId: secondTarget.componentId,
              targetPointId: secondTarget.pointId,
              virtualDirection: secondTarget.virtualConnectorPort?.direction,
              position: secondTarget.position,
              direction: secondTarget.direction,
              virtualConnectorPort: secondTarget.virtualConnectorPort,
            },
          ],
          bounds: calculateRecipeBounds(input.recipe, translation, quaternion),
        });
      });
    });

    return sites.sort((left, right) =>
      left.position[1] - right.position[1] ||
      left.position[0] - right.position[0] ||
      left.position[2] - right.position[2] ||
      left.id.localeCompare(right.id)
    );
  }

  createGroundRecipeMountSite(input: {
    recipe: StructureRecipe;
    groundPosition?: Vec3;
    yawDegrees?: number;
  }): RecipeMountSite {
    const groundPosition = input.groundPosition ?? [0, 0, 0];
    const rotation: Vec3 = [0, input.yawDegrees ?? 0, 0];
    const quaternion = toQuaternion(rotation);
    const minimumMountY = Math.min(
      ...input.recipe.mountPorts
        .filter(port => port.required)
        .map(port => new THREE.Vector3(...port.localPosition).applyQuaternion(quaternion).y)
    );
    const translation: Vec3 = [
      groundPosition[0],
      groundPosition[1] - (Number.isFinite(minimumMountY) ? minimumMountY : 0),
      groundPosition[2],
    ];
    return {
      id: `${input.recipe.recipeId}:ground:${translation.join(',')}:${rotation[1]}`,
      recipeId: input.recipe.recipeId,
      position: translation,
      rotation,
      anchors: [],
      grounded: true,
      bounds: calculateRecipeBounds(input.recipe, translation, quaternion),
    };
  }

  createRecipePlacementPatch(input: StructureMountInput & {
    site: RecipeMountSite;
    idFactory: (prefix: string) => string;
  }): TopologyPatch | null {
    if (input.site.recipeId !== input.recipe.recipeId) return null;
    let currentSite = input.site;
    if (input.site.grounded) {
      if (input.components.length > 0 || input.site.anchors.length > 0) return null;
    } else {
      const validSite = this.listRecipeMountSites(input).find(site => site.id === input.site.id);
      if (!validSite) return null;
      currentSite = validSite;
    }

    const transformed = transformRecipe({
      recipe: input.recipe,
      site: currentSite,
      idFactory: input.idFactory,
    });
    const basePatch: TopologyPatch = {
      ...emptyPatch(),
      addComponents: transformed.components,
      addConnections: transformed.connections,
      selectInstanceId: transformed.components[0]?.instanceId,
    };
    let projected = connectorTopologySystem.applyTopologyPatch({
      components: input.components,
      connections: input.connections,
      patch: basePatch,
      normalizeAutoConnectors: false,
    });

    for (const anchor of currentSite.anchors) {
      const mountPort = transformed.mountPorts.find(port => port.id === anchor.mountPortId);
      if (!mountPort) return null;
      let endpointPatch: TopologyPatch | null;
      if (anchor.virtualConnectorPort) {
        endpointPatch = connectorTopologySystem.createConnectorUpgradePatch({
          connectorInstanceId: anchor.virtualConnectorPort.connectorInstanceId,
          desiredDirection: anchor.direction,
          updatedComponent: {
            instanceId: mountPort.componentInstanceId,
            updates: {},
          },
          sourcePointId: mountPort.pointId,
          components: projected.components,
          connections: projected.connections,
          idFactory: input.idFactory,
          selectInstanceId: transformed.components[0]?.instanceId,
        });
      } else if (anchor.targetPointId) {
        endpointPatch = {
          ...emptyPatch(),
          addConnections: [{
            id: input.idFactory('recipe_mount_conn'),
            source: {
              componentId: anchor.targetInstanceId,
              pointId: anchor.targetPointId,
            },
            target: {
              componentId: mountPort.componentInstanceId,
              pointId: mountPort.pointId,
            },
            type: 'socket',
            isActive: true,
          }],
        };
      } else {
        return null;
      }
      if (!endpointPatch) return null;
      projected = connectorTopologySystem.applyTopologyPatch({
        components: projected.components,
        connections: projected.connections,
        patch: endpointPatch,
        normalizeAutoConnectors: false,
      });
    }

    const everyRequiredPortConnected = transformed.mountPorts
      .filter(port => port.required)
      .every(port => projected.connections.some(connection =>
        (connection.source.componentId === port.componentInstanceId && connection.source.pointId === port.pointId) ||
        (connection.target.componentId === port.componentInstanceId && connection.target.pointId === port.pointId)
      ));
    if (!currentSite.grounded && !everyRequiredPortConnected) return null;

    return diffTopology({
      beforeComponents: input.components,
      beforeConnections: input.connections,
      afterComponents: projected.components,
      afterConnections: projected.connections,
      selectInstanceId: transformed.components[0]?.instanceId,
    });
  }

  listDiagonalCandidates(input: {
    components: ComponentInstance[];
    connections: Connection[];
    pipeComponentId: StandardDiagonalPipeId;
    source?: { componentId: string; pointId: string };
  }): DiagonalCandidate[] {
    const pipeDefinition = getComponentById(input.pipeComponentId);
    const connectorDefinition = getComponentById('connector_45deg');
    if (!pipeDefinition || !connectorDefinition) return [];
    const endpoints = collectWorldEndpoints({
      recipe: {
        id: 'diagonal-probe',
        recipeId: 'diagonal-run',
        name: '45°延伸',
        components: [],
        connections: [],
        mountPorts: [],
      },
      components: input.components,
      connections: input.connections,
    }, connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint))
      .filter(endpoint => !endpoint.virtualConnectorPort)
      .filter(endpoint =>
        !input.source ||
        (endpoint.componentId === input.source.componentId && endpoint.pointId === input.source.pointId)
      );
    const allTargets = collectWorldEndpoints({
      recipe: {
        id: 'diagonal-probe',
        recipeId: 'diagonal-run',
        name: '45°延伸',
        components: [],
        connections: [],
        mountPorts: [],
      },
      components: input.components,
      connections: input.connections,
    }, connectorDefinition.connectionPoints.filter(isStructuralConnectionPoint))
      .filter(endpoint => !endpoint.virtualConnectorPort);
    const candidates: DiagonalCandidate[] = [];
    const seen = new Set<string>();

    endpoints.forEach(source => {
      const sourceDirection = new THREE.Vector3(...source.direction).normalize();
      perpendicularCardinals(sourceDirection).forEach(perpendicular => {
        const outputDirection = sourceDirection.clone().add(perpendicular).normalize();
        if (Math.abs(sourceDirection.dot(outputDirection) - Math.SQRT1_2) > DIAGONAL_DOT_TOLERANCE) {
          return;
        }
        const sourceConnector = findConnectorPreview({ endpoint: source, outputDirection });
        if (!sourceConnector) return;
        const sourceOutputPosition = connectorOutputPosition(sourceConnector);
        if (!sourceOutputPosition) return;
        const pipe = createPipePreview({
          componentId: input.pipeComponentId,
          startPosition: sourceOutputPosition,
          direction: outputDirection,
        });
        if (!pipe) return;
        const matchingTarget = allTargets.find(target => {
          if (target.componentId === source.componentId && target.pointId === source.pointId) return false;
          const targetConnector = findConnectorPreview({
            endpoint: target,
            outputDirection: outputDirection.clone().multiplyScalar(-1),
          });
          const targetOutputPosition = targetConnector
            ? connectorOutputPosition(targetConnector)
            : null;
          return Boolean(
            targetOutputPosition &&
            distance(pipe.endPosition, targetOutputPosition) <= POSITION_TOLERANCE_CM
          );
        });
        const targetConnector = matchingTarget
          ? findConnectorPreview({
              endpoint: matchingTarget,
              outputDirection: outputDirection.clone().multiplyScalar(-1),
            }) ?? undefined
          : undefined;
        const kind = matchingTarget && targetConnector
          ? 'diagonal-bridge' as const
          : 'diagonal-extension' as const;
        const id = [
          kind,
          input.pipeComponentId,
          source.componentId,
          source.pointId,
          outputDirection.toArray().map(value => value.toFixed(4)).join(','),
          matchingTarget ? `${matchingTarget.componentId}:${matchingTarget.pointId}` : '',
        ].join(':');
        if (seen.has(id)) return;
        seen.add(id);
        const end = matchingTarget?.position ?? pipe.endPosition;
        candidates.push({
          id,
          kind,
          pipeComponentId: input.pipeComponentId,
          source,
          target: matchingTarget,
          sourceConnector,
          targetConnector,
          pipePosition: pipe.position,
          pipeRotation: pipe.rotation,
          pipeStartPointId: pipe.startPoint.id,
          pipeEndPointId: pipe.endPoint.id,
          direction: roundedTuple(outputDirection),
          previewBounds: {
            center: [
              (source.position[0] + end[0]) / 2,
              (source.position[1] + end[1]) / 2,
              (source.position[2] + end[2]) / 2,
            ],
            size: [
              Math.max(8, Math.abs(source.position[0] - end[0]) + 8),
              Math.max(8, Math.abs(source.position[1] - end[1]) + 8),
              Math.max(8, Math.abs(source.position[2] - end[2]) + 8),
            ],
          },
        });
      });
    });

    return candidates.sort((left, right) =>
      Number(left.kind === 'diagonal-extension') - Number(right.kind === 'diagonal-extension') ||
      left.source.componentId.localeCompare(right.source.componentId) ||
      left.source.pointId.localeCompare(right.source.pointId) ||
      left.direction.join(',').localeCompare(right.direction.join(','))
    );
  }
}

export const structureMountSystem = new StructureMountSystem();

export const listRecipeMountSites = (
  input: Parameters<StructureMountSystem['listRecipeMountSites']>[0]
) => structureMountSystem.listRecipeMountSites(input);

export const createRecipePlacementPatch = (
  input: Parameters<StructureMountSystem['createRecipePlacementPatch']>[0]
) => structureMountSystem.createRecipePlacementPatch(input);

export const createGroundRecipeMountSite = (
  input: Parameters<StructureMountSystem['createGroundRecipeMountSite']>[0]
) => structureMountSystem.createGroundRecipeMountSite(input);

export const listDiagonalCandidates = (
  input: Parameters<StructureMountSystem['listDiagonalCandidates']>[0]
) => structureMountSystem.listDiagonalCandidates(input);
