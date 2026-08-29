import type { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { getWorldPosition } from './ConstructionEngine';
import { auditTopology } from './TopologyIntegritySystem';
import { getMaterialVariantDescriptor } from './MaterialVariantSystem';

export type AssemblyStepKind =
  | 'base'
  | 'vertical'
  | 'upper'
  | 'platform'
  | 'accessory'
  | 'remaining';

export type AssemblyPhase =
  | 'base'
  | 'vertical'
  | 'upper-frame'
  | 'platform'
  | 'accessory'
  | 'inspection';

export interface AssemblyPartSummary {
  componentId: string;
  name: string;
  quantity: number;
}

export interface AssemblyStep {
  order: number;
  kind: AssemblyStepKind;
  title: string;
  description: string;
  componentIds: string[];
  parts: AssemblyPartSummary[];
  connectionRefs: string[];
}

export interface AssemblyConnectionCallout {
  id: string;
  order: number;
  connectionId: string;
  position: [number, number, number];
  label: string;
  description: string;
}

export interface AssemblySubassembly {
  id: string;
  label: string;
  componentIds: string[];
  grounded: boolean;
}

export type AssemblyGuideIssueKind =
  | 'empty-design'
  | 'invalid-topology'
  | 'floating-subassembly';

export interface AssemblyGuideIssue {
  id: string;
  kind: AssemblyGuideIssueKind;
  message: string;
  repairable: boolean;
  componentIds: string[];
  location?: [number, number, number];
  detail?: string;
}

export interface AssemblyGuideStep {
  id: string;
  order: number;
  phase: AssemblyPhase;
  title: string;
  instruction: string;
  newComponentIds: string[];
  cumulativeComponentIds: string[];
  newConnectionIds: string[];
  parts: AssemblyPartSummary[];
  callouts: AssemblyConnectionCallout[];
  checks: string[];
  cameraPreset: 'isometric';
}

export interface AssemblyGuide {
  version: 1;
  designSignature: string;
  designName: string;
  status: 'ready' | 'warning';
  warnings: string[];
  subassemblies: AssemblySubassembly[];
  steps: AssemblyGuideStep[];
  bounds: {
    size: [number, number, number];
    min: [number, number, number];
    max: [number, number, number];
  };
}

export interface AssemblyGuideResult {
  status: 'ready' | 'warning' | 'blocked';
  guide?: AssemblyGuide;
  issues: AssemblyGuideIssue[];
}

export interface AssemblyGuideValidation {
  valid: boolean;
  stale: boolean;
  missingComponentIds: string[];
  duplicateComponentIds: string[];
  missingConnectionIds: string[];
}

export interface GenerateAssemblyGuideInput {
  components: ComponentInstance[];
  connections: Connection[];
  designName?: string;
}

interface ClassifiedComponent {
  component: ComponentInstance;
  phase: Exclude<AssemblyPhase, 'inspection'>;
  height: number;
  subassemblyIndex: number;
}

const MAX_COMPONENTS_PER_STEP = 8;
const HEIGHT_CLUSTER_CM = 0.5;
const FLOATING_TOLERANCE_CM = 3;

const PHASE_ORDER: Record<AssemblyPhase, number> = {
  base: 1,
  vertical: 2,
  'upper-frame': 3,
  platform: 4,
  accessory: 5,
  inspection: 6,
};

const PHASE_META: Record<AssemblyPhase, { title: string; instruction: string; checks: string[] }> = {
  base: {
    title: '搭建底部框架',
    instruction: '在地面依次连接本批接头和水平管，先形成稳定的基础轮廓。',
    checks: ['确认底框落地平稳', '确认本步接头方向与图示一致'],
  },
  vertical: {
    title: '安装竖向支撑',
    instruction: '从已完成的底层节点向上安装立柱，保持同层支撑高度一致。',
    checks: ['确认立柱已经插到底', '确认立柱保持竖直且无明显晃动'],
  },
  'upper-frame': {
    title: '连接上层框架',
    instruction: '在已完成的竖向支撑上连接本层接头和水平管。',
    checks: ['确认上层框架闭合', '确认各连接处已经锁紧'],
  },
  platform: {
    title: '安装平台板',
    instruction: '在四角支撑全部完成后放置板件，并按编号固定所有安装角。',
    checks: ['确认板件四角均已连接', '确认板面水平且没有翘起'],
  },
  accessory: {
    title: '安装附件',
    instruction: '最后安装滑梯、秋千或绳梯等附件，并复核全部锚点。',
    checks: ['确认附件所有锚点均已连接', '按附件要求检查活动空间'],
  },
  inspection: {
    title: '完成最终检查',
    instruction: '沿底层到顶层逐点复查连接、稳定性和场地安全距离。',
    checks: ['逐个复核接头锁紧状态', '确认结构无明显晃动', '确认使用区域没有尖锐或碰撞障碍'],
  },
};

const round = (value: number) => Math.round(value * 1000) / 1000;

const stableHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const createAssemblyDesignSignature = (
  components: ComponentInstance[],
  connections: Connection[]
) => {
  const componentSignature = [...components]
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId))
    .map(component => [
      component.instanceId,
      component.componentId,
      component.position.map(round).join(','),
      component.rotation.map(round).join(','),
      component.scale.map(round).join(','),
      component.color ?? '',
    ].join(':'))
    .join('|');
  const connectionSignature = [...connections]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(connection => [
      connection.id,
      connection.source.componentId,
      connection.source.pointId,
      connection.target.componentId,
      connection.target.pointId,
      connection.isActive ? '1' : '0',
    ].join(':'))
    .join('|');
  return stableHash(`${componentSignature}::${connectionSignature}`);
};

const getWorldConnectionPoint = (
  component: ComponentInstance,
  pointId: string
): [number, number, number] | null => {
  const definition = getComponentById(component.componentId);
  const point = definition?.connectionPoints.find(item => item.id === pointId);
  if (!point) return null;
  return getWorldPosition(component.position, component.rotation, point.position);
};

const getComponentPoints = (component: ComponentInstance) => {
  const definition = getComponentById(component.componentId);
  const points = definition?.connectionPoints.map(point =>
    getWorldPosition(component.position, component.rotation, point.position)
  ) ?? [];
  return [component.position, ...points];
};

const calculateBounds = (components: ComponentInstance[]) => {
  const points = components.flatMap(getComponentPoints);
  if (points.length === 0) {
    return {
      min: [0, 0, 0] as [number, number, number],
      max: [0, 0, 0] as [number, number, number],
      size: [0, 0, 0] as [number, number, number],
    };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  points.forEach(point => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  });
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as [number, number, number],
  };
};

const getComponentMinHeight = (component: ComponentInstance) =>
  Math.min(...getComponentPoints(component).map(point => point[1]));

const getComponentCenterHeight = (component: ComponentInstance) => {
  const heights = getComponentPoints(component).map(point => point[1]);
  return (Math.min(...heights) + Math.max(...heights)) / 2;
};

const isVerticalPipe = (component: ComponentInstance) => {
  const definition = getComponentById(component.componentId);
  if (definition?.type !== 'pipe' || definition.connectionPoints.length < 2) return false;
  const start = getWorldPosition(
    component.position,
    component.rotation,
    definition.connectionPoints[0].position
  );
  const end = getWorldPosition(
    component.position,
    component.rotation,
    definition.connectionPoints[1].position
  );
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dy, dz);
  return length > 0 && Math.abs(dy) / length >= 0.65;
};

const getAtomicAdvancedGroupId = (component: ComponentInstance) => {
  const groupId = typeof component.properties?.assemblyGroupId === 'string'
    ? component.properties.assemblyGroupId
    : null;
  const advancedStructure = String(component.properties?.advancedStructure);
  return groupId && ['a-frame', 'right-triangle'].includes(advancedStructure)
    ? groupId
    : null;
};

const buildAdjacency = (components: ComponentInstance[], connections: Connection[]) => {
  const validIds = new Set(components.map(component => component.instanceId));
  const adjacency = new Map<string, Set<string>>(
    components.map(component => [component.instanceId, new Set<string>()])
  );
  connections.forEach(connection => {
    if (connection.isActive === false) return;
    const left = connection.source.componentId;
    const right = connection.target.componentId;
    if (!validIds.has(left) || !validIds.has(right)) return;
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  });
  return adjacency;
};

const listConnectedComponents = (
  components: ComponentInstance[],
  adjacency: Map<string, Set<string>>
) => {
  const visited = new Set<string>();
  const result: string[][] = [];
  [...components]
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId))
    .forEach(component => {
      if (visited.has(component.instanceId)) return;
      const queue = [component.instanceId];
      const group: string[] = [];
      visited.add(component.instanceId);
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        group.push(current);
        [...(adjacency.get(current) ?? [])]
          .sort()
          .forEach(neighbor => {
            if (visited.has(neighbor)) return;
            visited.add(neighbor);
            queue.push(neighbor);
          });
      }
      result.push(group.sort());
    });
  return result;
};

const summarizeParts = (components: ComponentInstance[]): AssemblyPartSummary[] => {
  const parts = new Map<string, AssemblyPartSummary>();
  components.forEach(component => {
    const variant = getMaterialVariantDescriptor(component);
    const existing = parts.get(variant.materialKey);
    if (existing) existing.quantity += 1;
    else {
      parts.set(variant.materialKey, {
        componentId: variant.materialKey,
        name: variant.name,
        quantity: 1,
      });
    }
  });
  return Array.from(parts.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-CN')
  );
};

const createSubassemblies = (
  components: ComponentInstance[],
  groups: string[][],
  globalMinHeight: number
): AssemblySubassembly[] => {
  const componentById = new Map(components.map(component => [component.instanceId, component]));
  return groups
    .map(group => {
      const groupComponents = group
        .map(id => componentById.get(id))
        .filter((component): component is ComponentInstance => Boolean(component));
      const minHeight = Math.min(...groupComponents.map(getComponentMinHeight));
      const centerX = groupComponents.reduce((sum, component) => sum + component.position[0], 0) /
        Math.max(1, groupComponents.length);
      const centerZ = groupComponents.reduce((sum, component) => sum + component.position[2], 0) /
        Math.max(1, groupComponents.length);
      return {
        group,
        minHeight,
        centerX,
        centerZ,
      };
    })
    .sort((left, right) =>
      left.minHeight - right.minHeight ||
      left.centerX - right.centerX ||
      left.centerZ - right.centerZ ||
      left.group[0].localeCompare(right.group[0])
    )
    .map((item, index) => ({
      id: `subassembly-${index + 1}`,
      label: `子结构 ${String.fromCharCode(65 + index)}`,
      componentIds: item.group,
      grounded: item.minHeight <= globalMinHeight + FLOATING_TOLERANCE_CM,
    }));
};

const classifyComponents = (
  components: ComponentInstance[],
  connections: Connection[],
  subassemblies: AssemblySubassembly[],
  bounds: AssemblyGuide['bounds']
): ClassifiedComponent[] => {
  const subassemblyByComponent = new Map<string, number>();
  subassemblies.forEach((subassembly, index) => {
    subassembly.componentIds.forEach(id => subassemblyByComponent.set(id, index));
  });
  const incidentNeighbors = new Map<string, string[]>();
  connections.forEach(connection => {
    if (connection.isActive === false) return;
    const left = incidentNeighbors.get(connection.source.componentId) ?? [];
    left.push(connection.target.componentId);
    incidentNeighbors.set(connection.source.componentId, left);
    const right = incidentNeighbors.get(connection.target.componentId) ?? [];
    right.push(connection.source.componentId);
    incidentNeighbors.set(connection.target.componentId, right);
  });
  const componentById = new Map(components.map(component => [component.instanceId, component]));
  const structuralComponents = components.filter(component => {
    const category = getComponentById(component.componentId)?.category;
    return category === 'basic' || category === 'connector';
  });
  const structuralBounds = structuralComponents.length > 0
    ? calculateBounds(structuralComponents)
    : bounds;
  const heightRange = Math.max(1, structuralBounds.size[1]);
  const advancedGroupMinHeight = new Map<string, number>();
  components.forEach(component => {
    const groupId = typeof component.properties?.assemblyGroupId === 'string'
      ? component.properties.assemblyGroupId
      : null;
    if (
      !groupId ||
      !['a-frame', 'right-triangle'].includes(String(component.properties?.advancedStructure))
    ) return;
    const minHeight = getComponentMinHeight(component);
    advancedGroupMinHeight.set(
      groupId,
      Math.min(advancedGroupMinHeight.get(groupId) ?? Infinity, minHeight)
    );
  });

  return components.map(component => {
    const definition = getComponentById(component.componentId);
    const height = getComponentCenterHeight(component);
    const normalizedHeight = (height - structuralBounds.min[1]) / heightRange;
    const assemblyGroupId = typeof component.properties?.assemblyGroupId === 'string'
      ? component.properties.assemblyGroupId
      : null;
    const advancedGroupHeight = assemblyGroupId
      ? advancedGroupMinHeight.get(assemblyGroupId)
      : undefined;
    let phase: Exclude<AssemblyPhase, 'inspection'>;
    if (advancedGroupHeight !== undefined) {
      phase = advancedGroupHeight <= structuralBounds.min[1] + heightRange * 0.25
        ? 'base'
        : 'upper-frame';
    }
    else if (definition?.category === 'platform') phase = 'platform';
    else if (definition?.category === 'accessory') phase = 'accessory';
    else if (definition?.type === 'pipe' && isVerticalPipe(component)) phase = 'vertical';
    else if (definition?.category === 'connector') {
      const neighborDefinitions = (incidentNeighbors.get(component.instanceId) ?? [])
        .map(id => componentById.get(id))
        .map(neighbor => neighbor ? getComponentById(neighbor.componentId) : undefined);
      const touchesBasePipe = (incidentNeighbors.get(component.instanceId) ?? [])
        .map(id => componentById.get(id))
        .some(neighbor => neighbor && getComponentById(neighbor.componentId)?.type === 'pipe' &&
          !isVerticalPipe(neighbor) && getComponentCenterHeight(neighbor) <= structuralBounds.min[1] + heightRange * 0.25);
      if (touchesBasePipe || normalizedHeight <= 0.25) phase = 'base';
      else if (neighborDefinitions.some(item => item?.type === 'pipe') && normalizedHeight < 0.55) phase = 'vertical';
      else phase = 'upper-frame';
    } else if (normalizedHeight <= 0.25) phase = 'base';
    else phase = 'upper-frame';
    const groupingHeight = advancedGroupHeight ?? (phase === 'accessory'
      ? height
      : getComponentMinHeight(component));
    return {
      component,
      phase,
      height: groupingHeight,
      subassemblyIndex: subassemblyByComponent.get(component.instanceId) ?? 0,
    };
  });
};

const groupIntoBatches = (
  classified: ClassifiedComponent[],
  adjacency: Map<string, Set<string>>
): ClassifiedComponent[][] => {
  const buckets = new Map<string, ClassifiedComponent[]>();
  classified.forEach(item => {
    const level = Math.round(item.height / HEIGHT_CLUSTER_CM);
    const key = `${item.subassemblyIndex}:${item.phase}:${level}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  });
  const sortedBuckets = [...buckets.values()].sort((left, right) => {
    const leftFirst = left[0];
    const rightFirst = right[0];
    return (
      leftFirst.subassemblyIndex - rightFirst.subassemblyIndex ||
      PHASE_ORDER[leftFirst.phase] - PHASE_ORDER[rightFirst.phase] ||
      leftFirst.height - rightFirst.height
    );
  });
  const batches: ClassifiedComponent[][] = [];
  sortedBuckets.forEach(bucket => {
    const remaining = new Map(bucket.map(item => [item.component.instanceId, item]));
    while (remaining.size > 0) {
      const seed = [...remaining.values()].sort((left, right) =>
        left.component.position[0] - right.component.position[0] ||
        left.component.position[2] - right.component.position[2] ||
        left.component.instanceId.localeCompare(right.component.instanceId)
      )[0];
      const queue = [seed.component.instanceId];
      const batch: ClassifiedComponent[] = [];
      const atomicGroupId = getAtomicAdvancedGroupId(seed.component);
      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;
        const current = remaining.get(currentId);
        if (!current) continue;
        if (
          batch.length >= MAX_COMPONENTS_PER_STEP &&
          (!atomicGroupId || getAtomicAdvancedGroupId(current.component) !== atomicGroupId)
        ) continue;
        remaining.delete(currentId);
        batch.push(current);
        [...(adjacency.get(currentId) ?? [])]
          .filter(id => remaining.has(id))
          .sort()
          .forEach(id => queue.push(id));
      }
      while (remaining.size > 0 && batch.length < MAX_COMPONENTS_PER_STEP) {
        const next = [...remaining.values()].sort((left, right) =>
          left.component.position[0] - right.component.position[0] ||
          left.component.position[2] - right.component.position[2] ||
          left.component.instanceId.localeCompare(right.component.instanceId)
        )[0];
        remaining.delete(next.component.instanceId);
        batch.push(next);
      }
      batches.push(batch);
    }
  });
  return batches;
};

const connectionPosition = (
  connection: Connection,
  componentById: Map<string, ComponentInstance>
): [number, number, number] => {
  const sourceComponent = componentById.get(connection.source.componentId);
  const targetComponent = componentById.get(connection.target.componentId);
  const source = sourceComponent
    ? getWorldConnectionPoint(sourceComponent, connection.source.pointId)
    : null;
  const target = targetComponent
    ? getWorldConnectionPoint(targetComponent, connection.target.pointId)
    : null;
  if (source && target) {
    return [
      (source[0] + target[0]) / 2,
      (source[1] + target[1]) / 2,
      (source[2] + target[2]) / 2,
    ];
  }
  return source ?? target ?? [0, 0, 0];
};

const createCallouts = (
  connections: Connection[],
  componentById: Map<string, ComponentInstance>
): AssemblyConnectionCallout[] => {
  const sorted = connections
    .map(connection => ({ connection, position: connectionPosition(connection, componentById) }))
    .sort((left, right) =>
      left.position[1] - right.position[1] ||
      left.position[0] - right.position[0] ||
      left.position[2] - right.position[2] ||
      left.connection.id.localeCompare(right.connection.id)
    );
  const positionGroups: number[][] = [];
  sorted.forEach(({ position }, index) => {
    const group = positionGroups.find(indices => {
      const anchor = sorted[indices[0]].position;
      return Math.hypot(
        position[0] - anchor[0],
        position[1] - anchor[1],
        position[2] - anchor[2]
      ) <= 8;
    });
    if (group) group.push(index);
    else positionGroups.push([index]);
  });
  const displayPositions = sorted.map(({ position }) => [...position] as [number, number, number]);
  positionGroups.forEach(indices => {
    if (indices.length < 2) return;
    const center = indices.reduce<[number, number, number]>((sum, itemIndex) => {
      const position = sorted[itemIndex].position;
      return [sum[0] + position[0], sum[1] + position[1], sum[2] + position[2]];
    }, [0, 0, 0]).map(value => value / indices.length) as [number, number, number];
    const radius = 6;
    indices.forEach((itemIndex, groupIndex) => {
      const angle = indices.length === 2
        ? groupIndex * Math.PI
        : -Math.PI / 2 + groupIndex * Math.PI * 2 / indices.length;
      displayPositions[itemIndex] = [
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius,
      ];
    });
  });
  return sorted.map(({ connection }, index) => {
      const sourceComponent = componentById.get(connection.source.componentId);
      const targetComponent = componentById.get(connection.target.componentId);
      const sourceName = sourceComponent
        ? getComponentById(sourceComponent.componentId)?.name ?? sourceComponent.componentId
        : '组件';
      const targetName = targetComponent
        ? getComponentById(targetComponent.componentId)?.name ?? targetComponent.componentId
        : '组件';
      return {
        id: `callout-${connection.id}`,
        order: index + 1,
        connectionId: connection.id,
        position: displayPositions[index],
        label: `连接 ${index + 1}`,
        description: `将${sourceName}与${targetName}牢固连接`,
      };
    });
};

const createGuideCore = (
  components: ComponentInstance[],
  connections: Connection[],
  designName: string,
  warnings: string[]
): AssemblyGuide => {
  const bounds = calculateBounds(components);
  const adjacency = buildAdjacency(components, connections);
  const groups = listConnectedComponents(components, adjacency);
  const globalMinHeight = Math.min(...components.map(getComponentMinHeight));
  const subassemblies = createSubassemblies(components, groups, globalMinHeight);
  const classified = classifyComponents(components, connections, subassemblies, bounds);
  const batches = groupIntoBatches(classified, adjacency);
  const componentById = new Map(components.map(component => [component.instanceId, component]));
  const cumulativeIds = new Set<string>();
  const emittedConnectionIds = new Set<string>();
  const steps: AssemblyGuideStep[] = batches.map((batch, index) => {
    const phase = batch[0].phase;
    const meta = PHASE_META[phase];
    const newComponentIds = batch.map(item => item.component.instanceId);
    newComponentIds.forEach(id => cumulativeIds.add(id));
    const newConnections = connections
      .filter(connection => connection.isActive !== false)
      .filter(connection => !emittedConnectionIds.has(connection.id))
      .filter(connection =>
        cumulativeIds.has(connection.source.componentId) &&
        cumulativeIds.has(connection.target.componentId) &&
        (newComponentIds.includes(connection.source.componentId) ||
          newComponentIds.includes(connection.target.componentId))
      );
    newConnections.forEach(connection => emittedConnectionIds.add(connection.id));
    const stepNumber = index + 1;
    return {
      id: `assembly-step-${stepNumber}`,
      order: stepNumber,
      phase,
      title: meta.title,
      instruction: meta.instruction,
      newComponentIds,
      cumulativeComponentIds: [...cumulativeIds],
      newConnectionIds: newConnections.map(connection => connection.id),
      parts: summarizeParts(batch.map(item => item.component)),
      callouts: createCallouts(newConnections, componentById),
      checks: meta.checks,
      cameraPreset: 'isometric',
    };
  });
  const inspectionOrder = steps.length + 1;
  steps.push({
    id: `assembly-step-${inspectionOrder}`,
    order: inspectionOrder,
    phase: 'inspection',
    title: PHASE_META.inspection.title,
    instruction: PHASE_META.inspection.instruction,
    newComponentIds: [],
    cumulativeComponentIds: components.map(component => component.instanceId),
    newConnectionIds: [],
    parts: [],
    callouts: [],
    checks: PHASE_META.inspection.checks,
    cameraPreset: 'isometric',
  });
  return {
    version: 1,
    designSignature: createAssemblyDesignSignature(components, connections),
    designName,
    status: warnings.length > 0 ? 'warning' : 'ready',
    warnings,
    subassemblies,
    steps,
    bounds,
  };
};

const phaseToLegacyKind = (phase: AssemblyPhase): AssemblyStepKind => {
  if (phase === 'upper-frame') return 'upper';
  if (phase === 'inspection') return 'remaining';
  return phase;
};

class AssemblyStepSystem {
  generateAssemblyGuide(input: GenerateAssemblyGuideInput): AssemblyGuideResult {
    if (input.components.length === 0) {
      return {
        status: 'blocked',
        issues: [{
          id: 'empty-design',
          kind: 'empty-design',
          message: '当前设计为空，无法生成搭建教程。',
          repairable: false,
          componentIds: [],
        }],
      };
    }
    const audit = auditTopology({
      components: input.components,
      connections: input.connections,
    });
    const blockingTopologyIssues = audit.issues.filter(issue => issue.kind !== 'free-endpoint');
    const adjacency = buildAdjacency(input.components, input.connections);
    const groups = listConnectedComponents(input.components, adjacency);
    const globalMinHeight = Math.min(...input.components.map(getComponentMinHeight));
    const subassemblies = createSubassemblies(
      input.components,
      groups,
      globalMinHeight
    );
    const floatingSubassemblies = subassemblies.filter(item => !item.grounded);
    const issues: AssemblyGuideIssue[] = [
      ...blockingTopologyIssues.map(issue => ({
        id: `topology:${issue.id}`,
        kind: 'invalid-topology' as const,
        message: issue.message,
        repairable: issue.repairable,
        componentIds: issue.componentIds,
        location: issue.location,
        detail: issue.detail,
      })),
      ...floatingSubassemblies.map(item => ({
        id: `floating:${item.id}`,
        kind: 'floating-subassembly' as const,
        message: `${item.label}没有连接到底层支撑，无法生成可靠施工顺序。`,
        repairable: false,
        componentIds: item.componentIds,
      })),
    ];
    if (issues.length > 0) return { status: 'blocked', issues };
    const warnings: string[] = [];
    if (audit.freeEndpointCount > 0) {
      warnings.push(`设计中有 ${audit.freeEndpointCount} 个合法自由端点，请在线下搭建时复核用途。`);
    }
    if (subassemblies.length > 1) {
      warnings.push(`设计包含 ${subassemblies.length} 个独立落地子结构，将分组生成步骤。`);
    }
    const guide = createGuideCore(
      input.components,
      input.connections,
      input.designName?.trim() || '攀爬架设计',
      warnings
    );
    return {
      status: guide.status,
      guide,
      issues: [],
    };
  }

  validateAssemblyGuide(
    guide: AssemblyGuide,
    components: ComponentInstance[],
    connections: Connection[]
  ): AssemblyGuideValidation {
    const expectedComponentIds = new Set(components.map(component => component.instanceId));
    const expectedConnectionIds = new Set(
      connections.filter(connection => connection.isActive !== false).map(connection => connection.id)
    );
    const guideComponentIds = guide.steps.flatMap(step => step.newComponentIds);
    const guideConnectionIds = guide.steps.flatMap(step => step.newConnectionIds);
    const seen = new Set<string>();
    const duplicateComponentIds = guideComponentIds.filter(id => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    const missingComponentIds = [...expectedComponentIds].filter(id => !seen.has(id));
    const emittedConnections = new Set(guideConnectionIds);
    const missingConnectionIds = [...expectedConnectionIds].filter(id => !emittedConnections.has(id));
    const stale = guide.designSignature !== createAssemblyDesignSignature(components, connections);
    return {
      valid:
        !stale &&
        missingComponentIds.length === 0 &&
        duplicateComponentIds.length === 0 &&
        missingConnectionIds.length === 0,
      stale,
      missingComponentIds,
      duplicateComponentIds,
      missingConnectionIds,
    };
  }

  generateSteps(components: ComponentInstance[], connections: Connection[]): AssemblyStep[] {
    if (components.length === 0) return [];
    const guide = createGuideCore(components, connections, '攀爬架设计', []);
    const compatibilityGroups = new Map<AssemblyStepKind, AssemblyGuideStep[]>();
    guide.steps
      .filter(step => step.phase !== 'inspection')
      .forEach(step => {
        const kind = phaseToLegacyKind(step.phase);
        const list = compatibilityGroups.get(kind) ?? [];
        list.push(step);
        compatibilityGroups.set(kind, list);
      });
    return [...compatibilityGroups.entries()]
      .sort((left, right) => PHASE_ORDER[left[1][0].phase] - PHASE_ORDER[right[1][0].phase])
      .map(([kind, groupedSteps], index) => {
        const componentIds = groupedSteps.flatMap(step => step.newComponentIds);
        const componentIdSet = new Set(componentIds);
        const groupComponents = componentIds
          .map(id => components.find(component => component.instanceId === id))
          .filter((component): component is ComponentInstance => Boolean(component));
        const connectionRefs = connections
          .filter(connection =>
            componentIdSet.has(connection.source.componentId) ||
            componentIdSet.has(connection.target.componentId)
          )
          .map(connection =>
            `${connection.source.componentId}.${connection.source.pointId} ↔ ${connection.target.componentId}.${connection.target.pointId}`
          )
          .sort();
        const meta = PHASE_META[groupedSteps[0].phase];
        return {
          order: index + 1,
          kind,
          title: meta.title,
          description: meta.instruction,
          componentIds,
          parts: summarizeParts(groupComponents),
          connectionRefs,
        };
      });
  }
}

export const assemblyStepSystem = new AssemblyStepSystem();

export const generateAssemblyGuide = (input: GenerateAssemblyGuideInput) =>
  assemblyStepSystem.generateAssemblyGuide(input);

export const validateAssemblyGuide = (
  guide: AssemblyGuide,
  components: ComponentInstance[],
  connections: Connection[]
) => assemblyStepSystem.validateAssemblyGuide(guide, components, connections);
