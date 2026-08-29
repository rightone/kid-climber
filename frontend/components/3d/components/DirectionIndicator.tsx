import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getComponentById } from '../../../stores/componentLibrary';

// 方向箭头组件
const DirectionArrow: React.FC<{
  position: [number, number, number];
  direction: [number, number, number];
  color: string;
  length?: number;
}> = ({ position, direction, color, length = 10 }) => {
  const arrowHelper = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const origin = new THREE.Vector3(...position);
    return new THREE.ArrowHelper(dir, origin, length, color, length * 0.2, length * 0.1);
  }, [position, direction, color, length]);
  
  return <primitive object={arrowHelper} />;
};

// 连接点指示器
const ConnectionPointIndicator: React.FC<{
  position: [number, number, number];
  type: 'socket' | 'plug';
  isActive?: boolean;
  isHovered?: boolean;
}> = ({ position, type, isActive = false, isHovered = false }) => {
  const color = type === 'socket' ? '#3b82f6' : '#10b981';
  const activeColor = isActive ? '#f59e0b' : color;
  const finalColor = isHovered ? '#fbbf24' : activeColor;
  
  return (
    <group position={position}>
      {/* 连接点球体 */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={finalColor}
          transparent
          opacity={0.8}
          emissive={finalColor}
          emissiveIntensity={isActive ? 0.5 : 0.2}
        />
      </mesh>
      
      {/* 方向箭头 */}
      <DirectionArrow
        position={[0, 0, 0]}
        direction={type === 'socket' ? [0, 0, -1] : [0, 0, 1]}
        color={finalColor}
        length={3}
      />
    </group>
  );
};

// 组件方向指示器
export const ComponentDirectionIndicator: React.FC<{
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  showConnectionPoints?: boolean;
  isActive?: boolean;
}> = ({ 
  componentId, 
  position, 
  rotation, 
  showConnectionPoints = true,
  isActive = false 
}) => {
  const definition = useMemo(() => getComponentById(componentId), [componentId]);
  
  if (!definition) return null;
  
  const rotationRad: [number, number, number] = [
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
  ];
  
  return (
    <group position={position} rotation={rotationRad}>
      {/* 主轴方向 */}
      <DirectionArrow
        position={[0, 0, 0]}
        direction={[1, 0, 0]}
        color="#ff0000"
        length={definition.length ? definition.length / 2 + 5 : 15}
      />
      <DirectionArrow
        position={[0, 0, 0]}
        direction={[0, 1, 0]}
        color="#00ff00"
        length={5}
      />
      <DirectionArrow
        position={[0, 0, 0]}
        direction={[0, 0, 1]}
        color="#0000ff"
        length={definition.length ? definition.length / 2 + 5 : 15}
      />
      
      {/* 连接点 */}
      {showConnectionPoints && definition.connectionPoints.map((point, index) => (
        <ConnectionPointIndicator
          key={index}
          position={point.position}
          type={point.type as 'socket' | 'plug'}
          isActive={isActive}
        />
      ))}
    </group>
  );
};

// 放置预览指示器
export const PlacementPreviewIndicator: React.FC<{
  position: [number, number, number];
  isValid: boolean;
  snapType?: string;
}> = ({ position, isValid, snapType }) => {
  const color = isValid ? '#10b981' : '#ef4444';
  
  return (
    <group position={position}>
      {/* 放置点 */}
      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.8}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* 吸附指示 */}
      {snapType && (
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[8, 2, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}
      
      {/* 地面投影 */}
      <mesh position={[0, -position[1] + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// 吸附线指示器
export const SnapLineIndicator: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}> = ({ start, end, color = '#3b82f6' }) => {
  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);
  
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.6} />
    </line>
  );
};

export default ComponentDirectionIndicator;
