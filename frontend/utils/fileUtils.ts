import { saveAs } from 'file-saver';
import { message } from 'antd';
import type { Design, ComponentInstance } from '../types';

// 保存设计文件
export const saveDesignFile = async (design: Design, filename?: string) => {
  try {
    const designData = {
      version: '1.0',
      metadata: {
        name: design.name,
        description: design.description || '',
        created: design.createdAt || new Date().toISOString(),
        modified: new Date().toISOString(),
        author: 'Kid Climber User',
        tags: [],
      },
      components: design.components.map(comp => ({
        instanceId: comp.instanceId,
        componentId: comp.componentId,
        name: comp.name || '',
        transform: {
          position: comp.position,
          rotation: comp.rotation,
          scale: comp.scale,
        },
        properties: comp.properties || {},
      })),
      connections: design.connections.map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        type: conn.type,
      })),
      materials: design.materials,
      settings: design.settings,
    };
    
    const blob = new Blob([JSON.stringify(designData, null, 2)], {
      type: 'application/json',
    });
    
    const name = filename || `${design.name || 'design'}_${new Date().toISOString().slice(0, 10)}.kcd`;
    saveAs(blob, name);
    
    message.success('设计文件保存成功');
    return true;
  } catch (error) {
    console.error('保存设计文件失败:', error);
    message.error('保存设计文件失败');
    return false;
  }
};

// 加载设计文件
export const loadDesignFile = (file: File): Promise<Design | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const designData = JSON.parse(content);
        
        // 验证文件格式
        if (!designData.version || !designData.metadata) {
          message.error('无效的设计文件格式');
          resolve(null);
          return;
        }
        
        // 转换为设计对象
        const design: Design = {
          name: designData.metadata.name,
          description: designData.metadata.description,
          version: designData.version,
          status: 'draft',
          components: designData.components.map((comp: any) => ({
            instanceId: comp.instanceId,
            componentId: comp.componentId,
            name: comp.name,
            position: comp.transform.position,
            rotation: comp.transform.rotation,
            scale: comp.transform.scale,
            properties: comp.properties,
          })),
          connections: designData.connections.map((conn: any) => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: conn.type,
            isActive: true,
          })),
          materials: designData.materials || {},
          settings: designData.settings || {
            gridSize: 10,
            snapToGrid: true,
            showConnections: true,
            viewMode: 'realistic',
          },
          createdAt: designData.metadata.created,
          updatedAt: designData.metadata.modified,
        };
        
        message.success('设计文件加载成功');
        resolve(design);
      } catch (error) {
        console.error('解析设计文件失败:', error);
        message.error('解析设计文件失败');
        resolve(null);
      }
    };
    
    reader.onerror = () => {
      message.error('读取设计文件失败');
      resolve(null);
    };
    
    reader.readAsText(file);
  });
};

// 导出为PNG图片
export const exportToPNG = async (canvas: HTMLCanvasElement, filename?: string) => {
  try {
    // 确保canvas已渲染
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 获取canvas数据
    const dataURL = canvas.toDataURL('image/png');
    
    // 转换为blob
    const response = await fetch(dataURL);
    const blob = await response.blob();
    
    // 保存文件
    const name = filename || `design_${new Date().toISOString().slice(0, 10)}.png`;
    saveAs(blob, name);
    
    message.success('图片导出成功');
    return true;
  } catch (error) {
    console.error('导出图片失败:', error);
    message.error('导出图片失败');
    return false;
  }
};

// 导出为OBJ格式
export const exportToOBJ = (components: ComponentInstance[], filename?: string) => {
  try {
    let objContent = '# Kid Climber Design Export\n';
    objContent += `# Generated: ${new Date().toISOString()}\n\n`;
    
    let vertexIndex = 1;
    
    components.forEach((component, index) => {
      objContent += `# Component ${index + 1}: ${component.componentId}\n`;
      objContent += `o Component_${index + 1}\n`;
      
      // 根据组件类型生成顶点
      const [x, y, z] = component.position;
      const [_rx, _ry, _rz] = component.rotation;
      
      // 简化处理：生成一个立方体
      const size = 5;
      const vertices = [
        [x - size, y - size, z - size],
        [x + size, y - size, z - size],
        [x + size, y + size, z - size],
        [x - size, y + size, z - size],
        [x - size, y - size, z + size],
        [x + size, y - size, z + size],
        [x + size, y + size, z + size],
        [x - size, y + size, z + size],
      ];
      
      // 添加顶点
      vertices.forEach(([vx, vy, vz]) => {
        objContent += `v ${vx} ${vy} ${vz}\n`;
      });
      
      // 添加面
      const faces = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 4, 8, 7],
        [4, 1, 5, 8],
      ];
      
      faces.forEach(face => {
        objContent += `f ${face.map(i => i + vertexIndex - 1).join(' ')}\n`;
      });
      
      vertexIndex += 8;
      objContent += '\n';
    });
    
    // 保存文件
    const blob = new Blob([objContent], { type: 'text/plain' });
    const name = filename || `design_${new Date().toISOString().slice(0, 10)}.obj`;
    saveAs(blob, name);
    
    message.success('OBJ文件导出成功');
    return true;
  } catch (error) {
    console.error('导出OBJ失败:', error);
    message.error('导出OBJ失败');
    return false;
  }
};

// 导出为GLTF格式
export const exportToGLTF = (components: ComponentInstance[], filename?: string) => {
  try {
    // 创建GLTF结构
    const gltf = {
      asset: {
        version: '2.0',
        generator: 'Kid Climber',
      },
      scene: 0,
      scenes: [{
        nodes: components.map((_, index) => index),
      }],
      nodes: components.map((component, index) => ({
        name: `Component_${index + 1}`,
        translation: component.position,
        rotation: quaternionFromEuler(component.rotation),
        scale: component.scale,
        mesh: 0,
      })),
      meshes: [{
        primitives: [{
          attributes: {
            POSITION: 0,
          },
          indices: 1,
        }],
      }],
      accessors: [
        // 顶点访问器
        {
          bufferView: 0,
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          max: [5, 5, 5],
          min: [-5, -5, -5],
        },
        // 索引访问器
        {
          bufferView: 1,
          componentType: 5123,
          count: 36,
          type: 'SCALAR',
        },
      ],
      bufferViews: [
        // 顶点缓冲区
        {
          buffer: 0,
          byteOffset: 0,
          byteLength: 96,
          target: 34962,
        },
        // 索引缓冲区
        {
          buffer: 0,
          byteOffset: 96,
          byteLength: 72,
          target: 34963,
        },
      ],
      buffers: [{
        uri: 'data:application/octet-stream;base64,...',
        byteLength: 168,
      }],
    };
    
    // 保存文件
    const blob = new Blob([JSON.stringify(gltf, null, 2)], {
      type: 'model/gltf+json',
    });
    const name = filename || `design_${new Date().toISOString().slice(0, 10)}.gltf`;
    saveAs(blob, name);
    
    message.success('GLTF文件导出成功');
    return true;
  } catch (error) {
    console.error('导出GLTF失败:', error);
    message.error('导出GLTF失败');
    return false;
  }
};

// 从欧拉角创建四元数
const quaternionFromEuler = (euler: [number, number, number]): [number, number, number, number] => {
  const [x, y, z] = euler.map(angle => (angle * Math.PI) / 180);
  
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
};

// 导出材料清单为PDF
export const exportMaterialListToPDF = async (
  materials: Record<string, { required: number; available: number; shortage: number }>,
  designName: string
) => {
  try {
    // 这里可以使用jsPDF库生成PDF
    // 简化处理，生成文本格式
    let content = `攀爬架材料清单\n`;
    content += `设计名称: ${designName}\n`;
    content += `生成日期: ${new Date().toLocaleDateString()}\n\n`;
    content += `组件名称\t需要数量\t已有数量\t需购买\n`;
    content += `${'='.repeat(50)}\n`;
    
    Object.entries(materials).forEach(([componentId, data]) => {
      content += `${componentId}\t${data.required}\t${data.available}\t${data.shortage}\n`;
    });
    
    content += `\n总计: ${Object.keys(materials).length} 种组件\n`;
    
    // 保存文件
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const name = `material_list_${new Date().toISOString().slice(0, 10)}.txt`;
    saveAs(blob, name);
    
    message.success('材料清单导出成功');
    return true;
  } catch (error) {
    console.error('导出材料清单失败:', error);
    message.error('导出材料清单失败');
    return false;
  }
};

// 复制组件
export const copyComponents = (components: ComponentInstance[]): ComponentInstance[] => {
  return components.map(comp => ({
    ...comp,
    instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    position: [
      comp.position[0] + 10,
      comp.position[1],
      comp.position[2] + 10,
    ] as [number, number, number],
  }));
};

// 生成唯一ID
export const generateId = (): string => {
  return `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 验证设计文件
export const validateDesignFile = (data: any): boolean => {
  if (!data.version || !data.metadata) {
    return false;
  }
  
  if (!Array.isArray(data.components)) {
    return false;
  }
  
  // 验证每个组件
  for (const comp of data.components) {
    if (!comp.instanceId || !comp.componentId || !comp.transform) {
      return false;
    }
    
    if (!Array.isArray(comp.transform.position) || comp.transform.position.length !== 3) {
      return false;
    }
    
    if (!Array.isArray(comp.transform.rotation) || comp.transform.rotation.length !== 3) {
      return false;
    }
    
    if (!Array.isArray(comp.transform.scale) || comp.transform.scale.length !== 3) {
      return false;
    }
  }
  
  return true;
};
