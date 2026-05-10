import * as THREE from 'three';
import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 吸附配置
export interface SnapConfig {
  enabled: boolean;
  snapDistance: number;
  gridSize: number;
  snapToGrid: boolean;
  snapToComponents: boolean;
  showSnapIndicators: boolean;
}

// 吸附结果
export interface SnapResult {
  position: [number, number, number];
  snapped: boolean;
  snapType: 'grid' | 'component' | 'none';
  snapTarget?: {
    instanceId: string;
    pointId: string;
    position: [number, number, number];
  };
}

// 连接配置
export interface ConnectionConfig {
  autoConnect: boolean;
  maxConnectDistance: number;
  showConnectionPoints: boolean;
  showConnectionLines: boolean;
}

// 吸附系统
export class SnapSystem {
  private config: SnapConfig;
  
  constructor(config?: Partial<SnapConfig>) {
    this.config = {
      enabled: true,
      snapDistance: 10,
      gridSize: 10,
      snapToGrid: true,
      snapToComponents: true,
      showSnapIndicators: true,
      ...config,
    };
  }
  
  // 计算吸附位置
  calculateSnapPosition(
    position: [number, number, number],
    components: ComponentInstance[],
    excludeInstanceId?: string
  ): SnapResult {
    if (!this.config.enabled) {
      return {
        position,
        snapped: false,
        snapType: 'none',
      };
    }
    
    // 网格吸附
    if (this.config.snapToGrid) {
      const gridSnap = this.snapToGrid(position);
      if (gridSnap.snapped) {
        return gridSnap;
      }
    }
    
    // 组件吸附
    if (this.config.snapToComponents) {
      const componentSnap = this.snapToComponents(position, components, excludeInstanceId);
      if (componentSnap.snapped) {
        return componentSnap;
      }
    }
    
    return {
      position,
      snapped: false,
      snapType: 'none',
    };
  }
  
  // 网格吸附
  private snapToGrid(position: [number, number, number]): SnapResult {
    const { gridSize, snapDistance } = this.config;
    
    const snappedX = Math.round(position[0] / gridSize) * gridSize;
    const snappedZ = Math.round(position[2] / gridSize) * gridSize;
    
    const distanceX = Math.abs(position[0] - snappedX);
    const distanceZ = Math.abs(position[2] - snappedZ);
    
    if (distanceX < snapDistance && distanceZ < snapDistance) {
      return {
        position: [snappedX, position[1], snappedZ],
        snapped: true,
        snapType: 'grid',
      };
    }
    
    return {
      position,
      snapped: false,
      snapType: 'none',
    };
  }
  
  // 组件吸附
  private snapToComponents(
    position: [number, number, number],
    components: ComponentInstance[],
    excludeInstanceId?: string
  ): SnapResult {
    const { snapDistance } = this.config;
    let bestResult: SnapResult | null = null;
    let bestDistance = Infinity;
    
    components.forEach((component) => {
      if (component.instanceId === excludeInstanceId) return;
      
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      definition.connectionPoints.forEach((point) => {
        const worldPos = this.getWorldPosition(
          component.position,
          component.rotation,
          point.position
        );
        
        const distance = this.calculateDistance(position, worldPos);
        
        if (distance < snapDistance && distance < bestDistance) {
          bestDistance = distance;
          bestResult = {
            position: worldPos,
            snapped: true,
            snapType: 'component',
            snapTarget: {
              instanceId: component.instanceId,
              pointId: point.id,
              position: worldPos,
            },
          };
        }
      });
    });
    
    return bestResult || {
      position,
      snapped: false,
      snapType: 'none',
    };
  }
  
  // 获取世界坐标
  private getWorldPosition(
    componentPos: [number, number, number],
    componentRot: [number, number, number],
    localPos: [number, number, number]
  ): [number, number, number] {
    const matrix = new THREE.Matrix4();
    
    const euler = new THREE.Euler(
      (componentRot[0] * Math.PI) / 180,
      (componentRot[1] * Math.PI) / 180,
      (componentRot[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(componentPos[0], componentPos[1], componentPos[2]);
    
    const point = new THREE.Vector3(localPos[0], localPos[1], localPos[2]);
    point.applyMatrix4(matrix);
    
    return [point.x, point.y, point.z];
  }
  
  // 计算距离
  private calculateDistance(
    pos1: [number, number, number],
    pos2: [number, number, number]
  ): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  // 更新配置
  updateConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // 获取配置
  getConfig(): SnapConfig {
    return { ...this.config };
  }
}

// 连接系统
export class ConnectionManager {
  private config: ConnectionConfig;
  
  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      autoConnect: true,
      maxConnectDistance: 5,
      showConnectionPoints: true,
      showConnectionLines: true,
      ...config,
    };
  }
  
  // 检查是否可以连接
  canConnect(
    sourceComponent: ComponentInstance,
    sourcePointId: string,
    targetComponent: ComponentInstance,
    targetPointId: string
  ): boolean {
    const sourceDef = getComponentById(sourceComponent.componentId);
    const targetDef = getComponentById(targetComponent.componentId);
    
    if (!sourceDef || !targetDef) return false;
    
    const sourcePoint = sourceDef.connectionPoints.find((p) => p.id === sourcePointId);
    const targetPoint = targetDef.connectionPoints.find((p) => p.id === targetPointId);
    
    if (!sourcePoint || !targetPoint) return false;
    
    // 检查兼容性
    const isCompatible = sourcePoint.compatible.includes(targetPoint.type) ||
                        targetPoint.compatible.includes(sourcePoint.type);
    
    if (!isCompatible) return false;
    
    // 检查距离
    const sourceWorldPos = this.getWorldPosition(
      sourceComponent.position,
      sourceComponent.rotation,
      sourcePoint.position
    );
    
    const targetWorldPos = this.getWorldPosition(
      targetComponent.position,
      targetComponent.rotation,
      targetPoint.position
    );
    
    const distance = this.calculateDistance(sourceWorldPos, targetWorldPos);
    
    return distance <= this.config.maxConnectDistance;
  }
  
  // 创建连接
  createConnection(
    sourceComponent: ComponentInstance,
    sourcePointId: string,
    targetComponent: ComponentInstance,
    targetPointId: string
  ): Connection | null {
    if (!this.canConnect(sourceComponent, sourcePointId, targetComponent, targetPointId)) {
      return null;
    }
    
    return {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: {
        componentId: sourceComponent.instanceId,
        pointId: sourcePointId,
      },
      target: {
        componentId: targetComponent.instanceId,
        pointId: targetPointId,
      },
      type: 'socket',
      isActive: true,
    };
  }
  
  // 自动连接
  autoConnect(
    components: ComponentInstance[],
    existingConnections: Connection[]
  ): Connection[] {
    if (!this.config.autoConnect) return [];
    
    const newConnections: Connection[] = [];
    
    components.forEach((sourceComponent) => {
      const sourceDef = getComponentById(sourceComponent.componentId);
      if (!sourceDef) return;
      
      sourceDef.connectionPoints.forEach((sourcePoint) => {
        const sourceWorldPos = this.getWorldPosition(
          sourceComponent.position,
          sourceComponent.rotation,
          sourcePoint.position
        );
        
        components.forEach((targetComponent) => {
          if (sourceComponent.instanceId === targetComponent.instanceId) return;
          
          const targetDef = getComponentById(targetComponent.componentId);
          if (!targetDef) return;
          
          targetDef.connectionPoints.forEach((targetPoint) => {
            const targetWorldPos = this.getWorldPosition(
              targetComponent.position,
              targetComponent.rotation,
              targetPoint.position
            );
            
            const distance = this.calculateDistance(sourceWorldPos, targetWorldPos);
            
            if (distance <= this.config.maxConnectDistance) {
              // 检查兼容性
              const isCompatible = sourcePoint.compatible.includes(targetPoint.type) ||
                                  targetPoint.compatible.includes(sourcePoint.type);
              
              if (isCompatible) {
                // 检查是否已存在连接
                const existingConnection = existingConnections.find(
                  (conn) =>
                    (conn.source.componentId === sourceComponent.instanceId &&
                      conn.source.pointId === sourcePoint.id &&
                      conn.target.componentId === targetComponent.instanceId &&
                      conn.target.pointId === targetPoint.id) ||
                    (conn.source.componentId === targetComponent.instanceId &&
                      conn.source.pointId === targetPoint.id &&
                      conn.target.componentId === sourceComponent.instanceId &&
                      conn.target.pointId === sourcePoint.id)
                );
                
                if (!existingConnection) {
                  const connection = this.createConnection(
                    sourceComponent,
                    sourcePoint.id,
                    targetComponent,
                    targetPoint.id
                  );
                  
                  if (connection) {
                    newConnections.push(connection);
                  }
                }
              }
            }
          });
        });
      });
    });
    
    return newConnections;
  }
  
  // 获取世界坐标
  private getWorldPosition(
    componentPos: [number, number, number],
    componentRot: [number, number, number],
    localPos: [number, number, number]
  ): [number, number, number] {
    const matrix = new THREE.Matrix4();
    
    const euler = new THREE.Euler(
      (componentRot[0] * Math.PI) / 180,
      (componentRot[1] * Math.PI) / 180,
      (componentRot[2] * Math.PI) / 180
    );
    
    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(componentPos[0], componentPos[1], componentPos[2]);
    
    const point = new THREE.Vector3(localPos[0], localPos[1], localPos[2]);
    point.applyMatrix4(matrix);
    
    return [point.x, point.y, point.z];
  }
  
  // 计算距离
  private calculateDistance(
    pos1: [number, number, number],
    pos2: [number, number, number]
  ): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  // 更新配置
  updateConfig(config: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // 获取配置
  getConfig(): ConnectionConfig {
    return { ...this.config };
  }
}

// 创建单例
export const snapSystem = new SnapSystem();
export const connectionManager = new ConnectionManager();
