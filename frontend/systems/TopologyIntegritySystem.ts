import * as THREE from 'three';
import type {
  ComponentDefinition,
  ComponentInstance,
  Connection,
  ConnectionPoint,
} from '../types';
import {
  getComponentById,
  isStructuralConnectionPoint,
} from '../stores/componentLibrary';
import { getWorldDirection, getWorldPosition } from './ConstructionEngine';
import {
  connectorDirectionKey,
  connectorTopologySystem,
  type TopologyPatch,
} from './ConnectorTopologySystem';

export type TopologyIssueKind =
  | 'missing-connection'
  | 'near-miss'
  | 'dangling-connection'
  | 'duplicate-node'
  | 'free-endpoint';

export interface TopologyEndpointRef {
  componentId: string;
  componentDefinitionId: string;
  pointId: string;
  position: [number, number, number];
  direction: [number, number, number];
  pointType: ConnectionPoint['type'];
  compatible: string[];
  role: NonNullable<ConnectionPoint['role']>;
  capacity: number;
}

export interface TopologyIssue {
  id: string;
  kind: TopologyIssueKind;
  componentIds: string[];
  endpointRefs: Array<{
    componentId: string;
    pointId: string;
  }>;
  distanceCm?: number;
  location?: [number, number, number];
  detail?: string;
  repairable: boolean;
  message: string;
}

export interface TopologyAuditReport {
  issues: TopologyIssue[];
  repairableCount: number;
  freeEndpointCount: number;
}

export interface ContactResolution {
  retainedConnectionIds: string[];
  addConnections: Connection[];
  removeConnectionIds: string[];
  connectorPatches: TopologyPatch[];
}

export interface AuditTopologyInput {
  components: ComponentInstance[];
  connections: Connection[];
}

export interface ResolvePlacementContactsInput extends AuditTopologyInput {
  placementComponentIds: string[];
  idFactory?: (prefix: string) => string;
}

const AUTO_CONNECT_DISTANCE_CM = 0.5;
const NEAR_MISS_DISTANCE_CM = 3;
const DIRECTION_DOT_THRESHOLD = -0.95;
const DUPLICATE_NODE_DISTANCE_CM = 0.5;
const CONNECTOR_MANAGEMENT_PROPERTY = 'connectorManagement';

const endpointKey = (componentId: string, pointId: string) =>
  `${componentId}:${pointId}`;

const connectionKey = (
  leftComponentId: string,
  leftPointId: string,
  rightComponentId: string,
  rightPointId: string
) =>
  [endpointKey(leftComponentId, leftPointId), endpointKey(rightComponentId, rightPointId)]
    .sort()
    .join('|');

const distance = (
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

const areCompatible = (
  left: Pick<TopologyEndpointRef, 'pointType' | 'compatible'>,
  right: Pick<TopologyEndpointRef, 'pointType' | 'compatible'>
) =>
  left.compatible.includes(right.pointType) ||
  right.compatible.includes(left.pointType);

const defaultIdFactory = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const collectEndpoints = (
  components: ComponentInstance[]
): TopologyEndpointRef[] => {
  const endpoints: TopologyEndpointRef[] = [];

  components.forEach(component => {
    const definition = getComponentById(component.componentId);
    if (!definition) return;

    definition.connectionPoints.forEach(point => {
      endpoints.push({
        componentId: component.instanceId,
        componentDefinitionId: component.componentId,
        pointId: point.id,
        position: getWorldPosition(
          component.position,
          component.rotation,
          point.position
        ),
        direction: getWorldDirection(component.rotation, point.direction),
        pointType: point.type,
        compatible: point.compatible,
        role: point.role ?? 'structural',
        capacity: point.capacity ?? 1,
      });
    });
  });

  return endpoints;
};

const buildConnectionIndexes = (
  connections: Connection[],
  endpointByKey: Map<string, TopologyEndpointRef>
) => {
  const validConnectionKeys = new Set<string>();
  const occupiedEndpointKeys = new Set<string>();
  const danglingConnectionIds = new Set<string>();

  connections.forEach(connection => {
    const sourceKey = endpointKey(
      connection.source.componentId,
      connection.source.pointId
    );
    const targetKey = endpointKey(
      connection.target.componentId,
      connection.target.pointId
    );
    if (!endpointByKey.has(sourceKey) || !endpointByKey.has(targetKey)) {
      danglingConnectionIds.add(connection.id);
      return;
    }
    validConnectionKeys.add(
      connectionKey(
        connection.source.componentId,
        connection.source.pointId,
        connection.target.componentId,
        connection.target.pointId
      )
    );
    occupiedEndpointKeys.add(sourceKey);
    occupiedEndpointKeys.add(targetKey);
  });

  return {
    validConnectionKeys,
    occupiedEndpointKeys,
    danglingConnectionIds,
  };
};

const getConnectionEndpointKeys = (connection: Connection) => [
  endpointKey(connection.source.componentId, connection.source.pointId),
  endpointKey(connection.target.componentId, connection.target.pointId),
];

const isConnectionAligned = (
  connection: Connection,
  endpointByKey: Map<string, TopologyEndpointRef>
) => {
  const source = endpointByKey.get(
    endpointKey(connection.source.componentId, connection.source.pointId)
  );
  const target = endpointByKey.get(
    endpointKey(connection.target.componentId, connection.target.pointId)
  );
  if (!source || !target) return false;
  return (
    distance(source.position, target.position) <= AUTO_CONNECT_DISTANCE_CM &&
    directionDot(source.direction, target.direction) <= DIRECTION_DOT_THRESHOLD &&
    areCompatible(source, target)
  );
};

const canEndpointBeUsed = (
  endpoint: TopologyEndpointRef,
  occupiedEndpointKeys: Set<string>,
  allowEndpointKeys: Set<string>
) => {
  const key = endpointKey(endpoint.componentId, endpoint.pointId);
  return !occupiedEndpointKeys.has(key) || allowEndpointKeys.has(key);
};

const findSafeNearMissTranslation = (input: {
  components: ComponentInstance[];
  connections: Connection[];
  left: TopologyEndpointRef;
  right: TopologyEndpointRef;
}): { instanceId: string; updates: Partial<ComponentInstance> } | null => {
  const pairKey = connectionKey(
    input.left.componentId,
    input.left.pointId,
    input.right.componentId,
    input.right.pointId
  );

  for (const [movingEndpoint, targetEndpoint] of [
    [input.left, input.right],
    [input.right, input.left],
  ] as const) {
    const movingComponent = input.components.find(
      component => component.instanceId === movingEndpoint.componentId
    );
    const movingDefinition = movingComponent
      ? getComponentById(movingComponent.componentId)
      : null;
    if (!movingComponent || movingDefinition?.type !== 'pipe') continue;

    const movingKey = endpointKey(movingEndpoint.componentId, movingEndpoint.pointId);
    const targetKey = endpointKey(targetEndpoint.componentId, targetEndpoint.pointId);
    const conflictingConnection = input.connections.some(connection => {
      const keys = getConnectionEndpointKeys(connection);
      const key = connectionKey(
        connection.source.componentId,
        connection.source.pointId,
        connection.target.componentId,
        connection.target.pointId
      );
      return key !== pairKey && (keys.includes(movingKey) || keys.includes(targetKey));
    });
    if (conflictingConnection) continue;

    const translation: [number, number, number] = [
      targetEndpoint.position[0] - movingEndpoint.position[0],
      targetEndpoint.position[1] - movingEndpoint.position[1],
      targetEndpoint.position[2] - movingEndpoint.position[2],
    ];
    const projectedComponents = input.components.map(component =>
      component.instanceId === movingComponent.instanceId
        ? {
            ...component,
            position: [
              component.position[0] + translation[0],
              component.position[1] + translation[1],
              component.position[2] + translation[2],
            ] as [number, number, number],
          }
        : component
    );
    const projectedEndpoints = collectEndpoints(projectedComponents);
    const projectedEndpointByKey = new Map(
      projectedEndpoints.map(endpoint => [
        endpointKey(endpoint.componentId, endpoint.pointId),
        endpoint,
      ])
    );
    const preservesEveryRecordedConnection = input.connections
      .filter(
        connection =>
          connection.source.componentId === movingComponent.instanceId ||
          connection.target.componentId === movingComponent.instanceId
      )
      .every(connection => isConnectionAligned(connection, projectedEndpointByKey));
    if (!preservesEveryRecordedConnection) continue;

    const projectedMovingEndpoint = projectedEndpointByKey.get(movingKey);
    const projectedTargetEndpoint = projectedEndpointByKey.get(targetKey);
    if (
      !projectedMovingEndpoint ||
      !projectedTargetEndpoint ||
      distance(projectedMovingEndpoint.position, projectedTargetEndpoint.position) >
        AUTO_CONNECT_DISTANCE_CM ||
      directionDot(
        projectedMovingEndpoint.direction,
        projectedTargetEndpoint.direction
      ) > DIRECTION_DOT_THRESHOLD
    ) {
      continue;
    }

    return {
      instanceId: movingComponent.instanceId,
      updates: {
        position: projectedComponents.find(
          component => component.instanceId === movingComponent.instanceId
        )!.position,
      },
    };
  }

  return null;
};

const MERGEABLE_CONNECTOR_IDS = new Set([
  'connector_straight',
  'connector_L',
  'connector_T',
  'connector_3way',
  'connector_4way',
  'connector_5way',
]);

interface DuplicateNodeMergeAssessment {
  patch: TopologyPatch | null;
  detail: string;
}

const getDuplicateNodeGroups = (
  components: ComponentInstance[]
): ComponentInstance[][] => {
  const connectors = components
    .filter(component => getComponentById(component.componentId)?.category === 'connector')
    .slice()
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId));
  const visited = new Set<string>();
  const groups: ComponentInstance[][] = [];

  connectors.forEach(seed => {
    if (visited.has(seed.instanceId)) return;
    const group: ComponentInstance[] = [];
    const queue = [seed];
    visited.add(seed.instanceId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);
      connectors.forEach(candidate => {
        if (visited.has(candidate.instanceId)) return;
        if (distance(current.position, candidate.position) > DUPLICATE_NODE_DISTANCE_CM) {
          return;
        }
        visited.add(candidate.instanceId);
        queue.push(candidate);
      });
    }

    if (group.length > 1) groups.push(group);
  });

  return groups;
};

const getDuplicateNodeLocation = (
  group: ComponentInstance[]
): [number, number, number] => [
  group.reduce((sum, component) => sum + component.position[0], 0) / group.length,
  group.reduce((sum, component) => sum + component.position[1], 0) / group.length,
  group.reduce((sum, component) => sum + component.position[2], 0) / group.length,
];

const getDuplicateNodeMaximumDistance = (group: ComponentInstance[]) => {
  let maximumDistance = 0;
  group.forEach((left, leftIndex) => {
    group.slice(leftIndex + 1).forEach(right => {
      maximumDistance = Math.max(maximumDistance, distance(left.position, right.position));
    });
  });
  return maximumDistance;
};

const mergeConnectorProperties = (
  group: ComponentInstance[]
): ComponentInstance['properties'] | null => {
  const merged: Record<string, unknown> = {};
  const keys = new Set(
    group.flatMap(component => Object.keys(component.properties ?? {}))
  );
  keys.delete(CONNECTOR_MANAGEMENT_PROPERTY);

  for (const key of keys) {
    const values = group
      .map(component => component.properties?.[key])
      .filter(value => value !== undefined);
    const serializedValues = new Set(values.map(value => JSON.stringify(value)));
    if (serializedValues.size > 1) return null;
    if (values.length > 0) merged[key] = values[0];
  }

  if (
    group.every(
      component => component.properties?.[CONNECTOR_MANAGEMENT_PROPERTY] === 'auto'
    )
  ) {
    merged[CONNECTOR_MANAGEMENT_PROPERTY] = 'auto';
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

const buildPortsByDirection = (
  componentId: string,
  rotation: [number, number, number]
) => {
  const definition = getComponentById(componentId);
  if (!definition) return null;
  const portsByDirection: Record<string, string> = {};
  for (const point of definition.connectionPoints.filter(isStructuralConnectionPoint)) {
    const key = connectorDirectionKey(getWorldDirection(rotation, point.direction));
    if (!key || portsByDirection[key]) return null;
    portsByDirection[key] = point.id;
  }
  return portsByDirection;
};

const createDuplicateNodeMergeAssessment = (
  input: AuditTopologyInput,
  group: ComponentInstance[]
): DuplicateNodeMergeAssessment => {
  if (group.some(component => !MERGEABLE_CONNECTOR_IDS.has(component.componentId))) {
    return {
      patch: null,
      detail: '包含非标准拓扑接头，不能自动判断端口映射。',
    };
  }
  const referenceScale = JSON.stringify(group[0].scale);
  if (
    group.some(
      component =>
        JSON.stringify(component.scale) !== referenceScale ||
        component.color !== group[0].color
    )
  ) {
    return {
      patch: null,
      detail: '接头的缩放或颜色属性不同，需要人工确认保留项。',
    };
  }

  const mergedProperties = mergeConnectorProperties(group);
  if (mergedProperties === null) {
    return {
      patch: null,
      detail: '接头属于不同结构组或具有冲突属性，不能自动合并。',
    };
  }

  const groupIds = new Set(group.map(component => component.instanceId));
  const connectionCounts = new Map(
    group.map(component => [
      component.instanceId,
      input.connections.filter(connection =>
        connection.source.componentId === component.instanceId ||
        connection.target.componentId === component.instanceId
      ).length,
    ])
  );
  const keeper = group.slice().sort((left, right) => {
    const countDifference =
      (connectionCounts.get(right.instanceId) ?? 0) -
      (connectionCounts.get(left.instanceId) ?? 0);
    return countDifference || left.instanceId.localeCompare(right.instanceId);
  })[0];
  const endpoints = collectEndpoints(input.components);
  const endpointByKey = new Map(
    endpoints.map(endpoint => [endpointKey(endpoint.componentId, endpoint.pointId), endpoint])
  );
  const incidents: Array<{
    connection: Connection;
    side: 'source' | 'target';
    endpoint: TopologyEndpointRef;
    directionKey?: string;
  }> = [];
  const structuralDirections = new Map<string, [number, number, number]>();

  for (const connection of input.connections) {
    const sourceInGroup = groupIds.has(connection.source.componentId);
    const targetInGroup = groupIds.has(connection.target.componentId);
    if (!sourceInGroup && !targetInGroup) continue;
    if (sourceInGroup && targetInGroup) {
      return {
        patch: null,
        detail: '重叠接头之间存在连接记录，需要人工确认后处理。',
      };
    }
    const side = sourceInGroup ? 'source' as const : 'target' as const;
    const reference = connection[side];
    const endpoint = endpointByKey.get(endpointKey(reference.componentId, reference.pointId));
    const opposite = endpointByKey.get(endpointKey(
      connection[side === 'source' ? 'target' : 'source'].componentId,
      connection[side === 'source' ? 'target' : 'source'].pointId
    ));
    if (!endpoint || !opposite) {
      return {
        patch: null,
        detail: '接头包含悬空连接引用，需要先修复连接记录。',
      };
    }
    if (endpoint.role === 'board-mount') {
      incidents.push({ connection, side, endpoint });
      continue;
    }
    const directionKey = connectorDirectionKey(endpoint.direction);
    if (!directionKey) {
      return {
        patch: null,
        detail: '接头包含非标准方向端口，不能自动合并。',
      };
    }
    if (structuralDirections.has(directionKey)) {
      return {
        patch: null,
        detail: `多个连接同时占用 ${directionKey} 方向端口，不能无损合并。`,
      };
    }
    structuralDirections.set(directionKey, endpoint.direction);
    incidents.push({ connection, side, endpoint, directionKey });
  }

  let replacementComponentId = keeper.componentId;
  let replacementRotation = keeper.rotation;
  let portsByDirection = buildPortsByDirection(
    replacementComponentId,
    replacementRotation
  );
  const requiredDirections = [...structuralDirections.values()];
  if (
    requiredDirections.length >= 2 &&
    (!portsByDirection || requiredDirections.some(direction => {
      const key = connectorDirectionKey(direction);
      return !key || !portsByDirection?.[key];
    }))
  ) {
    const resolution = connectorTopologySystem.resolveConnectorTopology({
      requiredDirections,
      currentConnector: keeper,
    });
    if (!resolution) {
      return {
        patch: null,
        detail: '现有连接方向无法映射到单个标准接头。',
      };
    }
    replacementComponentId = resolution.connectorComponentId;
    replacementRotation = resolution.rotation;
    portsByDirection = resolution.portsByDirection;
  }
  if (
    !portsByDirection ||
    [...structuralDirections.keys()].some(key => !portsByDirection?.[key])
  ) {
    return {
      patch: null,
      detail: '保留接头缺少现有连接所需的方向端口。',
    };
  }

  const replacementDefinition = getComponentById(replacementComponentId);
  const boardMountPoint = replacementDefinition?.connectionPoints.find(
    point => point.role === 'board-mount'
  );
  const boardMountCount = incidents.filter(
    incident => incident.endpoint.role === 'board-mount'
  ).length;
  if (
    boardMountCount > 0 &&
    (!boardMountPoint || boardMountCount > (boardMountPoint.capacity ?? 1))
  ) {
    return {
      patch: null,
      detail: '板件挂载数量超过单个接头容量，不能无损合并。',
    };
  }

  const updatedConnections = incidents.map(incident => {
    const pointId = incident.endpoint.role === 'board-mount'
      ? boardMountPoint!.id
      : portsByDirection![incident.directionKey!];
    return {
      ...incident.connection,
      [incident.side]: {
        ...incident.connection[incident.side],
        componentId: keeper.instanceId,
        pointId,
      },
    };
  });
  if (updatedConnections.some(connection => (
    connection.source.componentId === connection.target.componentId
  ))) {
    return {
      patch: null,
      detail: '合并会产生接头自连接，必须人工处理。',
    };
  }

  const patch: TopologyPatch = {
    addComponents: [],
    updateComponents: [{
      instanceId: keeper.instanceId,
      updates: {
        componentId: replacementComponentId,
        rotation: replacementRotation,
        properties: mergedProperties,
      },
    }],
    removeComponentIds: group
      .filter(component => component.instanceId !== keeper.instanceId)
      .map(component => component.instanceId),
    addConnections: [],
    updateConnections: updatedConnections,
    removeConnectionIds: [],
    selectInstanceId: keeper.instanceId,
  };
  const projected = connectorTopologySystem.applyTopologyPatch({
    components: input.components,
    connections: input.connections,
    patch,
    normalizeAutoConnectors: false,
  });
  const projectedEndpoints = collectEndpoints(projected.components);
  const projectedEndpointByKey = new Map(
    projectedEndpoints.map(endpoint => [endpointKey(endpoint.componentId, endpoint.pointId), endpoint])
  );
  const updatedIds = new Set(updatedConnections.map(connection => connection.id));
  const projectedConnectionKeys = new Map<string, string>();
  for (const connection of projected.connections) {
    const key = connectionKey(
      connection.source.componentId,
      connection.source.pointId,
      connection.target.componentId,
      connection.target.pointId
    );
    const existingId = projectedConnectionKeys.get(key);
    if (existingId && (updatedIds.has(existingId) || updatedIds.has(connection.id))) {
      return {
        patch: null,
        detail: '合并会产生重复连接记录，不能自动处理。',
      };
    }
    projectedConnectionKeys.set(key, connection.id);
  }
  const keeperConnections = projected.connections.filter(connection =>
    connection.source.componentId === keeper.instanceId ||
    connection.target.componentId === keeper.instanceId
  );
  if (keeperConnections.some(connection => !isConnectionAligned(connection, projectedEndpointByKey))) {
    return {
      patch: null,
      detail: '合并后至少一个连接点无法保持对齐。',
    };
  }
  const keeperEndpointUsage = new Map<string, number>();
  keeperConnections.forEach(connection => {
    const pointId = connection.source.componentId === keeper.instanceId
      ? connection.source.pointId
      : connection.target.pointId;
    keeperEndpointUsage.set(pointId, (keeperEndpointUsage.get(pointId) ?? 0) + 1);
  });
  if ([...keeperEndpointUsage].some(([pointId, count]) => {
    const point = replacementDefinition?.connectionPoints.find(item => item.id === pointId);
    return !point || count > (point.capacity ?? 1);
  })) {
    return {
      patch: null,
      detail: '合并后的连接数量超过接头端口容量。',
    };
  }

  return {
    patch,
    detail: `可安全合并为一个${replacementDefinition?.name ?? '标准接头'}并保留全部连接。`,
  };
};

const diffTopology = (
  before: AuditTopologyInput,
  after: AuditTopologyInput
): TopologyPatch | null => {
  const beforeComponents = new Map(
    before.components.map(component => [component.instanceId, component])
  );
  const afterComponents = new Map(
    after.components.map(component => [component.instanceId, component])
  );
  const beforeConnections = new Map(
    before.connections.map(connection => [connection.id, connection])
  );
  const afterConnections = new Map(
    after.connections.map(connection => [connection.id, connection])
  );
  const patch: TopologyPatch = {
    addComponents: after.components.filter(
      component => !beforeComponents.has(component.instanceId)
    ),
    updateComponents: after.components.flatMap(component => {
      const previous = beforeComponents.get(component.instanceId);
      if (!previous || JSON.stringify(previous) === JSON.stringify(component)) return [];
      const { instanceId, ...fields } = component;
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([key, value]) => (
          JSON.stringify(value) !== JSON.stringify(previous[key as keyof ComponentInstance])
        ))
      ) as Partial<Omit<ComponentInstance, 'instanceId'>>;
      return [{ instanceId, updates }];
    }),
    removeComponentIds: before.components
      .filter(component => !afterComponents.has(component.instanceId))
      .map(component => component.instanceId),
    addConnections: after.connections.filter(
      connection => !beforeConnections.has(connection.id)
    ),
    updateConnections: after.connections.filter(connection => {
      const previous = beforeConnections.get(connection.id);
      return previous && JSON.stringify(previous) !== JSON.stringify(connection);
    }),
    removeConnectionIds: before.connections
      .filter(connection => !afterConnections.has(connection.id))
      .map(connection => connection.id),
  };
  const hasChanges =
    patch.addComponents.length > 0 ||
    patch.updateComponents.length > 0 ||
    patch.removeComponentIds.length > 0 ||
    patch.addConnections.length > 0 ||
    patch.updateConnections.length > 0 ||
    patch.removeConnectionIds.length > 0;
  return hasChanges ? patch : null;
};

class TopologyIntegritySystem {
  auditTopology(input: AuditTopologyInput): TopologyAuditReport {
    const endpoints = collectEndpoints(input.components);
    const endpointByKey = new Map(
      endpoints.map(endpoint => [
        endpointKey(endpoint.componentId, endpoint.pointId),
        endpoint,
      ])
    );
    const componentById = new Map(
      input.components.map(component => [component.instanceId, component])
    );
    const {
      validConnectionKeys: recordedConnectionKeys,
      danglingConnectionIds,
    } = buildConnectionIndexes(input.connections, endpointByKey);
    const alignedOccupiedEndpointKeys = new Set<string>();
    const duplicateNodeComponentIds = new Set<string>();
    const issues: TopologyIssue[] = [];

    input.connections.forEach(connection => {
      if (danglingConnectionIds.has(connection.id)) {
        issues.push({
          id: `dangling:${connection.id}`,
          kind: 'dangling-connection',
          componentIds: [
            connection.source.componentId,
            connection.target.componentId,
          ].filter(id => !componentById.has(id)),
          endpointRefs: [connection.source, connection.target],
          repairable: true,
          message: '连接引用了不存在的组件或连接点，可安全移除该悬空连接记录。',
        });
        return;
      }

      const source = endpointByKey.get(
        endpointKey(connection.source.componentId, connection.source.pointId)
      );
      const target = endpointByKey.get(
        endpointKey(connection.target.componentId, connection.target.pointId)
      );
      if (!source || !target) return;
      const gap = distance(source.position, target.position);
      const dot = directionDot(source.direction, target.direction);
      const compatible = areCompatible(source, target);
      const isBoardMount =
        connection.type === 'board-mount' ||
        (source.role === 'board-mount' && target.role === 'board-mount');
      if (
        gap <= AUTO_CONNECT_DISTANCE_CM &&
        (isBoardMount || dot <= DIRECTION_DOT_THRESHOLD) &&
        compatible
      ) {
        alignedOccupiedEndpointKeys.add(
          endpointKey(connection.source.componentId, connection.source.pointId)
        );
        alignedOccupiedEndpointKeys.add(
          endpointKey(connection.target.componentId, connection.target.pointId)
        );
        return;
      }

      const isNearMiss =
        compatible &&
        (isBoardMount || dot <= DIRECTION_DOT_THRESHOLD) &&
        gap <= NEAR_MISS_DISTANCE_CM;
      const nearMissRepairable = isNearMiss && Boolean(
        findSafeNearMissTranslation({
          components: input.components,
          connections: input.connections,
          left: source,
          right: target,
        })
      );
      issues.push({
        id: `${isNearMiss ? 'near-connection' : 'dangling'}:${connection.id}`,
        kind: isNearMiss ? 'near-miss' : 'dangling-connection',
        componentIds: [source.componentId, target.componentId],
        endpointRefs: [connection.source, connection.target],
        distanceCm: gap,
        repairable: isNearMiss ? nearMissRepairable : true,
        message: isNearMiss
          ? '连接记录存在，但两个端点发生了小幅错位，需要确认后刚性调整。'
          : '连接记录与实际端点已经脱离，可安全移除失效记录。',
      });
    });

    getDuplicateNodeGroups(input.components).forEach(group => {
      group.forEach(component => duplicateNodeComponentIds.add(component.instanceId));
      const location = getDuplicateNodeLocation(group);
      const assessment = createDuplicateNodeMergeAssessment(input, group);
      const typeCounts = new Map<string, number>();
      group.forEach(component => {
        const name = getComponentById(component.componentId)?.name ?? component.componentId;
        typeCounts.set(name, (typeCounts.get(name) ?? 0) + 1);
      });
      const typeSummary = [...typeCounts]
        .map(([name, count]) => `${name} × ${count}`)
        .join('、');
      issues.push({
        id: `duplicate-node:${group.map(component => component.instanceId).join(':')}`,
        kind: 'duplicate-node',
        componentIds: group.map(component => component.instanceId),
        endpointRefs: [],
        location,
        distanceCm: getDuplicateNodeMaximumDistance(group),
        repairable: Boolean(assessment.patch),
        message: `坐标 (${location.map(value => value.toFixed(1)).join(', ')}) 附近存在 ${group.length} 个重叠接头：${typeSummary}。`,
        detail: assessment.detail,
      });
    });

    const seenPairs = new Set<string>();
    const suggestedEndpointKeys = new Set<string>();
    endpoints.forEach((left, leftIndex) => {
      endpoints.slice(leftIndex + 1).forEach(right => {
        if (left.componentId === right.componentId) return;
        if (
          duplicateNodeComponentIds.has(left.componentId) ||
          duplicateNodeComponentIds.has(right.componentId)
        ) {
          return;
        }
        if (!areCompatible(left, right)) return;
        const gap = distance(left.position, right.position);
        if (gap > NEAR_MISS_DISTANCE_CM) return;
        const dot = directionDot(left.direction, right.direction);
        if (dot > DIRECTION_DOT_THRESHOLD) return;
        const key = connectionKey(
          left.componentId,
          left.pointId,
          right.componentId,
          right.pointId
        );
        if (seenPairs.has(key) || recordedConnectionKeys.has(key)) return;
        seenPairs.add(key);
        const leftOccupied = alignedOccupiedEndpointKeys.has(
          endpointKey(left.componentId, left.pointId)
        );
        const rightOccupied = alignedOccupiedEndpointKeys.has(
          endpointKey(right.componentId, right.pointId)
        );
        const leftKey = endpointKey(left.componentId, left.pointId);
        const rightKey = endpointKey(right.componentId, right.pointId);
        if (
          leftOccupied ||
          rightOccupied ||
          suggestedEndpointKeys.has(leftKey) ||
          suggestedEndpointKeys.has(rightKey)
        ) {
          return;
        }

        const exact = gap <= AUTO_CONNECT_DISTANCE_CM;
        const nearMissRepairable = !exact && Boolean(
          findSafeNearMissTranslation({
            components: input.components,
            connections: input.connections,
            left,
            right,
          })
        );
        issues.push({
          id: `${exact ? 'missing' : 'near'}:${key}`,
          kind: exact ? 'missing-connection' : 'near-miss',
          componentIds: [left.componentId, right.componentId],
          endpointRefs: [
            { componentId: left.componentId, pointId: left.pointId },
            { componentId: right.componentId, pointId: right.pointId },
          ],
          distanceCm: gap,
          repairable: exact || nearMissRepairable,
          message: exact
            ? '两个端点几何已对齐但缺少连接记录，可自动补齐。'
            : '两个端点距离很近但未精确对齐，需要用户确认后再刚性调整。',
        });
        suggestedEndpointKeys.add(leftKey);
        suggestedEndpointKeys.add(rightKey);
      });
    });

    endpoints.forEach(endpoint => {
      if (endpoint.role === 'board-mount') return;
      const key = endpointKey(endpoint.componentId, endpoint.pointId);
      if (alignedOccupiedEndpointKeys.has(key)) return;
      const nearby = endpoints.some(other => {
        if (other.componentId === endpoint.componentId) return false;
        if (!areCompatible(endpoint, other)) return false;
        return distance(endpoint.position, other.position) <= NEAR_MISS_DISTANCE_CM;
      });
      if (nearby) return;

      issues.push({
        id: `free:${key}`,
        kind: 'free-endpoint',
        componentIds: [endpoint.componentId],
        endpointRefs: [{ componentId: endpoint.componentId, pointId: endpoint.pointId }],
        repairable: false,
        message: '合法自由端点，没有可自动连接的邻近目标。',
      });
    });

    return {
      issues,
      repairableCount: issues.filter(issue => issue.repairable).length,
      freeEndpointCount: issues.filter(issue => issue.kind === 'free-endpoint').length,
    };
  }

  createRepairPatch(input: AuditTopologyInput & {
    idFactory?: (prefix: string) => string;
  }): TopologyPatch | null {
    const idFactory = input.idFactory ?? defaultIdFactory;
    let projected: AuditTopologyInput = {
      components: input.components,
      connections: input.connections,
    };
    const maximumMergePasses = input.components.length;
    for (let pass = 0; pass < maximumMergePasses; pass += 1) {
      const repairableDuplicate = getDuplicateNodeGroups(projected.components)
        .map(group => createDuplicateNodeMergeAssessment(projected, group))
        .find(assessment => assessment.patch);
      if (!repairableDuplicate?.patch) break;
      projected = connectorTopologySystem.applyTopologyPatch({
        components: projected.components,
        connections: projected.connections,
        patch: repairableDuplicate.patch,
        normalizeAutoConnectors: false,
      });
    }

    const report = this.auditTopology(projected);
    const addConnections: Connection[] = [];
    const removeConnectionIds = new Set<string>();
    const updateComponents: TopologyPatch['updateComponents'] = [];
    const endpoints = collectEndpoints(projected.components);
    const endpointByKey = new Map(
      endpoints.map(endpoint => [
        endpointKey(endpoint.componentId, endpoint.pointId),
        endpoint,
      ])
    );
    const movedComponentIds = new Set<string>();
    const usedNearMissEndpointKeys = new Set<string>();

    report.issues.forEach(issue => {
      if (issue.kind === 'dangling-connection') {
        const connectionId = issue.id.replace(/^dangling:/, '');
        removeConnectionIds.add(connectionId);
        return;
      }
      if (issue.kind !== 'missing-connection' || issue.endpointRefs.length !== 2) {
        if (
          issue.kind !== 'near-miss' ||
          !issue.repairable ||
          issue.endpointRefs.length !== 2
        ) {
          return;
        }
        const [leftRef, rightRef] = issue.endpointRefs;
        const left = endpointByKey.get(
          endpointKey(leftRef.componentId, leftRef.pointId)
        );
        const right = endpointByKey.get(
          endpointKey(rightRef.componentId, rightRef.pointId)
        );
        if (!left || !right) return;
        const leftKey = endpointKey(left.componentId, left.pointId);
        const rightKey = endpointKey(right.componentId, right.pointId);
        if (
          usedNearMissEndpointKeys.has(leftKey) ||
          usedNearMissEndpointKeys.has(rightKey)
        ) {
          return;
        }
        const update = findSafeNearMissTranslation({
          components: projected.components,
          connections: projected.connections,
          left,
          right,
        });
        if (!update || movedComponentIds.has(update.instanceId)) return;
        updateComponents.push(update);
        movedComponentIds.add(update.instanceId);
        usedNearMissEndpointKeys.add(leftKey);
        usedNearMissEndpointKeys.add(rightKey);

        const alreadyRecorded = projected.connections.some(connection =>
          connectionKey(
            connection.source.componentId,
            connection.source.pointId,
            connection.target.componentId,
            connection.target.pointId
          ) === connectionKey(
            left.componentId,
            left.pointId,
            right.componentId,
            right.pointId
          )
        );
        if (!alreadyRecorded) {
          addConnections.push({
            id: idFactory('conn_repair'),
            source: leftRef,
            target: rightRef,
            type: 'socket',
            isActive: true,
          });
        }
        return;
      }
      const [source, target] = issue.endpointRefs;
      addConnections.push({
        id: idFactory('conn_repair'),
        source,
        target,
        type: 'socket',
        isActive: true,
      });
    });

    if (
      addConnections.length > 0 ||
      removeConnectionIds.size > 0 ||
      updateComponents.length > 0
    ) {
      projected = connectorTopologySystem.applyTopologyPatch({
        components: projected.components,
        connections: projected.connections,
        patch: {
          addComponents: [],
          updateComponents,
          removeComponentIds: [],
          addConnections,
          updateConnections: [],
          removeConnectionIds: [...removeConnectionIds],
        },
        normalizeAutoConnectors: false,
      });
    }

    return diffTopology(input, projected);
  }

  resolvePlacementContacts(
    input: ResolvePlacementContactsInput
  ): ContactResolution {
    const idFactory = input.idFactory ?? defaultIdFactory;
    const endpoints = collectEndpoints(input.components);
    const endpointByKey = new Map(
      endpoints.map(endpoint => [
        endpointKey(endpoint.componentId, endpoint.pointId),
        endpoint,
      ])
    );
    const placementIds = new Set(input.placementComponentIds);
    const retainedConnectionIds: string[] = [];
    const removeConnectionIds: string[] = [];
    const addConnections: Connection[] = [];
    const occupiedEndpointKeys = new Set<string>();
    const existingConnectionKeys = new Set<string>();

    input.connections.forEach(connection => {
      const touchesPlacement =
        placementIds.has(connection.source.componentId) ||
        placementIds.has(connection.target.componentId);
      const aligned = isConnectionAligned(connection, endpointByKey);

      if (touchesPlacement && !aligned) {
        removeConnectionIds.push(connection.id);
        return;
      }
      if (aligned) {
        retainedConnectionIds.push(connection.id);
      }
      const [sourceKey, targetKey] = getConnectionEndpointKeys(connection);
      // Connections outside the component being placed remain authoritative,
      // even if a legacy file has a geometric error. Do not let a new
      // placement reuse their endpoints before the explicit repair workflow.
      if (
        endpointByKey.has(sourceKey) &&
        endpointByKey.has(targetKey) &&
        (aligned || !touchesPlacement)
      ) {
        occupiedEndpointKeys.add(sourceKey);
        occupiedEndpointKeys.add(targetKey);
        existingConnectionKeys.add(
          connectionKey(
            connection.source.componentId,
            connection.source.pointId,
            connection.target.componentId,
            connection.target.pointId
          )
        );
      }
    });

    const allowEndpointKeys = new Set<string>();
    removeConnectionIds.forEach(connectionId => {
      const connection = input.connections.find(item => item.id === connectionId);
      if (!connection) return;
      getConnectionEndpointKeys(connection).forEach(key => allowEndpointKeys.add(key));
    });

    const placementEndpoints = endpoints.filter(endpoint =>
      placementIds.has(endpoint.componentId)
    );
    placementEndpoints.forEach(source => {
      if (!canEndpointBeUsed(source, occupiedEndpointKeys, allowEndpointKeys)) {
        return;
      }

      const match = endpoints
        .filter(target => target.componentId !== source.componentId)
        .filter(target => !placementIds.has(target.componentId))
        .filter(target => areCompatible(source, target))
        .filter(target =>
          canEndpointBeUsed(target, occupiedEndpointKeys, allowEndpointKeys)
        )
        .map(target => ({
          target,
          gap: distance(source.position, target.position),
          dot: directionDot(source.direction, target.direction),
        }))
        .filter(item =>
          item.gap <= AUTO_CONNECT_DISTANCE_CM &&
          item.dot <= DIRECTION_DOT_THRESHOLD
        )
        .sort((left, right) => left.gap - right.gap)[0];

      if (!match) return;
      const key = connectionKey(
        source.componentId,
        source.pointId,
        match.target.componentId,
        match.target.pointId
      );
      if (existingConnectionKeys.has(key)) return;

      addConnections.push({
        id: idFactory('conn_contact'),
        source: {
          componentId: source.componentId,
          pointId: source.pointId,
        },
        target: {
          componentId: match.target.componentId,
          pointId: match.target.pointId,
        },
        type: 'socket',
        isActive: true,
      });
      existingConnectionKeys.add(key);
      occupiedEndpointKeys.add(endpointKey(source.componentId, source.pointId));
      occupiedEndpointKeys.add(
        endpointKey(match.target.componentId, match.target.pointId)
      );
    });

    return {
      retainedConnectionIds,
      addConnections,
      removeConnectionIds,
      connectorPatches: [],
    };
  }

  listPipeEndpointDiagnostics(input: AuditTopologyInput): Array<{
    endpoint: TopologyEndpointRef;
    kind: 'free' | 'problem';
  }> {
    const endpoints = collectEndpoints(input.components);
    const pipeEndpoints = endpoints.filter(endpoint => {
      const definition: ComponentDefinition | undefined = getComponentById(
        endpoint.componentDefinitionId
      );
      return definition?.type === 'pipe';
    });
    const occupied = buildConnectionIndexes(
      input.connections,
      new Map(endpoints.map(endpoint => [
        endpointKey(endpoint.componentId, endpoint.pointId),
        endpoint,
      ]))
    ).occupiedEndpointKeys;
    const report = this.auditTopology(input);
    const problemEndpointKeys = new Set(
      report.issues
        .filter(issue => issue.kind !== 'free-endpoint')
        .flatMap(issue => issue.endpointRefs)
        .map(endpoint => endpointKey(endpoint.componentId, endpoint.pointId))
    );

    return pipeEndpoints
      .filter(endpoint => !occupied.has(endpointKey(endpoint.componentId, endpoint.pointId)))
      .map(endpoint => ({
        endpoint,
        kind: problemEndpointKeys.has(endpointKey(endpoint.componentId, endpoint.pointId))
          ? 'problem' as const
          : 'free' as const,
      }));
  }
}

export const topologyIntegritySystem = new TopologyIntegritySystem();

export const auditTopology = (input: AuditTopologyInput) =>
  topologyIntegritySystem.auditTopology(input);

export const createRepairPatch = (
  input: AuditTopologyInput & { idFactory?: (prefix: string) => string }
) => topologyIntegritySystem.createRepairPatch(input);

export const resolvePlacementContacts = (
  input: ResolvePlacementContactsInput
) => topologyIntegritySystem.resolvePlacementContacts(input);
