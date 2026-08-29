import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  List,
  Progress,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleFilled,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { saveAs } from 'file-saver';
import { useDesignStore } from '../../stores/designStore';
import { generateAssemblyGuide } from '../../systems/AssemblyStepSystem';
import { exportManager } from '../../systems/ExportManager';
import AssemblyGuideViewer from './AssemblyGuideViewer';

const { Text, Title } = Typography;

const AssemblyGuidePanel: React.FC = () => {
  const {
    components,
    connections,
    currentDesign,
    inventory,
    repairTopology,
  } = useDesignStore();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; message: string } | null>(null);
  const result = useMemo(() => generateAssemblyGuide({
    components,
    connections,
    designName: currentDesign?.name || '攀爬架设计',
  }), [components, connections, currentDesign?.name]);
  const materials = useMemo(
    () => exportManager.generateMaterialList(components, connections, inventory),
    [components, connections, inventory]
  );
  const repairable = result.issues.some(issue => issue.repairable);
  const guide = result.guide;

  const handleRepair = useCallback(() => {
    if (repairTopology()) message.success('连接问题已修复，请重新检查教程。');
    else message.warning('当前没有可以自动修复的问题。');
  }, [repairTopology]);

  const handleExport = useCallback(async () => {
    if (!guide || exporting) return;
    setExporting(true);
    setExportProgress({ percent: 0, message: '正在准备 PDF' });
    try {
      const { exportAssemblyGuidePdf } = await import('../../systems/AssemblyGuidePdfExporter');
      const blob = await exportAssemblyGuidePdf({
        guide,
        components,
        materials,
        onProgress: progress => {
          setExportProgress({
            percent: Math.min(100, Math.round(progress.current / progress.total * 100)),
            message: progress.message,
          });
        },
      });
      const safeName = guide.designName.replace(/[\\/:*?"<>|]/g, '_');
      saveAs(blob, `搭建教程_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
      message.success('搭建教程 PDF 已生成');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误';
      message.error(`PDF 生成失败：${detail}`);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }, [components, exporting, guide, materials]);

  return (
    <div className="assembly-guide-panel">
      <div className="assembly-guide-panel-hero">
        <div className="assembly-guide-panel-icon"><ToolOutlined /></div>
        <div>
          <Title level={4} style={{ margin: 0 }}>搭建教程</Title>
          <Text type="secondary">依据当前连接关系，自底向上生成线下搭建步骤。</Text>
        </div>
      </div>

      {result.status === 'blocked' ? (
        <Alert
          type="error"
          showIcon
          icon={<WarningFilled />}
          title="当前结构暂时不能生成可靠教程"
          description="请先处理以下连接或支撑问题。修复不会在教程中静默进行。"
        />
      ) : (
        <Alert
          type={result.status === 'warning' ? 'warning' : 'success'}
          showIcon
          icon={result.status === 'warning' ? <WarningFilled /> : <CheckCircleFilled />}
          title={result.status === 'warning' ? '教程可以生成，但有注意事项' : '结构检查通过，可以生成教程'}
        />
      )}

      {result.issues.length > 0 ? (
        <List
          size="small"
          className="assembly-guide-issue-list"
          dataSource={result.issues}
          renderItem={issue => (
            <List.Item>
              <Space align="start">
                <WarningFilled style={{ color: '#FF4D4F', marginTop: 4 }} />
                <div>
                  <div>{issue.message}</div>
                  {issue.repairable ? <Tag color="orange">可一键修复</Tag> : <Tag color="red">需要手动处理</Tag>}
                </div>
              </Space>
            </List.Item>
          )}
        />
      ) : null}

      {repairable ? (
        <Button icon={<SafetyCertificateOutlined />} onClick={handleRepair} block>
          一键修复可处理连接
        </Button>
      ) : null}

      {guide ? (
        <>
          <div className="assembly-guide-stats">
            <Statistic title="搭建步骤" value={guide.steps.length} suffix="步" />
            <Statistic title="PDF 页数" value={guide.steps.length + 3} suffix="页" />
            <Statistic title="独立结构" value={guide.subassemblies.length} suffix="组" />
          </div>
          {guide.warnings.length > 0 ? (
            <div className="assembly-guide-warning-list">
              {guide.warnings.map(warning => <div key={warning}>{warning}</div>)}
            </div>
          ) : null}
          <Divider style={{ margin: '18px 0 14px' }} />
          <Space orientation="vertical" style={{ width: '100%' }} size={10}>
            <Button
              type="primary"
              size="large"
              block
              icon={<EyeOutlined />}
              onClick={() => setViewerOpen(true)}
            >
              查看搭建教程
            </Button>
            <Button
              size="large"
              block
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              直接导出 PDF
            </Button>
          </Space>
          {exporting && exportProgress ? (
            <div className="assembly-guide-panel-progress">
              <Progress percent={exportProgress.percent} size="small" />
              <Text type="secondary">{exportProgress.message}</Text>
            </div>
          ) : null}
          <div className="assembly-guide-panel-note">
            <DownloadOutlined /> PDF 包含材料清单、逐步3D图和最终四向视图。
          </div>
          <AssemblyGuideViewer
            open={viewerOpen}
            guide={guide}
            components={components}
            connections={connections}
            exporting={exporting}
            exportProgress={exportProgress}
            onExport={handleExport}
            onClose={() => setViewerOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
};

export default AssemblyGuidePanel;
