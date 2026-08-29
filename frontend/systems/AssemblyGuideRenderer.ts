import * as THREE from 'three';
import type { ComponentInstance } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { createComponentGeometry } from '../components/3d/utils/geometryUtils';
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../referenceProductSpec';
import { getComponentPreviewColor } from '../utils/thumbnailUtils';
import { calculateGuideCameraFit } from '../utils/previewCameraUtils';
import type {
  AssemblyConnectionCallout,
  AssemblyGuide,
  AssemblyGuideStep,
} from './AssemblyStepSystem';

export type AssemblyRenderMode = 'cumulative' | 'current-only' | 'final';
export type AssemblyRenderView = 'isometric' | 'front' | 'right' | 'top';

export interface RenderAssemblyGuideImageInput {
  guide: AssemblyGuide;
  components: ComponentInstance[];
  step?: AssemblyGuideStep;
  mode?: AssemblyRenderMode;
  view?: AssemblyRenderView;
  width?: number;
  height?: number;
  includeCallouts?: boolean;
}

export interface AssemblyComponentVisual {
  visible: boolean;
  current: boolean;
  previous: boolean;
  color: string;
  opacity: number;
  outlineColor?: string;
}

const PREVIOUS_COLOR = '#64748B';
const PIPE_OUTLINE = '#1677FF';
const CONNECTOR_OUTLINE = '#F59E0B';

export const resolveAssemblyComponentVisual = (
  component: ComponentInstance,
  step: AssemblyGuideStep | undefined,
  mode: AssemblyRenderMode
): AssemblyComponentVisual => {
  if (mode === 'final' || !step) {
    return {
      visible: true,
      current: true,
      previous: false,
      color: getComponentPreviewColor(component),
      opacity: 1,
    };
  }
  const current = step.newComponentIds.includes(component.instanceId);
  const cumulative = step.cumulativeComponentIds.includes(component.instanceId);
  const previous = cumulative && !current;
  const visible = mode === 'current-only' ? current : cumulative;
  const definition = getComponentById(component.componentId);
  return {
    visible,
    current,
    previous,
    color: previous ? PREVIOUS_COLOR : getComponentPreviewColor(component),
    opacity: previous ? 0.35 : 1,
    outlineColor: current
      ? definition?.category === 'connector'
        ? CONNECTOR_OUTLINE
        : PIPE_OUTLINE
      : undefined,
  };
};

const createCalloutTexture = (callout: AssemblyConnectionCallout) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建搭建标注画布。');
  context.clearRect(0, 0, 128, 128);
  context.beginPath();
  context.arc(64, 64, 48, 0, Math.PI * 2);
  context.fillStyle = '#F59E0B';
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = '#FFFFFF';
  context.stroke();
  context.fillStyle = '#0F172A';
  context.font = '700 52px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(callout.order), 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
    }
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('搭建步骤图片生成失败。'));
    }, 'image/jpeg', quality);
  });

const renderAssemblyGuideImageWithContext = async (
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  {
  guide,
  components,
  step,
  mode = step ? 'cumulative' : 'final',
  view = 'isometric',
  width = 1600,
  height = 900,
  includeCallouts = true,
}: RenderAssemblyGuideImageInput
): Promise<Blob> => {
  if (guide.steps.length === 0) {
    throw new Error('当前教程没有可渲染的搭建步骤。');
  }
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xf4f7fb, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F4F7FB');
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  keyLight.position.set(90, 130, 85);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
  fillLight.position.set(-70, 55, -50);
  scene.add(fillLight);
  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  components.forEach(component => {
    const visual = resolveAssemblyComponentVisual(component, step, mode);
    if (!visual.visible) return;
    const definition = getComponentById(component.componentId);
    if (!definition) return;
    const geometry = createComponentGeometry(component.componentId, definition, component);
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      roughness: definition.type === 'pipe'
        ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness
        : 0.42,
      metalness: definition.type === 'pipe'
        ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness
        : 0.12,
      transparent: visual.opacity < 1,
      opacity: visual.opacity,
      depthWrite: visual.opacity >= 1,
      emissive: definition.type === 'pipe' && !visual.previous ? visual.color : '#000000',
      emissiveIntensity: definition.type === 'pipe' && !visual.previous ? 0.06 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(component.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(component.rotation[0]),
      THREE.MathUtils.degToRad(component.rotation[1]),
      THREE.MathUtils.degToRad(component.rotation[2])
    );
    mesh.scale.fromArray(component.scale);
    modelGroup.add(mesh);
    if (visual.outlineColor) {
      const outlineGeometry = new THREE.EdgesGeometry(geometry, 18);
      const outlineMaterial = new THREE.LineBasicMaterial({
        color: visual.outlineColor,
        transparent: true,
        opacity: 0.95,
      });
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      outline.scale.copy(mesh.scale);
      modelGroup.add(outline);
    }
  });

  modelGroup.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(modelGroup);
  if (bounds.isEmpty()) {
    disposeScene(scene);
    throw new Error('当前步骤没有可渲染的组件。');
  }
  const fit = calculateGuideCameraFit(bounds, width / height, view);
  const center = new THREE.Vector3().fromArray(fit.center);
  const grid = new THREE.GridHelper(
    fit.gridSize,
    Math.max(4, Math.round(fit.gridSize / 20)),
    '#94A3B8',
    '#D8E0EA'
  );
  grid.position.set(
    center.x,
    bounds.min.y - Math.max(1.2, fit.gridSize * 0.01),
    center.z
  );
  scene.add(grid);

  if (includeCallouts && step) {
    const calloutGroup = new THREE.Group();
    step.callouts.forEach(callout => {
      const texture = createCalloutTexture(callout);
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const marker = new THREE.Sprite(material);
      marker.position.set(callout.position[0], callout.position[1] + 4, callout.position[2]);
      marker.scale.set(7, 7, 1);
      marker.renderOrder = 20;
      calloutGroup.add(marker);
    });
    scene.add(calloutGroup);
  }

  const camera = new THREE.PerspectiveCamera(
    fit.fov,
    width / height,
    fit.near,
    fit.far
  );
  camera.position.fromArray(fit.position);
  camera.up.fromArray(fit.up);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const blob = await canvasToBlob(canvas, 0.9);
  disposeScene(scene);
  return blob;
};

export interface AssemblyGuideImageRenderer {
  render: (input: RenderAssemblyGuideImageInput) => Promise<Blob>;
  dispose: () => void;
}

export const createAssemblyGuideImageRenderer = (
  width = 1600,
  height = 900
): AssemblyGuideImageRenderer => {
  if (typeof document === 'undefined') {
    throw new Error('搭建步骤图片只能在浏览器中生成。');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  let disposed = false;
  return {
    render: input => {
      if (disposed) throw new Error('搭建教程渲染器已经释放。');
      return renderAssemblyGuideImageWithContext(renderer, canvas, {
        ...input,
        width: input.width ?? width,
        height: input.height ?? height,
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.width = 1;
      canvas.height = 1;
    },
  };
};

export const renderAssemblyGuideImage = async (
  input: RenderAssemblyGuideImageInput
): Promise<Blob> => {
  const renderer = createAssemblyGuideImageRenderer(input.width, input.height);
  try {
    return await renderer.render(input);
  } finally {
    renderer.dispose();
  }
};
