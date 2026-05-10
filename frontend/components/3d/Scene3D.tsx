import React, { Suspense, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import ComponentRenderer from './components/ComponentRenderer';
import SceneHelpers from './components/SceneHelpers';
import InteractionSystem from './systems/InteractionSystem';

// 场景控制器
const SceneController: React.FC = () => {
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);
  const { editor, setEditorState, clearSelection } = useDesignStore();
  const { interaction, setMode } = useInteractionStore();
  
  // 处理点击空白区域取消选择
  const handlePointerMissed = useCallback(() => {
    clearSelection();
  }, [clearSelection]);
  
  useEffect(() => {
    gl.domElement.addEventListener('pointermissed', handlePointerMissed);
    return () => {
      gl.domElement.removeEventListener('pointermissed', handlePointerMissed);
    };
  }, [gl, handlePointerMissed]);
  
  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      const store = useDesignStore.getState();
      
      switch (e.key.toLowerCase()) {
        case 'v':
          if (!e.ctrlKey && !e.metaKey) {
            setMode('select');
            setEditorState({ activeTool: 'select' });
          }
          break;
        case 'm':
          if (!e.ctrlKey && !e.metaKey) {
            setMode('move');
            setEditorState({ activeTool: 'move' });
          }
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            setMode('rotate');
            setEditorState({ activeTool: 'rotate' });
          }
          break;
        case 'g':
          if (!e.ctrlKey && !e.metaKey) {
            setEditorState({ showGrid: !editor.showGrid });
          }
          break;
        case 'l':
          if (!e.ctrlKey && !e.metaKey) {
            setEditorState({ showConnections: !editor.showConnections });
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              store.redo();
            } else {
              store.undo();
            }
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.redo();
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.copySelected();
          }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.paste();
          }
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.duplicateSelected();
          }
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.selectAll();
          }
          break;
        case 'delete':
        case 'backspace':
          if (editor.selectedComponents.length > 0) {
            editor.selectedComponents.forEach(id => store.removeComponent(id));
            store.clearSelection();
          }
          break;
        case 'escape':
          store.clearSelection();
          const { cancelPlace, setMode: setInteractionMode } = useInteractionStore.getState();
          cancelPlace();
          setInteractionMode('select');
          break;
        case '1':
          setEditorState({ viewMode: 'realistic' });
          break;
        case '2':
          setEditorState({ viewMode: 'wireframe' });
          break;
        case '3':
          setEditorState({ viewMode: 'xray' });
          break;
        case '4':
          setEditorState({ viewMode: 'blackwhite' });
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, setEditorState, setMode]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      screenSpacePanning
      maxPolarAngle={Math.PI / 2}
      minDistance={10}
      maxDistance={1000}
      enabled={interaction.mode !== 'place' && !interaction.isDragging}
    />
  );
};

// 场景灯光
const SceneLighting: React.FC = () => {
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.4} />
      
      {/* 主方向光（带阴影） */}
      <directionalLight
        position={[100, 200, 100]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
      />
      
      {/* 填充光 */}
      <directionalLight
        position={[-100, 100, -100]}
        intensity={0.3}
      />
      
      {/* 背景光 */}
      <hemisphereLight
        args={['#b1e1ff', '#b7e4c7', 0.3]}
      />
    </>
  );
};

// 加载中显示
const LoadingFallback: React.FC = () => {
  return (
    <mesh>
      <boxGeometry args={[10, 10, 10]} />
      <meshStandardMaterial color="#1890ff" wireframe />
    </mesh>
  );
};

// 主场景组件
const Scene3D: React.FC = () => {
  const { interaction } = useInteractionStore();
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{
          position: [150, 150, 150],
          fov: 50,
          near: 0.1,
          far: 2000,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
        style={{ background: '#f0f2f5' }}
      >
        {/* 场景控制器 */}
        <SceneController />
        
        {/* 场景灯光 */}
        <SceneLighting />
        
        {/* 场景辅助 */}
        <Suspense fallback={<LoadingFallback />}>
          <SceneHelpers />
        </Suspense>
        
        {/* 交互系统 */}
        <InteractionSystem />
        
        {/* 组件渲染 */}
        <Suspense fallback={<LoadingFallback />}>
          <ComponentRenderer />
        </Suspense>
        
        {/* 环境贴图 */}
        <Environment preset="city" />
      </Canvas>
      
      {/* 模式提示 */}
      {interaction.mode === 'place' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(82, 196, 26, 0.9)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 'bold',
          }}
        >
          🎯 点击放置组件 | ESC 取消
        </div>
      )}
      
      {interaction.mode === 'move' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 144, 255, 0.9)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 'bold',
          }}
        >
          ✋ 移动模式 | 拖拽移动组件
        </div>
      )}
      
      {/* 视图控制提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
        }}
      >
        <div>🖱️ 左键: 选择/放置</div>
        <div>🖱️ 右键拖拽: 旋转视角</div>
        <div>🖱️ 滚轮: 缩放</div>
        <div>⌨️ V: 选择模式</div>
        <div>⌨️ M: 移动模式</div>
        <div>⌨️ ESC: 取消</div>
      </div>
      
      {/* 坐标显示 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <div>模式: {interaction.mode === 'select' ? '选择' : interaction.mode === 'place' ? '放置' : '移动'}</div>
        <div>网格: {interaction.gridSize}cm</div>
      </div>
    </div>
  );
};

export default Scene3D;
