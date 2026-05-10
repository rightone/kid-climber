import { useEffect, useCallback, useRef } from 'react';
import { useDesignStore } from '../stores/designStore';

// 鼠标交互配置
export interface MouseInteractionConfig {
  doubleClickDelay: number;
  dragThreshold: number;
  scrollSensitivity: number;
}

// 键盘快捷键配置
export interface KeyboardShortcutConfig {
  enabled: boolean;
  shortcuts: Map<string, () => void>;
}

// 鼠标交互Hook
export const useMouseInteraction = (config?: Partial<MouseInteractionConfig>) => {
  const defaultConfig: MouseInteractionConfig = {
    doubleClickDelay: 300,
    dragThreshold: 5,
    scrollSensitivity: 1,
    ...config,
  };
  
  const lastClickTime = useRef<number>(0);
  const lastClickPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // 处理双击
  const handleDoubleClick = useCallback((callback: () => void) => {
    const now = Date.now();
    const timeDiff = now - lastClickTime.current;
    
    if (timeDiff < defaultConfig.doubleClickDelay) {
      callback();
    }
    
    lastClickTime.current = now;
  }, [defaultConfig.doubleClickDelay]);
  
  // 处理拖拽
  const handleDrag = useCallback((
    startX: number,
    startY: number,
    currentX: number,
    currentY: number
  ): boolean => {
    const distance = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );
    
    return distance > defaultConfig.dragThreshold;
  }, [defaultConfig.dragThreshold]);
  
  return {
    handleDoubleClick,
    handleDrag,
  };
};

// 键盘快捷键Hook
export const useKeyboardShortcuts = (config?: Partial<KeyboardShortcutConfig>) => {
  const {
    undo,
    redo,
    copySelected,
    paste,
    duplicateSelected,
    selectAll,
    clearSelection,
    removeComponent,
    setEditorState,
    editor,
  } = useDesignStore();
  
  const defaultConfig: KeyboardShortcutConfig = {
    enabled: true,
    shortcuts: new Map(),
    ...config,
  };
  
  // 处理键盘事件
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!defaultConfig.enabled) return;
    
    // 忽略输入框中的快捷键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;
    
    // 撤销/重做
    if (isCtrl && !isShift) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault();
          undo();
          return;
        case 'y':
          event.preventDefault();
          redo();
          return;
        case 'c':
          event.preventDefault();
          copySelected();
          return;
        case 'v':
          event.preventDefault();
          paste();
          return;
        case 'd':
          event.preventDefault();
          duplicateSelected();
          return;
        case 'a':
          event.preventDefault();
          selectAll();
          return;
      }
    }
    
    // 工具切换
    switch (event.key.toLowerCase()) {
      case 'v':
        if (!isCtrl) {
          setEditorState({ activeTool: 'select' });
        }
        break;
      case 'm':
        if (!isCtrl) {
          setEditorState({ activeTool: 'move' });
        }
        break;
      case 'r':
        if (!isCtrl) {
          setEditorState({ activeTool: 'rotate' });
        }
        break;
      case 'g':
        if (!isCtrl) {
          setEditorState({ showGrid: !editor.showGrid });
        }
        break;
      case 'l':
        if (!isCtrl) {
          setEditorState({ showConnections: !editor.showConnections });
        }
        break;
      case 'delete':
      case 'backspace':
        if (editor.selectedComponents.length > 0) {
          editor.selectedComponents.forEach(id => removeComponent(id));
          clearSelection();
        }
        break;
      case 'escape':
        clearSelection();
        break;
    }
    
    // 视图模式切换
    if (!isCtrl && !isShift) {
      switch (event.key) {
        case '1':
          setEditorState({ viewMode: 'realistic' });
          break;
        case '2':
          setEditorState({ viewMode: 'wireframe' });
          break;
        case '3':
          setEditorState({ viewMode: 'xray' });
          break;
        case '4':
          setEditorState({ viewMode: 'blackwhite' });
          break;
      }
    }
  }, [
    defaultConfig.enabled,
    undo,
    redo,
    copySelected,
    paste,
    duplicateSelected,
    selectAll,
    clearSelection,
    removeComponent,
    setEditorState,
    editor,
  ]);
  
  // 注册事件
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  return {
    handleKeyDown,
  };
};

// 拖拽交互Hook
export const useDragInteraction = () => {
  const isDragging = useRef<boolean>(false);
  const startPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // 开始拖拽
  const startDrag = useCallback((x: number, y: number) => {
    isDragging.current = true;
    startPosition.current = { x, y };
    currentPosition.current = { x, y };
  }, []);
  
  // 更新拖拽
  const updateDrag = useCallback((x: number, y: number) => {
    if (!isDragging.current) return;
    
    currentPosition.current = { x, y };
  }, []);
  
  // 结束拖拽
  const endDrag = useCallback(() => {
    isDragging.current = false;
  }, []);
  
  // 获取拖拽距离
  const getDragDistance = useCallback(() => {
    if (!isDragging.current) return 0;
    
    const dx = currentPosition.current.x - startPosition.current.x;
    const dy = currentPosition.current.y - startPosition.current.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  }, []);
  
  // 获取拖拽方向
  const getDragDirection = useCallback(() => {
    if (!isDragging.current) return null;
    
    const dx = currentPosition.current.x - startPosition.current.x;
    const dy = currentPosition.current.y - startPosition.current.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }, []);
  
  return {
    isDragging: isDragging.current,
    startDrag,
    updateDrag,
    endDrag,
    getDragDistance,
    getDragDirection,
  };
};

// 选择交互Hook
export const useSelectionInteraction = () => {
  const {
    selectComponent,
    deselectComponent,
    toggleSelectComponent,
    clearSelection,
    selectAll,
    editor,
  } = useDesignStore();
  
  // 处理点击选择
  const handleSelect = useCallback((instanceId: string, isShift: boolean) => {
    if (isShift) {
      toggleSelectComponent(instanceId);
    } else {
      clearSelection();
      selectComponent(instanceId);
    }
  }, [selectComponent, deselectComponent, toggleSelectComponent, clearSelection]);
  
  // 处理框选
  const handleBoxSelect = useCallback((instanceIds: string[]) => {
    clearSelection();
    instanceIds.forEach(id => selectComponent(id));
  }, [selectComponent, clearSelection]);
  
  return {
    handleSelect,
    handleBoxSelect,
    selectedComponents: editor.selectedComponents,
  };
};

// 视图交互Hook
export const useViewInteraction = () => {
  const { setEditorState, editor } = useDesignStore();
  
  // 切换视图模式
  const toggleViewMode = useCallback(() => {
    const modes = ['realistic', 'wireframe', 'xray', 'blackwhite'];
    const currentIndex = modes.indexOf(editor.viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setEditorState({ viewMode: modes[nextIndex] as any });
  }, [editor.viewMode, setEditorState]);
  
  // 切换网格显示
  const toggleGrid = useCallback(() => {
    setEditorState({ showGrid: !editor.showGrid });
  }, [editor.showGrid, setEditorState]);
  
  // 切换连接点显示
  const toggleConnections = useCallback(() => {
    setEditorState({ showConnections: !editor.showConnections });
  }, [editor.showConnections, setEditorState]);
  
  return {
    toggleViewMode,
    toggleGrid,
    toggleConnections,
    viewMode: editor.viewMode,
    showGrid: editor.showGrid,
    showConnections: editor.showConnections,
  };
};

// 导出所有Hook
export const useInteractions = () => {
  const mouseInteraction = useMouseInteraction();
  const keyboardShortcuts = useKeyboardShortcuts();
  const dragInteraction = useDragInteraction();
  const selectionInteraction = useSelectionInteraction();
  const viewInteraction = useViewInteraction();
  
  return {
    mouse: mouseInteraction,
    keyboard: keyboardShortcuts,
    drag: dragInteraction,
    selection: selectionInteraction,
    view: viewInteraction,
  };
};
