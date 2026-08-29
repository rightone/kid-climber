import { ComponentInstance, Connection } from '../types';

// 历史快照
export interface HistorySnapshot {
  id: string;
  timestamp: number;
  components: ComponentInstance[];
  connections: Connection[];
  description: string;
}

// 撤销/重做管理器
export class UndoRedoManager {
  private history: HistorySnapshot[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;
  private isBatching: boolean = false;
  private batchDescription: string = '';
  
  // 保存快照
  saveSnapshot(
    components: ComponentInstance[],
    connections: Connection[],
    description: string = ''
  ): void {
    // 如果正在批量操作，不保存
    if (this.isBatching) return;
    
    // 创建快照
    const snapshot: HistorySnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      components: JSON.parse(JSON.stringify(components)),
      connections: JSON.parse(JSON.stringify(connections)),
      description,
    };
    
    // 删除当前索引之后的历史
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // 添加新快照
    this.history.push(snapshot);
    
    // 限制历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  // 撤销
  undo(): HistorySnapshot | null {
    if (this.currentIndex <= 0) return null;
    
    this.currentIndex--;
    return this.getCurrentSnapshot();
  }
  
  // 重做
  redo(): HistorySnapshot | null {
    if (this.currentIndex >= this.history.length - 1) return null;
    
    this.currentIndex++;
    return this.getCurrentSnapshot();
  }
  
  // 获取当前快照
  getCurrentSnapshot(): HistorySnapshot | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    
    return this.history[this.currentIndex];
  }
  
  // 获取上一个快照
  getPreviousSnapshot(): HistorySnapshot | null {
    if (this.currentIndex <= 0) return null;
    
    return this.history[this.currentIndex - 1];
  }
  
  // 获取下一个快照
  getNextSnapshot(): HistorySnapshot | null {
    if (this.currentIndex >= this.history.length - 1) return null;
    
    return this.history[this.currentIndex + 1];
  }
  
  // 是否可以撤销
  canUndo(): boolean {
    return this.currentIndex > 0;
  }
  
  // 是否可以重做
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  // 获取历史列表
  getHistory(): HistorySnapshot[] {
    return [...this.history];
  }
  
  // 获取当前索引
  getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  // 跳转到指定快照
  goToSnapshot(snapshotId: string): HistorySnapshot | null {
    const index = this.history.findIndex((s) => s.id === snapshotId);
    
    if (index === -1) return null;
    
    this.currentIndex = index;
    return this.getCurrentSnapshot();
  }
  
  // 跳转到指定索引
  goToIndex(index: number): HistorySnapshot | null {
    if (index < 0 || index >= this.history.length) return null;
    
    this.currentIndex = index;
    return this.getCurrentSnapshot();
  }
  
  // 开始批量操作
  beginBatch(description: string): void {
    this.isBatching = true;
    this.batchDescription = description;
  }
  
  // 结束批量操作
  endBatch(components: ComponentInstance[], connections: Connection[]): void {
    if (!this.isBatching) return;
    
    this.isBatching = false;
    this.saveSnapshot(components, connections, this.batchDescription);
    this.batchDescription = '';
  }
  
  // 清空历史
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
  
  // 设置最大历史大小
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    
    // 如果当前历史超过限制，删除旧的
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }
  
  // 获取最大历史大小
  getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
  
  // 获取历史大小
  getHistorySize(): number {
    return this.history.length;
  }
  
  // 是否正在批量操作
  isBatchingOperation(): boolean {
    return this.isBatching;
  }
  
  // 获取批量描述
  getBatchDescription(): string {
    return this.batchDescription;
  }
  
  // 压缩历史（删除重复的快照）
  compressHistory(): void {
    if (this.history.length < 2) return;
    
    const compressed: HistorySnapshot[] = [this.history[0]];
    
    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      
      // 检查是否相同
      if (!this.areSnapshotsEqual(prev, curr)) {
        compressed.push(curr);
      }
    }
    
    // 更新索引
    const currentSnapshot = this.getCurrentSnapshot();
    this.history = compressed;
    
    if (currentSnapshot) {
      this.currentIndex = this.history.findIndex((s) => s.id === currentSnapshot.id);
    }
  }
  
  // 比较快照是否相同
  private areSnapshotsEqual(snapshot1: HistorySnapshot, snapshot2: HistorySnapshot): boolean {
    if (snapshot1.components.length !== snapshot2.components.length) return false;
    if (snapshot1.connections.length !== snapshot2.connections.length) return false;
    
    // 比较组件
    for (let i = 0; i < snapshot1.components.length; i++) {
      const comp1 = snapshot1.components[i];
      const comp2 = snapshot2.components[i];
      
      if (comp1.instanceId !== comp2.instanceId) return false;
      if (comp1.componentId !== comp2.componentId) return false;
      if (comp1.position[0] !== comp2.position[0]) return false;
      if (comp1.position[1] !== comp2.position[1]) return false;
      if (comp1.position[2] !== comp2.position[2]) return false;
      if (comp1.rotation[0] !== comp2.rotation[0]) return false;
      if (comp1.rotation[1] !== comp2.rotation[1]) return false;
      if (comp1.rotation[2] !== comp2.rotation[2]) return false;
    }
    
    // 比较连接
    for (let i = 0; i < snapshot1.connections.length; i++) {
      const conn1 = snapshot1.connections[i];
      const conn2 = snapshot2.connections[i];
      
      if (conn1.id !== conn2.id) return false;
      if (conn1.source.componentId !== conn2.source.componentId) return false;
      if (conn1.source.pointId !== conn2.source.pointId) return false;
      if (conn1.target.componentId !== conn2.target.componentId) return false;
      if (conn1.target.pointId !== conn2.target.pointId) return false;
    }
    
    return true;
  }
  
  // 导出历史
  exportHistory(): string {
    return JSON.stringify({
      history: this.history,
      currentIndex: this.currentIndex,
      maxHistorySize: this.maxHistorySize,
    }, null, 2);
  }
  
  // 导入历史
  importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.history && Array.isArray(parsed.history)) {
        this.history = parsed.history;
        this.currentIndex = parsed.currentIndex || -1;
        this.maxHistorySize = parsed.maxHistorySize || 50;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('导入历史失败:', error);
      return false;
    }
  }
}

// 创建单例
export const undoRedoManager = new UndoRedoManager();
