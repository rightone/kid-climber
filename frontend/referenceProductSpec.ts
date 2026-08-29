export interface ReferenceProductProfile {
  version: 2;
  unit: 'cm';
  modulePitches: readonly [20, 30, 40];
  pipe: {
    outerDiameter: 5;
    lengths: readonly [15, 25, 35];
    material: {
      metalness: 0;
      roughness: 0.48;
      emissiveIntensity: 0.04;
    };
    uCurve40cm: {
      centerlineRadius: 20;
      sweepDegrees: 180;
    };
  };
  connector: {
    portOffset: 2.5;
    socketDiameter: 5.5;
    bodyDiameter: 6.5;
    collarDiameter: 6.1;
    collarLength: 0.55;
    diagonalAngleDegrees: 45;
  };
  colors: {
    red: { name: '红色'; hex: '#E63B32' };
    yellow: { name: '黄色'; hex: '#F3D21F' };
    blue: { name: '蓝色'; hex: '#2D5EB5' };
    green: { name: '绿色'; hex: '#3BAA50' };
    connector: { name: '石墨黑'; hex: '#171717' };
  };
  board: {
    thickness: 2;
    frameClearance: 0.4;
    topInset: 0.3;
    bodyInset: 5.4;
  };
  ramps: {
    short: { length: 45; rise: 20; width: 40 };
    long: { length: 85; rise: 40; width: 40 };
  };
}

export interface PipeCenterlineSpec {
  kind: 'straight' | 'circular-arc';
  length?: number;
  radius?: number;
  sweepDegrees?: number;
  start: [number, number, number];
  end: [number, number, number];
  startDirection: [number, number, number];
  endDirection: [number, number, number];
}

export const REFERENCE_PRODUCT_PROFILE_VERSION = 2;

export const REFERENCE_PRODUCT_PROFILE_V1: ReferenceProductProfile = {
  version: REFERENCE_PRODUCT_PROFILE_VERSION,
  unit: 'cm',
  modulePitches: [20, 30, 40],
  pipe: {
    outerDiameter: 5,
    lengths: [15, 25, 35],
    material: {
      metalness: 0,
      roughness: 0.48,
      emissiveIntensity: 0.04,
    },
    uCurve40cm: {
      centerlineRadius: 20,
      sweepDegrees: 180,
    },
  },
  connector: {
    portOffset: 2.5,
    socketDiameter: 5.5,
    bodyDiameter: 6.5,
    collarDiameter: 6.1,
    collarLength: 0.55,
    diagonalAngleDegrees: 45,
  },
  colors: {
    red: { name: '红色', hex: '#E63B32' },
    yellow: { name: '黄色', hex: '#F3D21F' },
    blue: { name: '蓝色', hex: '#2D5EB5' },
    green: { name: '绿色', hex: '#3BAA50' },
    connector: { name: '石墨黑', hex: '#171717' },
  },
  board: {
    thickness: 2,
    frameClearance: 0.4,
    topInset: 0.3,
    bodyInset: 5.4,
  },
  ramps: {
    short: { length: 45, rise: 20, width: 40 },
    long: { length: 85, rise: 40, width: 40 },
  },
};

// Compatibility view used by the existing geometry and UI layers. New product
// behavior should be added to REFERENCE_PRODUCT_PROFILE_V1 first.
export const REFERENCE_PRODUCT_SPEC = {
  gridCm: 20,
  pipes: {
    outerDiameterCm: REFERENCE_PRODUCT_PROFILE_V1.pipe.outerDiameter,
    straightLengthsCm: REFERENCE_PRODUCT_PROFILE_V1.pipe.lengths,
    material: REFERENCE_PRODUCT_PROFILE_V1.pipe.material,
    uCurve40cm: {
      centerlineRadiusCm: REFERENCE_PRODUCT_PROFILE_V1.pipe.uCurve40cm.centerlineRadius,
      angleDegrees: REFERENCE_PRODUCT_PROFILE_V1.pipe.uCurve40cm.sweepDegrees,
    },
  },
  connectors: {
    portOffsetCm: REFERENCE_PRODUCT_PROFILE_V1.connector.portOffset,
    socketDiameterCm: REFERENCE_PRODUCT_PROFILE_V1.connector.socketDiameter,
    bodyDiameterCm: REFERENCE_PRODUCT_PROFILE_V1.connector.bodyDiameter,
    collarDiameterCm: REFERENCE_PRODUCT_PROFILE_V1.connector.collarDiameter,
    collarLengthCm: REFERENCE_PRODUCT_PROFILE_V1.connector.collarLength,
    armOuterDiameterScale:
      REFERENCE_PRODUCT_PROFILE_V1.connector.socketDiameter /
      REFERENCE_PRODUCT_PROFILE_V1.pipe.outerDiameter,
    hubOuterDiameterScale:
      REFERENCE_PRODUCT_PROFILE_V1.connector.bodyDiameter /
      REFERENCE_PRODUCT_PROFILE_V1.pipe.outerDiameter,
    connector45Degrees: REFERENCE_PRODUCT_PROFILE_V1.connector.diagonalAngleDegrees,
  },
  boards: {
    thicknessCm: REFERENCE_PRODUCT_PROFILE_V1.board.thickness,
    insetCm: REFERENCE_PRODUCT_PROFILE_V1.board.bodyInset,
    minimumInsetCm: 4,
    frameClearanceCm: REFERENCE_PRODUCT_PROFILE_V1.board.frameClearance,
    pipeCrownRecessCm: REFERENCE_PRODUCT_PROFILE_V1.board.topInset,
    earOuterRadiusCm: 3.1,
    earReliefRadiusCm: 1.85,
    bridgeOverlapCm: 2.4,
    perforation: {
      radiusCm: 1.5,
      pitchCm: 6,
      edgeMarginCm: 4.5,
    },
    sizes: {
      board_40x40: { widthCm: 40, heightCm: 40 },
      board_40x20: { widthCm: 40, heightCm: 20 },
    },
  },
  ramps: REFERENCE_PRODUCT_PROFILE_V1.ramps,
  colors: {
    red: REFERENCE_PRODUCT_PROFILE_V1.colors.red,
    yellow: REFERENCE_PRODUCT_PROFILE_V1.colors.yellow,
    blue: REFERENCE_PRODUCT_PROFILE_V1.colors.blue,
    green: REFERENCE_PRODUCT_PROFILE_V1.colors.green,
    black: REFERENCE_PRODUCT_PROFILE_V1.colors.connector,
  },
} as const;

export const getPipeCenterlineSpec = (
  componentId: string
): PipeCenterlineSpec | undefined => {
  const straightMatch = /^pipe_(15|25|35)cm$/.exec(componentId);
  if (straightMatch) {
    const length = Number(straightMatch[1]);
    return {
      kind: 'straight',
      length,
      start: [0, 0, -length / 2],
      end: [0, 0, length / 2],
      startDirection: [0, 0, -1],
      endDirection: [0, 0, 1],
    };
  }
  if (componentId === 'pipe_curve_u_40cm' || componentId === 'pipe_arc_40cm') {
    const radius = REFERENCE_PRODUCT_PROFILE_V1.pipe.uCurve40cm.centerlineRadius;
    return {
      kind: 'circular-arc',
      radius,
      sweepDegrees: REFERENCE_PRODUCT_PROFILE_V1.pipe.uCurve40cm.sweepDegrees,
      start: [-radius, 0, 0],
      end: [radius, 0, 0],
      startDirection: [0, 0, -1],
      endDirection: [0, 0, -1],
    };
  }
  return undefined;
};

export type ReferenceBoardId = keyof typeof REFERENCE_PRODUCT_SPEC.boards.sizes;

export const getReferenceBoardSize = (componentId: string) =>
  componentId === 'board_40x40' || componentId === 'board_40x20'
    ? REFERENCE_PRODUCT_SPEC.boards.sizes[componentId]
    : undefined;
