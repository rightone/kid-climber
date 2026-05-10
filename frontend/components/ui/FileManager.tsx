import React, { useState, useCallback } from 'react';
import { Modal, List, Button, Space, Input, message, Popconfirm, Tag, Empty, Spin, Tooltip } from 'antd';
import { FolderOpenOutlined, SaveOutlined, ImportOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDesignStore } from '../../stores/designStore';
import { saveDesignFile, loadDesignFile, exportToPNG, exportToOBJ } from '../../utils/fileUtils';
import type { Design } from '../../types';

const FileManager: React.FC = () => {
  const { currentDesign, components, connections, setCurrentDesign } = useDesignStore();
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [designName, setDesignName] = useState('');
  const [savedDesigns, setSavedDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 加载保存的设计列表
  const loadSavedDesigns = useCallback(() => {
    try {
      const saved = localStorage.getItem('kid_climber_designs');
      if (saved) {
        setSavedDesigns(JSON.parse(saved));
      }
    } catch (error) {
      console.error('加载设计列表失败:', error);
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
    } catch (error) {
      console.error('保存设计失败:', error);
      message.error('保存设计失败');
    }
  }, [savedDesigns]);
  
  // 处理保存设计
  const handleSave = useCallback(() => {
    if (!designName.trim()) {
      message.error('请输入设计名称');
      return;
    }
    
    setLoading(true);
    
    setTimeout(() => {
      const design: Design = {
        name: designName,
        description: '',
        version: '1.0',
        status: 'draft',
        components,
        connections,
        materials: {},
        settings: {
          gridSize: 10,
          snapToGrid: true,
          showConnections: true,
          viewMode: 'realistic',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      saveDesignToLocalStorage(design);
      setCurrentDesign(design);
      
      message.success('设计保存成功');
      setSaveModalVisible(false);
      setDesignName('');
      setLoading(false);
    }, 500);
  }, [designName, components, connections, saveDesignToLocalStorage, setCurrentDesign]);
  
  // 处理加载设计
  const handleLoad = useCallback((design: Design) => {
    setLoading(true);
    
    setTimeout(() => {
      setCurrentDesign(design);
      message.success(`已加载设计: ${design.name}`);
      setLoadModalVisible(false);
      setLoading(false);
    }, 500);
  }, [setCurrentDesign]);
  
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
      
      const design = await loadDesignFile(file);
      if (design) {
        setCurrentDesign(design);
        saveDesignToLocalStorage(design);
        message.success('设计导入成功');
      }
      
      setLoading(false);
    };
    
    input.click();
  }, [setCurrentDesign, saveDesignToLocalStorage]);
  
  // 处理导出设计
  const handleExport = useCallback((format: string) => {
    if (!currentDesign && components.length === 0) {
      message.error('没有可导出的设计');
      return;
    }
    
    setLoading(true);
    
    setTimeout(() => {
      const design = currentDesign || {
        name: '未命名设计',
        components,
        connections,
        version: '1.0',
        status: 'draft' as const,
        materials: {},
        settings: {
          gridSize: 10,
          snapToGrid: true,
          showConnections: true,
          viewMode: 'realistic' as const,
        },
      };
      
      switch (format) {
        case 'kcd':
          saveDesignFile(design);
          break;
        case 'png':
          const canvas = document.querySelector('canvas');
          if (canvas) {
            exportToPNG(canvas);
          }
          break;
        case 'obj':
          exportToOBJ(components);
          break;
      }
      
      setLoading(false);
      setExportModalVisible(false);
    }, 500);
  }, [currentDesign, components, connections]);
  
  // 保存当前设计
  const handleSaveCurrent = useCallback(() => {
    if (currentDesign) {
      saveDesignToLocalStorage(currentDesign);
      message.success('设计已保存');
    } else {
      setSaveModalVisible(true);
    }
  }, [currentDesign, saveDesignToLocalStorage]);
  
  return (
    <>
      {/* 文件操作按钮 */}
      <Space>
        <Tooltip title="保存设计">
          <Button
            icon={<SaveOutlined />}
            size="small"
            onClick={handleSaveCurrent}
            loading={loading}
          >
            保存
          </Button>
        </Tooltip>
        <Tooltip title="打开设计">
          <Button
            icon={<FolderOpenOutlined />}
            size="small"
            onClick={() => {
              loadSavedDesigns();
              setLoadModalVisible(true);
            }}
          >
            打开
          </Button>
        </Tooltip>
        <Tooltip title="导入设计">
          <Button
            icon={<ImportOutlined />}
            size="small"
            onClick={handleImport}
          >
            导入
          </Button>
        </Tooltip>
        <Tooltip title="导出设计">
          <Button
            icon={<ExportOutlined />}
            size="small"
            onClick={() => setExportModalVisible(true)}
          >
            导出
          </Button>
        </Tooltip>
      </Space>
      
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
