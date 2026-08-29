import React, { useEffect, useMemo, useState } from 'react';
import { CheckOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import {
  useInteractionStore,
  type EditorContextMenu,
} from '../../stores/interactionStore';
import { getComponentById } from '../../stores/componentLibrary';
import type { BoardStyle, PipeColor } from '../../types';
import { PIPE_COLOR_OPTIONS } from '../../types';
import { isPipeColor, normalizePipeColor } from '../../systems/PipeColorSystem';

const MENU_WIDTH = 188;
const MENU_HEIGHT = 286;
const MENU_MARGIN = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getMenuPosition = (clientX: number, clientY: number) => {
  if (typeof window === 'undefined') {
    return { left: clientX, top: clientY };
  }

  return {
    left: clamp(clientX, MENU_MARGIN, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
    top: clamp(clientY, MENU_MARGIN, window.innerHeight - MENU_HEIGHT - MENU_MARGIN),
  };
};

const PipeColorMenu: React.FC = () => {
  const contextMenu = useInteractionStore(state => state.interaction.contextMenu);
  const closeContextMenu = useInteractionStore(state => state.closeContextMenu);
  const components = useDesignStore(state => state.components);
  const commitComponentUpdate = useDesignStore(state => state.commitComponentUpdate);
  const [boardDraft, setBoardDraft] = useState<{
    menu: NonNullable<EditorContextMenu>;
    color: PipeColor;
    style: BoardStyle;
  } | null>(null);

  const target = useMemo(() => {
    if (!contextMenu) return null;
    return components.find(component => component.instanceId === contextMenu.instanceId) ?? null;
  }, [components, contextMenu]);

  const definition = useMemo(
    () => (target ? getComponentById(target.componentId) : null),
    [target]
  );

  useEffect(() => {
    const validTarget =
      definition?.type === 'pipe' ||
      (contextMenu?.kind === 'board-appearance' && definition?.type === 'platform');
    if (contextMenu && (!target || !validTarget)) {
      closeContextMenu();
    }
  }, [closeContextMenu, contextMenu, definition?.type, target]);

  if (!contextMenu || !target || !definition) {
    return null;
  }

  const position = getMenuPosition(contextMenu.clientX, contextMenu.clientY);
  const currentColor = normalizePipeColor(target.color);
  const currentBoardColor: PipeColor = isPipeColor(target.color) ? target.color : 'green';
  const currentBoardStyle: BoardStyle =
    target.properties?.boardStyle === 'perforated' ? 'perforated' : 'solid';
  const boardColor = boardDraft?.menu === contextMenu
    ? boardDraft.color
    : currentBoardColor;
  const boardStyle = boardDraft?.menu === contextMenu
    ? boardDraft.style
    : currentBoardStyle;

  const handleColorSelect = (color: PipeColor) => {
    if (color !== currentColor) {
      commitComponentUpdate(target.instanceId, { color });
    }
    closeContextMenu();
  };

  const handleBoardApply = () => {
    if (boardColor !== currentBoardColor || boardStyle !== currentBoardStyle) {
      commitComponentUpdate(target.instanceId, {
        color: boardColor,
        properties: {
          ...(target.properties ?? {}),
          boardStyle,
          boardMountVersion: 2,
        },
      });
    }
    closeContextMenu();
  };

  const isBoardMenu =
    contextMenu.kind === 'board-appearance' && definition.type === 'platform';

  return (
    <div
      role="menu"
      aria-label={isBoardMenu ? '板件外观' : '管子颜色'}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: MENU_WIDTH,
        zIndex: 3000,
        padding: 10,
        borderRadius: 12,
        background: '#ffffff',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.24)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
          color: '#0f172a',
        }}
      >
        {isBoardMenu ? '板件外观' : '管子颜色'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PIPE_COLOR_OPTIONS.map((colorOption) => {
          const selected = colorOption.id === (isBoardMenu ? boardColor : currentColor);

          return (
            <button
              key={colorOption.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-label={`设为${colorOption.name}`}
              title={`设为${colorOption.name}`}
              onClick={() => {
                if (isBoardMenu) {
                  setBoardDraft({
                    menu: contextMenu,
                    color: colorOption.id,
                    style: boardStyle,
                  });
                } else {
                  handleColorSelect(colorOption.id);
                }
              }}
              style={{
                height: 42,
                border: selected ? '2px solid #38bdf8' : '1px solid #dbe3ef',
                borderRadius: 9,
                background: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                gap: 6,
                color: '#0f172a',
                fontSize: 12,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: colorOption.hex,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {colorOption.name}
              </span>
              {selected && <CheckOutlined style={{ color: '#0284c7', fontSize: 12 }} />}
            </button>
          );
        })}
      </div>
      {isBoardMenu && (
        <>
          <div style={{ margin: '12px 0 8px', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
            板面样式
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { id: 'solid' as const, label: '实心板' },
              { id: 'perforated' as const, label: '圆孔板' },
            ]).map(option => (
              <button
                key={option.id}
                type="button"
                aria-pressed={boardStyle === option.id}
                onClick={() => setBoardDraft({
                  menu: contextMenu,
                  color: boardColor,
                  style: option.id,
                })}
                style={{
                  height: 38,
                  borderRadius: 9,
                  border: boardStyle === option.id ? '2px solid #1677ff' : '1px solid #dbe3ef',
                  background: boardStyle === option.id ? '#eff6ff' : '#f8fafc',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={closeContextMenu}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleBoardApply}
              style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #1677ff', background: '#1677ff', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
            >
              应用
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PipeColorMenu;
