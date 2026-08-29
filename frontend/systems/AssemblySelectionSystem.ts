import type { ComponentInstance, Connection } from '../types';

export interface AssemblySelection {
  groupId: string;
  structureRecipeId: string | null;
  structureName: string;
  memberIds: string[];
  members: ComponentInstance[];
  internalConnections: Connection[];
  externalConnections: Connection[];
}

const getGroupId = (component: ComponentInstance) => {
  const value = component.properties?.assemblyGroupId;
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const getRecipeId = (components: ComponentInstance[]) => {
  const value = components
    .map(component => component.properties?.structureRecipeId)
    .find(candidate => typeof candidate === 'string');
  return typeof value === 'string' ? value : null;
};

const getStructureName = (recipeId: string | null) => {
  if (recipeId === 'a-frame-large') return '大型 A 字架';
  if (recipeId === 'a-frame-small') return '小型 A 字架';
  return '组合结构';
};

class AssemblySelectionSystem {
  getGroupId(component: ComponentInstance) {
    return getGroupId(component);
  }

  deriveFromMember(input: {
    instanceId: string;
    components: ComponentInstance[];
    connections: Connection[];
  }): AssemblySelection | null {
    const source = input.components.find(component => component.instanceId === input.instanceId);
    if (!source) return null;
    const groupId = getGroupId(source);
    if (!groupId) return null;
    const members = input.components.filter(component => getGroupId(component) === groupId);
    if (members.length < 2) return null;
    const memberIds = new Set(members.map(component => component.instanceId));
    const internalConnections = input.connections.filter(connection =>
      memberIds.has(connection.source.componentId) && memberIds.has(connection.target.componentId)
    );
    const externalConnections = input.connections.filter(connection =>
      memberIds.has(connection.source.componentId) !== memberIds.has(connection.target.componentId)
    );
    const structureRecipeId = getRecipeId(members);
    return {
      groupId,
      structureRecipeId,
      structureName: getStructureName(structureRecipeId),
      memberIds: members.map(component => component.instanceId),
      members,
      internalConnections,
      externalConnections,
    };
  }

  deriveFromSelection(input: {
    selectedInstanceIds: string[];
    components: ComponentInstance[];
    connections: Connection[];
  }): AssemblySelection | null {
    if (input.selectedInstanceIds.length === 0) return null;
    const assembly = this.deriveFromMember({
      instanceId: input.selectedInstanceIds[0],
      components: input.components,
      connections: input.connections,
    });
    if (!assembly) return null;
    const selectedIds = new Set(input.selectedInstanceIds);
    return assembly.memberIds.length === selectedIds.size &&
      assembly.memberIds.every(id => selectedIds.has(id))
      ? assembly
      : null;
  }
}

export const assemblySelectionSystem = new AssemblySelectionSystem();
