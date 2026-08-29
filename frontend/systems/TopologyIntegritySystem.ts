import * as THREE from 'three';
import type {
  ComponentDefinition,
  ComponentInstance,
  Connection,
  ConnectionPoint,
} from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { getWorldDirection, getWorldPosition } from './ConstructionEngine';
import type { TopologyPatch } from './ConnectorTopologySystem';

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

    for (let i = 0; i < input.components.length; i += 1) {
      const left = input.components[i];
      const leftDef = getComponentById(left.componentId);
      if (leftDef?.category !== 'connector') continue;
      for (let j = i + 1; j < input.components.length; j += 1) {
        const right = input.components[j];
        const rightDef = getComponentById(right.componentId);
        if (rightDef?.category !== 'connector') continue;
        const gap = distance(left.position, right.position);
        if (gap > DUPLICATE_NODE_DISTANCE_CM) continue;
        duplicateNodeComponentIds.add(left.instanceId);
        duplicateNodeComponentIds.add(right.instanceId);
        issues.push({
          id: `duplicate-node:${left.instanceId}:${right.instanceId}`,
          kind: 'duplicate-node',
          componentIds: [left.instanceId, right.instanceId],
          endpointRefs: [],
          distanceCm: gap,
          repairable: false,
          message: `同一位置存在重复接头：${leftDef.name} 与 ${rightDef.name}。`,
        });
      }
    }

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
    const report = this.auditTopology(input);
    const addConnections: Connection[] = [];
    const removeConnectionIds = new Set<string>();
    const updateComponents: TopologyPatch['updateComponents'] = [];
    const endpoints = collectEndpoints(input.components);
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
          components: input.components,
          connections: input.connections,
          left,
          right,
        });
        if (!update || movedComponentIds.has(update.instanceId)) return;
        updateComponents.push(update);
        movedComponentIds.add(update.instanceId);
        usedNearMissEndpointKeys.add(leftKey);
        usedNearMissEndpointKeys.add(rightKey);

        const alreadyRecorded = input.connections.some(connection =>
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
      addConnections.length === 0 &&
      removeConnectionIds.size === 0 &&
      updateComponents.length === 0
    ) {
      return null;
    }

    return {
      addComponents: [],
      updateComponents,
      removeComponentIds: [],
      addConnections,
      updateConnections: [],
      removeConnectionIds: [...removeConnectionIds],
    };
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
