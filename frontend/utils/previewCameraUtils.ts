import * as THREE from 'three';

export interface PreviewCameraFit {
  center: [number, number, number];
  position: [number, number, number];
  near: number;
  far: number;
  gridSize: number;
}

export type PreviewCameraView = 'isometric' | 'front' | 'right' | 'top';

export interface GuideCameraFit extends PreviewCameraFit {
  fov: number;
  up: [number, number, number];
}

const DEFAULT_CENTER: [number, number, number] = [0, 0, 0];
const DEFAULT_POSITION: [number, number, number] = [72, 54, 72];
const DEFAULT_DIRECTION = new THREE.Vector3(1, 0.72, 1).normalize();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const isFiniteVector = (vector: THREE.Vector3): boolean =>
  Number.isFinite(vector.x) &&
  Number.isFinite(vector.y) &&
  Number.isFinite(vector.z);

const getBoundsCorners = (bounds: THREE.Box3): THREE.Vector3[] => {
  const { min, max } = bounds;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
};

const createFallbackFit = (): PreviewCameraFit => ({
  center: DEFAULT_CENTER,
  position: DEFAULT_POSITION,
  near: 0.1,
  far: 500,
  gridSize: 80,
});

const calculateFitForDirection = (
  bounds: THREE.Box3,
  aspect: number,
  fov: number,
  margin: number,
  requestedDirection: THREE.Vector3,
  requestedUp: THREE.Vector3
): PreviewCameraFit => {
  if (bounds.isEmpty()) return createFallbackFit();

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (!isFiniteVector(center) || !isFiniteVector(size)) return createFallbackFit();

  const direction = requestedDirection.clone().normalize();
  const up = requestedUp.clone().normalize();
  if (!isFiniteVector(direction) || direction.lengthSq() < 0.5) {
    direction.copy(DEFAULT_DIRECTION);
  }
  if (!isFiniteVector(up) || up.lengthSq() < 0.5) up.copy(WORLD_UP);

  const right = new THREE.Vector3().crossVectors(up, direction).normalize();
  if (right.lengthSq() < 0.5) right.set(1, 0, 0);
  const cameraUp = new THREE.Vector3().crossVectors(direction, right).normalize();
  const safeAspect = Math.max(Number.isFinite(aspect) ? aspect : 1, 0.1);
  const safeFov = THREE.MathUtils.clamp(Number.isFinite(fov) ? fov : 42, 10, 120);
  const verticalHalfFov = THREE.MathUtils.degToRad(safeFov) / 2;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect);
  const horizontalTangent = Math.max(Math.tan(horizontalHalfFov), 0.05);
  const verticalTangent = Math.max(Math.tan(verticalHalfFov), 0.05);
  const safeMargin = Math.max(Number.isFinite(margin) ? margin : 1.3, 1.05);
  let distance = 0;
  let minDepthOffset = Number.POSITIVE_INFINITY;
  let maxDepthOffset = Number.NEGATIVE_INFINITY;

  getBoundsCorners(bounds).forEach(corner => {
    const offset = corner.sub(center);
    const depthOffset = offset.dot(direction);
    minDepthOffset = Math.min(minDepthOffset, depthOffset);
    maxDepthOffset = Math.max(maxDepthOffset, depthOffset);
    distance = Math.max(
      distance,
      Math.abs(offset.dot(right)) * safeMargin / horizontalTangent + depthOffset,
      Math.abs(offset.dot(cameraUp)) * safeMargin / verticalTangent + depthOffset
    );
  });

  const sceneRadius = Math.max(size.length() / 2, 4);
  distance = Math.max(distance, sceneRadius * 1.1, 8);
  const position = center.clone().addScaledVector(direction, distance);
  const closestDepth = Math.max(0.1, distance - maxDepthOffset);
  const farthestDepth = Math.max(closestDepth + 1, distance - minDepthOffset);
  const depthPadding = Math.max(sceneRadius * 0.6, 10);
  const near = Math.max(0.1, closestDepth - depthPadding);
  const far = Math.max(near + 100, farthestDepth + depthPadding * 2);
  const horizontalExtent = Math.max(size.x, size.z, 1);
  const gridSize = Math.max(40, Math.ceil((horizontalExtent * 1.5) / 20) * 20);

  return {
    center: center.toArray() as [number, number, number],
    position: position.toArray() as [number, number, number],
    near,
    far,
    gridSize,
  };
};

export const calculatePreviewCameraFit = (
  bounds: THREE.Box3,
  aspect: number,
  fov: number,
  margin = 1.3
): PreviewCameraFit => {
  return calculateFitForDirection(
    bounds,
    aspect,
    fov,
    margin,
    DEFAULT_DIRECTION,
    WORLD_UP
  );
};

const GUIDE_VIEW_CONFIG: Record<
  PreviewCameraView,
  { direction: THREE.Vector3; up: THREE.Vector3; fov: number }
> = {
  isometric: {
    direction: DEFAULT_DIRECTION,
    up: WORLD_UP,
    fov: 38,
  },
  front: {
    direction: new THREE.Vector3(0, 0, 1),
    up: WORLD_UP,
    fov: 32,
  },
  right: {
    direction: new THREE.Vector3(1, 0, 0),
    up: WORLD_UP,
    fov: 32,
  },
  top: {
    direction: new THREE.Vector3(0, 1, 0),
    up: new THREE.Vector3(0, 0, -1),
    fov: 32,
  },
};

export const calculateGuideCameraFit = (
  bounds: THREE.Box3,
  aspect: number,
  view: PreviewCameraView = 'isometric',
  margin = 1.28
): GuideCameraFit => {
  const config = GUIDE_VIEW_CONFIG[view];
  const fit = calculateFitForDirection(
    bounds,
    aspect,
    config.fov,
    margin,
    config.direction,
    config.up
  );
  return {
    ...fit,
    fov: config.fov,
    up: config.up.toArray() as [number, number, number],
  };
};
