import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, List, Button, Space, Input, message, Popconfirm, Tag, Empty, Spin, Tooltip, Dropdown } from 'antd';
import { FolderOpenOutlined, SaveOutlined, ImportOutlined, ExportOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { saveDesignFile, loadDesignFile, exportToPNG, exportToOBJ } from '../../utils/fileUtils';
import { SAVE_SHORTCUT } from '../../utils/shortcutUtils';
import type { Design } from '../../types';
import { REFERENCE_PRODUCT_PROFILE_VERSION } from '../../referenceProductSpec';

export interface FileManagerCommands {
  save: () => void;
  open: () => void;
  importDesign: () => void;
  exportDesign: () => void;
}

interface FileManagerProps {
  children?: (commands: FileManagerCommands) => React.ReactNode;
}

const FileManager: React.FC<FileManagerProps> = ({ children }) => {
  const { currentDesign, components, connections, editor, setCurrentDesign, hydrateDesign } = useDesignStore();
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [designName, setDesignName] = useState('');
  const [savedDesigns, setSavedDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(false);

  const buildLiveDesign = useCallback((updates: Partial<Design> = {}): Design => {
    const now = new Date().toISOString();
    return {
      name: currentDesign?.name ?? '未命名设计',
      description: currentDesign?.description ?? '',
      version: currentDesign?.version ?? '1.0',
      productProfileVersion:
        currentDesign?.productProfileVersion ?? REFERENCE_PRODUCT_PROFILE_VERSION,
      status: currentDesign?.status ?? 'draft',
      materials: currentDesign?.materials ?? {},
      createdAt: currentDesign?.createdAt ?? now,
      ...currentDesign,
      ...updates,
      components,
      connections,
      settings: {
        gridSize: editor.gridSize,
        showConnections: editor.showConnections,
        viewMode: editor.viewMode,
      },
      updatedAt: now,
    };
  }, [components, connections, currentDesign, editor]);
  
  // 加载保存的设计列表
  const loadSavedDesigns = useCallback(() => {
    try {
      const saved = localStorage.getItem('kid_climber_designs');
      if (saved) {
        setSavedDesigns(JSON.parse(saved));
      }
    } catch (error) {
      console.error('加载设计列表失败:', error);
      message.error('加载设计列表失败');
    }
  }, []);
  
  // 保存设计到本地存储
  const saveDesignToLocalStorage = useCallback((design: Design) => {
    try {
      const existingIndex = savedDesigns.findIndex(d => d.name === design.name);
      let newDesigns: Design[];
      
      if (existingIndex >= 0) {
        newDesigns = [...savedDesigns];
        newDesigns[existingIndex] = design;
      } else {
        newDesigns = [...savedDesigns, design];
      }
      
      localStorage.setItem('kid_climber_designs', JSON.stringify(newDesigns));
      setSavedDesigns(newDesigns);
      return true;
    } catch (error) {
      console.error('保存设计失败:', error);
      message.error('保存设计失败');
      return false;
    }
  }, [savedDesigns]);
  
  // 处理保存设计
  const handleSave = useCallback(() => {
    if (!designName.trim()) {
      message.error('请输入设计名称');
      return;
    }
    
    setLoading(true);

    try {
      const design = buildLiveDesign({ name: designName });
      
      if (!saveDesignToLocalStorage(design)) return;
      setCurrentDesign(design);
      
      message.success('设计保存成功');
      setSaveModalVisible(false);
      setDesignName('');
    } finally {
      setLoading(false);
    }
  }, [buildLiveDesign, designName, saveDesignToLocalStorage, setCurrentDesign]);
  
  // 处理加载设计
  const handleLoad = useCallback((design: Design) => {
    setLoading(true);

    try {
      hydrateDesign(design);
      message.success(`已加载设计: ${design.name}`);
      setLoadModalVisible(false);
    } catch (error) {
      console.error('加载设计失败:', error);
      message.error('加载设计失败');
    } finally {
      setLoading(false);
    }
  }, [hydrateDesign]);
  
  // 处理删除设计
  const handleDelete = useCallback((designName: string) => {
    const newDesigns = savedDesigns.filter(d => d.name !== designName);
    localStorage.setItem('kid_climber_designs', JSON.stringify(newDesigns));
    setSavedDesigns(newDesigns);
    message.success('设计已删除');
  }, [savedDesigns]);
  
  // 处理导入设计
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kcd,.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setLoading(true);

      try {
        const design = await loadDesignFile(file);
        if (design) {
          hydrateDesign(design);
          if (saveDesignToLocalStorage(design)) {
            message.success('设计导入成功');
          } else {
            message.warning('设计已加载，但未能保存到本地');
          }
        }
      } catch (error) {
        console.error('导入设计失败:', error);
        message.error('导入设计失败');
      } finally {
        setLoading(false);
      }
    };
    
    input.click();
  }, [hydrateDesign, saveDesignToLocalStorage]);
  
  // 处理导出设计
  const handleExport = useCallback((format: string) => {
    if (!currentDesign && components.length === 0) {
      message.error('没有可导出的设计');
      return;
    }
    
    setLoading(true);

    try {
      const design = buildLiveDesign();
      
      switch (format) {
        case 'kcd':
          saveDesignFile(design);
          break;
        case 'png': {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            exportToPNG(canvas);
          }
          break;
        }
        case 'obj':
          exportToOBJ(components);
          break;
      }

      setExportModalVisible(false);
    } catch (error) {
      console.error('导出设计失败:', error);
      message.error('导出设计失败');
    } finally {
      setLoading(false);
    }
  }, [buildLiveDesign, components, currentDesign]);
  
  // 保存当前设计
  const handleSaveCurrent = useCallback(() => {
    if (currentDesign) {
      const design = buildLiveDesign();
      if (!saveDesignToLocalStorage(design)) return;
      setCurrentDesign(design);
      message.success('设计已保存');
    } else {
      setSaveModalVisible(true);
    }
  }, [buildLiveDesign, currentDesign, saveDesignToLocalStorage, setCurrentDesign]);

  const handleOpenDesigns = useCallback(() => {
    loadSavedDesigns();
    setLoadModalVisible(true);
  }, [loadSavedDesigns]);

  const handleOpenExport = useCallback(() => {
    setExportModalVisible(true);
  }, []);

  const commands = useMemo<FileManagerCommands>(() => ({
    save: handleSaveCurrent,
    open: handleOpenDesigns,
    importDesign: handleImport,
    exportDesign: handleOpenExport,
  }), [handleImport, handleOpenDesigns, handleOpenExport, handleSaveCurrent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== SAVE_SHORTCUT.key
      ) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      event.preventDefault();
      commands.save();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commands]);
  
  return (
    <>
      {children ? children(commands) : (
        <Space size={8}>
        <Tooltip title="保存设计 (Ctrl+S)">
          <Button
            icon={<SaveOutlined />}
            size="small"
            onClick={commands.save}
            loading={loading}
          >
            保存
          </Button>
        </Tooltip>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'open',
                icon: <FolderOpenOutlined />,
                label: '打开设计',
                onClick: commands.open,
              },
              {
                key: 'import',
                icon: <ImportOutlined />,
                label: '导入设计',
                onClick: commands.importDesign,
              },
              {
                key: 'export',
                icon: <ExportOutlined />,
                label: '导出设计',
                onClick: commands.exportDesign,
              },
            ],
          }}
        >
          <Button icon={<FileOutlined />} size="small">
            文件
          </Button>
        </Dropdown>
        </Space>
      )}
      
      {/* 保存设计弹窗 */}
      <Modal
        title="保存设计"
        open={saveModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setSaveModalVisible(false);
          setDesignName('');
        }}
        okText="保存"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Input
          placeholder="请输入设计名称"
          value={designName}
          onChange={(e) => setDesignName(e.target.value)}
          onPressEnter={handleSave}
        />
      </Modal>
      
      {/* 加载设计弹窗 */}
      <Modal
        title="打开设计"
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={600}
      >
        <Spin spinning={loading}>
          {savedDesigns.length === 0 ? (
            <Empty description="没有保存的设计" />
          ) : (
            <List
              dataSource={savedDesigns}
              renderItem={(design) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleLoad(design)}
                    >
                      打开
                    </Button>,
                    <Popconfirm
                      title="确定要删除这个设计吗？"
                      onConfirm={() => handleDelete(design.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" danger>
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={design.name}
                    description={
                      <div>
                        <div>{design.description || '无描述'}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          <Tag>{design.components.length} 个组件</Tag>
                          <Tag>{design.connections.length} 个连接</Tag>
                          <span>
                            更新于: {new Date(design.updatedAt || '').toLocaleString()}
                          </span>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Modal>
      
      {/* 导出设计弹窗 */}
      <Modal
        title="导出设计"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
      >
        <List
          dataSource={[
            {
              format: 'kcd',
              name: 'Kid Climber 设计文件',
              description: '保存为可重新导入的设计文件',
              icon: '📄',
            },
            {
              format: 'png',
              name: 'PNG 图片',
              description: '导出当前视图为PNG图片',
              icon: '🖼️',
            },
            {
              format: 'obj',
              name: 'OBJ 3D模型',
              description: '导出为通用3D模型格式',
              icon: '🎨',
            },
          ]}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  type="primary"
                  onClick={() => handleExport(item.format)}
                  loading={loading}
                  icon={<DownloadOutlined />}
                >
                  导出
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<span style={{ fontSize: 24 }}>{item.icon}</span>}
                title={item.name}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};

export default FileManager;
