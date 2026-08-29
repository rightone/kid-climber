import type { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { getWorldDirection, getWorldPosition } from './ConstructionEngine';
import type { TopologyPatch } from './ConnectorTopologySystem';

type Vec3 = [number, number, number];

export type BoardComponentId = 'board_40x40' | 'board_40x20';

export interface BoardMountSite {
  id: string;
  boardComponentId: BoardComponentId;
  position: Vec3;
  rotation: Vec3;
  corners: Array<{
    boardPointId: string;
    targetInstanceId: string;
    targetPointId?: string;
    virtualDirection?: Vec3;
    position: Vec3;
  }>;
  bounds: {
    center: Vec3;
    size: Vec3;
  };
  plane: BoardMountPlane;
  repairConnections?: BoardMountRepairConnection[];
}

export type BoardMountPlane = 'XZ' | 'XY' | 'YZ';

export interface BoardMountRepairConnection {
  source: Connection['source'];
  target: Connection['target'];
}

export interface BoardMountRepairSite extends BoardMountSite {
  repairConnections: BoardMountRepairConnection[];
}

export type BoardMountRejectionReason =
  | 'missing-corner'
  | 'missing-edge'
  | 'missing-connection'
  | 'occupied';

export interface BoardMountRejectedSite {
  boardComponentId: BoardComponentId;
  position: Vec3;
  rotation: Vec3;
  plane: BoardMountPlane;
  reason: BoardMountRejectionReason;
  missingEdgeCount?: number;
  missingConnectionCount?: number;
}

export interface BoardMountScanResult {
  validSites: BoardMountSite[];
  repairableSites: BoardMountRepairSite[];
  rejected: BoardMountRejectedSite[];
}

interface WorldEndpoint {
  componentId: string;
  pointId: string;
  position: Vec3;
}

interface StructuralWorldEndpoint extends WorldEndpoint {
  definitionComponentId: string;
}

interface BoardOrientation {
  plane: BoardMountPlane;
  rotation: Vec3;
  cornerOffsets: Vec3[];
}

export interface BoardMountInput {
  boardComponentId: BoardComponentId;
  components: ComponentInstance[];
  connections: Connection[];
  excludeBoardInstanceId?: string;
}

const TOLERANCE_CM = 0.6;

const roundCoord = (value: number) => Math.round(value * 10) / 10;
const pointKey = (position: Vec3) =>
  `${roundCoord(position[0])}:${roundCoord(position[1])}:${roundCoord(position[2])}`;

const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const subtract = (a: Vec3, b: Vec3): Vec3 =>
  [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const add = (a: Vec3, b: Vec3): Vec3 =>
  [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const isBoardComponentId = (componentId: string): componentId is BoardComponentId =>
  componentId === 'board_40x40' || componentId === 'board_40x20';

const collectConnectorMountNodes = ({
  components,
}: Omit<BoardMountInput, 'boardComponentId'>): WorldEndpoint[] => {
  const endpoints: WorldEndpoint[] = [];
  components.forEach(component => {
    const definition = getComponentById(component.componentId);
    if (!definition || definition.category !== 'connector') return;
    const mountPoint = definition.connectionPoints.find(
      point => point.role === 'board-mount' && point.id === 'platform_mount'
    );
    if (!mountPoint) return;
    endpoints.push({
      componentId: component.instanceId,
      pointId: mountPoint.id,
      position: getWorldPosition(component.position, component.rotation, mountPoint.position),
    });
  });
  return endpoints.sort((left, right) =>
    left.componentId.localeCompare(right.componentId) ||
    left.pointId.localeCompare(right.pointId)
  );
};

const collectStructuralWorldEndpoints = (
  components: ComponentInstance[]
): StructuralWorldEndpoint[] => {
  const endpoints: StructuralWorldEndpoint[] = [];
  components.forEach(component => {
    const definition = getComponentById(component.componentId);
    if (!definition) return;
    definition.connectionPoints.forEach(point => {
      if (point.role === 'board-mount') return;
      endpoints.push({
        componentId: component.instanceId,
        definitionComponentId: component.componentId,
        pointId: point.id,
        position: getWorldPosition(component.position, component.rotation, point.position),
      });
    });
  });
  return endpoints;
};

const connectionTouches = (connection: Connection, componentId: string) =>
  connection.source.componentId === componentId ||
  connection.target.componentId === componentId;

const otherConnectionComponent = (connection: Connection, componentId: string) =>
  connection.source.componentId === componentId
    ? connection.target.componentId
    : connection.source.componentId;

const pipeDirectlyConnectsCorners = (
  firstCornerId: string,
  secondCornerId: string,
  componentsById: Map<string, ComponentInstance>,
  connections: Connection[],
  excludeBoardInstanceId?: string
) => {
  const firstPipeIds = new Set(
    connections
      .filter(connection =>
        connectionTouches(connection, firstCornerId) &&
        connection.source.componentId !== excludeBoardInstanceId &&
        connection.target.componentId !== excludeBoardInstanceId
      )
      .map(connection => otherConnectionComponent(connection, firstCornerId))
      .filter(componentId => componentsById.get(componentId)?.componentId.startsWith('pipe_'))
  );

  return connections.some(connection => {
    if (
      !connectionTouches(connection, secondCornerId) ||
      connection.source.componentId === excludeBoardInstanceId ||
      connection.target.componentId === excludeBoardInstanceId
    ) {
      return false;
    }
    return firstPipeIds.has(otherConnectionComponent(connection, secondCornerId));
  });
};

const connectionMatchesEndpoints = (
  connection: Connection,
  first: Pick<WorldEndpoint, 'componentId' | 'pointId'>,
  second: Pick<WorldEndpoint, 'componentId' | 'pointId'>
) => (
  connection.source.componentId === first.componentId &&
  connection.source.pointId === first.pointId &&
  connection.target.componentId === second.componentId &&
  connection.target.pointId === second.pointId
) || (
  connection.target.componentId === first.componentId &&
  connection.target.pointId === first.pointId &&
  connection.source.componentId === second.componentId &&
  connection.source.pointId === second.pointId
);

const findComponentEndpointAt = (
  endpoints: StructuralWorldEndpoint[],
  componentId: string,
  position: Vec3
) => endpoints.find(endpoint =>
  endpoint.componentId === componentId &&
  distance(endpoint.position, position) <= TOLERANCE_CM
);

const inspectStructuralRectangleEdges = (input: {
  corners: WorldEndpoint[];
  components: ComponentInstance[];
  connections: Connection[];
  excludeBoardInstanceId?: string;
}): {
  physicalEdgeCount: number;
  explicitEdgeCount: number;
  repairConnections: BoardMountRepairConnection[];
  hasUnsafeMissingConnection: boolean;
} => {
  const structuralEndpoints = collectStructuralWorldEndpoints(input.components);
  const componentsById = new Map(
    input.components.map(component => [component.instanceId, component])
  );
  const pipeComponents = input.components.filter(component => {
    if (component.instanceId === input.excludeBoardInstanceId) return false;
    const definition = getComponentById(component.componentId);
    return definition?.type === 'pipe' && definition.connectionPoints.length >= 2;
  });
  const edgePairs = [[0, 1], [1, 2], [2, 3], [3, 0]] as const;
  const repairConnections: BoardMountRepairConnection[] = [];
  let physicalEdgeCount = 0;
  let explicitEdgeCount = 0;
  let hasUnsafeMissingConnection = false;

  const endpointOccupied = (endpoint: Pick<WorldEndpoint, 'componentId' | 'pointId'>) =>
    input.connections.some(connection =>
      (connection.source.componentId === endpoint.componentId &&
        connection.source.pointId === endpoint.pointId) ||
      (connection.target.componentId === endpoint.componentId &&
        connection.target.pointId === endpoint.pointId)
    );

  edgePairs.forEach(([firstIndex, secondIndex]) => {
    const firstCorner = input.corners[firstIndex];
    const secondCorner = input.corners[secondIndex];
    if (!firstCorner || !secondCorner) return;
    if (pipeDirectlyConnectsCorners(
      firstCorner.componentId,
      secondCorner.componentId,
      componentsById,
      input.connections,
      input.excludeBoardInstanceId
    )) {
      physicalEdgeCount += 1;
      explicitEdgeCount += 1;
      return;
    }

    for (const pipe of pipeComponents) {
      const pipeEndpoints = structuralEndpoints.filter(endpoint =>
        endpoint.componentId === pipe.instanceId
      );
      let match: {
        firstPipe: StructuralWorldEndpoint;
        secondPipe: StructuralWorldEndpoint;
        firstConnector: StructuralWorldEndpoint;
        secondConnector: StructuralWorldEndpoint;
      } | null = null;
      for (const firstPipe of pipeEndpoints) {
        const firstConnector = findComponentEndpointAt(
          structuralEndpoints,
          firstCorner.componentId,
          firstPipe.position
        );
        if (!firstConnector) continue;
        for (const secondPipe of pipeEndpoints) {
          if (secondPipe.pointId === firstPipe.pointId) continue;
          const secondConnector = findComponentEndpointAt(
            structuralEndpoints,
            secondCorner.componentId,
            secondPipe.position
          );
          if (!secondConnector) continue;
          match = { firstPipe, secondPipe, firstConnector, secondConnector };
          break;
        }
        if (match) break;
      }
      if (!match) continue;

      physicalEdgeCount += 1;
      const firstConnected = input.connections.some(connection =>
        connectionMatchesEndpoints(connection, match!.firstConnector, match!.firstPipe)
      );
      const secondConnected = input.connections.some(connection =>
        connectionMatchesEndpoints(connection, match!.secondConnector, match!.secondPipe)
      );
      if (firstConnected && secondConnected) explicitEdgeCount += 1;
      if (!firstConnected) {
        if (endpointOccupied(match.firstConnector) || endpointOccupied(match.firstPipe)) {
          hasUnsafeMissingConnection = true;
        } else {
          repairConnections.push({
            source: {
              componentId: match.firstConnector.componentId,
              pointId: match.firstConnector.pointId,
            },
            target: {
              componentId: match.firstPipe.componentId,
              pointId: match.firstPipe.pointId,
            },
          });
        }
      }
      if (!secondConnected) {
        if (endpointOccupied(match.secondPipe) || endpointOccupied(match.secondConnector)) {
          hasUnsafeMissingConnection = true;
        } else {
          repairConnections.push({
            source: {
              componentId: match.secondPipe.componentId,
              pointId: match.secondPipe.pointId,
            },
            target: {
              componentId: match.secondConnector.componentId,
              pointId: match.secondConnector.pointId,
            },
          });
        }
      }
      break;
    }
  });

  const repairSeen = new Set<string>();
  return {
    physicalEdgeCount,
    explicitEdgeCount,
    hasUnsafeMissingConnection,
    repairConnections: repairConnections.filter(connection => {
      const ends = [
        `${connection.source.componentId}:${connection.source.pointId}`,
        `${connection.target.componentId}:${connection.target.pointId}`,
      ].sort();
      const key = ends.join('|');
      if (repairSeen.has(key)) return false;
      repairSeen.add(key);
      return true;
    }),
  };
};

const boardFootprintAlreadyUsed = (
  cornerPositions: Vec3[],
  components: ComponentInstance[],
  excludeBoardInstanceId?: string
) =>
  components.some(component => {
    if (
      component.instanceId === excludeBoardInstanceId ||
      !isBoardComponentId(component.componentId)
    ) {
      return false;
    }
    const definition = getComponentById(component.componentId);
    if (!definition) return false;
    const existingCorners = definition.connectionPoints
      .filter(point => point.role === 'board-mount')
      .map(point => getWorldPosition(component.position, component.rotation, point.position));
    return existingCorners.length === cornerPositions.length &&
      cornerPositions.every(position =>
        existingCorners.some(existing => distance(existing, position) <= TOLERANCE_CM)
      );
  });

const findEndpointAt = (endpointsByPosition: Map<string, WorldEndpoint[]>, position: Vec3) => {
  const direct = endpointsByPosition.get(pointKey(position));
  if (direct?.[0]) return direct[0];
  for (const endpoints of endpointsByPosition.values()) {
    const match = endpoints.find(endpoint => distance(endpoint.position, position) <= TOLERANCE_CM);
    if (match) return match;
  }
  return null;
};

const orientationPlane = (rotation: Vec3): BoardMountPlane => {
  const normal = getWorldDirection(rotation, [0, 1, 0]);
  const absolute = normal.map(Math.abs);
  if (absolute[1] >= absolute[0] && absolute[1] >= absolute[2]) return 'XZ';
  if (absolute[2] >= absolute[0]) return 'XY';
  return 'YZ';
};

const orientationSignature = (offsets: Vec3[]) => offsets
  .map(pointKey)
  .sort()
  .join('|');

const createBoardOrientations = (
  boardComponentId: BoardComponentId
): BoardOrientation[] => {
  const definition = getComponentById(boardComponentId);
  if (!definition) return [];
  const rotations: Vec3[] = [
    [0, 0, 0],
    [0, 90, 0],
    [0, 90, 90],
    [90, 0, 0],
    [0, 0, 270],
    [90, 0, 270],
  ];
  const seen = new Set<string>();
  const orientations: BoardOrientation[] = [];
  rotations.forEach(rotation => {
    const cornerOffsets = definition.connectionPoints
      .filter(point => point.role === 'board-mount')
      .map(point => getWorldPosition([0, 0, 0], rotation, point.position));
    if (cornerOffsets.length !== 4) return;
    const plane = orientationPlane(rotation);
    const signature = `${plane}:${orientationSignature(cornerOffsets)}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    orientations.push({ plane, rotation, cornerOffsets });
  });
  return orientations;
};

const calculateSiteBounds = (center: Vec3, corners: Vec3[]) => {
  const min: Vec3 = [...center];
  const max: Vec3 = [...center];
  corners.forEach(corner => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], corner[axis]);
      max[axis] = Math.max(max[axis], corner[axis]);
    }
  });
  return {
    center: [...center] as Vec3,
    size: [
      Math.max(2, max[0] - min[0]),
      Math.max(2, max[1] - min[1]),
      Math.max(2, max[2] - min[2]),
    ] as Vec3,
  };
};

class BoardMountSystem {
  isBoardComponentId(componentId: string): componentId is BoardComponentId {
    return isBoardComponentId(componentId);
  }

  scanBoardMountSites(input: BoardMountInput): BoardMountScanResult {
    const definition = getComponentById(input.boardComponentId);
    if (!definition?.width || !definition.height) {
      return { validSites: [], repairableSites: [], rejected: [] };
    }

    const endpoints = collectConnectorMountNodes(input);
    const endpointsByPosition = new Map<string, WorldEndpoint[]>();
    endpoints.forEach(endpoint => {
      const key = pointKey(endpoint.position);
      endpointsByPosition.set(key, [...(endpointsByPosition.get(key) ?? []), endpoint]);
    });

    const orientations = createBoardOrientations(input.boardComponentId);
    const seen = new Set<string>();
    const rejectedSeen = new Set<string>();
    const validSites: BoardMountSite[] = [];
    const repairableSites: BoardMountRepairSite[] = [];
    const rejected: BoardMountRejectedSite[] = [];

    const addRejected = (
      position: Vec3,
      orientation: BoardOrientation,
      reason: BoardMountRejectionReason,
      details?: Pick<BoardMountRejectedSite, 'missingEdgeCount' | 'missingConnectionCount'>
    ) => {
      const key = `${input.boardComponentId}:${pointKey(position)}:${orientationSignature(orientation.cornerOffsets)}:${reason}`;
      if (rejectedSeen.has(key)) return;
      rejectedSeen.add(key);
      rejected.push({
        boardComponentId: input.boardComponentId,
        position,
        rotation: orientation.rotation,
        plane: orientation.plane,
        reason,
        ...details,
      });
    };

    endpoints.forEach(anchor => {
      orientations.forEach(orientation => {
        orientation.cornerOffsets.forEach(anchorOffset => {
          const center = subtract(anchor.position, anchorOffset);
          const requiredPositions = orientation.cornerOffsets.map(offset => add(center, offset));
          const id = `${input.boardComponentId}:${pointKey(center)}:${orientationSignature(orientation.cornerOffsets)}`;
          if (seen.has(id)) return;

          const corners = requiredPositions.map(findEndpointAt.bind(null, endpointsByPosition));
          if (corners.some(corner => !corner)) {
            if (corners.filter(Boolean).length >= 3) {
              addRejected(center, orientation, 'missing-corner');
            }
            return;
          }
          const resolvedCorners = corners as WorldEndpoint[];
          if (new Set(resolvedCorners.map(corner => corner.componentId)).size !== 4) {
            addRejected(center, orientation, 'missing-corner');
            return;
          }
          if (boardFootprintAlreadyUsed(requiredPositions, input.components, input.excludeBoardInstanceId)) {
            addRejected(center, orientation, 'occupied');
            return;
          }

          const edgeInspection = inspectStructuralRectangleEdges({
            corners: resolvedCorners,
            components: input.components,
            connections: input.connections,
            excludeBoardInstanceId: input.excludeBoardInstanceId,
          });
          if (edgeInspection.physicalEdgeCount < 4) {
            addRejected(center, orientation, 'missing-edge', {
              missingEdgeCount: 4 - edgeInspection.physicalEdgeCount,
            });
            return;
          }

          seen.add(id);
          const site: BoardMountSite = {
            id,
            boardComponentId: input.boardComponentId,
            position: center,
            rotation: orientation.rotation,
            plane: orientation.plane,
            corners: resolvedCorners.map((corner, index) => ({
              boardPointId: `corner${index + 1}`,
              targetInstanceId: corner.componentId,
              targetPointId: corner.pointId,
              position: corner.position,
            })),
            bounds: calculateSiteBounds(center, requiredPositions),
          };

          if (edgeInspection.explicitEdgeCount === 4) {
            validSites.push(site);
            return;
          }
          addRejected(center, orientation, 'missing-connection', {
            missingConnectionCount: edgeInspection.repairConnections.length,
          });
          if (
            !edgeInspection.hasUnsafeMissingConnection &&
            edgeInspection.repairConnections.length > 0
          ) {
            const repairableSite: BoardMountRepairSite = {
              ...site,
              repairConnections: edgeInspection.repairConnections,
            };
            repairableSites.push(repairableSite);
          }
        });
      });
    });

    const sortSites = (left: BoardMountSite, right: BoardMountSite) =>
      left.position[1] - right.position[1] ||
      left.position[0] - right.position[0] ||
      left.position[2] - right.position[2] ||
      left.plane.localeCompare(right.plane) ||
      left.rotation.join(':').localeCompare(right.rotation.join(':'));
    validSites.sort(sortSites);
    repairableSites.sort(sortSites);
    rejected.sort((left, right) =>
      left.position[1] - right.position[1] ||
      left.position[0] - right.position[0] ||
      left.position[2] - right.position[2] ||
      left.reason.localeCompare(right.reason)
    );
    return { validSites, repairableSites, rejected };
  }

  listBoardMountSites(input: BoardMountInput): BoardMountSite[] {
    return this.scanBoardMountSites(input).validSites;
  }

  findNearestBoardMountSite(input: BoardMountInput & { pointerPosition: Vec3 }): BoardMountSite | null {
    const sites = this.listBoardMountSites(input);
    return sites
      .map(site => ({
        site,
        distance: distance(site.position, input.pointerPosition),
      }))
      .filter(item => item.distance <= 18)
      .sort((left, right) => left.distance - right.distance)[0]?.site ?? null;
  }

  findNearestBoardMountSiteByRay(input: BoardMountInput & {
    rayOrigin: Vec3;
    rayDirection: Vec3;
  }): BoardMountSite | null {
    const scan = this.scanBoardMountSites(input);
    const sites = [...scan.validSites, ...scan.repairableSites];
    return sites
      .map(site => {
        const normal = getWorldDirection(site.rotation, [0, 1, 0]);
        const denominator =
          input.rayDirection[0] * normal[0] +
          input.rayDirection[1] * normal[1] +
          input.rayDirection[2] * normal[2];
        if (Math.abs(denominator) < 1e-6) {
          return { site, distance: Number.POSITIVE_INFINITY };
        }
        const toPlane = subtract(site.position, input.rayOrigin);
        const rayDistance = (
          toPlane[0] * normal[0] +
          toPlane[1] * normal[1] +
          toPlane[2] * normal[2]
        ) / denominator;
        if (rayDistance < 0) {
          return { site, distance: Number.POSITIVE_INFINITY };
        }
        const hit: Vec3 = [
          input.rayOrigin[0] + input.rayDirection[0] * rayDistance,
          input.rayOrigin[1] + input.rayDirection[1] * rayDistance,
          input.rayOrigin[2] + input.rayDirection[2] * rayDistance,
        ];
        return {
          site,
          distance: distance(site.position, hit),
        };
      })
      .filter(item =>
        item.distance <= Math.max(
          18,
          Math.hypot(
            item.site.bounds.size[0],
            item.site.bounds.size[1],
            item.site.bounds.size[2]
          ) / 2
        )
      )
      .sort((left, right) => left.distance - right.distance)[0]?.site ?? null;
  }

  createBoardPlacementPatch(input: {
    site: BoardMountSite;
    boardInstanceId?: string;
    idFactory: (prefix: string) => string;
    components: ComponentInstance[];
    connections: Connection[];
  }): TopologyPatch | null {
    const existingBoard = input.boardInstanceId
      ? input.components.find(component => component.instanceId === input.boardInstanceId)
      : undefined;
    const boardInstanceId =
      existingBoard?.instanceId ??
      input.boardInstanceId ??
      input.idFactory('board');
    const removeConnectionIds = existingBoard
      ? input.connections
          .filter(connection =>
            connection.source.componentId === boardInstanceId ||
            connection.target.componentId === boardInstanceId
          )
          .map(connection => connection.id)
      : [];

    const boardComponent: ComponentInstance = {
      instanceId: boardInstanceId,
      componentId: input.site.boardComponentId,
      position: input.site.position,
      rotation: input.site.rotation,
      scale: [1, 1, 1],
      color: existingBoard?.color ?? 'green',
      properties: {
        ...(existingBoard?.properties ?? {}),
        boardStyle:
          existingBoard?.properties?.boardStyle === 'perforated'
            ? 'perforated'
            : 'solid',
        boardMountVersion: 2,
      },
    };
    const boardUpdates = {
      position: input.site.position,
      rotation: input.site.rotation,
      properties: boardComponent.properties,
    };
    const patch: TopologyPatch = {
      addComponents: existingBoard
        ? []
        : [boardComponent],
      updateComponents: existingBoard
        ? [{
            instanceId: boardInstanceId,
            updates: boardUpdates,
          }]
        : [],
      removeComponentIds: [],
      addConnections: [],
      updateConnections: [],
      removeConnectionIds,
      selectInstanceId: boardInstanceId,
    };

    for (const repair of input.site.repairConnections ?? []) {
      patch.addConnections.push({
        id: input.idFactory('board_repair_conn'),
        source: repair.source,
        target: repair.target,
        type: 'structural',
        isActive: true,
      });
    }

    for (const [index, corner] of input.site.corners.entries()) {
      if (!corner.targetPointId) {
        return null;
      }
      patch.addConnections.push({
          id: `${input.idFactory('board_conn')}_${index + 1}`,
          source: {
            componentId: corner.targetInstanceId,
            pointId: corner.targetPointId,
          },
          target: {
            componentId: boardInstanceId,
            pointId: corner.boardPointId,
          },
          type: 'board-mount',
          isActive: true,
        });
    }

    patch.removeComponentIds = [...new Set(patch.removeComponentIds)];
    patch.removeConnectionIds = [...new Set(patch.removeConnectionIds)];
    return patch;
  }
}

export const boardMountSystem = new BoardMountSystem();

export const scanBoardMountSites = (input: BoardMountInput): BoardMountScanResult =>
  boardMountSystem.scanBoardMountSites(input);

export const normalizeBoardComponentInstance = (
  component: ComponentInstance
): ComponentInstance => {
  if (!isBoardComponentId(component.componentId)) return component;
  return {
    ...component,
    color:
      component.color && component.color !== 'black'
        ? component.color
        : 'green',
    properties: {
      ...(component.properties ?? {}),
      boardStyle:
        component.properties?.boardStyle === 'perforated'
          ? 'perforated'
          : 'solid',
      boardMountVersion: component.properties?.boardMountVersion ?? 2,
    },
  };
};

export const migrateBoardMountData = (input: {
  components: ComponentInstance[];
  connections: Connection[];
}): { components: ComponentInstance[]; connections: Connection[] } => {
  const componentById = new Map(
    input.components.map(component => [component.instanceId, component])
  );
  const migratedComponents = input.components.map(component => {
    if (!isBoardComponentId(component.componentId)) return component;
    const boardConnections = input.connections.filter(connection =>
      connection.source.componentId === component.instanceId ||
      connection.target.componentId === component.instanceId
    );
    const mountNodes = boardConnections
      .map(connection => {
        const otherId = connection.source.componentId === component.instanceId
          ? connection.target.componentId
          : connection.source.componentId;
        const other = componentById.get(otherId);
        const definition = other ? getComponentById(other.componentId) : undefined;
        return definition?.category === 'connector' ? other : undefined;
      })
      .filter((node): node is ComponentInstance => Boolean(node));
    const safeLegacyMount = boardConnections.length === 4 && mountNodes.length === 4;
    const position: Vec3 = safeLegacyMount
      ? [
          mountNodes.reduce((sum, node) => sum + node.position[0], 0) / 4,
          mountNodes.reduce((sum, node) => sum + node.position[1], 0) / 4,
          mountNodes.reduce((sum, node) => sum + node.position[2], 0) / 4,
        ]
      : component.position;
    return normalizeBoardComponentInstance({
      ...component,
      position,
      properties: {
        ...(component.properties ?? {}),
        boardMountVersion: safeLegacyMount
          ? 2
          : component.properties?.boardMountVersion,
      },
    });
  });

  const migratedConnections = input.connections.map(connection => {
    const source = componentById.get(connection.source.componentId);
    const target = componentById.get(connection.target.componentId);
    const board = isBoardComponentId(source?.componentId ?? '')
      ? source
      : isBoardComponentId(target?.componentId ?? '')
        ? target
        : undefined;
    if (!board) return connection;
    const boardConnections = input.connections.filter(candidate =>
      candidate.source.componentId === board.instanceId ||
      candidate.target.componentId === board.instanceId
    );
    if (boardConnections.length !== 4) return connection;
    const otherIsConnector = [source, target].some(component =>
      component && getComponentById(component.componentId)?.category === 'connector'
    );
    if (!otherIsConnector) return connection;
    return {
      ...connection,
      source: source && getComponentById(source.componentId)?.category === 'connector'
        ? { ...connection.source, pointId: 'platform_mount' }
        : connection.source,
      target: target && getComponentById(target.componentId)?.category === 'connector'
        ? { ...connection.target, pointId: 'platform_mount' }
        : connection.target,
      type: 'board-mount',
    };
  });

  return {
    components: migratedComponents,
    connections: migratedConnections,
  };
};
