/**
 * rcpFootprint.mjs
 * Zero-dependency Reflected Ceiling Plan (RCP) & Photometric Footprint Geometry:
 *  1. 2D Rotated Physical Fixture Envelope (L×W vs 90° W×L) & Overhead Garage-Door Track Bay Solver
 *  2. Ceiling Fan Blade Sweep Strobe Exclusion Push (preserves baseGrid + fanShifted schedules)
 *  3. True Architectural CAD Scale Viewport Sizing (1/4"=1'-0" 1:48 & ISO 1:50 in inches & mm)
 *
 * License: MIT
 */

const FT_PER_METER = 1 / 0.3048;
const METERS_PER_FT = 0.3048;

const REFLECTANCE_BASE_CU = {
  bright: 0.92,
  standard: 0.85,
  garage: 0.78,
  dark: 0.66,
};

/**
 * Selects an optimal `(rows × cols)` ceiling grid balancing room aspect ratio,
 * minimum physical fixture pitch, center ceiling-fan box avoidance, and optional
 * clear ceiling bay row cap (`maxRowsCap`) ahead of open overhead garage doors.
 *
 * @param {number} targetCount
 * @param {number} lengthFt
 * @param {number} widthFt
 * @param {{
 *   minPitchXFt?: number,
 *   minPitchYFt?: number,
 *   avoidCenterPoint?: boolean,
 *   maxRowsCap?: number
 * }} [options={}]
 */
export function solveOptimalLightingGrid(
  targetCount,
  lengthFt,
  widthFt,
  options = {}
) {
  const minPitchXFt = options.minPitchXFt ?? 2.0;
  const minPitchYFt = options.minPitchYFt ?? 2.0;
  const avoidCenterPoint = options.avoidCenterPoint ?? false;
  const maxRowsCap = options.maxRowsCap;

  const safeTarget = Math.max(1, Math.min(64, Math.ceil(targetCount)));
  const rawMinAcceptable =
    avoidCenterPoint && targetCount > 4
      ? Math.max(2, Math.floor(targetCount * 0.94))
      : safeTarget;
  if (safeTarget === 1 && !avoidCenterPoint) return { rows: 1, cols: 1 };

  const maxCols = Math.max(
    1,
    Math.min(14, Math.floor(lengthFt / Math.max(1.5, minPitchXFt)))
  );
  const uncappedRows = Math.max(
    1,
    Math.min(12, Math.floor(widthFt / Math.max(1.5, minPitchYFt)))
  );
  const maxRows =
    maxRowsCap !== undefined
      ? Math.max(1, Math.min(uncappedRows, maxRowsCap))
      : uncappedRows;
  const minAcceptable = Math.min(rawMinAcceptable, maxRows * maxCols);

  let bestRows = Math.min(maxRows, Math.max(1, Math.round(Math.sqrt(safeTarget))));
  let bestCols = Math.min(maxCols, Math.max(1, Math.ceil(safeTarget / bestRows)));
  let bestScore = Infinity;

  for (let rows = 1; rows <= maxRows; rows++) {
    for (let cols = 1; cols <= maxCols; cols++) {
      const total = rows * cols;
      if (total < minAcceptable) continue;
      if (total > Math.max(safeTarget + 4, Math.ceil(safeTarget * 1.4))) {
        continue;
      }
      const pitchX = lengthFt / cols;
      const pitchY = widthFt / rows;
      const aspectRatioDiff = Math.abs(pitchX - pitchY) / Math.max(pitchX, pitchY);
      const countDiffRatio =
        total >= targetCount
          ? ((total - targetCount) / Math.max(4, targetCount)) * 0.95
          : ((targetCount - total) / Math.max(4, targetCount)) * 1.45;
      const hitsCenterFanBox = avoidCenterPoint && rows % 2 === 1 && cols % 2 === 1;
      const crossesFanAxis = avoidCenterPoint && (rows % 2 === 1 || cols % 2 === 1);
      const centerPenalty = hitsCenterFanBox ? 1.65 : crossesFanAxis ? 0.65 : 0;
      const score = aspectRatioDiff * 2.5 + countDiffRatio + centerPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestRows = rows;
        bestCols = cols;
      }
    }
  }

  return { rows: bestRows, cols: bestCols };
}

/**
 * Solves 2D physical fixture footprints on a Reflected Ceiling Plan (RCP):
 *  - Rotated linear/panel AABB envelope (`L×W` vs `90°` `W×L`)
 *  - Open overhead sectional garage-door track bay solver (`maxClearBayRows`, outer-column
 *    track nudge, and non-overlapping physical overflow pitch with exact `doorIntrusionFt`
 *    so manual overrides emit honest `WARNING` collision flags instead of false `PASS`)
 *  - Ceiling fan blade sweep strobe exclusion push returning both `baseGrid` (pre-shift)
 *    and `fanShifted` coordinates while clamping to perimeter wall margins.
 *
 * Accepts room dimensions in either feet (`roomLengthFt`, `roomWidthFt`) or meters
 * (`roomLengthM`, `roomWidthM`).
 */
export function solveRcpObstacleLayout(params = {}) {
  const L = Math.max(
    4,
    Math.min(
      160,
      params.roomLengthFt ??
        (params.roomLengthM !== undefined ? params.roomLengthM * FT_PER_METER : 24)
    )
  );
  const W = Math.max(
    4,
    Math.min(
      160,
      params.roomWidthFt ??
        (params.roomWidthM !== undefined ? params.roomWidthM * FT_PER_METER : 24)
    )
  );
  const ceilingH = Math.max(
    6.5,
    Math.min(
      45,
      params.ceilingHeightFt ??
        (params.ceilingHeightM !== undefined ? params.ceilingHeightM * FT_PER_METER : 10)
    )
  );
  const workH = Math.max(
    0,
    Math.min(
      ceilingH - 2,
      params.workplaneHeightFt ??
        (params.workplaneHeightM !== undefined ? params.workplaneHeightM * FT_PER_METER : 3.0)
    )
  );
  const mountH = Math.max(2.5, ceilingH - workH);
  const areaSqFt = L * W;

  const shape = params.fixtureShape ?? "linear";
  const fixtureLengthFt = params.fixtureLengthFt ?? 4.0;
  const fixtureWidthFt = params.fixtureWidthFt ?? 0.42;
  const diameterIn = params.fixtureDiameterIn;
  const rotateLinear90 = Boolean(params.rotateLinear90);

  const roundDiamFt = diameterIn ? diameterIn / 12 : fixtureLengthFt;
  const spanXFt =
    shape === "round"
      ? roundDiamFt
      : rotateLinear90
        ? fixtureWidthFt
        : fixtureLengthFt;
  const spanYFt =
    shape === "round"
      ? roundDiamFt
      : rotateLinear90
        ? fixtureLengthFt
        : fixtureWidthFt;
  const halfW = spanXFt / 2;
  const halfH = spanYFt / 2;
  const minPitchX = Math.max(2.2, spanXFt + 1.5);
  const minPitchY = Math.max(2.2, spanYFt + 1.5);

  // Photometric IES Zonal Cavity target count
  const beamAngleDeg = params.beamAngleDeg ?? 120;
  const baseCu = REFLECTANCE_BASE_CU[params.reflectance ?? "garage"] ?? 0.78;
  const rcr = (5 * mountH * (L + W)) / areaSqFt;
  const beamFactor = 0.94 + ((beamAngleDeg - 90) / 90) * 0.06;
  const cu = Math.max(0.38, Math.min(0.9, (baseCu * beamFactor) / (1 + 0.046 * rcr)));
  const safeLumens = Math.max(100, params.lumensPerFixture ?? 5200);
  const safeLlf = Math.max(0.5, Math.min(1.0, params.llf ?? 0.8));
  const targetFc = params.targetFc ?? 75;
  const rawTargetCount = (targetFc * areaSqFt) / (safeLumens * cu * safeLlf);
  const recommendedCount = Math.max(
    1,
    rawTargetCount - Math.floor(rawTargetCount) < 0.16 && rawTargetCount >= 7
      ? Math.floor(rawTargetCount)
      : Math.ceil(rawTargetCount)
  );

  // Overhead garage door zone on south/bottom wall: y in [W - doorD, W], centered on X
  const garageDoorEnabled = Boolean(params.garageDoorEnabled);
  const avoidGarageDoor = Boolean(params.avoidGarageDoor);
  const doorW = Math.min(L - 1, Math.max(6, params.garageDoorWidthFt ?? 16));
  const doorD = Math.min(W * 0.7, Math.max(4, params.garageDoorDepthFt ?? 8.5));
  const doorX0 = (L - doorW) / 2;
  const doorX1 = doorX0 + doorW;
  const doorY0 = W - doorD;

  const maxClearBayRows =
    garageDoorEnabled && avoidGarageDoor && doorW >= L * 0.45
      ? Math.max(1, Math.floor((doorY0 - 0.8 + 0.45) / (spanYFt + 0.45)))
      : undefined;

  const autoGrid = params.autoGrid ?? true;
  const ceilingFanEnabled = Boolean(params.ceilingFanEnabled);
  const grid = autoGrid
    ? solveOptimalLightingGrid(rawTargetCount, L, W, {
        minPitchXFt: minPitchX,
        minPitchYFt: minPitchY,
        avoidCenterPoint: ceilingFanEnabled,
        maxRowsCap: maxClearBayRows,
      })
    : {
        rows: Math.max(1, Math.min(12, Math.round(params.manualRows ?? 3))),
        cols: Math.max(1, Math.min(14, Math.round(params.manualCols ?? 3))),
      };

  const { rows, cols } = grid;
  const spacingRule = params.spacingRule ?? "half-pitch";
  const customWallOffsetFt = params.customWallOffsetFt ?? 3.0;

  let wallOffsetXFt;
  let wallOffsetYFt;
  let spacingXFt;
  let spacingYFt;

  if (spacingRule === "custom-offset") {
    const maxAllowedOffsetX = L * 0.42;
    const maxAllowedOffsetY = W * 0.42;
    wallOffsetXFt =
      cols === 1 ? L / 2 : Math.min(maxAllowedOffsetX, Math.max(1.0, customWallOffsetFt));
    wallOffsetYFt =
      rows === 1 ? W / 2 : Math.min(maxAllowedOffsetY, Math.max(1.0, customWallOffsetFt));
    spacingXFt = cols > 1 ? (L - 2 * wallOffsetXFt) / (cols - 1) : 0;
    spacingYFt = rows > 1 ? (W - 2 * wallOffsetYFt) / (rows - 1) : 0;
  } else {
    spacingXFt = L / cols;
    spacingYFt = W / rows;
    wallOffsetXFt = spacingXFt / 2;
    wallOffsetYFt = spacingYFt / 2;
  }

  const baseColMarksFt = Array.from(
    { length: cols },
    (_, c) => Number((wallOffsetXFt + c * spacingXFt).toFixed(4))
  );
  const baseRowMarksFt = Array.from(
    { length: rows },
    (_, r) => Number((wallOffsetYFt + r * spacingYFt).toFixed(4))
  );

  const basePoints = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xFt = baseColMarksFt[c];
      const yFt = baseRowMarksFt[r];
      basePoints.push({
        index: basePoints.length + 1,
        row: r,
        col: c,
        xFt,
        yFt,
        xM: Number((xFt * METERS_PER_FT).toFixed(4)),
        yM: Number((yFt * METERS_PER_FT).toFixed(4)),
      });
    }
  }

  const colMarksFt = [...baseColMarksFt];
  const rowMarksFt = [...baseRowMarksFt];

  const doorColumnNeedsShift =
    garageDoorEnabled &&
    avoidGarageDoor &&
    rowMarksFt.length > 0 &&
    rowMarksFt[rowMarksFt.length - 1] + halfH > doorY0 - 0.25;

  // Nudge outer side-lane columns outside overhead door tracks when safe wall room exists
  if (doorColumnNeedsShift && cols >= 2) {
    const grazeLeft = colMarksFt[0] + halfW - doorX0;
    const targetLeftX = doorX0 - halfW - 0.25;
    if (
      grazeLeft > 0.02 &&
      grazeLeft <= 0.8 &&
      targetLeftX >= halfW + 0.75 &&
      colMarksFt[1] - targetLeftX >= spanXFt + 0.5
    ) {
      colMarksFt[0] = Number(targetLeftX.toFixed(4));
    }

    const grazeRight = doorX1 - (colMarksFt[cols - 1] - halfW);
    const targetRightX = doorX1 + halfW + 0.25;
    if (
      grazeRight > 0.02 &&
      grazeRight <= 0.8 &&
      targetRightX <= L - halfW - 0.75 &&
      targetRightX - colMarksFt[cols - 2] >= spanXFt + 0.5
    ) {
      colMarksFt[cols - 1] = Number(targetRightX.toFixed(4));
    }
  }

  const islandEnabled = Boolean(params.islandEnabled);
  const minSafeY = Math.max(
    halfH + 0.45,
    islandEnabled ? Math.max(halfH + 0.45, 2.25) : Math.max(halfH + 0.45, 1.85)
  );
  const maxSafeY = doorY0 - halfH - 0.4;
  const minPhysicalPitchY = spanYFt + 0.35;

  let clearZoneRowMarksFt = null;
  if (doorColumnNeedsShift) {
    if (rows === 1) {
      clearZoneRowMarksFt = [minSafeY <= maxSafeY ? (minSafeY + maxSafeY) / 2 : minSafeY];
    } else if (maxSafeY - minSafeY >= (rows - 1) * minPhysicalPitchY) {
      clearZoneRowMarksFt = Array.from(
        { length: rows },
        (_, r) => Number((minSafeY + (r * (maxSafeY - minSafeY)) / (rows - 1)).toFixed(4))
      );
    } else {
      // Manual override overflow: space rows at physical non-overlapping pitch and let AABB door check flag overlap
      const startOverflowY = halfH + 0.35;
      const maxRoomY = Math.max(startOverflowY, W - halfH - 0.35);
      if ((rows - 1) * minPhysicalPitchY <= maxRoomY - startOverflowY) {
        clearZoneRowMarksFt = Array.from(
          { length: rows },
          (_, r) => Number((startOverflowY + r * minPhysicalPitchY).toFixed(4))
        );
      } else {
        clearZoneRowMarksFt = Array.from(
          { length: rows },
          (_, r) =>
            Number((startOverflowY + (r * (maxRoomY - startOverflowY)) / (rows - 1)).toFixed(4))
        );
      }
    }
  }

  const fanCenterX = L / 2;
  const fanCenterY = W / 2;
  const fanDiameterIn = params.ceilingFanDiameterIn ?? 52;
  const fanRadiusFt = fanDiameterIn / 24;
  const pushOutsideFan = Boolean(params.pushOutsideFan);
  const fanClearanceFt = params.fanClearanceFt ?? 2.5; // 30 inches clear of blade tip

  const candidatePoints = [];
  let anyColumnShiftedForDoor = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseXFt = baseColMarksFt[c];
      const baseYFt = baseRowMarksFt[r];
      let fx = colMarksFt[c];
      let fy = rowMarksFt[r];
      let shiftedForDoor = false;
      let pushedForFan = false;

      if (doorColumnNeedsShift && clearZoneRowMarksFt) {
        const overlapsDoorColX = fx + halfW > doorX0 + 0.02 && fx - halfW < doorX1 - 0.02;
        if (overlapsDoorColX) {
          fy = clearZoneRowMarksFt[r];
          shiftedForDoor = true;
          anyColumnShiftedForDoor = true;
        }
      }

      if (ceilingFanEnabled && pushOutsideFan) {
        const dx = fx - fanCenterX;
        const dy = fy - fanCenterY;
        const centerDist = Math.hypot(dx, dy);
        const edgeDistFromFanCenter =
          shape === "round"
            ? Math.max(0, centerDist - halfW)
            : Math.hypot(
                Math.max(0, Math.abs(dx) - halfW),
                Math.max(0, Math.abs(dy) - halfH)
              );
        const targetEdgeRadiusFt = fanRadiusFt + fanClearanceFt;
        if (edgeDistFromFanCenter < targetEdgeRadiusFt) {
          if (centerDist < 0.65 && rows * cols > 1) {
            continue;
          }
          const angle = centerDist < 0.05 ? 0 : Math.atan2(dy, dx);
          const pushCenterRadiusFt = targetEdgeRadiusFt + Math.max(halfW, halfH);
          const minWallX = Math.min(L / 2, Math.max(1.25, halfW + 0.5));
          const minWallY = Math.min(W / 2, Math.max(1.25, halfH + 0.5));
          fx = Math.min(
            L - minWallX,
            Math.max(minWallX, fanCenterX + Math.cos(angle) * pushCenterRadiusFt)
          );
          fy = Math.min(
            W - minWallY,
            Math.max(minWallY, fanCenterY + Math.sin(angle) * pushCenterRadiusFt)
          );
          pushedForFan = true;
        }
      }

      candidatePoints.push({
        row: r,
        col: c,
        baseXFt,
        baseYFt,
        xFt: Number(fx.toFixed(4)),
        yFt: Number(fy.toFixed(4)),
        shiftedForDoor,
        pushedForFan,
      });
    }
  }

  const minNeighborGapX = Math.max(2.15, spanXFt + 0.25);
  const minNeighborGapY = Math.max(2.15, spanYFt + 0.25);
  const filteredPoints = candidatePoints.filter((pt, i) => {
    if (!pt.pushedForFan || candidatePoints.length <= 2) return true;
    const squeezed = candidatePoints.some((other, j) => {
      if (i === j || (other.pushedForFan && j >= i)) return false;
      if (shape === "round") {
        return Math.hypot(pt.xFt - other.xFt, pt.yFt - other.yFt) < 2.15;
      }
      return (
        Math.abs(pt.xFt - other.xFt) < minNeighborGapX &&
        Math.abs(pt.yFt - other.yFt) < minNeighborGapY
      );
    });
    return !squeezed;
  });

  const fixtures = [];
  let fanDangerCount = 0;
  let fanCautionCount = 0;
  let doorBlockedCount = 0;
  let maxDoorIntrusionFt = 0;
  let maxDoorColumnSouthEdgeFt = 0;

  for (const pt of filteredPoints) {
    const { row, col, baseXFt, baseYFt, xFt: fx, yFt: fy, shiftedForDoor, pushedForFan } = pt;

    let strobeStatus = "safe";
    let fanTipClearanceIn = null;
    if (ceilingFanEnabled) {
      const edgeDistFt =
        shape === "round"
          ? Math.max(0, Math.hypot(fx - fanCenterX, fy - fanCenterY) - halfW)
          : Math.hypot(
              Math.max(0, Math.abs(fx - fanCenterX) - halfW),
              Math.max(0, Math.abs(fy - fanCenterY) - halfH)
            );
      const clearanceIn = (edgeDistFt - fanRadiusFt) * 12;
      fanTipClearanceIn = Math.round(clearanceIn);
      if (clearanceIn < 24) {
        strobeStatus = "danger";
        fanDangerCount++;
      } else if (clearanceIn < 36) {
        strobeStatus = "caution";
        fanCautionCount++;
      }
    }

    const overlapsDoorX = fx + halfW > doorX0 + 0.01 && fx - halfW < doorX1 - 0.01;
    const trailingYFt = Number((fy + halfH).toFixed(2));
    if (garageDoorEnabled && overlapsDoorX && trailingYFt > maxDoorColumnSouthEdgeFt) {
      maxDoorColumnSouthEdgeFt = trailingYFt;
    }
    const overlapsDoorY = fy + halfH > doorY0 + 0.01;
    const blockedByDoor = garageDoorEnabled && overlapsDoorX && overlapsDoorY;
    const doorIntrusionFt = blockedByDoor ? Number((fy + halfH - doorY0).toFixed(2)) : 0;
    if (blockedByDoor) {
      doorBlockedCount++;
      if (doorIntrusionFt > maxDoorIntrusionFt) maxDoorIntrusionFt = doorIntrusionFt;
    }

    fixtures.push({
      index: fixtures.length + 1,
      row,
      col,
      baseXFt,
      baseYFt,
      xFt: fx,
      yFt: fy,
      xM: Number((fx * METERS_PER_FT).toFixed(4)),
      yM: Number((fy * METERS_PER_FT).toFixed(4)),
      trailingYFt,
      shiftedForDoor,
      pushedForFan,
      blockedByDoor,
      doorIntrusionFt,
      fixtureOverlap: false,
      strobeStatus,
      fanTipClearanceIn,
    });
  }

  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      if (
        Math.abs(fixtures[i].xFt - fixtures[j].xFt) < spanXFt - 0.05 &&
        Math.abs(fixtures[i].yFt - fixtures[j].yFt) < spanYFt - 0.05
      ) {
        fixtures[i].fixtureOverlap = true;
        fixtures[j].fixtureOverlap = true;
      }
    }
  }
  const fixtureOverlapCount = fixtures.filter((f) => f.fixtureOverlap).length;
  const pushedCount = fixtures.filter((f) => f.pushedForFan).length;

  const auditStatus =
    doorBlockedCount > 0 || fixtureOverlapCount > 0 || fanDangerCount > 0
      ? "WARNING"
      : "PASS";

  return {
    auditStatus,
    roomLengthFt: Number(L.toFixed(4)),
    roomWidthFt: Number(W.toFixed(4)),
    mountingHeightFt: Number(mountH.toFixed(2)),
    rcr: Number(rcr.toFixed(2)),
    cu: Number(cu.toFixed(3)),
    recommendedCount,
    rows,
    cols,
    maxClearBayRows: maxClearBayRows ?? null,
    envelope: {
      spanXFt: Number(spanXFt.toFixed(2)),
      spanYFt: Number(spanYFt.toFixed(2)),
      halfWFt: Number(halfW.toFixed(2)),
      halfHFt: Number(halfH.toFixed(2)),
      rotated90: rotateLinear90,
    },
    doorZone: garageDoorEnabled
      ? {
          widthFt: doorW,
          depthFt: doorD,
          x0Ft: Number(doorX0.toFixed(2)),
          x1Ft: Number(doorX1.toFixed(2)),
          stopYFt: Number(doorY0.toFixed(2)),
        }
      : null,
    baseGrid: {
      wallOffsetXFt: Number(wallOffsetXFt.toFixed(4)),
      wallOffsetYFt: Number(wallOffsetYFt.toFixed(4)),
      spacingXFt: Number(spacingXFt.toFixed(4)),
      spacingYFt: Number(spacingYFt.toFixed(4)),
      colMarksFt: baseColMarksFt,
      rowMarksFt: baseRowMarksFt,
      points: basePoints,
    },
    fanShifted: {
      pushedCount,
      colMarksFt,
      shiftedDoorRowMarksFt:
        anyColumnShiftedForDoor && clearZoneRowMarksFt ? clearZoneRowMarksFt : null,
      fixtures,
    },
    doorBlockedCount,
    maxDoorIntrusionFt,
    maxDoorColumnSouthEdgeFt,
    fixtureOverlapCount,
    fanDangerCount,
    fanCautionCount,
  };
}

/**
 * Computes True Architectural CAD Scale Viewport geometry (`1/4"=1'-0"` `1:48`,
 * `1/8"=1'-0"` `1:96`, `1/16"=1'-0"` `1:192` in Imperial inches at `96 u/in`;
 * `ISO 1:50`, `1:100`, `1:200` in Metric millimeters at `1 u = 1 mm`).
 *
 * @param {number} roomLengthFt
 * @param {number} roomWidthFt
 * @param {"imperial" | "metric"} [units="imperial"]
 * @param {number} [extraFooterLines=0]
 */
export function computeCadScaleViewport(
  roomLengthFt,
  roomWidthFt,
  units = "imperial",
  extraFooterLines = 0
) {
  const L = Math.max(4, Math.min(160, roomLengthFt));
  const W = Math.max(4, Math.min(160, roomWidthFt));

  let spec;
  if (units === "metric") {
    const maxDimM = Math.max(L, W) * METERS_PER_FT;
    if (maxDimM <= 10.001) {
      spec = {
        ratioLabel: "1:50",
        archLabel: "ISO 1:50 (20 mm = 1 m)",
        physicalUnit: "mm",
        scaleUnitsPerFt: METERS_PER_FT * 20,
        userUnitsPerPhysical: 1,
        barStepFtOrM: maxDimM >= 2.2 ? 1 : 0.5,
        barUnitLabel: "m",
      };
    } else if (maxDimM <= 20.001) {
      spec = {
        ratioLabel: "1:100",
        archLabel: "ISO 1:100 (10 mm = 1 m)",
        physicalUnit: "mm",
        scaleUnitsPerFt: METERS_PER_FT * 10,
        userUnitsPerPhysical: 1,
        barStepFtOrM: 2,
        barUnitLabel: "m",
      };
    } else {
      spec = {
        ratioLabel: "1:200",
        archLabel: "ISO 1:200 (5 mm = 1 m)",
        physicalUnit: "mm",
        scaleUnitsPerFt: METERS_PER_FT * 5,
        userUnitsPerPhysical: 1,
        barStepFtOrM: 5,
        barUnitLabel: "m",
      };
    }
  } else {
    const maxDimFt = Math.max(L, W);
    if (maxDimFt <= 32) {
      spec = {
        ratioLabel: "1:48",
        archLabel: `1/4" = 1'-0" (1:48)`,
        physicalUnit: "in",
        scaleUnitsPerFt: 0.25 * 96, // 24.00 SVG user units per foot at 96 u/in
        userUnitsPerPhysical: 96,
        barStepFtOrM: maxDimFt >= 9 ? 4 : 2,
        barUnitLabel: "ft",
      };
    } else if (maxDimFt <= 64) {
      spec = {
        ratioLabel: "1:96",
        archLabel: `1/8" = 1'-0" (1:96)`,
        physicalUnit: "in",
        scaleUnitsPerFt: 0.125 * 96,
        userUnitsPerPhysical: 96,
        barStepFtOrM: 8,
        barUnitLabel: "ft",
      };
    } else {
      spec = {
        ratioLabel: "1:192",
        archLabel: `1/16" = 1'-0" (1:192)`,
        physicalUnit: "in",
        scaleUnitsPerFt: 0.0625 * 96,
        userUnitsPerPhysical: 96,
        barStepFtOrM: 16,
        barUnitLabel: "ft",
      };
    }
  }

  const u = units === "metric" ? 25.4 / 96 : 1;
  const roomUserW = L * spec.scaleUnitsPerFt;
  const roomUserH = W * spec.scaleUnitsPerFt;

  const padLeft = 112 * u;
  const padRight = 68 * u;
  const padTop = 98 * u;
  const scaleBarBandH = 32 * u;
  const footerBoxHeight = (70 + extraFooterLines * 17) * u;
  const padBottom = scaleBarBandH + footerBoxHeight + 34 * u;

  const contentW = Math.max(588 * u, roomUserW);
  const viewBoxW = padLeft + contentW + padRight;
  const viewBoxH = padTop + roomUserH + padBottom;

  const roomPaperWidth = roomUserW / spec.userUnitsPerPhysical;
  const roomPaperHeight = roomUserH / spec.userUnitsPerPhysical;
  const sheetWidth = viewBoxW / spec.userUnitsPerPhysical;
  const sheetHeight = viewBoxH / spec.userUnitsPerPhysical;

  const sheetWidthIn = spec.physicalUnit === "in" ? sheetWidth : sheetWidth / 25.4;
  const sheetHeightIn = spec.physicalUnit === "in" ? sheetHeight : sheetHeight / 25.4;
  const sheetWidthMm = spec.physicalUnit === "mm" ? sheetWidth : sheetWidth * 25.4;
  const sheetHeightMm = spec.physicalUnit === "mm" ? sheetHeight : sheetHeight * 25.4;

  return {
    ...spec,
    viewBoxWidth: Number(viewBoxW.toFixed(2)),
    viewBoxHeight: Number(viewBoxH.toFixed(2)),
    roomPaperWidth: Number(roomPaperWidth.toFixed(4)),
    roomPaperHeight: Number(roomPaperHeight.toFixed(4)),
    sheetWidthIn: Number(sheetWidthIn.toFixed(4)),
    sheetHeightIn: Number(sheetHeightIn.toFixed(4)),
    sheetWidthMm: Number(sheetWidthMm.toFixed(2)),
    sheetHeightMm: Number(sheetHeightMm.toFixed(2)),
    svgWidthAttr:
      spec.physicalUnit === "in"
        ? `${sheetWidthIn.toFixed(4)}in`
        : `${sheetWidthMm.toFixed(2)}mm`,
    svgHeightAttr:
      spec.physicalUnit === "in"
        ? `${sheetHeightIn.toFixed(4)}in`
        : `${sheetHeightMm.toFixed(2)}mm`,
  };
}
