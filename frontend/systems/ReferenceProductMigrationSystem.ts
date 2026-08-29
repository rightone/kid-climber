import * as THREE from 'three';
import type { ComponentInstance, Connection, PipeColor } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { REFERENCE_PRODUCT_PROFILE_VERSION } from '../referenceProductSpec';
import {
  advancedStructureSystem,
  type AFrameModuleSize,
  type AFramePlane,
} from './AdvancedStructureSystem';

interface ReferenceProductMigrationInput {
  components: ComponentInstance[];
  connections: Connection[];
  productProfileVersion?: number;
}

export interface ReferenceProductMigrationResult {
  components: ComponentInstance[];
  connections: Connection[];
  productProfileVersion: number;
  migrated: boolean;
  warnings: string[];
}

export type ReferenceMigrationStatus =
  | 'migrated'
  | 'legacy-compatible'
  | 'legacy-placeholder'
  | 'needs-reconnection';

const LEGACY_CONNECTOR_45_COMPONENT_ID = 'connector_45deg_legacy_v1';
const LEGACY_PLACEHOLDER_ATTACHMENT_IDS = new Set([
  'swing',
  'slide',
  'rope_ladder',
]);

const LEGACY_COMPONENT_MAP: Readonly<Record<string, string>> = {
  pipe_45_20cm: 'pipe_15cm',
  pipe_45_40cm: 'pipe_35cm',
  pipe_arc_40cm: 'pipe_curve_u_40cm',
};

const rotationQuaternion = (rotation: ComponentInstance['rotation']) =>
  new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
      'XYZ'
    )
  );

const worldPoint = (
  component: Pick<ComponentInstance, 'position' | 'rotation'>,
  localPosition: [number, number, number]
) =>
  new THREE.Vector3(...localPosition)
    .applyQuaternion(rotationQuaternion(component.rotation))
    .add(new THREE.Vector3(...component.position));

const preserveFirstPortAnchor = (
  component: ComponentInstance,
  replacementComponentId: string
): ComponentInstance['position'] => {
  const legacyDefinition = getComponentById(component.componentId);
  const replacementDefinition = getComponentById(replacementComponentId);
  const legacyFirstPoint = legacyDefinition?.connectionPoints.find(point => point.id === 'start')
    ?? legacyDefinition?.connectionPoints[0];
  const replacementFirstPoint = replacementDefinition?.connectionPoints.find(point => point.id === 'start')
    ?? replacementDefinition?.connectionPoints[0];
  if (!legacyFirstPoint || !replacementFirstPoint) return component.position;

  const anchor = worldPoint(component, legacyFirstPoint.position);
  const replacementOffset = new THREE.Vector3(...replacementFirstPoint.position)
    .applyQuaternion(rotationQuaternion(component.rotation));
  return anchor.sub(replacementOffset).toArray() as ComponentInstance['position'];
};

const isPipeColor = (value: ComponentInstance['color']): value is PipeColor =>
  value === 'red' || value === 'yellow' || value === 'blue' || value === 'green';

const withMigrationProperties = (
  component: ComponentInstance,
  status: ReferenceMigrationStatus,
  details: Record<string, unknown> = {}
): ComponentInstance => ({
  ...component,
  properties: {
    ...component.properties,
    ...details,
    productProfileVersion: REFERENCE_PRODUCT_PROFILE_VERSION,
    referenceMigrationStatus: status,
  },
});

export const getReferenceMigrationWarning = (
  component: ComponentInstance
): string | null => {
  const warning = component.properties?.referenceMigrationWarning;
  return typeof warning === 'string' && warning.length > 0 ? warning : null;
};

const getLegacyAFrameGroups = (
  components: ComponentInstance[],
  includeVersionOneAFrames: boolean
) => {
  const groups = new Map<string, ComponentInstance[]>();
  components.forEach(component => {
    const structureKind = component.properties?.advancedStructure;
    const isLegacyTriangle = structureKind === 'right-triangle';
    const isVersionOneAFrame = includeVersionOneAFrames && structureKind === 'a-frame';
    if (!isLegacyTriangle && !isVersionOneAFrame) return;
    const groupId = component.properties?.assemblyGroupId;
    if (typeof groupId !== 'string' || groupId.length === 0) return;
    groups.set(groupId, [...(groups.get(groupId) ?? []), component]);
  });
  return groups;
};

const inferLegacyAFramePlane = (components: ComponentInstance[]): AFramePlane => {
  const xs = components.map(component => component.position[0]);
  const zs = components.map(component => component.position[2]);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const zRange = Math.max(...zs) - Math.min(...zs);
  return zRange > xRange ? 'vertical-z' : 'vertical-x';
};

const inferLegacyAFrameSize = (components: ComponentInstance[]): AFrameModuleSize =>
  components.some(component => component.componentId === 'pipe_45_40cm') ||
  components.filter(component => component.componentId === 'pipe_35cm').length >= 4
    ? 'large'
    : 'small';

const inferLegacyAFrameMirrored = (components: ComponentInstance[]) => {
  const storedValue = components
    .map(component => component.properties?.mirrored)
    .find(value => typeof value === 'boolean');
  return typeof storedValue === 'boolean' ? storedValue : false;
};

const legacyGroupAnchor = (components: ComponentInstance[]): [number, number, number] => {
  const xs = components.map(component => component.position[0]);
  const ys = components.map(component => component.position[1]);
  const zs = components.map(component => component.position[2]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    Math.min(...ys),
    (Math.min(...zs) + Math.max(...zs)) / 2,
  ];
};

const migrateLegacyAFrame = (
  groupId: string,
  legacyComponents: ComponentInstance[]
) => {
  let sequence = 0;
  let groupIdClaimed = false;
  const assembly = advancedStructureSystem.createAFrame({
    size: inferLegacyAFrameSize(legacyComponents),
    plane: inferLegacyAFramePlane(legacyComponents),
    mirrored: inferLegacyAFrameMirrored(legacyComponents),
    idFactory: prefix => {
      if (prefix === 'a_frame_group' && !groupIdClaimed) {
        groupIdClaimed = true;
        return groupId;
      }
      return `migrated_${groupId}_${prefix}_${sequence++}`;
    },
  });
  const anchor = legacyGroupAnchor(legacyComponents);
  const legacyPipes = legacyComponents
    .filter(component => component.componentId.startsWith('pipe_') && isPipeColor(component.color))
    .map(component => ({
      color: component.color as PipeColor,
      position: new THREE.Vector3(...component.position),
    }));
  const usedLegacyPipeIndexes = new Set<number>();
  const components = assembly.components.map(component => ({
    ...component,
    position: [
      component.position[0] + anchor[0],
      component.position[1] + anchor[1],
      component.position[2] + anchor[2],
    ] as [number, number, number],
    color: component.componentId.startsWith('pipe_')
      ? (() => {
          const worldPosition = new THREE.Vector3(
            component.position[0] + anchor[0],
            component.position[1] + anchor[1],
            component.position[2] + anchor[2]
          );
          const nearest = legacyPipes
            .map((pipe, index) => ({
              ...pipe,
              index,
              distance: pipe.position.distanceToSquared(worldPosition),
            }))
            .filter(pipe => !usedLegacyPipeIndexes.has(pipe.index))
            .sort((left, right) => left.distance - right.distance)[0];
          if (nearest) usedLegacyPipeIndexes.add(nearest.index);
          return nearest?.color ?? 'blue';
        })()
      : component.color,
    properties: {
      ...component.properties,
      assemblyGroupId: groupId,
      migratedFrom: legacyComponents.some(
        item => item.properties?.advancedStructure === 'right-triangle'
      ) ? 'right-triangle' : 'a-frame-v1',
      productProfileVersion: REFERENCE_PRODUCT_PROFILE_VERSION,
      referenceMigrationStatus: 'migrated' satisfies ReferenceMigrationStatus,
    },
  }));
  return { components, connections: assembly.connections };
};

const createBasis = (first: THREE.Vector3, second: THREE.Vector3) => {
  const x = first.clone().normalize();
  const y = second
    .clone()
    .addScaledVector(x, -second.dot(x))
    .normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
};

const solveDirectionPairRotation = (
  firstLocal: THREE.Vector3,
  secondLocal: THREE.Vector3,
  firstTarget: THREE.Vector3,
  secondTarget: THREE.Vector3
) => {
  const localDot = firstLocal.clone().normalize().dot(secondLocal.clone().normalize());
  const targetDot = firstTarget.clone().normalize().dot(secondTarget.clone().normalize());
  if (Math.abs(localDot - targetDot) > 1e-3 || Math.abs(localDot) > 0.999) {
    return null;
  }
  const localBasis = createBasis(firstLocal, secondLocal);
  const targetBasis = createBasis(firstTarget, secondTarget);
  return new THREE.Quaternion()
    .setFromRotationMatrix(targetBasis.multiply(localBasis.clone().invert()))
    .normalize();
};

const quaternionToRotation = (
  quaternion: THREE.Quaternion
): ComponentInstance['rotation'] => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [euler.x, euler.y, euler.z].map(value =>
    Number(THREE.MathUtils.radToDeg(value).toFixed(4))
  ) as ComponentInstance['rotation'];
};

const connectorPeer = (
  connection: Connection,
  connectorInstanceId: string
) => {
  if (connection.source.componentId === connectorInstanceId) {
    return {
      connectorPointId: connection.source.pointId,
      peer: connection.target,
    };
  }
  if (connection.target.componentId === connectorInstanceId) {
    return {
      connectorPointId: connection.target.pointId,
      peer: connection.source,
    };
  }
  return null;
};

const tryMigrateLegacy45Connector = (input: {
  component: ComponentInstance;
  componentsById: Map<string, ComponentInstance>;
  connections: Connection[];
}): ComponentInstance | null => {
  const replacementDefinition = getComponentById('connector_45deg');
  if (!replacementDefinition) return null;
  const replacementPoints = replacementDefinition.connectionPoints.filter(
    point => point.role !== 'board-mount'
  );
  const attached = input.connections
    .map(connection => connectorPeer(connection, input.component.instanceId))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map(item => {
      const connectorPoint = replacementPoints.find(
        point => point.id === item.connectorPointId
      );
      const peerComponent = input.componentsById.get(item.peer.componentId);
      const peerDefinition = peerComponent
        ? getComponentById(peerComponent.componentId)
        : undefined;
      const peerPoint = peerDefinition?.connectionPoints.find(
        point => point.id === item.peer.pointId
      );
      if (!connectorPoint || !peerComponent || !peerPoint) return null;
      return {
        connectorPoint,
        targetPosition: worldPoint(peerComponent, peerPoint.position),
        targetDirection: new THREE.Vector3(...peerPoint.direction)
          .applyQuaternion(rotationQuaternion(peerComponent.rotation))
          .normalize()
          .negate(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // One anchor leaves the connector twist undetermined. Keep the old hidden
  // definition instead of guessing a new free-port direction.
  if (attached.length !== 2) return null;
  const [first, second] = attached;
  if (first.connectorPoint.id === second.connectorPoint.id) return null;
  const quaternion = solveDirectionPairRotation(
    new THREE.Vector3(...first.connectorPoint.direction),
    new THREE.Vector3(...second.connectorPoint.direction),
    first.targetDirection,
    second.targetDirection
  );
  if (!quaternion) return null;

  const firstPosition = first.targetPosition.clone().sub(
    new THREE.Vector3(...first.connectorPoint.position).applyQuaternion(quaternion)
  );
  const secondPosition = second.targetPosition.clone().sub(
    new THREE.Vector3(...second.connectorPoint.position).applyQuaternion(quaternion)
  );
  if (firstPosition.distanceTo(secondPosition) > 0.5) return null;

  const candidate = withMigrationProperties(
    {
      ...input.component,
      componentId: 'connector_45deg',
      position: firstPosition.add(secondPosition).multiplyScalar(0.5).toArray() as ComponentInstance['position'],
      rotation: quaternionToRotation(quaternion),
    },
    'migrated',
    { migratedFrom: 'connector_45deg-v1' }
  );
  const candidateComponentsById = new Map(input.componentsById);
  candidateComponentsById.set(candidate.instanceId, candidate);
  return input.connections
    .filter(connection => connectorPeer(connection, candidate.instanceId) !== null)
    .every(connection => connectionIsGeometricallyValid(connection, candidateComponentsById))
    ? candidate
    : null;
};

const connectionEndpointsExist = (
  connection: Connection,
  componentsById: Map<string, ComponentInstance>
) => {
  const source = componentsById.get(connection.source.componentId);
  const target = componentsById.get(connection.target.componentId);
  const sourceDefinition = source ? getComponentById(source.componentId) : undefined;
  const targetDefinition = target ? getComponentById(target.componentId) : undefined;
  return Boolean(
    sourceDefinition?.connectionPoints.some(point => point.id === connection.source.pointId) &&
    targetDefinition?.connectionPoints.some(point => point.id === connection.target.pointId)
  );
};

const connectionIsGeometricallyValid = (
  connection: Connection,
  componentsById: Map<string, ComponentInstance>
) => {
  const source = componentsById.get(connection.source.componentId);
  const target = componentsById.get(connection.target.componentId);
  const sourceDefinition = source ? getComponentById(source.componentId) : undefined;
  const targetDefinition = target ? getComponentById(target.componentId) : undefined;
  const sourcePoint = sourceDefinition?.connectionPoints.find(
    point => point.id === connection.source.pointId
  );
  const targetPoint = targetDefinition?.connectionPoints.find(
    point => point.id === connection.target.pointId
  );
  if (!source || !target || !sourcePoint || !targetPoint) return false;

  const sourcePosition = worldPoint(source, sourcePoint.position);
  const targetPosition = worldPoint(target, targetPoint.position);
  const sourceDirection = new THREE.Vector3(...sourcePoint.direction)
    .applyQuaternion(rotationQuaternion(source.rotation))
    .normalize();
  const targetDirection = new THREE.Vector3(...targetPoint.direction)
    .applyQuaternion(rotationQuaternion(target.rotation))
    .normalize();
  return (
    sourcePosition.distanceTo(targetPosition) <= 0.5 &&
    sourceDirection.dot(targetDirection) <= -0.95
  );
};

const reconnectLegacyGroupExternalConnections = (input: {
  legacyComponentIds: Set<string>;
  migratedComponents: ComponentInstance[];
  migratedInternalConnections: Connection[];
  allLegacyComponentsById: Map<string, ComponentInstance>;
  allConnections: Connection[];
}) => {
  const occupiedEndpointKeys = new Set(
    input.migratedInternalConnections.flatMap(connection => [
      `${connection.source.componentId}:${connection.source.pointId}`,
      `${connection.target.componentId}:${connection.target.pointId}`,
    ])
  );
  const migratedById = new Map(
    input.migratedComponents.map(component => [component.instanceId, component])
  );
  const availableEndpoints = input.migratedComponents.flatMap(component => {
    const definition = getComponentById(component.componentId);
    if (!definition) return [];
    return definition.connectionPoints
      .filter(point => point.role !== 'board-mount')
      .filter(point => !occupiedEndpointKeys.has(`${component.instanceId}:${point.id}`))
      .map(point => ({ component, point }));
  });
  const externalConnections = input.allConnections.filter(connection => {
    const sourceInside = input.legacyComponentIds.has(connection.source.componentId);
    const targetInside = input.legacyComponentIds.has(connection.target.componentId);
    return sourceInside !== targetInside;
  });
  const reconnected: Connection[] = [];
  const failedConnectionIds: string[] = [];

  externalConnections.forEach(connection => {
    const sourceInside = input.legacyComponentIds.has(connection.source.componentId);
    const peerRef = sourceInside ? connection.target : connection.source;
    const peerComponent = input.allLegacyComponentsById.get(peerRef.componentId);
    const peerDefinition = peerComponent
      ? getComponentById(peerComponent.componentId)
      : undefined;
    const peerPoint = peerDefinition?.connectionPoints.find(
      point => point.id === peerRef.pointId
    );
    if (!peerComponent || !peerPoint || peerPoint.role === 'board-mount') {
      failedConnectionIds.push(connection.id);
      return;
    }
    const peerPosition = worldPoint(peerComponent, peerPoint.position);
    const peerDirection = new THREE.Vector3(...peerPoint.direction)
      .applyQuaternion(rotationQuaternion(peerComponent.rotation))
      .normalize();
    const match = availableEndpoints
      .filter(({ component, point }) =>
        !occupiedEndpointKeys.has(`${component.instanceId}:${point.id}`) &&
        (point.compatible.includes(peerPoint.type) || peerPoint.compatible.includes(point.type))
      )
      .map(({ component, point }) => {
        const position = worldPoint(component, point.position);
        const direction = new THREE.Vector3(...point.direction)
          .applyQuaternion(rotationQuaternion(component.rotation))
          .normalize();
        return {
          component,
          point,
          distance: position.distanceTo(peerPosition),
          directionDot: direction.dot(peerDirection),
        };
      })
      .filter(candidate => candidate.distance <= 0.5 && candidate.directionDot <= -0.95)
      .sort((left, right) => left.distance - right.distance)[0];
    if (!match) {
      failedConnectionIds.push(connection.id);
      return;
    }

    const migratedRef = {
      componentId: match.component.instanceId,
      pointId: match.point.id,
    };
    const migratedConnection: Connection = sourceInside
      ? { ...connection, source: migratedRef }
      : { ...connection, target: migratedRef };
    const validationComponents = new Map(input.allLegacyComponentsById);
    migratedById.forEach((component, instanceId) => {
      validationComponents.set(instanceId, component);
    });
    if (!connectionIsGeometricallyValid(migratedConnection, validationComponents)) {
      failedConnectionIds.push(connection.id);
      return;
    }
    occupiedEndpointKeys.add(`${match.component.instanceId}:${match.point.id}`);
    reconnected.push(migratedConnection);
  });

  return { reconnected, failedConnectionIds };
};

export const migrateReferenceProductData = (
  input: ReferenceProductMigrationInput
): ReferenceProductMigrationResult => {
  const sourceVersion = Number.isFinite(input.productProfileVersion)
    ? Math.max(0, input.productProfileVersion ?? 0)
    : 0;
  if (sourceVersion > REFERENCE_PRODUCT_PROFILE_VERSION) {
    return {
      components: input.components,
      connections: input.connections,
      productProfileVersion: sourceVersion,
      migrated: false,
      warnings: [
        `该设计使用产品规范 v${sourceVersion}，高于当前支持的 v${REFERENCE_PRODUCT_PROFILE_VERSION}；已按原数据只读载入，未执行降级迁移`,
      ],
    };
  }

  if (sourceVersion === REFERENCE_PRODUCT_PROFILE_VERSION) {
    return {
      components: input.components,
      connections: input.connections,
      productProfileVersion: REFERENCE_PRODUCT_PROFILE_VERSION,
      migrated: false,
      warnings: input.components
        .map(getReferenceMigrationWarning)
        .filter((warning): warning is string => warning !== null),
    };
  }

  const warnings: string[] = [];
  const shouldMigrateVersionOneTopology =
    REFERENCE_PRODUCT_PROFILE_VERSION >= 2 && sourceVersion < 2;
  const legacyGroups = getLegacyAFrameGroups(
    input.components,
    shouldMigrateVersionOneTopology
  );
  const groupedComponentIds = new Set(
    [...legacyGroups.values()].flatMap(group => group.map(component => component.instanceId))
  );
  const originalComponentsById = new Map(
    input.components.map(component => [component.instanceId, component])
  );
  const directlyMigratedComponentIds = new Set<string>();
  const migratedComponents = input.components
    .filter(component => !groupedComponentIds.has(component.instanceId))
    .map(component => {
      if (
        shouldMigrateVersionOneTopology &&
        component.componentId === 'connector_45deg'
      ) {
        directlyMigratedComponentIds.add(component.instanceId);
        const migratedConnector = tryMigrateLegacy45Connector({
          component,
          componentsById: originalComponentsById,
          connections: input.connections,
        });
        if (migratedConnector) {
          warnings.push(`${component.instanceId} 的旧45°接头已根据两端连接转换为新版拓扑`);
          return migratedConnector;
        }
        const warning = '旧45°接头缺少可唯一求解的双端锚点，已保留为隐藏兼容组件，请检查后重新连接';
        warnings.push(`${component.instanceId}：${warning}`);
        return withMigrationProperties(
          {
            ...component,
            componentId: LEGACY_CONNECTOR_45_COMPONENT_ID,
          },
          'legacy-compatible',
          {
            migratedFrom: 'connector_45deg-v1',
            referenceMigrationWarning: warning,
          }
        );
      }

      if (LEGACY_PLACEHOLDER_ATTACHMENT_IDS.has(component.componentId)) {
        const warning = `${component.componentId} 为旧版占位附件，仅保留读取和结构检查，不再用于新建设计`;
        warnings.push(`${component.instanceId}：${warning}`);
        return withMigrationProperties(component, 'legacy-placeholder', {
          legacyPlaceholderAttachment: true,
          referenceMigrationWarning: warning,
        });
      }

      const replacementId = LEGACY_COMPONENT_MAP[component.componentId];
      if (!replacementId) {
        return {
          ...component,
          properties: {
            ...component.properties,
            productProfileVersion: REFERENCE_PRODUCT_PROFILE_VERSION,
          },
        };
      }
      directlyMigratedComponentIds.add(component.instanceId);
      warnings.push(`${component.instanceId} 已由 ${component.componentId} 转换为 ${replacementId}`);
      return withMigrationProperties(
        {
          ...component,
          componentId: replacementId,
          position: preserveFirstPortAnchor(component, replacementId),
        },
        'migrated',
        { migratedFrom: component.componentId }
      );
    });

  const migratedConnections = input.connections.filter(connection =>
    !groupedComponentIds.has(connection.source.componentId) &&
    !groupedComponentIds.has(connection.target.componentId)
  );

  const needsReconnectionComponentIds = new Set<string>();
  legacyGroups.forEach((group, groupId) => {
    const migrated = migrateLegacyAFrame(groupId, group);
    migratedComponents.push(...migrated.components);
    migratedConnections.push(...migrated.connections);
    const legacyComponentIds = new Set(group.map(component => component.instanceId));
    const externalConnections = reconnectLegacyGroupExternalConnections({
      legacyComponentIds,
      migratedComponents: migrated.components,
      migratedInternalConnections: migrated.connections,
      allLegacyComponentsById: originalComponentsById,
      allConnections: input.connections,
    });
    migratedConnections.push(...externalConnections.reconnected);
    if (externalConnections.failedConnectionIds.length > 0) {
      migrated.components.forEach(component => {
        needsReconnectionComponentIds.add(component.instanceId);
      });
      externalConnections.failedConnectionIds.forEach(connectionId => {
        warnings.push(`A字架外部连接 ${connectionId} 无法按新版底脚端口安全保留，需要重新连接`);
      });
    }
    const migratedFrom = group.some(
      component => component.properties?.advancedStructure === 'right-triangle'
    ) ? '旧三角结构' : '旧版A字架';
    warnings.push(`${migratedFrom} ${groupId} 已转换为${inferLegacyAFrameSize(group) === 'large' ? '大型' : '小型'}A字架`);
  });

  const componentsById = new Map(
    migratedComponents.map(component => [component.instanceId, component])
  );
  const validConnections = migratedConnections.filter(connection => {
    const endpointsExist = connectionEndpointsExist(connection, componentsById);
    const touchesDirectMigration =
      directlyMigratedComponentIds.has(connection.source.componentId) ||
      directlyMigratedComponentIds.has(connection.target.componentId);
    const valid = endpointsExist && (
      !touchesDirectMigration || connectionIsGeometricallyValid(connection, componentsById)
    );
    if (!valid) {
      if (directlyMigratedComponentIds.has(connection.source.componentId)) {
        needsReconnectionComponentIds.add(connection.source.componentId);
      }
      if (directlyMigratedComponentIds.has(connection.target.componentId)) {
        needsReconnectionComponentIds.add(connection.target.componentId);
      }
      warnings.push(`连接 ${connection.id} 在产品迁移后需要重新连接，已移除`);
    }
    return valid;
  });

  const auditedComponents = migratedComponents.map(component => {
    if (!needsReconnectionComponentIds.has(component.instanceId)) return component;
    const warning = '产品规范迁移后原连接无法安全保留，需要重新连接';
    return withMigrationProperties(component, 'needs-reconnection', {
      referenceMigrationWarning: warning,
    });
  });

  return {
    components: auditedComponents,
    connections: validConnections,
    productProfileVersion: REFERENCE_PRODUCT_PROFILE_VERSION,
    migrated: true,
    warnings,
  };
};
