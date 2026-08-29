import * as THREE from 'three';
import type { ComponentInstance, Connection, ConnectionPoint } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../referenceProductSpec';

type Vec3 = [number, number, number];

export type AFrameModuleSize = 'small' | 'large';
export type AFramePlane = 'vertical-x' | 'vertical-z';
export type TriangleModuleSize = 20 | 40;
export type TrianglePlane = 'horizontal' | 'vertical-x' | 'vertical-z';

export interface RecipeMountPort {
  id: string;
  componentInstanceId: string;
  pointId: string;
  localPosition: Vec3;
  localDirection: Vec3;
  required: boolean;
}

export interface StructureRecipe {
  id: string;
  recipeId: 'a-frame-small' | 'a-frame-large' | 'diagonal-run';
  name: string;
  components: ComponentInstance[];
  connections: Connection[];
  mountPorts: RecipeMountPort[];
}

export interface AdvancedAFrameAssembly extends StructureRecipe {
  recipeId: 'a-frame-small' | 'a-frame-large';
}

export type AdvancedTriangleAssembly = AdvancedAFrameAssembly;

interface ConnectorPlacement {
  component: ComponentInstance;
  pointForDirection: (direction: THREE.Vector3) => string;
}

const toDegrees = (radians: number) => THREE.MathUtils.radToDeg(radians);

const vectorTuple = (vector: THREE.Vector3): Vec3 => [
  Number(vector.x.toFixed(4)),
  Number(vector.y.toFixed(4)),
  Number(vector.z.toFixed(4)),
];

const quaternionToRotation = (quaternion: THREE.Quaternion): Vec3 => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [toDegrees(euler.x), toDegrees(euler.y), toDegrees(euler.z)].map(
    value => Number(value.toFixed(4))
  ) as Vec3;
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

const rotationForDirectionPair = (
  firstLocal: THREE.Vector3,
  secondLocal: THREE.Vector3,
  firstTarget: THREE.Vector3,
  secondTarget: THREE.Vector3
) => {
  const normalizedFirstLocal = firstLocal.clone().normalize();
  const normalizedSecondLocal = secondLocal.clone().normalize();
  const normalizedFirstTarget = firstTarget.clone().normalize();
  const normalizedSecondTarget = secondTarget.clone().normalize();
  if (Math.abs(
    normalizedFirstLocal.dot(normalizedSecondLocal) -
    normalizedFirstTarget.dot(normalizedSecondTarget)
  ) > 1e-3) {
    return null;
  }
  if (Math.abs(normalizedFirstLocal.dot(normalizedSecondLocal)) > 0.999) {
    const quaternion = new THREE.Quaternion()
      .setFromUnitVectors(normalizedFirstLocal, normalizedFirstTarget)
      .normalize();
    return normalizedSecondLocal.clone().applyQuaternion(quaternion).dot(normalizedSecondTarget) > 0.999
      ? quaternion
      : null;
  }
  const localBasis = createBasis(firstLocal, secondLocal);
  const targetBasis = createBasis(firstTarget, secondTarget);
  const rotationMatrix = targetBasis.multiply(localBasis.clone().invert());
  return new THREE.Quaternion().setFromRotationMatrix(rotationMatrix).normalize();
};

const createConnectorPlacement = (input: {
  instanceId: string;
  componentId: 'connector_L' | 'connector_45deg' | 'connector_straight';
  position: THREE.Vector3;
  directions: [THREE.Vector3, THREE.Vector3];
  assemblyGroupId: string;
}): ConnectorPlacement => {
  const definition = getComponentById(input.componentId);
  if (!definition) throw new Error(`Missing connector definition: ${input.componentId}`);
  const points = definition.connectionPoints.filter(point => point.role !== 'board-mount');
  if (points.length !== 2) {
    throw new Error(`${input.componentId} must expose exactly two structural ports`);
  }

  const attempts: Array<{
    first: ConnectionPoint;
    second: ConnectionPoint;
    firstTarget: THREE.Vector3;
    secondTarget: THREE.Vector3;
  }> = [
    { first: points[0], second: points[1], firstTarget: input.directions[0], secondTarget: input.directions[1] },
    { first: points[0], second: points[1], firstTarget: input.directions[1], secondTarget: input.directions[0] },
  ];

  for (const attempt of attempts) {
    const quaternion = rotationForDirectionPair(
      new THREE.Vector3(...attempt.first.direction),
      new THREE.Vector3(...attempt.second.direction),
      attempt.firstTarget,
      attempt.secondTarget
    );
    if (!quaternion) continue;
    const rotation = quaternionToRotation(quaternion);
    const directionByPoint = new Map(
      points.map(point => [
        point.id,
        new THREE.Vector3(...point.direction).applyQuaternion(quaternion).normalize(),
      ])
    );
    return {
      component: {
        instanceId: input.instanceId,
        componentId: input.componentId,
        position: vectorTuple(input.position),
        rotation,
        scale: [1, 1, 1],
        color: 'black',
        properties: { assemblyGroupId: input.assemblyGroupId, advancedStructure: 'a-frame' },
      },
      pointForDirection: direction => {
        const normalized = direction.clone().normalize();
        const point = points.find(candidate =>
          (directionByPoint.get(candidate.id)?.dot(normalized) ?? -1) > 0.999
        );
        if (!point) throw new Error(`Unable to map ${input.componentId} port direction`);
        return point.id;
      },
    };
  }

  throw new Error(`Unable to orient ${input.componentId} for requested triangle`);
};

const createPipeBetweenNodes = (input: {
  instanceId: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  assemblyGroupId: string;
}) => {
  const direction = input.end.clone().sub(input.start).normalize();
  const position = input.start.clone().add(input.end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction
  );
  return {
    component: {
      instanceId: input.instanceId,
      componentId: 'pipe_35cm',
      position: vectorTuple(position),
      rotation: quaternionToRotation(quaternion),
      scale: [1, 1, 1] as Vec3,
      properties: { assemblyGroupId: input.assemblyGroupId, advancedStructure: 'a-frame' },
    } satisfies ComponentInstance,
    direction,
  };
};

const planeHorizontalAxis = (plane: TrianglePlane | AFramePlane, mirrored: boolean) => {
  const sign = mirrored ? -1 : 1;
  switch (plane) {
    case 'vertical-z':
      return new THREE.Vector3(0, 0, sign);
    case 'vertical-x':
    default:
      return new THREE.Vector3(sign, 0, 0);
  }
};

class AdvancedStructureSystem {
  createAFrame(input: {
    size: AFrameModuleSize;
    plane: AFramePlane;
    mirrored?: boolean;
    idFactory: (prefix: string) => string;
  }): AdvancedAFrameAssembly {
    const assemblyGroupId = input.idFactory('a_frame_group');
    const sideSegments = input.size === 'large' ? 2 : 1;
    const sideCenterDistance = REFERENCE_PRODUCT_PROFILE_V1.modulePitches[2] * sideSegments;
    const halfSpan = sideCenterDistance / Math.SQRT2;
    const height = sideCenterDistance / Math.SQRT2;
    const horizontalAxis = planeHorizontalAxis(input.plane, input.mirrored ?? false);
    const verticalAxis = new THREE.Vector3(0, 1, 0);
    const bottomLeft = horizontalAxis.clone().multiplyScalar(-halfSpan);
    const bottomRight = horizontalAxis.clone().multiplyScalar(halfSpan);
    const top = verticalAxis.clone().multiplyScalar(height);
    // The second foot port is a real installation port. It points downward so
    // it can mate with an upward-facing endpoint on an existing base frame.
    // With the corrected 45-degree connector this forms a 135-degree outward
    // port angle (a 45-degree deflection from straight).
    const mountDirection = verticalAxis.clone().negate();
    const leftDirection = bottomLeft.clone().sub(top).normalize();
    const rightDirection = bottomRight.clone().sub(top).normalize();

    const topConnector = createConnectorPlacement({
      instanceId: input.idFactory('a_frame_connector'),
      componentId: 'connector_L',
      position: top,
      directions: [leftDirection, rightDirection],
      assemblyGroupId,
    });
    const leftFootConnector = createConnectorPlacement({
      instanceId: input.idFactory('a_frame_connector'),
      componentId: 'connector_45deg',
      position: bottomLeft,
      directions: [leftDirection.clone().negate(), mountDirection],
      assemblyGroupId,
    });
    const rightFootConnector = createConnectorPlacement({
      instanceId: input.idFactory('a_frame_connector'),
      componentId: 'connector_45deg',
      position: bottomRight,
      directions: [rightDirection.clone().negate(), mountDirection],
      assemblyGroupId,
    });

    const createConnection = (
      connector: ConnectorPlacement,
      connectorDirection: THREE.Vector3,
      pipe: ComponentInstance,
      pipePointId: 'start' | 'end'
    ): Connection => ({
      id: input.idFactory('a_frame_connection'),
      source: {
        componentId: connector.component.instanceId,
        pointId: connector.pointForDirection(connectorDirection),
      },
      target: { componentId: pipe.instanceId, pointId: pipePointId },
      type: 'socket',
      isActive: true,
    });

    const socketOffset = REFERENCE_PRODUCT_PROFILE_V1.connector.portOffset;
    const buildSide = (
      prefix: 'left' | 'right',
      bottomConnector: ConnectorPlacement,
      bottom: THREE.Vector3,
      sideDirection: THREE.Vector3
    ) => {
      const nodes = input.size === 'large'
        ? [bottom, bottom.clone().addScaledVector(sideDirection.clone().negate(), sideCenterDistance / 2), top]
        : [bottom, top];
      const pipes = nodes.slice(0, -1).map((node, index) => {
        const next = nodes[index + 1];
        const direction = next.clone().sub(node).normalize();
        return createPipeBetweenNodes({
          instanceId: input.idFactory(`a_frame_${prefix}_pipe`),
          start: node.clone().addScaledVector(direction, socketOffset),
          end: next.clone().addScaledVector(direction, -socketOffset),
          assemblyGroupId,
        });
      });
      const middleConnector = input.size === 'large'
        ? createConnectorPlacement({
            instanceId: input.idFactory(`a_frame_${prefix}_connector`),
            componentId: 'connector_straight',
            position: nodes[1],
            directions: [
              nodes[0].clone().sub(nodes[1]).normalize(),
              nodes[2].clone().sub(nodes[1]).normalize(),
            ],
            assemblyGroupId,
          })
        : null;
      const connectors = middleConnector ? [middleConnector.component] : [];
      const connections = [
        createConnection(
          bottomConnector,
          nodes[1].clone().sub(nodes[0]).normalize(),
          pipes[0].component,
          'start'
        ),
      ];
      if (middleConnector) {
        connections.push(
          createConnection(
            middleConnector,
            nodes[0].clone().sub(nodes[1]).normalize(),
            pipes[0].component,
            'end'
          ),
          createConnection(
            middleConnector,
            nodes[2].clone().sub(nodes[1]).normalize(),
            pipes[1].component,
            'start'
          )
        );
      }
      connections.push(
        createConnection(
          topConnector,
          bottom.clone().sub(top).normalize(),
          pipes[pipes.length - 1].component,
          'end'
        )
      );
      return {
        components: [...connectors, ...pipes.map(pipe => pipe.component)],
        connections,
      };
    };

    const leftSide = buildSide('left', leftFootConnector, bottomLeft, leftDirection);
    const rightSide = buildSide('right', rightFootConnector, bottomRight, rightDirection);
    const components = [
      topConnector.component,
      leftFootConnector.component,
      rightFootConnector.component,
      ...leftSide.components,
      ...rightSide.components,
    ];
    const connections = [...leftSide.connections, ...rightSide.connections];
    const mountPorts: RecipeMountPort[] = [
      {
        id: 'left-foot',
        componentInstanceId: leftFootConnector.component.instanceId,
        pointId: leftFootConnector.pointForDirection(mountDirection),
        localPosition: vectorTuple(
          bottomLeft.clone().addScaledVector(
            mountDirection,
            REFERENCE_PRODUCT_PROFILE_V1.connector.portOffset
          )
        ),
        localDirection: vectorTuple(mountDirection),
        required: true,
      },
      {
        id: 'right-foot',
        componentInstanceId: rightFootConnector.component.instanceId,
        pointId: rightFootConnector.pointForDirection(mountDirection),
        localPosition: vectorTuple(
          bottomRight.clone().addScaledVector(
            mountDirection,
            REFERENCE_PRODUCT_PROFILE_V1.connector.portOffset
          )
        ),
        localDirection: vectorTuple(mountDirection),
        required: true,
      },
    ];

    return {
      id: assemblyGroupId,
      recipeId: input.size === 'large' ? 'a-frame-large' : 'a-frame-small',
      name: input.size === 'large' ? '大型A字架' : '小型A字架',
      components,
      connections,
      mountPorts,
    };
  }

  createRightTriangle(input: {
    size: TriangleModuleSize;
    plane: TrianglePlane;
    mirrored?: boolean;
    idFactory: (prefix: string) => string;
  }): AdvancedTriangleAssembly {
    return this.createAFrame({
      size: input.size === 40 ? 'large' : 'small',
      plane: input.plane === 'vertical-z' ? 'vertical-z' : 'vertical-x',
      mirrored: input.mirrored,
      idFactory: input.idFactory,
    });
  }
}

export const advancedStructureSystem = new AdvancedStructureSystem();
