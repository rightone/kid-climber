import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import {
  Button,
  Modal,
  Progress,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import * as THREE from 'three';
import type { ComponentInstance, Connection } from '../../types';
import { getComponentById } from '../../stores/componentLibrary';
import { createComponentGeometry } from '../3d/utils/geometryUtils';
import type { AssemblyGuide, AssemblyGuideStep } from '../../systems/AssemblyStepSystem';
import { validateAssemblyGuide } from '../../systems/AssemblyStepSystem';
import {
  resolveAssemblyComponentVisual,
  type AssemblyRenderMode,
} from '../../systems/AssemblyGuideRenderer';
import {
  calculateGuideCameraFit,
  type GuideCameraFit,
} from '../../utils/previewCameraUtils';

const { Text, Title } = Typography;

interface AssemblyGuideViewerProps {
  open: boolean;
  guide: AssemblyGuide;
  components: ComponentInstance[];
  connections: Connection[];
  exporting: boolean;
  exportProgress: { percent: number; message: string } | null;
  onExport: () => void;
  onClose: () => void;
}

interface GuideSceneProps {
  components: ComponentInstance[];
  step: AssemblyGuideStep;
  mode: AssemblyRenderMode;
  fitKey: string;
  resetNonce: number;
}

const GuideComponent: React.FC<{
  component: ComponentInstance;
  step: AssemblyGuideStep;
  mode: AssemblyRenderMode;
}> = ({ component, step, mode }) => {
  const definition = useMemo(() => getComponentById(component.componentId), [component.componentId]);
  const geometry = useMemo(
    () => definition
      ? createComponentGeometry(component.componentId, definition, component)
      : new THREE.BoxGeometry(6, 6, 6),
    [component, definition]
  );
  const visual = resolveAssemblyComponentVisual(component, step, mode);
  if (!visual.visible) return null;
  return (
    <group
      position={component.position}
      rotation={component.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]}
      scale={component.scale}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={visual.color}
          roughness={definition?.type === 'pipe' ? 0.55 : 0.42}
          metalness={definition?.type === 'pipe' ? 0 : 0.12}
          transparent={visual.opacity < 1}
          opacity={visual.opacity}
          depthWrite={visual.opacity >= 1}
          emissive={definition?.type === 'pipe' && !visual.previous ? visual.color : '#000000'}
          emissiveIntensity={definition?.type === 'pipe' && !visual.previous ? 0.06 : 0}
        />
      </mesh>
      {visual.outlineColor ? (
        <lineSegments renderOrder={10}>
          <edgesGeometry args={[geometry, 18]} />
          <lineBasicMaterial
            color={visual.outlineColor}
            transparent
            opacity={0.95}
            depthTest={false}
          />
        </lineSegments>
      ) : null}
    </group>
  );
};

const GuideCameraController: React.FC<{
  groupRef: React.RefObject<THREE.Group | null>;
  fitKey: string;
  resetNonce: number;
  onFit: (fit: GuideCameraFit, bounds: THREE.Box3) => void;
}> = ({ groupRef, fitKey, resetNonce, onFit }) => {
  const getThreeState = useThree(state => state.get);
  const canvasElement = useThree(state => state.gl.domElement);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const scheduledFramesRef = useRef<number[]>([]);

  const cancelScheduledFit = useCallback(() => {
    scheduledFramesRef.current.forEach(frameId => window.cancelAnimationFrame(frameId));
    scheduledFramesRef.current = [];
  }, []);

  const applyFit = useCallback(() => {
    const { camera, invalidate, size } = getThreeState();
    const group = groupRef.current;
    if (!group || size.width <= 0 || size.height <= 0 || !(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (bounds.isEmpty()) return;
    const fit = calculateGuideCameraFit(bounds, size.width / size.height, 'isometric');
    const center = new THREE.Vector3().fromArray(fit.center);
    camera.fov = fit.fov;
    camera.up.fromArray(fit.up);
    camera.position.fromArray(fit.position);
    camera.near = fit.near;
    camera.far = fit.far;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.copy(center);
    controlsRef.current?.update();
    onFit(fit, bounds);
    invalidate();
  }, [getThreeState, groupRef, onFit]);

  const scheduleFit = useCallback(() => {
    cancelScheduledFit();
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        scheduledFramesRef.current = [];
        applyFit();
      });
      scheduledFramesRef.current = [secondFrame];
    });
    scheduledFramesRef.current = [firstFrame];
  }, [applyFit, cancelScheduledFit]);

  useLayoutEffect(() => {
    scheduleFit();
    return cancelScheduledFit;
  }, [cancelScheduledFit, fitKey, resetNonce, scheduleFit]);

  useEffect(() => {
    const container = canvasElement.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    let previousWidth = container.clientWidth;
    let previousHeight = container.clientHeight;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (
        Math.abs(width - previousWidth) < 1 &&
        Math.abs(height - previousHeight) < 1
      ) {
        return;
      }
      previousWidth = width;
      previousHeight = height;
      scheduleFit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [canvasElement, scheduleFit]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      minDistance={8}
      maxDistance={1600}
      onStart={cancelScheduledFit}
    />
  );
};

const GuideScene: React.FC<GuideSceneProps> = ({
  components,
  step,
  mode,
  fitKey,
  resetNonce,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [grid, setGrid] = useState({ size: 80, x: 0, y: -4, z: 0 });
  const visibleComponents = useMemo(
    () => components.filter(component =>
      resolveAssemblyComponentVisual(component, step, mode).visible
    ),
    [components, mode, step]
  );
  const handleFit = useCallback((fit: GuideCameraFit, bounds: THREE.Box3) => {
    const center = bounds.getCenter(new THREE.Vector3());
    const nextGrid = {
      size: fit.gridSize,
      x: center.x,
      y: bounds.min.y - Math.max(1.2, fit.gridSize * 0.01),
      z: center.z,
    };
    setGrid(current =>
      current.size === nextGrid.size &&
      Math.abs(current.x - nextGrid.x) < 0.001 &&
      Math.abs(current.y - nextGrid.y) < 0.001 &&
      Math.abs(current.z - nextGrid.z) < 0.001
        ? current
        : nextGrid
    );
  }, []);
  return (
    <Canvas
      camera={{ position: [90, 72, 90], fov: 40, near: 0.1, far: 1800 }}
      frameloop="demand"
      dpr={[1, 2]}
    >
      <color attach="background" args={['#F4F7FB']} />
      <hemisphereLight args={['#FFFFFF', '#CBD5E1', 1.4]} />
      <directionalLight position={[90, 130, 85]} intensity={1.55} />
      <directionalLight position={[-70, 55, -50]} intensity={0.5} />
      <gridHelper
        args={[
          grid.size,
          Math.max(4, Math.round(grid.size / 20)),
          '#94A3B8',
          '#D8E0EA',
        ]}
        position={[grid.x, grid.y, grid.z]}
      />
      <group ref={groupRef}>
        {visibleComponents.map(component => (
          <GuideComponent
            key={component.instanceId}
            component={component}
            step={step}
            mode={mode}
          />
        ))}
      </group>
      {mode !== 'final' ? step.callouts.map(callout => (
        <group key={callout.id} position={callout.position}>
          <Html center zIndexRange={[100, 0]}>
            <div className="assembly-callout-badge" title={callout.description}>
              {callout.order}
            </div>
          </Html>
        </group>
      )) : null}
      <GuideCameraController
        groupRef={groupRef}
        fitKey={fitKey}
        resetNonce={resetNonce}
        onFit={handleFit}
      />
    </Canvas>
  );
};

const AssemblyGuideViewer: React.FC<AssemblyGuideViewerProps> = ({
  open,
  guide,
  components,
  connections,
  exporting,
  exportProgress,
  onExport,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<AssemblyRenderMode>('cumulative');
  const [resetNonce, setResetNonce] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const validation = validateAssemblyGuide(guide, components, connections);
  const step = guide.steps[Math.min(stepIndex, guide.steps.length - 1)];
  const fitKey = `${guide.designSignature}:${step?.id}:${mode}`;
  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, guide.steps.length - 1)));
  }, [guide.steps.length]);

  const handleClose = useCallback(() => {
    setSceneReady(false);
    setStepIndex(0);
    setMode('cumulative');
    setResetNonce(value => value + 1);
    onClose();
  }, [onClose]);

  if (!step) return null;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      afterOpenChange={setSceneReady}
      footer={null}
      width="calc(100vw - 24px)"
      className="assembly-guide-modal"
      destroyOnHidden
    >
      <div className="assembly-guide-workspace">
        <header className="assembly-guide-header">
          <div>
            <Text type="secondary">搭建教程</Text>
            <Title level={4} style={{ margin: '2px 0 0' }}>{guide.designName}</Title>
          </div>
          <Space wrap>
            <Segmented
              value={mode}
              onChange={value => setMode(value as AssemblyRenderMode)}
              options={[
                { value: 'cumulative', label: '累计结构' },
                { value: 'current-only', label: '仅看本步' },
                { value: 'final', label: '最终成品', icon: <EyeOutlined /> },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => setResetNonce(value => value + 1)}>
              重置视角
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              disabled={!validation.valid}
              onClick={onExport}
            >
              导出 PDF
            </Button>
          </Space>
        </header>

        {exporting && exportProgress ? (
          <div className="assembly-guide-export-progress">
            <Progress percent={exportProgress.percent} size="small" />
            <Text type="secondary">{exportProgress.message}</Text>
          </div>
        ) : null}

        {!validation.valid ? (
          <div className="assembly-guide-stale-banner">
            当前设计已经变化，本教程已过期。请关闭后重新生成。
          </div>
        ) : null}

        <main className="assembly-guide-main">
          <section className="assembly-guide-canvas-shell">
            {sceneReady ? (
              <GuideScene
                components={components}
                step={step}
                mode={mode}
                fitKey={fitKey}
                resetNonce={resetNonce}
              />
            ) : (
              <div className="assembly-guide-canvas-loading">正在准备搭建视图…</div>
            )}
            <div className="assembly-guide-step-chip">
              第 {step.order}/{guide.steps.length} 步 · {step.title}
            </div>
          </section>

          <aside className="assembly-guide-rail">
            <div className="assembly-guide-step-list">
              {guide.steps.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={index === stepIndex ? 'assembly-step-item is-active' : 'assembly-step-item'}
                  onClick={() => goToStep(index)}
                >
                  <span className="assembly-step-number">{item.order}</span>
                  <span className="assembly-step-copy">
                    <strong>{item.title}</strong>
                    <small>{item.newComponentIds.length} 个部件 · {item.newConnectionIds.length} 处连接</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="assembly-guide-instructions">
              <Tag color="blue">{step.title}</Tag>
              <p>{step.instruction}</p>
              <Text strong>本步部件</Text>
              <div className="assembly-guide-parts">
                {step.parts.length > 0
                  ? step.parts.map(part => (
                    <span key={part.componentId}>{part.name} × {part.quantity}</span>
                  ))
                  : <Text type="secondary">无需新增部件</Text>}
              </div>
              {step.callouts.length > 0 ? (
                <>
                  <Text strong>连接说明</Text>
                  <ol className="assembly-guide-callouts">
                    {step.callouts.map(callout => (
                      <li key={callout.id}>{callout.description}</li>
                    ))}
                  </ol>
                </>
              ) : null}
              <Text strong>完成检查</Text>
              <ul className="assembly-guide-checks">
                {step.checks.map(check => (
                  <li key={check}><CheckCircleOutlined /> {check}</li>
                ))}
              </ul>
            </div>
          </aside>
        </main>

        <footer className="assembly-guide-footer">
          <Button
            icon={<ArrowLeftOutlined />}
            disabled={stepIndex === 0}
            onClick={() => goToStep(stepIndex - 1)}
          >
            上一步
          </Button>
          <Text type="secondary">第 {step.order} 步，共 {guide.steps.length} 步</Text>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            disabled={stepIndex === guide.steps.length - 1}
            onClick={() => goToStep(stepIndex + 1)}
          >
            下一步
          </Button>
        </footer>
      </div>
    </Modal>
  );
};

export default AssemblyGuideViewer;
