import * as THREE from 'three';

// ============ 管件几何体 ============

// 创建管子几何体
export const createPipeGeometry = (
  length: number,
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

// ============ 接头几何体 ============

// 创建一字接头（直通）
export const createStraightConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const length = diameter * 2; // 接头长度是直径的2倍
  
  // 主体圆柱
  const geometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, length, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

// 创建L型接头（90度弯头）
export const createLConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // 水平臂
  const horizontalArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  horizontalArm.rotation.z = Math.PI / 2;
  horizontalArm.position.x = armLength / 2;
  group.add(horizontalArm);
  
  // 垂直臂
  const verticalArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  verticalArm.position.y = armLength / 2;
  group.add(verticalArm);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建T型接头（三通）
export const createTConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // 主管（水平）
  const mainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength * 2, segments)
  );
  mainPipe.rotation.z = Math.PI / 2;
  group.add(mainPipe);
  
  // 分支管（向上）
  const branchPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  branchPipe.position.y = armLength / 2;
  group.add(branchPipe);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建45度接头
export const create45DegConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // 水平臂
  const horizontalArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  horizontalArm.rotation.z = Math.PI / 2;
  horizontalArm.position.x = armLength / 2;
  group.add(horizontalArm);
  
  // 45度臂
  const angledArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  angledArm.rotation.z = Math.PI / 4;
  angledArm.position.set(armLength / 2 * Math.cos(Math.PI / 4), armLength / 2 * Math.sin(Math.PI / 4), 0);
  group.add(angledArm);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建三向接头
export const create3WayConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // X轴臂
  const xArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm.rotation.z = Math.PI / 2;
  xArm.position.x = armLength / 2;
  group.add(xArm);
  
  // Y轴臂
  const yArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  yArm.position.y = armLength / 2;
  group.add(yArm);
  
  // Z轴臂
  const zArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm.rotation.x = Math.PI / 2;
  zArm.position.z = armLength / 2;
  group.add(zArm);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建四向接头
export const create4WayConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // X轴正方向
  const xArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm1.rotation.z = Math.PI / 2;
  xArm1.position.x = armLength / 2;
  group.add(xArm1);
  
  // X轴负方向
  const xArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm2.rotation.z = Math.PI / 2;
  xArm2.position.x = -armLength / 2;
  group.add(xArm2);
  
  // Z轴正方向
  const zArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm1.rotation.x = Math.PI / 2;
  zArm1.position.z = armLength / 2;
  group.add(zArm1);
  
  // Z轴负方向
  const zArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm2.rotation.x = Math.PI / 2;
  zArm2.position.z = -armLength / 2;
  group.add(zArm2);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建十字接头
export const createCrossConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // X轴正方向
  const xArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm1.rotation.z = Math.PI / 2;
  xArm1.position.x = armLength / 2;
  group.add(xArm1);
  
  // X轴负方向
  const xArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm2.rotation.z = Math.PI / 2;
  xArm2.position.x = -armLength / 2;
  group.add(xArm2);
  
  // Z轴正方向
  const zArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm1.rotation.x = Math.PI / 2;
  zArm1.position.z = armLength / 2;
  group.add(zArm1);
  
  // Z轴负方向
  const zArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm2.rotation.x = Math.PI / 2;
  zArm2.position.z = -armLength / 2;
  group.add(zArm2);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// 创建五向接头
export const create5WayConnectorGeometry = (
  diameter: number,
  segments: number = 16
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const armLength = diameter * 2;
  
  const group = new THREE.Group();
  
  // X轴正方向
  const xArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm1.rotation.z = Math.PI / 2;
  xArm1.position.x = armLength / 2;
  group.add(xArm1);
  
  // X轴负方向
  const xArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  xArm2.rotation.z = Math.PI / 2;
  xArm2.position.x = -armLength / 2;
  group.add(xArm2);
  
  // Z轴正方向
  const zArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm1.rotation.x = Math.PI / 2;
  zArm1.position.z = armLength / 2;
  group.add(zArm1);
  
  // Z轴负方向
  const zArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  zArm2.rotation.x = Math.PI / 2;
  zArm2.position.z = -armLength / 2;
  group.add(zArm2);
  
  // Y轴正方向
  const yArm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, armLength, segments)
  );
  yArm.position.y = armLength / 2;
  group.add(yArm);
  
  // 连接球
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.3, segments, segments)
  );
  group.add(joint);
  
  return mergeGroupGeometry(group);
};

// ============ 平台几何体 ============

export const createPlatformGeometry = (
  width: number,
  height: number,
  depth: number = 2
): THREE.BufferGeometry => {
  return new THREE.BoxGeometry(width, depth, height);
};

// ============ 附件几何体 ============

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
  
  return mergeGroupGeometry(group);
};

export const createSlideGeometry = (
  width: number,
  height: number
): THREE.BufferGeometry => {
  const group = new THREE.Group();
  
  // 滑梯主体
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
  
  return mergeGroupGeometry(group);
};

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
  
  return mergeGroupGeometry(group);
};

// ============ 几何体合并工具 ============

const mergeGroupGeometry = (group: THREE.Group): THREE.BufferGeometry => {
  const geometries: THREE.BufferGeometry[] = [];
  
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
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
  
  return mergeGeometries(geometries);
};

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
    
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }
    
    for (let i = 0; i < normalArray.length; i++) {
      normals.push(normalArray[i]);
    }
    
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

// ============ 主要创建函数 ============

// 根据组件ID创建几何体
export const createComponentGeometry = (
  componentId: string,
  componentDef: any
): THREE.BufferGeometry => {
  // 解析组件类型
  const parts = componentId.split('_');
  const type = parts[0];
  const subtype = parts.slice(1).join('_');
  
  const diameter = componentDef.diameter || 2.5;
  
  // 管件
  if (type === 'pipe') {
    return createPipeGeometry(
      componentDef.length || 35,
      diameter
    );
  }
  
  // 接头（新格式：connector_*）
  if (type === 'connector') {
    switch (subtype) {
      case 'straight':
        return createStraightConnectorGeometry(diameter);
      case 'L':
        return createLConnectorGeometry(diameter);
      case 'T':
        return createTConnectorGeometry(diameter);
      case '45deg':
        return create45DegConnectorGeometry(diameter);
      case '3way':
        return create3WayConnectorGeometry(diameter);
      case '4way':
        return create4WayConnectorGeometry(diameter);
      case 'cross':
        return createCrossConnectorGeometry(diameter);
      case '5way':
        return create5WayConnectorGeometry(diameter);
      default:
        return createStraightConnectorGeometry(diameter);
    }
  }
  
  // 弯头（兼容旧格式）
  if (type === 'elbow') {
    return createLConnectorGeometry(diameter);
  }
  
  // 三通（兼容旧格式）
  if (type === 'tee') {
    return createTConnectorGeometry(diameter);
  }
  
  // 四通（兼容旧格式）
  if (type === 'cross') {
    return createCrossConnectorGeometry(diameter);
  }
  
  // 平台/板子
  if (type === 'platform' || type === 'board') {
    return createPlatformGeometry(
      componentDef.width || 40,
      componentDef.height || 40
    );
  }
  
  // 附件
  switch (type) {
    case 'swing':
      return createSwingGeometry(
        componentDef.width || 40,
        componentDef.height || 200
      );
    case 'slide':
      return createSlideGeometry(
        componentDef.width || 40,
        componentDef.height || 150
      );
    case 'rope':
      return createRopeLadderGeometry(
        componentDef.width || 40,
        componentDef.height || 180
      );
  }
  
  // 默认立方体
  console.warn(`Unknown component type: ${componentId}`);
  return new THREE.BoxGeometry(10, 10, 10);
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
  maxDistance: number = 10
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
export const clearModelCache = (): void => {};

// 获取缓存大小
export const getModelCacheSize = (): number => {
  return 0;
};
