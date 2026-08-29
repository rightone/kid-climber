import type { ComponentInstance, Connection } from '../types';
import {
  advancedStructureSystem,
  type AFrameModuleSize,
  type AFramePlane,
  type StructureRecipe,
} from './AdvancedStructureSystem';
import { boardMountSystem, type BoardComponentId } from './BoardMountSystem';
import { curvedTubeMountSystem } from './CurvedTubeMountSystem';
import {
  endpointGrowthSystem,
  predictionSiteKey,
  type GrowthPipeComponentId,
} from './EndpointGrowthSystem';
import { rampMountSystem, type RampComponentId } from './RampMountSystem';
import { structureMountSystem } from './StructureMountSystem';

export type BuildTaskId =
  | 'base-frame'
  | 'extend'
  | 'diagonal-brace'
  | 'a-frame'
  | 'platform'
  | 'u-arch'
  | 'ramp';

export type BuildTaskSpecification = {
  pipeComponentId?: GrowthPipeComponentId;
  aFrameSize?: AFrameModuleSize;
  aFramePlane?: AFramePlane;
  boardComponentId?: BoardComponentId;
  curvedTubeFlip?: boolean;
  rampComponentId?: RampComponentId;
};

export interface BuildTaskAvailability {
  id: BuildTaskId;
  name: string;
  description: string;
  installCount: number;
  status: 'available' | 'blocked';
  blockingReason?: string;
  specification: BuildTaskSpecification;
  installationSiteIds: string[];
}

/**
 * Interaction-session state only. It deliberately contains no document data and
 * must never be serialized into a design file.
 */
export interface ActiveBuildTask {
  id: BuildTaskId;
  name: string;
  specification: BuildTaskSpecification;
  installationSiteIds: string[];
  currentSiteIndex: number;
}

export interface BuildTaskAvailabilityInput {
  components: ComponentInstance[];
  connections: Connection[];
  specification?: BuildTaskSpecification;
}

const TASK_DETAILS: Record<BuildTaskId, Pick<BuildTaskAvailability, 'name' | 'description'>> = {
  'base-frame': {
    name: '基础平台架',
    description: '按搭积木步骤完成底框、立柱、顶框与支撑。',
  },
  extend: {
    name: '延长结构',
    description: '从现有空闲端点继续增加标准直管。',
  },
  'diagonal-brace': {
    name: '添加斜撑',
    description: '显示所有可闭合或可延伸的 45° 支撑位置。',
  },
  'a-frame': {
    name: '添加 A 字架',
    description: '整体安装标准 A 字架，双脚必须同时连接。',
  },
  platform: {
    name: '安装平台',
    description: '在四角支撑完整的位置安装平台板。',
  },
  'u-arch': {
    name: '安装 U 形攀爬拱',
    description: '连接两个相距 40cm、同向平行的空闲端点。',
  },
  ramp: {
    name: '安装坡道',
    description: '连接平台边缘的两个锚点并让低端安全落地。',
  },
};

const createAFrameProbeRecipe = (specification: BuildTaskSpecification): StructureRecipe => {
  let sequence = 0;
  return advancedStructureSystem.createAFrame({
    size: specification.aFrameSize ?? 'small',
    plane: specification.aFramePlane ?? 'vertical-x',
    idFactory: prefix => `build_task_probe_${prefix}_${sequence++}`,
  });
};

const createAvailability = (
  id: BuildTaskId,
  specification: BuildTaskSpecification,
  installationSiteIds: string[],
  blockingReason?: string
): BuildTaskAvailability => ({
  id,
  ...TASK_DETAILS[id],
  installCount: installationSiteIds.length,
  status: installationSiteIds.length > 0 ? 'available' : 'blocked',
  blockingReason: installationSiteIds.length > 0 ? undefined : blockingReason,
  specification,
  installationSiteIds,
});

const listGrowthSiteIds = (
  input: BuildTaskAvailabilityInput,
  family: 'straight' | 'diagonal'
) => {
  const pipeComponentId = input.specification?.pipeComponentId ?? 'pipe_35cm';
  return endpointGrowthSystem
    .listPredictionSites({
      components: input.components,
      connections: input.connections,
      pipeComponentId,
      family,
    })
    .map(predictionSiteKey);
};

class BuildTaskSystem {
  getTaskDetails(id: BuildTaskId) {
    return TASK_DETAILS[id];
  }

  getAvailability(id: BuildTaskId, input: BuildTaskAvailabilityInput): BuildTaskAvailability {
    const specification = input.specification ?? {};

    switch (id) {
      case 'base-frame':
        return createAvailability(id, specification, ['construction-wizard']);
      case 'extend':
        return createAvailability(
          id,
          { ...specification, pipeComponentId: specification.pipeComponentId ?? 'pipe_35cm' },
          listGrowthSiteIds(input, 'straight'),
          input.components.length === 0
            ? '先添加基础平台架，才能从空闲端点延长结构'
            : '当前没有可继续延长的空闲端点'
        );
      case 'diagonal-brace':
        return createAvailability(
          id,
          { ...specification, pipeComponentId: specification.pipeComponentId ?? 'pipe_35cm' },
          listGrowthSiteIds(input, 'diagonal'),
          input.components.length === 0
            ? '先搭建基础框架，系统才能计算斜撑位置'
            : '需要可形成 45° 支撑的空闲端点或跨度'
        );
      case 'a-frame': {
        const normalizedSpecification = {
          ...specification,
          aFrameSize: specification.aFrameSize ?? 'small',
          aFramePlane: specification.aFramePlane ?? 'vertical-x',
        };
        const recipe = createAFrameProbeRecipe(normalizedSpecification);
        const sites = input.components.length === 0
          ? [structureMountSystem.createGroundRecipeMountSite({ recipe })]
          : structureMountSystem.listRecipeMountSites({
              recipe,
              components: input.components,
              connections: input.connections,
            });
        return createAvailability(
          id,
          normalizedSpecification,
          sites.map(site => site.id),
          '需要两个同高、同向且间距匹配的空闲端点'
        );
      }
      case 'platform': {
        const boardComponentId = specification.boardComponentId ?? 'board_40x40';
        const scan = boardMountSystem.scanBoardMountSites({
          boardComponentId,
          components: input.components,
          connections: input.connections,
        });
        return createAvailability(
          id,
          { ...specification, boardComponentId },
          [...scan.validSites, ...scan.repairableSites].map(site => site.id),
          '需要四个组成矩形、同高且未占用的平台安装角点'
        );
      }
      case 'u-arch': {
        const curvedTubeFlip = specification.curvedTubeFlip ?? false;
        const sites = curvedTubeMountSystem
          .listCurvedTubeMountSites({
            components: input.components,
            connections: input.connections,
          })
          .filter(site => site.flip === curvedTubeFlip);
        return createAvailability(
          id,
          { ...specification, curvedTubeFlip },
          sites.map(site => site.id),
          '需要两个相距 40cm、同向平行的空闲端点'
        );
      }
      case 'ramp': {
        const rampComponentId = specification.rampComponentId ?? 'ramp_45cm';
        const sites = rampMountSystem.listRampMountSites({
          componentId: rampComponentId,
          components: input.components,
          connections: input.connections,
        });
        return createAvailability(
          id,
          { ...specification, rampComponentId },
          sites.map(site => site.id),
          '需要两个同高、相距 40cm 且坡道低端可落地的安装点'
        );
      }
    }
  }

  listAvailabilities(input: BuildTaskAvailabilityInput): BuildTaskAvailability[] {
    const order: BuildTaskId[] = [
      'base-frame',
      'extend',
      'diagonal-brace',
      'a-frame',
      'platform',
      'u-arch',
      'ramp',
    ];
    return order.map(id => this.getAvailability(id, input));
  }

  createActiveTask(availability: BuildTaskAvailability): ActiveBuildTask | null {
    if (availability.status === 'blocked') return null;
    return {
      id: availability.id,
      name: availability.name,
      specification: availability.specification,
      installationSiteIds: [...availability.installationSiteIds],
      currentSiteIndex: 0,
    };
  }
}

export const buildTaskSystem = new BuildTaskSystem();
