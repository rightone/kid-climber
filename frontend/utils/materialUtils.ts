import * as THREE from 'three';

// 材质配置
export interface MaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

// 预设材质
export const presetMaterials: Record<string, MaterialConfig> = {
  // 金属管材
  metalPipe: {
    color: '#c0c0c0',
    roughness: 0.3,
    metalness: 0.8,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 塑料管材
  plasticPipe: {
    color: '#4ecdc4',
    roughness: 0.6,
    metalness: 0.1,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 木材平台
  woodPlatform: {
    color: '#deb887',
    roughness: 0.8,
    metalness: 0.05,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 塑料平台
  plasticPlatform: {
    color: '#96ceb4',
    roughness: 0.5,
    metalness: 0.1,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 橡胶（秋千座椅）
  rubber: {
    color: '#333333',
    roughness: 0.9,
    metalness: 0.02,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 绳索
  rope: {
    color: '#8B4513',
    roughness: 0.95,
    metalness: 0.01,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 金属连接件
  metalConnector: {
    color: '#a0a0a0',
    roughness: 0.25,
    metalness: 0.9,
    opacity: 1,
    transparent: false,
    wireframe: false,
  },
  
  // 选中状态
  selected: {
    color: '#ff6b6b',
    roughness: 0.4,
    metalness: 0.3,
    opacity: 0.9,
    transparent: true,
    wireframe: false,
    emissive: '#ff0000',
    emissiveIntensity: 0.3,
  },
  
  // 悬停状态
  hovered: {
    color: '#ffd93d',
    roughness: 0.4,
    metalness: 0.3,
    opacity: 0.9,
    transparent: true,
    wireframe: false,
    emissive: '#ffcc00',
    emissiveIntensity: 0.2,
  },
  
  // 线框模式
  wireframe: {
    color: '#1890ff',
    roughness: 0.5,
    metalness: 0.5,
    opacity: 0.8,
    transparent: true,
    wireframe: true,
  },
  
  // X光模式
  xray: {
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.5,
    opacity: 0.3,
    transparent: true,
    wireframe: false,
  },
};

// 材质缓存
const materialCache = new Map<string, THREE.Material>();

// 创建材质
export const createMaterial = (config: MaterialConfig): THREE.Material => {
  const cacheKey = JSON.stringify(config);
  
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!;
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.color),
    roughness: config.roughness,
    metalness: config.metalness,
    opacity: config.opacity,
    transparent: config.transparent,
    wireframe: config.wireframe,
    emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
    emissiveIntensity: config.emissiveIntensity,
    side: THREE.DoubleSide,
  });
  
  materialCache.set(cacheKey, material);
  return material;
};

// 获取组件材质
export const getComponentMaterial = (
  componentId: string,
  isSelected: boolean = false,
  isHovered: boolean = false,
  viewMode: string = 'realistic'
): THREE.Material => {
  // 根据视图模式
  if (viewMode === 'wireframe') {
    return createMaterial(presetMaterials.wireframe);
  }
  
  if (viewMode === 'xray') {
    return createMaterial(presetMaterials.xray);
  }
  
  // 根据状态
  if (isSelected) {
    return createMaterial(presetMaterials.selected);
  }
  
  if (isHovered) {
    return createMaterial(presetMaterials.hovered);
  }
  
  // 根据组件类型
  const [type] = componentId.split('_');
  
  switch (type) {
    case 'pipe':
      return createMaterial(presetMaterials.metalPipe);
    case 'elbow':
    case 'tee':
    case 'cross':
      return createMaterial(presetMaterials.metalConnector);
    case 'platform':
      return createMaterial(presetMaterials.plasticPlatform);
    case 'swing':
    case 'slide':
      return createMaterial(presetMaterials.rubber);
    case 'rope':
      return createMaterial(presetMaterials.rope);
    default:
      return createMaterial(presetMaterials.metalPipe);
  }
};

// 获取连接点材质
export const getConnectionPointMaterial = (type: string): THREE.Material => {
  if (type === 'socket') {
    return createMaterial({
      color: '#ff6b6b',
      roughness: 0.5,
      metalness: 0.5,
      opacity: 0.8,
      transparent: true,
      wireframe: false,
    });
  }
  
  return createMaterial({
    color: '#52c41a',
    roughness: 0.5,
    metalness: 0.5,
    opacity: 0.8,
    transparent: true,
    wireframe: false,
  });
};

// 清除材质缓存
export const clearMaterialCache = (): void => {
  materialCache.forEach((material) => {
    material.dispose();
  });
  materialCache.clear();
};

// 更新材质
export const updateMaterial = (
  material: THREE.Material,
  config: Partial<MaterialConfig>
): void => {
  if (material instanceof THREE.MeshStandardMaterial) {
    if (config.color) material.color.set(config.color);
    if (config.roughness !== undefined) material.roughness = config.roughness;
    if (config.metalness !== undefined) material.metalness = config.metalness;
    if (config.opacity !== undefined) material.opacity = config.opacity;
    if (config.transparent !== undefined) material.transparent = config.transparent;
    if (config.wireframe !== undefined) material.wireframe = config.wireframe;
    if (config.emissive) material.emissive.set(config.emissive);
    if (config.emissiveIntensity !== undefined) material.emissiveIntensity = config.emissiveIntensity;
    
    material.needsUpdate = true;
  }
};

// 创建渐变材质
export const createGradientMaterial = (
  color1: string,
  color2: string,
  direction: 'horizontal' | 'vertical' = 'vertical'
): THREE.Material => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  
  const context = canvas.getContext('2d')!;
  const gradient = direction === 'vertical'
    ? context.createLinearGradient(0, 0, 0, 256)
    : context.createLinearGradient(0, 0, 256, 0);
  
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  
  const texture = new THREE.CanvasTexture(canvas);
  
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.5,
  });
};

// 创建纹理材质
export const createTextureMaterial = (texturePath: string): THREE.Material => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(texturePath);
  
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.7,
    metalness: 0.1,
  });
};

// 材质预设
export const materialPresets = {
  // 金属材质
  metal: {
    shiny: { roughness: 0.2, metalness: 0.9 },
    brushed: { roughness: 0.4, metalness: 0.8 },
    matte: { roughness: 0.8, metalness: 0.3 },
  },
  
  // 塑料材质
  plastic: {
    glossy: { roughness: 0.3, metalness: 0.1 },
    matte: { roughness: 0.7, metalness: 0.05 },
    transparent: { roughness: 0.2, metalness: 0.1, opacity: 0.5 },
  },
  
  // 木材材质
  wood: {
    smooth: { roughness: 0.6, metalness: 0.05 },
    rough: { roughness: 0.9, metalness: 0.02 },
  },
  
  // 橡胶材质
  rubber: {
    soft: { roughness: 0.95, metalness: 0.02 },
    hard: { roughness: 0.8, metalness: 0.05 },
  },
};
