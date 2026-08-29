import React, { useCallback, useMemo } from 'react';
import { beginnerDemoSystem } from '../../../systems/BeginnerDemoSystem';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 72,
  left: 16,
  width: 318,
  background: 'rgba(255, 255, 255, 0.95)',
  color: '#0f172a',
  padding: '14px 16px',
  borderRadius: 12,
  boxShadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  fontSize: 12,
  lineHeight: 1.45,
  zIndex: 2,
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid #93c5fd',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '7px 8px',
  cursor: 'pointer',
  fontWeight: 700,
};

const pipeButtonStyle = (active: boolean, color: string): React.CSSProperties => ({
  border: `1px solid ${active ? color : '#cbd5e1'}`,
  background: active ? color : '#fff',
  color: active ? '#fff' : '#334155',
  borderRadius: 999,
  padding: '4px 9px',
  cursor: 'pointer',
  fontWeight: 700,
});

const BeginnerDemoGuide: React.FC = () => {
  const {
    components,
    connections,
    beginnerDemo,
    loadBeginnerDemoStarter,
    loadBeginnerDemoTarget,
  } = useDesignStore();
  const {
    interaction,
    setGridSize,
    setMode,
    selectGrowthEndpoint,
    clearGrowthEndpoint,
    setGrowthPipeComponent,
  } = useInteractionStore();
  const dimensionSpec = useMemo(() => beginnerDemoSystem.getDimensionSpec(), []);
  const demoSteps = useMemo(() => beginnerDemoSystem.getSteps(), []);
  const scopedDemoDesign = useMemo(
    () =>
      beginnerDemo.active
        ? beginnerDemoSystem.scopeDesign(
            { components, connections },
            {
              componentIds: beginnerDemo.scopeComponentIds,
              connectionIds: beginnerDemo.scopeConnectionIds,
            }
          )
        : { components: [], connections: [] },
    [beginnerDemo.active, beginnerDemo.scopeComponentIds, beginnerDemo.scopeConnectionIds, components, connections]
  );
  const progress = useMemo(
    () =>
      beginnerDemoSystem.evaluateDemoProgress(scopedDemoDesign, {
        endpointGrowthPracticed: beginnerDemo.endpointGrowthPracticed,
        practiceComponentIds: beginnerDemo.practiceComponentIds,
        practiceConnectionIds: beginnerDemo.practiceConnectionIds,
      }),
    [
      beginnerDemo.endpointGrowthPracticed,
      beginnerDemo.practiceComponentIds,
      beginnerDemo.practiceConnectionIds,
      scopedDemoDesign,
    ]
  );

  const activateDemoDefaults = useCallback(() => {
    setGridSize(dimensionSpec.gridCm);
    setMode('select');
  }, [dimensionSpec.gridCm, setGridSize, setMode]);

  const handleStartPractice = useCallback(() => {
    const demo = loadBeginnerDemoStarter();
    activateDemoDefaults();
    setGrowthPipeComponent('pipe_35cm');
    if (demo.starterEndpoint) {
      selectGrowthEndpoint(demo.starterEndpoint);
    }
  }, [activateDemoDefaults, loadBeginnerDemoStarter, selectGrowthEndpoint, setGrowthPipeComponent]);

  const handleLoadTarget = useCallback(() => {
    loadBeginnerDemoTarget();
    activateDemoDefaults();
    clearGrowthEndpoint();
  }, [activateDemoDefaults, clearGrowthEndpoint, loadBeginnerDemoTarget]);

  const practiceCheck = progress.checks.find((check) => check.id === 'endpoint-growth-practice');

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>🧗 新手基础平台架 Demo</div>
          <div style={{ color: '#64748b', marginTop: 2 }}>真实练习端点生长，再导出 BOM / 组装步骤</div>
        </div>
        <div
          style={{
            minWidth: 46,
            textAlign: 'center',
            borderRadius: 999,
            background: progress.isComplete ? '#dcfce7' : progress.structuralComplete ? '#fef9c3' : '#e0f2fe',
            color: progress.isComplete ? '#166534' : progress.structuralComplete ? '#854d0e' : '#075985',
            padding: '4px 8px',
            fontWeight: 700,
          }}
        >
          {progress.percent}%
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 8,
          background: '#f8fafc',
          color: '#334155',
        }}
      >
        尺寸锁定：{dimensionSpec.shortPipeCm}cm / {dimensionSpec.longPipeCm}cm 管，
        {dimensionSpec.gridCm}cm 参考线；35cm={dimensionSpec.longPipeReferenceSpan}格，
        15cm={dimensionSpec.shortPipeReferenceSpan}格。
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={handleStartPractice} style={actionButtonStyle}>
          从第一根管开始
        </button>
        <button
          type="button"
          onClick={handleLoadTarget}
          style={{
            ...actionButtonStyle,
            border: '1px solid #86efac',
            background: '#f0fdf4',
            color: '#15803d',
          }}
        >
          查看完成样例
        </button>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#475569' }}>下一根管：</span>
        <button
          type="button"
          onClick={() => setGrowthPipeComponent('pipe_15cm')}
          style={pipeButtonStyle(interaction.growthState.pipeComponentId === 'pipe_15cm', '#f59e0b')}
        >
          15cm
        </button>
        <button
          type="button"
          onClick={() => setGrowthPipeComponent('pipe_35cm')}
          style={pipeButtonStyle(interaction.growthState.pipeComponentId === 'pipe_35cm', '#10b981')}
        >
          35cm
        </button>
      </div>

      <div style={{ marginTop: 10, color: practiceCheck?.complete ? '#166534' : '#b45309' }}>
        {practiceCheck?.complete
          ? '已完成真实端点生长练习。'
          : '练习要求：选中端点 → 点方向手柄 → 自动添加接头 + 管子。'}
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
        {progress.checks.map((check) => (
          <div
            key={check.id}
            title={check.detail}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: check.complete ? '#166534' : '#475569',
            }}
          >
            <span aria-hidden>{check.complete ? '✅' : '○'}</span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, color: '#475569' }}>{progress.nextAction}</div>
      <ol style={{ margin: '8px 0 0 18px', padding: 0, color: '#64748b' }}>
        {demoSteps.map((step) => (
          <li key={step.id} title={step.description}>{step.title}</li>
        ))}
      </ol>
    </div>
  );
};

export default BeginnerDemoGuide;
