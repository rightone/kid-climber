import { Component, ErrorInfo, ReactNode } from 'react';

// 错误类型
export enum ErrorType {
  RENDER_ERROR = 'RENDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 错误信息
export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  stack?: string;
  timestamp: number;
  component?: string;
  action?: string;
}

// 错误处理配置
export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableReporting: bool;
  maxErrors: number;
  showErrorDetails: boolean;
}

// 默认配置
const defaultConfig: ErrorHandlerConfig = {
  enableLogging: true,
  enableReporting: false,
  maxErrors: 100,
  showErrorDetails: process.env.NODE_ENV === 'development',
};

// 错误处理器
export class ErrorHandler {
  private errors: AppError[] = [];
  private config: ErrorHandlerConfig;
  private errorListeners: Set<(error: AppError) => void>;
  
  constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.errorListeners = new Set();
  }
  
  // 处理错误
  handle(error: Error | string, type: ErrorType = ErrorType.UNKNOWN_ERROR, context?: {
    component?: string;
    action?: string;
    details?: string;
  }): AppError {
    const appError: AppError = {
      type,
      message: typeof error === 'string' ? error : error.message,
      details: context?.details,
      stack: typeof error === 'string' ? undefined : error.stack,
      timestamp: Date.now(),
      component: context?.component,
      action: context?.action,
    };
    
    // 添加到错误列表
    this.errors.push(appError);
    
    // 限制错误数量
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }
    
    // 日志记录
    if (this.config.enableLogging) {
      this.logError(appError);
    }
    
    // 通知监听器
    this.notifyListeners(appError);
    
    return appError;
  }
  
  // 记录错误
  private logError(error: AppError): void {
    const prefix = `[${error.type}]`;
    const context = error.component ? ` in ${error.component}` : '';
    const action = error.action ? ` during ${error.action}` : '';
    
    console.error(`${prefix}${context}${action}: ${error.message}`);
    
    if (error.details) {
      console.error('Details:', error.details);
    }
    
    if (error.stack && this.config.showErrorDetails) {
      console.error('Stack:', error.stack);
    }
  }
  
  // 通知监听器
  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }
  
  // 添加错误监听器
  addListener(listener: (error: AppError) => void): () => void {
    this.errorListeners.add(listener);
    
    return () => {
      this.errorListeners.delete(listener);
    };
  }
  
  // 获取所有错误
  getErrors(): AppError[] {
    return [...this.errors];
  }
  
  // 获取最近的错误
  getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count);
  }
  
  // 清除错误
  clearErrors(): void {
    this.errors = [];
  }
  
  // 获取错误统计
  getErrorStats(): Record<ErrorType, number> {
    const stats: Record<ErrorType, number> = {} as any;
    
    Object.values(ErrorType).forEach(type => {
      stats[type] = 0;
    });
    
    this.errors.forEach(error => {
      stats[error.type]++;
    });
    
    return stats;
  }
  
  // 更新配置
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 创建单例
export const errorHandler = new ErrorHandler();

// React错误边界属性
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

// React错误边界状态
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// React错误边界组件
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 处理错误
    errorHandler.handle(error, ErrorType.COMPONENT_ERROR, {
      component: 'ErrorBoundary',
      details: errorInfo.componentStack,
    });
    
    // 调用回调
    this.props.onError?.(error, errorInfo);
  }
  
  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: 24,
          textAlign: 'center',
          background: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: 8,
        }}>
          <h3 style={{ color: '#ff4d4f', marginBottom: 8 }}>出现错误</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// 错误处理Hook
export const useErrorHandler = () => {
  // 处理异步错误
  const handleAsyncError = async <T,>(
    promise: Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR,
    context?: { component?: string; action?: string }
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      errorHandler.handle(
        error instanceof Error ? error : new Error(String(error)),
        errorType,
        context
      );
      return null;
    }
  };
  
  // 处理同步错误
  const handleSyncError = <T,>(
    fn: () => T,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR,
    context?: { component?: string; action?: string }
  ): T | null => {
    try {
      return fn();
    } catch (error) {
      errorHandler.handle(
        error instanceof Error ? error : new Error(String(error)),
        errorType,
        context
      );
      return null;
    }
  };
  
  // 显示错误消息
  const showError = (message: string, duration: number = 3000) => {
    // 这里可以集成消息提示组件
    console.error(message);
  };
  
  return {
    handleAsyncError,
    handleSyncError,
    showError,
    errorHandler,
  };
};

// 网络错误处理
export const handleNetworkError = (error: any): AppError => {
  let message = '网络请求失败';
  let details = '';
  
  if (error.response) {
    // 服务器响应错误
    message = `服务器错误: ${error.response.status}`;
    details = error.response.data?.message || '';
  } else if (error.request) {
    // 请求未响应
    message = '网络连接失败';
    details = '请检查网络连接';
  } else {
    // 请求配置错误
    message = '请求配置错误';
    details = error.message;
  }
  
  return errorHandler.handle(message, ErrorType.NETWORK_ERROR, { details });
};

// 验证错误处理
export const handleValidationError = (field: string, message: string): AppError => {
  return errorHandler.handle(
    `验证失败: ${field}`,
    ErrorType.VALIDATION_ERROR,
    { details: message }
  );
};

// 存储错误处理
export const handleStorageError = (operation: string, error: Error): AppError => {
  return errorHandler.handle(
    `存储操作失败: ${operation}`,
    ErrorType.STORAGE_ERROR,
    { details: error.message }
  );
};

// 渲染错误处理
export const handleRenderError = (component: string, error: Error): AppError => {
  return errorHandler.handle(
    `渲染失败: ${component}`,
    ErrorType.RENDER_ERROR,
    { details: error.message, component }
  );
};

// 性能监控
export class PerformanceMonitor {
  private metrics: Map<string, number[]>;
  private thresholds: Map<string, number>;
  
  constructor() {
    this.metrics = new Map();
    this.thresholds = new Map();
    
    // 设置默认阈值
    this.thresholds.set('render', 16); // 60fps
    this.thresholds.set('api', 1000); // 1秒
    this.thresholds.set('interaction', 100); // 100ms
  }
  
  // 开始计时
  startTimer(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      
      // 检查是否超过阈值
      const threshold = this.thresholds.get(name);
      if (threshold && duration > threshold) {
        console.warn(`Performance warning: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
      }
    };
  }
  
  // 记录指标
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 保留最近100个值
    if (values.length > 100) {
      values.shift();
    }
  }
  
  // 获取指标统计
  getMetricStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sorted.reduce((sum, v) => sum + v, 0) / count;
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index];
    
    return { count, min, max, avg, p95 };
  }
  
  // 获取所有指标
  getAllMetrics(): Record<string, ReturnType<typeof this.getMetricStats>> {
    const result: Record<string, any> = {};
    
    this.metrics.forEach((_, name) => {
      result[name] = this.getMetricStats(name);
    });
    
    return result;
  }
  
  // 清除指标
  clearMetrics(): void {
    this.metrics.clear();
  }
  
  // 设置阈值
  setThreshold(name: string, value: number): void {
    this.thresholds.set(name, value);
  }
}

// 创建单例
export const performanceMonitor = new PerformanceMonitor();

// 性能监控Hook
export const usePerformanceMonitor = () => {
  const startTimer = (name: string) => {
    return performanceMonitor.startTimer(name);
  };
  
  const recordMetric = (name: string, value: number) => {
    performanceMonitor.recordMetric(name, value);
  };
  
  const getStats = (name: string) => {
    return performanceMonitor.getMetricStats(name);
  };
  
  return {
    startTimer,
    recordMetric,
    getStats,
    performanceMonitor,
  };
};

// 导出所有工具
export const errorHandlingUtils = {
  errorHandler,
  performanceMonitor,
  handleNetworkError,
  handleValidationError,
  handleStorageError,
  handleRenderError,
};
