import * as THREE from 'three';

// 创建管子几何体（简化版本，更可靠）
export const createPipeGeometry = (
  length: number,
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  
  // 使用简单的圆柱体
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  
  // 旋转使管子沿Z轴方向
  geometry.rotateX(Math.PI / 2);
  
  return geometry;
};

// 创建弯头几何体
export const createElbowGeometry = (
  _angle: number,
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const bendRadius = diameter * 1.5;
  
  // 创建弯曲路径
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -bendRadius),
    new THREE.Vector3(0, bendRadius * 0.7, -bendRadius * 0.7),
    new THREE.Vector3(0, bendRadius, 0),
  ]);
  
  // 使用管道几何体
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  
  return geometry;
};

// 创建三通几何体
export const createTeeGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const length = diameter * 3;
  
  // 创建组
  const group = new THREE.Group();
  
  // 主管（沿Z轴）
  const mainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments)
  );
  mainPipe.rotation.x = Math.PI / 2;
  group.add(mainPipe);
  
  // 分支管（沿X轴）
  const branchPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length / 2, segments)
  );
  branchPipe.rotation.z = Math.PI / 2;
  branchPipe.position.x = length / 4;
  group.add(branchPipe);
  
  // 合并几何体
  const geometry = mergeGroupGeometry(group);
  
  return geometry;
};

// 创建四通几何体
export const createCrossGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const length = diameter * 3;
  
  const group = new THREE.Group();
  
  // 主管（Z轴）
  const mainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments)
  );
  mainPipe.rotation.x = Math.PI / 2;
  group.add(mainPipe);
  
  // 分支1（X轴正方向）
  const branch1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length / 2, segments)
  );
  branch1.rotation.z = Math.PI / 2;
  branch1.position.x = length / 4;
  group.add(branch1);
  
  // 分支2（X轴负方向）
  const branch2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length / 2, segments)
  );
  branch2.rotation.z = -Math.PI / 2;
  branch2.position.x = -length / 4;
  group.add(branch2);
  
  const geometry = mergeGroupGeometry(group);
  
  return geometry;
};

// 创建平台几何体
export const createPlatformGeometry = (
  width: number,
  height: number,
  depth: number = 2
): THREE.BufferGeometry => {
  const geometry = new THREE.BoxGeometry(width, depth, height);
  return geometry;
};

// 创建秋千几何体
export const createSwingGeometry = (
  width: number,
  height: number
): THREE.BufferGeometry => {
  const group = new THREE.Group();
  
  // 顶部横梁
  const topBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, width, 8)
  );
  topBeam.rotation.z = Math.PI / 2;
  topBeam.position.y = height / 2;
  group.add(topBeam);
  
  // 左侧立柱
  const leftPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, height, 8)
  );
  leftPost.position.x = -width / 2;
  group.add(leftPost);
  
  // 右侧立柱
  const rightPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, height, 8)
  );
  rightPost.position.x = width / 2;
  group.add(rightPost);
  
  // 秋千绳索
  const rope1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, height * 0.6, 6)
  );
  rope1.position.set(-width / 4, -height * 0.2, 0);
  group.add(rope1);
  
  const rope2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, height * 0.6, 6)
  );
  rope2.position.set(width / 4, -height * 0.2, 0);
  group.add(rope2);
  
  // 座椅
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.4, 1, 5)
  );
  seat.position.y = -height * 0.4;
  group.add(seat);
  
  const geometry = mergeGroupGeometry(group);
  
  return geometry;
};

// 创建滑梯几何体
export const createSlideGeometry = (
  width: number,
  height: number
): THREE.BufferGeometry => {
  const group = new THREE.Group();
  
  // 滑梯主体（弯曲的管道）
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, height / 2, -20),
    new THREE.Vector3(0, height / 4, 0),
    new THREE.Vector3(0, 0, 20),
  ]);
  
  const slideBody = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, width / 2, 8, false)
  );
  group.add(slideBody);
  
  // 扶手
  const handrail1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, height, 8)
  );
  handrail1.position.set(-width / 2, height / 4, 0);
  group.add(handrail1);
  
  const handrail2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, height, 8)
  );
  handrail2.position.set(width / 2, height / 4, 0);
  group.add(handrail2);
  
  const geometry = mergeGroupGeometry(group);
  
  return geometry;
};

// 创建绳梯几何体
export const createRopeLadderGeometry = (
  width: number,
  height: number
): THREE.BufferGeometry => {
  const group = new THREE.Group();
  
  // 顶部横杆
  const topBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, width, 8)
  );
  topBar.rotation.z = Math.PI / 2;
  topBar.position.y = height / 2;
  group.add(topBar);
  
  // 左侧绳索
  const rope1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, height, 6)
  );
  rope1.position.x = -width / 2;
  group.add(rope1);
  
  // 右侧绳索
  const rope2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, height, 6)
  );
  rope2.position.x = width / 2;
  group.add(rope2);
  
  // 横档
  const rungs = 8;
  for (let i = 0; i < rungs; i++) {
    const y = -height / 2 + (height / (rungs + 1)) * (i + 1);
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, width, 6)
    );
    rung.rotation.z = Math.PI / 2;
    rung.position.y = y;
    group.add(rung);
  }
  
  const geometry = mergeGroupGeometry(group);
  
  return geometry;
};

// 合并Group的几何体
const mergeGroupGeometry = (group: THREE.Group): THREE.BufferGeometry => {
  const geometries: THREE.BufferGeometry[] = [];
  
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      // 克隆几何体并应用变换
      const geo = child.geometry.clone();
      child.updateMatrix();
      geo.applyMatrix4(child.matrix);
      geometries.push(geo);
    }
  });
  
  if (geometries.length === 0) {
    return new THREE.BoxGeometry(10, 10, 10);
  }
  
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  // 合并所有几何体
  return mergeGeometries(geometries);
};

// 合并多个几何体
const mergeGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  let indexOffset = 0;
  
  geometries.forEach((geometry) => {
    const posArray = geometry.attributes.position.array;
    const normalArray = geometry.attributes.normal.array;
    const indexArray = geometry.index?.array;
    
    // 添加顶点
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }
    
    // 添加法线
    for (let i = 0; i < normalArray.length; i++) {
      normals.push(normalArray[i]);
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
  
  if (indices.length > 0) {
    mergedGeometry.setIndex(indices);
  }
  
  return mergedGeometry;
};

// 根据组件类型创建几何体
export const createComponentGeometry = (
  componentId: string,
  componentDef: any
): THREE.BufferGeometry => {
  const [type] = componentId.split('_');
  
  switch (type) {
    case 'pipe':
      return createPipeGeometry(
        componentDef.length || 30,
        componentDef.diameter || 2.5
      );
      
    case 'elbow':
      return createElbowGeometry(
        componentDef.angle || 90,
        componentDef.diameter || 2.5
      );
      
    case 'tee':
      return createTeeGeometry(
        componentDef.diameter || 2.5
      );
      
    case 'cross':
      return createCrossGeometry(
        componentDef.diameter || 2.5
      );
      
    case 'platform':
      return createPlatformGeometry(
        componentDef.width || 30,
        componentDef.height || 30
      );
      
    case 'swing':
      return createSwingGeometry(
        componentDef.width || 30,
        componentDef.height || 200
      );
      
    case 'slide':
      return createSlideGeometry(
        componentDef.width || 40,
        componentDef.height || 150
      );
      
    case 'rope':
      return createRopeLadderGeometry(
        componentDef.width || 30,
        componentDef.height || 180
      );
      
    default:
      // 默认立方体
      return new THREE.BoxGeometry(10, 10, 10);
  }
};

// 创建连接点可视化
export const createConnectionPointGeometry = (
  type: 'socket' | 'plug',
  size: number = 2
): THREE.BufferGeometry => {
  if (type === 'socket') {
    return new THREE.TorusGeometry(size, size * 0.3, 8, 16);
  } else {
    return new THREE.SphereGeometry(size * 0.5, 16, 16);
  }
};

// 计算连接点的世界坐标
export const getConnectionPointWorldPosition = (
  componentPosition: [number, number, number],
  componentRotation: [number, number, number],
  connectionPoint: { position: [number, number, number] }
): THREE.Vector3 => {
  const matrix = new THREE.Matrix4();
  
  const euler = new THREE.Euler(
    (componentRotation[0] * Math.PI) / 180,
    (componentRotation[1] * Math.PI) / 180,
    (componentRotation[2] * Math.PI) / 180
  );
  
  matrix.makeRotationFromEuler(euler);
  matrix.setPosition(componentPosition[0], componentPosition[1], componentPosition[2]);
  
  const point = new THREE.Vector3(
    connectionPoint.position[0],
    connectionPoint.position[1],
    connectionPoint.position[2]
  );
  
  point.applyMatrix4(matrix);
  
  return point;
};

// 检查两个连接点是否可以连接
export const canConnect = (
  point1: { type: string; compatible: string[] },
  point2: { type: string; compatible: string[] },
  distance: number,
  maxDistance: number = 5
): boolean => {
  if (distance > maxDistance) {
    return false;
  }
  
  return (
    point1.compatible.includes(point2.type) ||
    point2.compatible.includes(point1.type)
  );
};

// 计算连接时的对齐变换
export const calculateAlignmentTransform = (
  sourcePosition: [number, number, number],
  sourceRotation: [number, number, number],
  sourcePoint: { position: [number, number, number]; direction: [number, number, number] },
  targetPoint: { position: [number, number, number]; direction: [number, number, number] }
): { position: [number, number, number]; rotation: [number, number, number] } => {
  const sourceWorldPos = getConnectionPointWorldPosition(
    sourcePosition,
    sourceRotation,
    sourcePoint
  );
  
  const targetPosition: [number, number, number] = [
    sourceWorldPos.x - targetPoint.position[0],
    sourceWorldPos.y - targetPoint.position[1],
    sourceWorldPos.z - targetPoint.position[2],
  ];
  
  const sourceDir = new THREE.Vector3(
    sourcePoint.direction[0],
    sourcePoint.direction[1],
    sourcePoint.direction[2]
  ).normalize();
  
  const targetDir = new THREE.Vector3(
    targetPoint.direction[0],
    targetPoint.direction[1],
    targetPoint.direction[2]
  ).normalize();
  
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(targetDir, sourceDir.negate());
  
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  
  const targetRotation: [number, number, number] = [
    (euler.x * 180) / Math.PI + sourceRotation[0],
    (euler.y * 180) / Math.PI + sourceRotation[1],
    (euler.z * 180) / Math.PI + sourceRotation[2],
  ];
  
  return {
    position: targetPosition,
    rotation: targetRotation,
  };
};

// 清除模型缓存
export const clearModelCache = (): void => {
  // 暂时不需要缓存
};

// 获取缓存大小
export const getModelCacheSize = (): number => {
  return 0;
};
