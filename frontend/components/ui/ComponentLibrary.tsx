import React, { useState, useMemo } from 'react';
import { Input, Tag, Collapse, Tooltip, Empty, Button, Space, Switch } from 'antd';
import { SearchOutlined, AppstoreOutlined, BarsOutlined, AimOutlined } from '@ant-design/icons';
import { componentDefinitions, searchComponents, getCategories } from '../../stores/componentLibrary';
import { useInteractionStore } from '../../stores/interactionStore';
import { ComponentThumbnail } from './ComponentThumbnail';
import type { ComponentDefinition } from '../../types';

const { Panel } = Collapse;

// 组件预览卡片
interface ComponentCardProps {
  component: ComponentDefinition;
  compact?: boolean;
}

const ComponentCard: React.FC<ComponentCardProps> = React.memo(({ 
  component, 
  compact = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { startPlace } = useInteractionStore();
  const { interaction } = useInteractionStore();
  
  // 获取组件规格
  const getSpecifications = () => {
    const specs: string[] = [];
    if (component.length) specs.push(`${component.length}cm`);
    if (component.width && component.height) specs.push(`${component.width}×${component.height}cm`);
    if (component.angle) specs.push(`${component.angle}°`);
    if (component.diameter) specs.push(`⌀${component.diameter}cm`);
    return specs.join(' ');
  };
  
  // 处理点击 - 进入放置模式
  const handleClick = () => {
    startPlace(component.id);
  };
  
  const isPlacing = interaction.mode === 'place' && interaction.placeState.componentId === component.id;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: compact ? 6 : 10,
        border: isPlacing ? '2px solid #52c41a' : isHovered ? '2px solid #1890ff' : '1px solid #f0f0f0',
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: isPlacing ? '#f6ffed' : isHovered ? '#e6f7ff' : '#fff',
        boxShadow: isHovered ? '0 2px 8px rgba(24,144,255,0.15)' : 'none',
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ComponentThumbnail
        componentId={component.id}
        size={compact ? 32 : 40}
        style={{
          borderRadius: 4,
          marginRight: 8,
          flexShrink: 0,
          border: isPlacing ? '2px solid #52c41a' : '1px solid #f0f0f0',
        }}
      />
      
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
      
      {isPlacing && (
        <Tag color="success">放置中</Tag>
      )}
    </div>
  );
});

ComponentCard.displayName = 'ComponentCard';

// 组件库面板
const ComponentLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'category' | 'list'>('category');
  const { interaction, setSnapToGrid, setGridSize } = useInteractionStore();
  
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
  
  // 渲染组件列表
  const renderComponentList = (components: ComponentDefinition[]) => {
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
      />
    ));
  };
  
  // 渲染分类视图
  const renderCategoryView = () => {
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
  };
  
  // 渲染列表视图
  const renderListView = () => {
    return renderComponentList(displayComponents);
  };
  
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
        {viewMode === 'category' ? renderCategoryView() : renderListView()}
      </div>
      
      {/* 吸附设置 */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>
          <AimOutlined /> 吸附设置
        </div>
        
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12 }}>网格吸附</span>
            <Switch
              size="small"
              checked={interaction.snapToGrid}
              onChange={setSnapToGrid}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12 }}>网格大小</span>
            <Space size={4}>
              {[5, 10, 20, 50].map(size => (
                <Button
                  key={size}
                  size="small"
                  type={interaction.gridSize === size ? 'primary' : 'default'}
                  onClick={() => setGridSize(size)}
                >
                  {size}
                </Button>
              ))}
            </Space>
          </div>
        </Space>
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
        <div>💡 点击组件进入放置模式</div>
        <div>💡 在3D视图点击放置组件</div>
        <div>💡 按 ESC 取消放置</div>
        <div>💡 按 V 切换选择模式</div>
        <div>💡 按 M 切换移动模式</div>
      </div>
    </div>
  );
};

export default ComponentLibrary;
