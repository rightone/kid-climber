import type { ComponentColor, ComponentInstance, Connection, PipeColor } from '../types';
import { PIPE_COLOR_OPTIONS } from '../types';
import { getComponentById } from '../stores/componentLibrary';

export type PipeColorMode = 'auto' | 'blue';

const PIPE_COLOR_IDS = new Set<PipeColor>(
  PIPE_COLOR_OPTIONS.map(option => option.id)
);

export const DEFAULT_PIPE_COLOR: PipeColor = 'blue';
export const DEFAULT_PIPE_COLOR_MODE: PipeColorMode = 'auto';
const PIPE_COLOR_MODE_STORAGE_KEY = 'kid_climber_pipe_color_mode';
export const PIPE_COLOR_MODE_OPTIONS: ReadonlyArray<{
  id: PipeColorMode;
  name: string;
  description: string;
}> = [
  {
    id: 'auto',
    name: '自动分散颜色',
    description: '新管件在红、黄、蓝、绿之间自动分配，尽量避免相邻同色',
  },
  {
    id: 'blue',
    name: '统一蓝色',
    description: '新管件默认使用蓝色',
  },
];

export const isPipeColor = (color: unknown): color is PipeColor =>
  typeof color === 'string' && PIPE_COLOR_IDS.has(color as PipeColor);

export const normalizePipeColor = (color: unknown): PipeColor =>
  isPipeColor(color) ? color : DEFAULT_PIPE_COLOR;

export const isPipeColorMode = (mode: unknown): mode is PipeColorMode =>
  mode === 'auto' || mode === 'blue';

export const normalizePipeColorMode = (mode: unknown): PipeColorMode =>
  isPipeColorMode(mode) ? mode : DEFAULT_PIPE_COLOR_MODE;

export const getPipeColorModePreference = (): PipeColorMode => {
  if (typeof localStorage === 'undefined') return DEFAULT_PIPE_COLOR_MODE;
  try {
    return normalizePipeColorMode(
      localStorage.getItem(PIPE_COLOR_MODE_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_PIPE_COLOR_MODE;
  }
};

export const setPipeColorModePreference = (mode: PipeColorMode): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PIPE_COLOR_MODE_STORAGE_KEY, normalizePipeColorMode(mode));
  } catch {
    // Ignore unavailable localStorage.
  }
};

export const isPipeComponentId = (componentId: string): boolean =>
  componentId.startsWith('pipe_');

export const normalizeComponentColorForRender = (
  componentId: string,
  color: unknown
): ComponentColor | undefined => {
  if (isPipeComponentId(componentId)) {
    return normalizePipeColor(color);
  }
  if (componentId.startsWith('board_')) {
    return isPipeColor(color) ? color : 'green';
  }
  return color === 'black' ? 'black' : undefined;
};

export const normalizeComponentInstanceColor = (
  component: ComponentInstance
): ComponentInstance => {
  if (!isPipeComponentId(component.componentId)) {
    return component;
  }

  const normalizedColor = normalizePipeColor(component.color);
  return component.color === normalizedColor
    ? component
    : { ...component, color: normalizedColor };
};

export const shouldOpenPipeColorMenu = (
  start: { clientX: number; clientY: number },
  end: { clientX: number; clientY: number },
  thresholdPx = 6
): boolean =>
  Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) <= thresholdPx;

interface AssignAutomaticPipeColorsInput {
  existingComponents: ComponentInstance[];
  existingConnections: Connection[];
  newComponents: ComponentInstance[];
  newConnections?: Connection[];
  mode?: PipeColorMode;
  preserveExplicitNewColors?: boolean;
}

const PIPE_COLOR_ORDER = PIPE_COLOR_OPTIONS.map(option => option.id);

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createPipeAdjacencyIndex = (
  components: ComponentInstance[],
  connections: Connection[]
): Map<string, Set<string>> => {
  const componentById = new Map(components.map(component => [component.instanceId, component]));
  const pipeIds = new Set(
    components
      .filter(component => isPipeComponentId(component.componentId))
      .map(component => component.instanceId)
  );
  const adjacentPipeIds = new Map<string, Set<string>>();
  const connectorToPipeIds = new Map<string, Set<string>>();

  pipeIds.forEach(pipeId => adjacentPipeIds.set(pipeId, new Set()));

  connections.forEach(connection => {
    const source = componentById.get(connection.source.componentId);
    const target = componentById.get(connection.target.componentId);
    if (!source || !target) return;

    const sourceIsPipe = pipeIds.has(source.instanceId);
    const targetIsPipe = pipeIds.has(target.instanceId);
    if (sourceIsPipe && targetIsPipe) {
      adjacentPipeIds.get(source.instanceId)?.add(target.instanceId);
      adjacentPipeIds.get(target.instanceId)?.add(source.instanceId);
      return;
    }

    if (
      sourceIsPipe &&
      !targetIsPipe &&
      getComponentById(target.componentId)?.category === 'connector'
    ) {
      const connectedPipes = connectorToPipeIds.get(target.instanceId) ?? new Set<string>();
      connectedPipes.add(source.instanceId);
      connectorToPipeIds.set(target.instanceId, connectedPipes);
    } else if (
      !sourceIsPipe &&
      targetIsPipe &&
      getComponentById(source.componentId)?.category === 'connector'
    ) {
      const connectedPipes = connectorToPipeIds.get(source.instanceId) ?? new Set<string>();
      connectedPipes.add(target.instanceId);
      connectorToPipeIds.set(source.instanceId, connectedPipes);
    }
  });

  connectorToPipeIds.forEach(pipeIdsAtConnector => {
    const ids = [...pipeIdsAtConnector];
    ids.forEach((pipeId, index) => {
      const adjacent = adjacentPipeIds.get(pipeId);
      if (!adjacent) return;
      ids.forEach((otherPipeId, otherIndex) => {
        if (index !== otherIndex) adjacent.add(otherPipeId);
      });
    });
  });

  return adjacentPipeIds;
};

const countPipeColors = (components: ComponentInstance[]): Record<PipeColor, number> => {
  const counts = Object.fromEntries(
    PIPE_COLOR_ORDER.map(color => [color, 0])
  ) as Record<PipeColor, number>;

  components.forEach(component => {
    if (isPipeComponentId(component.componentId)) {
      counts[normalizePipeColor(component.color)] += 1;
    }
  });

  return counts;
};

const choosePipeColor = (
  instanceId: string,
  adjacentPipeIds: Set<string>,
  componentById: Map<string, ComponentInstance>,
  globalColorCounts: Record<PipeColor, number>
): PipeColor => {
  const adjacentColorCounts = Object.fromEntries(
    PIPE_COLOR_ORDER.map(color => [color, 0])
  ) as Record<PipeColor, number>;

  adjacentPipeIds.forEach(pipeId => {
    const adjacentPipe = componentById.get(pipeId);
    if (
      !adjacentPipe ||
      !isPipeComponentId(adjacentPipe.componentId) ||
      !isPipeColor(adjacentPipe.color)
    ) {
      return;
    }
    adjacentColorCounts[adjacentPipe.color] += 1;
  });

  const availableColors = PIPE_COLOR_ORDER.filter(color => adjacentColorCounts[color] === 0);
  const candidates = availableColors.length > 0 ? availableColors : PIPE_COLOR_ORDER;
  const hashOffset = stableHash(instanceId) % PIPE_COLOR_ORDER.length;

  return [...candidates].sort((left, right) => {
    if (availableColors.length === 0) {
      const adjacentDiff = adjacentColorCounts[left] - adjacentColorCounts[right];
      if (adjacentDiff !== 0) return adjacentDiff;
    }

    const globalDiff = globalColorCounts[left] - globalColorCounts[right];
    if (globalDiff !== 0) return globalDiff;

    const leftOrder = (PIPE_COLOR_ORDER.indexOf(left) - hashOffset + PIPE_COLOR_ORDER.length) % PIPE_COLOR_ORDER.length;
    const rightOrder = (PIPE_COLOR_ORDER.indexOf(right) - hashOffset + PIPE_COLOR_ORDER.length) % PIPE_COLOR_ORDER.length;
    return leftOrder - rightOrder;
  })[0];
};

export const assignAutomaticPipeColors = ({
  existingComponents,
  existingConnections,
  newComponents,
  newConnections = [],
  mode = DEFAULT_PIPE_COLOR_MODE,
  preserveExplicitNewColors = true,
}: AssignAutomaticPipeColorsInput): ComponentInstance[] => {
  const normalizedMode = normalizePipeColorMode(mode);
  if (newComponents.length === 0) return [];

  if (normalizedMode === 'blue') {
    return newComponents.map(component =>
      isPipeComponentId(component.componentId)
        ? { ...component, color: DEFAULT_PIPE_COLOR }
        : component
    );
  }

  const existingNormalized = existingComponents.map(normalizeComponentInstanceColor);
  const assignedComponents = newComponents.map(component => {
    if (!isPipeComponentId(component.componentId)) return component;
    if (preserveExplicitNewColors && isPipeColor(component.color)) return component;
    return { ...component, color: undefined };
  });
  const componentById = new Map(
    [...existingNormalized, ...assignedComponents].map(component => [component.instanceId, component])
  );
  const allConnections = [...existingConnections, ...newConnections];
  const adjacencyIndex = createPipeAdjacencyIndex(
    [...existingNormalized, ...assignedComponents],
    allConnections
  );
  const globalColorCounts = countPipeColors(existingNormalized);

  return assignedComponents.map(component => {
    if (!isPipeComponentId(component.componentId)) return component;

    const explicitColor = preserveExplicitNewColors && isPipeColor(component.color)
      ? component.color
      : undefined;
    const color = explicitColor ?? choosePipeColor(
      component.instanceId,
      adjacencyIndex.get(component.instanceId) ?? new Set<string>(),
      componentById,
      globalColorCounts
    );
    const nextComponent = { ...component, color };
    componentById.set(component.instanceId, nextComponent);
    globalColorCounts[color] += 1;
    return nextComponent;
  });
};
