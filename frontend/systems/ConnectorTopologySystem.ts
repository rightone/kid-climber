import * as THREE from 'three';
import type {
  ComponentDefinition,
  ComponentInstance,
  Connection,
} from '../types';
import {
  getComponentById,
  getComponentsByCategory,
  isStructuralConnectionPoint,
} from '../stores/componentLibrary';

export type TopologyVector3 = [number, number, number];

export interface TopologyPatch {
  addComponents: ComponentInstance[];
  updateComponents: Array<{
    instanceId: string;
    updates: Partial<ComponentInstance>;
  }>;
  removeComponentIds: string[];
  addConnections: Connection[];
  updateConnections: Connection[];
  removeConnectionIds: string[];
  selectInstanceId?: string;
  nextEndpoint?: { componentId: string; pointId: string };
}

export interface ConnectorTopologyResolution {
  connectorComponentId: string;
  connectorName: string;
  rotation: TopologyVector3;
  portsByDirection: Record<string, string>;
  pointMapping: Record<string, string>;
}

export interface VirtualConnectorPort {
  connectorInstanceId: string;
  position: TopologyVector3;
  direction: TopologyVector3;
  directionKey: string;
  replacement: ConnectorTopologyResolution;
  replacementPointId: string;
  currentConnectorName: string;
}

interface ConnectorIncident {
  connection: Connection;
  connectorPointId: string;
  direction: TopologyVector3;
  directionKey: string;
}

const AUTO_CONNECTOR_PROPERTY = 'connectorManagement';
const AUTO_CONNECTOR_VALUE = 'auto';
const DIRECTION_TOLERANCE = 1e-3;
const ROTATION_TOLERANCE = 1e-3;

const AUTOMATIC_CONNECTOR_IDS = [
  'connector_straight',
  'connector_L',
  'connector_T',
  'connector_3way',
  'connector_4way',
  'connector_5way',
] as const;

const CARDINAL_DIRECTIONS: Array<{
  key: string;
  vector: TopologyVector3;
}> = [
  { key: 'x+', vector: [1, 0, 0] },
  { key: 'x-', vector: [-1, 0, 0] },
  { key: 'y+', vector: [0, 1, 0] },
  { key: 'y-', vector: [0, -1, 0] },
  { key: 'z+', vector: [0, 0, 1] },
  { key: 'z-', vector: [0, 0, -1] },
];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const roundedTuple = (vector: THREE.Vector3): TopologyVector3 => [
  Number(vector.x.toFixed(4)),
  Number(vector.y.toFixed(4)),
  Number(vector.z.toFixed(4)),
];

const rotationQuaternion = (rotation: TopologyVector3) =>
  new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      toRadians(rotation[0]),
      toRadians(rotation[1]),
      toRadians(rotation[2]),
      'XYZ'
    )
  );

const quaternionToRotation = (
  quaternion: THREE.Quaternion
): TopologyVector3 => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    Number(toDegrees(euler.x).toFixed(4)),
    Number(toDegrees(euler.y).toFixed(4)),
    Number(toDegrees(euler.z).toFixed(4)),
  ];
};

const createCubeRotations = (): TopologyVector3[] => {
  const rotations: TopologyVector3[] = [];
  const vectors = CARDINAL_DIRECTIONS.map(item => new THREE.Vector3(...item.vector));

  vectors.forEach(xAxis => {
    vectors.forEach(yAxis => {
      if (Math.abs(xAxis.dot(yAxis)) > DIRECTION_TOLERANCE) return;

      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      if (zAxis.lengthSq() === 0) return;

      const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      rotations.push(
        quaternionToRotation(
          new THREE.Quaternion().setFromRotationMatrix(matrix)
        )
      );
    });
  });

  return rotations;
};

const CUBE_ROTATIONS = createCubeRotations();

export const connectorDirectionKey = (
  direction: TopologyVector3
): string | null => {
  const normalized = new THREE.Vector3(...direction).normalize();
  if (normalized.lengthSq() === 0) return null;

  let best: { key: string; dot: number } | null = null;
  for (const item of CARDINAL_DIRECTIONS) {
    const dot = normalized.dot(new THREE.Vector3(...item.vector));
    if (!best || dot > best.dot) {
      best = { key: item.key, dot };
    }
  }

  return best && best.dot >= 1 - DIRECTION_TOLERANCE
    ? best.key
    : null;
};

const worldDirection = (
  rotation: TopologyVector3,
  localDirection: TopologyVector3
): TopologyVector3 =>
  roundedTuple(
    new THREE.Vector3(...localDirection)
      .applyQuaternion(rotationQuaternion(rotation))
      .normalize()
  );

const worldPosition = (
  component: Pick<ComponentInstance, 'position' | 'rotation'>,
  localPosition: TopologyVector3
): TopologyVector3 =>
  roundedTuple(
    new THREE.Vector3(...localPosition)
      .applyQuaternion(rotationQuaternion(component.rotation))
      .add(new THREE.Vector3(...component.position))
  );

const normalizedAngle = (degrees: number) => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const sameRotation = (
  left: TopologyVector3,
  right: TopologyVector3
) =>
  left.every((value, index) => {
    const difference = Math.abs(
      normalizedAngle(value) - normalizedAngle(right[index])
    );
    return (
      difference <= ROTATION_TOLERANCE ||
      Math.abs(difference - 360) <= ROTATION_TOLERANCE
    );
  });

const connectorDefinitions = () =>
  AUTOMATIC_CONNECTOR_IDS.map(id => getComponentById(id)).filter(
    (definition): definition is ComponentDefinition => Boolean(definition)
  );

const portDirectionsForRotation = (
  definition: ComponentDefinition,
  rotation: TopologyVector3
) => {
  const portsByDirection: Record<string, string> = {};

  for (const point of definition.connectionPoints.filter(isStructuralConnectionPoint)) {
    const key = connectorDirectionKey(
      worldDirection(rotation, point.direction)
    );
    if (!key || portsByDirection[key]) return null;
    portsByDirection[key] = point.id;
  }

  return portsByDirection;
};

const connectionTouches = (connection: Connection, componentId: string) =>
  connection.source.componentId === componentId ||
  connection.target.componentId === componentId;

const connectorPointIdForConnection = (
  connection: Connection,
  connectorInstanceId: string
) =>
  connection.source.componentId === connectorInstanceId
    ? connection.source.pointId
    : connection.target.pointId;

const getConnectorIncidents = (
  connector: ComponentInstance,
  connections: Connection[]
): ConnectorIncident[] => {
  const definition = getComponentById(connector.componentId);
  if (!definition) return [];

  const pointsById = new Map(
    definition.connectionPoints
      .filter(isStructuralConnectionPoint)
      .map(point => [point.id, point])
  );
  const incidents: ConnectorIncident[] = [];

  connections.forEach(connection => {
    if (!connectionTouches(connection, connector.instanceId)) return;

    const connectorPointId = connectorPointIdForConnection(
      connection,
      connector.instanceId
    );
    const point = pointsById.get(connectorPointId);
    if (!point) return;

    const direction = worldDirection(connector.rotation, point.direction);
    const directionKey = connectorDirectionKey(direction);
    if (!directionKey) return;

    incidents.push({
      connection,
      connectorPointId,
      direction,
      directionKey,
    });
  });

  return incidents;
};

const buildPointMapping = (
  incidents: ConnectorIncident[],
  portsByDirection: Record<string, string>
) =>
  incidents.reduce<Record<string, string>>((mapping, incident) => {
    const nextPointId = portsByDirection[incident.directionKey];
    if (nextPointId) mapping[incident.connectorPointId] = nextPointId;
    return mapping;
  }, {});

const isAutoManagedConnector = (component: ComponentInstance) =>
  component.properties?.[AUTO_CONNECTOR_PROPERTY] === AUTO_CONNECTOR_VALUE;

export const markConnectorAutoManaged = (
  properties: ComponentInstance['properties']
): ComponentInstance['properties'] => ({
  ...(properties ?? {}),
  [AUTO_CONNECTOR_PROPERTY]: AUTO_CONNECTOR_VALUE,
});

const emptyTopologyPatch = (): TopologyPatch => ({
  addComponents: [],
  updateComponents: [],
  removeComponentIds: [],
  addConnections: [],
  updateConnections: [],
  removeConnectionIds: [],
});

class ConnectorTopologySystem {
  private resolutionCache = new Map<
    string,
    Omit<ConnectorTopologyResolution, 'pointMapping'>
  >();

  resolveConnectorTopology(input: {
    requiredDirections: TopologyVector3[];
    currentConnector?: ComponentInstance;
    incidents?: ConnectorIncident[];
  }): ConnectorTopologyResolution | null {
    const requiredKeys = [
      ...new Set(
        input.requiredDirections
          .map(direction => connectorDirectionKey(direction))
          .filter((key): key is string => Boolean(key))
      ),
    ];
    if (
      requiredKeys.length < 2 ||
      requiredKeys.length !== input.requiredDirections.length
    ) {
      return null;
    }
    const cacheKey = [
      [...requiredKeys].sort().join(','),
      input.currentConnector?.componentId ?? '',
      input.currentConnector?.rotation
        .map(value => normalizedAngle(value).toFixed(3))
        .join(',') ?? '',
    ].join('|');
    const cached = this.resolutionCache.get(cacheKey);
    if (cached) {
      const pointMapping = buildPointMapping(
        input.incidents ?? [],
        cached.portsByDirection
      );
      if (
        input.incidents &&
        Object.keys(pointMapping).length !== input.incidents.length
      ) {
        return null;
      }
      return {
        ...cached,
        portsByDirection: { ...cached.portsByDirection },
        pointMapping,
      };
    }

    const candidates: Array<{
      resolution: ConnectorTopologyResolution;
      score: [number, number, number, number];
    }> = [];

    connectorDefinitions().forEach((definition, definitionIndex) => {
      const rotations = input.currentConnector?.componentId === definition.id
        ? [input.currentConnector.rotation, ...CUBE_ROTATIONS]
        : CUBE_ROTATIONS;

      rotations.forEach((rotation, rotationIndex) => {
        const portsByDirection = portDirectionsForRotation(
          definition,
          rotation
        );
        if (!portsByDirection) return;
        if (!requiredKeys.every(key => portsByDirection[key])) return;

        const stableRotation =
          input.currentConnector?.componentId === definition.id &&
          sameRotation(input.currentConnector.rotation, rotation);
        candidates.push({
          resolution: {
            connectorComponentId: definition.id,
            connectorName: definition.name,
            rotation,
            portsByDirection,
            pointMapping: {},
          },
          score: [
            definition.connectionPoints.filter(isStructuralConnectionPoint).length,
            definition.connectionPoints.filter(isStructuralConnectionPoint).length - requiredKeys.length,
            definitionIndex,
            stableRotation ? -1 : rotationIndex,
          ],
        });
      });
    });

    candidates.sort((left, right) => {
      for (let index = 0; index < left.score.length; index += 1) {
        if (left.score[index] !== right.score[index]) {
          return left.score[index] - right.score[index];
        }
      }
      return 0;
    });

    const resolved = candidates[0]?.resolution;
    if (!resolved) return null;
    const cachedResolution = {
      connectorComponentId: resolved.connectorComponentId,
      connectorName: resolved.connectorName,
      rotation: resolved.rotation,
      portsByDirection: resolved.portsByDirection,
    };
    this.resolutionCache.set(cacheKey, cachedResolution);
    const pointMapping = buildPointMapping(
      input.incidents ?? [],
      resolved.portsByDirection
    );
    if (
      input.incidents &&
      Object.keys(pointMapping).length !== input.incidents.length
    ) {
      return null;
    }
    return {
      ...cachedResolution,
      portsByDirection: { ...cachedResolution.portsByDirection },
      pointMapping,
    };
  }

  listVirtualConnectorPorts(input: {
    components: ComponentInstance[];
    connections: Connection[];
    requireFull?: boolean;
  }): VirtualConnectorPort[] {
    const ports: VirtualConnectorPort[] = [];

    input.components.forEach(component => {
      const definition = getComponentById(component.componentId);
      if (!definition || definition.category !== 'connector') return;

      const incidents = getConnectorIncidents(component, input.connections);
      if (
        input.requireFull !== false &&
        incidents.length < definition.connectionPoints.filter(isStructuralConnectionPoint).length
      ) {
        return;
      }
      const connectedDirectionKeys = new Set(
        incidents.map(incident => incident.directionKey)
      );
      const occupiedPointIds = new Set(
        incidents.map(incident => incident.connectorPointId)
      );
      const currentPortsByDirection =
        portDirectionsForRotation(definition, component.rotation) ?? {};
      const currentPointByDirection = new Map(
        Object.entries(currentPortsByDirection).map(([key, pointId]) => [
          key,
          pointId,
        ])
      );

      CARDINAL_DIRECTIONS.forEach(directionOption => {
        if (connectedDirectionKeys.has(directionOption.key)) return;

        const currentPointId = currentPointByDirection.get(directionOption.key);
        if (currentPointId && !occupiedPointIds.has(currentPointId)) {
          return;
        }

        const requiredDirections = [
          ...incidents.map(incident => incident.direction),
          directionOption.vector,
        ];
        const replacement = this.resolveConnectorTopology({
          requiredDirections,
          currentConnector: component,
          incidents,
        });
        if (!replacement) return;

        const replacementPointId =
          replacement.portsByDirection[directionOption.key];
        const replacementDefinition = getComponentById(
          replacement.connectorComponentId
        );
        const replacementPoint = replacementDefinition?.connectionPoints.find(
          point => point.id === replacementPointId
        );
        if (!replacementPoint) return;

        ports.push({
          connectorInstanceId: component.instanceId,
          position: worldPosition(
            {
              position: component.position,
              rotation: replacement.rotation,
            },
            replacementPoint.position
          ),
          direction: directionOption.vector,
          directionKey: directionOption.key,
          replacement,
          replacementPointId,
          currentConnectorName: definition.name,
        });
      });
    });

    return ports;
  }

  createConnectorUpgradePatch(input: {
    connectorInstanceId: string;
    desiredDirection: TopologyVector3;
    addedComponent?: ComponentInstance;
    updatedComponent?: {
      instanceId: string;
      updates: Partial<ComponentInstance>;
    };
    sourcePointId: string;
    components: ComponentInstance[];
    connections: Connection[];
    idFactory: (prefix: string) => string;
    selectInstanceId?: string;
    nextEndpoint?: { componentId: string; pointId: string };
  }): TopologyPatch | null {
    const connector = input.components.find(
      component => component.instanceId === input.connectorInstanceId
    );
    const connectorDefinition = connector
      ? getComponentById(connector.componentId)
      : null;
    if (!connector || connectorDefinition?.category !== 'connector') {
      return null;
    }

    const incidents = getConnectorIncidents(connector, input.connections);
    const resolution = this.resolveConnectorTopology({
      requiredDirections: [
        ...incidents.map(incident => incident.direction),
        input.desiredDirection,
      ],
      currentConnector: connector,
      incidents,
    });
    if (!resolution) return null;

    const directionKey = connectorDirectionKey(input.desiredDirection);
    const targetPointId = directionKey
      ? resolution.portsByDirection[directionKey]
      : null;
    const sourceInstanceId =
      input.addedComponent?.instanceId ?? input.updatedComponent?.instanceId;
    if (!targetPointId || !sourceInstanceId) return null;
    const sourceComponent = input.addedComponent
      ?? input.components.find(
        component => component.instanceId === input.updatedComponent?.instanceId
      );
    const sourceDefinition = sourceComponent
      ? getComponentById(sourceComponent.componentId)
      : null;
    const sourcePoint = sourceDefinition?.connectionPoints.find(
      point => point.id === input.sourcePointId
    );
    const replacementDefinition = getComponentById(
      resolution.connectorComponentId
    );
    const targetPoint = replacementDefinition?.connectionPoints.find(
      point => point.id === targetPointId
    );
    if (
      !sourcePoint ||
      !targetPoint ||
      !(
        sourcePoint.compatible.includes(targetPoint.type) ||
        targetPoint.compatible.includes(sourcePoint.type)
      )
    ) {
      return null;
    }

    const updatedConnections = incidents.map(incident => {
      const nextPointId = resolution.pointMapping[incident.connectorPointId];
      if (!nextPointId || nextPointId === incident.connectorPointId) {
        return incident.connection;
      }

      if (
        incident.connection.source.componentId === connector.instanceId
      ) {
        return {
          ...incident.connection,
          source: {
            ...incident.connection.source,
            pointId: nextPointId,
          },
        };
      }

      return {
        ...incident.connection,
        target: {
          ...incident.connection.target,
          pointId: nextPointId,
        },
      };
    });

    const patch = emptyTopologyPatch();
    if (input.addedComponent) {
      patch.addComponents.push(input.addedComponent);
    }
    if (input.updatedComponent) {
      patch.updateComponents.push(input.updatedComponent);
    }
    patch.updateComponents.push({
      instanceId: connector.instanceId,
      updates: {
        componentId: resolution.connectorComponentId,
        rotation: resolution.rotation,
        properties: markConnectorAutoManaged(connector.properties),
      },
    });
    patch.updateConnections.push(...updatedConnections);
    patch.addConnections.push({
      id: input.idFactory('conn_upgrade'),
      source: {
        componentId: connector.instanceId,
        pointId: targetPointId,
      },
      target: {
        componentId: sourceInstanceId,
        pointId: input.sourcePointId,
      },
      type: 'socket',
      isActive: true,
    });
    patch.selectInstanceId = input.selectInstanceId;
    patch.nextEndpoint = input.nextEndpoint;
    return patch;
  }

  applyTopologyPatch(input: {
    components: ComponentInstance[];
    connections: Connection[];
    patch: TopologyPatch;
    normalizeAutoConnectors?: boolean;
  }): {
    components: ComponentInstance[];
    connections: Connection[];
  } {
    const removedComponentIds = new Set(input.patch.removeComponentIds);
    const updatesById = new Map(
      input.patch.updateComponents.map(update => [
        update.instanceId,
        update.updates,
      ])
    );
    const componentsById = new Map<string, ComponentInstance>();

    input.components.forEach(component => {
      if (removedComponentIds.has(component.instanceId)) return;
      componentsById.set(component.instanceId, {
        ...component,
        ...(updatesById.get(component.instanceId) ?? {}),
      });
    });
    input.patch.addComponents.forEach(component => {
      componentsById.set(component.instanceId, component);
    });

    const removedConnectionIds = new Set(input.patch.removeConnectionIds);
    const connectionUpdatesById = new Map(
      input.patch.updateConnections.map(connection => [
        connection.id,
        connection,
      ])
    );
    const connectionsById = new Map<string, Connection>();

    input.connections.forEach(connection => {
      if (removedConnectionIds.has(connection.id)) return;
      const updated = connectionUpdatesById.get(connection.id) ?? connection;
      if (
        removedComponentIds.has(updated.source.componentId) ||
        removedComponentIds.has(updated.target.componentId)
      ) {
        return;
      }
      connectionsById.set(updated.id, updated);
    });
    input.patch.addConnections.forEach(connection => {
      connectionsById.set(connection.id, connection);
    });

    let result = {
      components: [...componentsById.values()],
      connections: [...connectionsById.values()].filter(
        connection =>
          componentsById.has(connection.source.componentId) &&
          componentsById.has(connection.target.componentId)
      ),
    };

    if (input.normalizeAutoConnectors !== false) {
      result = this.normalizeAutoManagedTopology(result);
    }

    return result;
  }

  normalizeAutoManagedTopology(input: {
    components: ComponentInstance[];
    connections: Connection[];
  }): {
    components: ComponentInstance[];
    connections: Connection[];
  } {
    let components = input.components;
    let connections = input.connections;
    let changed = true;
    let pass = 0;

    while (changed && pass <= input.components.length) {
      changed = false;
      pass += 1;

      for (const connector of components) {
        if (!isAutoManagedConnector(connector)) continue;

        const incidents = getConnectorIncidents(connector, connections);
        if (incidents.length <= 1) {
          components = components.filter(
            component => component.instanceId !== connector.instanceId
          );
          connections = connections.filter(
            connection =>
              !connectionTouches(connection, connector.instanceId)
          );
          changed = true;
          break;
        }

        const resolution = this.resolveConnectorTopology({
          requiredDirections: incidents.map(incident => incident.direction),
          currentConnector: connector,
          incidents,
        });
        if (!resolution) continue;

        const needsComponentUpdate =
          connector.componentId !== resolution.connectorComponentId ||
          !sameRotation(connector.rotation, resolution.rotation);
        const needsConnectionUpdate = incidents.some(
          incident =>
            resolution.pointMapping[incident.connectorPointId] !==
            incident.connectorPointId
        );
        if (!needsComponentUpdate && !needsConnectionUpdate) continue;

        components = components.map(component =>
          component.instanceId === connector.instanceId
            ? {
                ...component,
                componentId: resolution.connectorComponentId,
                rotation: resolution.rotation,
              }
            : component
        );
        connections = connections.map(connection => {
          const incident = incidents.find(
            item => item.connection.id === connection.id
          );
          if (!incident) return connection;
          const nextPointId =
            resolution.pointMapping[incident.connectorPointId];
          if (!nextPointId) return connection;

          if (connection.source.componentId === connector.instanceId) {
            return {
              ...connection,
              source: { ...connection.source, pointId: nextPointId },
            };
          }
          return {
            ...connection,
            target: { ...connection.target, pointId: nextPointId },
          };
        });
        changed = true;
        break;
      }
    }

    return { components, connections };
  }
}

export const connectorTopologySystem = new ConnectorTopologySystem();

export const availableAutomaticConnectorDefinitions = () =>
  getComponentsByCategory('connector').filter(definition =>
    AUTOMATIC_CONNECTOR_IDS.includes(
      definition.id as (typeof AUTOMATIC_CONNECTOR_IDS)[number]
    )
  );
