import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useInteractionStore } from '../../../stores/interactionStore';

// 地面网格
const GroundGrid: React.FC<{ gridSize: number; size: number }> = ({ gridSize, size }) => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const halfSize = size / 2;
    
    // X轴方向线
    for (let z = -halfSize; z <= halfSize; z += gridSize) {
      points.push(new THREE.Vector3(-halfSize, 0, z));
      points.push(new THREE.Vector3(halfSize, 0, z));
    }
    
    // Z轴方向线
    for (let x = -halfSize; x <= halfSize; x += gridSize) {
      points.push(new THREE.Vector3(x, 0, -halfSize));
      points.push(new THREE.Vector3(x, 0, halfSize));
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(points);
    return geo;
  }, [gridSize, size]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#94a3b8" transparent opacity={0.4} />
    </lineSegments>
  );
};

// 垂直网格（XY平面）
const VerticalGridXY: React.FC<{ gridSize: number; size: number; height: number }> = ({ gridSize, size, height }) => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const halfSize = size / 2;
    
    // X轴方向线
    for (let y = 0; y <= height; y += gridSize) {
      points.push(new THREE.Vector3(-halfSize, y, 0));
      points.push(new THREE.Vector3(halfSize, y, 0));
    }
    
    // Y轴方向线
    for (let x = -halfSize; x <= halfSize; x += gridSize) {
      points.push(new THREE.Vector3(x, 0, 0));
      points.push(new THREE.Vector3(x, height, 0));
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(points);
    return geo;
  }, [gridSize, size, height]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#60a5fa" transparent opacity={0.2} />
    </lineSegments>
  );
};

// 垂直网格（YZ平面）
const VerticalGridYZ: React.FC<{ gridSize: number; size: number; height: number }> = ({ gridSize, size, height }) => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const halfSize = size / 2;
    
    // Z轴方向线
    for (let y = 0; y <= height; y += gridSize) {
      points.push(new THREE.Vector3(0, y, -halfSize));
      points.push(new THREE.Vector3(0, y, halfSize));
    }
    
    // Y轴方向线
    for (let z = -halfSize; z <= halfSize; z += gridSize) {
      points.push(new THREE.Vector3(0, 0, z));
      points.push(new THREE.Vector3(0, height, z));
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(points);
    return geo;
  }, [gridSize, size, height]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f472b6" transparent opacity={0.2} />
    </lineSegments>
  );
};

// 高度参考面
const HeightReferencePlane: React.FC<{ y: number; size: number }> = ({ y, size }) => {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.05}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// 高度参考线
const HeightReferenceLine: React.FC<{ y: number; size: number }> = ({ y, size }) => {
  const lineRef = useRef<THREE.Line>(null);
  
  const geometry = useMemo(() => {
    const halfSize = size / 2;
    const points = [
      new THREE.Vector3(-halfSize, y, -halfSize),
      new THREE.Vector3(halfSize, y, -halfSize),
      new THREE.Vector3(halfSize, y, halfSize),
      new THREE.Vector3(-halfSize, y, halfSize),
      new THREE.Vector3(-halfSize, y, -halfSize),
    ];
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(points);
    return geo;
  }, [y, size]);
  
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({ color: '#3b82f6', transparent: true, opacity: 0.3 });
  }, []);
  
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.geometry = geometry;
      lineRef.current.material = material;
    }
  }, [geometry, material]);
  
  return <primitive ref={lineRef} object={new THREE.Line(geometry, material)} />;
};

// 坐标轴指示器
const AxisIndicator: React.FC<{ size: number }> = ({ size }) => {
  return (
    <group>
      {/* X轴 - 红色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          size,
          0xff0000,
          size * 0.05,
          size * 0.03,
        ]}
      />
      
      {/* Y轴 - 绿色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          size,
          0x00ff00,
          size * 0.05,
          size * 0.03,
        ]}
      />
      
      {/* Z轴 - 蓝色 */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          size,
          0x0000ff,
          size * 0.05,
          size * 0.03,
        ]}
      />
    </group>
  );
};

// 主立体参考线系统
export const SpaceGuideSystem: React.FC = () => {
  const { interaction } = useInteractionStore();
  const { gridSize, showGrid, showVerticalGrid, showHeightRef } = interaction;
  
  const gridRange = 200; // 网格范围
  const maxHeight = 300; // 最大高度
  const heightInterval = gridSize * 2; // 高度参考面间隔
  
  // 计算高度参考面位置
  const heightPlanes = useMemo(() => {
    const planes: number[] = [];
    for (let y = heightInterval; y <= maxHeight; y += heightInterval) {
      planes.push(y);
    }
    return planes;
  }, [heightInterval, maxHeight]);
  
  return (
    <group>
      {/* 坐标轴 */}
      <AxisIndicator size={30} />
      
      {/* 地面网格 */}
      {showGrid && (
        <GroundGrid gridSize={gridSize} size={gridRange} />
      )}
      
      {/* 垂直网格 */}
      {showVerticalGrid && (
        <>
          <VerticalGridXY gridSize={gridSize} size={gridRange} height={maxHeight} />
          <VerticalGridYZ gridSize={gridSize} size={gridRange} height={maxHeight} />
        </>
      )}
      
      {/* 高度参考面 */}
      {showHeightRef && heightPlanes.map((y) => (
        <React.Fragment key={y}>
          <HeightReferencePlane y={y} size={gridRange} />
          <HeightReferenceLine y={y} size={gridRange} />
        </React.Fragment>
      ))}
    </group>
  );
};

export default SpaceGuideSystem;
