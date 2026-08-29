import React, { useCallback, useMemo, useState } from 'react';
import { Button, Collapse, Empty, Input, Segmented, Tag } from 'antd';
import {
  ApartmentOutlined,
  BorderOutlined,
  BuildOutlined,
  NodeIndexOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { getAllComponents, searchComponents } from '../../stores/componentLibrary';
import { useInteractionStore } from '../../stores/interactionStore';
import { useDesignStore } from '../../stores/designStore';
import { ComponentThumbnail } from './ComponentThumbnail';
import type { ComponentDefinition } from '../../types';
import {
  advancedStructureSystem,
  type AFrameModuleSize,
  type AFramePlane,
} from '../../systems/AdvancedStructureSystem';
import { assignAutomaticPipeColors } from '../../systems/PipeColorSystem';
import { useBuildPreferencesStore } from '../../stores/buildPreferencesStore';
import { boardMountSystem, type BoardComponentId } from '../../systems/BoardMountSystem';
import {
  curvedTubeMountSystem,
  U_CURVED_TUBE_COMPONENT_ID,
} from '../../systems/CurvedTubeMountSystem';
import { rampMountSystem, type RampComponentId } from '../../systems/RampMountSystem';
import { structureMountSystem } from '../../systems/StructureMountSystem';
import {
  endpointGrowthSystem,
  growthSelectionFromSite,
  predictionSiteKey,
  type GrowthPipeComponentId,
} from '../../systems/EndpointGrowthSystem';
import {
  buildTaskSystem,
  type BuildTaskAvailability,
  type BuildTaskId,
} from '../../systems/BuildTaskSystem';

interface ComponentCardProps {
  component: ComponentDefinition;
  onPlacementStart?: () => void;
}

const ComponentCard = React.memo<ComponentCardProps>(({ component, onPlacementStart }) => {
  const startPlace = useInteractionStore(state => state.startPlace);
  const cancelPlace = useInteractionStore(state => state.cancelPlace);
  const activeComponentId = useInteractionStore(state => state.interaction.placeState.componentId);
  const isBoard = component.category === 'platform';
  const isPlacing = activeComponentId === component.id;

  const startManualPlacement = () => {
    startPlace(component.id);
    onPlacementStart?.();
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    if (!isBoard) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-kid-climber-component', component.id);
    startManualPlacement();
  };

  const handleDragEnd = () => {
    const current = useInteractionStore.getState().interaction;
    if (current.mode === 'place' && current.placeState.componentId === component.id) {
      cancelPlace();
    }
  };

  return (
    <button
      type="button"
      onClick={startManualPlacement}
      draggable={isBoard}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-pressed={isPlacing}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: 8,
        border: isPlacing ? '2px solid #52c41a' : '1px solid #e2e8f0',
        borderRadius: 8,
        marginBottom: 6,
        cursor: 'pointer',
        background: isPlacing ? '#f6ffed' : '#fff',
        color: '#0f172a',
        textAlign: 'left',
      }}
    >
      <ComponentThumbnail
        componentId={component.id}
        size={36}
        style={{ borderRadius: 5, marginRight: 8, flexShrink: 0, border: '1px solid #e2e8f0' }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 12 }}>{component.name}</span>
        <span style={{ display: 'block', color: '#64748b', fontSize: 10.5, marginTop: 2 }}>
          {component.category === 'connector' ? '专家手动安装' : '自由放置零件'}
        </span>
      </span>
      {isPlacing ? <Tag color="success" style={{ marginInlineEnd: 0 }}>放置中</Tag> : null}
    </button>
  );
});

ComponentCard.displayName = 'ComponentCard';

const DirectionPreview: React.FC<{ direction: 'left-right' | 'front-back' }> = ({ direction }) => (
  <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true">
    <path d="M5 20 L17 4 L29 20" fill="none" stroke="#1677ff" strokeWidth="2.2" strokeLinecap="round" />
    <path
      d={direction === 'left-right' ? 'M3 22 H31' : 'M10 22 L24 17'}
      fill="none"
      stroke="#94a3b8"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

interface TaskCardProps {
  task: BuildTaskAvailability;
  onStart: () => void;
  children?: React.ReactNode;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStart, children }) => {
  const available = task.status === 'available';
  return (
    <section
      data-build-task={task.id}
      style={{
        padding: 10,
        border: `1px solid ${available ? '#bfdbfe' : '#e2e8f0'}`,
        borderRadius: 10,
        background: available ? '#f8fbff' : '#f8fafc',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: available ? '#e6f4ff' : '#f1f5f9',
            color: available ? '#1677ff' : '#94a3b8',
            flexShrink: 0,
          }}
        >
          {task.id === 'platform'
            ? <BorderOutlined />
            : task.id === 'diagonal-brace'
              ? <NodeIndexOutlined />
              : <BuildOutlined />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#0f172a', fontSize: 12.5, fontWeight: 800 }}>{task.name}</div>
          <div style={{ color: '#64748b', fontSize: 10.5, lineHeight: 1.45, marginTop: 2 }}>
            {task.description}
          </div>
        </div>
        <Tag color={available ? 'blue' : 'default'} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
          {available ? `可安装 ${task.installCount} 处` : '还需条件'}
        </Tag>
      </div>
      {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
      {!available ? (
        <div style={{ marginTop: 7, color: '#b45309', fontSize: 10.5, lineHeight: 1.45 }}>
          {task.blockingReason}
        </div>
      ) : null}
      <Button
        type={available ? 'primary' : 'default'}
        block
        size="small"
        disabled={!available}
        onClick={onStart}
        style={{ marginTop: 8 }}
      >
        {available ? `开始${task.name}` : '暂不可用'}
      </Button>
    </section>
  );
};

interface ComponentLibraryProps {
  onPlacementStart?: () => void;
}

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onPlacementStart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pipeComponentId, setPipeComponentId] = useState<GrowthPipeComponentId>('pipe_35cm');
  const [aFrameSize, setAFrameSize] = useState<AFrameModuleSize>('small');
  const [aFramePlane, setAFramePlane] = useState<AFramePlane>('vertical-x');
  const [boardComponentId, setBoardComponentId] = useState<BoardComponentId>('board_40x40');
  const [curvedTubeFlip, setCurvedTubeFlip] = useState(false);
  const [rampComponentId, setRampComponentId] = useState<RampComponentId>('ramp_45cm');
  const components = useDesignStore(state => state.components);
  const connections = useDesignStore(state => state.connections);
  const startConstructionWizard = useDesignStore(state => state.startConstructionWizard);
  const setEditorState = useDesignStore(state => state.setEditorState);
  const pipeColorMode = useBuildPreferencesStore(state => state.pipeColorMode);
  const {
    startPlace,
    updatePlacePreview,
    startTemplatePlacement,
    startBuildTask,
    setMode,
    clearGrowthEndpoint,
    selectGrowthEndpoint,
    setGrowthPipeComponent,
    setGrowthCandidateFamily,
    setShowAvailablePositions,
  } = useInteractionStore();

  const availabilityById = useMemo(() => {
    const entries: Array<[BuildTaskId, BuildTaskAvailability]> = [
      ['base-frame', buildTaskSystem.getAvailability('base-frame', { components, connections })],
      ['extend', buildTaskSystem.getAvailability('extend', {
        components,
        connections,
        specification: { pipeComponentId },
      })],
      ['diagonal-brace', buildTaskSystem.getAvailability('diagonal-brace', {
        components,
        connections,
        specification: { pipeComponentId },
      })],
      ['a-frame', buildTaskSystem.getAvailability('a-frame', {
        components,
        connections,
        specification: { aFrameSize, aFramePlane },
      })],
      ['platform', buildTaskSystem.getAvailability('platform', {
        components,
        connections,
        specification: { boardComponentId },
      })],
      ['u-arch', buildTaskSystem.getAvailability('u-arch', {
        components,
        connections,
        specification: { curvedTubeFlip },
      })],
      ['ramp', buildTaskSystem.getAvailability('ramp', {
        components,
        connections,
        specification: { rampComponentId },
      })],
    ];
    return new Map(entries);
  }, [
    aFramePlane,
    aFrameSize,
    boardComponentId,
    components,
    connections,
    curvedTubeFlip,
    pipeComponentId,
    rampComponentId,
  ]);

  const orderedTasks = useMemo(() => (
    ['base-frame', 'extend', 'diagonal-brace', 'a-frame', 'platform', 'u-arch', 'ramp'] as BuildTaskId[]
  ).map(id => availabilityById.get(id)!), [availabilityById]);
  const availableTasks = orderedTasks.filter(task => task.status === 'available');
  const blockedTasks = orderedTasks.filter(task => task.status === 'blocked');

  const beginTaskSession = useCallback((task: BuildTaskAvailability) => {
    const activeTask = buildTaskSystem.createActiveTask(task);
    if (!activeTask) return false;
    startBuildTask(activeTask);
    onPlacementStart?.();
    return true;
  }, [onPlacementStart, startBuildTask]);

  const startTask = useCallback((task: BuildTaskAvailability) => {
    if (task.status === 'blocked') return;
    const spec = task.specification;

    if (task.id === 'base-frame') {
      startConstructionWizard('basic-platform-frame');
      setEditorState({ gridSize: 5 });
      setMode('select');
      clearGrowthEndpoint();
      beginTaskSession(task);
      return;
    }

    if (task.id === 'extend' || task.id === 'diagonal-brace') {
      const family = task.id === 'extend' ? 'straight' : 'diagonal';
      const sites = endpointGrowthSystem.listPredictionSites({
        components,
        connections,
        pipeComponentId: spec.pipeComponentId ?? 'pipe_35cm',
        family,
      });
      const firstSite = sites.find(site => predictionSiteKey(site) === task.installationSiteIds[0]);
      if (!firstSite) return;
      setMode('select');
      setGrowthPipeComponent(spec.pipeComponentId ?? 'pipe_35cm');
      setGrowthCandidateFamily(family);
      setShowAvailablePositions(true);
      selectGrowthEndpoint(growthSelectionFromSite(firstSite));
      beginTaskSession(task);
      return;
    }

    if (task.id === 'a-frame') {
      let sequence = 0;
      const seed = `advanced_a_frame_${Date.now()}`;
      const assembly = advancedStructureSystem.createAFrame({
        size: spec.aFrameSize ?? 'small',
        plane: spec.aFramePlane ?? 'vertical-x',
        idFactory: prefix => `${seed}_${prefix}_${sequence++}`,
      });
      const coloredComponents = assignAutomaticPipeColors({
        existingComponents: components,
        existingConnections: connections,
        newComponents: assembly.components,
        newConnections: assembly.connections,
        mode: pipeColorMode,
      });
      const recipe = { ...assembly, components: coloredComponents };
      const sites = components.length === 0
        ? [structureMountSystem.createGroundRecipeMountSite({ recipe })]
        : structureMountSystem.listRecipeMountSites({ recipe, components, connections });
      const firstSite = sites.find(site => site.id === task.installationSiteIds[0]);
      if (!firstSite) return;
      startTemplatePlacement({
        templateId: assembly.id,
        templateName: assembly.name,
        components: coloredComponents,
        connections: assembly.connections,
        structureRecipe: recipe,
        structureMountSite: firstSite,
      });
      setGrowthCandidateFamily('structure');
      beginTaskSession(task);
      return;
    }

    if (task.id === 'platform') {
      const componentId = spec.boardComponentId ?? 'board_40x40';
      const scan = boardMountSystem.scanBoardMountSites({
        boardComponentId: componentId,
        components,
        connections,
      });
      const sites = [...scan.validSites, ...scan.repairableSites];
      const site = sites.find(item => item.id === task.installationSiteIds[0]);
      if (!site) return;
      startPlace(componentId);
      updatePlacePreview({
        position: site.position,
        rotation: site.rotation,
        isValid: true,
        snapType: 'connection',
        boardMountSite: site,
        message: `平台安装位 1/${sites.length} 已选中`,
      });
      beginTaskSession(task);
      return;
    }

    if (task.id === 'u-arch') {
      const sites = curvedTubeMountSystem
        .listCurvedTubeMountSites({ components, connections })
        .filter(site => site.flip === Boolean(spec.curvedTubeFlip));
      const site = sites.find(item => item.id === task.installationSiteIds[0]);
      if (!site) return;
      startPlace(U_CURVED_TUBE_COMPONENT_ID, [0, spec.curvedTubeFlip ? 180 : 0, 0]);
      updatePlacePreview({
        position: site.position,
        rotation: site.rotation,
        isValid: true,
        snapType: 'connection',
        curvedTubeMountSite: site,
        message: `攀爬拱安装位 1/${sites.length} 已选中`,
      });
      beginTaskSession(task);
      return;
    }

    const componentId = spec.rampComponentId ?? 'ramp_45cm';
    const sites = rampMountSystem.listRampMountSites({ componentId, components, connections });
    const site = sites.find(item => item.id === task.installationSiteIds[0]);
    if (!site) return;
    startPlace(componentId);
    updatePlacePreview({
      position: site.position,
      rotation: site.rotation,
      isValid: true,
      snapType: 'connection',
      rampMountSite: site,
      message: `坡道安装位 1/${sites.length} 已选中`,
    });
    beginTaskSession(task);
  }, [
    beginTaskSession,
    clearGrowthEndpoint,
    components,
    connections,
    pipeColorMode,
    selectGrowthEndpoint,
    setEditorState,
    setGrowthCandidateFamily,
    setGrowthPipeComponent,
    setMode,
    setShowAvailablePositions,
    startConstructionWizard,
    startPlace,
    startTemplatePlacement,
    updatePlacePreview,
  ]);

  const manualComponents = useMemo(
    () => searchQuery ? searchComponents(searchQuery) : getAllComponents(),
    [searchQuery]
  );

  const renderTaskOptions = (task: BuildTaskAvailability) => {
    if (task.id === 'extend' || task.id === 'diagonal-brace') {
      return (
        <Segmented
          block
          size="small"
          value={pipeComponentId}
          options={[
            { label: '15cm', value: 'pipe_15cm' },
            { label: '25cm', value: 'pipe_25cm' },
            { label: '35cm', value: 'pipe_35cm' },
          ]}
          onChange={value => setPipeComponentId(value as GrowthPipeComponentId)}
        />
      );
    }
    if (task.id === 'a-frame') {
      return (
        <>
          <Segmented
            block
            size="small"
            value={aFrameSize}
            options={[{ label: '小型', value: 'small' }, { label: '大型', value: 'large' }]}
            onChange={value => setAFrameSize(value as AFrameModuleSize)}
          />
          <Segmented
            block
            size="small"
            style={{ marginTop: 7 }}
            value={aFramePlane}
            options={[
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><DirectionPreview direction="left-right" />左右方向</span>, value: 'vertical-x' },
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><DirectionPreview direction="front-back" />前后方向</span>, value: 'vertical-z' },
            ]}
            onChange={value => setAFramePlane(value as AFramePlane)}
          />
        </>
      );
    }
    if (task.id === 'platform') {
      return (
        <Segmented
          block
          size="small"
          value={boardComponentId}
          options={[{ label: '40×40cm', value: 'board_40x40' }, { label: '40×20cm', value: 'board_40x20' }]}
          onChange={value => setBoardComponentId(value as BoardComponentId)}
        />
      );
    }
    if (task.id === 'u-arch') {
      return (
        <Segmented
          block
          size="small"
          value={curvedTubeFlip ? 'outward' : 'inward'}
          options={[{ label: '向内', value: 'inward' }, { label: '向外', value: 'outward' }]}
          onChange={value => setCurvedTubeFlip(value === 'outward')}
        />
      );
    }
    if (task.id === 'ramp') {
      return (
        <Segmented
          block
          size="small"
          value={rampComponentId}
          options={[{ label: '45cm', value: 'ramp_45cm' }, { label: '85cm', value: 'ramp_85cm' }]}
          onChange={value => setRampComponentId(value as RampComponentId)}
        />
      );
    }
    return null;
  };

  return (
    <div
      className="component-library"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="component-library-header"
        style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}
      >
        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: 14 }}>选择搭建任务</div>
        <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>
          选择要完成的结构，系统会检查条件并显示全部安装位。
        </div>
      </div>
      <div className="component-library-list" style={{ flex: 1, padding: '10px 12px' }}>
        <div style={{ color: '#15803d', fontWeight: 800, fontSize: 11, marginBottom: 7 }}>
          现在可以做
        </div>
        {availableTasks.map(task => (
          <TaskCard key={task.id} task={task} onStart={() => startTask(task)}>
            {renderTaskOptions(task)}
          </TaskCard>
        ))}

        {blockedTasks.length > 0 ? (
          <>
            <div style={{ color: '#64748b', fontWeight: 800, fontSize: 11, margin: '14px 0 7px' }}>
              还需条件
            </div>
            {blockedTasks.map(task => (
              <TaskCard key={task.id} task={task} onStart={() => startTask(task)}>
                {renderTaskOptions(task)}
              </TaskCard>
            ))}
          </>
        ) : null}

        <Collapse
          ghost
          style={{ marginTop: 8 }}
          items={[
            {
              key: 'manual-parts',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800 }}>
                  <ToolOutlined style={{ color: '#64748b' }} />
                  手动零件
                  <Tag style={{ marginInlineEnd: 0 }}>专家</Tag>
                </span>
              ),
              children: (
                <>
                  <Input
                    placeholder="搜索直管、接头或板件…"
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    allowClear
                    size="small"
                    style={{ marginBottom: 8 }}
                  />
                  {manualComponents.length > 0
                    ? manualComponents.map(component => (
                        <ComponentCard
                          key={component.id}
                          component={component}
                          onPlacementStart={onPlacementStart}
                        />
                      ))
                    : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的零件" />}
                </>
              ),
            },
          ]}
        />

        <div
          style={{
            display: 'flex',
            gap: 7,
            alignItems: 'center',
            marginTop: 8,
            padding: '9px 10px',
            borderRadius: 8,
            background: '#f8fafc',
            color: '#64748b',
            fontSize: 10.5,
          }}
        >
          <ApartmentOutlined />
          需要完整方案时，请切换上方“整套方案”。
        </div>
      </div>
    </div>
  );
};

export default ComponentLibrary;
