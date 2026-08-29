import { ComponentInstance, Connection } from '../types';
import { getComponentById } from '../stores/componentLibrary';

// 图纸配置
export interface DrawingConfig {
  format: 'A4' | 'A3' | 'A2';
  orientation: 'portrait' | 'landscape';
  scale: number;
  showDimensions: boolean;
  showLabels: boolean;
  showGrid: boolean;
  showConnectionPoints: boolean;
  title: string;
  subtitle: string;
  author: string;
  date: string;
}

// 图纸元素
export interface DrawingElement {
  type: 'line' | 'circle' | 'rect' | 'text' | 'dimension' | 'label';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  lineWidth?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

// 图纸结果
export interface DrawingResult {
  elements: DrawingElement[];
  config: DrawingConfig;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// 施工图纸生成系统
export class DrawingSystem {
  // 默认配置
  private defaultConfig: DrawingConfig = {
    format: 'A4',
    orientation: 'landscape',
    scale: 1,
    showDimensions: true,
    showLabels: true,
    showGrid: true,
    showConnectionPoints: true,
    title: '攀爬架施工图纸',
    subtitle: '',
    author: '',
    date: new Date().toISOString().split('T')[0],
  };
  
  // 生成图纸
  generateDrawing(
    components: ComponentInstance[],
    connections: Connection[],
    config?: Partial<DrawingConfig>
  ): DrawingResult {
    const drawingConfig = { ...this.defaultConfig, ...config };
    const elements: DrawingElement[] = [];
    
    // 计算边界
    const bounds = this.calculateBounds(components);
    
    // 添加标题栏
    elements.push(...this.createTitleBlock(drawingConfig, bounds));
    
    // 添加网格
    if (drawingConfig.showGrid) {
      elements.push(...this.createGrid(bounds, drawingConfig.scale));
    }
    
    // 添加组件
    components.forEach((component) => {
      elements.push(...this.createComponentDrawing(component, drawingConfig));
    });
    
    // 添加连接
    connections.forEach((connection) => {
      elements.push(...this.createConnectionDrawing(connection, components, drawingConfig));
    });
    
    // 添加尺寸标注
    if (drawingConfig.showDimensions) {
      elements.push(...this.createDimensions(components, drawingConfig));
    }
    
    // 添加标签
    if (drawingConfig.showLabels) {
      elements.push(...this.createLabels(components, drawingConfig));
    }
    
    return {
      elements,
      config: drawingConfig,
      bounds,
    };
  }
  
  // 计算边界
  private calculateBounds(components: ComponentInstance[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    components.forEach((component) => {
      const [x, y] = component.position;
      const definition = getComponentById(component.componentId);
      
      if (definition) {
        const width = definition.width || definition.length || 10;
        const height = definition.height || definition.length || 10;
        
        minX = Math.min(minX, x - width / 2);
        maxX = Math.max(maxX, x + width / 2);
        minY = Math.min(minY, y - height / 2);
        maxY = Math.max(maxY, y + height / 2);
      }
    });
    
    // 添加边距
    const margin = 50;
    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin,
    };
  }
  
  // 创建标题栏
  private createTitleBlock(config: DrawingConfig, bounds: any): DrawingElement[] {
    const elements: DrawingElement[] = [];
    const x = bounds.maxX - 200;
    const y = bounds.minY + 20;
    
    // 标题框
    elements.push({
      type: 'rect',
      x,
      y,
      width: 180,
      height: 80,
      color: '#000',
      lineWidth: 2,
    });
    
    // 标题
    elements.push({
      type: 'text',
      x: x + 90,
      y: y + 20,
      text: config.title,
      fontSize: 14,
      color: '#000',
    });
    
    // 副标题
    if (config.subtitle) {
      elements.push({
        type: 'text',
        x: x + 90,
        y: y + 40,
        text: config.subtitle,
        fontSize: 10,
        color: '#666',
      });
    }
    
    // 作者和日期
    elements.push({
      type: 'text',
      x: x + 90,
      y: y + 60,
      text: `${config.author} | ${config.date}`,
      fontSize: 8,
      color: '#999',
    });
    
    return elements;
  }
  
  // 创建网格
  private createGrid(bounds: any, scale: number): DrawingElement[] {
    const elements: DrawingElement[] = [];
    const gridSize = 10 * scale;
    
    // 垂直线
    for (let x = bounds.minX; x <= bounds.maxX; x += gridSize) {
      elements.push({
        type: 'line',
        startX: x,
        startY: bounds.minY,
        endX: x,
        endY: bounds.maxY,
        color: '#eee',
        lineWidth: 0.5,
      });
    }
    
    // 水平线
    for (let y = bounds.minY; y <= bounds.maxY; y += gridSize) {
      elements.push({
        type: 'line',
        startX: bounds.minX,
        startY: y,
        endX: bounds.maxX,
        endY: y,
        color: '#eee',
        lineWidth: 0.5,
      });
    }
    
    return elements;
  }
  
  // 创建组件图纸
  private createComponentDrawing(component: ComponentInstance, config: DrawingConfig): DrawingElement[] {
    const elements: DrawingElement[] = [];
    const definition = getComponentById(component.componentId);
    
    if (!definition) return elements;
    
    const [x, y] = component.position;
    const [rotation] = component.rotation;
    const width = definition.width || definition.length || 10;
    const height = definition.height || definition.length || 10;
    
    // 根据组件类型绘制
    const [type] = component.componentId.split('_');
    
    switch (type) {
      case 'pipe':
        // 绘制管子
        elements.push({
          type: 'rect',
          x: x - width / 2,
          y: y - 2.5,
          width,
          height: 5,
          color: '#000',
          lineWidth: 1,
        });
        break;
        
      case 'elbow':
        // 绘制弯头
        elements.push({
          type: 'circle',
          x,
          y,
          radius: 5,
          color: '#000',
          lineWidth: 1,
        });
        break;
        
      case 'tee':
        // 绘制三通
        elements.push({
          type: 'circle',
          x,
          y,
          radius: 6,
          color: '#000',
          lineWidth: 1,
        });
        break;
        
      case 'cross':
        // 绘制四通
        elements.push({
          type: 'circle',
          x,
          y,
          radius: 7,
          color: '#000',
          lineWidth: 1,
        });
        break;
        
      case 'platform':
        // 绘制平台
        elements.push({
          type: 'rect',
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
          color: '#000',
          lineWidth: 1,
        });
        break;
        
      default:
        // 默认绘制矩形
        elements.push({
          type: 'rect',
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
          color: '#000',
          lineWidth: 1,
        });
    }
    
    // 添加连接点
    if (config.showConnectionPoints) {
      definition.connectionPoints.forEach((point) => {
        const pointX = x + point.position[0];
        const pointY = y + point.position[1];
        
        elements.push({
          type: 'circle',
          x: pointX,
          y: pointY,
          radius: 2,
          color: point.type === 'socket' ? '#f00' : '#0f0',
          lineWidth: 1,
        });
      });
    }
    
    return elements;
  }
  
  // 创建连接图纸
  private createConnectionDrawing(
    connection: Connection,
    components: ComponentInstance[],
    config: DrawingConfig
  ): DrawingElement[] {
    const elements: DrawingElement[] = [];
    
    const sourceComponent = components.find((c) => c.instanceId === connection.source.componentId);
    const targetComponent = components.find((c) => c.instanceId === connection.target.componentId);
    
    if (!sourceComponent || !targetComponent) return elements;
    
    const sourceDef = getComponentById(sourceComponent.componentId);
    const targetDef = getComponentById(targetComponent.componentId);
    
    if (!sourceDef || !targetDef) return elements;
    
    const sourcePoint = sourceDef.connectionPoints.find((p) => p.id === connection.source.pointId);
    const targetPoint = targetDef.connectionPoints.find((p) => p.id === connection.target.pointId);
    
    if (!sourcePoint || !targetPoint) return elements;
    
    const sourceX = sourceComponent.position[0] + sourcePoint.position[0];
    const sourceY = sourceComponent.position[1] + sourcePoint.position[1];
    const targetX = targetComponent.position[0] + targetPoint.position[0];
    const targetY = targetComponent.position[1] + targetPoint.position[1];
    
    // 绘制连接线
    elements.push({
      type: 'line',
      startX: sourceX,
      startY: sourceY,
      endX: targetX,
      endY: targetY,
      color: '#00f',
      lineWidth: 1,
    });
    
    return elements;
  }
  
  // 创建尺寸标注
  private createDimensions(components: ComponentInstance[], config: DrawingConfig): DrawingElement[] {
    const elements: DrawingElement[] = [];
    
    // 为每个组件添加尺寸标注
    components.forEach((component) => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      const [x, y] = component.position;
      const width = definition.width || definition.length || 10;
      const height = definition.height || definition.length || 10;
      
      // 水平尺寸
      elements.push({
        type: 'dimension',
        startX: x - width / 2,
        startY: y + height / 2 + 10,
        endX: x + width / 2,
        endY: y + height / 2 + 10,
        text: `${width}cm`,
        fontSize: 8,
        color: '#000',
      });
      
      // 垂直尺寸
      elements.push({
        type: 'dimension',
        startX: x + width / 2 + 10,
        startY: y - height / 2,
        endX: x + width / 2 + 10,
        endY: y + height / 2,
        text: `${height}cm`,
        fontSize: 8,
        color: '#000',
      });
    });
    
    return elements;
  }
  
  // 创建标签
  private createLabels(components: ComponentInstance[], config: DrawingConfig): DrawingElement[] {
    const elements: DrawingElement[] = [];
    
    // 为每个组件添加标签
    components.forEach((component, index) => {
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      const [x, y] = component.position;
      
      elements.push({
        type: 'label',
        x,
        y: y - 15,
        text: `${index + 1}. ${definition.name}`,
        fontSize: 8,
        color: '#000',
      });
    });
    
    return elements;
  }
  
  // 导出为SVG
  exportToSVG(drawing: DrawingResult): string {
    const { elements, bounds } = drawing;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}">`;
    
    elements.forEach((element) => {
      switch (element.type) {
        case 'line':
          svg += `<line x1="${element.startX}" y1="${element.startY}" x2="${element.endX}" y2="${element.endY}" stroke="${element.color}" stroke-width="${element.lineWidth}" />`;
          break;
        case 'circle':
          svg += `<circle cx="${element.x}" cy="${element.y}" r="${element.radius}" fill="none" stroke="${element.color}" stroke-width="${element.lineWidth}" />`;
          break;
        case 'rect':
          svg += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="none" stroke="${element.color}" stroke-width="${element.lineWidth}" />`;
          break;
        case 'text':
          svg += `<text x="${element.x}" y="${element.y}" font-size="${element.fontSize}" fill="${element.color}" text-anchor="middle">${element.text}</text>`;
          break;
      }
    });
    
    svg += '</svg>';
    return svg;
  }
  
  // 导出为JSON
  exportToJSON(drawing: DrawingResult): string {
    return JSON.stringify(drawing, null, 2);
  }
}

// 创建单例
export const drawingSystem = new DrawingSystem();
