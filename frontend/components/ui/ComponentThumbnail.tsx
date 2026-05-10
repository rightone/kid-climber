import React, { useState, useEffect } from 'react';
import { getComponentThumbnail } from '../../utils/thumbnailUtils';

// 组件预览组件
export const ComponentThumbnail: React.FC<{
  componentId: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ componentId, size = 60, style }) => {
  const [thumbnail, setThumbnail] = useState<string>('');
  
  useEffect(() => {
    // 异步生成缩略图
    const generateThumbnail = () => {
      const result = getComponentThumbnail(componentId);
      setThumbnail(result);
    };
    
    generateThumbnail();
  }, [componentId]);
  
  if (!thumbnail) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#f5f5f5',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <span style={{ fontSize: 12, color: '#999' }}>加载中...</span>
      </div>
    );
  }
  
  return (
    <img
      src={thumbnail}
      alt={componentId}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        ...style,
      }}
    />
  );
};

export default ComponentThumbnail;
