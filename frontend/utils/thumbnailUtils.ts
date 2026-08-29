import * as THREE from 'three';
import { createComponentGeometry } from '../components/3d/utils/geometryUtils';
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../referenceProductSpec';
import { getComponentById } from '../stores/componentLibrary';
import { COMPONENT_COLORS, type ComponentInstance } from '../types';
import {
  assignAutomaticPipeColors,
  normalizePipeColor,
  type PipeColorMode,
} from '../systems/PipeColorSystem';
import type { DesignTemplateV2 } from './templateUtils';
import { calculatePreviewCameraFit } from './previewCameraUtils';

export const getComponentPreviewColor = (component: ComponentInstance): string => {
  if (component.componentId.startsWith('pipe_')) {
    return COMPONENT_COLORS[normalizePipeColor(component.color)].hex;
  }
  if (component.componentId.startsWith('connector_')) return COMPONENT_COLORS.black.hex;
  if (component.componentId.startsWith('board_')) return COMPONENT_COLORS.green.hex;
  if (component.componentId.startsWith('swing_')) return '#f59e0b';
  if (component.componentId.startsWith('slide_')) return '#f97316';
  if (component.componentId.startsWith('rope_')) return '#d97706';
  return '#64748b';
};

// 组件预览渲染器
export const renderComponentThumbnail = (
  componentId: string,
  size: number = 80
): string => {
  const definition = getComponentById(componentId);
  if (!definition) return '';
  
  // 创建离屏渲染器
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);
  
  // 创建场景
  const scene = new THREE.Scene();
  
  // 创建相机
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(30, 30, 30);
  camera.lookAt(0, 0, 0);
  
  // 添加光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);
  
  // 创建组件几何体
  const geometry = createComponentGeometry(componentId, definition);
  
  // 获取颜色
  const getColor = (): string => {
    const [type] = componentId.split('_');
    switch (type) {
      case 'pipe': return COMPONENT_COLORS.blue.hex;
      case 'connector': return COMPONENT_COLORS.black.hex;
      case 'elbow':
      case 'tee':
      case 'cross': return COMPONENT_COLORS.black.hex;
      case 'platform':
      case 'board': return COMPONENT_COLORS.green.hex;
      case 'swing':
      case 'slide':
      case 'rope': return '#feca57';
      default: return '#95a5a6';
    }
  };
  
  const material = new THREE.MeshStandardMaterial({
    color: getColor(),
    roughness: REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness,
    metalness: REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness,
    emissive: getColor(),
    emissiveIntensity: componentId.startsWith('pipe_')
      ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.emissiveIntensity
      : 0,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // 计算包围盒
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVec = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
  
  // 调整相机位置
  const distance = maxDim * 2;
  camera.position.set(distance, distance, distance);
  camera.lookAt(center);
  
  // 渲染
  renderer.render(scene, camera);
  
  // 清理
  geometry.dispose();
  material.dispose();
  renderer.dispose();
  
  // 返回base64图片
  return canvas.toDataURL('image/png');
};

// 组件预览缓存
const thumbnailCache = new Map<string, string>();
const templateThumbnailCache = new Map<string, string>();

// 获取组件缩略图
export const getComponentThumbnail = (componentId: string): string => {
  if (thumbnailCache.has(componentId)) {
    return thumbnailCache.get(componentId)!;
  }
  
  const thumbnail = renderComponentThumbnail(componentId);
  thumbnailCache.set(componentId, thumbnail);
  
  return thumbnail;
};

// 清除缓存
export const clearThumbnailCache = (): void => {
  thumbnailCache.clear();
};

const createTemplateThumbnailKey = (
  template: DesignTemplateV2,
  size: number,
  pipeColorMode: PipeColorMode
): string => {
  const componentSignature = template.components
    .map(component => [
      component.instanceId,
      component.componentId,
      component.position.join(','),
      component.rotation.join(','),
      component.color ?? '',
    ].join(':'))
    .join('|');
  const connectionSignature = template.connections
    .map(connection => [
      connection.id,
      connection.source.componentId,
      connection.source.pointId,
      connection.target.componentId,
      connection.target.pointId,
    ].join(':'))
    .join('|');
  return [
    template.id,
    template.version,
    size,
    pipeColorMode,
    componentSignature,
    connectionSignature,
  ].join('::');
};

export const renderTemplateThumbnail = (
  template: DesignTemplateV2,
  options: { size?: number; pipeColorMode?: PipeColorMode } = {}
): string => {
  if (typeof document === 'undefined' || template.components.length === 0) return '';

  const size = Math.max(48, Math.round(options.size ?? 128));
  const pipeColorMode = options.pipeColorMode ?? 'auto';
  const cacheKey = createTemplateThumbnailKey(template, size, pipeColorMode);
  const cached = templateThumbnailCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0xf8fafc, 1);

  const scene = new THREE.Scene();
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const coloredComponents = assignAutomaticPipeColors({
    existingComponents: [],
    existingConnections: [],
    newComponents: template.components,
    newConnections: template.connections,
    mode: pipeColorMode,
    preserveExplicitNewColors: pipeColorMode !== 'auto',
  });

  coloredComponents.forEach(component => {
    const definition = getComponentById(component.componentId);
    if (!definition) return;
    const geometry = createComponentGeometry(component.componentId, definition, component);
    const color = getComponentPreviewColor(component);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness,
      roughness: REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness,
      emissive: component.componentId.startsWith('pipe_') ? color : '#000000',
      emissiveIntensity: component.componentId.startsWith('pipe_') ? 0.06 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(component.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(component.rotation[0]),
      THREE.MathUtils.degToRad(component.rotation[1]),
      THREE.MathUtils.degToRad(component.rotation[2])
    );
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  });

  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.35));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
  directionalLight.position.set(80, 120, 80);
  scene.add(directionalLight);

  const bounds = new THREE.Box3().setFromObject(group);
  const fit = calculatePreviewCameraFit(bounds, 1, 38, 1.22);
  const camera = new THREE.PerspectiveCamera(38, 1, fit.near, fit.far);
  camera.position.fromArray(fit.position);
  camera.lookAt(new THREE.Vector3().fromArray(fit.center));
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const result = canvas.toDataURL('image/png');
  templateThumbnailCache.set(cacheKey, result);
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  renderer.dispose();
  return result;
};

export const clearTemplateThumbnailCache = (templateId?: string): void => {
  if (!templateId) {
    templateThumbnailCache.clear();
    return;
  }
  [...templateThumbnailCache.keys()]
    .filter(key => key.startsWith(`${templateId}::`))
    .forEach(key => templateThumbnailCache.delete(key));
};

// React组件：组件预览（需要在.tsx文件中使用）
// 这个文件只导出工具函数，React组件在单独的.tsx文件中定义

export default {
  renderComponentThumbnail,
  getComponentThumbnail,
  clearThumbnailCache,
  getComponentPreviewColor,
  renderTemplateThumbnail,
  clearTemplateThumbnailCache,
};
