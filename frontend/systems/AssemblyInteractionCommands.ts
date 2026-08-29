import { useDesignStore } from '../stores/designStore';
import { useInteractionStore } from '../stores/interactionStore';
import { advancedStructureSystem, type AFramePlane } from './AdvancedStructureSystem';
import { assemblySelectionSystem } from './AssemblySelectionSystem';
import { structureMountSystem } from './StructureMountSystem';

export type AssemblyPlacementMode = 'copy' | 'reinstall';

export interface AssemblyCommandResult {
  ok: boolean;
  reason?: string;
  installCount?: number;
}

const createSessionId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const inferAFramePlane = (
  positions: Array<[number, number, number]>
): AFramePlane => {
  const xs = positions.map(position => position[0]);
  const zs = positions.map(position => position[2]);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const zSpan = Math.max(...zs) - Math.min(...zs);
  return xSpan >= zSpan ? 'vertical-x' : 'vertical-z';
};

export const startAssemblyPlacement = (
  groupId: string,
  mode: AssemblyPlacementMode
): AssemblyCommandResult => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const sourceMember = designStore.components.find(
    component => component.properties?.assemblyGroupId === groupId
  );
  if (!sourceMember) return { ok: false, reason: '结构已不存在，请重新选择' };
  const assembly = assemblySelectionSystem.deriveFromMember({
    instanceId: sourceMember.instanceId,
    components: designStore.components,
    connections: designStore.connections,
  });
  if (!assembly) return { ok: false, reason: '结构组信息不完整，无法安全操作' };
  if (assembly.structureRecipeId !== 'a-frame-small' && assembly.structureRecipeId !== 'a-frame-large') {
    return { ok: false, reason: '当前结构没有可安全重建的安装配方' };
  }

  let sequence = 0;
  const recipeSeed = createSessionId('assembly_recipe');
  const recipe = advancedStructureSystem.createAFrame({
    size: assembly.structureRecipeId === 'a-frame-large' ? 'large' : 'small',
    plane: inferAFramePlane(assembly.members.map(component => component.position)),
    idFactory: prefix => `${recipeSeed}_${prefix}_${sequence++}`,
  });
  const sourceByComponentId = new Map<string, typeof assembly.members>();
  assembly.members.forEach(component => {
    const list = sourceByComponentId.get(component.componentId) ?? [];
    list.push(component);
    sourceByComponentId.set(component.componentId, list);
  });
  const coloredRecipe = {
    ...recipe,
    components: recipe.components.map(component => {
      const source = sourceByComponentId.get(component.componentId)?.shift();
      return source?.color ? { ...component, color: source.color } : component;
    }),
  };

  const memberIds = new Set(assembly.memberIds);
  const baseComponents = mode === 'reinstall'
    ? designStore.components.filter(component => !memberIds.has(component.instanceId))
    : designStore.components;
  const relatedConnectionIds = new Set([
    ...assembly.internalConnections,
    ...assembly.externalConnections,
  ].map(connection => connection.id));
  const baseConnections = mode === 'reinstall'
    ? designStore.connections.filter(connection => !relatedConnectionIds.has(connection.id))
    : designStore.connections;
  const sites = baseComponents.length === 0
    ? [structureMountSystem.createGroundRecipeMountSite({ recipe: coloredRecipe })]
    : structureMountSystem.listRecipeMountSites({
        recipe: coloredRecipe,
        components: baseComponents,
        connections: baseConnections,
      });
  if (sites.length === 0) {
    return {
      ok: false,
      reason: mode === 'copy'
        ? '当前没有另一组双锚点安装位，未创建副本'
        : '移除原结构后仍没有安全的双锚点安装位，原结构保持不变',
      installCount: 0,
    };
  }

  interactionStore.startTemplatePlacement({
    templateId: coloredRecipe.id,
    templateName: assembly.structureName,
    components: coloredRecipe.components,
    connections: coloredRecipe.connections,
    structureRecipe: coloredRecipe,
    structureMountSite: sites[0],
    replaceAssembly: mode === 'reinstall'
      ? {
          componentIds: assembly.memberIds,
          connectionIds: [...relatedConnectionIds],
        }
      : undefined,
  });
  interactionStore.startBuildTask({
    id: 'a-frame',
    name: mode === 'copy' ? `复制${assembly.structureName}` : `重新安装${assembly.structureName}`,
    specification: {
      aFrameSize: assembly.structureRecipeId === 'a-frame-large' ? 'large' : 'small',
      aFramePlane: inferAFramePlane(assembly.members.map(component => component.position)),
    },
    installationSiteIds: sites.map(site => site.id),
    currentSiteIndex: 0,
  });
  return { ok: true, installCount: sites.length };
};
