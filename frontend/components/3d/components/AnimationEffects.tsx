import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 连接成功粒子效果
export const ConnectionSuccessEffect: React.FC<{
  position: [number, number, number];
  active: boolean;
  onComplete?: () => void;
}> = ({ position, active, onComplete }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const startTime = useRef(0);
  const duration = 2; // 2秒
  
  const particles = useMemo(() => {
    const count = 100;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // 位置
      positions[i * 3] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      
      // 速度
      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = Math.random() * 3 + 1;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
      
      // 颜色（绿色渐变）
      colors[i * 3] = 0.3 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 2] = 0.1 + Math.random() * 0.2;
      
      // 大小
      sizes[i] = Math.random() * 2 + 1;
    }
    
    return { positions, velocities, colors, sizes, count };
  }, []);
  
  useFrame((state) => {
    if (!pointsRef.current || !active) return;
    
    if (startTime.current === 0) {
      startTime.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particles.count; i++) {
      // 更新位置
      positions[i * 3] += particles.velocities[i * 3] * 0.016;
      positions[i * 3 + 1] += particles.velocities[i * 3 + 1] * 0.016;
      positions[i * 3 + 2] += particles.velocities[i * 3 + 2] * 0.016;
      
      // 重力
      particles.velocities[i * 3 + 1] -= 0.1;
      
      // 重置超出范围的粒子
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3] = (Math.random() - 0.5) * 5;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
        particles.velocities[i * 3 + 1] = Math.random() * 3 + 1;
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // 动画完成
    if (progress >= 1 && onComplete) {
      onComplete();
    }
  });
  
  if (!active) return null;
  
  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particles.count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={2}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// 连接线动画
export const ConnectionLineAnimation: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  active: boolean;
  color?: string;
}> = ({ start, end, active, color = '#52c41a' }) => {
  const lineRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  
  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [start, end]);
  
  useFrame((state) => {
    if (materialRef.current && active) {
      const pulse = Math.sin(state.clock.elapsedTime * 5) * 0.3 + 0.7;
      materialRef.current.opacity = pulse;
    }
  });
  
  if (!active) return null;
  
  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        linewidth={2}
        transparent
        opacity={0.8}
      />
    </line>
  );
};

// 吸附点动画
export const SnapPointAnimation: React.FC<{
  position: [number, number, number];
  active: boolean;
}> = ({ position, active }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current && active) {
      ringRef.current.rotation.z += 0.02;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      ringRef.current.scale.set(scale, scale, scale);
    }
    
    if (pulseRef.current && active) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      pulseRef.current.scale.set(scale, scale, scale);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 
        0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });
  
  if (!active) return null;
  
  return (
    <group position={position}>
      {/* 内圈 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial
          color="#52c41a"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* 外圈脉冲 */}
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 3, 32]} />
        <meshBasicMaterial
          color="#52c41a"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* 中心点 */}
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#52c41a" />
      </mesh>
    </group>
  );
};

// 组件高亮动画
export const ComponentHighlightAnimation: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  active: boolean;
  color?: string;
}> = ({ position, size, active, color = '#1890ff' }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && active) {
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.1 + 0.9;
      meshRef.current.scale.set(pulse, pulse, pulse);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 
        0.2 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
    }
  });
  
  if (!active) return null;
  
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        wireframe
      />
    </mesh>
  );
};

// 选择框动画
export const SelectionBoxAnimation: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  active: boolean;
}> = ({ position, size, active }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current && active) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.02 + 1;
      groupRef.current.scale.set(pulse, pulse, pulse);
    }
  });
  
  if (!active) return null;
  
  return (
    <group ref={groupRef} position={position}>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color="#1890ff" linewidth={2} />
      </lineSegments>
    </group>
  );
};

// 工具提示动画
export const TooltipAnimation: React.FC<{
  position: [number, number, number];
  text: string;
  visible: boolean;
}> = ({ position, text, visible }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current && visible) {
      // 始终面向相机
      groupRef.current.lookAt(state.camera.position);
      
      // 轻微浮动
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.5;
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={groupRef} position={position}>
      {/* 背景板 */}
      <mesh>
        <planeGeometry args={[text.length * 1.5, 3]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* 文字（需要使用精灵或HTML） */}
      {/* 这里简化处理，实际应该使用文字纹理 */}
    </group>
  );
};

// 加载动画
export const LoadingAnimation: React.FC<{
  position: [number, number, number];
  active: boolean;
}> = ({ position, active }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current && active) {
      groupRef.current.rotation.y += 0.05;
    }
  });
  
  if (!active) return null;
  
  return (
    <group ref={groupRef} position={position}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i * Math.PI * 2) / 6) * 3,
            0,
            Math.sin((i * Math.PI * 2) / 6) * 3,
          ]}
        >
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={`hsl(${i * 60}, 70%, 50%)`}
            transparent
            opacity={0.5 + (i / 6) * 0.5}
          />
        </mesh>
      ))}
    </group>
  );
};

// 网格吸附指示器
export const GridSnapIndicator: React.FC<{
  position: [number, number, number];
  gridSize: number;
  active: boolean;
}> = ({ position, gridSize, active }) => {
  const linesRef = useRef<THREE.Group>(null);
  
  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    // 十字线
    points.push(new THREE.Vector3(-gridSize / 2, 0, 0));
    points.push(new THREE.Vector3(gridSize / 2, 0, 0));
    points.push(new THREE.Vector3(0, 0, -gridSize / 2));
    points.push(new THREE.Vector3(0, 0, gridSize / 2));
    
    return points;
  }, [gridSize]);
  
  if (!active) return null;
  
  return (
    <group position={position}>
      {/* 十字线 */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              -gridSize / 2, 0, 0,
              gridSize / 2, 0, 0,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1890ff" transparent opacity={0.5} />
      </line>
      
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              0, 0, -gridSize / 2,
              0, 0, gridSize / 2,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1890ff" transparent opacity={0.5} />
      </line>
      
      {/* 中心点 */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#1890ff" />
      </mesh>
    </group>
  );
};

// 导出所有动画组件
export const AnimationEffects: React.FC = () => {
  return (
    <>
      {/* 这里可以添加全局动画效果 */}
    </>
  );
};
