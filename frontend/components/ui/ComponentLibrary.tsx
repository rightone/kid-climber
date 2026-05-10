import React, { useState, useMemo, useCallback } from 'react';
import { Input, Tag, Collapse, Tooltip, Empty, Spin, Badge, Button, Space } from 'antd';
import { SearchOutlined, AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { componentDefinitions, searchComponents, getCategories } from '../../stores/componentLibrary';
import { useDesignStore } from '../../stores/designStore';
import type { ComponentDefinition } from '../../types';

const { Panel } = Collapse;

// 组件预览卡片
interface ComponentCardProps {
  component: ComponentDefinition;
  onSelect: (componentId: string) => void;
  onDragStart: (e: React.DragEvent, componentId: string) => void;
  compact?: boolean;
}

const ComponentCard: React.FC<ComponentCardProps> = React.memo(({ 
  component, 
  onSelect, 
  onDragStart, 
  compact = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // 获取组件图标
  const getComponentIcon = () => {
    switch (component.type) {
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
  
  // 获取组件规格
  const getSpecifications = () => {
    const specs: string[] = [];
    if (component.length) specs.push(`${component.length}cm`);
    if (component.width && component.height) specs.push(`${component.width}×${component.height}cm`);
    if (component.angle) specs.push(`${component.angle}°`);
    if (component.diameter) specs.push(`⌀${component.diameter}cm`);
    return specs.join(' ');
  };
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: compact ? 6 : 10,
        border: isHovered ? '2px solid #1890ff' : '1px solid #f0f0f0',
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'grab',
        transition: 'all 0.2s',
        background: isHovered ? '#e6f7ff' : '#fff',
        boxShadow: isHovered ? '0 2px 8px rgba(24,144,255,0.15)' : 'none',
      }}
      draggable
      onDragStart={(e) => onDragStart(e, component.id)}
      onClick={() => onSelect(component.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          width: compact ? 32 : 40,
          height: compact ? 32 : 40,
          background: '#f5f5f5',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 16 : 20,
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        {getComponentIcon()}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: compact ? 12 : 13, 
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {component.name}
        </div>
        {!compact && (
          <div style={{ fontSize: 11, color: '#666' }}>
            {getSpecifications()}
          </div>
        )}
      </div>
      
      {!compact && (
        <Tooltip title="连接点数量">
          <Badge
            count={component.connectionPoints.length}
            style={{ backgroundColor: '#52c41a', fontSize: 10 }}
            size="small"
          />
        </Tooltip>
      )}
    </div>
  );
});

ComponentCard.displayName = 'ComponentCard';

// 组件库面板
const ComponentLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'category' | 'list'>('category');
  const [loading, setLoading] = useState(false);
  const { addComponent } = useDesignStore();
  
  // 获取分类
  const categories = useMemo(() => getCategories(), []);
  
  // 获取显示的组件列表
  const displayComponents = useMemo(() => {
    if (searchQuery) {
      return searchComponents(searchQuery);
    }
    return componentDefinitions;
  }, [searchQuery]);
  
  // 按分类分组的组件
  const groupedComponents = useMemo(() => {
    const groups: Record<string, ComponentDefinition[]> = {};
    categories.forEach(category => {
      groups[category.key] = displayComponents.filter(
        comp => comp.category === category.key
      );
    });
    return groups;
  }, [displayComponents, categories]);
  
  // 处理组件拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData('componentId', componentId);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);
  
  // 处理组件点击（添加到场景中心）
  const handleComponentClick = useCallback((componentId: string) => {
    setLoading(true);
    
    // 创建新组件
    const newComponent = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      componentId,
      position: [
        Math.random() * 40 - 20,
        0,
        Math.random() * 40 - 20,
      ] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    
    addComponent(newComponent);
    
    setTimeout(() => setLoading(false), 100);
  }, [addComponent]);
  
  // 渲染组件列表
  const renderComponentList = useCallback((components: ComponentDefinition[]) => {
    if (components.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="没有找到匹配的组件"
          style={{ margin: '20px 0' }}
        />
      );
    }
    
    return components.map(component => (
      <ComponentCard
        key={component.id}
        component={component}
        onSelect={handleComponentClick}
        onDragStart={handleDragStart}
      />
    ));
  }, [handleComponentClick, handleDragStart]);
  
  // 渲染分类视图
  const renderCategoryView = useCallback(() => {
    return (
      <Collapse defaultActiveKey={categories.map(c => c.key)} ghost>
        {categories.map(category => {
          const categoryComponents = groupedComponents[category.key];
          if (!categoryComponents || categoryComponents.length === 0) {
            return null;
          }
          
          return (
            <Panel
              key={category.key}
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{category.icon}</span>
                  <Tag color={category.color}>{category.name}</Tag>
                  <span style={{ color: '#666', fontSize: 12 }}>
                    {categoryComponents.length} 个组件
                  </span>
                </div>
              }
            >
              {renderComponentList(categoryComponents)}
            </Panel>
          );
        })}
      </Collapse>
    );
  }, [categories, groupedComponents, renderComponentList]);
  
  // 渲染列表视图
  const renderListView = useCallback(() => {
    return renderComponentList(displayComponents);
  }, [displayComponents, renderComponentList]);
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索和视图切换 */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="搜索组件..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
          style={{ marginBottom: 8 }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>
            共 {displayComponents.length} 个组件
          </span>
          
          <Space size={4}>
            <Tooltip title="分类视图">
              <Button
                type={viewMode === 'category' ? 'primary' : 'text'}
                icon={<AppstoreOutlined />}
                size="small"
                onClick={() => setViewMode('category')}
              />
            </Tooltip>
            <Tooltip title="列表视图">
              <Button
                type={viewMode === 'list' ? 'primary' : 'text'}
                icon={<BarsOutlined />}
                size="small"
                onClick={() => setViewMode('list')}
              />
            </Tooltip>
          </Space>
        </div>
      </div>
      
      {/* 组件列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <Spin spinning={loading}>
          {viewMode === 'category' ? renderCategoryView() : renderListView()}
        </Spin>
      </div>
      
      {/* 使用说明 */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #f0f0f0',
          fontSize: 11,
          color: '#999',
          lineHeight: 1.6,
        }}
      >
        <div>💡 点击组件添加到设计</div>
        <div>💡 拖拽组件到3D视图放置</div>
        <div>💡 支持按名称、类型搜索</div>
      </div>
    </div>
  );
};

export default ComponentLibrary;
