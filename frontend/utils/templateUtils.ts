import { ComponentInstance, Connection } from '../types';

// 设计模板
export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  thumbnail: string;
  components: ComponentInstance[];
  connections: Connection[];
  tags: string[];
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// 模板分类
export type TemplateCategory = 
  | 'basic'
  | 'playground'
  | 'fitness'
  | 'custom'
  | 'community';

// 预设模板
export const presetTemplates: DesignTemplate[] = [
  {
    id: 'simple_frame',
    name: '简单框架',
    description: '一个简单的矩形框架结构，适合初学者',
    category: 'basic',
    difficulty: 'beginner',
    thumbnail: '/templates/simple_frame.png',
    components: [
      { instanceId: 'comp_1', componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_2', componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_3', componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_4', componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_5', componentId: 'elbow_90deg', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_6', componentId: 'elbow_90deg', position: [30, 0, 0], rotation: [0, 90, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_7', componentId: 'elbow_90deg', position: [0, 0, 30], rotation: [0, -90, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_8', componentId: 'elbow_90deg', position: [30, 0, 30], rotation: [0, 180, 0], scale: [1, 1, 1] },
    ],
    connections: [],
    tags: ['基础', '框架', '入门'],
    author: 'Kid Climber',
    version: '1.0',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'cube_frame',
    name: '立方体框架',
    description: '一个立方体框架结构，适合练习',
    category: 'basic',
    difficulty: 'intermediate',
    thumbnail: '/templates/cube_frame.png',
    components: [
      // 底部
      { instanceId: 'comp_1', componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_2', componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_3', componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_4', componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 顶部
      { instanceId: 'comp_5', componentId: 'pipe_30cm', position: [0, 30, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_6', componentId: 'pipe_30cm', position: [30, 30, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_7', componentId: 'pipe_30cm', position: [0, 30, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_8', componentId: 'pipe_30cm', position: [30, 30, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 立柱
      { instanceId: 'comp_9', componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_10', componentId: 'pipe_30cm', position: [30, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_11', componentId: 'pipe_30cm', position: [0, 0, 30], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_12', componentId: 'pipe_30cm', position: [30, 0, 30], rotation: [90, 0, 0], scale: [1, 1, 1] },
    ],
    connections: [],
    tags: ['立方体', '框架', '练习'],
    author: 'Kid Climber',
    version: '1.0',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'platform_structure',
    name: '平台结构',
    description: '带有平台的攀爬架结构',
    category: 'playground',
    difficulty: 'intermediate',
    thumbnail: '/templates/platform_structure.png',
    components: [
      // 底部框架
      { instanceId: 'comp_1', componentId: 'pipe_60cm', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_2', componentId: 'pipe_60cm', position: [60, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_3', componentId: 'pipe_60cm', position: [0, 0, 60], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_4', componentId: 'pipe_60cm', position: [60, 0, 60], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 立柱
      { instanceId: 'comp_5', componentId: 'pipe_30cm', position: [0, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_6', componentId: 'pipe_30cm', position: [60, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_7', componentId: 'pipe_30cm', position: [0, 0, 60], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_8', componentId: 'pipe_30cm', position: [60, 0, 60], rotation: [90, 0, 0], scale: [1, 1, 1] },
      // 平台
      { instanceId: 'comp_9', componentId: 'platform_large', position: [30, 30, 30], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ],
    connections: [],
    tags: ['平台', '攀爬架', '游乐场'],
    author: 'Kid Climber',
    version: '1.0',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'swing_set',
    name: '秋千套装',
    description: '带有秋千的完整套装',
    category: 'playground',
    difficulty: 'advanced',
    thumbnail: '/templates/swing_set.png',
    components: [
      // 顶部横梁
      { instanceId: 'comp_1', componentId: 'pipe_60cm', position: [0, 60, 0], rotation: [0, 0, 90], scale: [1, 1, 1] },
      // 左侧支撑
      { instanceId: 'comp_2', componentId: 'pipe_60cm', position: [-20, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_3', componentId: 'pipe_60cm', position: [-20, 60, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 右侧支撑
      { instanceId: 'comp_4', componentId: 'pipe_60cm', position: [20, 0, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_5', componentId: 'pipe_60cm', position: [20, 60, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 秋千
      { instanceId: 'comp_6', componentId: 'swing', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ],
    connections: [],
    tags: ['秋千', '游乐场', '完整套装'],
    author: 'Kid Climber',
    version: '1.0',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'slide_combo',
    name: '滑梯组合',
    description: '带有滑梯的攀爬架组合',
    category: 'playground',
    difficulty: 'advanced',
    thumbnail: '/templates/slide_combo.png',
    components: [
      // 平台
      { instanceId: 'comp_1', componentId: 'platform_medium', position: [0, 30, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 支撑柱
      { instanceId: 'comp_2', componentId: 'pipe_30cm', position: [-20, 0, -20], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_3', componentId: 'pipe_30cm', position: [20, 0, -20], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_4', componentId: 'pipe_30cm', position: [-20, 0, 20], rotation: [90, 0, 0], scale: [1, 1, 1] },
      { instanceId: 'comp_5', componentId: 'pipe_30cm', position: [20, 0, 20], rotation: [90, 0, 0], scale: [1, 1, 1] },
      // 滑梯
      { instanceId: 'comp_6', componentId: 'slide', position: [30, 15, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      // 梯子
      { instanceId: 'comp_7', componentId: 'rope_ladder', position: [-30, 15, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ],
    connections: [],
    tags: ['滑梯', '攀爬架', '组合'],
    author: 'Kid Climber',
    version: '1.0',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

// 模板管理器
export class TemplateManager {
  private templates: DesignTemplate[];
  private storageKey: string = 'kid_climber_templates';
  
  constructor() {
    this.templates = [...presetTemplates];
    this.loadFromStorage();
  }
  
  // 获取所有模板
  getTemplates(): DesignTemplate[] {
    return [...this.templates];
  }
  
  // 按分类获取模板
  getTemplatesByCategory(category: TemplateCategory): DesignTemplate[] {
    return this.templates.filter(template => template.category === category);
  }
  
  // 按难度获取模板
  getTemplatesByDifficulty(difficulty: DesignTemplate['difficulty']): DesignTemplate[] {
    return this.templates.filter(template => template.difficulty === difficulty);
  }
  
  // 搜索模板
  searchTemplates(query: string): DesignTemplate[] {
    const normalizedQuery = query.toLowerCase();
    
    return this.templates.filter(template => 
      template.name.toLowerCase().includes(normalizedQuery) ||
      template.description.toLowerCase().includes(normalizedQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  }
  
  // 获取模板
  getTemplate(id: string): DesignTemplate | undefined {
    return this.templates.find(template => template.id === id);
  }
  
  // 添加模板
  addTemplate(template: Omit<DesignTemplate, 'id' | 'createdAt' | 'updatedAt'>): DesignTemplate {
    const newTemplate: DesignTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.templates.push(newTemplate);
    this.saveToStorage();
    
    return newTemplate;
  }
  
  // 更新模板
  updateTemplate(id: string, updates: Partial<DesignTemplate>): DesignTemplate | null => {
    const index = this.templates.findIndex(template => template.id === id);
    
    if (index === -1) return null;
    
    this.templates[index] = {
      ...this.templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveToStorage();
    
    return this.templates[index];
  }
  
  // 删除模板
  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(template => template.id === id);
    
    if (index === -1) return false;
    
    // 不允许删除预设模板
    if (presetTemplates.some(template => template.id === id)) {
      return false;
    }
    
    this.templates.splice(index, 1);
    this.saveToStorage();
    
    return true;
  }
  
  // 从设计创建模板
  createTemplateFromDesign(
    name: string,
    description: string,
    category: TemplateCategory,
    components: ComponentInstance[],
    connections: Connection[],
    tags: string[] = []
  ): DesignTemplate {
    return this.addTemplate({
      name,
      description,
      category,
      difficulty: this.estimateDifficulty(components),
      thumbnail: '',
      components: JSON.parse(JSON.stringify(components)),
      connections: JSON.parse(JSON.stringify(connections)),
      tags,
      author: 'User',
      version: '1.0',
    });
  }
  
  // 估算难度
  private estimateDifficulty(components: ComponentInstance[]): DesignTemplate['difficulty'] {
    if (components.length <= 10) return 'beginner';
    if (components.length <= 30) return 'intermediate';
    return 'advanced';
  }
  
  // 从本地存储加载
  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const userTemplates = JSON.parse(saved);
        // 合并用户模板和预设模板
        this.templates = [...presetTemplates, ...userTemplates];
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  }
  
  // 保存到本地存储
  private saveToStorage(): void {
    try {
      // 只保存用户创建的模板
      const userTemplates = this.templates.filter(
        template => !presetTemplates.some(preset => preset.id === template.id)
      );
      localStorage.setItem(this.storageKey, JSON.stringify(userTemplates));
    } catch (error) {
      console.error('保存模板失败:', error);
    }
  }
  
  // 导出模板
  exportTemplate(id: string): string | null {
    const template = this.getTemplate(id);
    if (!template) return null;
    
    return JSON.stringify(template, null, 2);
  }
  
  // 导入模板
  importTemplate(json: string): DesignTemplate | null {
    try {
      const template = JSON.parse(json) as DesignTemplate;
      
      // 验证模板格式
      if (!template.name || !template.components) {
        return null;
      }
      
      // 生成新ID
      template.id = `template_${Date.now()}`;
      template.createdAt = new Date().toISOString();
      template.updatedAt = new Date().toISOString();
      
      this.templates.push(template);
      this.saveToStorage();
      
      return template;
    } catch (error) {
      console.error('导入模板失败:', error);
      return null;
    }
  }
}

// 创建单例
export const templateManager = new TemplateManager();

// 模板工具函数
export const templateUtils = {
  // 获取分类名称
  getCategoryName: (category: TemplateCategory): string => {
    switch (category) {
      case 'basic': return '基础';
      case 'playground': return '游乐场';
      case 'fitness': return '健身';
      case 'custom': return '自定义';
      case 'community': return '社区';
      default: return category;
    }
  },
  
  // 获取难度名称
  getDifficultyName: (difficulty: DesignTemplate['difficulty']): string => {
    switch (difficulty) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'advanced': return '高级';
      default: return difficulty;
    }
  },
  
  // 获取难度颜色
  getDifficultyColor: (difficulty: DesignTemplate['difficulty']): string => {
    switch (difficulty) {
      case 'beginner': return '#52c41a';
      case 'intermediate': return '#faad14';
      case 'advanced': return '#ff4d4f';
      default: return '#666666';
    }
  },
  
  // 获取所有分类
  getAllCategories: (): TemplateCategory[] => {
    return ['basic', 'playground', 'fitness', 'custom', 'community'];
  },
  
  // 获取所有难度
  getAllDifficulty: (): DesignTemplate['difficulty'][] => {
    return ['beginner', 'intermediate', 'advanced'];
  },
};
