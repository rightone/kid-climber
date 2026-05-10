import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import * as THREE from 'three';

// 可用位置类型
export interface AvailablePosition {
  position: [number, number, number];
  direction: [number, number, number];
  componentId: string;
  type: 'available' | 'suggested' | 'warning';
  score: number; // 推荐分数 0-100
}

// 智能位置预测系统
export class SmartPositionPredictor {
  private gridSize: number = 20;
  
  // 计算可用位置
  calculateAvailablePositions(
    components: ComponentInstance[],
    selectedComponentId?: string
  ): AvailablePosition[] {
    const positions: AvailablePosition[] = [];
    
    // 获取所有未连接的连接点
    const unconnectedPoints = this.getUnconnectedPoints(components);
    
    unconnectedPoints.forEach(point => {
      // 计算可放置的组件类型
      const compatibleComponents = this.getCompatibleComponents(point);
      
      compatibleComponents.forEach(componentId => {
        // 检查碰撞
        if (!this.checkCollision(point.position, componentId, components)) {
          // 计算推荐分数
          const score = this.calculateScore(point, componentId, components);
          
          positions.push({
            position: point.position,
            direction: point.direction,
            componentId,
            type: score > 70 ? 'suggested' : score > 40 ? 'available' : 'warning',
            score,
          });
        }
      });
    });
    
    // 按分数排序
    positions.sort((a, b) => b.score - a.score);
    
    return positions;
  }
  
  // 获取未连接的连接点
  private getUnconnectedPoints(components: ComponentInstance[]): Array<{
    instanceId: string;
    pointId: string;
    position: [number, number, number];
    direction: [number, number, number];
    type: string;
    compatible: string[];
  }> {
    const connectedPoints = new Set<string>();
    const allPoints: Array<{
      instanceId: string;
      pointId: string;
      position: [number, number, number];
      direction: [number, number, number];
      type: string;
      compatible: string[];
    }> = [];
    
    // 收集所有连接点
    components.forEach(component => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      definition.connectionPoints.forEach(point => {
        const worldPos = this.getWorldPosition(component, point.position);
        const worldDir = this.getWorldDirection(component, point.direction);
        
        allPoints.push({
          instanceId: component.instanceId,
          pointId: point.id,
          position: worldPos,
          direction: worldDir,
          type: point.type,
          compatible: point.compatible,
        });
      });
    });
    
    // TODO: 从connections中获取已连接的点
    // 这里简化处理，返回所有点
    return allPoints;
  }
  
  // 获取兼容的组件类型
  private getCompatibleComponents(point: {
    type: string;
    compatible: string[];
  }): string[] {
    const compatible: string[] = [];
    
    // 管子
    if (point.compatible.includes('socket')) {
      compatible.push('pipe_35cm', 'pipe_15cm');
    }
    
    // 接头
    if (point.type === 'socket') {
      compatible.push(
        'connector_straight',
        'connector_L',
        'connector_T',
        'connector_45deg',
        'connector_3way',
        'connector_4way',
        'connector_cross',
        'connector_5way'
      );
    }
    
    // 板子
    compatible.push('board_40x40', 'board_40x20');
    
    return compatible;
  }
  
  // 检查碰撞
  private checkCollision(
    position: [number, number, number],
    componentId: string,
    components: ComponentInstance[]
  ): boolean {
    const definition = getComponentById(componentId);
    if (!definition) return false;
    
    // 简化碰撞检测：检查新组件是否会与现有组件重叠
    const newBounds = this.getComponentBounds(position, definition);
    
    for (const component of components) {
      const existingDef = getComponentById(component.componentId);
      if (!existingDef) continue;
      
      const existingBounds = this.getComponentBounds(component.position, existingDef);
      
      if (this.boundsIntersect(newBounds, existingBounds)) {
        return true; // 有碰撞
      }
    }
    
    return false; // 无碰撞
  }
  
  // 获取组件边界
  private getComponentBounds(
    position: [number, number, number],
    definition: any
  ): { min: [number, number, number]; max: [number, number, number] } {
    const width = definition.width || definition.diameter || 5;
    const height = definition.height || definition.length || 5;
    const depth = definition.diameter || 5;
    
    return {
      min: [
        position[0] - width / 2,
        position[1] - height / 2,
        position[2] - depth / 2,
      ],
      max: [
        position[0] + width / 2,
        position[1] + height / 2,
        position[2] + depth / 2,
      ],
    };
  }
  
  // 检查边界是否相交
  private boundsIntersect(
    a: { min: [number, number, number]; max: [number, number, number] },
    b: { min: [number, number, number]; max: [number, number, number] }
  ): boolean {
    return (
      a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
      a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
      a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
    );
  }
  
  // 计算推荐分数
  private calculateScore(
    point: any,
    componentId: string,
    components: ComponentInstance[]
  ): number {
    let score = 50; // 基础分
    
    // 管子优先
    if (componentId.startsWith('pipe')) {
      score += 20;
    }
    
    // 连接件次之
    if (componentId.startsWith('connector')) {
      score += 10;
    }
    
    // 位置在中心附近加分
    const distFromCenter = Math.sqrt(
      point.position[0] ** 2 + point.position[2] ** 2
    );
    if (distFromCenter < 100) {
      score += 10;
    }
    
    // 高度适中加分
    if (point.position[1] > 0 && point.position[1] < 200) {
      score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
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
  
  // 设置网格大小
  setGridSize(size: number): void {
    this.gridSize = size;
  }
}

// 创建单例
export const smartPositionPredictor = new SmartPositionPredictor();
