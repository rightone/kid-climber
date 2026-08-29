import React from 'react';
import { Button, Segmented, Tag, Tooltip } from 'antd';
import {
  BuildOutlined,
  CheckCircleOutlined,
  DragOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  RotateRightOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import type { InteractionMode } from '../../../stores/interactionStore';
import type {
  BuildCandidateFamily,
  GrowthPipeComponentId,
} from '../../../systems/EndpointGrowthSystem';

const MODE_DETAILS: Record<
  InteractionMode,
  {
    label: string;
    color: string;
    icon: React.ReactNode;
  }
> = {
  select: {
    label: '选择',
    color: '#0f172a',
    icon: <SelectOutlined />,
  },
  place: {
    label: '放置',
    color: '#15803d',
    icon: <PlusOutlined />,
  },
  move: {
    label: '移动',
    color: '#1d4ed8',
    icon: <DragOutlined />,
  },
  rotate: {
    label: '旋转',
    color: '#7e22ce',
    icon: <RotateRightOutlined />,
  },
  connect: {
    label: '连接',
    color: '#b45309',
    icon: <LinkOutlined />,
  },
};

interface BuildCommandBarProps {
  mode: InteractionMode;
  statusMessage: string;
  pipeComponentId: GrowthPipeComponentId;
  candidateFamily: BuildCandidateFamily;
  predictionEnabled: boolean;
  wizardActive: boolean;
  wizardProgress: number;
  canCommitPlacement: boolean;
  templatePlacementActive?: boolean;
  onPipeComponentChange: (componentId: GrowthPipeComponentId) => void;
  onCandidateFamilyChange: (family: BuildCandidateFamily) => void;
  onPredictionToggle: () => void;
  onCommitPlacement: () => void;
  onRotateTemplate?: () => void;
  onCancelTemplate?: () => void;
  onWizardOpen: () => void;
  repairableTopologyCount?: number;
  freeEndpointCount?: number;
  onRepairTopology?: () => void;
  activeTaskName?: string;
  activeTaskDirection?: string;
  activeTaskSiteIndex?: number;
  activeTaskSiteCount?: number;
  onPreviousTaskSite?: () => void;
  onNextTaskSite?: () => void;
}

const BuildCommandBar: React.FC<BuildCommandBarProps> = ({
  mode,
  statusMessage,
  pipeComponentId,
  candidateFamily,
  predictionEnabled,
  wizardActive,
  wizardProgress,
  canCommitPlacement,
  templatePlacementActive = false,
  onPipeComponentChange,
  onCandidateFamilyChange,
  onPredictionToggle,
  onCommitPlacement,
  onRotateTemplate,
  onCancelTemplate,
  onWizardOpen,
  repairableTopologyCount = 0,
  freeEndpointCount = 0,
  onRepairTopology,
  activeTaskName,
  activeTaskDirection,
  activeTaskSiteIndex = 0,
  activeTaskSiteCount = 0,
  onPreviousTaskSite,
  onNextTaskSite,
}) => {
  const modeDetails = MODE_DETAILS[mode];
  const taskActive = Boolean(activeTaskName);
  const showGrowthControls =
    !taskActive && !wizardActive && (mode === 'select' || mode === 'connect');

  return (
    <div
      data-testid="build-command-bar"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 4,
        width: 'min(900px, calc(100% - 24px))',
        minHeight: 38,
        padding: '5px 6px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(148, 163, 184, 0.42)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
        backdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          height: 28,
          padding: '0 9px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
          background: modeDetails.color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {modeDetails.icon}
        <span>{modeDetails.label}</span>
      </div>

      <div
        data-testid="build-command-status"
        title={statusMessage}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#334155',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {statusMessage}
      </div>

      {repairableTopologyCount > 0 ? (
        <Tooltip title={`发现 ${repairableTopologyCount} 处可修复连接；另有 ${freeEndpointCount} 个合法自由端点`}>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={onRepairTopology}
            style={{ flexShrink: 0 }}
          >
            一键修复
          </Button>
        </Tooltip>
      ) : null}

      {wizardActive ? (
        <Button
          type="primary"
          size="small"
          icon={<BuildOutlined />}
          onClick={onWizardOpen}
          style={{ flexShrink: 0 }}
        >
          向导 {wizardProgress}%
        </Button>
      ) : !taskActive ? (
        <Tooltip title="打开结构向导">
          <Button
            size="small"
            icon={<BuildOutlined />}
            onClick={onWizardOpen}
            aria-label="打开结构向导"
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      ) : null}

      {taskActive && activeTaskDirection ? (
        <Tag color="blue" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
          {activeTaskDirection}
        </Tag>
      ) : null}

      {taskActive && activeTaskSiteCount > 0 ? (
        <>
          <Button
            size="small"
            onClick={onPreviousTaskSite}
            disabled={activeTaskSiteCount < 2}
            aria-label="上一处安装位"
            style={{ flexShrink: 0 }}
          >
            上一处
          </Button>
          <span style={{ color: '#475569', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {activeTaskSiteIndex + 1}/{activeTaskSiteCount}
          </span>
          <Button
            size="small"
            onClick={onNextTaskSite}
            disabled={activeTaskSiteCount < 2}
            aria-label="下一处安装位"
            style={{ flexShrink: 0 }}
          >
            下一处
          </Button>
        </>
      ) : null}

      {showGrowthControls ? (
        <>
          <Segmented
            size="small"
            value={candidateFamily}
            options={[
              { label: '直向', value: 'straight' },
              { label: '斜向', value: 'diagonal' },
              { label: '结构', value: 'structure' },
            ]}
            onChange={value =>
              onCandidateFamilyChange(value as BuildCandidateFamily)
            }
            aria-label="搭建候选类型"
            style={{ flexShrink: 0 }}
          />
          <Segmented
            size="small"
            value={pipeComponentId}
            options={[
              { label: '15cm', value: 'pipe_15cm' },
              { label: '25cm', value: 'pipe_25cm' },
              { label: '35cm', value: 'pipe_35cm' },
            ]}
            onChange={value =>
              onPipeComponentChange(value as GrowthPipeComponentId)
            }
            style={{ flexShrink: 0 }}
            disabled={candidateFamily === 'structure'}
          />
          <Tooltip title={predictionEnabled ? '关闭连接预测' : '开启连接预测'}>
            <Button
              data-testid="prediction-toggle"
              size="small"
              type={predictionEnabled ? 'primary' : 'default'}
              icon={predictionEnabled ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={onPredictionToggle}
              aria-label={`连接预测${predictionEnabled ? '已开启' : '已关闭'}`}
              style={{ flexShrink: 0 }}
            >
              预测
            </Button>
          </Tooltip>
        </>
      ) : null}

      {taskActive ? (
        <>
          <Button
            size="small"
            onClick={onCancelTemplate}
            style={{ flexShrink: 0 }}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            disabled={!canCommitPlacement}
            onClick={onCommitPlacement}
            style={{ flexShrink: 0 }}
          >
            安装
          </Button>
        </>
      ) : mode === 'place' ? (
        <>
          {templatePlacementActive ? (
            <>
              <Button
                size="small"
                icon={<RotateRightOutlined />}
                onClick={onRotateTemplate}
                style={{ flexShrink: 0 }}
              >
                旋转90°
              </Button>
              <Button
                size="small"
                onClick={onCancelTemplate}
                style={{ flexShrink: 0 }}
              >
                取消
              </Button>
            </>
          ) : null}
          <Button
            type="primary"
            size="small"
            disabled={!canCommitPlacement}
            onClick={onCommitPlacement}
            style={{ flexShrink: 0 }}
          >
            安装
          </Button>
        </>
      ) : null}
    </div>
  );
};

export default React.memo(BuildCommandBar);
