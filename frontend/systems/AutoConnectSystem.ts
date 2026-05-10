import type { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import * as THREE from 'three';

// 自动连接配置
export interface AutoConnectConfig {
  enabled: boolean;
  maxDistance: number;
  autoConnectOnPlace: boolean;
  showConnectionLines: boolean;
}

// 连接线样式
export interface ConnectionLineStyle {
  color: string;
  width: number;
  opacity: number;
  dashed: boolean;
}

// 自动连接系统
export class AutoConnectSystem {
  private config: AutoConnectConfig = {
    enabled: true,
    maxDistance: 10,
    autoConnectOnPlace: true,
    showConnectionLines: true,
  };
  
  // 检测并创建连接
  detectConnections(
    components: ComponentInstance[],
    existingConnections: Connection[]
  ): Connection[] {
    if (!this.config.enabled) return [];
    
    const newConnections: Connection[] = [];
    const processedPairs = new Set<string>();
    
    // 获取所有连接点
    const allPoints = this.getAllConnectionPoints(components);
    
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
        
        // 检查是否已存在连接
        const existingConnection = existingConnections.find(
          conn =>
            (conn.source.componentId === point1.instanceId &&
              conn.source.pointId === point1.pointId &&
              conn.target.componentId === point2.instanceId &&
              conn.target.pointId === point2.pointId) ||
            (conn.source.componentId === point2.instanceId &&
              conn.source.pointId === point2.pointId &&
              conn.target.componentId === point1.instanceId &&
              conn.target.pointId === point1.pointId)
        );
        
        if (existingConnection) continue;
        
        // 检查距离
        const distance = this.calculateDistance(point1.worldPosition, point2.worldPosition);
        if (distance > this.config.maxDistance) continue;
        
        // 检查兼容性
        if (!this.areCompatible(point1, point2)) continue;
        
        // 创建连接
        newConnections.push({
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
    
    return newConnections;
  }
  
  // 检测单个组件的连接
  detectConnectionsForComponent(
    component: ComponentInstance,
    allComponents: ComponentInstance[],
    existingConnections: Connection[]
  ): Connection[] {
    if (!this.config.enabled) return [];
    
    const newConnections: Connection[] = [];
    
    // 获取当前组件的连接点
    const componentPoints = this.getComponentConnectionPoints(component);
    
    // 获取其他组件的连接点
    const otherPoints = allComponents
      .filter(c => c.instanceId !== component.instanceId)
      .flatMap(c => this.getComponentConnectionPoints(c));
    
    // 检查连接
    componentPoints.forEach(point1 => {
      otherPoints.forEach(point2 => {
        // 检查距离
        const distance = this.calculateDistance(point1.worldPosition, point2.worldPosition);
        if (distance > this.config.maxDistance) return;
        
        // 检查兼容性
        if (!this.areCompatible(point1, point2)) return;
        
        // 检查是否已存在连接
        const existingConnection = existingConnections.find(
          conn =>
            (conn.source.componentId === point1.instanceId &&
              conn.source.pointId === point1.pointId &&
              conn.target.componentId === point2.instanceId &&
              conn.target.pointId === point2.pointId) ||
            (conn.source.componentId === point2.instanceId &&
              conn.source.pointId === point2.pointId &&
              conn.target.componentId === point1.instanceId &&
              conn.target.pointId === point1.pointId)
        );
        
        if (existingConnection) return;
        
        // 创建连接
        newConnections.push({
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
      });
    });
    
    return newConnections;
  }
  
  // 获取所有连接点
  private getAllConnectionPoints(components: ComponentInstance[]): Array<{
    instanceId: string;
    pointId: string;
    worldPosition: THREE.Vector3;
    worldDirection: THREE.Vector3;
    type: string;
    compatible: string[];
  }> {
    return components.flatMap(component => this.getComponentConnectionPoints(component));
  }
  
  // 获取组件的连接点
  private getComponentConnectionPoints(component: ComponentInstance): Array<{
    instanceId: string;
    pointId: string;
    worldPosition: THREE.Vector3;
    worldDirection: THREE.Vector3;
    type: string;
    compatible: string[];
  }> {
    const definition = getComponentById(component.componentId);
    if (!definition) return [];
    
    return definition.connectionPoints.map(point => {
      const worldPos = this.getWorldPosition(component, point.position);
      const worldDir = this.getWorldDirection(component, point.direction);
      
      return {
        instanceId: component.instanceId,
        pointId: point.id,
        worldPosition: new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]),
        worldDirection: new THREE.Vector3(worldDir[0], worldDir[1], worldDir[2]),
        type: point.type,
        compatible: point.compatible,
      };
    });
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
  
  // 计算距离
  private calculateDistance(pos1: THREE.Vector3, pos2: THREE.Vector3): number {
    return pos1.distanceTo(pos2);
  }
  
  // 检查兼容性
  private areCompatible(
    point1: { type: string; compatible: string[] },
    point2: { type: string; compatible: string[] }
  ): boolean {
    return (
      point1.compatible.includes(point2.type) ||
      point2.compatible.includes(point1.type)
    );
  }
  
  // 验证连接
  validateConnection(
    connection: Connection,
    components: ComponentInstance[]
  ): boolean {
    const sourceComponent = components.find(c => c.instanceId === connection.source.componentId);
    const targetComponent = components.find(c => c.instanceId === connection.target.componentId);
    
    if (!sourceComponent || !targetComponent) return false;
    
    const sourcePoints = this.getComponentConnectionPoints(sourceComponent);
    const targetPoints = this.getComponentConnectionPoints(targetComponent);
    
    const sourcePoint = sourcePoints.find(p => p.pointId === connection.source.pointId);
    const targetPoint = targetPoints.find(p => p.pointId === connection.target.pointId);
    
    if (!sourcePoint || !targetPoint) return false;
    
    const distance = this.calculateDistance(sourcePoint.worldPosition, targetPoint.worldPosition);
    return distance <= this.config.maxDistance && this.areCompatible(sourcePoint, targetPoint);
  }
  
  // 获取连接线样式
  getConnectionLineStyle(_connection: Connection): ConnectionLineStyle {
    return {
      color: '#3b82f6',
      width: 2,
      opacity: 0.8,
      dashed: false,
    };
  }
  
  // 更新配置
  updateConfig(config: Partial<AutoConnectConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // 获取配置
  getConfig(): AutoConnectConfig {
    return { ...this.config };
  }
}

// 创建单例
export const autoConnectSystem = new AutoConnectSystem();
