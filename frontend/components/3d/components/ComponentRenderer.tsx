import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { getComponentById } from '../../../stores/componentLibrary';
import { createComponentGeometry } from '../utils/geometryUtils';
import type { ComponentColor } from '../../../types';
import { COMPONENT_COLORS } from '../../../types';

// 获取组件颜色
const getComponentColor = (componentId: string, color?: ComponentColor): string => {
  // 如果指定了颜色，使用指定颜色
  if (color && COMPONENT_COLORS[color]) {
    return COMPONENT_COLORS[color].hex;
  }
  
  // 接头统一使用黑色
  const [type] = componentId.split('_');
  if (type === 'connector' || type === 'elbow' || type === 'tee' || type === 'cross') {
    return COMPONENT_COLORS.black.hex;
  }
  
  // 默认颜色
  return COMPONENT_COLORS.blue.hex;
};

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

// 单个组件渲染
interface ClimberComponentProps {
  instanceId: string;
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: ComponentColor;
  isSelected: boolean;
  isHovered: boolean;
  showConnections: boolean;
  onClick: (e: any) => void;
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
}

const ClimberComponent: React.FC<ClimberComponentProps> = React.memo(({
  instanceId,
  componentId,
  position,
  rotation,
  scale,
  color,
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
    const componentColor = getComponentColor(componentId, color);
    return createMaterial(componentColor, isSelected, isHovered);
  }, [componentId, color, isSelected, isHovered]);
  
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
        </group>
      );
    });
  }, [showConnections, definition]);
  
  return (
    <group 
      position={position} 
      rotation={rotationRad as [number, number, number]} 
      scale={scale}
      userData={{ instanceId }}
    >
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
        userData={{ instanceId }}
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
      toggleSelectComponent(instanceId);
    } else {
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
      {components.map((component) => (
        <ClimberComponent
          key={component.instanceId}
          instanceId={component.instanceId}
          componentId={component.componentId}
          position={component.position}
          rotation={component.rotation}
          scale={component.scale}
          color={component.color}
          isSelected={editor.selectedComponents.includes(component.instanceId)}
          isHovered={editor.hoveredComponent === component.instanceId}
          showConnections={editor.showConnections}
          onClick={(e) => handleClick(component.instanceId, e)}
          onPointerOver={(e) => handlePointerOver(component.instanceId, e)}
          onPointerOut={handlePointerOut}
        />
      ))}
      
      <ConnectionLines />
    </group>
  );
};

export default ComponentRenderer;
