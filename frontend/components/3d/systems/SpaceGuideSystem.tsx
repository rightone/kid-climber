import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
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
  const { gridSize, showGrid } = useDesignStore(state => state.editor);
  const { showVerticalGrid } = interaction;
  
  const gridRange = 200; // 网格范围
  const maxHeight = 300; // 最大高度
  
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
    </group>
  );
};

export default SpaceGuideSystem;
