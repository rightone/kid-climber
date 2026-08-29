import React, {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';
import { getComponentById } from '../../../stores/componentLibrary';
import { createComponentGeometry } from '../utils/geometryUtils';
import {
  constructionEngine,
  getWorldPosition,
  type ConstructionSuggestion,
} from '../../../systems/ConstructionEngine';
import {
  commitActiveGrowthCandidate,
  commitActivePlacement,
  commitBoardMountPlacement,
  commitBoardMountMove,
  commitCurvedTubeMountMove,
  commitRampMountMove,
  commitRampMountPlacement,
  commitSuggestedComponentMove,
  selectActiveBuildTaskSite,
} from '../../../systems/EditorInteractionCommands';
import {
  boardMountSystem,
  type BoardMountSite,
} from '../../../systems/BoardMountSystem';
import {
  curvedTubeMountSystem,
  type CurvedTubeMountSite,
  U_CURVED_TUBE_COMPONENT_ID,
} from '../../../systems/CurvedTubeMountSystem';
import {
  rampMountSystem,
  type RampMountSite,
} from '../../../systems/RampMountSystem';
import { structureMountSystem } from '../../../systems/StructureMountSystem';
import {
  normalizeComponentColorForRender,
} from '../../../systems/PipeColorSystem';
import {
  transformTemplateComponents,
} from '../../../utils/templateUtils';
import { COMPONENT_COLORS, type ComponentInstance } from '../../../types';
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../../../referenceProductSpec';
import {
  endpointGrowthSystem,
  growthSelectionFromSite,
  predictionSiteKey,
  predictionSiteMatchesSelection,
  type GrowthCandidate,
  type GrowthSiteSelection,
  type PredictionSiteRef,
} from '../../../systems/EndpointGrowthSystem';
import {
  classifySceneInteractionTarget,
  GROWTH_HANDLE_USER_DATA,
  type SceneInteractionTarget,
} from '../../../systems/SceneInteractionTarget';
import { SpaceGuideSystem } from './SpaceGuideSystem';
import { assemblySelectionSystem } from '../../../systems/AssemblySelectionSystem';

interface GroundPlaneProps {
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: (event: ThreeEvent<PointerEvent>) => void;
}

// R3F 场景交互面：空白区域和拖拽都通过这一条 pointer 管线
const GroundPlane: React.FC<GroundPlaneProps> = ({
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}) => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.1, 0]}
      receiveShadow
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

// 组件库中的板件使用原生 HTML 拖拽；这里把 dragover 坐标转换回 3D 地面坐标，
// 并复用与点击放置完全相同的四角安装位算法。
const NativeBoardLibraryDragBridge: React.FC = () => {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    const updatePreview = (event: DragEvent) => {
      const interactionStore = useInteractionStore.getState();
      const currentInteraction = interactionStore.interaction;
      const componentId = currentInteraction.placeState.componentId;
      if (
        currentInteraction.mode !== 'place' ||
        !componentId ||
        (!boardMountSystem.isBoardComponentId(componentId) &&
          !rampMountSystem.isRampComponentId(componentId))
      ) {
        return false;
      }

      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, intersection)) {
        return false;
      }

      const designStore = useDesignStore.getState();
      const rayOrigin: [number, number, number] = [
        raycaster.ray.origin.x,
        raycaster.ray.origin.y,
        raycaster.ray.origin.z,
      ];
      const rayDirection: [number, number, number] = [
        raycaster.ray.direction.x,
        raycaster.ray.direction.y,
        raycaster.ray.direction.z,
      ];
      const boardSite = boardMountSystem.isBoardComponentId(componentId)
        ? boardMountSystem.findNearestBoardMountSiteByRay({
            boardComponentId: componentId,
            rayOrigin,
            rayDirection,
            components: designStore.components,
            connections: designStore.connections,
          })
        : null;
      const rampSite = rampMountSystem.isRampComponentId(componentId)
        ? rampMountSystem.findNearestRampMountSiteByRay({
            componentId,
            rayOrigin,
            rayDirection,
            components: designStore.components,
            connections: designStore.connections,
          })
        : null;
      const site = boardSite ?? rampSite;
      interactionStore.updatePlacePreview({
        position: site?.position ?? [intersection.x, intersection.y, intersection.z],
        rotation: site?.rotation ?? [0, 0, 0],
        isValid: Boolean(site),
        snapType: site ? 'connection' : 'free',
        snapTarget: null,
        topologyTarget: null,
        connectorTarget: null,
        boardMountSite: boardSite,
        rampMountSite: rampSite,
        snapSourcePointId: null,
        snapConfidence: site ? 1 : 0,
        message: site
          ? boardSite
            ? '四角安装位就绪，松开放置板件'
            : '坡板双锚点安装位就绪，松开放置'
          : boardMountSystem.isBoardComponentId(componentId)
            ? '当前框架没有可完整安装该尺寸板件的位置'
            : '需要两个同高、相距40cm且坡板低端可落地的安装点',
      });
      return true;
    };

    const handleDragOver = (event: DragEvent) => {
      if (!updatePreview(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const handleDrop = (event: DragEvent) => {
      if (!updatePreview(event)) return;
      event.preventDefault();
      event.stopPropagation();
      commitActivePlacement();
    };

    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    return () => {
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
    };
  }, [camera, gl]);

  return null;
};

const TemplateGhostComponent: React.FC<{
  component: ComponentInstance;
  opacity?: number;
  interactive?: boolean;
  highlighted?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}> = ({ component, opacity = 0.3, interactive = false, highlighted = false, onClick }) => {
  const definition = useMemo(
    () => getComponentById(component.componentId),
    [component.componentId]
  );
  const geometry = useMemo(
    () =>
      definition
        ? createComponentGeometry(component.componentId, definition, component)
        : new THREE.BoxGeometry(6, 6, 6),
    [component, definition]
  );
  const normalizedColor = normalizeComponentColorForRender(
    component.componentId,
    component.color
  );
  const color = normalizedColor
    ? COMPONENT_COLORS[normalizedColor].hex
    : component.componentId.startsWith('connector_')
      ? COMPONENT_COLORS.black.hex
    : component.componentId.startsWith('board_')
        ? COMPONENT_COLORS.green.hex
        : COMPONENT_COLORS.blue.hex;

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={component.position}
      rotation={[
        THREE.MathUtils.degToRad(component.rotation[0]),
        THREE.MathUtils.degToRad(component.rotation[1]),
        THREE.MathUtils.degToRad(component.rotation[2]),
      ]}
      raycast={interactive ? undefined : () => null}
      onClick={onClick}
      renderOrder={14}
    >
      <meshStandardMaterial
        color={highlighted ? '#22c55e' : color}
        transparent
        opacity={opacity}
        wireframe={highlighted}
        metalness={0}
          roughness={REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness}
        depthWrite={false}
      />
    </mesh>
  );
};

const TemplatePlacementGhost: React.FC = () => {
  const templatePlacement = useInteractionStore(
    state => state.interaction.templatePlacement
  );
  const components = useMemo(
    () =>
      templatePlacement
        ? transformTemplateComponents({
            components: templatePlacement.components,
            origin: templatePlacement.origin,
            rotationY: templatePlacement.rotationY,
          })
        : [],
    [templatePlacement]
  );

  if (!templatePlacement || templatePlacement.structureRecipe) return null;
  return (
    <group>
      {components.map(component => (
        <TemplateGhostComponent
          key={component.instanceId}
          component={component}
        />
      ))}
    </group>
  );
};

const transformStructurePreview = (
  components: ComponentInstance[],
  position: [number, number, number],
  rotation: [number, number, number]
) => {
  const parentQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
    'XYZ'
  ));
  return components.map(component => {
    const localQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(component.rotation[0]),
      THREE.MathUtils.degToRad(component.rotation[1]),
      THREE.MathUtils.degToRad(component.rotation[2]),
      'XYZ'
    ));
    const worldPosition = new THREE.Vector3(...component.position)
      .applyQuaternion(parentQuaternion)
      .add(new THREE.Vector3(...position));
    const worldEuler = new THREE.Euler().setFromQuaternion(
      parentQuaternion.clone().multiply(localQuaternion),
      'XYZ'
    );
    return {
      ...component,
      position: worldPosition.toArray() as [number, number, number],
      rotation: [
        THREE.MathUtils.radToDeg(worldEuler.x),
        THREE.MathUtils.radToDeg(worldEuler.y),
        THREE.MathUtils.radToDeg(worldEuler.z),
      ] as [number, number, number],
    };
  });
};

const StructureMountSiteGhosts: React.FC = () => {
  const { components, connections } = useDesignStore();
  const templatePlacement = useInteractionStore(
    state => state.interaction.templatePlacement
  );
  const setTemplateStructureMountSite = useInteractionStore(
    state => state.setTemplateStructureMountSite
  );
  const activeBuildTask = useInteractionStore(state => state.interaction.activeBuildTask);
  const recipe = templatePlacement?.structureRecipe;
  const replacementComponentIds = templatePlacement?.replaceAssembly?.componentIds;
  const replacementConnectionIds = templatePlacement?.replaceAssembly?.connectionIds;
  const sites = useMemo(() => {
    if (!recipe) return [];
    const removedComponents = new Set(replacementComponentIds ?? []);
    const removedConnections = new Set(replacementConnectionIds ?? []);
    const validationComponents = removedComponents.size > 0
      ? components.filter(component => !removedComponents.has(component.instanceId))
      : components;
    const validationConnections = removedConnections.size > 0
      ? connections.filter(connection => !removedConnections.has(connection.id))
      : connections;
    return validationComponents.length === 0
      ? [structureMountSystem.createGroundRecipeMountSite({ recipe })]
      : structureMountSystem.listRecipeMountSites({
          recipe,
          components: validationComponents,
          connections: validationConnections,
        });
  }, [components, connections, recipe, replacementComponentIds, replacementConnectionIds]);
  if (!recipe) return null;

  return (
    <group>
      {sites.map(site => {
        const active = site.id === templatePlacement?.structureMountSite?.id;
        const previewComponents = transformStructurePreview(
          recipe.components,
          site.position,
          site.rotation
        );
        const handleClick = (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          if (activeBuildTask?.id === 'a-frame') {
            selectActiveBuildTaskSite(site.id);
            return;
          }
          setTemplateStructureMountSite(site);
          commitActivePlacement();
        };
        return (
          <group key={site.id}>
            {previewComponents.map(component => (
              <TemplateGhostComponent
                key={`${site.id}:${component.instanceId}`}
                component={component}
                opacity={active ? 0.55 : 0.18}
                highlighted={active}
                interactive
                onClick={handleClick}
              />
            ))}
            {site.anchors.map(anchor => (
              <mesh
                key={`${site.id}:${anchor.mountPortId}`}
                position={anchor.position}
                raycast={() => null}
                renderOrder={15}
              >
                <sphereGeometry args={[1.8, 14, 14]} />
                <meshBasicMaterial
                color={active ? '#f59e0b' : '#38bdf8'}
                  transparent
                  opacity={0.9}
                  depthWrite={false}
                  depthTest={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

// 放置预览
const PlacePreview: React.FC = () => {
  const { interaction } = useInteractionStore();
  const { placeState, showPreview } = interaction;
  
  const definition = useMemo(() => {
    if (!placeState.componentId) return null;
    return getComponentById(placeState.componentId);
  }, [placeState.componentId]);
  
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(placeState.componentId!, definition);
  }, [placeState.componentId, definition]);
  
  if (!showPreview || !placeState.previewPosition || !definition) {
    return null;
  }
  
  const [x, y, z] = placeState.previewPosition;
  const [rx, ry, rz] = placeState.previewRotation;
  const previewColor = placeState.snapType === 'connection'
    ? '#10b981'
    : placeState.snapType === 'alignment'
      ? '#1890ff'
      : placeState.isValid
        ? '#faad14'
        : '#ef4444';
  
  return (
    <group position={[x, y, z]} rotation={[THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz)]}>
      {/* 预览组件 */}
      <mesh geometry={geometry} raycast={() => null}>
        <meshStandardMaterial
          color={previewColor}
          transparent
          opacity={0.6}
          wireframe
        />
      </mesh>
      
      {/* 放置点指示器 */}
      <mesh position={[0, -0.5, 0]} raycast={() => null}>
        <cylinderGeometry args={[1, 1, 0.2, 16]} />
        <meshBasicMaterial
          color={previewColor}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* 连接点指示 */}
      {definition.connectionPoints
        .filter(point => point.role !== 'board-mount')
        .map((point, index) => (
        <group key={index} position={point.position}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial
              color={point.id === placeState.snapSourcePointId ? '#10b981' : '#3b82f6'}
              transparent
              opacity={point.id === placeState.snapSourcePointId ? 0.95 : 0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const PlaceConnectorPreview: React.FC = () => {
  const { interaction } = useInteractionStore();
  const components = useDesignStore(state => state.components);
  const connectorTarget =
    interaction.placeState.connectorTarget ??
    interaction.dragState.connectorTarget;
  const topologyTarget =
    interaction.placeState.topologyTarget ??
    interaction.dragState.topologyTarget;
  const existingConnector = topologyTarget
    ? components.find(
        component =>
          component.instanceId === topologyTarget.connectorInstanceId
      )
    : undefined;
  const componentId =
    connectorTarget?.connectorComponentId ??
    topologyTarget?.replacement.connectorComponentId;
  const position =
    connectorTarget?.connectorPosition ?? existingConnector?.position;
  const rotation =
    connectorTarget?.connectorRotation ??
    topologyTarget?.replacement.rotation;
  const definition = useMemo(
    () => (componentId ? getComponentById(componentId) : undefined),
    [componentId]
  );
  const geometry = useMemo(
    () =>
      definition && componentId
        ? createComponentGeometry(componentId, definition)
        : null,
    [componentId, definition]
  );

  if (!geometry || !position || !rotation) return null;

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation.map(THREE.MathUtils.degToRad) as [number, number, number]}
      raycast={() => null}
      renderOrder={8}
    >
      <meshStandardMaterial
        color="#10b981"
        transparent
        opacity={0.5}
        wireframe
        depthWrite={false}
      />
    </mesh>
  );
};

const BoardMountSiteGhosts: React.FC = () => {
  const { components, connections } = useDesignStore();
  const { interaction } = useInteractionStore();
  const placingComponentId = interaction.placeState.componentId;
  const draggedComponent = interaction.dragTarget
    ? components.find(component => component.instanceId === interaction.dragTarget)
    : null;
  const boardComponentId = placingComponentId && boardMountSystem.isBoardComponentId(placingComponentId)
    ? placingComponentId
    : draggedComponent && boardMountSystem.isBoardComponentId(draggedComponent.componentId)
      ? draggedComponent.componentId
      : null;

  const sites = useMemo(
    () => {
      if (!boardComponentId) return [];
      const scan = boardMountSystem.scanBoardMountSites({
            boardComponentId,
            components,
            connections,
            excludeBoardInstanceId: draggedComponent?.instanceId,
          });
      return [...scan.validSites, ...scan.repairableSites];
    },
    [boardComponentId, components, connections, draggedComponent?.instanceId]
  );

  if (!boardComponentId || sites.length === 0) return null;

  const activePosition =
    interaction.placeState.previewPosition ??
    interaction.dragState.snappedPosition;

  return (
    <group>
      {sites.map(site => {
        const active = activePosition
          ? site.position.every((coordinate, index) => Math.abs(coordinate - activePosition[index]) <= 0.6)
          : false;
        return (
          <group key={site.id}>
            <mesh
              position={site.bounds.center}
              rotation={[
                THREE.MathUtils.degToRad(site.rotation[0]),
                THREE.MathUtils.degToRad(site.rotation[1]),
                THREE.MathUtils.degToRad(site.rotation[2]),
              ]}
              renderOrder={12}
              onClick={(event) => {
                event.stopPropagation();
                if (interaction.isDragging && draggedComponent) {
                  commitBoardMountMove(draggedComponent.instanceId, site.id);
                  return;
                }
                if (interaction.activeBuildTask?.id === 'platform') {
                  selectActiveBuildTaskSite(site.id);
                  return;
                }
                commitBoardMountPlacement(boardComponentId, site.id);
              }}
            >
              <boxGeometry args={site.bounds.size} />
              <meshBasicMaterial
                color={
                  active
                    ? '#22c55e'
                    : site.repairConnections?.length
                      ? '#f59e0b'
                      : '#38bdf8'
                }
                transparent
                opacity={active ? 0.55 : 0.16}
                depthWrite={false}
              />
            </mesh>
            {site.corners.map(corner => {
              return (
                <mesh
                  key={`${site.id}:${corner.boardPointId}`}
                  position={corner.position}
                  raycast={() => null}
                  renderOrder={13}
                >
                  <sphereGeometry args={[1.5, 12, 12]} />
                  <meshBasicMaterial
                    color={
                      active
                        ? '#f59e0b'
                        : site.repairConnections?.length
                          ? '#d97706'
                          : '#0ea5e9'
                    }
                    transparent
                    opacity={0.8}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

const CurvedTubeMountSiteGhosts: React.FC = () => {
  const { components, connections } = useDesignStore();
  const { interaction } = useInteractionStore();
  const placingCurve = interaction.placeState.componentId === U_CURVED_TUBE_COMPONENT_ID;
  const draggedComponent = interaction.dragTarget
    ? components.find(component => component.instanceId === interaction.dragTarget)
    : null;
  const draggingCurve = draggedComponent?.componentId === U_CURVED_TUBE_COMPONENT_ID;

  const sites = useMemo(
    () =>
      placingCurve || draggingCurve
        ? curvedTubeMountSystem.listCurvedTubeMountSites({
            components,
            connections,
            excludeInstanceId: draggingCurve ? draggedComponent?.instanceId : undefined,
          }).filter(site =>
            !placingCurve || site.flip === interaction.placeState.curvedTubeFlip
          )
        : [],
    [
      components,
      connections,
      draggedComponent?.instanceId,
      draggingCurve,
      placingCurve,
      interaction.placeState.curvedTubeFlip,
    ]
  );
  const definition = useMemo(
    () => getComponentById(U_CURVED_TUBE_COMPONENT_ID),
    []
  );
  const geometry = useMemo(
    () =>
      definition
        ? createComponentGeometry(U_CURVED_TUBE_COMPONENT_ID, definition)
        : null,
    [definition]
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if ((!placingCurve && !draggingCurve) || !geometry || sites.length === 0) {
    return null;
  }

  const activeSiteId =
    interaction.placeState.curvedTubeMountSite?.id ??
    interaction.dragState.curvedTubeMountSite?.id ??
    null;

  return (
    <group>
      {sites.map(site => {
        const active = site.id === activeSiteId;
        return (
          <group key={site.id}>
            <mesh
              geometry={geometry}
              position={site.position}
              rotation={[
                THREE.MathUtils.degToRad(site.rotation[0]),
                THREE.MathUtils.degToRad(site.rotation[1]),
                THREE.MathUtils.degToRad(site.rotation[2]),
              ]}
              raycast={interaction.activeBuildTask?.id === 'u-arch' ? undefined : () => null}
              onClick={(event) => {
                if (interaction.activeBuildTask?.id !== 'u-arch') return;
                event.stopPropagation();
                selectActiveBuildTaskSite(site.id);
              }}
              renderOrder={12}
            >
              <meshStandardMaterial
                color={active ? '#22c55e' : '#38bdf8'}
                transparent
                opacity={active ? 0.55 : 0.16}
                wireframe
                depthWrite={false}
              />
            </mesh>
            {site.endpoints.map(endpoint => (
              <mesh
                key={`${site.id}:${endpoint.curvePointId}`}
                position={endpoint.position}
                raycast={() => null}
                renderOrder={13}
              >
                <sphereGeometry args={[1.6, 12, 12]} />
                <meshBasicMaterial
                  color={active ? '#f59e0b' : '#0ea5e9'}
                  transparent
                  opacity={0.82}
                  depthWrite={false}
                  depthTest={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

const RampMountSiteGhosts: React.FC = () => {
  const { components, connections } = useDesignStore();
  const { interaction } = useInteractionStore();
  const placingId = interaction.placeState.componentId;
  const draggedComponent = interaction.dragTarget
    ? components.find(component => component.instanceId === interaction.dragTarget)
    : null;
  const rampComponentId = placingId && rampMountSystem.isRampComponentId(placingId)
    ? placingId
    : draggedComponent && rampMountSystem.isRampComponentId(draggedComponent.componentId)
      ? draggedComponent.componentId
      : null;
  const sites = useMemo(
    () => rampComponentId
      ? rampMountSystem.listRampMountSites({
          componentId: rampComponentId,
          components,
          connections,
          excludeInstanceId: draggedComponent?.instanceId,
        })
      : [],
    [components, connections, draggedComponent?.instanceId, rampComponentId]
  );
  const definition = useMemo(
    () => rampComponentId ? getComponentById(rampComponentId) : undefined,
    [rampComponentId]
  );
  const geometry = useMemo(
    () => rampComponentId && definition
      ? createComponentGeometry(rampComponentId, definition)
      : null,
    [definition, rampComponentId]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!rampComponentId || !geometry) return null;
  const activeSiteId = interaction.placeState.rampMountSite?.id
    ?? interaction.dragState.rampMountSite?.id;

  return (
    <group>
      {sites.map(site => {
        const active = site.id === activeSiteId;
        return (
          <group key={site.id}>
            <mesh
              geometry={geometry}
              position={site.position}
              rotation={site.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]}
              renderOrder={12}
              onClick={(event) => {
                event.stopPropagation();
                if (draggedComponent) {
                  commitRampMountMove(draggedComponent.instanceId, site.id);
                } else if (interaction.activeBuildTask?.id === 'ramp') {
                  selectActiveBuildTaskSite(site.id);
                } else {
                  commitRampMountPlacement(rampComponentId, site.id);
                }
              }}
            >
              <meshStandardMaterial
                color={active ? '#22c55e' : '#38bdf8'}
                transparent
                opacity={active ? 0.55 : 0.17}
                wireframe
                depthWrite={false}
              />
            </mesh>
            {site.endpoints.map(endpoint => (
              <mesh
                key={`${site.id}:${endpoint.rampPointId}`}
                position={endpoint.position}
                raycast={() => null}
                renderOrder={13}
              >
                <sphereGeometry args={[1.6, 12, 12]} />
                <meshBasicMaterial
                  color={active ? '#f59e0b' : '#0ea5e9'}
                  transparent
                  opacity={0.82}
                  depthWrite={false}
                  depthTest={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

// 当前吸附目标提示
const SnapTargetIndicator: React.FC = () => {
  const { interaction } = useInteractionStore();
  const { placeState } = interaction;

  if (
    (
      !placeState.snapTarget &&
      !placeState.topologyTarget &&
      !placeState.connectorTarget
    ) ||
    !placeState.previewPosition ||
    placeState.snapType !== 'connection'
  ) {
    return null;
  }

  const target =
    placeState.snapTarget?.position ??
    placeState.topologyTarget?.position ??
    placeState.connectorTarget!.target.position;
  const sourcePosition = (() => {
    if (!placeState.componentId || !placeState.snapSourcePointId) return placeState.previewPosition;
    const definition = getComponentById(placeState.componentId);
    const sourcePoint = definition?.connectionPoints.find(point => point.id === placeState.snapSourcePointId);
    if (!sourcePoint) return placeState.previewPosition;
    return getWorldPosition(placeState.previewPosition, placeState.previewRotation, sourcePoint.position);
  })();
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...sourcePosition),
    new THREE.Vector3(...target),
  ]);

  return (
    <group>
      <mesh position={target} raycast={() => null}>
        <sphereGeometry args={[2.2, 16, 16]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.85} />
      </mesh>
      <primitive
        object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#10b981' }))}
        raycast={() => null}
      />
    </group>
  );
};

const GrowthPreviewPart: React.FC<{
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  opacity: number;
  onCommit: (candidate: GrowthCandidate, event: ThreeEvent<MouseEvent>) => void;
  onHover: (
    candidate: GrowthCandidate | null,
    event?: ThreeEvent<PointerEvent>
  ) => void;
  candidate: GrowthCandidate;
}> = React.memo(({
  componentId,
  position,
  rotation,
  color,
  opacity,
  onCommit,
  onHover,
  candidate,
}) => {
  const definition = useMemo(() => getComponentById(componentId), [componentId]);
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(componentId, definition);
  }, [componentId, definition]);
  const rotationRadians = useMemo(
    () =>
      rotation.map(THREE.MathUtils.degToRad) as [
        number,
        number,
        number,
      ],
    [rotation]
  );

  return (
    <group position={position} rotation={rotationRadians}>
      <mesh
        geometry={geometry}
        userData={GROWTH_HANDLE_USER_DATA}
        onClick={(event) => onCommit(candidate, event)}
        onPointerOver={(event) => onHover(candidate, event)}
        onPointerOut={(event) => onHover(null, event)}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness}
          metalness={REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

GrowthPreviewPart.displayName = 'GrowthPreviewPart';

const GrowthCandidateGhost: React.FC<{
  candidate: GrowthCandidate;
  hoveredCandidateId: string | null;
  onCommit: (candidate: GrowthCandidate, event: ThreeEvent<MouseEvent>) => void;
  onHover: (
    candidate: GrowthCandidate | null,
    event?: ThreeEvent<PointerEvent>
  ) => void;
}> = ({ candidate, hoveredCandidateId, onCommit, onHover }) => {
  const color =
    candidate.pipeComponentId === 'pipe_35cm'
      ? COMPONENT_COLORS.green.hex
      : candidate.pipeComponentId === 'pipe_25cm'
        ? COMPONENT_COLORS.blue.hex
        : '#f59e0b';
  const isHovered = hoveredCandidateId === candidate.id;
  const isDimmed = hoveredCandidateId !== null && !isHovered;
  const opacity = isHovered ? 0.55 : isDimmed ? 0.1 : 0.22;

  return (
    <group userData={GROWTH_HANDLE_USER_DATA}>
      {(candidate.kind === 'connector-pipe' ||
        (candidate.kind === 'bridge-existing-site' && candidate.connector)) ? (
        <GrowthPreviewPart
          componentId={candidate.connector!.componentId}
          position={candidate.connector!.position}
          rotation={candidate.connector!.rotation}
          color={color}
          opacity={opacity}
          onCommit={onCommit}
          onHover={onHover}
          candidate={candidate}
        />
      ) : null}

      {candidate.kind === 'bridge-existing-site' && candidate.targetConnector ? (
        <GrowthPreviewPart
          componentId={candidate.targetConnector.componentId}
          position={candidate.targetConnector.position}
          rotation={candidate.targetConnector.rotation}
          color={color}
          opacity={opacity}
          onCommit={onCommit}
          onHover={onHover}
          candidate={candidate}
        />
      ) : null}

      {candidate.kind === 'upgrade-connector-pipe' && isHovered ? (
        <GrowthPreviewPart
          componentId={candidate.upgrade.replacementConnectorComponentId}
          position={candidate.upgrade.replacementPosition}
          rotation={candidate.upgrade.replacementRotation}
          color={color}
          opacity={0.62}
          onCommit={onCommit}
          onHover={onHover}
          candidate={candidate}
        />
      ) : null}

      <GrowthPreviewPart
        componentId={candidate.pipeComponentId}
        position={candidate.pipePosition}
        rotation={candidate.pipeRotation}
        color={color}
        opacity={opacity}
        onCommit={onCommit}
        onHover={onHover}
        candidate={candidate}
      />

      <mesh
        position={candidate.previewBounds.center}
        onClick={(event) => onCommit(candidate, event)}
        onPointerOver={(event) => onHover(candidate, event)}
        onPointerOut={(event) => onHover(null, event)}
        userData={GROWTH_HANDLE_USER_DATA}
      >
        <boxGeometry args={candidate.previewBounds.size} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {isHovered ? (
        <Html
          position={[
            candidate.handlePosition[0],
            candidate.handlePosition[1] + 4,
            candidate.handlePosition[2],
          ]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#fff',
            padding: '5px 8px',
            borderRadius: 7,
            fontSize: 12,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.22)',
          }}
        >
          <strong>
            {candidate.label} · {candidate.referenceSpan}格
          </strong>
          <br />
          {candidate.message.replace('将添加：', '')}
        </Html>
      ) : null}
    </group>
  );
};

const GrowthEndpointHandles: React.FC<{
  endpoints: PredictionSiteRef[];
  activeEndpoint: GrowthSiteSelection | null;
  onPointerActivate: (
    endpoint: PredictionSiteRef,
    event: ThreeEvent<PointerEvent>
  ) => void;
  onClickActivate: (
    endpoint: PredictionSiteRef,
    event: ThreeEvent<MouseEvent>
  ) => void;
}> = ({
  endpoints,
  activeEndpoint,
  onPointerActivate,
  onClickActivate,
}) => {
  const visibleMeshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const activeColor = useMemo(() => new THREE.Color('#f59e0b'), []);
  const availableColor = useMemo(() => new THREE.Color('#2563eb'), []);

  useLayoutEffect(() => {
    const visibleMesh = visibleMeshRef.current;
    const hitMesh = hitMeshRef.current;
    if (!visibleMesh || !hitMesh) return;

    endpoints.forEach((endpoint, index) => {
      const active = activeEndpoint
        ? predictionSiteMatchesSelection(endpoint, activeEndpoint)
        : false;

      transform.position.set(...endpoint.position);
      transform.rotation.set(0, 0, 0);
      transform.scale.setScalar(active ? 2.8 : 2.1);
      transform.updateMatrix();
      visibleMesh.setMatrixAt(index, transform.matrix);
      visibleMesh.setColorAt(index, active ? activeColor : availableColor);

      transform.scale.setScalar(active ? 7.2 : 6.2);
      transform.updateMatrix();
      hitMesh.setMatrixAt(index, transform.matrix);
    });

    visibleMesh.instanceMatrix.needsUpdate = true;
    if (visibleMesh.instanceColor) {
      visibleMesh.instanceColor.needsUpdate = true;
    }
    hitMesh.instanceMatrix.needsUpdate = true;
    visibleMesh.computeBoundingSphere();
    hitMesh.computeBoundingSphere();
  }, [activeColor, activeEndpoint, availableColor, endpoints, transform]);

  const getEndpoint = (instanceId: number | undefined) =>
    instanceId === undefined ? undefined : endpoints[instanceId];

  return (
    <>
      <instancedMesh
        ref={visibleMeshRef}
        args={[undefined, undefined, endpoints.length]}
        raycast={() => null}
        userData={GROWTH_HANDLE_USER_DATA}
        renderOrder={20}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          transparent
          opacity={0.82}
          depthWrite={false}
          depthTest={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={hitMeshRef}
        args={[undefined, undefined, endpoints.length]}
        onPointerOver={event => {
          const endpoint = getEndpoint(event.instanceId);
          if (endpoint) onPointerActivate(endpoint, event);
        }}
        onPointerMove={event => {
          const endpoint = getEndpoint(event.instanceId);
          if (endpoint) onPointerActivate(endpoint, event);
        }}
        onClick={event => {
          const endpoint = getEndpoint(event.instanceId);
          if (endpoint) onClickActivate(endpoint, event);
        }}
        userData={GROWTH_HANDLE_USER_DATA}
        renderOrder={21}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </instancedMesh>
    </>
  );
};

// 全场端点生长：所有可用端点显示热点，仅活动端点展开完整候选
const EndpointGrowthControls: React.FC = () => {
  const {
    components,
    connections,
    constructionWizard,
  } = useDesignStore();
  const {
    interaction,
    selectGrowthEndpoint,
    clearGrowthEndpoint,
    setHoveredGrowthCandidate,
  } = useInteractionStore();
  const { growthState } = interaction;

  const predictionVisible =
    interaction.showAvailablePositions &&
    growthState.candidateFamily !== 'structure' &&
    !interaction.isDragging &&
    !constructionWizard.active &&
    (interaction.mode === 'select' || interaction.mode === 'connect');
  const availableEndpoints = useMemo(
    () =>
      predictionVisible
        ? endpointGrowthSystem.listPredictionSites({
            components,
            connections,
            pipeComponentId: growthState.pipeComponentId,
            family: growthState.candidateFamily === 'structure'
              ? 'straight'
              : growthState.candidateFamily,
          })
        : [],
    [
      components,
      connections,
      growthState.pipeComponentId,
      growthState.candidateFamily,
      predictionVisible,
    ]
  );
  const selectedEndpoint = growthState.selectedEndpoint;
  const selectedSite = useMemo(
    () =>
      selectedEndpoint
        ? availableEndpoints.find(
            site =>
              predictionSiteMatchesSelection(site, selectedEndpoint)
          )
        : undefined,
    [availableEndpoints, selectedEndpoint]
  );
  const candidates = useMemo(() => {
    if (!selectedSite) return [];

    return endpointGrowthSystem.generateCandidates({
      site: selectedSite,
      pipeComponentId: growthState.pipeComponentId,
      family: growthState.candidateFamily === 'structure'
        ? 'straight'
        : growthState.candidateFamily,
      components,
      connections,
    });
  }, [
    components,
    connections,
    growthState.candidateFamily,
    growthState.pipeComponentId,
    selectedSite,
  ]);

  useEffect(() => {
    if (
      predictionVisible &&
      selectedEndpoint &&
      !selectedSite
    ) {
      clearGrowthEndpoint();
    }
  }, [
    clearGrowthEndpoint,
    predictionVisible,
    selectedEndpoint,
    selectedSite,
  ]);

  useEffect(() => {
    const hoveredCandidateId = growthState.hoveredCandidate?.id;
    if (
      hoveredCandidateId &&
      !candidates.some(candidate => candidate.id === hoveredCandidateId)
    ) {
      setHoveredGrowthCandidate(null);
    }
  }, [
    candidates,
    growthState.hoveredCandidate?.id,
    setHoveredGrowthCandidate,
  ]);

  useEffect(() => {
    const activeTask = interaction.activeBuildTask;
    const firstCandidate = candidates[0];
    if (
      (activeTask?.id === 'extend' || activeTask?.id === 'diagonal-brace') &&
      firstCandidate &&
      !growthState.hoveredCandidate
    ) {
      setHoveredGrowthCandidate({
        id: firstCandidate.id,
        message: firstCandidate.message,
        connectorInstanceId: firstCandidate.kind === 'upgrade-connector-pipe'
          ? firstCandidate.upgrade.connectorInstanceId
          : undefined,
      });
    }
  }, [
    candidates,
    growthState.hoveredCandidate,
    interaction.activeBuildTask,
    setHoveredGrowthCandidate,
  ]);

  if (!predictionVisible) return null;

  const activateEndpoint = (
    endpoint: PredictionSiteRef,
    event: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>
  ) => {
    event.stopPropagation();
    if (
      interaction.activeBuildTask?.id === 'extend' ||
      interaction.activeBuildTask?.id === 'diagonal-brace'
    ) {
      selectActiveBuildTaskSite(predictionSiteKey(endpoint));
      return;
    }
    const currentEndpoint =
      useInteractionStore.getState().interaction.growthState.selectedEndpoint;
    if (
      currentEndpoint &&
      predictionSiteMatchesSelection(endpoint, currentEndpoint)
    ) {
      return;
    }
    selectGrowthEndpoint(growthSelectionFromSite(endpoint));
  };

  const handleCandidateCommit = (candidate: GrowthCandidate, event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (
      interaction.activeBuildTask?.id === 'extend' ||
      interaction.activeBuildTask?.id === 'diagonal-brace'
    ) {
      setHoveredGrowthCandidate({
        id: candidate.id,
        message: candidate.message,
        connectorInstanceId: candidate.kind === 'upgrade-connector-pipe'
          ? candidate.upgrade.connectorInstanceId
          : undefined,
      });
      return;
    }
    commitActiveGrowthCandidate(candidate.id);
  };

  const handleCandidateHover = (
    candidate: GrowthCandidate | null,
    event?: ThreeEvent<PointerEvent>
  ) => {
    event?.stopPropagation();
    setHoveredGrowthCandidate(
      candidate
        ? {
            id: candidate.id,
            message: candidate.message,
            connectorInstanceId:
              candidate.kind === 'upgrade-connector-pipe'
                ? candidate.upgrade.connectorInstanceId
                : undefined,
          }
        : null
    );
  };

  return (
    <group>
      <GrowthEndpointHandles
        endpoints={availableEndpoints}
        activeEndpoint={selectedEndpoint}
        onPointerActivate={activateEndpoint}
        onClickActivate={activateEndpoint}
      />

      {candidates.map(candidate => (
        <GrowthCandidateGhost
          key={candidate.id}
          candidate={candidate}
          hoveredCandidateId={growthState.hoveredCandidate?.id ?? null}
          onCommit={handleCandidateCommit}
          onHover={handleCandidateHover}
        />
      ))}
    </group>
  );
};

const BuildTaskDefaultSiteSelector: React.FC = () => {
  const camera = useThree(state => state.camera);
  const components = useDesignStore(state => state.components);
  const connections = useDesignStore(state => state.connections);
  const task = useInteractionStore(state => state.interaction.activeBuildTask);
  const templatePlacement = useInteractionStore(state => state.interaction.templatePlacement);
  const lastTaskSignature = useRef('');
  const taskSignature = task
    ? `${task.id}:${task.installationSiteIds.join('|')}`
    : '';

  useEffect(() => {
    if (!task || task.installationSiteIds.length < 2) {
      lastTaskSignature.current = '';
      return;
    }
    if (lastTaskSignature.current === taskSignature) return;
    lastTaskSignature.current = taskSignature;
    let sites: Array<{ id: string; position: [number, number, number] }> = [];

    if (task.id === 'extend' || task.id === 'diagonal-brace') {
      sites = endpointGrowthSystem.listPredictionSites({
        components,
        connections,
        pipeComponentId: task.specification.pipeComponentId ?? 'pipe_35cm',
        family: task.id === 'extend' ? 'straight' : 'diagonal',
      }).map(site => ({ id: predictionSiteKey(site), position: site.position }));
    } else if (task.id === 'a-frame' && templatePlacement?.structureRecipe) {
      const removedComponentIds = new Set(templatePlacement.replaceAssembly?.componentIds ?? []);
      const removedConnectionIds = new Set(templatePlacement.replaceAssembly?.connectionIds ?? []);
      const validationComponents = removedComponentIds.size > 0
        ? components.filter(component => !removedComponentIds.has(component.instanceId))
        : components;
      const validationConnections = removedConnectionIds.size > 0
        ? connections.filter(connection => !removedConnectionIds.has(connection.id))
        : connections;
      const mountSites = validationComponents.length === 0
        ? [structureMountSystem.createGroundRecipeMountSite({ recipe: templatePlacement.structureRecipe })]
        : structureMountSystem.listRecipeMountSites({
            recipe: templatePlacement.structureRecipe,
            components: validationComponents,
            connections: validationConnections,
          });
      sites = mountSites.map(site => ({ id: site.id, position: site.position }));
    } else if (task.id === 'platform') {
      const scan = boardMountSystem.scanBoardMountSites({
        boardComponentId: task.specification.boardComponentId ?? 'board_40x40',
        components,
        connections,
      });
      sites = [...scan.validSites, ...scan.repairableSites].map(site => ({
        id: site.id,
        position: site.bounds.center,
      }));
    } else if (task.id === 'u-arch') {
      sites = curvedTubeMountSystem.listCurvedTubeMountSites({ components, connections })
        .filter(site => site.flip === Boolean(task.specification.curvedTubeFlip))
        .map(site => ({ id: site.id, position: site.position }));
    } else if (task.id === 'ramp') {
      sites = rampMountSystem.listRampMountSites({
        componentId: task.specification.rampComponentId ?? 'ramp_45cm',
        components,
        connections,
      }).map(site => ({ id: site.id, position: site.position }));
    }

    const validSiteIds = new Set(task.installationSiteIds);
    const nearest = sites
      .filter(site => validSiteIds.has(site.id))
      .map(site => {
        const projected = new THREE.Vector3(...site.position).project(camera);
        return { id: site.id, distance: projected.x ** 2 + projected.y ** 2 };
      })
      .sort((first, second) => first.distance - second.distance)[0];
    if (nearest) selectActiveBuildTaskSite(nearest.id);
  }, [
    camera,
    components,
    connections,
    task,
    taskSignature,
    templatePlacement?.replaceAssembly?.componentIds,
    templatePlacement?.replaceAssembly?.connectionIds,
    templatePlacement?.structureRecipe,
  ]);

  return null;
};

// 主交互系统
export const InteractionSystem: React.FC = () => {
  const {
    editor,
    commitComponentUpdate,
    components,
    connections,
  } = useDesignStore();
  const {
    interaction,
    updatePlacePreview,
    updateDragPreview,
    startDrag,
    endDrag,
    selectComponent,
    clearSelection,
    clearGrowthEndpoint,
    updateTemplatePlacementOrigin,
  } = useInteractionStore();

  const latestDragSuggestion = useRef<ConstructionSuggestion | null>(null);
  const latestBoardMountSite = useRef<BoardMountSite | null>(null);
  const latestCurvedTubeMountSite = useRef<CurvedTubeMountSite | null>(null);
  const latestRampMountSite = useRef<RampMountSite | null>(null);

  const getPointerPosition = useCallback((event: ThreeEvent<PointerEvent>): THREE.Vector3 | null => {
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    if (event.ray.intersectPlane(groundPlane, intersectPoint)) {
      return intersectPoint;
    }
    return null;
  }, []);

  const findClickedSceneTarget = useCallback((event: ThreeEvent<PointerEvent>): SceneInteractionTarget => {
    for (const intersect of event.intersections) {
      const target = classifySceneInteractionTarget(intersect.object);
      if (target) return target;
    }
    return null;
  }, []);

  const handleGroundClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.button !== 0) return;
    if (useInteractionStore.getState().interaction.activeBuildTask) return;
    commitActivePlacement();
  }, []);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;

    const { mode } = interaction;

    if (mode === 'select' || mode === 'move' || mode === 'rotate') {
      const clickedTarget = findClickedSceneTarget(event);

      if (clickedTarget?.type === 'growth-handle') {
        return;
      }

      const clickedId = clickedTarget?.type === 'component' ? clickedTarget.instanceId : null;

      if (!clickedId) {
        clearSelection();
        clearGrowthEndpoint();
        return;
      }

      if (mode === 'move') {
        const pointerPosition = getPointerPosition(event);
        const component = components.find(item => item.instanceId === clickedId);
        const assembly = component ? assemblySelectionSystem.deriveFromMember({
          instanceId: component.instanceId,
          components,
          connections,
        }) : null;
        if (assembly && assembly.groupId !== interaction.assemblyEditGroupId) {
          clearSelection();
          useInteractionStore.getState().selectComponents(assembly.memberIds);
          return;
        }
        if (pointerPosition && component) {
          clearSelection();
          selectComponent(clickedId);
          const offset: [number, number, number] = [
            pointerPosition.x - component.position[0],
            pointerPosition.y - component.position[1],
            pointerPosition.z - component.position[2],
          ];
          startDrag(clickedId, offset);
          latestDragSuggestion.current = null;
          const pointerTarget = event.nativeEvent.target as Element | null;
          pointerTarget?.setPointerCapture(event.pointerId);
        }
      } else if (mode === 'rotate') {
        const component = components.find(item => item.instanceId === clickedId);
        const assembly = component ? assemblySelectionSystem.deriveFromMember({
          instanceId: component.instanceId,
          components,
          connections,
        }) : null;
        if (assembly && assembly.groupId !== interaction.assemblyEditGroupId) {
          clearSelection();
          useInteractionStore.getState().selectComponents(assembly.memberIds);
          return;
        }
        if (component) {
          clearSelection();
          selectComponent(clickedId);
          commitComponentUpdate(clickedId, {
            rotation: [
              component.rotation[0],
              (component.rotation[1] + 90) % 360,
              component.rotation[2],
            ],
          });
        }
      }
    }
  }, [
    clearGrowthEndpoint,
    clearSelection,
    commitComponentUpdate,
    components,
    connections,
    findClickedSceneTarget,
    getPointerPosition,
    interaction,
    selectComponent,
    startDrag,
  ]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const { mode, isDragging, snapToGrid, snapToComponent } = interaction;
    const pointerPosition = getPointerPosition(event);
    if (!pointerPosition) return;

    if (mode === 'place') {
      if (interaction.templatePlacement) {
        if (interaction.templatePlacement.structureRecipe) return;
        const gridSize = Math.max(1, editor.gridSize);
        updateTemplatePlacementOrigin([
          snapToGrid
            ? Math.round(pointerPosition.x / gridSize) * gridSize
            : pointerPosition.x,
          0,
          snapToGrid
            ? Math.round(pointerPosition.z / gridSize) * gridSize
            : pointerPosition.z,
        ]);
        return;
      }
      const componentId = interaction.placeState.componentId;
      if (!componentId) return;
      if (
        interaction.activeBuildTask &&
        ['platform', 'u-arch', 'ramp'].includes(interaction.activeBuildTask.id)
      ) {
        return;
      }

      if (boardMountSystem.isBoardComponentId(componentId)) {
        const site = boardMountSystem.findNearestBoardMountSiteByRay({
          boardComponentId: componentId,
          rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
          rayDirection: [
            event.ray.direction.x,
            event.ray.direction.y,
            event.ray.direction.z,
          ],
          components,
          connections,
        });
        updatePlacePreview({
          position: site?.position ?? [pointerPosition.x, pointerPosition.y, pointerPosition.z],
          rotation: site?.rotation ?? [0, 0, 0],
          isValid: Boolean(site),
          snapType: site ? 'connection' : 'free',
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: site,
          snapSourcePointId: null,
          snapConfidence: site ? 1 : 0,
          message: site
            ? site.repairConnections?.length
              ? `将先修复 ${site.repairConnections.length} 条连接记录，再安装板件`
              : '四角安装位就绪，点击放置板件'
            : '当前框架没有可完整安装该尺寸板件的位置',
        });
        return;
      }

      if (componentId === U_CURVED_TUBE_COMPONENT_ID) {
        const site = curvedTubeMountSystem.findNearestCurvedTubeMountSiteByRay({
          rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
          rayDirection: [
            event.ray.direction.x,
            event.ray.direction.y,
            event.ray.direction.z,
          ],
          components,
          connections,
          flip: interaction.placeState.curvedTubeFlip,
        });
        updatePlacePreview({
          position: site?.position ?? [pointerPosition.x, pointerPosition.y, pointerPosition.z],
          rotation: site?.rotation ?? [0, 0, 0],
          isValid: Boolean(site),
          snapType: site ? 'connection' : 'free',
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: site,
          snapSourcePointId: null,
          snapConfidence: site ? 1 : 0,
          message: site
            ? 'U形弯管双端安装位就绪，点击放置'
            : '需要两个相距40cm且同向平行的空闲端点',
        });
        return;
      }

      if (rampMountSystem.isRampComponentId(componentId)) {
        const site = rampMountSystem.findNearestRampMountSiteByRay({
          componentId,
          rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
          rayDirection: [event.ray.direction.x, event.ray.direction.y, event.ray.direction.z],
          components,
          connections,
        });
        updatePlacePreview({
          position: site?.position ?? [pointerPosition.x, pointerPosition.y, pointerPosition.z],
          rotation: site?.rotation ?? [0, 0, 0],
          isValid: Boolean(site),
          snapType: site ? 'connection' : 'free',
          snapTarget: null,
          topologyTarget: null,
          connectorTarget: null,
          boardMountSite: null,
          curvedTubeMountSite: null,
          rampMountSite: site,
          snapSourcePointId: null,
          snapConfidence: site ? 1 : 0,
          message: site
            ? '坡板双锚点安装位就绪，点击放置'
            : '需要两个同高、相距40cm且坡板低端可落地的安装点',
        });
        return;
      }

      const suggestion = constructionEngine.suggest({
        componentId,
        draftPosition: [pointerPosition.x, pointerPosition.y, pointerPosition.z],
        draftRotation: interaction.placeState.previewRotation,
        components,
        connections,
        options: {
          enableGridSnap: snapToGrid,
          enableConnectionSnap: snapToComponent,
          gridSize: editor.gridSize,
        },
      });

      updatePlacePreview({
        position: suggestion.position,
        rotation: suggestion.rotation,
        isValid: true,
        snapType: suggestion.snapType,
        snapTarget: suggestion.target
          ? {
              instanceId: suggestion.target.componentId,
              pointId: suggestion.target.pointId,
              position: suggestion.target.position,
            }
          : null,
        snapSourcePointId: suggestion.sourcePointId ?? null,
        topologyTarget: suggestion.topologyTarget ?? null,
        connectorTarget: suggestion.connectorTarget ?? null,
        snapConfidence: suggestion.confidence,
        message: suggestion.message,
      });
    } else if (isDragging) {
      const { dragTarget, dragOffset } = interaction;
      if (dragTarget) {
        const component = components.find(item => item.instanceId === dragTarget);
        if (!component) return;

        const draftPosition: [number, number, number] = [
          pointerPosition.x - dragOffset[0],
          pointerPosition.y - dragOffset[1],
          pointerPosition.z - dragOffset[2],
        ];
        if (boardMountSystem.isBoardComponentId(component.componentId)) {
          const site = boardMountSystem.findNearestBoardMountSiteByRay({
            boardComponentId: component.componentId,
            rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
            rayDirection: [
              event.ray.direction.x,
              event.ray.direction.y,
              event.ray.direction.z,
            ],
            components,
            connections,
            excludeBoardInstanceId: dragTarget,
          });
          latestBoardMountSite.current = site;
          updateDragPreview({
            position: site?.position ?? draftPosition,
            snapType: site ? 'connection' : 'free',
            snapTarget: null,
            topologyTarget: null,
            connectorTarget: null,
            boardMountSite: site,
            snapConfidence: site ? 1 : 0,
            message: site
              ? site.repairConnections?.length
                ? `将先修复 ${site.repairConnections.length} 条连接记录，再移动板件`
                : '四角安装位就绪，松开放置板件'
              : '当前框架没有可完整安装该尺寸板件的位置',
          });
          return;
        }
        if (component.componentId === U_CURVED_TUBE_COMPONENT_ID) {
          const site = curvedTubeMountSystem.findNearestCurvedTubeMountSiteByRay({
            rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
            rayDirection: [
              event.ray.direction.x,
              event.ray.direction.y,
              event.ray.direction.z,
            ],
            components,
            connections,
            excludeInstanceId: dragTarget,
          });
          latestCurvedTubeMountSite.current = site;
          updateDragPreview({
            position: site?.position ?? draftPosition,
            snapType: site ? 'connection' : 'free',
            snapTarget: null,
            topologyTarget: null,
            connectorTarget: null,
            boardMountSite: null,
            curvedTubeMountSite: site,
            snapConfidence: site ? 1 : 0,
            message: site
              ? 'U形弯管双端安装位就绪，松开放置'
              : '需要两个相距40cm且同向平行的空闲端点',
          });
          return;
        }
        if (rampMountSystem.isRampComponentId(component.componentId)) {
          const site = rampMountSystem.findNearestRampMountSiteByRay({
            componentId: component.componentId,
            rayOrigin: [event.ray.origin.x, event.ray.origin.y, event.ray.origin.z],
            rayDirection: [event.ray.direction.x, event.ray.direction.y, event.ray.direction.z],
            components,
            connections,
            excludeInstanceId: dragTarget,
          });
          latestRampMountSite.current = site;
          updateDragPreview({
            position: site?.position ?? draftPosition,
            snapType: site ? 'connection' : 'free',
            snapTarget: null,
            topologyTarget: null,
            connectorTarget: null,
            boardMountSite: null,
            curvedTubeMountSite: null,
            rampMountSite: site,
            snapConfidence: site ? 1 : 0,
            message: site
              ? '坡板双锚点安装位就绪，松开放置'
              : '需要两个同高、相距40cm且坡板低端可落地的安装点',
          });
          return;
        }
        const suggestion = constructionEngine.suggest({
          componentId: component.componentId,
          draftPosition,
          draftRotation: component.rotation,
          components,
          connections,
          options: {
            enableGridSnap: snapToGrid,
            enableConnectionSnap: snapToComponent,
            gridSize: editor.gridSize,
            excludeInstanceId: dragTarget,
          },
        });

        latestDragSuggestion.current = suggestion;
        updateDragPreview({
          position: suggestion.position,
          snapType: suggestion.snapType,
          snapTarget: suggestion.target
            ? {
                instanceId: suggestion.target.componentId,
                pointId: suggestion.target.pointId,
                position: suggestion.target.position,
              }
            : null,
          topologyTarget: suggestion.topologyTarget ?? null,
          connectorTarget: suggestion.connectorTarget ?? null,
          snapConfidence: suggestion.confidence,
          message: suggestion.message,
        });
      }
    }
  }, [
    components,
    connections,
    editor.gridSize,
    getPointerPosition,
    interaction,
    updateDragPreview,
    updatePlacePreview,
    updateTemplatePlacementOrigin,
  ]);

  const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    const currentInteraction = useInteractionStore.getState().interaction;
    if (currentInteraction.isDragging) {
      const { dragTarget } = currentInteraction;
      const suggestion = latestDragSuggestion.current;
      if (dragTarget && latestBoardMountSite.current) {
        commitBoardMountMove(dragTarget, latestBoardMountSite.current.id);
      } else if (dragTarget && latestCurvedTubeMountSite.current) {
        commitCurvedTubeMountMove(dragTarget, latestCurvedTubeMountSite.current.id);
      } else if (dragTarget && latestRampMountSite.current) {
        commitRampMountMove(dragTarget, latestRampMountSite.current.id);
      } else if (dragTarget && suggestion) {
        commitSuggestedComponentMove(dragTarget, suggestion);
      }
      endDrag();
      latestDragSuggestion.current = null;
      latestBoardMountSite.current = null;
      latestCurvedTubeMountSite.current = null;
      latestRampMountSite.current = null;
    }
    const pointerTarget = event.nativeEvent.target as Element | null;
    if (pointerTarget?.hasPointerCapture(event.pointerId)) {
      pointerTarget.releasePointerCapture(event.pointerId);
    }
  }, [endDrag]);
  
  return (
    <>
      <BuildTaskDefaultSiteSelector />
      <GroundPlane
        onClick={handleGroundClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => undefined}
      />
      <NativeBoardLibraryDragBridge />
      <SpaceGuideSystem />
      <BoardMountSiteGhosts />
      <CurvedTubeMountSiteGhosts />
      <RampMountSiteGhosts />
      <StructureMountSiteGhosts />
      <TemplatePlacementGhost />
      <PlacePreview />
      <PlaceConnectorPreview />
      <SnapTargetIndicator />
      <EndpointGrowthControls />
    </>
  );
};

export default InteractionSystem;
