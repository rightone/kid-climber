import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';
import { getComponentById } from '../../../stores/componentLibrary';
import { createComponentGeometry } from '../utils/geometryUtils';

// 地面平面（用于鼠标交互）
const GroundPlane: React.FC = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#e8e8e8" visible={false} />
    </mesh>
  );
};

// 网格线组件
const GridLines: React.FC = () => {
  const { interaction } = useInteractionStore();
  const { gridSize, snapToGrid } = interaction;
  
  if (!snapToGrid) return null;
  
  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const size = 200; // 网格范围
    const halfSize = size / 2;
    
    // 水平线
    for (let z = -halfSize; z <= halfSize; z += gridSize) {
      points.push(new THREE.Vector3(-halfSize, 0, z));
      points.push(new THREE.Vector3(halfSize, 0, z));
    }
    
    // 垂直线
    for (let x = -halfSize; x <= halfSize; x += gridSize) {
      points.push(new THREE.Vector3(x, 0, -halfSize));
      points.push(new THREE.Vector3(x, 0, halfSize));
    }
    
    return points;
  }, [gridSize]);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(lines);
    return geo;
  }, [lines]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#cccccc" transparent opacity={0.3} />
    </lineSegments>
  );
};

// 放置预览组件
const PlacePreview: React.FC = () => {
  const { interaction } = useInteractionStore();
  const { placeState, showPreview, gridSize } = interaction;
  
  // 获取组件定义
  const definition = useMemo(() => {
    if (!placeState.componentId) return null;
    return getComponentById(placeState.componentId);
  }, [placeState.componentId]);
  
  // 创建几何体
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(placeState.componentId!, definition);
  }, [placeState.componentId, definition]);
  
  if (!showPreview || !placeState.previewPosition || !definition) {
    return null;
  }
  
  const [x, y, z] = placeState.previewPosition;
  
  return (
    <group position={[x, y, z]}>
      {/* 预览组件 */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={placeState.isValid ? '#52c41a' : '#ff4d4f'}
          transparent
          opacity={0.5}
          wireframe
        />
      </mesh>
      
      {/* 放置点指示器 */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[1, 1, 0.2, 16]} />
        <meshBasicMaterial
          color={placeState.isValid ? '#52c41a' : '#ff4d4f'}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* 连接点指示 */}
      {definition.connectionPoints.map((point, index) => (
        <group key={index} position={point.position}>
          <mesh>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial
              color="#1890ff"
              transparent
              opacity={0.6}
            />
          </mesh>
        </group>
      ))}
      
      {/* 网格吸附指示 */}
      {interaction.snapToGrid && (
        <>
          {/* 十字线 */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([
                  -gridSize / 2, 0, 0,
                  gridSize / 2, 0, 0,
                ]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#1890ff" transparent opacity={0.5} />
          </line>
          
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([
                  0, 0, -gridSize / 2,
                  0, 0, gridSize / 2,
                ]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#1890ff" transparent opacity={0.5} />
          </line>
        </>
      )}
    </group>
  );
};

// 主交互系统组件
export const InteractionSystem: React.FC = () => {
  const { gl, camera, scene } = useThree();
  const { addComponent, moveComponent, saveToHistory, components } = useDesignStore();
  const { interaction, updatePlacePreview, startDrag, endDrag } = useInteractionStore();
  
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  
  // 获取鼠标在3D空间中的位置
  const getMousePosition = useCallback((event: MouseEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.current.setFromCamera(mouse.current, camera);
    
    // 与地面平面相交
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    
    if (raycaster.current.ray.intersectPlane(groundPlane, intersectPoint)) {
      return intersectPoint;
    }
    
    return null;
  }, [gl, camera]);
  
  // 查找点击的组件
  const findClickedComponent = useCallback((event: MouseEvent): string | null => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    for (const intersect of intersects) {
      let object: THREE.Object3D | null = intersect.object;
      
      while (object) {
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
    if (event.button !== 0) return;
    
    const { mode, placeState } = interaction;
    
    if (mode === 'place' && placeState.componentId && placeState.previewPosition) {
      // 放置模式：点击放置组件
      addComponent({
        instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        componentId: placeState.componentId,
        position: placeState.previewPosition,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });
      saveToHistory();
      useInteractionStore.getState().cancelPlace();
    } else if (mode === 'select' || mode === 'move') {
      const clickedId = findClickedComponent(event);
      
      if (clickedId) {
        const { selectComponent } = useDesignStore.getState();
        selectComponent(clickedId);
        
        if (mode === 'move') {
          const mousePos = getMousePosition(event);
          if (mousePos) {
            const component = components.find(c => c.instanceId === clickedId);
            if (component) {
              const offset: [number, number, number] = [
                mousePos.x - component.position[0],
                mousePos.y - component.position[1],
                mousePos.z - component.position[2],
              ];
              startDrag(clickedId, offset);
            }
          }
        }
      } else {
        const { clearSelection } = useDesignStore.getState();
        clearSelection();
      }
    }
  }, [interaction, addComponent, saveToHistory, findClickedComponent, getMousePosition, startDrag, components]);
  
  // 鼠标移动
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const { mode, isDragging, snapToGrid, gridSize } = interaction;
    
    const mousePos = getMousePosition(event);
    if (!mousePos) return;
    
    if (mode === 'place') {
      // 对齐到网格
      let snappedPosition: [number, number, number] = [mousePos.x, mousePos.y, mousePos.z];
      if (snapToGrid) {
        snappedPosition = [
          Math.round(mousePos.x / gridSize) * gridSize,
          mousePos.y,
          Math.round(mousePos.z / gridSize) * gridSize,
        ];
      }
      updatePlacePreview(snappedPosition);
    } else if (isDragging) {
      const { dragTarget, dragOffset } = interaction;
      if (dragTarget) {
        // 对齐到网格
        let snappedPosition: [number, number, number] = [mousePos.x, mousePos.y, mousePos.z];
        if (snapToGrid) {
          snappedPosition = [
            Math.round(mousePos.x / gridSize) * gridSize,
            mousePos.y,
            Math.round(mousePos.z / gridSize) * gridSize,
          ];
        }
        
        const newPosition: [number, number, number] = [
          snappedPosition[0] - dragOffset[0],
          snappedPosition[1] - dragOffset[1],
          snappedPosition[2] - dragOffset[2],
        ];
        
        moveComponent(dragTarget, newPosition);
      }
    }
  }, [interaction, getMousePosition, updatePlacePreview, moveComponent]);
  
  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    if (interaction.isDragging) {
      endDrag();
      saveToHistory();
    }
  }, [interaction.isDragging, endDrag, saveToHistory]);
  
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
  
  return (
    <>
      <GroundPlane />
      <GridLines />
      <PlacePreview />
    </>
  );
};

export default InteractionSystem;
