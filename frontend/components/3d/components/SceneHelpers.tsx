import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';
import { getComponentById } from '../../../stores/componentLibrary';

// 吸附指示器
const SnapIndicator: React.FC = () => {
  const snapTarget = useInteractionStore(state =>
    state.interaction.dragState.snapTarget ?? state.interaction.placeState.snapTarget
  );
  
  if (!snapTarget) return null;
  
  return (
    <group position={snapTarget.position}>
      {/* 吸附圆环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 3, 32]} />
        <meshBasicMaterial color="#52c41a" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      
      {/* 吸附脉冲 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 4, 32]} />
        <meshBasicMaterial color="#52c41a" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      
      {/* 中心点 */}
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#52c41a" />
      </mesh>
    </group>
  );
};

// 拖拽预览
const DragPreview: React.FC = () => {
  const components = useDesignStore(state => state.components);
  const { isDragging, dragTarget, dragState } = useInteractionStore(state => state.interaction);
  const draggedComponent = useMemo(
    () => components.find(component => component.instanceId === dragTarget) ?? null,
    [components, dragTarget]
  );
  
  // 获取组件定义
  const definition = useMemo(() => {
    if (!draggedComponent) return null;
    return getComponentById(draggedComponent.componentId);
  }, [draggedComponent]);
  
  const previewPosition = dragState.snappedPosition
    ?? dragState.previewPosition
    ?? draggedComponent?.position;

  if (!isDragging || !definition || !draggedComponent || !previewPosition) return null;
  
  return (
    <group position={previewPosition} rotation={draggedComponent.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]}>
      <mesh>
        <boxGeometry args={[
          definition.width || 10,
          definition.height || 10,
          definition.length || 10,
        ]} />
        <meshStandardMaterial
          color="#1890ff"
          transparent
          opacity={0.35}
          wireframe
        />
      </mesh>
    </group>
  );
};

// 场景辅助系统
const SceneHelpers: React.FC = () => {
  return (
    <>
      {/* 地面 */}
      <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#f0f0f0" roughness={1} />
      </mesh>
      
      {/* 吸附指示器 */}
      <SnapIndicator />
      
      {/* 拖拽预览 */}
      <DragPreview />
    </>
  );
};

export default SceneHelpers;
