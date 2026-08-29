import React, { useCallback, useMemo, useState } from 'react';
import { constructionWizardSystem, type WizardModuleCandidate } from '../../../systems/ConstructionWizardSystem';
import { beginnerDemoSystem } from '../../../systems/BeginnerDemoSystem';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 58,
  left: 12,
  width: 300,
  maxHeight: 'calc(100% - 96px)',
  overflowY: 'auto',
  background: 'rgba(255, 255, 255, 0.96)',
  color: '#0f172a',
  padding: '14px 16px',
  borderRadius: 14,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  fontSize: 12,
  lineHeight: 1.45,
  zIndex: 2,
};

const primaryButtonStyle: React.CSSProperties = {
  border: '1px solid #93c5fd',
  background: '#2563eb',
  color: '#fff',
  borderRadius: 10,
  padding: '8px 10px',
  cursor: 'pointer',
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  borderRadius: 10,
  padding: '7px 9px',
  cursor: 'pointer',
  fontWeight: 700,
};

const layerTagStyle = (active: boolean): React.CSSProperties => ({
  borderRadius: 999,
  padding: '3px 8px',
  background: active ? '#dbeafe' : '#f8fafc',
  color: active ? '#1d4ed8' : '#64748b',
  border: `1px solid ${active ? '#93c5fd' : '#e2e8f0'}`,
  fontWeight: 700,
});

const formatMaterialDelta = (delta: Record<string, number>) =>
  Object.entries(delta)
    .map(([componentId, count]) => `${componentId.replace('pipe_', '').replace('connector_', '')} ×${count}`)
    .join('，');

interface ConstructionWizardGuideProps {
  expanded?: boolean;
  hideCollapsedTrigger?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const ConstructionWizardGuide: React.FC<ConstructionWizardGuideProps> = ({
  expanded: controlledExpanded,
  hideCollapsedTrigger = false,
  onExpandedChange,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (controlledExpanded === undefined) {
        setInternalExpanded(nextExpanded);
      }
      onExpandedChange?.(nextExpanded);
    },
    [controlledExpanded, onExpandedChange]
  );
  const {
    components,
    connections,
    constructionWizard,
    startConstructionWizard,
    stopConstructionWizard,
    commitConstructionWizardCandidate,
    selectConstructionWizardCandidate,
    loadBeginnerDemoStarter,
    loadBeginnerDemoTarget,
    setEditorState,
  } = useDesignStore();
  const {
    setMode,
    selectGrowthEndpoint,
    clearGrowthEndpoint,
    setGrowthPipeComponent,
  } = useInteractionStore();
  const goals = useMemo(() => constructionWizardSystem.getGoals(), []);
  const dimensionSpec = useMemo(() => constructionWizardSystem.getDimensionSpec(), []);
  const candidates = useMemo(
    () =>
      constructionWizardSystem.generateCandidates({
        components,
        connections,
        wizard: constructionWizard,
      }),
    [components, connections, constructionWizard]
  );
  const progress = useMemo(
    () =>
      constructionWizardSystem.evaluateProgress({
        components,
        connections,
        wizard: constructionWizard,
      }),
    [components, connections, constructionWizard]
  );

  const activateWizardDefaults = useCallback(() => {
    setEditorState({ gridSize: dimensionSpec.gridCm });
    setMode('select');
    clearGrowthEndpoint();
  }, [clearGrowthEndpoint, dimensionSpec.gridCm, setEditorState, setMode]);

  const handleStartWizard = useCallback(() => {
    startConstructionWizard('basic-platform-frame');
    activateWizardDefaults();
  }, [activateWizardDefaults, startConstructionWizard]);

  const handleCommitCandidate = useCallback(
    (candidate: WizardModuleCandidate) => {
      commitConstructionWizardCandidate(candidate);
      activateWizardDefaults();
    },
    [activateWizardDefaults, commitConstructionWizardCandidate]
  );

  const handleStartEndpointPractice = useCallback(() => {
    const demo = loadBeginnerDemoStarter();
    setEditorState({ gridSize: beginnerDemoSystem.getDimensionSpec().gridCm });
    setMode('select');
    setGrowthPipeComponent('pipe_35cm');
    if (demo.starterEndpoint) {
      selectGrowthEndpoint(demo.starterEndpoint);
    }
  }, [
    loadBeginnerDemoStarter,
    selectGrowthEndpoint,
    setEditorState,
    setGrowthPipeComponent,
    setMode,
  ]);

  const handleLoadTarget = useCallback(() => {
    loadBeginnerDemoTarget();
    setEditorState({ gridSize: beginnerDemoSystem.getDimensionSpec().gridCm });
    setMode('select');
    clearGrowthEndpoint();
  }, [clearGrowthEndpoint, loadBeginnerDemoTarget, setEditorState, setMode]);

  const nextCandidate = candidates[0];
  const moduleClickCount = constructionWizard.moduleHistory.length;

  if (!expanded) {
    if (hideCollapsedTrigger) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 2,
          border: '1px solid rgba(148, 163, 184, 0.45)',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.94)',
          color: '#0f172a',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.14)',
          padding: '7px 11px',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        🧱 结构向导 · {progress.percent}% · 展开
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🧱 结构向导</div>
          <div style={{ color: '#64748b', marginTop: 2 }}>
            先选目标，再点击 3D 里的半透明模块，像垒积木一样搭基础平台架。
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              minWidth: 50,
              textAlign: 'center',
              borderRadius: 999,
              background: progress.isComplete ? '#dcfce7' : '#e0f2fe',
              color: progress.isComplete ? '#166534' : '#075985',
              padding: '4px 8px',
              fontWeight: 800,
            }}
          >
            {progress.percent}%
          </div>
          <button
            type="button"
            aria-label="收起结构向导"
            onClick={() => setExpanded(false)}
            style={{
              border: 0,
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 10,
          background: '#f8fafc',
          color: '#334155',
          border: '1px solid #e2e8f0',
        }}
      >
        尺寸锁定：{dimensionSpec.shortPipeCm}cm / {dimensionSpec.longPipeCm}cm 管，
        {dimensionSpec.gridCm}cm 参考线；35cm={dimensionSpec.longPipeReferenceSpan}格，
        15cm={dimensionSpec.shortPipeReferenceSpan}格。
      </div>

      {!constructionWizard.active && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {goals.map(goal => (
            <button
              key={goal.id}
              type="button"
              disabled={!goal.enabled}
              onClick={handleStartWizard}
              style={{
                ...primaryButtonStyle,
                textAlign: 'left',
                opacity: goal.enabled ? 1 : 0.55,
              }}
            >
              <div>{goal.title}</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.9 }}>{goal.description}</div>
            </button>
          ))}
        </div>
      )}

      {constructionWizard.active && (
        <>
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={layerTagStyle(constructionWizard.currentLayer === 'base')}>底层</span>
            <span style={layerTagStyle(constructionWizard.currentLayer === 'support')}>支撑</span>
            <span style={layerTagStyle(constructionWizard.currentLayer === 'platform')}>平台层</span>
          </div>

          <div style={{ marginTop: 10, color: '#475569' }}>
            已完成 {moduleClickCount}/5 个结构动作；目标是在选择目标后 ≤5 次主点击完成基础平台架。
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
            {progress.checks.map(check => (
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

          <div
            style={{
              marginTop: 12,
              padding: '10px',
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontWeight: 800, color: '#1d4ed8' }}>推荐下一步</div>
            {nextCandidate ? (
              <button
                type="button"
                onClick={() => handleCommitCandidate(nextCandidate)}
                onMouseEnter={() => selectConstructionWizardCandidate(nextCandidate.id)}
                onMouseLeave={() => selectConstructionWizardCandidate(null)}
                style={{
                  ...primaryButtonStyle,
                  width: '100%',
                  marginTop: 8,
                  background: '#1d4ed8',
                  textAlign: 'left',
                }}
              >
                <div>{nextCandidate.label}</div>
                <div style={{ marginTop: 3, fontSize: 11, fontWeight: 500 }}>
                  {nextCandidate.description}
                </div>
                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700 }}>
                  材料：{formatMaterialDelta(nextCandidate.materialDelta)}
                </div>
              </button>
            ) : (
              <div style={{ marginTop: 6, color: progress.isComplete ? '#166534' : '#b45309' }}>
                {progress.nextAction}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleStartWizard} style={{ ...secondaryButtonStyle, flex: 1 }}>
              重新开始向导
            </button>
            <button type="button" onClick={stopConstructionWizard} style={{ ...secondaryButtonStyle, flex: 1 }}>
              高级手动模式
            </button>
          </div>
        </>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 800 }}>
          高级：端点生长 / 完成样例
        </summary>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={handleStartEndpointPractice} style={{ ...secondaryButtonStyle, flex: 1 }}>
            练习端点生长
          </button>
          <button type="button" onClick={handleLoadTarget} style={{ ...secondaryButtonStyle, flex: 1 }}>
            查看完成样例
          </button>
        </div>
      </details>
    </div>
  );
};

export default ConstructionWizardGuide;
