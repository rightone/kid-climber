import React, { useRef, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 高级光照系统
export const AdvancedLighting: React.FC = () => {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  
  useEffect(() => {
    // 设置场景背景色
    scene.background = new THREE.Color('#f0f2f5');
    
    // 添加雾效
    scene.fog = new THREE.Fog('#f0f2f5', 200, 1000);
  }, [scene]);
  
  return (
    <>
      {/* 环境光 - 提供基础照明 */}
      <ambientLight intensity={0.4} color="#ffffff" />
      
      {/* 主方向光 - 产生阴影 */}
      <directionalLight
        ref={directionalLightRef}
        position={[100, 200, 100]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-bias={-0.0001}
      />
      
      {/* 填充光 - 减少阴影对比度 */}
      <directionalLight
        position={[-100, 100, -100]}
        intensity={0.3}
        color="#b1e1ff"
      />
      
      {/* 背景光 - 模拟天空 */}
      <hemisphereLight
        args={['#b1e1ff', '#b7e4c7', 0.3]}
      />
      
      {/* 点光源 - 增加细节 */}
      <pointLight
        position={[0, 100, 0]}
        intensity={0.5}
        color="#ffffff"
        distance={300}
        decay={2}
      />
    </>
  );
};

// 地面系统
export const GroundSystem: React.FC = () => {
  return (
    <>
      {/* 主地面 */}
      <mesh
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color="#e8e8e8"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      {/* 网格辅助线 */}
      <gridHelper
        args={[1000, 100, '#cccccc', '#e0e0e0']}
        position={[0, -0.9, 0]}
      />
    </>
  );
};

// 坐标轴指示器
export const AxisIndicator: React.FC = () => {
  return (
    <group position={[0, 0.01, 0]}>
      {/* X轴 - 红色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          50,
          0xff0000,
          5,
          3,
        ]}
      />
      
      {/* Y轴 - 绿色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          50,
          0x00ff00,
          5,
          3,
        ]}
      />
      
      {/* Z轴 - 蓝色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          50,
          0x0000ff,
          5,
          3,
        ]}
      />
    </group>
  );
};

// 吸附指示器
export const SnapIndicator: React.FC<{ position?: [number, number, number]; visible?: boolean }> = ({ 
  position = [0, 0, 0], 
  visible = false 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && visible) {
      meshRef.current.rotation.z += 0.02;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });
  
  if (!visible) return null;
  
  return (
    <group position={position}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 3, 32]} />
        <meshBasicMaterial color="#52c41a" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 4, 32]} />
        <meshBasicMaterial color="#52c41a" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#52c41a" />
      </mesh>
    </group>
  );
};

// 连接线指示器
export const ConnectionLine: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}> = ({ start, end, color = '#1890ff' }) => {
  const points = useMemo(() => {
    return [
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ];
  }, [start, end]);
  
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);
  
  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
};

// 组件高亮效果
export const ComponentHighlight: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  visible?: boolean;
}> = ({ position, size, color = '#1890ff', visible = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && visible) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });
  
  if (!visible) return null;
  
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

// 选择框效果
export const SelectionBox: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  visible?: boolean;
}> = ({ position, size, visible = false }) => {
  if (!visible) return null;
  
  return (
    <group position={position}>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color="#1890ff" linewidth={2} />
      </lineSegments>
    </group>
  );
};

// 拖拽预览
export const DragPreview: React.FC<{
  position: [number, number, number];
  componentId: string;
  visible?: boolean;
}> = ({ position, componentId, visible = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && visible) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 2;
    }
  });
  
  if (!visible) return null;
  
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[10, 10, 10]} />
      <meshStandardMaterial
        color="#1890ff"
        transparent
        opacity={0.5}
        wireframe
      />
    </mesh>
  );
};

// 粒子效果（用于连接成功时）
export const ConnectionParticles: React.FC<{
  position: [number, number, number];
  active?: boolean;
}> = ({ position, active = false }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesCount = 50;
  
  const particles = useMemo(() => {
    const positions = new Float32Array(particlesCount * 3);
    const velocities = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = Math.random() * 0.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    return { positions, velocities };
  }, []);
  
  useFrame(() => {
    if (pointsRef.current && active) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < particlesCount; i++) {
        positions[i * 3] += particles.velocities[i * 3];
        positions[i * 3 + 1] += particles.velocities[i * 3 + 1];
        positions[i * 3 + 2] += particles.velocities[i * 3 + 2];
        
        // 重置粒子
        if (positions[i * 3 + 1] > 20) {
          positions[i * 3] = (Math.random() - 0.5) * 10;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  if (!active) return null;
  
  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color="#52c41a"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};

// 环境效果
export const EnvironmentEffects: React.FC = () => {
  return (
    <>
      {/* 环境贴图 */}
      <Environment preset="city" />
      
      {/* 后处理效果（如果需要） */}
      {/* <EffectComposer>
        <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.025} />
        <ChromaticAberration offset={[0.0005, 0.0005]} />
      </EffectComposer> */}
    </>
  );
};

// 导出所有场景组件
export const SceneEnvironment: React.FC = () => {
  return (
    <>
      <AdvancedLighting />
      <GroundSystem />
      <AxisIndicator />
      <EnvironmentEffects />
    </>
  );
};
