import * as THREE from 'three';
import type { ComponentInstance, Connection, ConnectionPoint } from '../types';
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
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../referenceProductSpec';

type Vec3 = [number, number, number];

export const U_CURVED_TUBE_COMPONENT_ID = 'pipe_curve_u_40cm';

export interface CurvedTubeMountEndpoint {
  curvePointId: string;
  targetInstanceId: string;
  targetPointId: string;
  position: Vec3;
  direction: Vec3;
  virtualConnectorPort?: VirtualConnectorPort;
}

export interface CurvedTubeMountSite {
  id: string;
  componentId: typeof U_CURVED_TUBE_COMPONENT_ID;
  position: Vec3;
  rotation: Vec3;
  flip: boolean;
  endpoints: [CurvedTubeMountEndpoint, CurvedTubeMountEndpoint];
  bounds: {
    center: Vec3;
    size: Vec3;
  };
}

interface WorldEndpoint {
  componentId: string;
  pointId: string;
  point: ConnectionPoint;
  position: Vec3;
  direction: Vec3;
  virtualConnectorPort?: VirtualConnectorPort;
}

interface CurvedTubeMountInput {
  components: ComponentInstance[];
  connections: Connection[];
  excludeInstanceId?: string;
}

const SPAN_CM = REFERENCE_PRODUCT_PROFILE_V1.modulePitches[2];
const DISTANCE_TOLERANCE_CM = 0.5;
const DIRECTION_DOT_TOLERANCE = 0.995;
const POSITION_TOLERANCE_CM = 0.5;
const HIT_RADIUS_CM = 18;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const distance = (left: Vec3, right: Vec3) =>
  Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);

const normalize = (value: Vec3) =>
  new THREE.Vector3(...value).normalize();

const arePointsCompatible = (left: ConnectionPoint, right: ConnectionPoint) =>
  left.compatible.includes(right.type) || right.compatible.includes(left.type);

const isPointOccupied = (
  connections: Connection[],
  componentId: string,
  pointId: string,
  ignoredComponentId?: string
) =>
  connections.some(connection => {
    const touchesIgnored =
      ignoredComponentId &&
      (
        connection.source.componentId === ignoredComponentId ||
        connection.target.componentId === ignoredComponentId
      );
    if (touchesIgnored) return false;

    return (
      (
        connection.source.componentId === componentId &&
        connection.source.pointId === pointId
      ) ||
      (
        connection.target.componentId === componentId &&
        connection.target.pointId === pointId
      )
    );
  });

const rotationQuaternion = (rotation: Vec3) =>
  new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
      'XYZ'
    )
  );

const roundedRotationFromQuaternion = (quaternion: THREE.Quaternion): Vec3 => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    Math.round(toDegrees(euler.x) * 1000) / 1000,
    Math.round(toDegrees(euler.y) * 1000) / 1000,
    Math.round(toDegrees(euler.z) * 1000) / 1000,
  ];
};

const createBasis = (
  span: THREE.Vector3,
  portDirection: THREE.Vector3
) => {
  const xAxis = span.clone().normalize();
  const zAxis = portDirection.clone().normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  if (xAxis.lengthSq() === 0 || yAxis.lengthSq() === 0 || zAxis.lengthSq() === 0) {
    return null;
  }
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
};

const rotationForEndpointPair = (input: {
  firstLocalPoint: ConnectionPoint;
  secondLocalPoint: ConnectionPoint;
  firstTarget: WorldEndpoint;
  secondTarget: WorldEndpoint;
}): Vec3 | null => {
  const localSpan = new THREE.Vector3(...input.secondLocalPoint.position)
    .sub(new THREE.Vector3(...input.firstLocalPoint.position));
  const localDirection = new THREE.Vector3(...input.firstLocalPoint.direction);
  const targetSpan = new THREE.Vector3(...input.secondTarget.position)
    .sub(new THREE.Vector3(...input.firstTarget.position));
  const targetDirection = new THREE.Vector3(...input.firstTarget.direction)
    .multiplyScalar(-1);

  const localBasis = createBasis(localSpan, localDirection);
  const targetBasis = createBasis(targetSpan, targetDirection);
  if (!localBasis || !targetBasis) return null;

  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    targetBasis.multiply(localBasis.clone().invert())
  );
  const rotation = roundedRotationFromQuaternion(quaternion);
  const rotatedSecondDirection = normalize(
    new THREE.Vector3(...input.secondLocalPoint.direction)
      .applyQuaternion(rotationQuaternion(rotation))
      .toArray() as Vec3
  );
  if (rotatedSecondDirection.dot(normalize(input.secondTarget.direction).multiplyScalar(-1)) < DIRECTION_DOT_TOLERANCE) {
    return null;
  }
  return rotation;
};

const calculateComponentPosition = (
  targetPosition: Vec3,
  rotation: Vec3,
  localPosition: Vec3
): Vec3 => {
  const rotatedLocal = new THREE.Vector3(...localPosition).applyQuaternion(
    rotationQuaternion(rotation)
  );
  return [
    targetPosition[0] - rotatedLocal.x,
    targetPosition[1] - rotatedLocal.y,
    targetPosition[2] - rotatedLocal.z,
  ];
};

const collectAvailableEndpoints = (
  input: CurvedTubeMountInput,
  curvePoints: ConnectionPoint[]
): WorldEndpoint[] => {
  const endpoints: WorldEndpoint[] = [];

  input.components.forEach(component => {
    if (component.instanceId === input.excludeInstanceId) return;
    const definition = getComponentById(component.componentId);
    if (!definition) return;

    definition.connectionPoints
      .filter(isStructuralConnectionPoint)
      .forEach(point => {
        if (
          isPointOccupied(
            input.connections,
            component.instanceId,
            point.id,
            input.excludeInstanceId
          )
        ) {
          return;
        }
        if (!curvePoints.some(curvePoint => arePointsCompatible(curvePoint, point))) {
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

  return endpoints.sort((left, right) =>
    left.componentId.localeCompare(right.componentId) ||
    left.pointId.localeCompare(right.pointId)
  );
};

const collectVirtualEndpoints = (
  input: CurvedTubeMountInput,
  curvePoints: ConnectionPoint[]
): WorldEndpoint[] =>
  connectorTopologySystem
    .listVirtualConnectorPorts({
      components: input.components.filter(
        component => component.instanceId !== input.excludeInstanceId
      ),
      connections: input.connections.filter(connection =>
        connection.source.componentId !== input.excludeInstanceId &&
        connection.target.componentId !== input.excludeInstanceId
      ),
      requireFull: false,
    })
    .filter(() => curvePoints.some(point => point.compatible.includes('socket')))
    .map(port => ({
      componentId: port.connectorInstanceId,
      pointId: port.replacementPointId,
      point: {
        id: port.replacementPointId,
        position: [0, 0, 0],
        direction: port.direction,
        type: 'socket',
        compatible: ['socket'],
        role: 'structural',
      },
      position: port.position,
      direction: port.direction,
      virtualConnectorPort: port,
    }));

const mergePatch = (left: TopologyPatch, right: TopologyPatch): TopologyPatch => ({
  addComponents: [...left.addComponents, ...right.addComponents],
  updateComponents: [...left.updateComponents, ...right.updateComponents],
  removeComponentIds: [...new Set([...left.removeComponentIds, ...right.removeComponentIds])],
  addConnections: [...left.addConnections, ...right.addConnections],
  updateConnections: [...left.updateConnections, ...right.updateConnections],
  removeConnectionIds: [...new Set([...left.removeConnectionIds, ...right.removeConnectionIds])],
  selectInstanceId: right.selectInstanceId ?? left.selectInstanceId,
  nextEndpoint: right.nextEndpoint ?? left.nextEndpoint,
});

class CurvedTubeMountSystem {
  isCurvedTubeComponentId(componentId: string): componentId is typeof U_CURVED_TUBE_COMPONENT_ID {
    return componentId === U_CURVED_TUBE_COMPONENT_ID;
  }

  listCurvedTubeMountSites(input: CurvedTubeMountInput): CurvedTubeMountSite[] {
    const definition = getComponentById(U_CURVED_TUBE_COMPONENT_ID);
    const curvePoints = definition?.connectionPoints.filter(isStructuralConnectionPoint) ?? [];
    if (curvePoints.length !== 2) return [];

    const endpoints = [
      ...collectAvailableEndpoints(input, curvePoints),
      ...collectVirtualEndpoints(input, curvePoints),
    ].sort((left, right) =>
      left.componentId.localeCompare(right.componentId) ||
      left.pointId.localeCompare(right.pointId) ||
      Number(Boolean(left.virtualConnectorPort)) - Number(Boolean(right.virtualConnectorPort))
    );
    const sites: CurvedTubeMountSite[] = [];
    const seen = new Set<string>();

    endpoints.forEach((firstTarget, firstIndex) => {
      endpoints.slice(firstIndex + 1).forEach(secondTarget => {
        const targetDistance = distance(firstTarget.position, secondTarget.position);
        if (Math.abs(targetDistance - SPAN_CM) > DISTANCE_TOLERANCE_CM) return;

        const firstDirection = normalize(firstTarget.direction);
        const secondDirection = normalize(secondTarget.direction);
        if (firstDirection.dot(secondDirection) < DIRECTION_DOT_TOLERANCE) return;

        const spanDirection = new THREE.Vector3(...secondTarget.position)
          .sub(new THREE.Vector3(...firstTarget.position))
          .normalize();
        if (Math.abs(spanDirection.dot(firstDirection)) > 1 - DIRECTION_DOT_TOLERANCE) {
          return;
        }

        const mappings = [
          {
            firstCurvePoint: curvePoints[0],
            secondCurvePoint: curvePoints[1],
            firstTarget,
            secondTarget,
            flip: false,
          },
          {
            firstCurvePoint: curvePoints[1],
            secondCurvePoint: curvePoints[0],
            firstTarget,
            secondTarget,
            flip: true,
          },
        ];

        mappings.forEach(mapping => {
          if (
            !arePointsCompatible(mapping.firstCurvePoint, mapping.firstTarget.point) ||
            !arePointsCompatible(mapping.secondCurvePoint, mapping.secondTarget.point)
          ) {
            return;
          }

          const rotation = rotationForEndpointPair({
            firstLocalPoint: mapping.firstCurvePoint,
            secondLocalPoint: mapping.secondCurvePoint,
            firstTarget: mapping.firstTarget,
            secondTarget: mapping.secondTarget,
          });
          if (!rotation) return;

          const position = calculateComponentPosition(
            mapping.firstTarget.position,
            rotation,
            mapping.firstCurvePoint.position
          );
          const resolvedFirstPosition = getWorldPosition(
            position,
            rotation,
            mapping.firstCurvePoint.position
          );
          const resolvedSecondPosition = getWorldPosition(
            position,
            rotation,
            mapping.secondCurvePoint.position
          );
          if (
            distance(resolvedFirstPosition, mapping.firstTarget.position) > POSITION_TOLERANCE_CM ||
            distance(resolvedSecondPosition, mapping.secondTarget.position) > POSITION_TOLERANCE_CM
          ) {
            return;
          }

          const id = [
            U_CURVED_TUBE_COMPONENT_ID,
            mapping.firstTarget.componentId,
            mapping.firstTarget.pointId,
            mapping.secondTarget.componentId,
            mapping.secondTarget.pointId,
            mapping.firstCurvePoint.id,
            mapping.secondCurvePoint.id,
          ].join(':');
          if (seen.has(id)) return;
          seen.add(id);
          sites.push({
            id,
            componentId: U_CURVED_TUBE_COMPONENT_ID,
            position,
            rotation,
            flip: mapping.flip,
            endpoints: [
              {
                curvePointId: mapping.firstCurvePoint.id,
                targetInstanceId: mapping.firstTarget.componentId,
                targetPointId: mapping.firstTarget.pointId,
                position: mapping.firstTarget.position,
                direction: mapping.firstTarget.direction,
                virtualConnectorPort: mapping.firstTarget.virtualConnectorPort,
              },
              {
                curvePointId: mapping.secondCurvePoint.id,
                targetInstanceId: mapping.secondTarget.componentId,
                targetPointId: mapping.secondTarget.pointId,
                position: mapping.secondTarget.position,
                direction: mapping.secondTarget.direction,
                virtualConnectorPort: mapping.secondTarget.virtualConnectorPort,
              },
            ],
            bounds: {
              center: [
                (mapping.firstTarget.position[0] + mapping.secondTarget.position[0]) / 2,
                (mapping.firstTarget.position[1] + mapping.secondTarget.position[1]) / 2,
                (mapping.firstTarget.position[2] + mapping.secondTarget.position[2]) / 2,
              ],
              size: [
                Math.max(6, Math.abs(mapping.firstTarget.position[0] - mapping.secondTarget.position[0]) + 6),
                Math.max(6, Math.abs(mapping.firstTarget.position[1] - mapping.secondTarget.position[1]) + 6),
                Math.max(6, Math.abs(mapping.firstTarget.position[2] - mapping.secondTarget.position[2]) + 6),
              ],
            },
          });
        });
      });
    });

    return sites.sort((left, right) =>
      left.position[1] - right.position[1] ||
      left.position[0] - right.position[0] ||
      left.position[2] - right.position[2] ||
      Number(left.flip) - Number(right.flip)
    );
  }

  findNearestCurvedTubeMountSiteByRay(input: CurvedTubeMountInput & {
    rayOrigin: Vec3;
    rayDirection: Vec3;
    flip?: boolean;
  }): CurvedTubeMountSite | null {
    const sites = this.listCurvedTubeMountSites(input).filter(
      site => input.flip === undefined || site.flip === input.flip
    );
    return sites
      .map(site => {
        const rayOrigin = new THREE.Vector3(...input.rayOrigin);
        const rayDirection = new THREE.Vector3(...input.rayDirection).normalize();
        const center = new THREE.Vector3(...site.bounds.center);
        const toCenter = center.sub(rayOrigin);
        const rayDistance = toCenter.dot(rayDirection);
        if (rayDistance < 0) {
          return { site, distance: Number.POSITIVE_INFINITY };
        }
        const closestPoint = rayOrigin.add(rayDirection.multiplyScalar(rayDistance));
        return {
          site,
          distance: closestPoint.distanceTo(new THREE.Vector3(...site.bounds.center)),
        };
      })
      .filter(item => item.distance <= HIT_RADIUS_CM)
      .sort((left, right) => left.distance - right.distance)[0]?.site ?? null;
  }

  createCurvedTubePlacementPatch(input: {
    site: CurvedTubeMountSite;
    instanceId?: string;
    idFactory: (prefix: string) => string;
    components: ComponentInstance[];
    connections: Connection[];
  }): TopologyPatch | null {
    const existingComponent = input.instanceId
      ? input.components.find(component => component.instanceId === input.instanceId)
      : undefined;
    const instanceId = existingComponent?.instanceId ?? input.instanceId ?? input.idFactory('curve');
    const removeConnectionIds = existingComponent
      ? input.connections
          .filter(connection =>
            connection.source.componentId === instanceId ||
            connection.target.componentId === instanceId
          )
          .map(connection => connection.id)
      : [];

    const component: ComponentInstance = {
      instanceId,
      componentId: U_CURVED_TUBE_COMPONENT_ID,
      position: input.site.position,
      rotation: input.site.rotation,
      scale: [1, 1, 1],
      color: existingComponent?.color,
      properties: {
        ...(existingComponent?.properties ?? {}),
        curvedTubeMountFlip: input.site.flip,
      },
    };

    let patch: TopologyPatch = {
      addComponents: existingComponent ? [] : [component],
      updateComponents: existingComponent
        ? [{
            instanceId,
            updates: {
              position: input.site.position,
              rotation: input.site.rotation,
              properties: component.properties,
            },
          }]
        : [],
      removeComponentIds: [],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds: [...new Set(removeConnectionIds)],
      selectInstanceId: instanceId,
    };

    let projected = connectorTopologySystem.applyTopologyPatch({
      components: input.components,
      connections: input.connections,
      patch,
      normalizeAutoConnectors: false,
    });

    for (const [index, endpoint] of input.site.endpoints.entries()) {
      let endpointPatch: TopologyPatch | null;
      if (endpoint.virtualConnectorPort) {
        endpointPatch = connectorTopologySystem.createConnectorUpgradePatch({
          connectorInstanceId: endpoint.virtualConnectorPort.connectorInstanceId,
          desiredDirection: endpoint.virtualConnectorPort.direction,
          updatedComponent: { instanceId, updates: {} },
          sourcePointId: endpoint.curvePointId,
          components: projected.components,
          connections: projected.connections,
          idFactory: input.idFactory,
          selectInstanceId: instanceId,
        });
      } else {
        endpointPatch = {
          addComponents: [],
          updateComponents: [],
          removeComponentIds: [],
          addConnections: [{
            id: `${input.idFactory('curve_conn')}_${index + 1}`,
            source: {
              componentId: endpoint.targetInstanceId,
              pointId: endpoint.targetPointId,
            },
            target: {
              componentId: instanceId,
              pointId: endpoint.curvePointId,
            },
            type: 'socket',
            isActive: true,
          }],
          updateConnections: [],
          removeConnectionIds: [],
        };
      }
      if (!endpointPatch) return null;
      patch = mergePatch(patch, endpointPatch);
      projected = connectorTopologySystem.applyTopologyPatch({
        components: projected.components,
        connections: projected.connections,
        patch: endpointPatch,
        normalizeAutoConnectors: false,
      });
    }

    const curveConnections = projected.connections.filter(connection =>
      connection.source.componentId === instanceId ||
      connection.target.componentId === instanceId
    );
    return curveConnections.length === 2 ? patch : null;
  }
}

export const curvedTubeMountSystem = new CurvedTubeMountSystem();
