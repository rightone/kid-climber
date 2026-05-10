import * as THREE from 'three';

// 模型缓存
const modelCache = new Map<string, THREE.BufferGeometry>();

// 管子参数
export interface PipeParams {
  length: number;
  diameter: number;
  wallThickness?: number;
  segments?: number;
}

// 弯头参数
export interface ElbowParams {
  angle: number;
  diameter: number;
  bendRadius?: number;
  wallThickness?: number;
  segments?: number;
}

// 三通参数
export interface TeeParams {
  diameter: number;
  branchAngle?: number;
  wallThickness?: number;
  segments?: number;
}

// 平台参数
export interface PlatformParams {
  width: number;
  height: number;
  depth?: number;
  cornerRadius?: number;
}

// 创建管子几何体
export const createPipeGeometry = (params: PipeParams): THREE.BufferGeometry => {
  const cacheKey = `pipe_${params.length}_${params.diameter}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { length, diameter, wallThickness = 0.2, segments = 32 } = params;
  const radius = diameter / 2;
  const innerRadius = radius - wallThickness;
  
  // 创建外管
  const outerGeometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  
  // 创建内管
  const innerGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, length, segments);
  
  // 合并几何体
  const geometry = mergeGeometries([outerGeometry, innerGeometry]);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建弯头几何体
export const createElbowGeometry = (params: ElbowParams): THREE.BufferGeometry => {
  const cacheKey = `elbow_${params.angle}_${params.diameter}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { angle, diameter, bendRadius = diameter * 2, segments = 32 } = params;
  const radius = diameter / 2;
  
  // 创建弯曲管道
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -bendRadius),
    new THREE.Vector3(0, bendRadius * Math.sin(angle * Math.PI / 180), -bendRadius * Math.cos(angle * Math.PI / 180)),
    new THREE.Vector3(bendRadius * Math.sin(angle * Math.PI / 180), bendRadius * Math.sin(angle * Math.PI / 180), 0),
  ]);
  
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建三通几何体
export const createTeeGeometry = (params: TeeParams): THREE.BufferGeometry => {
  const cacheKey = `tee_${params.diameter}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { diameter, branchAngle = 90, segments = 32 } = params;
  const radius = diameter / 2;
  const length = diameter * 3;
  
  // 主管
  const mainPipe = new THREE.CylinderGeometry(radius, radius, length, segments);
  
  // 分支管
  const branchPipe = new THREE.CylinderGeometry(radius, radius, length / 2, segments);
  branchPipe.rotateZ(Math.PI / 2);
  branchPipe.translate(length / 4, 0, 0);
  
  // 合并几何体
  const geometry = mergeGeometries([mainPipe, branchPipe]);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建四通几何体
export const createCrossGeometry = (params: TeeParams): THREE.BufferGeometry => {
  const cacheKey = `cross_${params.diameter}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { diameter, segments = 32 } = params;
  const radius = diameter / 2;
  const length = diameter * 3;
  
  // 主管
  const mainPipe = new THREE.CylinderGeometry(radius, radius, length, segments);
  
  // 分支管1
  const branch1 = new THREE.CylinderGeometry(radius, radius, length / 2, segments);
  branch1.rotateZ(Math.PI / 2);
  branch1.translate(length / 4, 0, 0);
  
  // 分支管2
  const branch2 = new THREE.CylinderGeometry(radius, radius, length / 2, segments);
  branch2.rotateZ(-Math.PI / 2);
  branch2.translate(-length / 4, 0, 0);
  
  // 合并几何体
  const geometry = mergeGeometries([mainPipe, branch1, branch2]);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建平台几何体
export const createPlatformGeometry = (params: PlatformParams): THREE.BufferGeometry => {
  const cacheKey = `platform_${params.width}_${params.height}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { width, height, depth = 2, cornerRadius = 1 } = params;
  
  // 创建圆角矩形形状
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = cornerRadius;
  
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  
  // 挤出几何体
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 3,
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(-Math.PI / 2);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建秋千几何体
export const createSwingGeometry = (params: { width: number; height: number }): THREE.BufferGeometry => {
  const cacheKey = `swing_${params.width}_${params.height}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { width, height } = params;
  const geometries: THREE.BufferGeometry[] = [];
  
  // 顶部横梁
  const topBeam = new THREE.CylinderGeometry(1.5, 1.5, width, 16);
  topBeam.rotateZ(Math.PI / 2);
  topBeam.translate(0, height / 2, 0);
  geometries.push(topBeam);
  
  // 左侧立柱
  const leftPost = new THREE.CylinderGeometry(1, 1, height, 16);
  leftPost.translate(-width / 2, 0, 0);
  geometries.push(leftPost);
  
  // 右侧立柱
  const rightPost = new THREE.CylinderGeometry(1, 1, height, 16);
  rightPost.translate(width / 2, 0, 0);
  geometries.push(rightPost);
  
  // 秋千绳索
  const ropeGeometry = new THREE.CylinderGeometry(0.3, 0.3, height * 0.6, 8);
  ropeGeometry.translate(-width / 4, -height * 0.2, 0);
  geometries.push(ropeGeometry);
  
  const ropeGeometry2 = new THREE.CylinderGeometry(0.3, 0.3, height * 0.6, 8);
  ropeGeometry2.translate(width / 4, -height * 0.2, 0);
  geometries.push(ropeGeometry2);
  
  // 秋千座椅
  const seat = new THREE.BoxGeometry(width * 0.4, 1, 5);
  seat.translate(0, -height * 0.4, 0);
  geometries.push(seat);
  
  const geometry = mergeGeometries(geometries);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建滑梯几何体
export const createSlideGeometry = (params: { width: number; height: number }): THREE.BufferGeometry => {
  const cacheKey = `slide_${params.width}_${params.height}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { width, height } = params;
  const geometries: THREE.BufferGeometry[] = [];
  
  // 滑梯主体（弯曲的管道）
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, height / 2, -20),
    new THREE.Vector3(0, height / 4, 0),
    new THREE.Vector3(0, 0, 20),
  ]);
  
  const slideBody = new THREE.TubeGeometry(curve, 32, width / 2, 8, false);
  geometries.push(slideBody);
  
  // 扶手
  const handrail1 = new THREE.CylinderGeometry(0.5, 0.5, height, 8);
  handrail1.translate(-width / 2, height / 4, 0);
  geometries.push(handrail1);
  
  const handrail2 = new THREE.CylinderGeometry(0.5, 0.5, height, 8);
  handrail2.translate(width / 2, height / 4, 0);
  geometries.push(handrail2);
  
  const geometry = mergeGeometries(geometries);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 创建绳梯几何体
export const createRopeLadderGeometry = (params: { width: number; height: number }): THREE.BufferGeometry => {
  const cacheKey = `rope_ladder_${params.width}_${params.height}`;
  
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }
  
  const { width, height } = params;
  const geometries: THREE.BufferGeometry[] = [];
  
  // 顶部横杆
  const topBar = new THREE.CylinderGeometry(0.8, 0.8, width, 16);
  topBar.rotateZ(Math.PI / 2);
  topBar.translate(0, height / 2, 0);
  geometries.push(topBar);
  
  // 绳索
  const rope1 = new THREE.CylinderGeometry(0.3, 0.3, height, 8);
  rope1.translate(-width / 2, 0, 0);
  geometries.push(rope1);
  
  const rope2 = new THREE.CylinderGeometry(0.3, 0.3, height, 8);
  rope2.translate(width / 2, 0, 0);
  geometries.push(rope2);
  
  // 横档
  const rungs = 8;
  for (let i = 0; i < rungs; i++) {
    const y = -height / 2 + (height / (rungs + 1)) * (i + 1);
    const rung = new THREE.CylinderGeometry(0.5, 0.5, width, 8);
    rung.rotateZ(Math.PI / 2);
    rung.translate(0, y, 0);
    geometries.push(rung);
  }
  
  const geometry = mergeGeometries(geometries);
  
  modelCache.set(cacheKey, geometry);
  return geometry;
};

// 合并几何体
const mergeGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  let indexOffset = 0;
  
  geometries.forEach((geometry) => {
    const posArray = geometry.attributes.position.array;
    const normalArray = geometry.attributes.normal.array;
    const uvArray = geometry.attributes.uv?.array;
    const indexArray = geometry.index?.array;
    
    // 添加顶点
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }
    
    // 添加法线
    for (let i = 0; i < normalArray.length; i++) {
      normals.push(normalArray[i]);
    }
    
    // 添加UV
    if (uvArray) {
      for (let i = 0; i < uvArray.length; i++) {
        uvs.push(uvArray[i]);
      }
    }
    
    // 添加索引
    if (indexArray) {
      for (let i = 0; i < indexArray.length; i++) {
        indices.push(indexArray[i] + indexOffset);
      }
    }
    
    indexOffset += posArray.length / 3;
  });
  
  mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  
  if (uvs.length > 0) {
    mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  
  if (indices.length > 0) {
    mergedGeometry.setIndex(indices);
  }
  
  return mergedGeometry;
};

// 根据组件ID创建几何体
export const createComponentGeometry = (componentId: string, componentDef: any): THREE.BufferGeometry => {
  const [type] = componentId.split('_');
  
  switch (type) {
    case 'pipe':
      return createPipeGeometry({
        length: componentDef.length || 30,
        diameter: componentDef.diameter || 2.5,
      });
      
    case 'elbow':
      return createElbowGeometry({
        angle: componentDef.angle || 90,
        diameter: componentDef.diameter || 2.5,
      });
      
    case 'tee':
      return createTeeGeometry({
        diameter: componentDef.diameter || 2.5,
      });
      
    case 'cross':
      return createCrossGeometry({
        diameter: componentDef.diameter || 2.5,
      });
      
    case 'platform':
      return createPlatformGeometry({
        width: componentDef.width || 30,
        height: componentDef.height || 30,
      });
      
    case 'swing':
      return createSwingGeometry({
        width: componentDef.width || 30,
        height: componentDef.height || 200,
      });
      
    case 'slide':
      return createSlideGeometry({
        width: componentDef.width || 40,
        height: componentDef.height || 150,
      });
      
    case 'rope':
      return createRopeLadderGeometry({
        width: componentDef.width || 30,
        height: componentDef.height || 180,
      });
      
    default:
      // 默认立方体
      return new THREE.BoxGeometry(10, 10, 10);
  }
};

// 清除缓存
export const clearModelCache = (): void => {
  modelCache.clear();
};

// 获取缓存大小
export const getModelCacheSize = (): number => {
  return modelCache.size;
};
