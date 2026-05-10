import { useState, useCallback, useEffect } from 'react';

// 教程步骤
export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS选择器
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'drag' | 'hover' | 'scroll';
  actionTarget?: string;
  skippable: boolean;
  highlight?: boolean;
}

// 教程配置
export interface TutorialConfig {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  autoStart: boolean;
  showProgress: boolean;
  allowSkip: boolean;
}

// 预设教程
export const presetTutorials: TutorialConfig[] = [
  {
    id: 'beginner',
    name: '新手入门',
    description: '学习基本操作和界面布局',
    autoStart: true,
    showProgress: true,
    allowSkip: true,
    steps: [
      {
        id: 'welcome',
        title: '欢迎使用 Kid Climber',
        content: '本教程将引导您了解软件的基本功能和操作方法。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'component_library',
        title: '组件库',
        content: '左侧面板是组件库，包含各种攀爬架组件。点击组件可以添加到设计中。',
        target: '[data-tutorial="component-library"]',
        position: 'right',
        highlight: true,
        skippable: true,
      },
      {
        id: '3d_view',
        title: '3D视图',
        content: '中间区域是3D设计视图。使用鼠标可以旋转、缩放和平移视图。',
        target: '[data-tutorial="3d-view"]',
        position: 'left',
        highlight: true,
        skippable: true,
      },
      {
        id: 'properties_panel',
        title: '属性面板',
        content: '右侧面板显示选中组件的属性，可以修改位置、旋转等参数。',
        target: '[data-tutorial="properties-panel"]',
        position: 'left',
        highlight: true,
        skippable: true,
      },
      {
        id: 'toolbar',
        title: '工具栏',
        content: '顶部工具栏包含常用操作按钮，如撤销、重做、删除等。',
        target: '[data-tutorial="toolbar"]',
        position: 'bottom',
        highlight: true,
        skippable: true,
      },
      {
        id: 'add_component',
        title: '添加组件',
        content: '现在尝试从组件库点击一个组件，将其添加到3D视图中。',
        target: '[data-tutorial="component-library"]',
        position: 'right',
        action: 'click',
        actionTarget: '[data-component="pipe_30cm"]',
        skippable: true,
      },
      {
        id: 'select_component',
        title: '选择组件',
        content: '在3D视图中点击组件进行选择。选中的组件会高亮显示。',
        target: '[data-tutorial="3d-view"]',
        position: 'left',
        action: 'click',
        skippable: true,
      },
      {
        id: 'move_component',
        title: '移动组件',
        content: '选中组件后，可以拖拽移动组件到新位置。',
        target: '[data-tutorial="3d-view"]',
        position: 'left',
        action: 'drag',
        skippable: true,
      },
      {
        id: 'rotate_component',
        title: '旋转组件',
        content: '在右侧属性面板中，可以修改组件的旋转角度。',
        target: '[data-tutorial="properties-panel"]',
        position: 'left',
        skippable: true,
      },
      {
        id: 'complete',
        title: '教程完成',
        content: '恭喜！您已经学会了基本操作。现在可以开始设计您的攀爬架了！',
        position: 'bottom',
        skippable: true,
      },
    ],
  },
  {
    id: 'advanced',
    name: '高级功能',
    description: '学习高级功能和技巧',
    autoStart: false,
    showProgress: true,
    allowSkip: true,
    steps: [
      {
        id: 'shortcuts',
        title: '快捷键',
        content: '使用快捷键可以提高工作效率。按V切换选择工具，M切换移动工具，R切换旋转工具。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'multi_select',
        title: '多选组件',
        content: '按住Shift键点击多个组件进行多选，或使用框选功能。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'copy_paste',
        title: '复制粘贴',
        content: '使用Ctrl+C复制选中组件，Ctrl+V粘贴组件。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'undo_redo',
        title: '撤销重做',
        content: '使用Ctrl+Z撤销操作，Ctrl+Y重做操作。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'view_modes',
        title: '视图模式',
        content: '按1/2/3/4切换不同视图模式：真实感、线框、X光、黑白。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'grid_snap',
        title: '网格吸附',
        content: '按G切换网格显示，组件会自动吸附到网格位置。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'connection_points',
        title: '连接点',
        content: '按L切换连接点显示。将组件拖到连接点附近会自动吸附。',
        position: 'bottom',
        skippable: true,
      },
      {
        id: 'templates',
        title: '设计模板',
        content: '右侧面板中的"模板"标签页提供预设模板，可以快速开始设计。',
        position: 'left',
        skippable: true,
      },
      {
        id: 'analysis',
        title: '结构分析',
        content: '切换到"分析"标签页，点击"分析"按钮检查结构稳定性。',
        position: 'left',
        skippable: true,
      },
      {
        id: 'export',
        title: '导出设计',
        content: '使用文件菜单导出设计为图片、3D模型或材料清单。',
        position: 'bottom',
        skippable: true,
      },
    ],
  },
];

// 教程管理器
export class TutorialManager {
  private tutorials: TutorialConfig[];
  private completedTutorials: Set<string>;
  private currentTutorial: TutorialConfig | null;
  private currentStepIndex: number;
  private isActive: boolean;
  
  constructor() {
    this.tutorials = [...presetTutorials];
    this.completedTutorials = new Set();
    this.currentTutorial = null;
    this.currentStepIndex = 0;
    this.isActive = false;
    
    this.loadFromStorage();
  }
  
  // 获取所有教程
  getTutorials(): TutorialConfig[] {
    return [...this.tutorials];
  }
  
  // 获取教程
  getTutorial(id: string): TutorialConfig | undefined {
    return this.tutorials.find(tutorial => tutorial.id === id);
  }
  
  // 开始教程
  startTutorial(id: string): boolean {
    const tutorial = this.getTutorial(id);
    if (!tutorial) return false;
    
    this.currentTutorial = tutorial;
    this.currentStepIndex = 0;
    this.isActive = true;
    
    return true;
  }
  
  // 停止教程
  stopTutorial(): void {
    this.currentTutorial = null;
    this.currentStepIndex = 0;
    this.isActive = false;
  }
  
  // 完成教程
  completeTutorial(): void {
    if (this.currentTutorial) {
      this.completedTutorials.add(this.currentTutorial.id);
      this.saveToStorage();
    }
    
    this.stopTutorial();
  }
  
  // 下一步
  nextStep(): boolean {
    if (!this.currentTutorial || !this.isActive) return false;
    
    if (this.currentStepIndex < this.currentTutorial.steps.length - 1) {
      this.currentStepIndex++;
      return true;
    }
    
    // 教程完成
    this.completeTutorial();
    return false;
  }
  
  // 上一步
  previousStep(): boolean {
    if (!this.currentTutorial || !this.isActive) return false;
    
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      return true;
    }
    
    return false;
  }
  
  // 跳过步骤
  skipStep(): boolean {
    if (!this.currentTutorial || !this.isActive) return false;
    
    const currentStep = this.getCurrentStep();
    if (!currentStep?.skippable) return false;
    
    return this.nextStep();
  }
  
  // 获取当前步骤
  getCurrentStep(): TutorialStep | null {
    if (!this.currentTutorial || !this.isActive) return null;
    
    return this.currentTutorial.steps[this.currentStepIndex];
  }
  
  // 获取当前步骤索引
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }
  
  // 获取总步骤数
  getTotalSteps(): number {
    return this.currentTutorial?.steps.length || 0;
  }
  
  // 是否激活
  getIsActive(): boolean {
    return this.isActive;
  }
  
  // 是否已完成
  isCompleted(id: string): boolean {
    return this.completedTutorials.has(id);
  }
  
  // 获取自动开始的教程
  getAutoStartTutorial(): TutorialConfig | null {
    return this.tutorials.find(t => 
      t.autoStart && !this.completedTutorials.has(t.id)
    ) || null;
  }
  
  // 重置教程
  resetTutorial(id: string): void {
    this.completedTutorials.delete(id);
    this.saveToStorage();
  }
  
  // 重置所有教程
  resetAllTutorials(): void {
    this.completedTutorials.clear();
    this.saveToStorage();
  }
  
  // 从本地存储加载
  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('kid_climber_tutorials');
      if (saved) {
        const data = JSON.parse(saved);
        this.completedTutorials = new Set(data.completed || []);
      }
    } catch (error) {
      console.error('加载教程状态失败:', error);
    }
  }
  
  // 保存到本地存储
  private saveToStorage(): void {
    try {
      const data = {
        completed: Array.from(this.completedTutorials),
      };
      localStorage.setItem('kid_climber_tutorials', JSON.stringify(data));
    } catch (error) {
      console.error('保存教程状态失败:', error);
    }
  }
}

// 创建单例
export const tutorialManager = new TutorialManager();

// 教程Hook
export const useTutorial = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  
  // 开始教程
  const start = useCallback((id: string) => {
    const success = tutorialManager.startTutorial(id);
    if (success) {
      setIsActive(true);
      setCurrentStep(tutorialManager.getCurrentStep());
      setStepIndex(tutorialManager.getCurrentStepIndex());
      setTotalSteps(tutorialManager.getTotalSteps());
    }
    return success;
  }, []);
  
  // 停止教程
  const stop = useCallback(() => {
    tutorialManager.stopTutorial();
    setIsActive(false);
    setCurrentStep(null);
    setStepIndex(0);
    setTotalSteps(0);
  }, []);
  
  // 下一步
  const next = useCallback(() => {
    const hasMore = tutorialManager.nextStep();
    if (hasMore) {
      setCurrentStep(tutorialManager.getCurrentStep());
      setStepIndex(tutorialManager.getCurrentStepIndex());
    } else {
      stop();
    }
    return hasMore;
  }, [stop]);
  
  // 上一步
  const previous = useCallback(() => {
    const hasPrevious = tutorialManager.previousStep();
    if (hasPrevious) {
      setCurrentStep(tutorialManager.getCurrentStep());
      setStepIndex(tutorialManager.getCurrentStepIndex());
    }
    return hasPrevious;
  }, []);
  
  // 跳过步骤
  const skip = useCallback(() => {
    const hasMore = tutorialManager.skipStep();
    if (hasMore) {
      setCurrentStep(tutorialManager.getCurrentStep());
      setStepIndex(tutorialManager.getCurrentStepIndex());
    } else {
      stop();
    }
    return hasMore;
  }, [stop]);
  
  // 检查是否已完成
  const isCompleted = useCallback((id: string) => {
    return tutorialManager.isCompleted(id);
  }, []);
  
  // 获取自动开始的教程
  const getAutoStartTutorial = useCallback(() => {
    return tutorialManager.getAutoStartTutorial();
  }, []);
  
  return {
    isActive,
    currentStep,
    stepIndex,
    totalSteps,
    start,
    stop,
    next,
    previous,
    skip,
    isCompleted,
    getAutoStartTutorial,
  };
};

// 帮助内容
export const helpContent = {
  // 快捷键帮助
  shortcuts: [
    { key: 'Ctrl+Z', description: '撤销' },
    { key: 'Ctrl+Y', description: '重做' },
    { key: 'Ctrl+C', description: '复制' },
    { key: 'Ctrl+V', description: '粘贴' },
    { key: 'Ctrl+D', description: '复制选中组件' },
    { key: 'Ctrl+A', description: '全选' },
    { key: 'Delete', description: '删除选中组件' },
    { key: 'Escape', description: '取消选择' },
    { key: 'V', description: '选择工具' },
    { key: 'M', description: '移动工具' },
    { key: 'R', description: '旋转工具' },
    { key: 'G', description: '切换网格显示' },
    { key: 'L', description: '切换连接点显示' },
    { key: '1', description: '真实感模式' },
    { key: '2', description: '线框模式' },
    { key: '3', description: 'X光模式' },
    { key: '4', description: '黑白模式' },
  ],
  
  // 常见问题
  faq: [
    {
      question: '如何添加组件？',
      answer: '从左侧面板点击组件，或拖拽组件到3D视图中。',
    },
    {
      question: '如何移动组件？',
      answer: '选中组件后，使用鼠标拖拽移动，或在属性面板中修改坐标。',
    },
    {
      question: '如何旋转组件？',
      answer: '在右侧属性面板中修改旋转角度，或使用快捷键R。',
    },
    {
      question: '如何删除组件？',
      answer: '选中组件后按Delete键，或点击工具栏的删除按钮。',
    },
    {
      question: '如何撤销操作？',
      answer: '按Ctrl+Z撤销，Ctrl+Y重做。',
    },
    {
      question: '如何保存设计？',
      answer: '点击文件菜单的"保存"按钮，或使用Ctrl+S快捷键。',
    },
    {
      question: '如何导出设计？',
      answer: '点击文件菜单的"导出"按钮，选择导出格式。',
    },
    {
      question: '如何查看材料清单？',
      answer: '切换到右侧面板的"材料"标签页。',
    },
    {
      question: '如何检查结构稳定性？',
      answer: '切换到右侧面板的"分析"标签页，点击"分析"按钮。',
    },
  ],
  
  // 视频教程
  videoTutorials: [
    {
      id: 'quick_start',
      title: '快速入门',
      description: '5分钟学会基本操作',
      url: '/tutorials/quick_start.mp4',
      duration: '5:00',
    },
    {
      id: 'advanced_design',
      title: '高级设计技巧',
      description: '学习高级设计功能',
      url: '/tutorials/advanced_design.mp4',
      duration: '10:00',
    },
    {
      id: 'material_analysis',
      title: '材料分析',
      description: '如何使用材料分析功能',
      url: '/tutorials/material_analysis.mp4',
      duration: '8:00',
    },
  ],
};

// 帮助管理器
export class HelpManager {
  private searchIndex: Map<string, string[]>;
  
  constructor() {
    this.searchIndex = new Map();
    this.buildSearchIndex();
  }
  
  // 构建搜索索引
  private buildSearchIndex(): void {
    // 快捷键索引
    helpContent.shortcuts.forEach(item => {
      const words = [item.key, item.description].join(' ').toLowerCase().split(' ');
      words.forEach(word => {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        this.searchIndex.get(word)!.push(`shortcut:${item.key}`);
      });
    });
    
    // FAQ索引
    helpContent.faq.forEach((item, index) => {
      const words = [item.question, item.answer].join(' ').toLowerCase().split(' ');
      words.forEach(word => {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        this.searchIndex.get(word)!.push(`faq:${index}`);
      });
    });
  }
  
  // 搜索帮助
  search(query: string): { type: string; item: any }[] {
    const normalizedQuery = query.toLowerCase();
    const results: { type: string; item: any }[] = [];
    const seen = new Set<string>();
    
    // 搜索快捷键
    helpContent.shortcuts.forEach(item => {
      if (
        item.key.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery)
      ) {
        const key = `shortcut:${item.key}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ type: 'shortcut', item });
        }
      }
    });
    
    // 搜索FAQ
    helpContent.faq.forEach(item => {
      if (
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery)
      ) {
        const key = `faq:${item.question}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ type: 'faq', item });
        }
      }
    });
    
    return results;
  }
  
  // 获取快捷键帮助
  getShortcuts(): typeof helpContent.shortcuts {
    return helpContent.shortcuts;
  }
  
  // 获取FAQ
  getFAQ(): typeof helpContent.faq {
    return helpContent.faq;
  }
  
  // 获取视频教程
  getVideoTutorials(): typeof helpContent.videoTutorials {
    return helpContent.videoTutorials;
  }
}

// 创建单例
export const helpManager = new HelpManager();
