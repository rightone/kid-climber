import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Button, Modal, Tag, Typography } from 'antd';
import {
  CheckCircleFilled,
  DownOutlined,
  ExclamationCircleFilled,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons';
import * as THREE from 'three';
import type { ComponentInstance } from '../../types';
import { getComponentById } from '../../stores/componentLibrary';
import { createComponentGeometry } from '../3d/utils/geometryUtils';
import {
  instantiateTemplate,
  validateTemplate,
  type DesignTemplateV2,
} from '../../utils/templateUtils';
import { useDesignStore } from '../../stores/designStore';
import { useBuildPreferencesStore } from '../../stores/buildPreferencesStore';
import {
  calculatePreviewCameraFit,
  type PreviewCameraFit,
} from '../../utils/previewCameraUtils';
import { getComponentPreviewColor } from '../../utils/thumbnailUtils';

const { Text } = Typography;

interface TemplatePreviewProps {
  template: DesignTemplateV2 | null;
  open: boolean;
  onClose: () => void;
  onCreateNew: (template: DesignTemplateV2) => void;
  onAddToCurrent: (template: DesignTemplateV2) => void;
}

const PreviewComponent = React.memo<{ component: ComponentInstance }>(({ component }) => {
  const definition = useMemo(() => getComponentById(component.componentId), [component.componentId]);
  const geometry = useMemo(
    () => definition
      ? createComponentGeometry(component.componentId, definition, component)
      : new THREE.BoxGeometry(6, 6, 6),
    [component, definition]
  );
  const color = getComponentPreviewColor(component);
  const isPipe = component.componentId.startsWith('pipe_');

  return (
    <mesh
      geometry={geometry}
      position={component.position}
      rotation={[
        THREE.MathUtils.degToRad(component.rotation[0]),
        THREE.MathUtils.degToRad(component.rotation[1]),
        THREE.MathUtils.degToRad(component.rotation[2]),
      ]}
    >
      <meshStandardMaterial
        color={color}
        metalness={0}
        roughness={0.55}
        emissive={isPipe ? color : '#000000'}
        emissiveIntensity={isPipe ? 0.06 : 0}
      />
    </mesh>
  );
});

PreviewComponent.displayName = 'PreviewComponent';

interface PreviewCameraControllerProps {
  groupRef: React.RefObject<THREE.Group | null>;
  fitKey: string;
  resetNonce: number;
  onFit: (fit: PreviewCameraFit, bounds: THREE.Box3) => void;
}

const PreviewCameraController: React.FC<PreviewCameraControllerProps> = ({
  groupRef,
  fitKey,
  resetNonce,
  onFit,
}) => {
  const { camera, size, invalidate } = useThree();
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!groupRef.current || size.width <= 0 || size.height <= 0) return;
      groupRef.current.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(groupRef.current);
      if (bounds.isEmpty()) return;
      const fit = calculatePreviewCameraFit(
        bounds,
        size.width / size.height,
        camera instanceof THREE.PerspectiveCamera ? camera.fov : 42
      );
      camera.position.fromArray(fit.position);
      camera.near = fit.near;
      camera.far = fit.far;
      camera.lookAt(new THREE.Vector3().fromArray(fit.center));
      camera.updateProjectionMatrix();
      controlsRef.current?.target.fromArray(fit.center);
      controlsRef.current?.update();
      onFit(fit, bounds);
      invalidate();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [camera, fitKey, groupRef, invalidate, onFit, resetNonce, size.height, size.width]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={12}
      maxDistance={1200}
    />
  );
};

interface TemplateSceneProps {
  components: ComponentInstance[];
  fitKey: string;
  resetNonce: number;
}

const TemplateScene: React.FC<TemplateSceneProps> = ({
  components,
  fitKey,
  resetNonce,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [grid, setGrid] = useState({ size: 80, y: -2 });
  const handleFit = useCallback((fit: PreviewCameraFit, bounds: THREE.Box3) => {
    const nextGrid = {
      size: fit.gridSize,
      y: bounds.min.y - Math.max(1.2, fit.gridSize * 0.0125),
    };
    setGrid(current =>
      current.size === nextGrid.size && Math.abs(current.y - nextGrid.y) < 0.001
        ? current
        : nextGrid
    );
  }, []);

  return (
    <Canvas
      camera={{ position: [72, 54, 72], fov: 42, near: 0.1, far: 1000 }}
      frameloop="demand"
      dpr={[1, 2]}
      className="template-preview-canvas"
    >
      <color attach="background" args={['#f4f7fb']} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.25]} />
      <directionalLight position={[80, 120, 80]} intensity={1.45} />
      <gridHelper
        args={[
          grid.size,
          Math.max(4, Math.round(grid.size / 20)),
          '#94a3b8',
          '#d8e0ea',
        ]}
        position={[0, grid.y, 0]}
      />
      <group ref={groupRef}>
        {components.map(component => (
          <PreviewComponent key={component.instanceId} component={component} />
        ))}
      </group>
      <PreviewCameraController
        groupRef={groupRef}
        fitKey={fitKey}
        resetNonce={resetNonce}
        onFit={handleFit}
      />
    </Canvas>
  );
};

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  open,
  onClose,
  onCreateNew,
  onAddToCurrent,
}) => {
  const { components, connections } = useDesignStore();
  const pipeColorMode = useBuildPreferencesStore(state => state.pipeColorMode);
  const [sceneReady, setSceneReady] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [expandedMaterialsTemplateId, setExpandedMaterialsTemplateId] = useState<string | null>(null);
  const validation = useMemo(
    () => template ? validateTemplate(template) : null,
    [template]
  );
  const previewInstance = useMemo(
    () => template
      ? instantiateTemplate({
          template,
          existingComponents: components,
          existingConnections: connections,
          mode: pipeColorMode,
        })
      : null,
    [components, connections, pipeColorMode, template]
  );
  const currentIsEmpty = components.length === 0 && connections.length === 0;
  const applyDisabled = !validation?.valid || !template;
  const materialEntries = validation ? Object.entries(validation.bom) : [];
  const showAllMaterials = expandedMaterialsTemplateId === template?.id;
  const visibleMaterialEntries = showAllMaterials
    ? materialEntries
    : materialEntries.slice(0, 4);
  const fitKey = template && previewInstance
    ? `${template.id}:${previewInstance.components.length}:${previewInstance.connections.length}`
    : 'empty-template';

  return (
    <Modal
      title={template ? `模板预览：${template.name}` : '模板预览'}
      open={open}
      onCancel={onClose}
      afterOpenChange={setSceneReady}
      width={860}
      className="template-preview-modal"
      footer={
        <div className="template-preview-footer">
          <Button onClick={onClose}>关闭</Button>
          <div className="template-preview-footer-actions">
            {!currentIsEmpty ? (
              <Button
                danger
                disabled={applyDisabled}
                onClick={() => {
                  if (template) onCreateNew(template);
                }}
              >
                新建设计
              </Button>
            ) : null}
            <Button
              type="primary"
              disabled={applyDisabled}
              onClick={() => {
                if (!template) return;
                if (currentIsEmpty) onCreateNew(template);
                else onAddToCurrent(template);
              }}
            >
              {currentIsEmpty ? '使用此模板' : '添加到当前设计'}
            </Button>
          </div>
        </div>
      }
    >
      {template && validation && previewInstance ? (
        <div className="template-preview-content">
          <div className="template-preview-canvas-shell">
            {sceneReady && previewInstance.components.length > 0 ? (
              <TemplateScene
                components={previewInstance.components}
                fitKey={fitKey}
                resetNonce={resetNonce}
              />
            ) : (
              <div className="template-preview-empty">
                {previewInstance.components.length === 0 ? '该模板没有可预览的组件' : '正在准备 3D 预览…'}
              </div>
            )}
            {previewInstance.components.length > 0 ? (
              <Button
                className="template-preview-reset"
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => setResetNonce(value => value + 1)}
              >
                重置视角
              </Button>
            ) : null}
          </div>

          <div
            className={validation.valid
              ? 'template-preview-summary is-valid'
              : 'template-preview-summary is-invalid'}
          >
            <span className="template-preview-validation">
              {validation.valid
                ? <CheckCircleFilled aria-hidden="true" />
                : <ExclamationCircleFilled aria-hidden="true" />}
              <span>
                {validation.valid
                  ? '结构校验通过，可安全应用'
                  : '模板连接不完整，不能应用'}
              </span>
            </span>
            <span className="template-preview-stat"><strong>{validation.componentCount}</strong> 组件</span>
            <span className="template-preview-stat"><strong>{validation.connectionCount}</strong> 连接</span>
            <span className="template-preview-stat">
              <strong>{validation.bounds.size.map(value => Math.round(value)).join('×')}cm</strong> 尺寸
            </span>
          </div>

          {!validation.valid ? (
            <Text type="danger" className="template-preview-error-detail">
              {validation.errors.join('；')}
            </Text>
          ) : null}

          <div className="template-preview-materials">
            <Text strong className="template-preview-materials-label">材料</Text>
            <div className={showAllMaterials
              ? 'template-preview-material-tags is-expanded'
              : 'template-preview-material-tags'}
            >
              {visibleMaterialEntries.map(([componentId, count]) => (
                <Tag key={componentId} variant="filled">
                  {getComponentById(componentId)?.name ?? componentId} × {count}
                </Tag>
              ))}
            </div>
            {materialEntries.length > 4 ? (
              <Button
                type="link"
                size="small"
                className="template-preview-material-toggle"
                icon={showAllMaterials ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setExpandedMaterialsTemplateId(current =>
                  current === template.id ? null : template.id
                )}
              >
                {showAllMaterials ? '收起' : '查看全部材料'}
              </Button>
            ) : null}
          </div>

          {validation.warnings.length > 0 ? (
            <Text type="warning" className="template-preview-warning">
              {validation.warnings.join('；')}
            </Text>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
};

export default TemplatePreview;
