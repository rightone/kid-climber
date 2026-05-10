import * as THREE from 'three';

// 性能监控
export class PerformanceMonitor {
  private fps: number = 0;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private memoryUsage: number = 0;
  private renderTime: number = 0;
  
  // 更新FPS
  updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }
  
  // 获取FPS
  getFPS(): number {
    return this.fps;
  }
  
  // 更新内存使用
  updateMemoryUsage(): void {
    if ((performance as any).memory) {
      this.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
  }
  
  // 获取内存使用（MB）
  getMemoryUsage(): number {
    return this.memoryUsage;
  }
  
  // 更新渲染时间
  updateRenderTime(time: number): void {
    this.renderTime = time;
  }
  
  // 获取渲染时间（ms）
  getRenderTime(): number {
    return this.renderTime;
  }
  
  // 获取性能报告
  getReport(): PerformanceReport {
    return {
      fps: this.fps,
      memoryUsage: this.memoryUsage,
      renderTime: this.renderTime,
      timestamp: Date.now(),
    };
  }
}

// 性能报告
export interface PerformanceReport {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  timestamp: number;
}

// 几何体优化
export class GeometryOptimizer {
  // 合并相同材质的几何体
  static mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const mergedGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    let indexOffset = 0;
    
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
  }
  
  // 简化几何体
  static simplifyGeometry(geometry: THREE.BufferGeometry, ratio: number = 0.5): THREE.BufferGeometry {
    // 这里可以实现几何体简化算法
    // 目前返回原几何体
    return geometry;
  }
  
  // 计算边界盒
  static calculateBoundingBox(geometry: THREE.BufferGeometry): THREE.Box3 {
    geometry.computeBoundingBox();
    return geometry.boundingBox || new THREE.Box3();
  }
}

// 材质优化
export class MaterialOptimizer {
  private static materialCache = new Map<string, THREE.Material>();
  
  // 获取共享材质
  static getSharedMaterial(key: string, material: THREE.Material): THREE.Material {
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, material);
    }
    
    return this.materialCache.get(key)!;
  }
  
  // 清除材质缓存
  static clearCache(): void {
    this.materialCache.forEach((material) => {
      material.dispose();
    });
    this.materialCache.clear();
  }
}

// 渲染优化
export class RenderOptimizer {
  // 视锥体裁剪
  static isInViewFrustum(object: THREE.Object3D, camera: THREE.Camera): boolean {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    
    frustum.setFromProjectionMatrix(matrix);
    
    return frustum.intersectsObject(object);
  }
  
  // 距离裁剪
  static isWithinDistance(
    object: THREE.Object3D,
    camera: THREE.Camera,
    maxDistance: number
  ): boolean {
    const objectPosition = new THREE.Vector3();
    object.getWorldPosition(objectPosition);
    
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    
    return objectPosition.distanceTo(cameraPosition) <= maxDistance;
  }
  
  // LOD（细节层次）
  static getLODLevel(
    object: THREE.Object3D,
    camera: THREE.Camera
  ): 'high' | 'medium' | 'low' {
    const objectPosition = new THREE.Vector3();
    object.getWorldPosition(objectPosition);
    
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    
    const distance = objectPosition.distanceTo(cameraPosition);
    
    if (distance < 50) return 'high';
    if (distance < 100) return 'medium';
    return 'low';
  }
}

// 内存优化
export class MemoryOptimizer {
  // 释放几何体
  static disposeGeometry(geometry: THREE.BufferGeometry): void {
    geometry.dispose();
  }
  
  // 释放材质
  static disposeMaterial(material: THREE.Material): void {
    material.dispose();
  }
  
  // 释放纹理
  static disposeTexture(texture: THREE.Texture): void {
    texture.dispose();
  }
  
  // 释放对象
  static disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => {
              material.dispose();
            });
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
  
  // 强制垃圾回收
  static forceGarbageCollection(): void {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }
}

// 场景优化
export class SceneOptimizer {
  // 优化场景
  static optimizeScene(scene: THREE.Scene): void {
    // 合并相同材质的网格
    this.mergeMeshes(scene);
    
    // 移除不可见的对象
    this.removeInvisibleObjects(scene);
    
    // 优化材质
    this.optimizeMaterials(scene);
  }
  
  // 合并网格
  private static mergeMeshes(scene: THREE.Scene): void {
    // 这里可以实现网格合并逻辑
  }
  
  // 移除不可见对象
  private static removeInvisibleObjects(scene: THREE.Scene): void {
    const toRemove: THREE.Object3D[] = [];
    
    scene.traverse((child) => {
      if (!child.visible) {
        toRemove.push(child);
      }
    });
    
    toRemove.forEach((child) => {
      scene.remove(child);
    });
  }
  
  // 优化材质
  private static optimizeMaterials(scene: THREE.Scene): void {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.Material) {
          // 设置材质优化选项
          child.material.needsUpdate = true;
        }
      }
    });
  }
}

// 创建单例
export const performanceMonitor = new PerformanceMonitor();
