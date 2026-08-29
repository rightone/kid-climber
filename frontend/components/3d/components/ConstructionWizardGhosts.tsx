import React, { useMemo, useCallback } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { constructionWizardSystem, type WizardModuleCandidate } from '../../../systems/ConstructionWizardSystem';
import { getComponentById } from '../../../stores/componentLibrary';
import { useDesignStore } from '../../../stores/designStore';
import { useInteractionStore } from '../../../stores/interactionStore';
import type { ComponentInstance, Connection } from '../../../types';
import { createComponentGeometry } from '../utils/geometryUtils';
import { getWorldPosition } from '../../../systems/ConstructionEngine';

const colorForKind = (kind: WizardModuleCandidate['kind']) => {
  switch (kind) {
    case 'extend-base':
      return '#2563eb';
    case 'add-supports':
      return '#10b981';
    case 'add-top-frame':
      return '#7c3aed';
    case 'add-board':
      return '#f59e0b';
    case 'add-short-entry':
      return '#ef4444';
  }
};

const formatMaterialDelta = (delta: Record<string, number>) =>
  Object.entries(delta)
    .map(([componentId, count]) => `${componentId.replace('pipe_', '').replace('connector_', '')} ×${count}`)
    .join(' · ');

const WizardPreviewComponent: React.FC<{
  component: ComponentInstance;
  color: string;
  selected: boolean;
}> = ({ component, color, selected }) => {
  const definition = useMemo(() => getComponentById(component.componentId), [component.componentId]);
  const geometry = useMemo(() => {
    if (!definition) return new THREE.BoxGeometry(10, 10, 10);
    return createComponentGeometry(component.componentId, definition, component);
  }, [component, definition]);
  const rotation = useMemo(
    () => [
      THREE.MathUtils.degToRad(component.rotation[0]),
      THREE.MathUtils.degToRad(component.rotation[1]),
      THREE.MathUtils.degToRad(component.rotation[2]),
    ] as [number, number, number],
    [component.rotation]
  );

  return (
    <group position={component.position} rotation={rotation} scale={component.scale}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={selected ? 0.42 : 0.28}
          wireframe={component.componentId !== 'board_40x40'}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const WizardPreviewConnections: React.FC<{
  sceneComponents: ComponentInstance[];
  components: ComponentInstance[];
  connections: Connection[];
  color: string;
}> = ({ sceneComponents, components, connections, color }) => {
  const lines = useMemo(() => {
    const componentMap = new Map(
      [...sceneComponents, ...components].map(component => [component.instanceId, component])
    );

    return connections
      .map(connection => {
        const source = componentMap.get(connection.source.componentId);
        const target = componentMap.get(connection.target.componentId);
        if (!source || !target) return null;

        const sourcePoint = getComponentById(source.componentId)?.connectionPoints.find(
          point => point.id === connection.source.pointId
        );
        const targetPoint = getComponentById(target.componentId)?.connectionPoints.find(
          point => point.id === connection.target.pointId
        );
        if (!sourcePoint || !targetPoint) return null;

        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...getWorldPosition(source.position, source.rotation, sourcePoint.position)),
          new THREE.Vector3(...getWorldPosition(target.position, target.rotation, targetPoint.position)),
        ]);
        const material = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.38,
        });

        return {
          id: connection.id,
          object: new THREE.Line(geometry, material),
        };
      })
      .filter(Boolean);
  }, [sceneComponents, components, connections, color]);

  return (
    <group>
      {lines.map(line => (line ? <primitive key={line.id} object={line.object} /> : null))}
    </group>
  );
};

const WizardCandidateGhost: React.FC<{
  candidate: WizardModuleCandidate;
  sceneComponents: ComponentInstance[];
  selected: boolean;
  onCommit: (candidate: WizardModuleCandidate, event: ThreeEvent<MouseEvent>) => void;
  onHover: (candidateId: string | null) => void;
}> = ({ candidate, sceneComponents, selected, onCommit, onHover }) => {
  const color = colorForKind(candidate.kind);
  const [rx, ry, rz] = [0, 0, 0];
  const boundsSize = candidate.previewBounds.size;

  return (
    <group>
      <WizardPreviewConnections
        sceneComponents={sceneComponents}
        components={candidate.previewComponents}
        connections={candidate.previewConnections}
        color={color}
      />

      {candidate.previewComponents.map(component => (
        <WizardPreviewComponent
          key={component.instanceId}
          component={component}
          color={color}
          selected={selected}
        />
      ))}

      <mesh
        position={candidate.previewBounds.center}
        rotation={[rx, ry, rz]}
        onClick={(event) => onCommit(candidate, event)}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(candidate.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={boundsSize} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.14 : 0.07}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[
          candidate.previewBounds.center[0],
          candidate.previewBounds.center[1] + candidate.previewBounds.size[1] / 2 + 5,
          candidate.previewBounds.center[2],
        ]}
        center
        distanceFactor={8}
        style={{
          pointerEvents: 'none',
          background: selected ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.78)',
          color: '#fff',
          padding: '5px 8px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.22)',
        }}
      >
        <strong>{candidate.label}</strong>
        <br />
        {formatMaterialDelta(candidate.materialDelta)}
      </Html>
    </group>
  );
};

const ConstructionWizardGhosts: React.FC = () => {
  const {
    components,
    connections,
    constructionWizard,
    commitConstructionWizardCandidate,
    selectConstructionWizardCandidate,
  } = useDesignStore();
  const { interaction, setMode } = useInteractionStore();
  const candidates = useMemo(
    () =>
      constructionWizardSystem.generateCandidates({
        components,
        connections,
        wizard: constructionWizard,
      }),
    [components, connections, constructionWizard]
  );

  const handleCommit = useCallback(
    (candidate: WizardModuleCandidate, event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (interaction.activeBuildTask?.id === 'base-frame') {
        selectConstructionWizardCandidate(candidate.id);
        return;
      }
      commitConstructionWizardCandidate(candidate);
      setMode('select');
    },
    [commitConstructionWizardCandidate, interaction.activeBuildTask?.id, selectConstructionWizardCandidate, setMode]
  );

  if (!constructionWizard.active || candidates.length === 0) return null;

  return (
    <group>
      {candidates.map(candidate => (
        <WizardCandidateGhost
          key={candidate.id}
          candidate={candidate}
          sceneComponents={components}
          selected={constructionWizard.selectedCandidateId === candidate.id}
          onCommit={handleCommit}
          onHover={selectConstructionWizardCandidate}
        />
      ))}
    </group>
  );
};

export default ConstructionWizardGhosts;
