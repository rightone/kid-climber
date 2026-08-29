import * as THREE from 'three';
import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 连接建议
export interface ConnectionSuggestion {
  sourceInstanceId: string;
  sourcePointId: string;
  targetInstanceId: string;
  targetPointId: string;
  connectorType: string;
  confidence: number;
  position: [number, number, number];
  rotation: [number, number, number];
}

// 一键补全系统
export class AutoCompleteSystem {
  // 查找所有可能的连接
  findPossibleConnections(
    components: ComponentInstance[],
    existingConnections: Connection[]
  ): ConnectionSuggestion[] {
    const suggestions: ConnectionSuggestion[] = [];
    
    // 获取所有未连接的连接点
    const unconnectedPoints = this.getUnconnectedPoints(components, existingConnections);
    
    // 检查每对连接点
    for (let i = 0; i < unconnectedPoints.length; i++) {
      for (let j = i + 1; j < unconnectedPoints.length; j++) {
        const point1 = unconnectedPoints[i];
        const point2 = unconnectedPoints[j];
        
        // 跳过同一组件的连接点
        if (point1.instanceId === point2.instanceId) continue;
        
        // 检查是否可以连接
        const suggestion = this.checkConnection(point1, point2, components);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }
    
    // 按置信度排序
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    return suggestions;
  }
  
  // 获取未连接的连接点
  private getUnconnectedPoints(
    components: ComponentInstance[],
    existingConnections: Connection[]
  ): Array<{
    instanceId: string;
    pointId: string;
    worldPosition: THREE.Vector3;
    worldDirection: THREE.Vector3;
    type: string;
    compatible: string[];
  }> {
    const connectedPoints = new Set<string>();
    
    // 标记已连接的点
    existingConnections.forEach(conn => {
      connectedPoints.add(`${conn.source.componentId}:${conn.source.pointId}`);
      connectedPoints.add(`${conn.target.componentId}:${conn.target.pointId}`);
    });
    
    const allPoints: Array<{
      instanceId: string;
      pointId: string;
      worldPosition: THREE.Vector3;
      worldDirection: THREE.Vector3;
      type: string;
      compatible: string[];
    }> = [];
    
    // 收集所有未连接的点
    components.forEach(component => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      definition.connectionPoints.forEach(point => {
        const key = `${component.instanceId}:${point.id}`;
        if (!connectedPoints.has(key)) {
          const worldPos = this.getWorldPosition(component, point.position);
          const worldDir = this.getWorldDirection(component, point.direction);
          
          allPoints.push({
            instanceId: component.instanceId,
            pointId: point.id,
            worldPosition: new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]),
            worldDirection: new THREE.Vector3(worldDir[0], worldDir[1], worldDir[2]),
            type: point.type,
            compatible: point.compatible,
          });
        }
      });
    });
    
    return allPoints;
  }
  
  // 检查两个点是否可以连接
  private checkConnection(
    point1: {
      instanceId: string;
      pointId: string;
      worldPosition: THREE.Vector3;
      worldDirection: THREE.Vector3;
      type: string;
      compatible: string[];
    },
    point2: {
      instanceId: string;
      pointId: string;
      worldPosition: THREE.Vector3;
      worldDirection: THREE.Vector3;
      type: string;
      compatible: string[];
    },
    components: ComponentInstance[]
  ): ConnectionSuggestion | null {
    // 检查兼容性
    const isCompatible = 
      point1.compatible.includes(point2.type) ||
      point2.compatible.includes(point1.type);
    
    if (!isCompatible) return null;
    
    // 计算距离
    const distance = point1.worldPosition.distanceTo(point2.worldPosition);
    
    // 检查距离范围（5cm - 50cm）
    if (distance < 5 || distance > 50) return null;
    
    // 检查方向（连接点应该相对）
    const dotProduct = point1.worldDirection.dot(point2.worldDirection);
    if (dotProduct > -0.5) return null;
    
    // 确定连接器类型
    const connectorType = this.determineConnectorType(point1, point2, distance);
    
    // 计算连接器位置和旋转
    const { position, rotation } = this.calculateConnectorTransform(point1, point2);
    
    // 计算置信度
    const confidence = this.calculateConfidence(distance, dotProduct);
    
    return {
      sourceInstanceId: point1.instanceId,
      sourcePointId: point1.pointId,
      targetInstanceId: point2.instanceId,
      targetPointId: point2.pointId,
      connectorType,
      confidence,
      position,
      rotation,
    };
  }
  
  // 确定连接器类型
  private determineConnectorType(
    point1: { worldDirection: THREE.Vector3 },
    point2: { worldDirection: THREE.Vector3 },
    distance: number
  ): string {
    const dotProduct = point1.worldDirection.dot(point2.worldDirection);
    
    // 计算角度
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
    
    if (angle > 150) {
      // 接近180度 - 一字接头
      return 'connector_straight';
    } else if (angle > 60 && angle < 120) {
      // 接近90度 - L型接头
      return 'connector_L';
    } else if (angle > 30 && angle < 60) {
      // 接近45度 - 45度接头
      return 'connector_45deg';
    } else {
      // 默认一字接头
      return 'connector_straight';
    }
  }
  
  // 计算连接器变换
  private calculateConnectorTransform(
    point1: { worldPosition: THREE.Vector3; worldDirection: THREE.Vector3 },
    point2: { worldPosition: THREE.Vector3; worldDirection: THREE.Vector3 }
  ): { position: [number, number, number]; rotation: [number, number, number] } {
    // 计算中点位置
    const midPoint = new THREE.Vector3().addVectors(
      point1.worldPosition,
      point2.worldPosition
    ).multiplyScalar(0.5);
    
    // 计算方向
    const direction = new THREE.Vector3().subVectors(
      point2.worldPosition,
      point1.worldPosition
    ).normalize();
    
    // 计算旋转角度
    const euler = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    euler.setFromQuaternion(quaternion);
    
    return {
      position: [midPoint.x, midPoint.y, midPoint.z],
      rotation: [
        (euler.x * 180) / Math.PI,
        (euler.y * 180) / Math.PI,
        (euler.z * 180) / Math.PI,
      ],
    };
  }
  
  // 计算置信度
  private calculateConfidence(distance: number, dotProduct: number): number {
    // 距离越近，置信度越高
    const distanceScore = 1 - (distance / 50);
    
    // 方向越相对，置信度越高
    const directionScore = (1 + dotProduct) / 2;
    
    return (distanceScore * 0.6 + directionScore * 0.4);
  }
  
  // 获取世界坐标
  private getWorldPosition(
    component: ComponentInstance,
    localPos: [number, number, number]
  ): [number, number, number] {
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(
      (component.rotation[0] * Math.PI) / 180,
      (component.rotation[1] * Math.PI) / 180,
      (component.rotation[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(component.position[0], component.position[1], component.position[2]);
    
    const pos = new THREE.Vector3(localPos[0], localPos[1], localPos[2]);
    pos.applyMatrix4(matrix);
    
    return [pos.x, pos.y, pos.z];
  }
  
  // 获取世界方向
  private getWorldDirection(
    component: ComponentInstance,
    localDir: [number, number, number]
  ): [number, number, number] {
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(
      (component.rotation[0] * Math.PI) / 180,
      (component.rotation[1] * Math.PI) / 180,
      (component.rotation[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    
    const dir = new THREE.Vector3(localDir[0], localDir[1], localDir[2]);
    dir.applyMatrix4(matrix);
    dir.normalize();
    
    return [dir.x, dir.y, dir.z];
  }
  
  // 应用连接建议
  applySuggestion(
    suggestion: ConnectionSuggestion,
    components: ComponentInstance[]
  ): {
    connector: ComponentInstance;
    connection: Connection;
  } | null {
    // 创建连接器组件
    const connector: ComponentInstance = {
      instanceId: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      componentId: suggestion.connectorType,
      position: suggestion.position,
      rotation: suggestion.rotation,
      scale: [1, 1, 1],
    };
    
    // 创建连接关系
    const connection: Connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: {
        componentId: suggestion.sourceInstanceId,
        pointId: suggestion.sourcePointId,
      },
      target: {
        componentId: connector.instanceId,
        pointId: 'input', // 假设连接器的输入点
      },
      type: 'socket',
      isActive: true,
    };
    
    return { connector, connection };
  }
}

// 创建单例
export const autoCompleteSystem = new AutoCompleteSystem();
