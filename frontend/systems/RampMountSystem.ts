import * as THREE from 'three';
import type {
  ComponentInstance,
  Connection,
  ConnectionPoint,
} from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { getWorldPosition } from './ConstructionEngine';
import type { TopologyPatch } from './ConnectorTopologySystem';

type Vec3 = [number, number, number];

export type RampComponentId = 'ramp_45cm' | 'ramp_85cm';

export interface RampProductSpec {
  componentId: RampComponentId;
  nominalLengthCm: 45 | 85;
  widthCm: 40;
  riseCm: 20 | 40;
  horizontalRunCm: number;
}

export const RAMP_PRODUCT_SPECS: Readonly<Record<RampComponentId, RampProductSpec>> = {
  ramp_45cm: {
    componentId: 'ramp_45cm',
    nominalLengthCm: 45,
    widthCm: 40,
    riseCm: 20,
    horizontalRunCm: Number(Math.sqrt(45 ** 2 - 20 ** 2).toFixed(3)),
  },
  ramp_85cm: {
    componentId: 'ramp_85cm',
    nominalLengthCm: 85,
    widthCm: 40,
    riseCm: 40,
    horizontalRunCm: Number(Math.sqrt(85 ** 2 - 40 ** 2).toFixed(3)),
  },
};

export interface RampMountEndpoint {
  rampPointId: 'top_left' | 'top_right';
  targetInstanceId: string;
  targetPointId: string;
  position: Vec3;
}

export interface RampMountSite {
  id: string;
  componentId: RampComponentId;
  position: Vec3;
  rotation: Vec3;
  endpoints: [RampMountEndpoint, RampMountEndpoint];
  groundHeight: number;
  bounds: {
    center: Vec3;
    size: Vec3;
  };
}

interface RampMountInput {
  componentId: RampComponentId;
  components: ComponentInstance[];
  connections: Connection[];
  excludeInstanceId?: string;
  groundHeight?: number;
}

interface WorldMountPoint {
  componentId: string;
  pointId: string;
  point: ConnectionPoint;
  position: Vec3;
}

const ANCHOR_SPAN_CM = 40;
const POSITION_TOLERANCE_CM = 0.5;
const GROUND_TOLERANCE_CM = 0.6;
const HORIZONTAL_TOLERANCE_CM = 0.5;
const HIT_RADIUS_CM = 22;

const roundedVector = (vector: THREE.Vector3): Vec3 => [
  Number(vector.x.toFixed(4)),
  Number(vector.y.toFixed(4)),
  Number(vector.z.toFixed(4)),
];

const rotationQuaternion = (rotation: Vec3) =>
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
  Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);

const pointConnectionCount = (
  connections: Connection[],
  componentId: string,
  pointId: string,
  excludeInstanceId?: string
) =>
  connections.filter(connection => {
    if (
      excludeInstanceId &&
      (
        connection.source.componentId === excludeInstanceId ||
        connection.target.componentId === excludeInstanceId
      )
    ) {
      return false;
    }
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
  }).length;

const collectAvailableMountPoints = (input: RampMountInput): WorldMountPoint[] => {
  const mountPoints: WorldMountPoint[] = [];
  input.components.forEach(component => {
    if (component.instanceId === input.excludeInstanceId) return;
    const definition = getComponentById(component.componentId);
    if (definition?.category !== 'connector') return;
    definition.connectionPoints
      .filter(point => point.role === 'board-mount')
      .forEach(point => {
        const capacity = Math.max(1, point.capacity ?? 1);
        if (
          pointConnectionCount(
            input.connections,
            component.instanceId,
            point.id,
            input.excludeInstanceId
          ) >= capacity
        ) {
          return;
        }
        mountPoints.push({
          componentId: component.instanceId,
          pointId: point.id,
          point,
          position: getWorldPosition(
            component.position,
            component.rotation,
            point.position
          ),
        });
      });
  });
  return mountPoints.sort((left, right) =>
    left.componentId.localeCompare(right.componentId) ||
    left.pointId.localeCompare(right.pointId)
  );
};

const rampMountPoints = (componentId: RampComponentId) => {
  const definition = getComponentById(componentId);
  const topLeft = definition?.connectionPoints.find(point => point.id === 'top_left');
  const topRight = definition?.connectionPoints.find(point => point.id === 'top_right');
  return topLeft && topRight ? [topLeft, topRight] as const : null;
};

const solveSiteTransform = (input: {
  firstLocalPoint: ConnectionPoint;
  secondLocalPoint: ConnectionPoint;
  firstTarget: WorldMountPoint;
  secondTarget: WorldMountPoint;
  spec: RampProductSpec;
  groundHeight: number;
  side: -1 | 1;
}): { position: Vec3; rotation: Vec3 } | null => {
  const firstTargetPosition = new THREE.Vector3(...input.firstTarget.position);
  const secondTargetPosition = new THREE.Vector3(...input.secondTarget.position);
  const xAxis = secondTargetPosition.clone().sub(firstTargetPosition).normalize();
  if (Math.abs(xAxis.y) > 0.02) return null;

  const horizontalOutward = new THREE.Vector3(-xAxis.z, 0, xAxis.x)
    .multiplyScalar(input.side)
    .normalize();
  const zAxis = horizontalOutward
    .multiplyScalar(input.spec.horizontalRunCm)
    .add(new THREE.Vector3(0, -input.spec.riseCm, 0))
    .normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  if (yAxis.lengthSq() === 0) return null;

  const rotationMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
  const rotation = quaternionToRotation(quaternion);
  const firstLocal = new THREE.Vector3(...input.firstLocalPoint.position)
    .applyQuaternion(rotationQuaternion(rotation));
  const positionVector = firstTargetPosition.clone().sub(firstLocal);
  const secondWorld = new THREE.Vector3(...input.secondLocalPoint.position)
    .applyQuaternion(rotationQuaternion(rotation))
    .add(positionVector);
  if (secondWorld.distanceTo(secondTargetPosition) > POSITION_TOLERANCE_CM) {
    return null;
  }

  const lowerCenter = new THREE.Vector3(0, 0, input.spec.nominalLengthCm / 2)
    .applyQuaternion(rotationQuaternion(rotation))
    .add(positionVector);
  if (Math.abs(lowerCenter.y - input.groundHeight) > GROUND_TOLERANCE_CM) {
    return null;
  }

  return {
    position: roundedVector(positionVector),
    rotation,
  };
};

const calculateBounds = (
  spec: RampProductSpec,
  position: Vec3,
  rotation: Vec3
): RampMountSite['bounds'] => {
  const box = new THREE.Box3();
  const rotationQ = rotationQuaternion(rotation);
  [-spec.widthCm / 2, spec.widthCm / 2].forEach(x => {
    [-spec.nominalLengthCm / 2, spec.nominalLengthCm / 2].forEach(z => {
      box.expandByPoint(
        new THREE.Vector3(x, 0, z)
          .applyQuaternion(rotationQ)
          .add(new THREE.Vector3(...position))
      );
    });
  });
  box.expandByScalar(3);
  return {
    center: roundedVector(box.getCenter(new THREE.Vector3())),
    size: roundedVector(box.getSize(new THREE.Vector3())),
  };
};

class RampMountSystem {
  isRampComponentId(componentId: string): componentId is RampComponentId {
    return componentId === 'ramp_45cm' || componentId === 'ramp_85cm';
  }

  getProductSpec(componentId: RampComponentId): RampProductSpec {
    return RAMP_PRODUCT_SPECS[componentId];
  }

  listRampMountSites(input: RampMountInput): RampMountSite[] {
    const localPoints = rampMountPoints(input.componentId);
    if (!localPoints) return [];
    const spec = this.getProductSpec(input.componentId);
    const groundHeight = input.groundHeight ?? 0;
    const targets = collectAvailableMountPoints(input);
    const sites: RampMountSite[] = [];
    const seen = new Set<string>();

    targets.forEach((firstTarget, firstIndex) => {
      targets.slice(firstIndex + 1).forEach(secondTarget => {
        if (
          Math.abs(firstTarget.position[1] - secondTarget.position[1]) >
            HORIZONTAL_TOLERANCE_CM ||
          Math.abs(distance(firstTarget.position, secondTarget.position) - ANCHOR_SPAN_CM) >
            POSITION_TOLERANCE_CM
        ) {
          return;
        }

        const leftTarget = firstTarget;
        const rightTarget = secondTarget;
        ([-1, 1] as const).forEach(side => {
            const transform = solveSiteTransform({
              firstLocalPoint: localPoints[0],
              secondLocalPoint: localPoints[1],
              firstTarget: leftTarget,
              secondTarget: rightTarget,
              spec,
              groundHeight,
              side,
            });
            if (!transform) return;

            const id = [
              input.componentId,
              leftTarget.componentId,
              rightTarget.componentId,
              transform.position.map(value => value.toFixed(2)).join(','),
            ].join(':');
            if (seen.has(id)) return;
            seen.add(id);
            sites.push({
              id,
              componentId: input.componentId,
              position: transform.position,
              rotation: transform.rotation,
              endpoints: [
                {
                  rampPointId: 'top_left',
                  targetInstanceId: leftTarget.componentId,
                  targetPointId: leftTarget.pointId,
                  position: leftTarget.position,
                },
                {
                  rampPointId: 'top_right',
                  targetInstanceId: rightTarget.componentId,
                  targetPointId: rightTarget.pointId,
                  position: rightTarget.position,
                },
              ],
              groundHeight,
              bounds: calculateBounds(spec, transform.position, transform.rotation),
            });
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

  findNearestRampMountSiteByRay(input: RampMountInput & {
    rayOrigin: Vec3;
    rayDirection: Vec3;
  }): RampMountSite | null {
    const rayOrigin = new THREE.Vector3(...input.rayOrigin);
    const rayDirection = new THREE.Vector3(...input.rayDirection).normalize();
    return this.listRampMountSites(input)
      .map(site => {
        const toCenter = new THREE.Vector3(...site.bounds.center).sub(rayOrigin);
        const rayDistance = toCenter.dot(rayDirection);
        if (rayDistance < 0) {
          return { site, distance: Number.POSITIVE_INFINITY };
        }
        const closestPoint = rayOrigin
          .clone()
          .add(rayDirection.clone().multiplyScalar(rayDistance));
        return {
          site,
          distance: closestPoint.distanceTo(new THREE.Vector3(...site.bounds.center)),
        };
      })
      .filter(item => item.distance <= HIT_RADIUS_CM)
      .sort((left, right) => left.distance - right.distance)[0]?.site ?? null;
  }

  createRampPlacementPatch(input: {
    site: RampMountSite;
    instanceId?: string;
    idFactory: (prefix: string) => string;
    components: ComponentInstance[];
    connections: Connection[];
  }): TopologyPatch | null {
    const existingRamp = input.instanceId
      ? input.components.find(component => component.instanceId === input.instanceId)
      : undefined;
    const currentSite = this.listRampMountSites({
      componentId: input.site.componentId,
      components: input.components,
      connections: input.connections,
      excludeInstanceId: existingRamp?.instanceId,
      groundHeight: input.site.groundHeight,
    }).find(site => site.id === input.site.id);
    if (!currentSite) return null;
    const instanceId = existingRamp?.instanceId ?? input.instanceId ?? input.idFactory('ramp');
    const removeConnectionIds = existingRamp
      ? input.connections
          .filter(connection =>
            connection.source.componentId === instanceId ||
            connection.target.componentId === instanceId
          )
          .map(connection => connection.id)
      : [];
    const component: ComponentInstance = {
      instanceId,
      componentId: currentSite.componentId,
      position: currentSite.position,
      rotation: currentSite.rotation,
      scale: [1, 1, 1],
      color: existingRamp?.color ?? 'green',
      properties: {
        ...(existingRamp?.properties ?? {}),
        rampMountVersion: 1,
        rampGroundHeight: currentSite.groundHeight,
      },
    };
    const patch: TopologyPatch = {
      addComponents: existingRamp ? [] : [component],
      updateComponents: existingRamp
        ? [{
            instanceId,
            updates: {
              position: component.position,
              rotation: component.rotation,
              properties: component.properties,
            },
          }]
        : [],
      removeComponentIds: [],
      addConnections: currentSite.endpoints.map((endpoint, index) => ({
        id: `${input.idFactory('ramp_mount')}_${index + 1}`,
        source: {
          componentId: endpoint.targetInstanceId,
          pointId: endpoint.targetPointId,
        },
        target: {
          componentId: instanceId,
          pointId: endpoint.rampPointId,
        },
        type: 'board-mount',
        isActive: true,
      })),
      updateConnections: [],
      removeConnectionIds: [...new Set(removeConnectionIds)],
      selectInstanceId: instanceId,
    };
    return patch.addConnections.length === 2 ? patch : null;
  }
}

export const rampMountSystem = new RampMountSystem();
