import React, { useMemo, useState } from 'react';
import { Card, Form, InputNumber, Button, Space, Typography, Empty, Collapse, Segmented, message } from 'antd';
import { BuildOutlined, DeleteOutlined, CopyOutlined, EditOutlined, RotateLeftOutlined, RotateRightOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { useInteractionStore } from '../../stores/interactionStore';
import { getComponentById } from '../../stores/componentLibrary';
import type { BoardStyle, ComponentInstance, PipeColor } from '../../types';
import { PIPE_COLOR_OPTIONS } from '../../types';
import { normalizePipeColor } from '../../systems/PipeColorSystem';
import { assemblySelectionSystem, type AssemblySelection } from '../../systems/AssemblySelectionSystem';
import { startAssemblyPlacement } from '../../systems/AssemblyInteractionCommands';

const { Text, Title } = Typography;

type EditableVectorKey = 'position' | 'rotation';
type Axis = 'x' | 'y' | 'z';
type DraftVectors = Record<EditableVectorKey, [number, number, number]>;

const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

const createDraftVectors = (component?: ComponentInstance): DraftVectors => ({
  position: component ? [...component.position] as [number, number, number] : [0, 0, 0],
  rotation: component ? [...component.rotation] as [number, number, number] : [0, 0, 0],
});

const isSameVector = (a: [number, number, number], b: [number, number, number]) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

const normalizeRotation = (value: number) => ((value % 360) + 360) % 360;

const getComponentIcon = (type: string) => {
  switch (type) {
    case 'pipe': return '🔧';
    case 'elbow': return '↩️';
    case 'tee': return '🔀';
    case 'cross': return '✳️';
    case 'platform': return '⬜';
    case 'swing': return '🎠';
    case 'slide': return '🛝';
    case 'rope_ladder': return '🪜';
    default: return '📦';
  }
};

const getSpecifications = (definition: NonNullable<ReturnType<typeof getComponentById>>) => {
  const specs: string[] = [];
  if (definition.length) specs.push(`${definition.length}cm`);
  if (definition.width && definition.height) specs.push(`${definition.width}×${definition.height}cm`);
  if (definition.angle) specs.push(`${definition.angle}°`);
  if (definition.diameter) specs.push(`直径 ${definition.diameter}cm`);
  return specs.length > 0 ? specs.join(' · ') : '标准组件';
};

const getConnectedCount = (instanceId: string, connections: ReturnType<typeof useDesignStore.getState>['connections']) =>
  connections.filter(connection =>
    connection.isActive !== false &&
    (connection.source.componentId === instanceId || connection.target.componentId === instanceId)
  ).length;

const ColorSelector: React.FC<{
  value?: ComponentInstance['color'];
  onChange: (color: PipeColor) => void;
}> = ({ value, onChange }) => {
  const selectedColor = normalizePipeColor(value);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {PIPE_COLOR_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={`设为${option.name}`}
          aria-pressed={selectedColor === option.id}
          onClick={() => onChange(option.id)}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: 6,
            background: option.hex,
            border: selectedColor === option.id ? '3px solid #0f172a' : '2px solid #d9d9d9',
            cursor: 'pointer',
            boxShadow: selectedColor === option.id ? '0 0 0 2px rgba(22, 139, 255, 0.22)' : 'none',
          }}
          title={option.name}
        />
      ))}
    </div>
  );
};

const SingleComponentPanel: React.FC<{
  component: ComponentInstance;
  connections: ReturnType<typeof useDesignStore.getState>['connections'];
  commitComponentUpdate: ReturnType<typeof useDesignStore.getState>['commitComponentUpdate'];
  commitComponentsDeletion: ReturnType<typeof useDesignStore.getState>['commitComponentsDeletion'];
  duplicateSelected: ReturnType<typeof useDesignStore.getState>['duplicateSelected'];
  clearSelection: () => void;
  editingAssembly?: AssemblySelection | null;
  onReturnToAssembly?: () => void;
}> = ({
  component,
  connections,
  commitComponentUpdate,
  commitComponentsDeletion,
  duplicateSelected,
  clearSelection,
  editingAssembly,
  onReturnToAssembly,
}) => {
  const definition = getComponentById(component.componentId);
  const [draftVectors, setDraftVectors] = useState<DraftVectors>(() => createDraftVectors(component));

  const setDraftValue = (key: EditableVectorKey, axis: Axis, value: number | null) => {
    if (value === null) return;
    setDraftVectors(previous => {
      const next = [...previous[key]] as [number, number, number];
      next[AXIS_INDEX[axis]] = key === 'rotation' ? normalizeRotation(value) : value;
      return { ...previous, [key]: next };
    });
  };

  const commitDraftValue = (key: EditableVectorKey) => {
    const currentValue = component[key];
    const nextValue = draftVectors[key];
    if (isSameVector(currentValue, nextValue)) return;
    commitComponentUpdate(component.instanceId, { [key]: nextValue });
  };

  if (!definition) {
    return <div style={{ padding: 16 }}>组件定义未找到</div>;
  }

  // 快速旋转
  const handleQuickRotate = (axis: Axis, degrees: number) => {
    const newRotation = [...component.rotation] as [number, number, number];
    const axisIndex = AXIS_INDEX[axis];
    newRotation[axisIndex] = ((newRotation[axisIndex] + degrees) % 360 + 360) % 360;
    commitComponentUpdate(component.instanceId, { rotation: newRotation });
  };

  // 处理颜色变化
  const handleColorChange = (color: PipeColor) => {
    if (normalizePipeColor(component.color) === color) return;
    commitComponentUpdate(component.instanceId, { color });
  };

  const handleBoardStyleChange = (style: BoardStyle) => {
    const currentStyle: BoardStyle =
      component.properties?.boardStyle === 'perforated' ? 'perforated' : 'solid';
    if (currentStyle === style) return;
    commitComponentUpdate(component.instanceId, {
      properties: {
        ...(component.properties ?? {}),
        boardStyle: style,
        boardMountVersion: 2,
      },
    });
  };

  const connectedCount = getConnectedCount(component.instanceId, connections);
  const isPipe = definition.type === 'pipe';
  const isBoard = definition.type === 'platform';
  const relevantConnectionPointCount = definition.connectionPoints.filter(point =>
    isBoard ? point.role === 'board-mount' : point.role !== 'board-mount'
  ).length;

  return (
    <div style={{ padding: 16 }}>
      {editingAssembly ? (
        <Button
          block
          type="primary"
          ghost
          icon={<BuildOutlined />}
          onClick={onReturnToAssembly}
          style={{ marginBottom: 12 }}
        >
          返回{editingAssembly.structureName}
        </Button>
      ) : null}
      {/* 组件信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: '#f5f5f5',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {getComponentIcon(definition.type)}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{definition.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {getSpecifications(definition)}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              已连接 {connectedCount}/{relevantConnectionPointCount}
            </Text>
          </div>
        </div>
      </Card>

      {/* 颜色选择 */}
      {isPipe && (
      <Card size="small" title="颜色" style={{ marginBottom: 16 }}>
        <ColorSelector
          value={component.color}
          onChange={handleColorChange}
        />
      </Card>
      )}

      {isBoard && (
        <Card size="small" title="板件外观" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            颜色
          </Text>
          <ColorSelector value={component.color ?? 'green'} onChange={handleColorChange} />
          <Text type="secondary" style={{ display: 'block', margin: '12px 0 8px', fontSize: 12 }}>
            样式
          </Text>
          <Segmented
            block
            value={component.properties?.boardStyle === 'perforated' ? 'perforated' : 'solid'}
            options={[
              { label: '实心板', value: 'solid' },
              { label: '圆孔板', value: 'perforated' },
            ]}
            onChange={value => handleBoardStyleChange(value as BoardStyle)}
          />
        </Card>
      )}

      <Collapse
        size="small"
        style={{ marginBottom: 16, background: '#fff' }}
        items={[
          {
            key: 'advanced',
            label: '高级参数',
            children: (
              <Form layout="vertical" size="small">
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  精确坐标与角度一般不需要调整；输入后按 Enter 或离开输入框才会写入历史。
                </Text>
                <Space style={{ width: '100%' }}>
                  {(['x', 'y', 'z'] as Axis[]).map(axis => (
                    <Form.Item key={axis} label={axis.toUpperCase()} style={{ flex: 1, marginBottom: 8 }}>
                      <InputNumber
                        value={draftVectors.position[AXIS_INDEX[axis]]}
                        onChange={(value) => setDraftValue('position', axis, value)}
                        onBlur={() => commitDraftValue('position')}
                        onPressEnter={() => commitDraftValue('position')}
                        style={{ width: '100%' }}
                        addonAfter="cm"
                        step={20}
                      />
                    </Form.Item>
                  ))}
                </Space>

                {(['x', 'y', 'z'] as Axis[]).map(axis => (
                  <Form.Item key={axis} label={`${axis.toUpperCase()}轴旋转`} style={{ marginBottom: 8 }}>
                    <Space style={{ width: '100%' }}>
                      <InputNumber
                        value={draftVectors.rotation[AXIS_INDEX[axis]]}
                        onChange={(value) => setDraftValue('rotation', axis, value)}
                        onBlur={() => commitDraftValue('rotation')}
                        onPressEnter={() => commitDraftValue('rotation')}
                        style={{ flex: 1 }}
                        addonAfter="°"
                        step={15}
                      />
                      <Button
                        size="small"
                        icon={<RotateLeftOutlined />}
                        onClick={() => handleQuickRotate(axis, -90)}
                      />
                      <Button
                        size="small"
                        icon={<RotateRightOutlined />}
                        onClick={() => handleQuickRotate(axis, 90)}
                      />
                    </Space>
                  </Form.Item>
                ))}
              </Form>
            ),
          },
        ]}
      />

      {/* 操作按钮 */}
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Button
          block
          icon={<CopyOutlined />}
          onClick={() => duplicateSelected([component.instanceId])}
        >
          复制组件
        </Button>
        <Button
          block
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            commitComponentsDeletion([component.instanceId]);
            clearSelection();
          }}
        >
          删除组件
        </Button>
      </Space>
    </div>
  );
};

const AssemblyPanel: React.FC<{
  assembly: AssemblySelection;
  commitComponentsDeletion: ReturnType<typeof useDesignStore.getState>['commitComponentsDeletion'];
  clearSelection: () => void;
  selectComponents: (instanceIds: string[]) => void;
  setAssemblyEditGroupId: (groupId: string | null) => void;
}> = ({
  assembly,
  commitComponentsDeletion,
  clearSelection,
  selectComponents,
  setAssemblyEditGroupId,
}) => {
  const startPlacement = (mode: 'copy' | 'reinstall') => {
    const result = startAssemblyPlacement(assembly.groupId, mode);
    if (!result.ok) {
      message.warning(result.reason);
      return;
    }
    message.info(
      `${mode === 'copy' ? '副本' : '原结构'}已进入安装位选择，共 ${result.installCount} 处`
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <Card size="small" style={{ marginBottom: 14, borderColor: '#bfdbfe', background: '#f8fbff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              background: '#e6f4ff',
              color: '#1677ff',
              fontSize: 20,
            }}
          >
            <BuildOutlined />
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>{assembly.structureName}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完整结构 · {assembly.members.length} 个零件 · {assembly.internalConnections.length} 条内部连接
            </Text>
          </div>
        </div>
      </Card>

      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12, lineHeight: 1.55 }}>
        结构默认作为整体操作。重新安装和复制都只允许使用系统验证过的双锚点位置。
      </Text>

      <Space orientation="vertical" style={{ width: '100%' }}>
        <Button block icon={<BuildOutlined />} onClick={() => startPlacement('reinstall')}>
          重新安装
        </Button>
        <Button block icon={<CopyOutlined />} onClick={() => startPlacement('copy')}>
          复制并选择安装位
        </Button>
        <Button
          block
          icon={<EditOutlined />}
          onClick={() => {
            setAssemblyEditGroupId(assembly.groupId);
            selectComponents([assembly.memberIds[0]]);
          }}
        >
          编辑零件
        </Button>
        <Button
          block
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            commitComponentsDeletion(assembly.memberIds);
            clearSelection();
          }}
        >
          删除整个结构
        </Button>
      </Space>
    </div>
  );
};

const PropertiesPanel: React.FC = () => {
  const { components, connections, commitComponentsDeletion, commitComponentUpdate, duplicateSelected } = useDesignStore();
  const {
    interaction,
    clearSelection,
    selectComponents,
    setAssemblyEditGroupId,
  } = useInteractionStore();

  // 获取选中的组件
  const selectedComponents = useMemo(() => {
    return components.filter(c => interaction.selectedComponents.includes(c.instanceId));
  }, [components, interaction.selectedComponents]);
  const selectedAssembly = useMemo(() => assemblySelectionSystem.deriveFromSelection({
    selectedInstanceIds: interaction.selectedComponents,
    components,
    connections,
  }), [components, connections, interaction.selectedComponents]);
  const editingAssembly = useMemo(() => {
    if (!interaction.assemblyEditGroupId) return null;
    const member = components.find(
      component => component.properties?.assemblyGroupId === interaction.assemblyEditGroupId
    );
    return member ? assemblySelectionSystem.deriveFromMember({
      instanceId: member.instanceId,
      components,
      connections,
    }) : null;
  }, [components, connections, interaction.assemblyEditGroupId]);

  // 如果没有选中组件
  if (selectedComponents.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>未选中任何组件</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击3D视图中的组件进行选择
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  if (selectedAssembly && !interaction.assemblyEditGroupId) {
    return (
      <AssemblyPanel
        assembly={selectedAssembly}
        commitComponentsDeletion={commitComponentsDeletion}
        clearSelection={clearSelection}
        selectComponents={selectComponents}
        setAssemblyEditGroupId={setAssemblyEditGroupId}
      />
    );
  }

  // 如果选中多个组件
  if (selectedComponents.length > 1) {
    return (
      <div style={{ padding: 16 }}>
        <Title level={5}>多选组件</Title>
        <div style={{ marginBottom: 16 }}>
          <Text>已选中 {selectedComponents.length} 个组件，可批量复制或删除。</Text>
        </div>

        <Space orientation="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<CopyOutlined />}
            onClick={() => duplicateSelected(interaction.selectedComponents)}
          >
            复制选中组件
          </Button>
          <Button
            block
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              commitComponentsDeletion(selectedComponents.map(c => c.instanceId));
              clearSelection();
            }}
          >
            删除选中组件
          </Button>
        </Space>
      </div>
    );
  }

  const component = selectedComponents[0];
  const draftResetKey = [
    component.instanceId,
    component.position.join(','),
    component.rotation.join(','),
  ].join('|');

  return (
    <SingleComponentPanel
      key={draftResetKey}
      component={component}
      connections={connections}
      commitComponentUpdate={commitComponentUpdate}
      commitComponentsDeletion={commitComponentsDeletion}
      duplicateSelected={duplicateSelected}
      clearSelection={clearSelection}
      editingAssembly={editingAssembly}
      onReturnToAssembly={() => {
        if (!editingAssembly) return;
        setAssemblyEditGroupId(null);
        selectComponents(editingAssembly.memberIds);
      }}
    />
  );
};

export default PropertiesPanel;
