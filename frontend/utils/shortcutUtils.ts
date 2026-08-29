import { useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useDesignStore } from '../stores/designStore';
import { useInteractionStore, type ActiveTool } from '../stores/interactionStore';
import {
  cancelActiveInteraction,
  commitActiveBuildTask,
} from '../systems/EditorInteractionCommands';
import { assemblySelectionSystem } from '../systems/AssemblySelectionSystem';
import { startAssemblyPlacement } from '../systems/AssemblyInteractionCommands';

// 快捷键配置
export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export const SAVE_SHORTCUT = {
  key: 's',
  ctrl: true,
  description: '保存设计',
} as const;

// 快捷键Hook
export const useShortcuts = (shortcuts: ShortcutConfig[]) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 忽略输入框中的快捷键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !(event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });
    
    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
    }
  }, [shortcuts]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

// 默认快捷键配置
export const useDefaultShortcuts = () => {
  const undo = useDesignStore(state => state.undo);
  const redo = useDesignStore(state => state.redo);
  const copySelected = useDesignStore(state => state.copySelected);
  const paste = useDesignStore(state => state.paste);
  const commitComponentsDeletion = useDesignStore(state => state.commitComponentsDeletion);
  const commitComponentUpdate = useDesignStore(state => state.commitComponentUpdate);
  const setEditorState = useDesignStore(state => state.setEditorState);
  const editor = useDesignStore(state => state.editor);
  const components = useDesignStore(state => state.components);
  const connections = useDesignStore(state => state.connections);
  const selectedComponents = useInteractionStore(state => state.interaction.selectedComponents);
  const clearSelection = useInteractionStore(state => state.clearSelection);
  const selectComponents = useInteractionStore(state => state.selectComponents);
  const setActiveTool = useInteractionStore(state => state.setActiveTool);

  const activateTool = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
  }, [setActiveTool]);

  const shortcuts = useMemo<ShortcutConfig[]>(() => [
    // 撤销
    {
      key: 'z',
      ctrl: true,
      description: '撤销',
      action: undo,
    },
    // 重做
    {
      key: 'y',
      ctrl: true,
      description: '重做',
      action: redo,
    },
    // 复制
    {
      key: 'c',
      ctrl: true,
      description: '复制选中组件',
      action: () => {
        const assembly = assemblySelectionSystem.deriveFromSelection({
          selectedInstanceIds: selectedComponents,
          components,
          connections,
        });
        if (assembly) {
          const result = startAssemblyPlacement(assembly.groupId, 'copy');
          if (result.ok) {
            message.info(`结构副本已进入安装位选择，共 ${result.installCount} 处`);
          } else {
            message.warning(result.reason);
          }
          return;
        }
        if (selectedComponents.length > 0) {
          copySelected(selectedComponents);
          message.success(`已复制 ${selectedComponents.length} 个组件`);
        }
      },
    },
    // 粘贴
    {
      key: 'v',
      ctrl: true,
      description: '粘贴组件',
      action: () => {
        paste();
        message.success('已粘贴组件');
      },
    },
    // 删除
    {
      key: 'Delete',
      description: '删除选中组件',
      action: () => {
        if (selectedComponents.length > 0) {
          const deletedCount = selectedComponents.length;
          commitComponentsDeletion(selectedComponents);
          clearSelection();
          message.success(`已删除 ${deletedCount} 个组件`);
        }
      },
    },
    // 全选
    {
      key: 'a',
      ctrl: true,
      description: '全选',
      action: () => {
        selectComponents(components.map(component => component.instanceId));
        message.success(`已选择 ${components.length} 个组件`);
      },
    },
    // 提交放置
    {
      key: 'Enter',
      description: '提交当前放置',
      action: () => {
        commitActiveBuildTask();
      },
    },
    // 取消选择
    {
      key: 'Escape',
      description: '取消选择',
      action: cancelActiveInteraction,
    },
    // 选择工具
    {
      key: 'v',
      description: '选择工具',
      action: () => activateTool('select'),
    },
    // 移动工具
    {
      key: 'm',
      description: '移动工具',
      action: () => activateTool('move'),
    },
    // 旋转工具
    {
      key: 'r',
      description: '旋转工具',
      action: () => activateTool('rotate'),
    },
    // 切换网格
    {
      key: 'g',
      description: '切换网格显示',
      action: () => {
        setEditorState({ showGrid: !editor.showGrid });
      },
    },
    // 切换连接点
    {
      key: 'l',
      description: '切换连接点显示',
      action: () => {
        setEditorState({ showConnections: !editor.showConnections });
      },
    },
    // 切换视图模式
    {
      key: '1',
      description: '真实感模式',
      action: () => {
        setEditorState({ viewMode: 'realistic' });
      },
    },
    {
      key: '2',
      description: '线框模式',
      action: () => {
        setEditorState({ viewMode: 'wireframe' });
      },
    },
    {
      key: '3',
      description: 'X光模式',
      action: () => {
        setEditorState({ viewMode: 'xray' });
      },
    },
    {
      key: '4',
      description: '黑白模式',
      action: () => {
        setEditorState({ viewMode: 'blackwhite' });
      },
    },
    // 旋转组件
    {
      key: 'r',
      shift: true,
      description: '顺时针旋转90度',
      action: () => {
        if (selectedComponents.length === 1) {
          const component = components.find(c => c.instanceId === selectedComponents[0]);
          if (component) {
            commitComponentUpdate(component.instanceId, {
              rotation: [
                component.rotation[0],
                (component.rotation[1] + 90) % 360,
                component.rotation[2],
              ],
            });
            message.success('组件已旋转');
          }
        }
      },
    },
    // 逆时针旋转
    {
      key: 'r',
      shift: true,
      ctrl: true,
      description: '逆时针旋转90度',
      action: () => {
        if (selectedComponents.length === 1) {
          const component = components.find(c => c.instanceId === selectedComponents[0]);
          if (component) {
            commitComponentUpdate(component.instanceId, {
              rotation: [
                component.rotation[0],
                (component.rotation[1] + 270) % 360,
                component.rotation[2],
              ],
            });
            message.success('组件已旋转');
          }
        }
      },
    },
  ], [
    activateTool,
    clearSelection,
    commitComponentUpdate,
    commitComponentsDeletion,
    components,
    connections,
    copySelected,
    editor.showConnections,
    editor.showGrid,
    paste,
    redo,
    selectComponents,
    selectedComponents,
    setEditorState,
    undo,
  ]);
  
  useShortcuts(shortcuts);
  
  return shortcuts;
};

// 获取快捷键描述
export const getShortcutDescription = (shortcut: ShortcutConfig): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrl) {
    parts.push('Ctrl');
  }
  
  if (shortcut.shift) {
    parts.push('Shift');
  }
  
  if (shortcut.alt) {
    parts.push('Alt');
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};

// 快捷键帮助信息
export const getShortcutHelp = (): { category: string; shortcuts: ShortcutConfig[] }[] => {
  return [
    {
      category: '文件操作',
      shortcuts: [
        { ...SAVE_SHORTCUT, action: () => {} },
      ],
    },
    {
      category: '编辑操作',
      shortcuts: [
        { key: 'z', ctrl: true, description: '撤销', action: () => {} },
        { key: 'y', ctrl: true, description: '重做', action: () => {} },
        { key: 'c', ctrl: true, description: '复制', action: () => {} },
        { key: 'v', ctrl: true, description: '粘贴', action: () => {} },
        { key: 'Delete', description: '删除', action: () => {} },
        { key: 'a', ctrl: true, description: '全选', action: () => {} },
      ],
    },
    {
      category: '视图控制',
      shortcuts: [
        { key: 'g', description: '切换网格', action: () => {} },
        { key: 'l', description: '切换连接点', action: () => {} },
        { key: '1', description: '真实感模式', action: () => {} },
        { key: '2', description: '线框模式', action: () => {} },
        { key: '3', description: 'X光模式', action: () => {} },
        { key: '4', description: '黑白模式', action: () => {} },
      ],
    },
    {
      category: '工具切换',
      shortcuts: [
        { key: 'v', description: '选择工具', action: () => {} },
        { key: 'm', description: '移动工具', action: () => {} },
        { key: 'r', description: '旋转工具', action: () => {} },
      ],
    },
    {
      category: '组件操作',
      shortcuts: [
        { key: 'r', shift: true, description: '顺时针旋转', action: () => {} },
        { key: 'r', shift: true, ctrl: true, description: '逆时针旋转', action: () => {} },
      ],
    },
  ];
};

// 快捷键提示组件数据
export const getShortcutTips = (): string[] => {
  return [
    '使用 Ctrl+Z/Y 进行撤销/重做',
    '按 Delete 删除选中组件',
    '按 V/M/R 切换工具',
    '按 G 切换网格显示',
    '按 1/2/3/4 切换视图模式',
    '按 Shift+R 旋转组件',
    '按 Ctrl+A 全选组件',
    '按 Escape 取消选择',
  ];
};
