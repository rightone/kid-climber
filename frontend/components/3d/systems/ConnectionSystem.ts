import * as THREE from 'three';
import { ComponentInstance, ConnectionPoint } from '../../../types';
import { getComponentById } from '../../../stores/componentLibrary';

// 连接点世界坐标
export interface ConnectionPointWorld {
  componentId: string;
  instanceId: string;
  pointId: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  type: string;
  compatible: string[];
}

// 连接候选
export interface ConnectionCandidate {
  source: ConnectionPointWorld;
  target: ConnectionPointWorld;
  distance: number;
  alignmentScore: number;
}

// 连接系统
export class ConnectionSystem {
  private connectionPoints: Map<string, ConnectionPointWorld[]> = new Map();
  private maxSnapDistance: number = 10; // 最大吸附距离（厘米）
  private maxConnectDistance: number = 5; // 最大连接距离（厘米）
  
  // 更新连接点位置
  updateConnectionPoints(components: ComponentInstance[]): void {
    this.connectionPoints.clear();
    
    components.forEach((component) => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      const worldPoints = definition.connectionPoints.map((point) => {
        const worldPos = this.getWorldPosition(
          component.position,
          component.rotation,
          point.position
        );
        
        const worldDir = this.getWorldDirection(
          component.rotation,
          point.direction
        );
        
        return {
          componentId: component.componentId,
          instanceId: component.instanceId,
          pointId: point.id,
          position: worldPos,
          direction: worldDir,
          type: point.type,
          compatible: point.compatible,
        };
      });
      
      this.connectionPoints.set(component.instanceId, worldPoints);
    });
  }
  
  // 获取世界坐标
  private getWorldPosition(
    componentPos: [number, number, number],
    componentRot: [number, number, number],
    localPos: [number, number, number]
  ): THREE.Vector3 {
    const matrix = new THREE.Matrix4();
    
    // 应用旋转
    const euler = new THREE.Euler(
      (componentRot[0] * Math.PI) / 180,
      (componentRot[1] * Math.PI) / 180,
      (componentRot[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    
    // 应用位置
    matrix.setPosition(
      componentPos[0],
      componentPos[1],
      componentPos[2]
    );
    
    const point = new THREE.Vector3(
      localPos[0],
      localPos[1],
      localPos[2]
    );
    
    point.applyMatrix4(matrix);
    
    return point;
  }
  
  // 获取世界方向
  private getWorldDirection(
    componentRot: [number, number, number],
    localDir: [number, number, number]
  ): THREE.Vector3 {
    const matrix = new THREE.Matrix4();
    
    const euler = new THREE.Euler(
      (componentRot[0] * Math.PI) / 180,
      (componentRot[1] * Math.PI) / 180,
      (componentRot[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    
    const dir = new THREE.Vector3(
      localDir[0],
      localDir[1],
      localDir[2]
    );
    
    dir.applyMatrix4(matrix);
    dir.normalize();
    
    return dir;
  }
  
  // 查找附近的连接点
  findNearbyConnectionPoints(
    position: THREE.Vector3,
    excludeInstanceId?: string
  ): ConnectionPointWorld[] {
    const nearbyPoints: ConnectionPointWorld[] = [];
    
    this.connectionPoints.forEach((points, instanceId) => {
      if (instanceId === excludeInstanceId) return;
      
      points.forEach((point) => {
        const distance = position.distanceTo(point.position);
        if (distance <= this.maxSnapDistance) {
          nearbyPoints.push(point);
        }
      });
    });
    
    // 按距离排序
    nearbyPoints.sort((a, b) => {
      const distA = position.distanceTo(a.position);
      const distB = position.distanceTo(b.position);
      return distA - distB;
    });
    
    return nearbyPoints;
  }
  
  // 查找最佳吸附目标
  findBestSnapTarget(
    dragPosition: THREE.Vector3,
    dragInstanceId: string,
    dragComponentId: string
  ): { target: ConnectionPointWorld; snapPosition: THREE.Vector3 } | null {
    const dragDef = getComponentById(dragComponentId);
    if (!dragDef) return null;
    
    let bestTarget: ConnectionPointWorld | null = null;
    let bestSnapPosition: THREE.Vector3 | null = null;
    let bestDistance = Infinity;
    
    // 获取拖拽组件的连接点
    const dragPoints = this.connectionPoints.get(dragInstanceId) || [];
    
    // 遍历所有可能的连接点
    this.connectionPoints.forEach((points, instanceId) => {
      if (instanceId === dragInstanceId) return;
      
      points.forEach((targetPoint) => {
        // 检查每个拖拽连接点
        dragPoints.forEach((dragPoint) => {
          // 检查兼容性
          if (!this.areCompatible(dragPoint, targetPoint)) return;
          
          // 计算距离
          const distance = dragPoint.position.distanceTo(targetPoint.position);
          
          if (distance < bestDistance && distance <= this.maxSnapDistance) {
            bestDistance = distance;
            bestTarget = targetPoint;
            
            // 计算吸附位置
            bestSnapPosition = this.calculateSnapPosition(
              dragPosition,
              dragPoint,
              targetPoint
            );
          }
        });
      });
    });
    
    if (bestTarget && bestSnapPosition) {
      return {
        target: bestTarget,
        snapPosition: bestSnapPosition,
      };
    }
    
    return null;
  }
  
  // 检查两个连接点是否兼容
  private areCompatible(
    point1: ConnectionPointWorld,
    point2: ConnectionPointWorld
  ): boolean {
    return (
      point1.compatible.includes(point2.type) ||
      point2.compatible.includes(point1.type)
    );
  }
  
  // 计算吸附位置
  private calculateSnapPosition(
    currentPos: THREE.Vector3,
    dragPoint: ConnectionPointWorld,
    targetPoint: ConnectionPointWorld
  ): THREE.Vector3 {
    // 计算偏移量
    const offset = new THREE.Vector3().subVectors(
      currentPos,
      dragPoint.position
    );
    
    // 计算新位置（将拖拽连接点对齐到目标连接点）
    const newPos = new THREE.Vector3().addVectors(
      targetPoint.position,
      offset
    );
    
    return newPos;
  }
  
  // 创建连接
  createConnection(
    sourceInstanceId: string,
    sourcePointId: string,
    targetInstanceId: string,
    targetPointId: string
  ): { id: string; source: any; target: any; type: string; isActive: boolean } | null {
    const sourcePoints = this.connectionPoints.get(sourceInstanceId);
    const targetPoints = this.connectionPoints.get(targetInstanceId);
    
    if (!sourcePoints || !targetPoints) return null;
    
    const sourcePoint = sourcePoints.find((p) => p.pointId === sourcePointId);
    const targetPoint = targetPoints.find((p) => p.pointId === targetPointId);
    
    if (!sourcePoint || !targetPoint) return null;
    
    // 检查距离
    const distance = sourcePoint.position.distanceTo(targetPoint.position);
    if (distance > this.maxConnectDistance) return null;
    
    // 检查兼容性
    if (!this.areCompatible(sourcePoint, targetPoint)) return null;
    
    return {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: {
        componentId: sourceInstanceId,
        pointId: sourcePointId,
      },
      target: {
        componentId: targetInstanceId,
        pointId: targetPointId,
      },
      type: sourcePoint.type,
      isActive: true,
    };
  }
  
  // 检查连接是否有效
  validateConnection(
    sourceInstanceId: string,
    sourcePointId: string,
    targetInstanceId: string,
    targetPointId: string
  ): boolean {
    const sourcePoints = this.connectionPoints.get(sourceInstanceId);
    const targetPoints = this.connectionPoints.get(targetInstanceId);
    
    if (!sourcePoints || !targetPoints) return false;
    
    const sourcePoint = sourcePoints.find((p) => p.pointId === sourcePointId);
    const targetPoint = targetPoints.find((p) => p.pointId === targetPointId);
    
    if (!sourcePoint || !targetPoint) return false;
    
    const distance = sourcePoint.position.distanceTo(targetPoint.position);
    return distance <= this.maxConnectDistance && this.areCompatible(sourcePoint, targetPoint);
  }
  
  // 获取组件的所有连接点
  getConnectionPoints(instanceId: string): ConnectionPointWorld[] {
    return this.connectionPoints.get(instanceId) || [];
  }
  
  // 获取所有连接点
  getAllConnectionPoints(): ConnectionPointWorld[] {
    const allPoints: ConnectionPointWorld[] = [];
    this.connectionPoints.forEach((points) => {
      allPoints.push(...points);
    });
    return allPoints;
  }
  
  // 设置吸附距离
  setMaxSnapDistance(distance: number): void {
    this.maxSnapDistance = distance;
  }
  
  // 设置连接距离
  setMaxConnectDistance(distance: number): void {
    this.maxConnectDistance = distance;
  }
}

// 创建单例
export const connectionSystem = new ConnectionSystem();
