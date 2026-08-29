export type ToolbarActionId =
  | 'save'
  | 'file'
  | 'undo'
  | 'redo'
  | 'select'
  | 'move'
  | 'rotate'
  | 'components'
  | 'project'
  | 'display'
  | 'settings'
  | 'help';

export interface ToolbarAction {
  id: ToolbarActionId;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  priority: 'primary' | 'secondary' | 'overflow';
  execute: () => void;
}

export interface ToolbarLayout {
  visible: ToolbarActionId[];
  overflow: ToolbarActionId[];
}

const FULL_TOOLBAR_ACTIONS: ToolbarActionId[] = [
  'save',
  'file',
  'undo',
  'redo',
  'select',
  'move',
  'rotate',
  'components',
  'project',
  'display',
];

const COMPACT_TOOLBAR_ACTIONS: ToolbarActionId[] = [
  'save',
  'undo',
  'redo',
  'select',
  'move',
  'rotate',
  'components',
];

export const resolveToolbarLayout = (viewportWidth: number): ToolbarLayout => {
  if (viewportWidth >= 1100) {
    return {
      visible: [...FULL_TOOLBAR_ACTIONS],
      overflow: ['settings', 'help'],
    };
  }

  return {
    visible: [...COMPACT_TOOLBAR_ACTIONS],
    overflow: ['file', 'project', 'display', 'settings', 'help'],
  };
};
