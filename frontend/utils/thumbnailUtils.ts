import * as THREE from 'three';
import { createComponentGeometry } from '../components/3d/utils/geometryUtils';
import { getComponentById } from '../stores/componentLibrary';

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
      case 'pipe': return '#4ecdc4';
      case 'connector': return '#333333';
      case 'elbow':
      case 'tee':
      case 'cross': return '#333333';
      case 'platform':
      case 'board': return '#96ceb4';
      case 'swing':
      case 'slide':
      case 'rope': return '#feca57';
      default: return '#95a5a6';
    }
  };
  
  const material = new THREE.MeshStandardMaterial({
    color: getColor(),
    roughness: 0.4,
    metalness: 0.3,
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

// React组件：组件预览（需要在.tsx文件中使用）
// 这个文件只导出工具函数，React组件在单独的.tsx文件中定义

export default {
  renderComponentThumbnail,
  getComponentThumbnail,
  clearThumbnailCache,
};
