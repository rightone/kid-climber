import { useMemo, useState, useCallback } from 'react';
import { ComponentDefinition } from '../types';
import { componentDefinitions } from '../stores/componentLibrary';

// 搜索配置
export interface SearchConfig {
  caseSensitive: boolean;
  matchWholeWord: boolean;
  searchFields: ('name' | 'type' | 'category' | 'description')[];
  maxResults: number;
}

// 过滤配置
export interface FilterConfig {
  categories: string[];
  types: string[];
  minLength?: number;
  maxLength?: number;
  minDiameter?: number;
  maxDiameter?: number;
  hasConnectionPoints?: boolean;
}

// 搜索结果
export interface SearchResult {
  component: ComponentDefinition;
  score: number;
  matchedFields: string[];
}

// 组件搜索引擎
export class ComponentSearchEngine {
  private components: ComponentDefinition[];
  private searchConfig: SearchConfig;
  
  constructor(components: ComponentDefinition[], config?: Partial<SearchConfig>) {
    this.components = components;
    this.searchConfig = {
      caseSensitive: false,
      matchWholeWord: false,
      searchFields: ['name', 'type', 'category'],
      maxResults: 50,
      ...config,
    };
  }
  
  // 搜索组件
  search(query: string): SearchResult[] {
    if (!query.trim()) {
      return this.components.map(component => ({
        component,
        score: 1,
        matchedFields: [],
      }));
    }
    
    const results: SearchResult[] = [];
    const normalizedQuery = this.searchConfig.caseSensitive 
      ? query 
      : query.toLowerCase();
    
    this.components.forEach(component => {
      const score = this.calculateScore(component, normalizedQuery);
      
      if (score > 0) {
        results.push({
          component,
          score,
          matchedFields: this.getMatchedFields(component, normalizedQuery),
        });
      }
    });
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    // 限制结果数量
    return results.slice(0, this.searchConfig.maxResults);
  }
  
  // 计算匹配分数
  private calculateScore(component: ComponentDefinition, query: string): number {
    let totalScore = 0;
    
    this.searchConfig.searchFields.forEach(field => {
      const value = this.getFieldValue(component, field);
      if (!value) return;
      
      const normalizedValue = this.searchConfig.caseSensitive 
        ? value 
        : value.toLowerCase();
      
      // 完全匹配
      if (normalizedValue === query) {
        totalScore += 10;
      }
      // 开头匹配
      else if (normalizedValue.startsWith(query)) {
        totalScore += 8;
      }
      // 包含匹配
      else if (normalizedValue.includes(query)) {
        totalScore += 5;
      }
      // 模糊匹配
      else if (this.fuzzyMatch(normalizedValue, query)) {
        totalScore += 3;
      }
    });
    
    return totalScore;
  }
  
  // 获取匹配的字段
  private getMatchedFields(component: ComponentDefinition, query: string): string[] {
    const matchedFields: string[] = [];
    
    this.searchConfig.searchFields.forEach(field => {
      const value = this.getFieldValue(component, field);
      if (!value) return;
      
      const normalizedValue = this.searchConfig.caseSensitive 
        ? value 
        : value.toLowerCase();
      
      if (normalizedValue.includes(query)) {
        matchedFields.push(field);
      }
    });
    
    return matchedFields;
  }
  
  // 获取字段值
  private getFieldValue(component: ComponentDefinition, field: string): string {
    switch (field) {
      case 'name':
        return component.name;
      case 'type':
        return component.type;
      case 'category':
        return component.category;
      case 'description':
        return (component as any).description || '';
      default:
        return '';
    }
  }
  
  // 模糊匹配
  private fuzzyMatch(text: string, query: string): boolean {
    let queryIndex = 0;
    
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === query.length;
  }
  
  // 更新配置
  updateConfig(config: Partial<SearchConfig>): void {
    this.searchConfig = { ...this.searchConfig, ...config };
  }
  
  // 更新组件列表
  updateComponents(components: ComponentDefinition[]): void {
    this.components = components;
  }
}

// 组件过滤器
export class ComponentFilter {
  private components: ComponentDefinition[];
  private filterConfig: FilterConfig;
  
  constructor(components: ComponentDefinition[], config?: Partial<FilterConfig>) {
    this.components = components;
    this.filterConfig = {
      categories: [],
      types: [],
      ...config,
    };
  }
  
  // 过滤组件
  filter(): ComponentDefinition[] {
    return this.components.filter(component => {
      // 分类过滤
      if (this.filterConfig.categories.length > 0) {
        if (!this.filterConfig.categories.includes(component.category)) {
          return false;
        }
      }
      
      // 类型过滤
      if (this.filterConfig.types.length > 0) {
        if (!this.filterConfig.types.includes(component.type)) {
          return false;
        }
      }
      
      // 长度过滤
      if (this.filterConfig.minLength !== undefined && component.length) {
        if (component.length < this.filterConfig.minLength) {
          return false;
        }
      }
      
      if (this.filterConfig.maxLength !== undefined && component.length) {
        if (component.length > this.filterConfig.maxLength) {
          return false;
        }
      }
      
      // 直径过滤
      if (this.filterConfig.minDiameter !== undefined && component.diameter) {
        if (component.diameter < this.filterConfig.minDiameter) {
          return false;
        }
      }
      
      if (this.filterConfig.maxDiameter !== undefined && component.diameter) {
        if (component.diameter > this.filterConfig.maxDiameter) {
          return false;
        }
      }
      
      // 连接点过滤
      if (this.filterConfig.hasConnectionPoints !== undefined) {
        if (this.filterConfig.hasConnectionPoints && component.connectionPoints.length === 0) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // 更新配置
  updateConfig(config: Partial<FilterConfig>): void {
    this.filterConfig = { ...this.filterConfig, ...config };
  }
  
  // 更新组件列表
  updateComponents(components: ComponentDefinition[]): void {
    this.components = components;
  }
  
  // 获取可用的分类
  getAvailableCategories(): string[] {
    const categories = new Set<string>();
    this.components.forEach(component => categories.add(component.category));
    return Array.from(categories);
  }
  
  // 获取可用的类型
  getAvailableTypes(): string[] {
    const types = new Set<string>();
    this.components.forEach(component => types.add(component.type));
    return Array.from(types);
  }
}

// 搜索和过滤Hook
export const useComponentSearch = (components: ComponentDefinition[] = componentDefinitions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    categories: [],
    types: [],
  });
  
  const searchEngine = useMemo(() => {
    return new ComponentSearchEngine(components);
  }, [components]);
  
  const filter = useMemo(() => {
    return new ComponentFilter(components);
  }, [components]);
  
  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return components.map(component => ({
        component,
        score: 1,
        matchedFields: [],
      }));
    }
    
    return searchEngine.search(searchQuery);
  }, [searchQuery, searchEngine, components]);
  
  // 过滤结果
  const filteredComponents = useMemo(() => {
    filter.updateConfig(filterConfig);
    return filter.filter();
  }, [filterConfig, filter]);
  
  // 最终结果（搜索 + 过滤）
  const finalResults = useMemo(() => {
    const filteredIds = new Set(filteredComponents.map(c => c.id));
    
    return searchResults.filter(result => 
      filteredIds.has(result.component.id)
    );
  }, [searchResults, filteredComponents]);
  
  // 更新搜索查询
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);
  
  // 更新过滤配置
  const updateFilterConfig = useCallback((config: Partial<FilterConfig>) => {
    setFilterConfig(prev => ({ ...prev, ...config }));
  }, []);
  
  // 清除过滤
  const clearFilters = useCallback(() => {
    setFilterConfig({
      categories: [],
      types: [],
    });
    setSearchQuery('');
  }, []);
  
  // 获取可用分类
  const availableCategories = useMemo(() => {
    return filter.getAvailableCategories();
  }, [filter]);
  
  // 获取可用类型
  const availableTypes = useMemo(() => {
    return filter.getAvailableTypes();
  }, [filter]);
  
  return {
    searchQuery,
    filterConfig,
    searchResults,
    filteredComponents,
    finalResults,
    updateSearchQuery,
    updateFilterConfig,
    clearFilters,
    availableCategories,
    availableTypes,
  };
};

// 搜索建议
export const getSearchSuggestions = (query: string, components: ComponentDefinition[]): string[] => {
  if (!query.trim()) {
    return [];
  }
  
  const suggestions = new Set<string>();
  const normalizedQuery = query.toLowerCase();
  
  components.forEach(component => {
    // 名称建议
    if (component.name.toLowerCase().includes(normalizedQuery)) {
      suggestions.add(component.name);
    }
    
    // 类型建议
    if (component.type.toLowerCase().includes(normalizedQuery)) {
      suggestions.add(component.type);
    }
    
    // 分类建议
    if (component.category.toLowerCase().includes(normalizedQuery)) {
      suggestions.add(component.category);
    }
  });
  
  return Array.from(suggestions).slice(0, 10);
};

// 高亮搜索结果
export const highlightSearchResult = (text: string, query: string): string => {
  if (!query.trim()) {
    return text;
  }
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

// 搜索历史
export class SearchHistory {
  private history: string[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 10) {
    this.maxSize = maxSize;
    this.loadFromStorage();
  }
  
  // 添加搜索记录
  add(query: string): void {
    if (!query.trim()) return;
    
    // 移除重复项
    this.history = this.history.filter(item => item !== query);
    
    // 添加到开头
    this.history.unshift(query);
    
    // 限制大小
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(0, this.maxSize);
    }
    
    this.saveToStorage();
  }
  
  // 获取历史记录
  getHistory(): string[] {
    return [...this.history];
  }
  
  // 清除历史记录
  clear(): void {
    this.history = [];
    this.saveToStorage();
  }
  
  // 从本地存储加载
  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('kid_climber_search_history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  }
  
  // 保存到本地存储
  private saveToStorage(): void {
    try {
      localStorage.setItem('kid_climber_search_history', JSON.stringify(this.history));
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }
}

// 创建单例
export const searchHistory = new SearchHistory();
