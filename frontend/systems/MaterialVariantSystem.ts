import type { BoardStyle, ComponentInstance, PipeColor } from '../types';
import { COMPONENT_COLORS } from '../types';
import { getComponentById } from '../stores/componentLibrary';
import { isPipeColor } from './PipeColorSystem';

export interface MaterialVariantDescriptor {
  materialKey: string;
  componentId: string;
  name: string;
  specifications: string[];
}

const boardAppearance = (component: Pick<ComponentInstance, 'color' | 'properties'>) => ({
  color: (isPipeColor(component.color) ? component.color : 'green') as PipeColor,
  style: (component.properties?.boardStyle === 'perforated'
    ? 'perforated'
    : 'solid') as BoardStyle,
});

export const getMaterialVariantDescriptor = (
  component: ComponentInstance
): MaterialVariantDescriptor => {
  const definition = getComponentById(component.componentId);
  const baseName = definition?.name ?? component.componentId;
  if (!component.componentId.startsWith('board_')) {
    return {
      materialKey: component.componentId,
      componentId: component.componentId,
      name: baseName,
      specifications: [],
    };
  }

  const appearance = boardAppearance(component);
  const defaultVariant = appearance.style === 'solid' && appearance.color === 'green';
  return {
    materialKey: defaultVariant
      ? component.componentId
      : `${component.componentId}:${appearance.style}:${appearance.color}`,
    componentId: component.componentId,
    name: `${baseName}·${appearance.style === 'perforated' ? '圆孔' : '实心'}·${COMPONENT_COLORS[appearance.color].name}`,
    specifications: [
      appearance.style === 'perforated' ? '圆孔板' : '实心板',
      COMPONENT_COLORS[appearance.color].name,
    ],
  };
};

export const componentIdFromMaterialKey = (materialKey: string) =>
  materialKey.split(':')[0];

export const materialVariantLabelsFromKey = (materialKey: string): string[] => {
  const [, style, color] = materialKey.split(':');
  const labels: string[] = [];
  if (style === 'solid') labels.push('实心板');
  if (style === 'perforated') labels.push('圆孔板');
  if (isPipeColor(color)) labels.push(COMPONENT_COLORS[color].name);
  return labels;
};
