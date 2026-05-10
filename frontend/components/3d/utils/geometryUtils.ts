import * as THREE from 'three';

// 创建管子几何体
export const createPipeGeometry = (
  length: number,
  diameter: number,
  segments: number = 32
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const innerRadius = radius * 0.8; // 管壁厚度
  
  // 外管
  const outerGeometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  
  // 内管（用于创建空心效果）
  const innerGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, length, segments);
  
  // 创建空心管
  const geometry = new THREE.BufferGeometry();
  const outerPositions = outerGeometry.attributes.position.array;
  const innerPositions = innerGeometry.attributes.position.array;
  
  // 合并几何体
  const positions: number[] = [];
  
  // 添加外管顶点
  for (let i = 0; i < outerPositions.length; i++) {
    positions.push(outerPositions[i]);
  }
  
  // 添加内管顶点（翻转法线）
  for (let i = 0; i < innerPositions.length; i += 3) {
    positions.push(innerPositions[i]);
    positions.push(innerPositions[i + 1]);
    positions.push(innerPositions[i + 2]);
  }
  
  // 计算法线
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  
  return geometry;
};

// 创建弯头几何体
export const createElbowGeometry = (
  _angle: number,
  diameter: number,
  segments: number = 32
): THREE.BufferGeometry => {
  const radius = diameter / 2;
  const bendRadius = diameter * 2; // 弯曲半径
  
  // 使用TubeGeometry创建弯管
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, -bendRadius),
    new THREE.Vector3(0, bendRadius, 0),
    new THREE.Vector3(bendRadius, 0, 0)
  );
  
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  
  return geometry;
};

// 创建三通几何体
export const createTeeGeometry = (
  diameter: number,
  segments: number = 32
): THREE.BufferGeometry => {
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
  
  return geometry;
};

// 创建四通几何体
export const createCrossGeometry = (
  diameter: number,
  segments: number = 32
): THREE.BufferGeometry => {
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
  
  return geometry;
};

// 创建平台几何体
export const createPlatformGeometry = (
  width: number,
  height: number,
  depth: number = 2
): THREE.BufferGeometry => {
  // 添加圆角
  const shape = new THREE.Shape();
  const cornerRadius = 1;
  
  shape.moveTo(-width / 2 + cornerRadius, -height / 2);
  shape.lineTo(width / 2 - cornerRadius, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + cornerRadius);
  shape.lineTo(width / 2, height / 2 - cornerRadius);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - cornerRadius, height / 2);
  shape.lineTo(-width / 2 + cornerRadius, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - cornerRadius);
  shape.lineTo(-width / 2, -height / 2 + cornerRadius);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + cornerRadius, -height / 2);
  
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 3,
  };
  
  const extrudeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  extrudeGeometry.rotateX(-Math.PI / 2);
  
  return extrudeGeometry;
};

// 合并几何体
const mergeGeometries = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  
  let indexOffset = 0;
  const indices: number[] = [];
  
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
    // 插口：圆环
    return new THREE.TorusGeometry(size, size * 0.3, 8, 16);
  } else {
    // 插头：球体
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
  
  // 应用组件变换
  matrix.makeRotationFromEuler(
    new THREE.Euler(
      (componentRotation[0] * Math.PI) / 180,
      (componentRotation[1] * Math.PI) / 180,
      (componentRotation[2] * Math.PI) / 180
    )
  );
  
  matrix.setPosition(
    componentPosition[0],
    componentPosition[1],
    componentPosition[2]
  );
  
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
  // 检查距离
  if (distance > maxDistance) {
    return false;
  }
  
  // 检查兼容性
  return point1.compatible.includes(point2.type) || point2.compatible.includes(point1.type);
};

// 计算连接时的对齐变换
export const calculateAlignmentTransform = (
  sourcePosition: [number, number, number],
  sourceRotation: [number, number, number],
  sourcePoint: { position: [number, number, number]; direction: [number, number, number] },
  targetPoint: { position: [number, number, number]; direction: [number, number, number] }
): { position: [number, number, number]; rotation: [number, number, number] } => {
  // 计算源连接点的世界坐标
  const sourceWorldPos = getConnectionPointWorldPosition(
    sourcePosition,
    sourceRotation,
    sourcePoint
  );
  
  // 计算目标位置（将目标连接点对齐到源连接点）
  const targetPosition: [number, number, number] = [
    sourceWorldPos.x - targetPoint.position[0],
    sourceWorldPos.y - targetPoint.position[1],
    sourceWorldPos.z - targetPoint.position[2],
  ];
  
  // 计算旋转对齐
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
  
  // 计算旋转四元数
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
