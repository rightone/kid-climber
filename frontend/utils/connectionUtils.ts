import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import * as THREE from 'three';

// 连接配置
export interface ConnectionConfig {
  maxConnectDistance: number;  // 最大连接距离
  autoConnect: boolean;       // 是否自动连接
  showConnectionPoints: boolean; // 是否显示连接点
}

// 默认配置
const defaultConfig: ConnectionConfig = {
  maxConnectDistance: 10,  // 10cm
  autoConnect: true,
  showConnectionPoints: true,
};

// 连接点世界坐标
interface ConnectionPointWorld {
  instanceId: string;
  pointId: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  type: string;
  compatible: string[];
}

// 获取组件的世界坐标连接点
export const getWorldConnectionPoints = (
  component: ComponentInstance
): ConnectionPointWorld[] => {
  const definition = getComponentById(component.componentId);
  if (!definition) return [];
  
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler(
    (component.rotation[0] * Math.PI) / 180,
    (component.rotation[1] * Math.PI) / 180,
    (component.rotation[2] * Math.PI) / 180
  );
  
  matrix.makeRotationFromEuler(euler);
  matrix.setPosition(component.position[0], component.position[1], component.position[2]);
  
  return definition.connectionPoints.map(point => {
    const pos = new THREE.Vector3(
      point.position[0],
      point.position[1],
      point.position[2]
    );
    pos.applyMatrix4(matrix);
    
    const dir = new THREE.Vector3(
      point.direction[0],
      point.direction[1],
      point.direction[2]
    );
    dir.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));
    dir.normalize();
    
    return {
      instanceId: component.instanceId,
      pointId: point.id,
      position: pos,
      direction: dir,
      type: point.type,
      compatible: point.compatible,
    };
  });
};

// 检查两个连接点是否可以连接
export const canConnectPoints = (
  point1: ConnectionPointWorld,
  point2: ConnectionPointWorld,
  maxDistance: number = 10
): boolean => {
  // 检查距离
  const distance = point1.position.distanceTo(point2.position);
  if (distance > maxDistance) return false;
  
  // 检查兼容性
  const isCompatible = 
    point1.compatible.includes(point2.type) ||
    point2.compatible.includes(point1.type);
  
  if (!isCompatible) return false;
  
  // 检查方向（连接点应该相对）
  const dotProduct = point1.direction.dot(point2.direction);
  if (dotProduct > -0.5) return false; // 方向不够相对
  
  return true;
};

// 查找所有可能的连接
export const findPossibleConnections = (
  components: ComponentInstance[],
  config: ConnectionConfig = defaultConfig
): Connection[] => {
  const connections: Connection[] = [];
  const processedPairs = new Set<string>();
  
  // 获取所有连接点
  const allPoints: ConnectionPointWorld[] = [];
  components.forEach(component => {
    const points = getWorldConnectionPoints(component);
    allPoints.push(...points);
  });
  
  // 检查所有连接点对
  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      const point1 = allPoints[i];
      const point2 = allPoints[j];
      
      // 跳过同一组件的连接点
      if (point1.instanceId === point2.instanceId) continue;
      
      // 创建唯一标识符
      const pairKey = [point1.instanceId, point1.pointId, point2.instanceId, point2.pointId]
        .sort()
        .join('-');
      
      // 跳过已处理的配对
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      
      // 检查是否可以连接
      if (canConnectPoints(point1, point2, config.maxConnectDistance)) {
        connections.push({
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: {
            componentId: point1.instanceId,
            pointId: point1.pointId,
          },
          target: {
            componentId: point2.instanceId,
            pointId: point2.pointId,
          },
          type: point1.type,
          isActive: true,
        });
      }
    }
  }
  
  return connections;
};

// 查找单个组件的连接
export const findConnectionsForComponent = (
  component: ComponentInstance,
  allComponents: ComponentInstance[],
  config: ConnectionConfig = defaultConfig
): Connection[] => {
  const connections: Connection[] = [];
  
  // 获取当前组件的连接点
  const componentPoints = getWorldConnectionPoints(component);
  
  // 获取其他组件的连接点
  const otherPoints: ConnectionPointWorld[] = [];
  allComponents.forEach(comp => {
    if (comp.instanceId === component.instanceId) return;
    const points = getWorldConnectionPoints(comp);
    otherPoints.push(...points);
  });
  
  // 检查连接
  componentPoints.forEach(point1 => {
    otherPoints.forEach(point2 => {
      if (canConnectPoints(point1, point2, config.maxConnectDistance)) {
        connections.push({
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: {
            componentId: point1.instanceId,
            pointId: point1.pointId,
          },
          target: {
            componentId: point2.instanceId,
            pointId: point2.pointId,
          },
          type: point1.type,
          isActive: true,
        });
      }
    });
  });
  
  return connections;
};

// 查找最近的连接点
export const findNearestConnectionPoint = (
  position: THREE.Vector3,
  components: ComponentInstance[],
  excludeInstanceId?: string,
  maxDistance: number = 20
): ConnectionPointWorld | null => {
  let nearest: ConnectionPointWorld | null = null;
  let minDistance = maxDistance;
  
  components.forEach(component => {
    if (component.instanceId === excludeInstanceId) return;
    
    const points = getWorldConnectionPoints(component);
    points.forEach(point => {
      const distance = position.distanceTo(point.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    });
  });
  
  return nearest;
};

// 计算吸附位置
export const calculateSnapPosition = (
  dragPosition: THREE.Vector3,
  dragComponent: ComponentInstance,
  targetPoint: ConnectionPointWorld
): THREE.Vector3 => {
  const definition = getComponentById(dragComponent.componentId);
  if (!definition) return dragPosition;
  
  // 找到拖拽组件最近的连接点
  const dragPoints = getWorldConnectionPoints(dragComponent);
  let nearestDragPoint: ConnectionPointWorld | null = null;
  let minDistance = Infinity;
  
  dragPoints.forEach(point => {
    const distance = dragPosition.distanceTo(point.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearestDragPoint = point;
    }
  });
  
  if (!nearestDragPoint) return dragPosition;
  
  // 计算偏移量
  const offset = new THREE.Vector3().subVectors(
    dragPosition,
    nearestDragPoint.position
  );
  
  // 计算新位置
  const newPosition = new THREE.Vector3().addVectors(
    targetPoint.position,
    offset
  );
  
  return newPosition;
};

// 验证连接是否有效
export const validateConnection = (
  connection: Connection,
  components: ComponentInstance[]
): boolean => {
  const sourceComponent = components.find(c => c.instanceId === connection.source.componentId);
  const targetComponent = components.find(c => c.instanceId === connection.target.componentId);
  
  if (!sourceComponent || !targetComponent) return false;
  
  const sourcePoints = getWorldConnectionPoints(sourceComponent);
  const targetPoints = getWorldConnectionPoints(targetComponent);
  
  const sourcePoint = sourcePoints.find(p => p.pointId === connection.source.pointId);
  const targetPoint = targetPoints.find(p => p.pointId === connection.target.pointId);
  
  if (!sourcePoint || !targetPoint) return false;
  
  return canConnectPoints(sourcePoint, targetPoint);
};

// 获取连接统计
export const getConnectionStats = (
  connections: Connection[],
  components: ComponentInstance[]
): {
  totalConnections: number;
  connectedComponents: number;
  isolatedComponents: number;
} => {
  const connectedInstanceIds = new Set<string>();
  
  connections.forEach(conn => {
    connectedInstanceIds.add(conn.source.componentId);
    connectedInstanceIds.add(conn.target.componentId);
  });
  
  const connectedComponents = connectedInstanceIds.size;
  const isolatedComponents = components.length - connectedComponents;
  
  return {
    totalConnections: connections.length,
    connectedComponents,
    isolatedComponents,
  };
};
