import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useDesignStore } from '../../../stores/designStore';
import { getComponentById } from '../../../stores/componentLibrary';

// 吸附指示器
const SnapIndicator: React.FC = () => {
  const { snapTarget } = useDesignStore();
  
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
  const { isDragging, dragComponentId } = useDesignStore();
  const { raycaster, camera, pointer } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);
  const previewRef = useRef<THREE.Group>(null);
  
  // 获取组件定义
  const definition = useMemo(() => {
    if (!dragComponentId) return null;
    return getComponentById(dragComponentId);
  }, [dragComponentId]);
  
  useFrame(() => {
    if (!isDragging || !previewRef.current || !planeRef.current) return;
    
    // 射线检测地面
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(planeRef.current);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      
      // 网格吸附
      const gridSize = 10;
      const snappedX = Math.round(point.x / gridSize) * gridSize;
      const snappedZ = Math.round(point.z / gridSize) * gridSize;
      
      previewRef.current.position.set(snappedX, point.y, snappedZ);
    }
  });
  
  if (!isDragging || !definition) return null;
  
  return (
    <>
      {/* 地面检测平面 */}
      <mesh ref={planeRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial />
      </mesh>
      
      {/* 拖拽预览 */}
      <group ref={previewRef}>
        <mesh>
          <boxGeometry args={[
            definition.width || 10,
            definition.height || 10,
            definition.length || 10,
          ]} />
          <meshStandardMaterial
            color="#1890ff"
            transparent
            opacity={0.5}
            wireframe
          />
        </mesh>
      </group>
    </>
  );
};

// 地面网格
const GroundGrid: React.FC = () => {
  const { editor } = useDesignStore();
  
  if (!editor.showGrid) return null;
  
  return (
    <gridHelper
      args={[1000, 100, '#6f6f6f', '#9d4b4b']}
      position={[0, -0.1, 0]}
    />
  );
};

// 坐标轴指示器
const AxisIndicator: React.FC = () => {
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

// 场景辅助系统
const SceneHelpers: React.FC = () => {
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.6} />
      
      {/* 主方向光 */}
      <directionalLight
        position={[100, 100, 50]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      
      {/* 填充光 */}
      <directionalLight
        position={[-50, 50, -50]}
        intensity={0.3}
      />
      
      {/* 地面 */}
      <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#f0f0f0" roughness={1} />
      </mesh>
      
      {/* 地面网格 */}
      <GroundGrid />
      
      {/* 坐标轴 */}
      <AxisIndicator />
      
      {/* 吸附指示器 */}
      <SnapIndicator />
      
      {/* 拖拽预览 */}
      <DragPreview />
    </>
  );
};

export default SceneHelpers;
