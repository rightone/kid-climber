import { message } from 'antd';
import { Design, ComponentInstance, Connection, MaterialInventory } from '../types';

// API基础URL
const API_BASE_URL = 'http://localhost:8080/api';

// 通用请求函数
const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
    message.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    return null;
  }
};

// 获取所有组件定义
export const fetchComponents = async () => {
  return request<any[]>('/components');
};

// 根据ID获取组件定义
export const fetchComponent = async (id: string) => {
  return request<any>(`/components/${id}`);
};

// 按分类获取组件
export const fetchComponentsByCategory = async (category: string) => {
  return request<any[]>(`/components/category/${category}`);
};

// 搜索组件
export const searchComponents = async (query: string) => {
  return request<any[]>(`/components/search?q=${encodeURIComponent(query)}`);
};

// 获取所有设计
export const fetchDesigns = async () => {
  return request<Design[]>('/designs');
};

// 获取单个设计
export const fetchDesign = async (id: number) => {
  return request<{
    design: Design;
    components: ComponentInstance[];
    connections: Connection[];
  }>(`/designs/${id}`);
};

// 创建新设计
export const createDesign = async (design: Partial<Design>) => {
  return request<Design>('/designs', {
    method: 'POST',
    body: JSON.stringify(design),
  });
};

// 更新设计
export const updateDesign = async (id: number, design: Partial<Design>) => {
  return request<Design>(`/designs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(design),
  });
};

// 删除设计
export const deleteDesign = async (id: number) => {
  return request<void>(`/designs/${id}`, {
    method: 'DELETE',
  });
};

// 保存设计组件
export const saveDesignComponents = async (designId: number, components: ComponentInstance[]) => {
  return request<ComponentInstance[]>(`/designs/${designId}/components`, {
    method: 'POST',
    body: JSON.stringify(components),
  });
};

// 保存设计连接
export const saveDesignConnections = async (designId: number, connections: Connection[]) => {
  return request<Connection[]>(`/designs/${designId}/connections`, {
    method: 'POST',
    body: JSON.stringify(connections),
  });
};

// 获取材料库存
export const fetchMaterialInventory = async () => {
  return request<MaterialInventory[]>('/materials/inventory');
};

// 更新材料库存
export const updateMaterialInventory = async (inventory: MaterialInventory) => {
  return request<MaterialInventory>('/materials/inventory', {
    method: 'POST',
    body: JSON.stringify(inventory),
  });
};

// 计算材料需求
export const calculateMaterialRequirement = async (designId: number) => {
  return request<{
    componentId: string;
    required: number;
    available: number;
    shortage: number;
  }[]>(`/designs/${designId}/materials`);
};

// 保存设计到服务器
export const saveDesignToServer = async (design: Design, components: ComponentInstance[], connections: Connection[]) => {
  try {
    // 保存设计基本信息
    let savedDesign: Design | null;
    
    if (design.id) {
      // 更新现有设计
      savedDesign = await updateDesign(design.id, design);
    } else {
      // 创建新设计
      savedDesign = await createDesign(design);
    }
    
    if (!savedDesign || !savedDesign.id) {
      throw new Error('保存设计失败');
    }
    
    // 保存组件
    const savedComponents = await saveDesignComponents(savedDesign.id, components);
    if (!savedComponents) {
      throw new Error('保存组件失败');
    }
    
    // 保存连接
    const savedConnections = await saveDesignConnections(savedDesign.id, connections);
    if (!savedConnections) {
      throw new Error('保存连接失败');
    }
    
    message.success('设计保存成功');
    return savedDesign;
  } catch (error) {
    console.error('保存设计到服务器失败:', error);
    message.error('保存设计失败');
    return null;
  }
};

// 从服务器加载设计
export const loadDesignFromServer = async (designId: number) => {
  try {
    const result = await fetchDesign(designId);
    if (!result) {
      throw new Error('加载设计失败');
    }
    
    message.success('设计加载成功');
    return result;
  } catch (error) {
    console.error('从服务器加载设计失败:', error);
    message.error('加载设计失败');
    return null;
  }
};

// 同步材料库存
export const syncMaterialInventory = async (inventory: Record<string, number>) => {
  try {
    const results = await Promise.all(
      Object.entries(inventory).map(([componentId, quantity]) =>
        updateMaterialInventory({
          componentId,
          quantity,
        })
      )
    );
    
    const successCount = results.filter(r => r !== null).length;
    message.success(`同步完成: ${successCount}/${Object.keys(inventory).length} 项`);
    
    return successCount === Object.keys(inventory).length;
  } catch (error) {
    console.error('同步材料库存失败:', error);
    message.error('同步材料库存失败');
    return false;
  }
};

// 获取设计列表（带分页）
export const fetchDesignsPaginated = async (page: number = 1, pageSize: number = 10) => {
  const allDesigns = await fetchDesigns();
  if (!allDesigns) {
    return { designs: [], total: 0 };
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    designs: allDesigns.slice(start, end),
    total: allDesigns.length,
  };
};

// 搜索设计
export const searchDesigns = async (query: string) => {
  const allDesigns = await fetchDesigns();
  if (!allDesigns) {
    return [];
  }
  
  const lowerQuery = query.toLowerCase();
  return allDesigns.filter(design =>
    design.name.toLowerCase().includes(lowerQuery) ||
    (design.description && design.description.toLowerCase().includes(lowerQuery))
  );
};

// 检查服务器连接
export const checkServerConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    
    return response.ok;
  } catch (error) {
    console.error('服务器连接检查失败:', error);
    return false;
  }
};

// 获取服务器状态
export const getServerStatus = async () => {
  const isConnected = await checkServerConnection();
  
  return {
    connected: isConnected,
    url: API_BASE_URL,
    timestamp: new Date().toISOString(),
  };
};
