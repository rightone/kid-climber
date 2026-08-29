import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import ComponentRenderer from './components/ComponentRenderer';
import ConstructionWizardGhosts from './components/ConstructionWizardGhosts';
import ConstructionWizardGuide from './components/ConstructionWizardGuide';
import BuildCommandBar from './components/BuildCommandBar';
import SceneHelpers from './components/SceneHelpers';
import InteractionSystem from './systems/InteractionSystem';
import PipeColorMenu from '../ui/PipeColorMenu';
import {
  cancelActiveInteraction,
  commitActiveBuildTask,
  cycleActiveBuildTaskSite,
} from '../../systems/EditorInteractionCommands';
import { constructionWizardSystem } from '../../systems/ConstructionWizardSystem';
import {
  endpointGrowthSystem,
  predictionSiteMatchesSelection,
} from '../../systems/EndpointGrowthSystem';

// 场景控制器
const SceneController: React.FC = () => {
  const controlsRef = useRef(null);
  const mode = useInteractionStore(state => state.interaction.mode);
  const isDragging = useInteractionStore(state => state.interaction.isDragging);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      screenSpacePanning
      maxPolarAngle={Math.PI / 2}
      minDistance={10}
      maxDistance={1000}
      enabled={(mode === 'select' || mode === 'connect') && !isDragging}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
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
        intensity={1.0}
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
  const {
    interaction,
    setGrowthPipeComponent,
    setGrowthCandidateFamily,
    setShowAvailablePositions,
    closeContextMenu,
    rotateTemplatePlacement,
  } = useInteractionStore();
  const {
    components,
    connections,
    constructionWizard,
    topologyAudit,
    repairTopology,
  } = useDesignStore();
  const [wizardGuideOpen, setWizardGuideOpen] = useState(false);
  const clearSelection = useInteractionStore(state => state.clearSelection);
  const clearGrowthEndpoint = useInteractionStore(state => state.clearGrowthEndpoint);
  const selectedEndpoint = interaction.growthState.selectedEndpoint;
  const activeBuildTask = interaction.activeBuildTask;
  const predictionVisible =
    interaction.showAvailablePositions &&
    interaction.growthState.candidateFamily !== 'structure' &&
    !interaction.isDragging &&
    !constructionWizard.active &&
    (interaction.mode === 'select' || interaction.mode === 'connect');
  const availableGrowthEndpoints = useMemo(
    () =>
      predictionVisible
        ? endpointGrowthSystem.listPredictionSites({
            components,
            connections,
            pipeComponentId: interaction.growthState.pipeComponentId,
            family: interaction.growthState.candidateFamily === 'structure'
              ? 'straight'
              : interaction.growthState.candidateFamily,
          })
        : [],
    [
      components,
      connections,
      interaction.growthState.pipeComponentId,
      interaction.growthState.candidateFamily,
      predictionVisible,
    ]
  );
  const selectedSite = selectedEndpoint
    ? availableGrowthEndpoints.find(site =>
        predictionSiteMatchesSelection(site, selectedEndpoint)
      )
    : undefined;
  const growthCandidates = useMemo(
    () =>
      selectedSite
        ? endpointGrowthSystem.generateCandidates({
            site: selectedSite,
            pipeComponentId: interaction.growthState.pipeComponentId,
            family: interaction.growthState.candidateFamily === 'structure'
              ? 'straight'
              : interaction.growthState.candidateFamily,
            components,
            connections,
          })
        : [],
    [
      components,
      connections,
      interaction.growthState.pipeComponentId,
      interaction.growthState.candidateFamily,
      selectedSite,
    ]
  );
  const growthStatusMessage = (() => {
    if (interaction.growthState.hoveredCandidate?.message) {
      return interaction.growthState.hoveredCandidate.message;
    }
    if (!interaction.showAvailablePositions) {
      return '连接预测已关闭';
    }
    if (interaction.growthState.candidateFamily === 'structure') {
      return '结构模式：从组件库选择小型或大型A字架，系统将显示双脚安装位';
    }
    if (selectedEndpoint && growthCandidates.length > 0) {
      return `该位置有 ${growthCandidates.length} 个方案，点击半透明结构继续搭建`;
    }
    if (selectedEndpoint && predictionVisible) {
      return '当前连接点没有可用方案，请悬停其他蓝色热点';
    }
    if (availableGrowthEndpoints.length > 0) {
      return `发现 ${availableGrowthEndpoints.length} 个可连接位置，悬停蓝色热点查看方案`;
    }
    if (predictionVisible) {
      return '当前场景没有可继续搭建的连接位置';
    }
    return '连接预测将在选择模式下显示';
  })();
  const activeFeedback = interaction.mode === 'place'
    ? interaction.placeState
    : interaction.isDragging
      ? interaction.dragState
      : null;
  const wizardProgress = useMemo(
    () =>
      constructionWizardSystem.evaluateProgress({
        components,
        connections,
        wizard: constructionWizard,
      }),
    [components, connections, constructionWizard]
  );
  const wizardCandidates = useMemo(
    () => constructionWizard.active
      ? constructionWizardSystem.generateCandidates({
          components,
          connections,
          wizard: constructionWizard,
        })
      : [],
    [components, connections, constructionWizard]
  );
  const modeHint = {
    select: '点击组件进行选择，拖拽空白处旋转视角',
    place: '移动鼠标预览位置，点击画布或按 Enter 提交',
    move: '拖拽组件，释放后提交移动',
    rotate: '点击组件，每次旋转 90°',
    connect: '选择蓝色连接热点继续搭建',
  }[interaction.mode];
  const baseCommandStatusMessage = interaction.templatePlacement
    ? interaction.templatePlacement.structureRecipe
      ? interaction.templatePlacement.structureMountSite
        ? `“${interaction.templatePlacement.templateName}”双脚安装位已就绪：点击半透明结构一次安装`
        : `“${interaction.templatePlacement.templateName}”需要两个同高、同向且间距匹配的安装端点`
      : `模板“${interaction.templatePlacement.templateName}”整体预览：移动鼠标定位，可旋转 90° 后提交`
    : activeFeedback?.message
    ? activeFeedback.message
    : topologyAudit.repairableCount > 0
      ? `发现 ${topologyAudit.repairableCount} 处可修复连接；另有 ${topologyAudit.freeEndpointCount} 个合法自由端点`
    : constructionWizard.active
      ? wizardProgress.nextAction
      : interaction.mode === 'select' || interaction.mode === 'connect'
        ? growthStatusMessage
        : modeHint;
  const commandStatusMessage = activeBuildTask
    ? activeBuildTask.id === 'base-frame'
      ? `基础平台架 · ${wizardProgress.nextAction}`
      : `${activeBuildTask.name} · 安装位 ${activeBuildTask.currentSiteIndex + 1}/${activeBuildTask.installationSiteIds.length} 已选中`
    : baseCommandStatusMessage;
  const activeTaskDirection = activeBuildTask?.id === 'a-frame'
    ? activeBuildTask.specification.aFramePlane === 'vertical-z' ? '前后方向' : '左右方向'
    : activeBuildTask?.id === 'u-arch'
      ? activeBuildTask.specification.curvedTubeFlip ? '向外' : '向内'
      : undefined;
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerDown={() => closeContextMenu()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
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
        onPointerMissed={() => {
          if (!activeBuildTask && commitActiveBuildTask()) return;
          closeContextMenu();
          clearSelection();
          clearGrowthEndpoint();
        }}
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
          <ConstructionWizardGhosts />
        </Suspense>
        
        {/* 使用本地灯光环境，避免远程 HDR 加载失败导致 3D 画布崩溃 */}
      </Canvas>

      <BuildCommandBar
        mode={interaction.mode}
        statusMessage={commandStatusMessage}
        pipeComponentId={interaction.growthState.pipeComponentId}
        candidateFamily={interaction.growthState.candidateFamily}
        predictionEnabled={interaction.showAvailablePositions}
        wizardActive={constructionWizard.active}
        wizardProgress={wizardProgress.percent}
        canCommitPlacement={
          activeBuildTask?.id === 'base-frame'
            ? wizardCandidates.length > 0
            : (activeBuildTask?.id === 'extend' || activeBuildTask?.id === 'diagonal-brace')
            ? growthCandidates.length > 0
            : Boolean(
            interaction.templatePlacement &&
            (!interaction.templatePlacement.structureRecipe ||
              interaction.templatePlacement.structureMountSite)
          ) ||
          (
            Boolean(interaction.placeState.previewPosition) &&
            interaction.placeState.isValid
          )
        }
        templatePlacementActive={Boolean(interaction.templatePlacement)}
        onPipeComponentChange={setGrowthPipeComponent}
        onCandidateFamilyChange={setGrowthCandidateFamily}
        onPredictionToggle={() =>
          setShowAvailablePositions(!interaction.showAvailablePositions)
        }
        onCommitPlacement={commitActiveBuildTask}
        onRotateTemplate={rotateTemplatePlacement}
        onCancelTemplate={cancelActiveInteraction}
        onWizardOpen={() => setWizardGuideOpen(true)}
        repairableTopologyCount={topologyAudit.repairableCount}
        freeEndpointCount={topologyAudit.freeEndpointCount}
        onRepairTopology={repairTopology}
        activeTaskName={activeBuildTask?.name}
        activeTaskDirection={activeTaskDirection}
        activeTaskSiteIndex={activeBuildTask?.currentSiteIndex}
        activeTaskSiteCount={activeBuildTask?.installationSiteIds.length}
        onPreviousTaskSite={() => cycleActiveBuildTaskSite(-1)}
        onNextTaskSite={() => cycleActiveBuildTaskSite(1)}
      />

      <ConstructionWizardGuide
        expanded={wizardGuideOpen}
        hideCollapsedTrigger
        onExpandedChange={setWizardGuideOpen}
      />
      <PipeColorMenu />
    </div>
  );
};

export default Scene3D;
