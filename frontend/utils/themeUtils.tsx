import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';

// 主题类型
export type ThemeType = 'light' | 'dark' | 'blue' | 'green';

// 主题配置
export interface ThemeConfig {
  type: ThemeType;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  shadowColor: string;
}

// 预设主题
export const themePresets: Record<ThemeType, ThemeConfig> = {
  light: {
    type: 'light',
    primaryColor: '#1890ff',
    backgroundColor: '#ffffff',
    textColor: '#333333',
    borderColor: '#f0f0f0',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    type: 'dark',
    primaryColor: '#177ddc',
    backgroundColor: '#141414',
    textColor: '#ffffff',
    borderColor: '#303030',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
  },
  blue: {
    type: 'blue',
    primaryColor: '#2f54eb',
    backgroundColor: '#f0f5ff',
    textColor: '#1d39c4',
    borderColor: '#adc6ff',
    shadowColor: 'rgba(47, 84, 235, 0.1)',
  },
  green: {
    type: 'green',
    primaryColor: '#52c41a',
    backgroundColor: '#f6ffed',
    textColor: '#389e0d',
    borderColor: '#b7eb8f',
    shadowColor: 'rgba(82, 196, 26, 0.1)',
  },
};

// 主题上下文
interface ThemeContextType {
  currentTheme: ThemeType;
  themeConfig: ThemeConfig;
  setTheme: (type: ThemeType) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: 'light',
  themeConfig: themePresets.light,
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
});

// 主题提供者
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('kid_climber_theme');
    return (saved as ThemeType) || 'light';
  });
  
  const themeConfig = themePresets[currentTheme];
  const isDark = currentTheme === 'dark';
  
  // 设置主题
  const setTheme = useCallback((type: ThemeType) => {
    setCurrentTheme(type);
    localStorage.setItem('kid_climber_theme', type);
    
    // 更新CSS变量
    document.documentElement.style.setProperty('--primary-color', themePresets[type].primaryColor);
    document.documentElement.style.setProperty('--background-color', themePresets[type].backgroundColor);
    document.documentElement.style.setProperty('--text-color', themePresets[type].textColor);
    document.documentElement.style.setProperty('--border-color', themePresets[type].borderColor);
    document.documentElement.style.setProperty('--shadow-color', themePresets[type].shadowColor);
  }, []);
  
  // 切换主题
  const toggleTheme = useCallback(() => {
    const themes: ThemeType[] = ['light', 'dark', 'blue', 'green'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }, [currentTheme, setTheme]);
  
  // 初始化主题
  useEffect(() => {
    setTheme(currentTheme);
  }, [currentTheme, setTheme]);
  
  // Ant Design主题配置
  const antdTheme = {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: themeConfig.primaryColor,
      colorBgContainer: themeConfig.backgroundColor,
      colorText: themeConfig.textColor,
      colorBorder: themeConfig.borderColor,
      borderRadius: 6,
    },
  };
  
  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeConfig,
        setTheme,
        toggleTheme,
        isDark,
      }}
    >
      <ConfigProvider theme={antdTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

// 使用主题Hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// 主题切换按钮组件
export const ThemeSwitchButton: React.FC = () => {
  const { currentTheme, toggleTheme, isDark } = useTheme();
  
  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'blue':
        return '💙';
      case 'green':
        return '💚';
      default:
        return '☀️';
    }
  };
  
  const getThemeName = () => {
    switch (currentTheme) {
      case 'light':
        return '浅色主题';
      case 'dark':
        return '深色主题';
      case 'blue':
        return '蓝色主题';
      case 'green':
        return '绿色主题';
      default:
        return '浅色主题';
    }
  };
  
  return (
    <div
      onClick={toggleTheme}
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      }}
    >
      <span>{getThemeIcon()}</span>
      <span style={{ fontSize: 12 }}>{getThemeName()}</span>
    </div>
  );
};

// 主题选择器组件
export const ThemeSelector: React.FC = () => {
  const { currentTheme, setTheme } = useTheme();
  
  const themes: { type: ThemeType; name: string; icon: string; color: string }[] = [
    { type: 'light', name: '浅色', icon: '☀️', color: '#ffffff' },
    { type: 'dark', name: '深色', icon: '🌙', color: '#141414' },
    { type: 'blue', name: '蓝色', icon: '💙', color: '#f0f5ff' },
    { type: 'green', name: '绿色', icon: '💚', color: '#f6ffed' },
  ];
  
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {themes.map((t) => (
        <div
          key={t.type}
          onClick={() => setTheme(t.type)}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 6,
            border: `2px solid ${currentTheme === t.type ? '#1890ff' : '#f0f0f0'}`,
            background: t.color,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ 
            fontSize: 12, 
            color: t.type === 'dark' ? '#fff' : '#333',
          }}>
            {t.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// 导出主题工具
export const themeUtils = {
  // 获取主题颜色
  getThemeColor: (type: ThemeType, color: keyof ThemeConfig): string => {
    return themePresets[type][color];
  },
  
  // 检查是否为深色主题
  isDarkTheme: (type: ThemeType): boolean => {
    return type === 'dark';
  },
  
  // 获取对比色
  getContrastColor: (backgroundColor: string): string => {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  },
};
