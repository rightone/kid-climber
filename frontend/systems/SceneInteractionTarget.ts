export const GROWTH_HANDLE_USER_DATA_KEY = 'endpointGrowthHandle';

export const GROWTH_HANDLE_USER_DATA = {
  [GROWTH_HANDLE_USER_DATA_KEY]: true,
} as const;

export type SceneInteractionTarget =
  | { type: 'component'; instanceId: string }
  | { type: 'growth-handle' }
  | null;

export interface SceneObjectLike {
  userData?: Record<string, unknown>;
  parent?: SceneObjectLike | null;
}

export const classifySceneInteractionTarget = (
  object: SceneObjectLike | null | undefined
): SceneInteractionTarget => {
  let current: SceneObjectLike | null | undefined = object;

  while (current) {
    if (current.userData?.[GROWTH_HANDLE_USER_DATA_KEY] === true) {
      return { type: 'growth-handle' };
    }

    const instanceId = current.userData?.instanceId;
    if (typeof instanceId === 'string' && instanceId.length > 0) {
      return { type: 'component', instanceId };
    }

    current = current.parent;
  }

  return null;
};
