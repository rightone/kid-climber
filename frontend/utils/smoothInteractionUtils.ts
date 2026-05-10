import { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDesignStore } from '../../stores/designStore';

// 拖拽配置
export interface DragConfig {
  enabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  smoothFactor: number;
  showPreview: boolean;
}

// 拖拽状态
export interface DragState {
  isDragging: boolean;
  targetId: string | null;
  startPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  offset: THREE.Vector3;
  velocity: THREE.Vector3;
}

// 平滑拖拽Hook
export const useSmoothDrag = (config?: Partial<DragConfig>) => {
  const defaultConfig: DragConfig = {
    enabled: true,
    snapToGrid: true,
    gridSize: 10,
    smoothFactor: 0.1,
    showPreview: true,
    ...config,
  };
  
  const { gl, camera, scene } = useThree();
  const { components, moveComponent, saveToHistory } = useDesignStore();
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    targetId: null,
    startPosition: new THREE.Vector3(),
    currentPosition: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
  });
  
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const targetPosition = useRef(new THREE.Vector3());
  const isAnimating = useRef(false);
  
  // 获取鼠标位置
  const getMousePosition = useCallback((event: MouseEvent): THREE.Vector3 => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersectPoint = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint);
    
    return intersectPoint;
  }, [gl, camera]);
  
  // 网格吸附
  const snapToGrid = useCallback((position: THREE.Vector3): THREE.Vector3 => {
    if (!defaultConfig.snapToGrid) return position;
    
    const gridSize = defaultConfig.gridSize;
    return new THREE.Vector3(
      Math.round(position.x / gridSize) * gridSize,
      position.y,
      Math.round(position.z / gridSize) * gridSize
    );
  }, [defaultConfig.snapToGrid, defaultConfig.gridSize]);
  
  // 查找点击的组件
  const findClickedComponent = useCallback((event: MouseEvent): string | null => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    for (const intersect of intersects) {
      let object = intersect.object;
      
      // 向上遍历找到组件组
      while (object.parent) {
        if (object.userData.instanceId) {
          return object.userData.instanceId;
        }
        object = object.parent;
      }
    }
    
    return null;
  }, [gl, camera, scene]);
  
  // 开始拖拽
  const startDrag = useCallback((event: MouseEvent) => {
    if (!defaultConfig.enabled) return;
    
    const clickedId = findClickedComponent(event);
    
    if (clickedId) {
      const component = components.find(c => c.instanceId === clickedId);
      
      if (component) {
        const mousePos = getMousePosition(event);
        const componentPos = new THREE.Vector3(...component.position);
        
        setDragState({
          isDragging: true,
          targetId: clickedId,
          startPosition: componentPos.clone(),
          currentPosition: componentPos.clone(),
          offset: componentPos.clone().sub(mousePos),
          velocity: new THREE.Vector3(),
        });
        
        targetPosition.current.copy(componentPos);
      }
    }
  }, [defaultConfig.enabled, components, findClickedComponent, getMousePosition]);
  
  // 更新拖拽
  const updateDrag = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || !dragState.targetId) return;
    
    const mousePos = getMousePosition(event);
    const newPos = mousePos.add(dragState.offset);
    const snappedPos = snapToGrid(newPos);
    
    // 平滑插值
    targetPosition.current.lerp(snappedPos, defaultConfig.smoothFactor);
    
    setDragState(prev => ({
      ...prev,
      currentPosition: targetPosition.current.clone(),
    }));
    
    // 更新组件位置
    moveComponent(dragState.targetId, [
      targetPosition.current.x,
      targetPosition.current.y,
      targetPosition.current.z,
    ]);
  }, [dragState.isDragging, dragState.targetId, dragState.offset, getMousePosition, snapToGrid, defaultConfig.smoothFactor, moveComponent]);
  
  // 结束拖拽
  const endDrag = useCallback(() => {
    if (dragState.isDragging && dragState.targetId) {
      // 保存到历史
      saveToHistory();
    }
    
    setDragState({
      isDragging: false,
      targetId: null,
      startPosition: new THREE.Vector3(),
      currentPosition: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
    });
  }, [dragState.isDragging, dragState.targetId, saveToHistory]);
  
  // 注册事件
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleMouseDown = (e: MouseEvent) => startDrag(e);
    const handleMouseMove = (e: MouseEvent) => updateDrag(e);
    const handleMouseUp = () => endDrag();
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [gl, startDrag, updateDrag, endDrag]);
  
  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
  };
};

// 平滑动画Hook
export const useSmoothAnimation = () => {
  const animationRef = useRef<number>();
  const isAnimating = useRef(false);
  
  // 平滑移动
  const smoothMove = useCallback((
    object: THREE.Object3D,
    targetPosition: THREE.Vector3,
    duration: number = 300
  ) => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    const startPosition = object.position.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 缓动函数
      const eased = 1 - Math.pow(1 - progress, 3);
      
      object.position.lerpVectors(startPosition, targetPosition, eased);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isAnimating.current = false;
      }
    };
    
    animate();
  }, []);
  
  // 平滑旋转
  const smoothRotate = useCallback((
    object: THREE.Object3D,
    targetRotation: THREE.Euler,
    duration: number = 300
  ) => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    const startRotation = object.rotation.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 缓动函数
      const eased = 1 - Math.pow(1 - progress, 3);
      
      object.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
      object.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
      object.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isAnimating.current = false;
      }
    };
    
    animate();
  }, []);
  
  // 平滑缩放
  const smoothScale = useCallback((
    object: THREE.Object3D,
    targetScale: THREE.Vector3,
    duration: number = 300
  ) => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    const startScale = object.scale.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 缓动函数
      const eased = 1 - Math.pow(1 - progress, 3);
      
      object.scale.lerpVectors(startScale, targetScale, eased);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isAnimating.current = false;
      }
    };
    
    animate();
  }, []);
  
  // 清理
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  return {
    smoothMove,
    smoothRotate,
    smoothScale,
    isAnimating: isAnimating.current,
  };
};

// 吸附动画Hook
export const useSnapAnimation = () => {
  const [snapIndicator, setSnapIndicator] = useState<{
    position: THREE.Vector3;
    visible: boolean;
  }>({
    position: new THREE.Vector3(),
    visible: false,
  });
  
  // 显示吸附指示器
  const showSnapIndicator = useCallback((position: THREE.Vector3) => {
    setSnapIndicator({
      position: position.clone(),
      visible: true,
    });
  }, []);
  
  // 隐藏吸附指示器
  const hideSnapIndicator = useCallback(() => {
    setSnapIndicator(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);
  
  return {
    snapIndicator,
    showSnapIndicator,
    hideSnapIndicator,
  };
};

// 连接动画Hook
export const useConnectionAnimation = () => {
  const [connectionEffect, setConnectionEffect] = useState<{
    position: THREE.Vector3;
    active: boolean;
  }>({
    position: new THREE.Vector3(),
    active: false,
  });
  
  // 播放连接成功动画
  const playConnectionEffect = useCallback((position: THREE.Vector3) => {
    setConnectionEffect({
      position: position.clone(),
      active: true,
    });
    
    // 2秒后停止
    setTimeout(() => {
      setConnectionEffect(prev => ({
        ...prev,
        active: false,
      }));
    }, 2000);
  }, []);
  
  return {
    connectionEffect,
    playConnectionEffect,
  };
};

// 导出所有交互Hook
export const useInteractions = () => {
  const smoothDrag = useSmoothDrag();
  const smoothAnimation = useSmoothAnimation();
  const snapAnimation = useSnapAnimation();
  const connectionAnimation = useConnectionAnimation();
  
  return {
    drag: smoothDrag,
    animation: smoothAnimation,
    snap: snapAnimation,
    connection: connectionAnimation,
  };
};
