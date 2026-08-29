import { useDesignStore } from '../stores/designStore';
import { useInteractionStore } from '../stores/interactionStore';
import {
  type ConstructionSuggestion,
} from './ConstructionEngine';
import {
  endpointGrowthSystem,
  growthSelectionFromSite,
  predictionSiteKey,
  predictionSiteMatchesSelection,
} from './EndpointGrowthSystem';
import {
  connectorTopologySystem,
  markConnectorAutoManaged,
  type TopologyPatch,
} from './ConnectorTopologySystem';
import {
  resolvePlacementContacts,
} from './TopologyIntegritySystem';
import {
  boardMountSystem,
  type BoardComponentId,
} from './BoardMountSystem';
import {
  curvedTubeMountSystem,
  U_CURVED_TUBE_COMPONENT_ID,
} from './CurvedTubeMountSystem';
import {
  rampMountSystem,
  type RampComponentId,
} from './RampMountSystem';
import { transformTemplateComponents } from '../utils/templateUtils';
import { structureMountSystem } from './StructureMountSystem';
import type { ComponentInstance, Connection } from '../types';
import { constructionWizardSystem } from './ConstructionWizardSystem';

const createCommandId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createPlacementInstanceId = () => createCommandId('inst');

const isBoardComponentId = (componentId: string): componentId is BoardComponentId =>
  componentId === 'board_40x40' || componentId === 'board_40x20';

const listBoardInstallableSites = (input: Parameters<
  typeof boardMountSystem.scanBoardMountSites
>[0]) => {
  const scan = boardMountSystem.scanBoardMountSites(input);
  return [...scan.validSites, ...scan.repairableSites];
};

const applyPlacementContactsToPatch = (input: {
  patch: TopologyPatch;
  placedComponentIds: string[];
  components: ComponentInstance[];
  connections: Connection[];
}): TopologyPatch => {
  const projected = connectorTopologySystem.applyTopologyPatch({
    components: input.components,
    connections: input.connections,
    patch: input.patch,
    normalizeAutoConnectors: false,
  });
  const contactResolution = resolvePlacementContacts({
    components: projected.components,
    connections: projected.connections,
    placementComponentIds: input.placedComponentIds,
    idFactory: createCommandId,
  });
  const removedConnectionIds = new Set(contactResolution.removeConnectionIds);
  const addConnections = [
    ...input.patch.addConnections.filter(
      connection => !removedConnectionIds.has(connection.id)
    ),
    ...contactResolution.addConnections,
  ];
  const nextEndpointWasClosed = input.patch.nextEndpoint
    ? contactResolution.addConnections.some(connection =>
        (
          connection.source.componentId === input.patch.nextEndpoint?.componentId &&
          connection.source.pointId === input.patch.nextEndpoint.pointId
        ) ||
        (
          connection.target.componentId === input.patch.nextEndpoint?.componentId &&
          connection.target.pointId === input.patch.nextEndpoint.pointId
        )
      )
    : false;
  return {
    ...input.patch,
    addConnections,
    removeConnectionIds: [
      ...new Set([
        ...input.patch.removeConnectionIds,
        ...contactResolution.removeConnectionIds,
      ]),
    ],
    nextEndpoint: nextEndpointWasClosed
      ? undefined
      : input.patch.nextEndpoint,
  };
};

const createConnectorInsertionPatch = (input: {
  suggestion: ConstructionSuggestion;
  sourceInstanceId: string;
  addedComponent?: ComponentInstance;
  updatedComponent?: {
    instanceId: string;
    updates: Partial<ComponentInstance>;
  };
  removeConnectionIds?: string[];
  components: ComponentInstance[];
  connections: Connection[];
}): TopologyPatch | null => {
  const target = input.suggestion.connectorTarget;
  const sourcePointId = input.suggestion.sourcePointId;
  if (!target || !sourcePointId) return null;
  if (
    !input.components.some(
      component => component.instanceId === target.target.componentId
    ) ||
    input.connections.some(
      connection =>
        (
          connection.source.componentId === target.target.componentId &&
          connection.source.pointId === target.target.pointId
        ) ||
        (
          connection.target.componentId === target.target.componentId &&
          connection.target.pointId === target.target.pointId
        )
    )
  ) {
    return null;
  }

  const connectorInstanceId = createCommandId('connector');
  return {
    addComponents: [
      {
        instanceId: connectorInstanceId,
        componentId: target.connectorComponentId,
        position: target.connectorPosition,
        rotation: target.connectorRotation,
        scale: [1, 1, 1],
        properties: markConnectorAutoManaged(undefined),
      },
      ...(input.addedComponent ? [input.addedComponent] : []),
    ],
    updateComponents: input.updatedComponent
      ? [input.updatedComponent]
      : [],
    removeComponentIds: [],
    addConnections: [
      {
        id: createCommandId('conn_target'),
        source: {
          componentId: target.target.componentId,
          pointId: target.target.pointId,
        },
        target: {
          componentId: connectorInstanceId,
          pointId: target.targetConnectorPointId,
        },
        type: 'socket',
        isActive: true,
      },
      {
        id: createCommandId('conn_source'),
        source: {
          componentId: connectorInstanceId,
          pointId: target.sourceConnectorPointId,
        },
        target: {
          componentId: input.sourceInstanceId,
          pointId: sourcePointId,
        },
        type: 'socket',
        isActive: true,
      },
    ],
    updateConnections: [],
    removeConnectionIds: input.removeConnectionIds ?? [],
    selectInstanceId: input.sourceInstanceId,
  };
};

export const activateDefaultGrowthEndpoint = (
  componentId: string,
  preferredPointId?: string | null
): { componentId: string; pointId: string } | null => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();

  const endpoint = endpointGrowthSystem.chooseDefaultEndpoint({
    componentId,
    components: designStore.components,
    connections: designStore.connections,
    preferredPointId,
  });
  if (endpoint) {
    interactionStore.selectGrowthEndpoint(endpoint);
  }
  return endpoint;
};

export const cancelActiveInteraction = (): 'context-menu' | 'growth' | 'interaction' => {
  const interactionStore = useInteractionStore.getState();
  if (interactionStore.interaction.contextMenu) {
    interactionStore.closeContextMenu();
    return 'context-menu';
  }
  if (interactionStore.interaction.assemblyEditGroupId) {
    const groupId = interactionStore.interaction.assemblyEditGroupId;
    const memberIds = useDesignStore.getState().components
      .filter(component => component.properties?.assemblyGroupId === groupId)
      .map(component => component.instanceId);
    interactionStore.setAssemblyEditGroupId(null);
    interactionStore.selectComponents(memberIds);
    return 'interaction';
  }
  if (interactionStore.interaction.activeBuildTask) {
    if (interactionStore.interaction.activeBuildTask.id === 'base-frame') {
      useDesignStore.getState().stopConstructionWizard();
    }
    interactionStore.cancelTemplatePlacement();
    interactionStore.cancelPlace();
    interactionStore.clearGrowthEndpoint();
    interactionStore.finishBuildTask();
    interactionStore.setGrowthCandidateFamily('straight');
    interactionStore.setActiveTool('select');
    return 'interaction';
  }
  if (interactionStore.interaction.templatePlacement) {
    interactionStore.cancelTemplatePlacement();
    interactionStore.setActiveTool('select');
    return 'interaction';
  }
  if (interactionStore.interaction.growthState.selectedEndpoint) {
    interactionStore.clearGrowthEndpoint();
    return 'growth';
  }

  interactionStore.cancelPlace();
  interactionStore.endDrag();
  interactionStore.clearSelection();
  interactionStore.setActiveTool('select');
  return 'interaction';
};

export const selectActiveBuildTaskSite = (siteIdOrIndex: string | number): boolean => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const task = interactionStore.interaction.activeBuildTask;
  if (!task || task.installationSiteIds.length === 0) return false;
  const index = typeof siteIdOrIndex === 'number'
    ? siteIdOrIndex
    : task.installationSiteIds.indexOf(siteIdOrIndex);
  if (index < 0 || index >= task.installationSiteIds.length) return false;
  const siteId = task.installationSiteIds[index];

  if (task.id === 'extend' || task.id === 'diagonal-brace') {
    const family = task.id === 'extend' ? 'straight' : 'diagonal';
    const site = endpointGrowthSystem.listPredictionSites({
      components: designStore.components,
      connections: designStore.connections,
      pipeComponentId: task.specification.pipeComponentId ?? 'pipe_35cm',
      family,
    }).find(candidate => predictionSiteKey(candidate) === siteId);
    if (!site) return false;
    interactionStore.setBuildTaskSiteIndex(index);
    interactionStore.selectGrowthEndpoint(growthSelectionFromSite(site));
    interactionStore.setHoveredGrowthCandidate(null);
    return true;
  }

  if (task.id === 'a-frame') {
    const placement = interactionStore.interaction.templatePlacement;
    const recipe = placement?.structureRecipe;
    if (!recipe) return false;
    const removedComponentIds = new Set(placement.replaceAssembly?.componentIds ?? []);
    const removedConnectionIds = new Set(placement.replaceAssembly?.connectionIds ?? []);
    const validationComponents = removedComponentIds.size > 0
      ? designStore.components.filter(component => !removedComponentIds.has(component.instanceId))
      : designStore.components;
    const validationConnections = removedConnectionIds.size > 0
      ? designStore.connections.filter(connection => !removedConnectionIds.has(connection.id))
      : designStore.connections;
    const sites = validationComponents.length === 0
      ? [structureMountSystem.createGroundRecipeMountSite({ recipe })]
      : structureMountSystem.listRecipeMountSites({
          recipe,
          components: validationComponents,
          connections: validationConnections,
        });
    const site = sites.find(candidate => candidate.id === siteId);
    if (!site) return false;
    interactionStore.setBuildTaskSiteIndex(index);
    interactionStore.setTemplateStructureMountSite(site);
    return true;
  }

  if (task.id === 'platform') {
    const boardComponentId = task.specification.boardComponentId ?? 'board_40x40';
    const site = listBoardInstallableSites({
      boardComponentId,
      components: designStore.components,
      connections: designStore.connections,
    }).find(candidate => candidate.id === siteId);
    if (!site) return false;
    interactionStore.setBuildTaskSiteIndex(index);
    interactionStore.updatePlacePreview({
      position: site.position,
      rotation: site.rotation,
      isValid: true,
      snapType: 'connection',
      boardMountSite: site,
      message: `平台安装位 ${index + 1}/${task.installationSiteIds.length} 已选中`,
    });
    return true;
  }

  if (task.id === 'u-arch') {
    const site = curvedTubeMountSystem.listCurvedTubeMountSites({
      components: designStore.components,
      connections: designStore.connections,
    }).find(candidate => candidate.id === siteId);
    if (!site) return false;
    interactionStore.setBuildTaskSiteIndex(index);
    interactionStore.updatePlacePreview({
      position: site.position,
      rotation: site.rotation,
      isValid: true,
      snapType: 'connection',
      curvedTubeMountSite: site,
      message: `攀爬拱安装位 ${index + 1}/${task.installationSiteIds.length} 已选中`,
    });
    return true;
  }

  if (task.id === 'ramp') {
    const componentId = task.specification.rampComponentId ?? 'ramp_45cm';
    const site = rampMountSystem.listRampMountSites({
      componentId,
      components: designStore.components,
      connections: designStore.connections,
    }).find(candidate => candidate.id === siteId);
    if (!site) return false;
    interactionStore.setBuildTaskSiteIndex(index);
    interactionStore.updatePlacePreview({
      position: site.position,
      rotation: site.rotation,
      isValid: true,
      snapType: 'connection',
      rampMountSite: site,
      message: `坡道安装位 ${index + 1}/${task.installationSiteIds.length} 已选中`,
    });
    return true;
  }

  return false;
};

export const cycleActiveBuildTaskSite = (direction: -1 | 1): boolean => {
  const task = useInteractionStore.getState().interaction.activeBuildTask;
  if (!task || task.installationSiteIds.length === 0) return false;
  const count = task.installationSiteIds.length;
  const nextIndex = (task.currentSiteIndex + direction + count) % count;
  return selectActiveBuildTaskSite(nextIndex);
};

export const commitActivePlacement = (): boolean => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const { mode, placeState } = interactionStore.interaction;
  const templatePlacement = interactionStore.interaction.templatePlacement;

  if (mode === 'place' && templatePlacement) {
    if (templatePlacement.structureRecipe) {
      const replacementComponentIds = new Set(
        templatePlacement.replaceAssembly?.componentIds ?? []
      );
      const replacementConnectionIds = new Set(
        templatePlacement.replaceAssembly?.connectionIds ?? []
      );
      const validationComponents = replacementComponentIds.size > 0
        ? designStore.components.filter(
            component => !replacementComponentIds.has(component.instanceId)
          )
        : designStore.components;
      const validationConnections = replacementConnectionIds.size > 0
        ? designStore.connections.filter(
            connection => !replacementConnectionIds.has(connection.id)
          )
        : designStore.connections;
      const currentSites = validationComponents.length === 0
        ? [structureMountSystem.createGroundRecipeMountSite({
            recipe: templatePlacement.structureRecipe,
          })]
        : structureMountSystem.listRecipeMountSites({
            recipe: templatePlacement.structureRecipe,
            components: validationComponents,
            connections: validationConnections,
          });
      const currentSite = currentSites.find(
        site => site.id === templatePlacement.structureMountSite?.id
      );
      if (!currentSite) return false;
      const patch = structureMountSystem.createRecipePlacementPatch({
        recipe: templatePlacement.structureRecipe,
        site: currentSite,
        components: validationComponents,
        connections: validationConnections,
        idFactory: createCommandId,
      });
      if (!patch) return false;
      if (templatePlacement.replaceAssembly) {
        patch.removeComponentIds = [
          ...new Set([
            ...patch.removeComponentIds,
            ...templatePlacement.replaceAssembly.componentIds,
          ]),
        ];
        patch.removeConnectionIds = [
          ...new Set([
            ...patch.removeConnectionIds,
            ...templatePlacement.replaceAssembly.connectionIds,
          ]),
        ];
      }
      designStore.commitTopologyPatch(patch);
      interactionStore.cancelTemplatePlacement();
      interactionStore.setMode('select');
      interactionStore.setActiveTool('select');
      interactionStore.setGrowthCandidateFamily('straight');
      if (patch.addComponents.length > 0) {
        interactionStore.selectComponents(
          patch.addComponents.map(component => component.instanceId)
        );
      }
      return true;
    }
    const components = transformTemplateComponents({
      components: templatePlacement.components,
      origin: templatePlacement.origin,
      rotationY: templatePlacement.rotationY,
    });
    designStore.commitTopologyPatch({
      addComponents: components,
      updateComponents: [],
      removeComponentIds: [],
      addConnections: templatePlacement.connections,
      updateConnections: [],
      removeConnectionIds: [],
      selectInstanceId: components[0]?.instanceId,
    });
    interactionStore.cancelTemplatePlacement();
    interactionStore.setMode('select');
    interactionStore.setActiveTool('select');
    interactionStore.selectComponents(
      components.map(component => component.instanceId)
    );
    return true;
  }

  if (
    mode !== 'place' ||
    !placeState.componentId ||
    !placeState.previewPosition ||
    !placeState.isValid
  ) {
    return false;
  }

  const newComponent = {
    instanceId: createPlacementInstanceId(),
    componentId: placeState.componentId,
    position: placeState.previewPosition,
    rotation: placeState.previewRotation,
    scale: [1, 1, 1] as [number, number, number],
  };
  if (
    isBoardComponentId(placeState.componentId) &&
    placeState.boardMountSite
  ) {
    const currentSite = listBoardInstallableSites({
        boardComponentId: placeState.componentId,
        components: designStore.components,
        connections: designStore.connections,
      })
      .find(site => site.id === placeState.boardMountSite?.id);
    if (!currentSite) {
      interactionStore.cancelPlace();
      return false;
    }
    const patch = boardMountSystem.createBoardPlacementPatch({
      site: currentSite,
      boardInstanceId: newComponent.instanceId,
      components: designStore.components,
      connections: designStore.connections,
      idFactory: createCommandId,
    });
    if (!patch) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitTopologyPatch(patch);
    interactionStore.cancelPlace();
    interactionStore.setMode('select');
    interactionStore.setActiveTool('select');
    interactionStore.selectComponents([newComponent.instanceId]);
    return true;
  }
  if (placeState.componentId === U_CURVED_TUBE_COMPONENT_ID) {
    if (!placeState.curvedTubeMountSite) {
      interactionStore.cancelPlace();
      return false;
    }
    const currentSite = curvedTubeMountSystem
      .listCurvedTubeMountSites({
        components: designStore.components,
        connections: designStore.connections,
      })
      .find(site => site.id === placeState.curvedTubeMountSite?.id);
    if (!currentSite) {
      interactionStore.cancelPlace();
      return false;
    }
    const patch = curvedTubeMountSystem.createCurvedTubePlacementPatch({
      site: currentSite,
      instanceId: newComponent.instanceId,
      components: designStore.components,
      connections: designStore.connections,
      idFactory: createCommandId,
    });
    if (!patch) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitTopologyPatch(patch);
    interactionStore.cancelPlace();
    interactionStore.setMode('select');
    interactionStore.setActiveTool('select');
    interactionStore.selectComponents([newComponent.instanceId]);
    return true;
  }
  if (rampMountSystem.isRampComponentId(placeState.componentId)) {
    if (!placeState.rampMountSite) {
      interactionStore.cancelPlace();
      return false;
    }
    const patch = rampMountSystem.createRampPlacementPatch({
      site: placeState.rampMountSite,
      instanceId: newComponent.instanceId,
      components: designStore.components,
      connections: designStore.connections,
      idFactory: createCommandId,
    });
    if (!patch) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitTopologyPatch(patch);
    interactionStore.cancelPlace();
    interactionStore.setMode('select');
    interactionStore.setActiveTool('select');
    interactionStore.selectComponents([newComponent.instanceId]);
    return true;
  }
  const suggestion: ConstructionSuggestion = {
    componentId: placeState.componentId,
    position: placeState.previewPosition,
    rotation: placeState.previewRotation,
    snapType: placeState.snapType ?? 'free',
    confidence: placeState.snapConfidence,
    message: placeState.message,
    sourcePointId: placeState.snapSourcePointId ?? undefined,
    target: placeState.snapTarget
      ? {
          componentId: placeState.snapTarget.instanceId,
          pointId: placeState.snapTarget.pointId,
          position: placeState.snapTarget.position,
        }
      : undefined,
    topologyTarget: placeState.topologyTarget ?? undefined,
    connectorTarget: placeState.connectorTarget ?? undefined,
  };
  if (suggestion.topologyTarget && suggestion.sourcePointId) {
    const patch = connectorTopologySystem.createConnectorUpgradePatch({
      connectorInstanceId: suggestion.topologyTarget.connectorInstanceId,
      desiredDirection: suggestion.topologyTarget.direction,
      addedComponent: newComponent,
      sourcePointId: suggestion.sourcePointId,
      components: designStore.components,
      connections: designStore.connections,
      idFactory: createCommandId,
      selectInstanceId: newComponent.instanceId,
    });
    if (!patch) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitTopologyPatch(
      applyPlacementContactsToPatch({
        patch,
        placedComponentIds: [newComponent.instanceId],
        components: designStore.components,
        connections: designStore.connections,
      })
    );
  } else if (suggestion.connectorTarget && suggestion.sourcePointId) {
    const patch = createConnectorInsertionPatch({
      suggestion,
      sourceInstanceId: newComponent.instanceId,
      addedComponent: newComponent,
      components: designStore.components,
      connections: designStore.connections,
    });
    if (!patch) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitTopologyPatch(
      applyPlacementContactsToPatch({
        patch,
        placedComponentIds: [
          newComponent.instanceId,
          ...patch.addComponents
            .filter(component => component.instanceId !== newComponent.instanceId)
            .map(component => component.instanceId),
        ],
        components: designStore.components,
        connections: designStore.connections,
      })
    );
  } else {
    const projectedComponents = [...designStore.components, newComponent];
    const contactResolution = resolvePlacementContacts({
      components: projectedComponents,
      connections: designStore.connections,
      placementComponentIds: [newComponent.instanceId],
      idFactory: createCommandId,
    });
    if (suggestion.target && contactResolution.addConnections.length === 0) {
      interactionStore.cancelPlace();
      return false;
    }
    designStore.commitComponentPlacement(
      newComponent,
      contactResolution.addConnections
    );
  }

  interactionStore.cancelPlace();
  interactionStore.setMode('select');
  interactionStore.setActiveTool('select');
  interactionStore.selectComponents([newComponent.instanceId]);
  activateDefaultGrowthEndpoint(newComponent.instanceId);
  return true;
};

export const commitActiveGrowthCandidate = (candidateId: string): boolean => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const { growthState } = interactionStore.interaction;
  const currentEndpoint = growthState.selectedEndpoint;
  if (!currentEndpoint) return false;

  const currentSite = endpointGrowthSystem
    .listPredictionSites({
      pipeComponentId: growthState.pipeComponentId,
      family: growthState.candidateFamily === 'structure'
        ? 'straight'
        : growthState.candidateFamily,
      components: designStore.components,
      connections: designStore.connections,
    })
    .find(site => predictionSiteMatchesSelection(site, currentEndpoint));
  if (!currentSite) {
    interactionStore.clearGrowthEndpoint();
    return false;
  }

  const currentCandidate = endpointGrowthSystem
    .generateCandidates({
      site: currentSite,
      pipeComponentId: growthState.pipeComponentId,
      family: growthState.candidateFamily === 'structure'
        ? 'straight'
        : growthState.candidateFamily,
      components: designStore.components,
      connections: designStore.connections,
    })
    .find(candidate => candidate.id === candidateId);
  if (!currentCandidate) {
    interactionStore.clearGrowthEndpoint();
    return false;
  }

  const patch = endpointGrowthSystem.createTopologyPatch(currentCandidate, {
    components: designStore.components,
    connections: designStore.connections,
  });
  if (!patch) {
    interactionStore.clearGrowthEndpoint();
    return false;
  }
  const resolvedPatch = applyPlacementContactsToPatch({
    patch,
    placedComponentIds: patch.addComponents.map(component => component.instanceId),
    components: designStore.components,
    connections: designStore.connections,
  });
  designStore.commitTopologyPatch(resolvedPatch, {
    beginnerDemoPractice: true,
  });
  interactionStore.setHoveredGrowthCandidate(null);
  if (resolvedPatch.selectInstanceId) {
    interactionStore.selectComponents([resolvedPatch.selectInstanceId]);
  }
  if (resolvedPatch.nextEndpoint) {
    interactionStore.selectGrowthEndpoint(resolvedPatch.nextEndpoint);
  } else {
    interactionStore.clearGrowthEndpoint();
  }
  interactionStore.setDragSnapTarget(null);
  return true;
};

export const commitActiveBuildTask = (): boolean => {
  const interactionStore = useInteractionStore.getState();
  const designStore = useDesignStore.getState();
  const task = interactionStore.interaction.activeBuildTask;
  if (!task) return commitActivePlacement();

  if (task.id === 'base-frame') {
    const candidates = constructionWizardSystem.generateCandidates({
      components: designStore.components,
      connections: designStore.connections,
      wizard: designStore.constructionWizard,
    });
    const candidate = candidates.find(
      item => item.id === designStore.constructionWizard.selectedCandidateId
    ) ?? candidates[0];
    if (!candidate) return false;
    designStore.commitConstructionWizardCandidate(candidate);
    const updatedDesign = useDesignStore.getState();
    const progress = constructionWizardSystem.evaluateProgress({
      components: updatedDesign.components,
      connections: updatedDesign.connections,
      wizard: updatedDesign.constructionWizard,
    });
    if (progress.isComplete) {
      updatedDesign.stopConstructionWizard();
      interactionStore.finishBuildTask();
    }
    return true;
  }

  if (task.id === 'extend' || task.id === 'diagonal-brace') {
    const growthState = interactionStore.interaction.growthState;
    const selectedEndpoint = growthState.selectedEndpoint;
    if (!selectedEndpoint) return false;
    const site = endpointGrowthSystem.listPredictionSites({
      pipeComponentId: growthState.pipeComponentId,
      family: task.id === 'extend' ? 'straight' : 'diagonal',
      components: designStore.components,
      connections: designStore.connections,
    }).find(candidate => predictionSiteMatchesSelection(candidate, selectedEndpoint));
    if (!site) return false;
    const candidates = endpointGrowthSystem.generateCandidates({
      site,
      pipeComponentId: growthState.pipeComponentId,
      family: task.id === 'extend' ? 'straight' : 'diagonal',
      components: designStore.components,
      connections: designStore.connections,
    });
    const activeCandidate = candidates.find(
      candidate => candidate.id === growthState.hoveredCandidate?.id
    ) ?? candidates[0];
    if (!activeCandidate) return false;
    const committed = commitActiveGrowthCandidate(activeCandidate.id);
    if (committed) {
      interactionStore.finishBuildTask();
      interactionStore.clearGrowthEndpoint();
      interactionStore.setGrowthCandidateFamily('straight');
    }
    return committed;
  }

  return commitActivePlacement();
};

export const commitSuggestedComponentMove = (
  instanceId: string,
  suggestion: ConstructionSuggestion
): boolean => {
  const designStore = useDesignStore.getState();
  const movingComponent = designStore.components.find(
    component => component.instanceId === instanceId
  );
  if (!movingComponent) return false;

  const componentUpdate = {
    instanceId,
    updates: {
      position: suggestion.position,
      rotation: suggestion.rotation,
    },
  };
  const projectedComponents = designStore.components.map(component =>
    component.instanceId === instanceId
      ? { ...component, ...componentUpdate.updates }
      : component
  );
  const contactResolution = resolvePlacementContacts({
    components: projectedComponents,
    connections: designStore.connections,
    placementComponentIds: [instanceId],
    idFactory: createCommandId,
  });
  const remainingConnections = designStore.connections.filter(
    connection => !contactResolution.removeConnectionIds.includes(connection.id)
  );

  if (suggestion.topologyTarget && suggestion.sourcePointId) {
    const patch = connectorTopologySystem.createConnectorUpgradePatch({
      connectorInstanceId: suggestion.topologyTarget.connectorInstanceId,
      desiredDirection: suggestion.topologyTarget.direction,
      updatedComponent: componentUpdate,
      sourcePointId: suggestion.sourcePointId,
      components: designStore.components,
      connections: remainingConnections,
      idFactory: createCommandId,
      selectInstanceId: instanceId,
    });
    if (!patch) return false;
    patch.removeConnectionIds.push(...contactResolution.removeConnectionIds);
    patch.addConnections.push(...contactResolution.addConnections);
    designStore.commitTopologyPatch(patch);
    return true;
  }

  if (suggestion.connectorTarget && suggestion.sourcePointId) {
    const patch = createConnectorInsertionPatch({
      suggestion,
      sourceInstanceId: instanceId,
      updatedComponent: componentUpdate,
      removeConnectionIds: contactResolution.removeConnectionIds,
      components: designStore.components,
      connections: remainingConnections,
    });
    if (!patch) return false;
    patch.addConnections.push(...contactResolution.addConnections);
    designStore.commitTopologyPatch(patch);
    return true;
  }

  if (suggestion.target && contactResolution.addConnections.length === 0) {
    return false;
  }
  designStore.commitTopologyPatch({
    addComponents: [],
    updateComponents: [componentUpdate],
    removeComponentIds: [],
    addConnections: contactResolution.addConnections,
    updateConnections: [],
    removeConnectionIds: contactResolution.removeConnectionIds,
    selectInstanceId: instanceId,
  });
  return true;
};

export const commitBoardMountMove = (
  instanceId: string,
  siteId: string
): boolean => {
  const designStore = useDesignStore.getState();
  const component = designStore.components.find(item => item.instanceId === instanceId);
  if (!component || !isBoardComponentId(component.componentId)) return false;

  const site = listBoardInstallableSites({
      boardComponentId: component.componentId,
      components: designStore.components,
      connections: designStore.connections,
      excludeBoardInstanceId: instanceId,
    })
    .find(item => item.id === siteId);
  if (!site) return false;

  const patch = boardMountSystem.createBoardPlacementPatch({
    site,
    boardInstanceId: instanceId,
    components: designStore.components,
    connections: designStore.connections,
    idFactory: createCommandId,
  });
  if (!patch) return false;
  designStore.commitTopologyPatch(patch);
  return true;
};

export const commitBoardMountPlacement = (
  boardComponentId: BoardComponentId,
  siteId: string
): boolean => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const site = listBoardInstallableSites({
    boardComponentId,
    components: designStore.components,
    connections: designStore.connections,
  }).find(item => item.id === siteId);
  if (!site) return false;

  const instanceId = createPlacementInstanceId();
  const patch = boardMountSystem.createBoardPlacementPatch({
    site,
    boardInstanceId: instanceId,
    components: designStore.components,
    connections: designStore.connections,
    idFactory: createCommandId,
  });
  if (!patch) return false;

  designStore.commitTopologyPatch(patch);
  interactionStore.cancelPlace();
  interactionStore.setMode('select');
  interactionStore.setActiveTool('select');
  interactionStore.selectComponents([instanceId]);
  return true;
};

export const commitCurvedTubeMountMove = (
  instanceId: string,
  siteId: string
): boolean => {
  const designStore = useDesignStore.getState();
  const component = designStore.components.find(item => item.instanceId === instanceId);
  if (!component || component.componentId !== U_CURVED_TUBE_COMPONENT_ID) return false;

  const site = curvedTubeMountSystem
    .listCurvedTubeMountSites({
      components: designStore.components,
      connections: designStore.connections,
      excludeInstanceId: instanceId,
    })
    .find(item => item.id === siteId);
  if (!site) return false;

  const patch = curvedTubeMountSystem.createCurvedTubePlacementPatch({
    site,
    instanceId,
    components: designStore.components,
    connections: designStore.connections,
    idFactory: createCommandId,
  });
  if (!patch) return false;
  designStore.commitTopologyPatch(patch);
  return true;
};

export const commitRampMountMove = (
  instanceId: string,
  siteId: string
): boolean => {
  const designStore = useDesignStore.getState();
  const component = designStore.components.find(item => item.instanceId === instanceId);
  if (!component || !rampMountSystem.isRampComponentId(component.componentId)) return false;
  const site = rampMountSystem.listRampMountSites({
    componentId: component.componentId as RampComponentId,
    components: designStore.components,
    connections: designStore.connections,
    excludeInstanceId: instanceId,
  }).find(item => item.id === siteId);
  if (!site) return false;
  const patch = rampMountSystem.createRampPlacementPatch({
    site,
    instanceId,
    components: designStore.components,
    connections: designStore.connections,
    idFactory: createCommandId,
  });
  if (!patch) return false;
  designStore.commitTopologyPatch(patch);
  return true;
};

export const commitRampMountPlacement = (
  componentId: RampComponentId,
  siteId: string
): boolean => {
  const designStore = useDesignStore.getState();
  const interactionStore = useInteractionStore.getState();
  const site = rampMountSystem.listRampMountSites({
    componentId,
    components: designStore.components,
    connections: designStore.connections,
  }).find(item => item.id === siteId);
  if (!site) return false;
  const instanceId = createPlacementInstanceId();
  const patch = rampMountSystem.createRampPlacementPatch({
    site,
    instanceId,
    components: designStore.components,
    connections: designStore.connections,
    idFactory: createCommandId,
  });
  if (!patch) return false;
  designStore.commitTopologyPatch(patch);
  interactionStore.cancelPlace();
  interactionStore.setMode('select');
  interactionStore.setActiveTool('select');
  interactionStore.selectComponents([instanceId]);
  return true;
};
