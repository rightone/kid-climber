import * as THREE from 'three';
import { ComponentInstance, ConnectionPoint } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 吸附类型
export type SnapType = 'grid' | 'connection' | 'endpoint' | 'alignment';

// 吸附结果
export interface SnapResult {
  position: [number, number, number];
  rotation: [number, number, number];
  snapType: SnapType;
  snapTarget?: {
    instanceId: string;
    pointId: string;
    position: [number, number, number];
  };
  confidence: number; // 0-1，吸附置信度
}

// 吸附配置
export interface SnapConfig {
  enableGridSnap: boolean;
  enableConnectionSnap: boolean;
  enableEndpointSnap: boolean;
  enableAlignmentSnap: boolean;
  gridSize: number;
  snapDistance: number;
  connectionSnapDistance: number;
}

// 智能吸附系统
export class SmartSnapSystem {
  private config: SnapConfig = {
    enableGridSnap: true,
    enableConnectionSnap: true,
    enableEndpointSnap: true,
    enableAlignmentSnap: true,
    gridSize: 20,
    snapDistance: 10,
    connectionSnapDistance: 15,
  };
  
  // 计算吸附位置
  calculateSnapPosition(
    dragPosition: [number, number, number],
    dragComponentId: string,
    existingComponents: ComponentInstance[],
    dragRotation: [number, number, number] = [0, 0, 0]
  ): SnapResult {
    const dragDef = getComponentById(dragComponentId);
    if (!dragDef) {
      return {
        position: dragPosition,
        rotation: dragRotation,
        snapType: 'grid',
        confidence: 0,
      };
    }
    
    // 1. 尝试连接点吸附（最高优先级）
    if (this.config.enableConnectionSnap) {
      const connectionSnap = this.tryConnectionSnap(
        dragPosition,
        dragComponentId,
        dragDef.connectionPoints,
        existingComponents,
        dragRotation
      );
      if (connectionSnap && connectionSnap.confidence > 0.8) {
        return connectionSnap;
      }
    }
    
    // 2. 尝试端点吸附
    if (this.config.enableEndpointSnap) {
      const endpointSnap = this.tryEndpointSnap(
        dragPosition,
        dragComponentId,
        dragDef.connectionPoints,
        existingComponents,
        dragRotation
      );
      if (endpointSnap && endpointSnap.confidence > 0.7) {
        return endpointSnap;
      }
    }
    
    // 3. 尝试对齐吸附
    if (this.config.enableAlignmentSnap) {
      const alignmentSnap = this.tryAlignmentSnap(
        dragPosition,
        existingComponents,
        dragRotation
      );
      if (alignmentSnap && alignmentSnap.confidence > 0.6) {
        return alignmentSnap;
      }
    }
    
    // 4. 网格吸附（默认）
    if (this.config.enableGridSnap) {
      return this.tryGridSnap(dragPosition, dragRotation);
    }
    
    return {
      position: dragPosition,
      rotation: dragRotation,
      snapType: 'grid',
      confidence: 0,
    };
  }
  
  // 尝试连接点吸附
  private tryConnectionSnap(
    position: [number, number, number],
    componentId: string,
    connectionPoints: any[],
    existingComponents: ComponentInstance[],
    rotation: [number, number, number]
  ): SnapResult | null {
    let bestSnap: SnapResult | null = null;
    let bestDistance = this.config.connectionSnapDistance;
    
    for (const component of existingComponents) {
      const def = getComponentById(component.componentId);
      if (!def) continue;
      
      for (const targetPoint of def.connectionPoints) {
        const targetWorldPos = this.getWorldPosition(
          component.position,
          component.rotation,
          targetPoint.position
        );
        
        for (const sourcePoint of connectionPoints) {
          const sourceWorldPos = this.getWorldPosition(
            position,
            rotation,
            sourcePoint.position
          );
          
          const distance = this.calculateDistance(sourceWorldPos, targetWorldPos);
          
          if (distance < bestDistance) {
            // 检查兼容性
            if (this.arePointsCompatible(sourcePoint, targetPoint)) {
              // 计算吸附后的位置
              const snappedPosition = this.calculateSnappedPosition(
                position,
                sourcePoint.position,
                targetWorldPos,
                rotation
              );
              
              bestDistance = distance;
              bestSnap = {
                position: snappedPosition,
                rotation: rotation,
                snapType: 'connection',
                snapTarget: {
                  instanceId: component.instanceId,
                  pointId: targetPoint.id,
                  position: targetWorldPos,
                },
                confidence: 1 - (distance / this.config.connectionSnapDistance),
              };
            }
          }
        }
      }
    }
    
    return bestSnap;
  }
  
  // 尝试端点吸附
  private tryEndpointSnap(
    position: [number, number, number],
    componentId: string,
    connectionPoints: any[],
    existingComponents: ComponentInstance[],
    rotation: [number, number, number]
  ): SnapResult | null {
    const snapDistance = this.config.snapDistance;
    let bestSnap: SnapResult | null = null;
    let bestDistance = snapDistance;
    
    for (const component of existingComponents) {
      const def = getComponentById(component.componentId);
      if (!def) continue;
      
      // 检查组件端点
      for (const point of def.connectionPoints) {
        const worldPos = this.getWorldPosition(
          component.position,
          component.rotation,
          point.position
        );
        
        // 计算拖拽组件的端点位置
        for (const dragPoint of connectionPoints) {
          const dragWorldPos = this.getWorldPosition(
            position,
            rotation,
            dragPoint.position
          );
          
          const distance = this.calculateDistance(dragWorldPos, worldPos);
          
          if (distance < bestDistance) {
            // 计算吸附后的位置
            const snappedPosition = this.calculateSnappedPosition(
              position,
              dragPoint.position,
              worldPos,
              rotation
            );
            
            bestDistance = distance;
            bestSnap = {
              position: snappedPosition,
              rotation: rotation,
              snapType: 'endpoint',
              snapTarget: {
                instanceId: component.instanceId,
                pointId: point.id,
                position: worldPos,
              },
              confidence: 1 - (distance / snapDistance),
            };
          }
        }
      }
    }
    
    return bestSnap;
  }
  
  // 尝试对齐吸附
  private tryAlignmentSnap(
    position: [number, number, number],
    existingComponents: ComponentInstance[],
    rotation: [number, number, number]
  ): SnapResult | null {
    const snapDistance = this.config.snapDistance;
    let bestSnap: SnapResult | null = null;
    let bestDistance = snapDistance;
    
    for (const component of existingComponents) {
      // 检查X轴对齐
      const xDistance = Math.abs(position[0] - component.position[0]);
      if (xDistance < snapDistance && xDistance < bestDistance) {
        bestDistance = xDistance;
        bestSnap = {
          position: [component.position[0], position[1], position[2]],
          rotation: rotation,
          snapType: 'alignment',
          confidence: 1 - (xDistance / snapDistance),
        };
      }
      
      // 检查Y轴对齐
      const yDistance = Math.abs(position[1] - component.position[1]);
      if (yDistance < snapDistance && yDistance < bestDistance) {
        bestDistance = yDistance;
        bestSnap = {
          position: [position[0], component.position[1], position[2]],
          rotation: rotation,
          snapType: 'alignment',
          confidence: 1 - (yDistance / snapDistance),
        };
      }
      
      // 检查Z轴对齐
      const zDistance = Math.abs(position[2] - component.position[2]);
      if (zDistance < snapDistance && zDistance < bestDistance) {
        bestDistance = zDistance;
        bestSnap = {
          position: [position[0], position[1], component.position[2]],
          rotation: rotation,
          snapType: 'alignment',
          confidence: 1 - (zDistance / snapDistance),
        };
      }
    }
    
    return bestSnap;
  }
  
  // 尝试网格吸附
  private tryGridSnap(
    position: [number, number, number],
    rotation: [number, number, number]
  ): SnapResult {
    const gridSize = this.config.gridSize;
    
    const snappedX = Math.round(position[0] / gridSize) * gridSize;
    const snappedY = Math.round(position[1] / gridSize) * gridSize;
    const snappedZ = Math.round(position[2] / gridSize) * gridSize;
    
    const distance = this.calculateDistance(position, [snappedX, snappedY, snappedZ]);
    
    return {
      position: [snappedX, snappedY, snappedZ],
      rotation: rotation,
      snapType: 'grid',
      confidence: distance < this.config.snapDistance ? 0.5 : 0,
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
    
    const pos = new THREE.Vector3(localPos[0], localPos[1], localPos[2]);
    pos.applyMatrix4(matrix);
    
    return [pos.x, pos.y, pos.z];
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
  
  // 检查连接点兼容性
  private arePointsCompatible(point1: any, point2: any): boolean {
    return (
      point1.compatible.includes(point2.type) ||
      point2.compatible.includes(point1.type)
    );
  }
  
  // 计算吸附后的位置
  private calculateSnappedPosition(
    currentPosition: [number, number, number],
    sourceLocalPos: [number, number, number],
    targetWorldPos: [number, number, number],
    rotation: [number, number, number]
  ): [number, number, number] {
    // 计算源连接点的世界坐标
    const sourceWorldPos = this.getWorldPosition(
      currentPosition,
      rotation,
      sourceLocalPos
    );
    
    // 计算偏移量
    const offset: [number, number, number] = [
      targetWorldPos[0] - sourceWorldPos[0],
      targetWorldPos[1] - sourceWorldPos[1],
      targetWorldPos[2] - sourceWorldPos[2],
    ];
    
    // 返回新的位置
    return [
      currentPosition[0] + offset[0],
      currentPosition[1] + offset[1],
      currentPosition[2] + offset[2],
    ];
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

// 创建单例
export const smartSnapSystem = new SmartSnapSystem();
