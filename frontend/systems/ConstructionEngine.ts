import * as THREE from 'three';
import type { ComponentInstance, Connection, ConnectionPoint } from '../types';
import { getComponentById, isStructuralConnectionPoint } from '../stores/componentLibrary';
import {
  connectorDirectionKey,
  connectorTopologySystem,
  type ConnectorTopologyResolution,
  type VirtualConnectorPort,
} from './ConnectorTopologySystem';

export type ConstructionSnapType = 'connection' | 'alignment' | 'grid' | 'free';

export interface ConstructionPointRef {
  componentId: string;
  pointId: string;
  position: [number, number, number];
}

export interface ConstructionSuggestion {
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  snapType: ConstructionSnapType;
  confidence: number;
  message: string;
  sourcePointId?: string;
  target?: ConstructionPointRef;
  topologyTarget?: VirtualConnectorPort;
  connectorTarget?: {
    target: ConstructionPointRef;
    connectorComponentId: string;
    connectorPosition: [number, number, number];
    connectorRotation: [number, number, number];
    targetConnectorPointId: string;
    sourceConnectorPointId: string;
    resolution: ConnectorTopologyResolution;
  };
}

export interface ConstructionOptions {
  enableConnectionSnap?: boolean;
  enableAlignmentSnap?: boolean;
  enableGridSnap?: boolean;
  connectionSnapDistance?: number;
  alignmentSnapDistance?: number;
  gridSize?: number;
  excludeInstanceId?: string;
}

export interface ConstructionInput {
  componentId: string;
  draftPosition: [number, number, number];
  draftRotation?: [number, number, number];
  components: ComponentInstance[];
  connections: Connection[];
  options?: ConstructionOptions;
}

const DEFAULT_OPTIONS: Required<Omit<ConstructionOptions, 'excludeInstanceId'>> = {
  enableConnectionSnap: true,
  enableAlignmentSnap: true,
  enableGridSnap: true,
  connectionSnapDistance: 18,
  alignmentSnapDistance: 10,
  gridSize: 20,
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export const createConnectionId = () =>
  `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const getWorldPosition = (
  componentPosition: [number, number, number],
  componentRotation: [number, number, number],
  localPosition: [number, number, number]
): [number, number, number] => {
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler(
    toRadians(componentRotation[0]),
    toRadians(componentRotation[1]),
    toRadians(componentRotation[2]),
    'XYZ'
  );

  matrix.makeRotationFromEuler(euler);
  matrix.setPosition(componentPosition[0], componentPosition[1], componentPosition[2]);

  const position = new THREE.Vector3(...localPosition);
  position.applyMatrix4(matrix);
  return [position.x, position.y, position.z];
};

export const getWorldDirection = (
  componentRotation: [number, number, number],
  localDirection: [number, number, number]
): [number, number, number] => {
  const euler = new THREE.Euler(
    toRadians(componentRotation[0]),
    toRadians(componentRotation[1]),
    toRadians(componentRotation[2]),
    'XYZ'
  );
  const direction = new THREE.Vector3(...localDirection);
  direction.applyEuler(euler).normalize();
  return [direction.x, direction.y, direction.z];
};

const distanceBetween = (
  a: [number, number, number],
  b: [number, number, number]
): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const arePointsCompatible = (source: ConnectionPoint, target: ConnectionPoint) =>
  source.compatible.includes(target.type) || target.compatible.includes(source.type);

const isPointOccupied = (
  connections: Connection[],
  componentId: string,
  pointId: string,
  ignoredComponentId?: string
) =>
  connections.some((connection) => {
    const touchesIgnored =
      ignoredComponentId &&
      (connection.source.componentId === ignoredComponentId ||
        connection.target.componentId === ignoredComponentId);

    if (touchesIgnored) return false;

    return (
      (connection.source.componentId === componentId && connection.source.pointId === pointId) ||
      (connection.target.componentId === componentId && connection.target.pointId === pointId)
    );
  });

const alignSourceDirectionToTarget = (
  currentRotation: [number, number, number],
  sourceDirection: [number, number, number],
  targetDirection: [number, number, number]
): [number, number, number] => {
  const currentEuler = new THREE.Euler(
    toRadians(currentRotation[0]),
    toRadians(currentRotation[1]),
    toRadians(currentRotation[2]),
    'XYZ'
  );

  const currentQuaternion = new THREE.Quaternion().setFromEuler(currentEuler);
  const sourceWorldDirection = new THREE.Vector3(...sourceDirection)
    .applyQuaternion(currentQuaternion)
    .normalize();
  const targetOppositeDirection = new THREE.Vector3(...targetDirection).normalize().multiplyScalar(-1);

  if (sourceWorldDirection.lengthSq() === 0 || targetOppositeDirection.lengthSq() === 0) {
    return currentRotation;
  }

  const delta = new THREE.Quaternion().setFromUnitVectors(
    sourceWorldDirection,
    targetOppositeDirection
  );
  const nextQuaternion = delta.multiply(currentQuaternion);
  const nextEuler = new THREE.Euler().setFromQuaternion(nextQuaternion, 'XYZ');

  return [
    Math.round(toDegrees(nextEuler.x)),
    Math.round(toDegrees(nextEuler.y)),
    Math.round(toDegrees(nextEuler.z)),
  ];
};

const calculateSnappedPosition = (
  draftPosition: [number, number, number],
  rotation: [number, number, number],
  sourcePoint: ConnectionPoint,
  targetWorldPosition: [number, number, number]
): [number, number, number] => {
  const sourceWorldPosition = getWorldPosition(draftPosition, rotation, sourcePoint.position);

  return [
    draftPosition[0] + targetWorldPosition[0] - sourceWorldPosition[0],
    draftPosition[1] + targetWorldPosition[1] - sourceWorldPosition[1],
    draftPosition[2] + targetWorldPosition[2] - sourceWorldPosition[2],
  ];
};

const connectionExists = (
  connections: Connection[],
  sourceComponentId: string,
  sourcePointId: string,
  targetComponentId: string,
  targetPointId: string
) =>
  connections.some(
    (connection) =>
      (connection.source.componentId === sourceComponentId &&
        connection.source.pointId === sourcePointId &&
        connection.target.componentId === targetComponentId &&
        connection.target.pointId === targetPointId) ||
      (connection.source.componentId === targetComponentId &&
        connection.source.pointId === targetPointId &&
        connection.target.componentId === sourceComponentId &&
        connection.target.pointId === sourcePointId)
  );

class ConstructionEngine {
  suggest(input: ConstructionInput): ConstructionSuggestion {
    const options = { ...DEFAULT_OPTIONS, ...input.options };
    const draftRotation = input.draftRotation ?? [0, 0, 0];
    const definition = getComponentById(input.componentId);

    if (!definition) {
      return {
        componentId: input.componentId,
        position: input.draftPosition,
        rotation: draftRotation,
        snapType: 'free',
        confidence: 0,
        message: '未知组件，按当前位置放置',
      };
    }

    if (options.enableConnectionSnap) {
      const connectionSuggestion = this.findConnectionSuggestion(
        input,
        options,
        definition
      );
      if (connectionSuggestion) return connectionSuggestion;
    }

    if (options.enableAlignmentSnap) {
      const alignmentSuggestion = this.findAlignmentSuggestion(input, options);
      if (alignmentSuggestion) return alignmentSuggestion;
    }

    if (options.enableGridSnap) {
      return this.snapToGrid(input.componentId, input.draftPosition, draftRotation, options.gridSize);
    }

    return {
      componentId: input.componentId,
      position: input.draftPosition,
      rotation: draftRotation,
      snapType: 'free',
      confidence: 0,
      message: '自由放置',
    };
  }

  createConnectionForSuggestion(
    sourceInstanceId: string,
    suggestion: ConstructionSuggestion,
    existingConnections: Connection[]
  ): Connection | null {
    if (!suggestion.sourcePointId || !suggestion.target) return null;
    if (
      isPointOccupied(
        existingConnections,
        suggestion.target.componentId,
        suggestion.target.pointId
      ) ||
      isPointOccupied(
        existingConnections,
        sourceInstanceId,
        suggestion.sourcePointId
      )
    ) {
      return null;
    }

    if (
      connectionExists(
        existingConnections,
        sourceInstanceId,
        suggestion.sourcePointId,
        suggestion.target.componentId,
        suggestion.target.pointId
      )
    ) {
      return null;
    }

    return {
      id: createConnectionId(),
      source: {
        componentId: sourceInstanceId,
        pointId: suggestion.sourcePointId,
      },
      target: {
        componentId: suggestion.target.componentId,
        pointId: suggestion.target.pointId,
      },
      type: 'socket',
      isActive: true,
    };
  }

  private findConnectionSuggestion(
    input: ConstructionInput,
    options: Required<Omit<ConstructionOptions, 'excludeInstanceId'>> & Pick<ConstructionOptions, 'excludeInstanceId'>,
    sourceDefinition: NonNullable<ReturnType<typeof getComponentById>>
  ): ConstructionSuggestion | null {
    const sourcePoints = sourceDefinition.connectionPoints.filter(isStructuralConnectionPoint);
    let best: ConstructionSuggestion | null = null;
    let bestDistance = options.connectionSnapDistance;

    for (const targetComponent of input.components) {
      if (targetComponent.instanceId === options.excludeInstanceId) continue;

      const targetDefinition = getComponentById(targetComponent.componentId);
      if (!targetDefinition) continue;

      for (const targetPoint of targetDefinition.connectionPoints.filter(isStructuralConnectionPoint)) {
        if (
          isPointOccupied(
            input.connections,
            targetComponent.instanceId,
            targetPoint.id,
            options.excludeInstanceId
          )
        ) {
          continue;
        }

        const targetWorldPosition = getWorldPosition(
          targetComponent.position,
          targetComponent.rotation,
          targetPoint.position
        );
        const targetWorldDirection = getWorldDirection(targetComponent.rotation, targetPoint.direction);

        for (const sourcePoint of sourcePoints) {
          if (!arePointsCompatible(sourcePoint, targetPoint)) continue;

          const sourceWorldPosition = getWorldPosition(
            input.draftPosition,
            input.draftRotation ?? [0, 0, 0],
            sourcePoint.position
          );
          const distance = distanceBetween(sourceWorldPosition, targetWorldPosition);

          if (distance >= bestDistance) continue;

          const rotation = alignSourceDirectionToTarget(
            input.draftRotation ?? [0, 0, 0],
            sourcePoint.direction,
            targetWorldDirection
          );
          const position = calculateSnappedPosition(
            input.draftPosition,
            rotation,
            sourcePoint,
            targetWorldPosition
          );
          const connectorTarget =
            sourceDefinition.type === 'pipe' &&
            targetDefinition.category !== 'connector'
              ? this.createConnectorInsertionTarget({
                  sourceDefinition,
                  sourcePoint,
                  sourceRotation: rotation,
                  targetComponent,
                  targetPoint,
                  targetWorldPosition,
                  targetWorldDirection,
                })
              : null;
          if (
            sourceDefinition.type === 'pipe' &&
            targetDefinition.category !== 'connector' &&
            !connectorTarget
          ) {
            continue;
          }
          const snappedPosition = connectorTarget
            ? calculateSnappedPosition(
                position,
                rotation,
                sourcePoint,
                connectorTarget.sourceWorldPosition
              )
            : position;

          bestDistance = distance;
          best = {
            componentId: input.componentId,
            position: snappedPosition,
            rotation,
            snapType: 'connection',
            confidence: 1 - distance / options.connectionSnapDistance,
            sourcePointId: sourcePoint.id,
            target: connectorTarget
              ? undefined
              : {
                  componentId: targetComponent.instanceId,
                  pointId: targetPoint.id,
                  position: targetWorldPosition,
                },
            connectorTarget: connectorTarget
              ? connectorTarget.target
              : undefined,
            message: connectorTarget
              ? `将添加：${connectorTarget.target.resolution.connectorName}`
              : `可连接到 ${targetDefinition.name} 的 ${targetPoint.id}`,
          };
        }
      }
    }

    const topologyConnections = options.excludeInstanceId
      ? input.connections.filter(
          connection =>
            connection.source.componentId !== options.excludeInstanceId &&
            connection.target.componentId !== options.excludeInstanceId
        )
      : input.connections;
    const virtualPorts = connectorTopologySystem.listVirtualConnectorPorts({
      components: input.components,
      connections: topologyConnections,
      requireFull: false,
    });

    for (const virtualPort of virtualPorts) {
      if (virtualPort.connectorInstanceId === options.excludeInstanceId) {
        continue;
      }
      const replacementDefinition = getComponentById(
        virtualPort.replacement.connectorComponentId
      );
      const targetPoint = replacementDefinition?.connectionPoints.find(
        point => point.id === virtualPort.replacementPointId
      );
      if (!targetPoint) continue;

      for (const sourcePoint of sourcePoints) {
        if (!arePointsCompatible(sourcePoint, targetPoint)) continue;

        const sourceWorldPosition = getWorldPosition(
          input.draftPosition,
          input.draftRotation ?? [0, 0, 0],
          sourcePoint.position
        );
        const distance = distanceBetween(
          sourceWorldPosition,
          virtualPort.position
        );
        if (distance >= bestDistance) continue;

        const rotation = alignSourceDirectionToTarget(
          input.draftRotation ?? [0, 0, 0],
          sourcePoint.direction,
          virtualPort.direction
        );
        const position = calculateSnappedPosition(
          input.draftPosition,
          rotation,
          sourcePoint,
          virtualPort.position
        );

        bestDistance = distance;
        best = {
          componentId: input.componentId,
          position,
          rotation,
          snapType: 'connection',
          confidence: 1 - distance / options.connectionSnapDistance,
          sourcePointId: sourcePoint.id,
          topologyTarget: virtualPort,
          message: `将升级：${virtualPort.currentConnectorName}→${virtualPort.replacement.connectorName}`,
        };
      }
    }

    return best;
  }

  private createConnectorInsertionTarget(input: {
    sourceDefinition: NonNullable<ReturnType<typeof getComponentById>>;
    sourcePoint: ConnectionPoint;
    sourceRotation: [number, number, number];
    targetComponent: ComponentInstance;
    targetPoint: ConnectionPoint;
    targetWorldPosition: [number, number, number];
    targetWorldDirection: [number, number, number];
  }): {
    target: NonNullable<ConstructionSuggestion['connectorTarget']>;
    sourceWorldPosition: [number, number, number];
  } | null {
    const sourceFreePoint = input.sourceDefinition.connectionPoints.find(
      point => point.id !== input.sourcePoint.id && isStructuralConnectionPoint(point)
    );
    if (!sourceFreePoint) return null;

    const sourceOutputDirection = getWorldDirection(
      input.sourceRotation,
      sourceFreePoint.direction
    );
    const connectorAttachDirection = new THREE.Vector3(
      ...input.targetWorldDirection
    )
      .multiplyScalar(-1)
      .toArray() as [number, number, number];
    const resolution = connectorTopologySystem.resolveConnectorTopology({
      requiredDirections: [
        connectorAttachDirection,
        sourceOutputDirection,
      ],
    });
    if (!resolution) return null;

    const attachDirectionKey = connectorDirectionKey(
      connectorAttachDirection
    );
    const outputDirectionKey = connectorDirectionKey(sourceOutputDirection);
    const targetConnectorPointId = attachDirectionKey
      ? resolution.portsByDirection[attachDirectionKey]
      : null;
    const sourceConnectorPointId = outputDirectionKey
      ? resolution.portsByDirection[outputDirectionKey]
      : null;
    const connectorDefinition = getComponentById(
      resolution.connectorComponentId
    );
    const targetConnectorPoint = connectorDefinition?.connectionPoints.find(
      point => point.id === targetConnectorPointId
    );
    const sourceConnectorPoint = connectorDefinition?.connectionPoints.find(
      point => point.id === sourceConnectorPointId
    );
    if (
      !targetConnectorPointId ||
      !sourceConnectorPointId ||
      !targetConnectorPoint ||
      !sourceConnectorPoint ||
      targetConnectorPointId === sourceConnectorPointId
    ) {
      return null;
    }

    const rotatedTargetConnectorPoint = new THREE.Vector3(
      ...targetConnectorPoint.position
    ).applyEuler(
      new THREE.Euler(
        toRadians(resolution.rotation[0]),
        toRadians(resolution.rotation[1]),
        toRadians(resolution.rotation[2]),
        'XYZ'
      )
    );
    const connectorPosition: [number, number, number] = [
      input.targetWorldPosition[0] - rotatedTargetConnectorPoint.x,
      input.targetWorldPosition[1] - rotatedTargetConnectorPoint.y,
      input.targetWorldPosition[2] - rotatedTargetConnectorPoint.z,
    ];
    const sourceWorldPosition = getWorldPosition(
      connectorPosition,
      resolution.rotation,
      sourceConnectorPoint.position
    );

    return {
      sourceWorldPosition,
      target: {
        target: {
          componentId: input.targetComponent.instanceId,
          pointId: input.targetPoint.id,
          position: input.targetWorldPosition,
        },
        connectorComponentId: resolution.connectorComponentId,
        connectorPosition,
        connectorRotation: resolution.rotation,
        targetConnectorPointId,
        sourceConnectorPointId,
        resolution,
      },
    };
  }

  private findAlignmentSuggestion(
    input: ConstructionInput,
    options: Required<Omit<ConstructionOptions, 'excludeInstanceId'>> & Pick<ConstructionOptions, 'excludeInstanceId'>
  ): ConstructionSuggestion | null {
    let best: ConstructionSuggestion | null = null;
    let bestDistance = options.alignmentSnapDistance;

    for (const component of input.components) {
      if (component.instanceId === options.excludeInstanceId) continue;

      const axes: Array<{ axis: 0 | 1 | 2; label: string }> = [
        { axis: 0, label: 'X轴' },
        { axis: 1, label: '高度' },
        { axis: 2, label: 'Z轴' },
      ];

      for (const { axis, label } of axes) {
        const distance = Math.abs(input.draftPosition[axis] - component.position[axis]);
        if (distance >= bestDistance) continue;

        const position: [number, number, number] = [...input.draftPosition];
        position[axis] = component.position[axis];

        bestDistance = distance;
        best = {
          componentId: input.componentId,
          position,
          rotation: input.draftRotation ?? [0, 0, 0],
          snapType: 'alignment',
          confidence: 1 - distance / options.alignmentSnapDistance,
          message: `对齐到已有组件的${label}`,
        };
      }
    }

    return best;
  }

  private snapToGrid(
    componentId: string,
    position: [number, number, number],
    rotation: [number, number, number],
    gridSize: number
  ): ConstructionSuggestion {
    const snapped: [number, number, number] = [
      Math.round(position[0] / gridSize) * gridSize,
      Math.round(position[1] / gridSize) * gridSize,
      Math.round(position[2] / gridSize) * gridSize,
    ];

    return {
      componentId,
      position: snapped,
      rotation,
      snapType: 'grid',
      confidence: 0.35,
      message: '网格吸附',
    };
  }
}

export const constructionEngine = new ConstructionEngine();
