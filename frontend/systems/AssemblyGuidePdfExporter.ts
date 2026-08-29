import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
} from 'pdf-lib';
import type { ComponentInstance, PipeColor } from '../types';
import { PIPE_COLOR_OPTIONS } from '../types';
import type { AssemblyGuide, AssemblyGuideStep } from './AssemblyStepSystem';
import {
  createAssemblyGuideImageRenderer,
  type AssemblyRenderView,
} from './AssemblyGuideRenderer';

export interface AssemblyGuideMaterialItem {
  componentId: string;
  componentName: string;
  quantity: number;
  unit: string;
  specifications: string;
}

export interface AssemblyGuidePdfProgress {
  current: number;
  total: number;
  message: string;
}

export interface ExportAssemblyGuidePdfInput {
  guide: AssemblyGuide;
  components: ComponentInstance[];
  materials: AssemblyGuideMaterialItem[];
  onProgress?: (progress: AssemblyGuidePdfProgress) => void;
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 38;
const BRAND_BLUE = rgb(0.086, 0.467, 1);
const DARK = rgb(0.059, 0.09, 0.165);
const MUTED = rgb(0.392, 0.455, 0.545);
const LIGHT = rgb(0.956, 0.969, 0.984);
const BORDER = rgb(0.82, 0.855, 0.902);
const ORANGE = rgb(0.961, 0.62, 0.043);
const GREEN = rgb(0.133, 0.773, 0.369);

const PHASE_LABEL: Record<AssemblyGuideStep['phase'], string> = {
  base: '底层框架',
  vertical: '竖向支撑',
  'upper-frame': '上层框架',
  platform: '平台板件',
  accessory: '附件安装',
  inspection: '最终检查',
};

const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const splitText = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) => {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    if (char === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const next = `${current}${char}`;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(current);
      current = char;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

const drawWrappedText = (
  page: PDFPage,
  text: string,
  font: PDFFont,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    lineHeight?: number;
    color?: ReturnType<typeof rgb>;
    maxLines?: number;
  }
) => {
  const lineHeight = options.lineHeight ?? options.size * 1.45;
  const lines = splitText(text, font, options.size, options.maxWidth)
    .slice(0, options.maxLines ?? Number.POSITIVE_INFINITY);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      size: options.size,
      font,
      color: options.color ?? DARK,
    });
  });
  return options.y - lines.length * lineHeight;
};

const drawSectionTitle = (
  page: PDFPage,
  font: PDFFont,
  title: string,
  x: number,
  y: number
) => {
  page.drawRectangle({ x, y: y - 3, width: 5, height: 18, color: BRAND_BLUE });
  page.drawText(title, { x: x + 13, y, size: 16, font, color: DARK });
};

const drawPageFrame = (
  page: PDFPage,
  font: PDFFont,
  guide: AssemblyGuide,
  title: string
) => {
  const { width, height } = page.getSize();
  page.drawText(guide.designName, {
    x: MARGIN,
    y: height - 24,
    size: 8.5,
    font,
    color: MUTED,
  });
  const titleWidth = font.widthOfTextAtSize(title, 8.5);
  page.drawText(title, {
    x: width - MARGIN - titleWidth,
    y: height - 24,
    size: 8.5,
    font,
    color: MUTED,
  });
  page.drawLine({
    start: { x: MARGIN, y: height - 31 },
    end: { x: width - MARGIN, y: height - 31 },
    thickness: 0.7,
    color: BORDER,
  });
};

const drawFooter = (
  page: PDFPage,
  font: PDFFont,
  guide: AssemblyGuide,
  index: number,
  total: number
) => {
  const { width } = page.getSize();
  const footer = `设计编号 ${guide.designSignature}  |  尺寸单位 cm  |  第 ${index}/${total} 页`;
  const footerWidth = font.widthOfTextAtSize(footer, 7.5);
  page.drawLine({
    start: { x: MARGIN, y: 27 },
    end: { x: width - MARGIN, y: 27 },
    thickness: 0.7,
    color: BORDER,
  });
  page.drawText(footer, {
    x: width - MARGIN - footerWidth,
    y: 15,
    size: 7.5,
    font,
    color: MUTED,
  });
};

const countPipeColors = (components: ComponentInstance[]) => {
  const counts = new Map<PipeColor, number>(PIPE_COLOR_OPTIONS.map(item => [item.id, 0]));
  components.forEach(component => {
    if (!component.componentId.startsWith('pipe_')) return;
    const color = component.color && component.color !== 'black' ? component.color : 'blue';
    counts.set(color, (counts.get(color) ?? 0) + 1);
  });
  return counts;
};

const drawCoverPage = async (
  pdf: PDFDocument,
  font: PDFFont,
  guide: AssemblyGuide,
  components: ComponentInstance[],
  imageBytes: Uint8Array
) => {
  const page = pdf.addPage(A4_LANDSCAPE);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: LIGHT });
  page.drawRectangle({ x: 0, y: 0, width: 19, height, color: BRAND_BLUE });
  page.drawText('攀爬架搭建教程', {
    x: 48,
    y: height - 76,
    size: 28,
    font,
    color: DARK,
  });
  drawWrappedText(page, guide.designName, font, {
    x: 48,
    y: height - 108,
    maxWidth: 300,
    size: 15,
    lineHeight: 21,
    color: BRAND_BLUE,
    maxLines: 2,
  });
  const image = await pdf.embedJpg(imageBytes);
  const imageWidth = 455;
  const imageHeight = image.height / image.width * imageWidth;
  page.drawImage(image, {
    x: width - imageWidth - 35,
    y: Math.max(72, (height - imageHeight) / 2 + 15),
    width: imageWidth,
    height: imageHeight,
  });
  const statY = height - 178;
  const stats = [
    ['组件', `${components.length} 个`],
    ['连接', `${guide.steps.flatMap(step => step.newConnectionIds).length} 处`],
    ['步骤', `${guide.steps.length} 步`],
    ['尺寸', `${guide.bounds.size.map(value => Math.round(value)).join(' × ')} cm`],
  ];
  stats.forEach(([label, value], index) => {
    const y = statY - index * 51;
    page.drawText(label, { x: 49, y, size: 9, font, color: MUTED });
    page.drawText(value, { x: 49, y: y - 20, size: 15, font, color: DARK });
  });
  const statusColor = guide.status === 'ready' ? GREEN : ORANGE;
  page.drawCircle({ x: 54, y: 91, size: 5, color: statusColor });
  page.drawText(guide.status === 'ready' ? '结构检查通过' : '结构可生成，存在提醒', {
    x: 66,
    y: 87,
    size: 10,
    font,
    color: DARK,
  });
  page.drawText('3D 图为安装示意，不作为比例尺直接量取。', {
    x: 49,
    y: 54,
    size: 8,
    font,
    color: MUTED,
  });
  return page;
};

const drawPreparationPage = (
  pdf: PDFDocument,
  font: PDFFont,
  guide: AssemblyGuide,
  components: ComponentInstance[],
  materials: AssemblyGuideMaterialItem[]
) => {
  const page = pdf.addPage(A4_LANDSCAPE);
  drawPageFrame(page, font, guide, '材料与施工准备');
  drawSectionTitle(page, font, '材料清单', MARGIN, 527);
  const tableX = MARGIN;
  const tableY = 493;
  const rowHeight = Math.min(23, 330 / Math.max(materials.length, 1));
  const columns = [275, 70, 60, 150];
  const headers = ['部件', '数量', '单位', '规格'];
  let cursorX = tableX;
  headers.forEach((header, index) => {
    page.drawRectangle({
      x: cursorX,
      y: tableY,
      width: columns[index],
      height: rowHeight,
      color: rgb(0.9, 0.925, 0.957),
      borderColor: BORDER,
      borderWidth: 0.6,
    });
    page.drawText(header, { x: cursorX + 7, y: tableY + 7, size: 9, font, color: DARK });
    cursorX += columns[index];
  });
  materials.forEach((material, rowIndex) => {
    const y = tableY - (rowIndex + 1) * rowHeight;
    const values = [
      material.componentName,
      String(material.quantity),
      material.unit,
      material.specifications || '-',
    ];
    let x = tableX;
    values.forEach((value, columnIndex) => {
      page.drawRectangle({
        x,
        y,
        width: columns[columnIndex],
        height: rowHeight,
        color: rowIndex % 2 === 0 ? rgb(1, 1, 1) : rgb(0.978, 0.984, 0.992),
        borderColor: BORDER,
        borderWidth: 0.45,
      });
      const text = splitText(value, font, 8.4, columns[columnIndex] - 12)[0] ?? '';
      page.drawText(text, { x: x + 6, y: y + 7, size: 8.4, font, color: DARK });
      x += columns[columnIndex];
    });
  });
  const rightX = 632;
  drawSectionTitle(page, font, '管件颜色', rightX, 527);
  const colorCounts = countPipeColors(components);
  PIPE_COLOR_OPTIONS.forEach((item, index) => {
    const y = 488 - index * 29;
    const color = item.hex.replace('#', '');
    page.drawCircle({
      x: rightX + 8,
      y: y + 5,
      size: 6,
      color: rgb(
        parseInt(color.slice(0, 2), 16) / 255,
        parseInt(color.slice(2, 4), 16) / 255,
        parseInt(color.slice(4, 6), 16) / 255
      ),
    });
    page.drawText(`${item.name}管 × ${colorCounts.get(item.id) ?? 0}`, {
      x: rightX + 22,
      y,
      size: 9,
      font,
      color: DARK,
    });
  });
  drawSectionTitle(page, font, '施工前准备', rightX, 345);
  const preparation = [
    '清点全部管件、接头、板件和附件。',
    '准备橡胶锤、水平尺、卷尺及对应紧固工具。',
    '确认搭建区域平整，并预留足够活动空间。',
    '儿童不得在未完成或未紧固的结构上攀爬。',
  ];
  preparation.forEach((item, index) => {
    const y = 316 - index * 43;
    page.drawCircle({ x: rightX + 5, y: y + 4, size: 2.5, color: BRAND_BLUE });
    drawWrappedText(page, item, font, {
      x: rightX + 15,
      y,
      maxWidth: 162,
      size: 8.5,
      lineHeight: 12,
      color: DARK,
      maxLines: 3,
    });
  });
  page.drawRectangle({
    x: rightX,
    y: 55,
    width: 171,
    height: 74,
    color: rgb(1, 0.973, 0.89),
    borderColor: ORANGE,
    borderWidth: 0.8,
  });
  drawWrappedText(page, '安全提示：本教程依据设计连接关系生成，不替代专业承重审查、产品认证或现场安全评估。', font, {
    x: rightX + 10,
    y: 111,
    maxWidth: 151,
    size: 8.2,
    lineHeight: 12,
    color: DARK,
  });
  return page;
};

const drawStepPage = async (
  pdf: PDFDocument,
  font: PDFFont,
  guide: AssemblyGuide,
  step: AssemblyGuideStep,
  imageBytes: Uint8Array
) => {
  const page = pdf.addPage(A4_LANDSCAPE);
  drawPageFrame(page, font, guide, `第 ${step.order} 步 · ${PHASE_LABEL[step.phase]}`);
  const image = await pdf.embedJpg(imageBytes);
  page.drawRectangle({
    x: MARGIN,
    y: 82,
    width: 520,
    height: 420,
    color: LIGHT,
    borderColor: BORDER,
    borderWidth: 0.8,
  });
  const maxImageWidth = 510;
  const maxImageHeight = 410;
  const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  page.drawImage(image, {
    x: MARGIN + (520 - imageWidth) / 2,
    y: 82 + (420 - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
  const rightX = 582;
  page.drawText(`第 ${step.order} 步`, { x: rightX, y: 492, size: 10, font, color: BRAND_BLUE });
  drawWrappedText(page, step.title, font, {
    x: rightX,
    y: 463,
    maxWidth: 220,
    size: 20,
    lineHeight: 26,
    maxLines: 2,
  });
  let y = drawWrappedText(page, step.instruction, font, {
    x: rightX,
    y: 406,
    maxWidth: 220,
    size: 9.2,
    lineHeight: 14,
    color: MUTED,
    maxLines: 4,
  }) - 8;
  page.drawText('本步部件', { x: rightX, y, size: 10, font, color: DARK });
  y -= 19;
  if (step.parts.length === 0) {
    page.drawText('无需新增部件', { x: rightX, y, size: 8.5, font, color: MUTED });
    y -= 20;
  } else {
    step.parts.forEach(part => {
      page.drawCircle({ x: rightX + 3, y: y + 3, size: 2, color: BRAND_BLUE });
      page.drawText(`${part.name} × ${part.quantity}`, {
        x: rightX + 12,
        y,
        size: 8.5,
        font,
        color: DARK,
      });
      y -= 17;
    });
  }
  y -= 5;
  page.drawText(`新增连接 ${step.newConnectionIds.length} 处`, {
    x: rightX,
    y,
    size: 10,
    font,
    color: DARK,
  });
  y -= 20;
  step.callouts.slice(0, 8).forEach(callout => {
    page.drawCircle({ x: rightX + 8, y: y + 4, size: 7, color: ORANGE });
    const number = String(callout.order);
    const numberWidth = font.widthOfTextAtSize(number, 7.5);
    page.drawText(number, {
      x: rightX + 8 - numberWidth / 2,
      y: y + 1.5,
      size: 7.5,
      font,
      color: DARK,
    });
    drawWrappedText(page, callout.description, font, {
      x: rightX + 21,
      y,
      maxWidth: 198,
      size: 7.6,
      lineHeight: 10,
      maxLines: 1,
    });
    y -= 22;
  });
  if (step.callouts.length > 8) {
    page.drawText(`另有 ${step.callouts.length - 8} 处连接，请按图中编号复核`, {
      x: rightX,
      y,
      size: 7.5,
      font,
      color: MUTED,
    });
    y -= 18;
  }
  y = Math.min(y - 4, 154);
  page.drawText('完成检查', { x: rightX, y, size: 10, font, color: DARK });
  y -= 19;
  step.checks.slice(0, 3).forEach(check => {
    page.drawRectangle({
      x: rightX,
      y: y - 1,
      width: 8,
      height: 8,
      borderColor: GREEN,
      borderWidth: 0.8,
    });
    drawWrappedText(page, check, font, {
      x: rightX + 15,
      y,
      maxWidth: 204,
      size: 8.2,
      lineHeight: 11,
      maxLines: 2,
    });
    y -= 24;
  });
  return page;
};

const drawFinalViewsPage = async (
  pdf: PDFDocument,
  font: PDFFont,
  guide: AssemblyGuide,
  views: Array<{ view: AssemblyRenderView; label: string; bytes: Uint8Array }>
) => {
  const page = pdf.addPage(A4_LANDSCAPE);
  drawPageFrame(page, font, guide, '最终图纸');
  drawSectionTitle(page, font, '最终结构视图', MARGIN, 527);
  const positions = [
    { x: MARGIN, y: 291 },
    { x: 419, y: 291 },
    { x: MARGIN, y: 54 },
    { x: 419, y: 54 },
  ];
  for (let index = 0; index < views.length; index += 1) {
    const image = await pdf.embedJpg(views[index].bytes);
    const position = positions[index];
    page.drawRectangle({
      x: position.x,
      y: position.y,
      width: 365,
      height: 207,
      color: LIGHT,
      borderColor: BORDER,
      borderWidth: 0.7,
    });
    page.drawImage(image, {
      x: position.x + 3,
      y: position.y + 3,
      width: 359,
      height: 202,
    });
    page.drawRectangle({
      x: position.x + 8,
      y: position.y + 9,
      width: 58,
      height: 19,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });
    page.drawText(views[index].label, {
      x: position.x + 15,
      y: position.y + 15,
      size: 8.5,
      font,
      color: DARK,
    });
  }
  return page;
};

export const exportAssemblyGuidePdf = async ({
  guide,
  components,
  materials,
  onProgress,
}: ExportAssemblyGuidePdfInput): Promise<Blob> => {
  const renderableSteps = guide.steps;
  const totalWork = renderableSteps.length + 7;
  let currentWork = 0;
  const report = (message: string) => {
    currentWork += 1;
    onProgress?.({ current: currentWork, total: totalWork, message });
  };
  const fontResponse = await fetch('/fonts/NotoSansSC-Regular.otf');
  if (!fontResponse.ok) throw new Error('无法加载 PDF 中文字体资源。');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Dynamic CJK subsetting produces missing glyphs in some PDF print engines.
  // The complete local font is larger, but keeps every Chinese label printable.
  const font = await pdf.embedFont(await fontResponse.arrayBuffer(), { subset: false });
  pdf.setTitle(`${guide.designName} - 搭建教程`);
  pdf.setAuthor('攀爬架设计软件');
  pdf.setSubject('攀爬架搭建步骤与施工图');
  pdf.setCreator('Kid Climber Assembly Guide');
  pdf.setProducer('pdf-lib');
  pdf.setCreationDate(new Date());

  const imageRenderer = createAssemblyGuideImageRenderer();
  try {
    const coverBlob = await imageRenderer.render({
      guide,
      components,
      mode: 'final',
      view: 'isometric',
      includeCallouts: false,
    });
    report('正在生成封面视图');
    const coverBytes = await blobToBytes(coverBlob);
    await drawCoverPage(pdf, font, guide, components, coverBytes);
    drawPreparationPage(pdf, font, guide, components, materials);
    report('正在整理材料清单');

    for (const step of renderableSteps) {
      const imageBytes = step.phase === 'inspection'
        ? coverBytes
        : await blobToBytes(await imageRenderer.render({
            guide,
            components,
            step,
            mode: 'cumulative',
            view: 'isometric',
            includeCallouts: true,
          }));
      await drawStepPage(pdf, font, guide, step, imageBytes);
      report(`正在生成第 ${step.order} 步`);
    }

    const finalViews: Array<{ view: AssemblyRenderView; label: string; bytes: Uint8Array }> = [];
    const viewDefinitions: Array<{ view: AssemblyRenderView; label: string }> = [
      { view: 'isometric', label: '等轴测' },
      { view: 'front', label: '正视图' },
      { view: 'right', label: '侧视图' },
      { view: 'top', label: '俯视图' },
    ];
    for (const definition of viewDefinitions) {
      const bytes = definition.view === 'isometric'
        ? coverBytes
        : await blobToBytes(await imageRenderer.render({
            guide,
            components,
            mode: 'final',
            view: definition.view,
            width: 960,
            height: 540,
            includeCallouts: false,
          }));
      finalViews.push({ ...definition, bytes });
      report(`正在生成${definition.label}`);
    }
    await drawFinalViewsPage(pdf, font, guide, finalViews);
    const pages = pdf.getPages();
    pages.forEach((page, index) => drawFooter(page, font, guide, index + 1, pages.length));
    report('正在写入 PDF 文件');
    const bytes = await pdf.save();
    const output = new Uint8Array(bytes.length);
    output.set(bytes);
    return new Blob([output.buffer], { type: 'application/pdf' });
  } finally {
    imageRenderer.dispose();
  }
};
