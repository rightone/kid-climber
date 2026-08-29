import React, { useRef, useMemo, useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';
import {
  activateDefaultGrowthEndpoint,
  commitActivePlacement,
} from '../../../systems/EditorInteractionCommands';
import { getComponentById } from '../../../stores/componentLibrary';
import { createComponentGeometry } from '../utils/geometryUtils';
import type { ComponentColor } from '../../../types';
import { COMPONENT_COLORS } from '../../../types';
import { getWorldPosition } from '../../../systems/ConstructionEngine';
import {
  isPipeComponentId,
  normalizeComponentColorForRender,
  shouldOpenPipeColorMenu,
} from '../../../systems/PipeColorSystem';
import {
  topologyIntegritySystem,
} from '../../../systems/TopologyIntegritySystem';
import { REFERENCE_PRODUCT_PROFILE_V1 } from '../../../referenceProductSpec';
import { assemblySelectionSystem } from '../../../systems/AssemblySelectionSystem';

// 获取组件颜色
const getComponentColor = (componentId: string, color?: ComponentColor): string => {
  const normalizedColor = normalizeComponentColorForRender(componentId, color);

  if (normalizedColor && COMPONENT_COLORS[normalizedColor]) {
    return COMPONENT_COLORS[normalizedColor].hex;
  }
  
  // 接头统一使用黑色
  const [type] = componentId.split('_');
  if (type === 'connector' || type === 'elbow' || type === 'tee' || type === 'cross') {
    return COMPONENT_COLORS.black.hex;
  }
  
  // 默认颜色
  return COMPONENT_COLORS.blue.hex;
};

// 组件材质
const createMaterial = (
  color: string,
  isSelected: boolean,
  isHovered: boolean,
  isDimmed: boolean,
  isPipe: boolean
): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isDimmed
      ? 0
      : isHovered
        ? 0.18
        : isSelected
          ? 0.12
          : isPipe
            ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.emissiveIntensity
            : 0,
    roughness: isPipe
      ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness
      : 0.4,
    metalness: isPipe
      ? REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness
      : 0.15,
    transparent: true,
    opacity: isDimmed ? 0.16 : 1,
    depthWrite: !isDimmed,
  });
};

// 单个组件渲染
interface ClimberComponentProps {
  instanceId: string;
  componentId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: ComponentColor;
  properties?: Record<string, unknown>;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  showConnections: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
  onAppearanceRequest: (
    kind: 'pipe-color' | 'board-appearance',
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void;
}

const ClimberComponent: React.FC<ClimberComponentProps> = React.memo(({
  instanceId,
  componentId,
  position,
  rotation,
  scale,
  color,
  properties,
  isSelected,
  isHovered,
  isDimmed,
  showConnections,
  onClick,
  onPointerOver,
  onPointerOut,
  onAppearanceRequest,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const rightPointerStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  
  // 获取组件定义
  const definition = useMemo(() => getComponentById(componentId), [componentId]);
  
  // 创建几何体
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(componentId, definition, { properties, color });
  }, [color, componentId, definition, properties]);
  
  // 创建材质
  const material = useMemo(() => {
    const componentColor = getComponentColor(componentId, color);
    return createMaterial(componentColor, isSelected, isHovered, isDimmed, isPipeComponentId(componentId));
  }, [componentId, color, isDimmed, isSelected, isHovered]);
  
  // 转换旋转角度为弧度
  const rotationRad = useMemo(() => [
    (rotation[0] * Math.PI) / 180,
    (rotation[1] * Math.PI) / 180,
    (rotation[2] * Math.PI) / 180,
  ], [rotation]);
  
  // 连接点可视化
  const connectionPoints = useMemo(() => {
    if (!showConnections || !definition) return null;
    
    return definition.connectionPoints
      .filter(point => point.role !== 'board-mount')
      .map((point, index) => {
      const isSocket = point.type === 'socket';
      
      return (
        <group key={index} position={point.position}>
          <mesh>
            {isSocket ? (
              <torusGeometry args={[1.5, 0.3, 8, 16]} />
            ) : (
              <sphereGeometry args={[0.8, 16, 16]} />
            )}
            <meshBasicMaterial
              color={isSocket ? '#ff6b6b' : '#52c41a'}
              transparent
              opacity={0.6}
            />
          </mesh>
        </group>
      );
      });
  }, [showConnections, definition]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.button === 2 &&
      (definition?.type === 'pipe' || definition?.type === 'platform')
    ) {
      rightPointerStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.button !== 2 ||
      (definition?.type !== 'pipe' && definition?.type !== 'platform')
    ) {
      return;
    }

    const start = rightPointerStartRef.current;
    rightPointerStartRef.current = null;
    if (!start) return;

    if (
      shouldOpenPipeColorMenu(start, {
        clientX: event.clientX,
        clientY: event.clientY,
      })
    ) {
      event.stopPropagation();
      onAppearanceRequest(
        definition.type === 'platform' ? 'board-appearance' : 'pipe-color',
        instanceId,
        event.clientX,
        event.clientY
      );
    }
  };
  
  return (
    <group 
      position={position} 
      rotation={rotationRad as [number, number, number]} 
      scale={scale}
      userData={{ instanceId }}
    >
      {/* 主体网格 */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        onClick={onClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        castShadow
        receiveShadow
        userData={{ instanceId }}
      />
      
      {/* 选中时的边框 */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color="#38BDF8" linewidth={2} />
        </lineSegments>
      )}
      
      {/* 连接点 */}
      {connectionPoints}
    </group>
  );
});

ClimberComponent.displayName = 'ClimberComponent';

// 连接线渲染
const ConnectionLines: React.FC = () => {
  const { connections, components } = useDesignStore();
  
  const lines = useMemo(() => {
    return connections.map((connection) => {
      const sourceComponent = components.find(c => c.instanceId === connection.source.componentId);
      const targetComponent = components.find(c => c.instanceId === connection.target.componentId);
      
      if (!sourceComponent || !targetComponent) return null;
      
      const sourceDef = getComponentById(sourceComponent.componentId);
      const targetDef = getComponentById(targetComponent.componentId);
      
      if (!sourceDef || !targetDef) return null;
      
      const sourcePoint = sourceDef.connectionPoints.find(p => p.id === connection.source.pointId);
      const targetPoint = targetDef.connectionPoints.find(p => p.id === connection.target.pointId);
      
      if (!sourcePoint || !targetPoint) return null;
      
      const sourceWorldPos = getWorldPosition(
        sourceComponent.position,
        sourceComponent.rotation,
        sourcePoint.position
      );
      const targetWorldPos = getWorldPosition(
        targetComponent.position,
        targetComponent.rotation,
        targetPoint.position
      );
      const sourcePos = new THREE.Vector3(...sourceWorldPos);
      const targetPos = new THREE.Vector3(...targetWorldPos);
      
      return {
        id: connection.id,
        start: sourcePos,
        end: targetPos,
      };
    }).filter(Boolean);
  }, [connections, components]);
  
  return (
    <group>
      {lines.map((line) => {
        if (!line) return null;
        
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        return (
          <primitive key={line.id} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#1890ff' }))} />
        );
      })}
    </group>
  );
};

const endpointCapRotation = (direction: [number, number, number]) => {
  const normal = new THREE.Vector3(...direction).normalize();
  if (normal.lengthSq() === 0) return [0, 0, 0] as [number, number, number];
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal
  );
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [euler.x, euler.y, euler.z] as [number, number, number];
};

const TopologyEndpointMarkers: React.FC = () => {
  const { components, connections, editor } = useDesignStore();

  const markers = useMemo(() => {
    const componentById = new Map(
      components.map(component => [component.instanceId, component])
    );
    return topologyIntegritySystem
      .listPipeEndpointDiagnostics({ components, connections })
      .map(item => {
        const component = componentById.get(item.endpoint.componentId);
        if (!component || !isPipeComponentId(component.componentId)) return null;
        return {
          id: `${item.endpoint.componentId}:${item.endpoint.pointId}`,
          kind: item.kind,
          position: item.endpoint.position,
          rotation: endpointCapRotation(item.endpoint.direction),
          color: getComponentColor(component.componentId, component.color),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [components, connections]);

  return (
    <group>
      {markers.map(marker => (
        <group key={marker.id} position={marker.position} rotation={marker.rotation} raycast={() => null}>
          <mesh renderOrder={6} raycast={() => null}>
            <cylinderGeometry args={[1.33, 1.33, 0.34, 24]} />
            <meshStandardMaterial
              color={marker.color}
              roughness={REFERENCE_PRODUCT_PROFILE_V1.pipe.material.roughness}
              metalness={REFERENCE_PRODUCT_PROFILE_V1.pipe.material.metalness}
            />
          </mesh>
          {editor.showConnections ? (
            <mesh renderOrder={7} raycast={() => null}>
              <torusGeometry args={[1.72, 0.12, 8, 32]} />
              <meshBasicMaterial
                color={marker.kind === 'problem' ? '#ef4444' : '#f59e0b'}
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
};

// 组件渲染器
const ComponentRenderer: React.FC = () => {
  const components = useDesignStore(state => state.components);
  const showConnections = useDesignStore(state => state.editor.showConnections);
  const mode = useInteractionStore(state => state.interaction.mode);
  const selectedComponents = useInteractionStore(state => state.interaction.selectedComponents);
  const activeBuildTask = useInteractionStore(state => state.interaction.activeBuildTask);
  const assemblyEditGroupId = useInteractionStore(state => state.interaction.assemblyEditGroupId);
  const hoveredComponent = useInteractionStore(state => state.interaction.hoveredComponent);
  const dimmedConnectorInstanceId = useInteractionStore(
    state =>
      state.interaction.growthState.hoveredCandidate?.connectorInstanceId ??
      null
  );
  const toggleSelectComponent = useInteractionStore(state => state.toggleSelectComponent);
  const selectComponents = useInteractionStore(state => state.selectComponents);
  const setHoveredComponent = useInteractionStore(state => state.setHoveredComponent);
  const openPipeColorMenu = useInteractionStore(state => state.openPipeColorMenu);
  const openBoardAppearanceMenu = useInteractionStore(
    state => state.openBoardAppearanceMenu
  );
  
  // 处理点击
  const handleClick = useCallback((instanceId: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();

    if (mode === 'place') {
      if (activeBuildTask) return;
      commitActivePlacement();
      return;
    }

    const assembly = assemblySelectionSystem.deriveFromMember({
      instanceId,
      components,
      connections: useDesignStore.getState().connections,
    });
    const useAssemblySelection = assembly && assembly.groupId !== assemblyEditGroupId;

    if (e.shiftKey) {
      if (useAssemblySelection) {
        const currentSelection = useInteractionStore.getState().interaction.selectedComponents;
        const allSelected = assembly.memberIds.every(id => currentSelection.includes(id));
        selectComponents(allSelected
          ? currentSelection.filter(id => !assembly.memberIds.includes(id))
          : [...currentSelection, ...assembly.memberIds]);
        return;
      }
      toggleSelectComponent(instanceId);
      const nextSelection =
        useInteractionStore.getState().interaction.selectedComponents;
      if (nextSelection.length === 1) {
        activateDefaultGrowthEndpoint(nextSelection[0]);
      }
    } else {
      if (useAssemblySelection) {
        selectComponents(assembly.memberIds);
        return;
      }
      selectComponents([instanceId]);
      activateDefaultGrowthEndpoint(instanceId);
    }
  }, [activeBuildTask, assemblyEditGroupId, components, mode, selectComponents, toggleSelectComponent]);
  
  // 处理悬停
  const handlePointerOver = useCallback((instanceId: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredComponent(instanceId);
  }, [setHoveredComponent]);
  
  const handlePointerOut = useCallback(() => {
    setHoveredComponent(null);
  }, [setHoveredComponent]);

  const handleAppearanceRequest = useCallback(
    (
      kind: 'pipe-color' | 'board-appearance',
      instanceId: string,
      clientX: number,
      clientY: number
    ) => {
      if (mode !== 'select' && mode !== 'connect') return;
      if (kind === 'board-appearance') {
        openBoardAppearanceMenu(instanceId, clientX, clientY);
      } else {
        openPipeColorMenu(instanceId, clientX, clientY);
      }
    },
    [mode, openBoardAppearanceMenu, openPipeColorMenu]
  );
  
  return (
    <group>
      {components.map((component) => (
        <ClimberComponent
          key={component.instanceId}
          instanceId={component.instanceId}
          componentId={component.componentId}
          position={component.position}
          rotation={component.rotation}
          scale={component.scale}
          color={component.color}
          properties={component.properties}
          isSelected={selectedComponents.includes(component.instanceId)}
          isHovered={hoveredComponent === component.instanceId}
          isDimmed={dimmedConnectorInstanceId === component.instanceId}
          showConnections={showConnections}
          onClick={(e) => handleClick(component.instanceId, e)}
          onPointerOver={(e) => handlePointerOver(component.instanceId, e)}
          onPointerOut={handlePointerOut}
          onAppearanceRequest={handleAppearanceRequest}
        />
      ))}
      
      <ConnectionLines />
      <TopologyEndpointMarkers />
    </group>
  );
};

export default ComponentRenderer;
