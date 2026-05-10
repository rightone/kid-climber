import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { getComponentById } from '../../../stores/componentLibrary';
import { createComponentGeometry } from '../utils/geometryUtils';

// 组件材质
const createMaterial = (color: string, isSelected: boolean, isHovered: boolean): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: isSelected ? '#ff6b6b' : isHovered ? '#ffd93d' : color,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: isHovered ? 0.9 : 1,
  });
};

// 获取组件颜色
const getComponentColor = (componentId: string): string => {
  const [type] = componentId.split('_');
  
  switch (type) {
    case 'pipe':
      return '#4ecdc4';
    case 'elbow':
    case 'tee':
    case 'cross':
      return '#45b7d1';
    case 'platform':
      return '#96ceb4';
    case 'swing':
    case 'slide':
    case 'rope':
      return '#feca57';
    default:
      return '#95a5a6';
  }
};

// 单个组件渲染
interface ClimberComponentProps {
  instanceId: string;
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  showConnections: boolean;
  onClick: (e: any) => void;
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
}

const ClimberComponent: React.FC<ClimberComponentProps> = React.memo(({
  instanceId: _instanceId,
  componentId,
  position,
  rotation,
  scale,
  isSelected,
  isHovered,
  showConnections,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 获取组件定义
  const definition = useMemo(() => getComponentById(componentId), [componentId]);
  
  // 创建几何体
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(componentId, definition);
  }, [componentId, definition]);
  
  // 创建材质
  const material = useMemo(() => {
    const color = getComponentColor(componentId);
    return createMaterial(color, isSelected, isHovered);
  }, [componentId, isSelected, isHovered]);
  
  // 转换旋转角度为弧度
  const rotationRad = useMemo(() => [
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
  ], [rotation]);
  
  // 连接点可视化
  const connectionPoints = useMemo(() => {
    if (!showConnections || !definition) return null;
    
    return definition.connectionPoints.map((point, index) => {
      const isSocket = point.type === 'socket';
      
      return (
        <group key={index} position={point.position}>
          {/* 连接点指示器 */}
          <mesh>
            {isSocket ? (
              <torusGeometry args={[1.5, 0.3, 8, 16]} />
            ) : (
              <sphereGeometry args={[0.8, 16, 16]} />
            )}
            <meshBasicMaterial
              color={isSocket ? '#ff6b6b' : '#52c41a'}
              transparent
              opacity={0.6}
            />
          </mesh>
          
          {/* 连接方向指示 */}
          <arrowHelper
            args={[
              new THREE.Vector3(...point.direction),
              new THREE.Vector3(0, 0, 0),
              3,
              isSocket ? '#ff6b6b' : '#52c41a',
              1,
              0.5,
            ]}
          />
        </group>
      );
    });
  }, [showConnections, definition]);
  
  return (
    <group position={position} rotation={rotationRad as [number, number, number]} scale={scale}>
      {/* 主体网格 */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        castShadow
        receiveShadow
      />
      
      {/* 选中时的边框 */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color="#1890ff" linewidth={2} />
        </lineSegments>
      )}
      
      {/* 连接点 */}
      {connectionPoints}
    </group>
  );
});

ClimberComponent.displayName = 'ClimberComponent';

// 连接线渲染
const ConnectionLines: React.FC = () => {
  const { connections, components } = useDesignStore();
  
  const lines = useMemo(() => {
    return connections.map((connection) => {
      const sourceComponent = components.find(c => c.instanceId === connection.source.componentId);
      const targetComponent = components.find(c => c.instanceId === connection.target.componentId);
      
      if (!sourceComponent || !targetComponent) return null;
      
      const sourceDef = getComponentById(sourceComponent.componentId);
      const targetDef = getComponentById(targetComponent.componentId);
      
      if (!sourceDef || !targetDef) return null;
      
      const sourcePoint = sourceDef.connectionPoints.find(p => p.id === connection.source.pointId);
      const targetPoint = targetDef.connectionPoints.find(p => p.id === connection.target.pointId);
      
      if (!sourcePoint || !targetPoint) return null;
      
      // 计算世界坐标
      const sourcePos = new THREE.Vector3(
        sourceComponent.position[0] + sourcePoint.position[0],
        sourceComponent.position[1] + sourcePoint.position[1],
        sourceComponent.position[2] + sourcePoint.position[2]
      );
      
      const targetPos = new THREE.Vector3(
        targetComponent.position[0] + targetPoint.position[0],
        targetComponent.position[1] + targetPoint.position[1],
        targetComponent.position[2] + targetPoint.position[2]
      );
      
      return {
        id: connection.id,
        start: sourcePos,
        end: targetPos,
      };
    }).filter(Boolean);
  }, [connections, components]);
  
  return (
    <group>
      {lines.map((line) => {
        if (!line) return null;
        
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        return (
          <primitive key={line.id} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#1890ff' }))} />
        );
      })}
    </group>
  );
};

// 组件渲染器
const ComponentRenderer: React.FC = () => {
  const { components, editor, selectComponent, toggleSelectComponent, setEditorState } = useDesignStore();
  
  // 处理点击
  const handleClick = useCallback((instanceId: string, e: any) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // 多选
      toggleSelectComponent(instanceId);
    } else {
      // 单选
      useDesignStore.getState().clearSelection();
      selectComponent(instanceId);
    }
  }, [selectComponent, toggleSelectComponent]);
  
  // 处理悬停
  const handlePointerOver = useCallback((instanceId: string, e: any) => {
    e.stopPropagation();
    setEditorState({ hoveredComponent: instanceId });
  }, [setEditorState]);
  
  const handlePointerOut = useCallback(() => {
    setEditorState({ hoveredComponent: null });
  }, [setEditorState]);
  
  return (
    <group>
      {/* 渲染所有组件 */}
      {components.map((component) => (
        <ClimberComponent
          key={component.instanceId}
          instanceId={component.instanceId}
          componentId={component.componentId}
          position={component.position}
          rotation={component.rotation}
          scale={component.scale}
          isSelected={editor.selectedComponents.includes(component.instanceId)}
          isHovered={editor.hoveredComponent === component.instanceId}
          showConnections={editor.showConnections}
          onClick={(e) => handleClick(component.instanceId, e)}
          onPointerOver={(e) => handlePointerOver(component.instanceId, e)}
          onPointerOut={handlePointerOut}
        />
      ))}
      
      {/* 渲染连接线 */}
      <ConnectionLines />
    </group>
  );
};

export default ComponentRenderer;
