import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { getComponentById } from '../../../stores/componentLibrary';

// 拖拽系统
export const DragSystem: React.FC = () => {
  const { gl, camera, scene } = useThree();
  const { 
    components, 
    editor, 
    moveComponent, 
    setEditorState, 
    clearSelection,
    selectComponent,
    saveToHistory 
  } = useDesignStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<THREE.Vector3>(new THREE.Vector3());
  const [startPosition, setStartPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  
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
  const snapToGrid = useCallback((position: THREE.Vector3, gridSize: number = 10): THREE.Vector3 => {
    return new THREE.Vector3(
      Math.round(position.x / gridSize) * gridSize,
      position.y,
      Math.round(position.z / gridSize) * gridSize
    );
  }, []);
  
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
  
  // 鼠标按下
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return; // 只处理左键
    
    const clickedInstanceId = findClickedComponent(event);
    
    if (clickedInstanceId) {
      // 点击到组件
      if (event.shiftKey) {
        // 多选
        const store = useDesignStore.getState();
        store.toggleSelectComponent(clickedInstanceId);
      } else {
        // 单选
        clearSelection();
        selectComponent(clickedInstanceId);
        
        // 开始拖拽
        const component = components.find(c => c.instanceId === clickedInstanceId);
        if (component) {
          const mousePos = getMousePosition(event);
          setDragOffset(new THREE.Vector3(
            component.position[0] - mousePos.x,
            component.position[1] - mousePos.y,
            component.position[2] - mousePos.z
          ));
          setStartPosition(new THREE.Vector3(...component.position));
          setDragTarget(clickedInstanceId);
          setIsDragging(true);
          setEditorState({ activeTool: 'move' });
        }
      }
    } else {
      // 点击空白区域
      clearSelection();
    }
  }, [components, clearSelection, selectComponent, setEditorState, findClickedComponent, getMousePosition]);
  
  // 鼠标移动
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !dragTarget) return;
    
    const mousePos = getMousePosition(event);
    const newPosition = snapToGrid(new THREE.Vector3(
      mousePos.x + dragOffset.x,
      mousePos.y + dragOffset.y,
      mousePos.z + dragOffset.z
    ));
    
    moveComponent(dragTarget, [newPosition.x, newPosition.y, newPosition.z]);
  }, [isDragging, dragTarget, dragOffset, getMousePosition, snapToGrid, moveComponent]);
  
  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragTarget) {
      // 保存到历史
      saveToHistory();
    }
    
    setIsDragging(false);
    setDragTarget(null);
  }, [isDragging, dragTarget, saveToHistory]);
  
  // 注册事件
  useEffect(() => {
    const canvas = gl.domElement;
    
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
  }, [gl, handleMouseDown, handleMouseMove, handleMouseUp]);
  
  return null;
};

// 吸附系统
export const SnapSystem: React.FC = () => {
  const { components, editor, setEditorState } = useDesignStore();
  const [snapIndicator, setSnapIndicator] = useState<{
    position: [number, number, number];
    type: 'grid' | 'component';
  } | null>(null);
  
  // 查找最近的吸附点
  const findNearestSnapPoint = useCallback((
    position: THREE.Vector3,
    excludeInstanceId?: string
  ): { point: THREE.Vector3; type: 'grid' | 'component'; distance: number } | null => {
    const gridSize = editor.gridSize;
    const snapDistance = gridSize * 0.5;
    
    // 网格吸附点
    const gridX = Math.round(position.x / gridSize) * gridSize;
    const gridZ = Math.round(position.z / gridSize) * gridSize;
    const gridPoint = new THREE.Vector3(gridX, position.y, gridZ);
    const gridDistance = position.distanceTo(gridPoint);
    
    if (gridDistance < snapDistance) {
      return { point: gridPoint, type: 'grid', distance: gridDistance };
    }
    
    // 组件连接点吸附
    let nearestComponentSnap = null;
    let nearestDistance = Infinity;
    
    components.forEach(component => {
      if (component.instanceId === excludeInstanceId) return;
      
      const definition = getComponentById(component.componentId);
      if (!definition) return;
      
      definition.connectionPoints.forEach(point => {
        const worldPos = new THREE.Vector3(
          component.position[0] + point.position[0],
          component.position[1] + point.position[1],
          component.position[2] + point.position[2]
        );
        
        const distance = position.distanceTo(worldPos);
        
        if (distance < snapDistance && distance < nearestDistance) {
          nearestDistance = distance;
          nearestComponentSnap = { point: worldPos, type: 'component' as const, distance };
        }
      });
    });
    
    return nearestComponentSnap;
  }, [components, editor.gridSize]);
  
  return null;
};

// 旋转系统
export const RotationSystem: React.FC = () => {
  const { editor, rotateComponent, saveToHistory } = useDesignStore();
  
  // 处理旋转
  const handleRotate = useCallback((axis: 'x' | 'y' | 'z', degrees: number) => {
    const selectedComponents = editor.selectedComponents;
    if (selectedComponents.length === 0) return;
    
    selectedComponents.forEach(instanceId => {
      const component = useDesignStore.getState().components.find(c => c.instanceId === instanceId);
      if (component) {
        const newRotation = [...component.rotation] as [number, number, number];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newRotation[axisIndex] = ((newRotation[axisIndex] + degrees) % 360 + 360) % 360;
        rotateComponent(instanceId, newRotation);
      }
    });
    
    saveToHistory();
  }, [editor.selectedComponents, rotateComponent, saveToHistory]);
  
  return null;
};

// 删除系统
export const DeleteSystem: React.FC = () => {
  const { editor, removeComponent, clearSelection } = useDesignStore();
  
  // 处理删除
  const handleDelete = useCallback(() => {
    const selectedComponents = editor.selectedComponents;
    if (selectedComponents.length === 0) return;
    
    selectedComponents.forEach(instanceId => {
      removeComponent(instanceId);
    });
    
    clearSelection();
  }, [editor.selectedComponents, removeComponent, clearSelection]);
  
  return null;
};

// 导出所有系统
export const InteractionSystems: React.FC = () => {
  return (
    <>
      <DragSystem />
      <SnapSystem />
      <RotationSystem />
      <DeleteSystem />
    </>
  );
};

export default InteractionSystems;
