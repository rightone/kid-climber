import { ComponentInstance } from '../types';
import * as THREE from 'three';

// 测量结果
export interface MeasurementResult {
  distance: number;
  startPoint: [number, number, number];
  endPoint: [number, number, number];
  unit: string;
}

// 对齐方式
export type AlignMode = 
  | 'left' 
  | 'right' 
  | 'top' 
  | 'bottom' 
  | 'front' 
  | 'back' 
  | 'center-x' 
  | 'center-y' 
  | 'center-z'
  | 'distribute-x'
  | 'distribute-y'
  | 'distribute-z';

// 测量工具
export class MeasurementTool {
  // 计算两点间距离
  calculateDistance(
    point1: [number, number, number],
    point2: [number, number, number]
  ): MeasurementResult {
    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    const dz = point2[2] - point1[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return {
      distance: Math.round(distance * 100) / 100,
      startPoint: point1,
      endPoint: point2,
      unit: 'cm',
    };
  }
  
  // 计算组件间距离
  calculateComponentDistance(
    component1: ComponentInstance,
    component2: ComponentInstance
  ): MeasurementResult {
    return this.calculateDistance(component1.position, component2.position);
  }
  
  // 计算组件到点的距离
  calculatePointDistance(
    component: ComponentInstance,
    point: [number, number, number]
  ): MeasurementResult {
    return this.calculateDistance(component.position, point);
  }
  
  // 计算多个组件的中心点
  calculateCenter(components: ComponentInstance[]): [number, number, number] {
    if (components.length === 0) return [0, 0, 0];
    
    let sumX = 0, sumY = 0, sumZ = 0;
    components.forEach(comp => {
      sumX += comp.position[0];
      sumY += comp.position[1];
      sumZ += comp.position[2];
    });
    
    return [
      sumX / components.length,
      sumY / components.length,
      sumZ / components.length,
    ];
  }
  
  // 计算包围盒
  calculateBoundingBox(components: ComponentInstance[]): {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
  } {
    if (components.length === 0) {
      return {
        min: [0, 0, 0],
        max: [0, 0, 0],
        size: [0, 0, 0],
        center: [0, 0, 0],
      };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    components.forEach(comp => {
      const [x, y, z] = comp.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    });
    
    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      size: [maxX - minX, maxY - minY, maxZ - minZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    };
  }
}

// 对齐工具
export class AlignmentTool {
  // 对齐组件
  alignComponents(
    components: ComponentInstance[],
    mode: AlignMode
  ): ComponentInstance[] {
    if (components.length < 2) return components;
    
    const result = components.map(c => ({ ...c }));
    
    switch (mode) {
      case 'left':
        return this.alignLeft(result);
      case 'right':
        return this.alignRight(result);
      case 'top':
        return this.alignTop(result);
      case 'bottom':
        return this.alignBottom(result);
      case 'front':
        return this.alignFront(result);
      case 'back':
        return this.alignBack(result);
      case 'center-x':
        return this.alignCenterX(result);
      case 'center-y':
        return this.alignCenterY(result);
      case 'center-z':
        return this.alignCenterZ(result);
      case 'distribute-x':
        return this.distributeX(result);
      case 'distribute-y':
        return this.distributeY(result);
      case 'distribute-z':
        return this.distributeZ(result);
      default:
        return result;
    }
  }
  
  // 左对齐
  private alignLeft(components: ComponentInstance[]): ComponentInstance[] {
    const minX = Math.min(...components.map(c => c.position[0]));
    return components.map(c => ({
      ...c,
      position: [minX, c.position[1], c.position[2]] as [number, number, number],
    }));
  }
  
  // 右对齐
  private alignRight(components: ComponentInstance[]): ComponentInstance[] {
    const maxX = Math.max(...components.map(c => c.position[0]));
    return components.map(c => ({
      ...c,
      position: [maxX, c.position[1], c.position[2]] as [number, number, number],
    }));
  }
  
  // 顶部对齐
  private alignTop(components: ComponentInstance[]): ComponentInstance[] {
    const maxY = Math.max(...components.map(c => c.position[1]));
    return components.map(c => ({
      ...c,
      position: [c.position[0], maxY, c.position[2]] as [number, number, number],
    }));
  }
  
  // 底部对齐
  private alignBottom(components: ComponentInstance[]): ComponentInstance[] {
    const minY = Math.min(...components.map(c => c.position[1]));
    return components.map(c => ({
      ...c,
      position: [c.position[0], minY, c.position[2]] as [number, number, number],
    }));
  }
  
  // 前对齐
  private alignFront(components: ComponentInstance[]): ComponentInstance[] {
    const minZ = Math.min(...components.map(c => c.position[2]));
    return components.map(c => ({
      ...c,
      position: [c.position[0], c.position[1], minZ] as [number, number, number],
    }));
  }
  
  // 后对齐
  private alignBack(components: ComponentInstance[]): ComponentInstance[] {
    const maxZ = Math.max(...components.map(c => c.position[2]));
    return components.map(c => ({
      ...c,
      position: [c.position[0], c.position[1], maxZ] as [number, number, number],
    }));
  }
  
  // X轴居中
  private alignCenterX(components: ComponentInstance[]): ComponentInstance[] {
    const centerX = components.reduce((sum, c) => sum + c.position[0], 0) / components.length;
    return components.map(c => ({
      ...c,
      position: [centerX, c.position[1], c.position[2]] as [number, number, number],
    }));
  }
  
  // Y轴居中
  private alignCenterY(components: ComponentInstance[]): ComponentInstance[] {
    const centerY = components.reduce((sum, c) => sum + c.position[1], 0) / components.length;
    return components.map(c => ({
      ...c,
      position: [c.position[0], centerY, c.position[2]] as [number, number, number],
    }));
  }
  
  // Z轴居中
  private alignCenterZ(components: ComponentInstance[]): ComponentInstance[] {
    const centerZ = components.reduce((sum, c) => sum + c.position[2], 0) / components.length;
    return components.map(c => ({
      ...c,
      position: [c.position[0], c.position[1], centerZ] as [number, number, number],
    }));
  }
  
  // X轴分布
  private distributeX(components: ComponentInstance[]): ComponentInstance[] {
    const sorted = [...components].sort((a, b) => a.position[0] - b.position[0]);
    const minX = sorted[0].position[0];
    const maxX = sorted[sorted.length - 1].position[0];
    const step = sorted.length > 1 ? (maxX - minX) / (sorted.length - 1) : 0;
    
    return sorted.map((c, i) => ({
      ...c,
      position: [minX + i * step, c.position[1], c.position[2]] as [number, number, number],
    }));
  }
  
  // Y轴分布
  private distributeY(components: ComponentInstance[]): ComponentInstance[] {
    const sorted = [...components].sort((a, b) => a.position[1] - b.position[1]);
    const minY = sorted[0].position[1];
    const maxY = sorted[sorted.length - 1].position[1];
    const step = sorted.length > 1 ? (maxY - minY) / (sorted.length - 1) : 0;
    
    return sorted.map((c, i) => ({
      ...c,
      position: [c.position[0], minY + i * step, c.position[2]] as [number, number, number],
    }));
  }
  
  // Z轴分布
  private distributeZ(components: ComponentInstance[]): ComponentInstance[] {
    const sorted = [...components].sort((a, b) => a.position[2] - b.position[2]);
    const minZ = sorted[0].position[2];
    const maxZ = sorted[sorted.length - 1].position[2];
    const step = sorted.length > 1 ? (maxZ - minZ) / (sorted.length - 1) : 0;
    
    return sorted.map((c, i) => ({
      ...c,
      position: [c.position[0], c.position[1], minZ + i * step] as [number, number, number],
    }));
  }
}

// 创建单例
export const measurementTool = new MeasurementTool();
export const alignmentTool = new AlignmentTool();
