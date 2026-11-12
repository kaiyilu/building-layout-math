#!/usr/bin/env node
/**
 * building-layout-math — Zero-dependency field equations for:
 * 1. IES Zonal Cavity lighting layout & ceiling fan strobe clearance
 * 2. 2024 IRC R312.1.3 baluster / angled stair spindle spacing & 1/16" tape marks
 * 3. Fence post equalized bay layout & post-hole displacement concrete bag math
 */

import { pathToFileURL } from "node:url";

export function formatSixteenths(inches) {
  const total16 = Math.round(Math.max(0, inches) * 16);
  const whole = Math.floor(total16 / 16);
  let num = total16 % 16;
  if (num === 0) return `${whole}"`;
  let den = 16;
  while (num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return whole === 0 ? `${num}/${den}"` : `${whole}-${num}/${den}"`;
}

/**
 * IES Zonal Cavity Method + Ceiling Grid Solver
 */
export function solveZonalCavityFixtures({
  lengthFt,
  widthFt,
  ceilingHeightFt,
  workplaneFt = 2.5,
  targetFootCandles = 40,
  lumensPerFixture = 1100,
  baseCu = 0.78,
  lightLossFactor = 0.88,
  fanDiameterIn = 0,
}) {
  const areaSqFt = lengthFt * widthFt;
  const cavityHeightFt = Math.max(2.5, ceilingHeightFt - workplaneFt);
  const rcr = (5 * cavityHeightFt * (lengthFt + widthFt)) / areaSqFt;
  const cu = Math.max(0.38, Math.min(0.9, baseCu / (1 + 0.046 * rcr)));
  const rawFixtures =
    (targetFootCandles * areaSqFt) /
    (lumensPerFixture * cu * lightLossFactor);
  const minFixtures = Math.max(1, Math.ceil(rawFixtures));
  const minFanCenterClearanceIn =
    fanDiameterIn > 0 ? fanDiameterIn / 2 + 24 : 0;

  return {
    areaSqFt,
    rcr: Number(rcr.toFixed(2)),
    cu: Number(cu.toFixed(3)),
    rawFixtures: Number(rawFixtures.toFixed(2)),
    minFixtures,
    minFanCenterClearanceIn,
  };
}

/**
 * 2024 IRC R312.1.3 Level Guardrail & Sloped Stair Spindle Solver
 */
export function solveIrcBalusterSpacing({
  clearSpanIn,
  balusterWidthIn = 1.5,
  maxClearGapIn = 3.75,
  stairRiseIn = 0,
  stairRunIn = 10.5,
}) {
  const unitPitchLimit = balusterWidthIn + maxClearGapIn;
  const balusterCount = Math.max(
    1,
    Math.ceil((clearSpanIn - maxClearGapIn) / unitPitchLimit)
  );
  const gapCount = balusterCount + 1;
  const exactHorizGapIn =
    (clearSpanIn - balusterCount * balusterWidthIn) / gapCount;
  const horizOnCenterIn = exactHorizGapIn + balusterWidthIn;

  const isStair = stairRiseIn > 0 && stairRunIn > 0;
  const rakeRad = isStair ? Math.atan2(stairRiseIn, stairRunIn) : 0;
  const rakeAngleDeg = (rakeRad * 180) / Math.PI;
  const cosRake = Math.cos(rakeRad);

  // Inscribed sphere diameter inside tread-riser-rail right triangle: d = (a + b - c) for incircle?
  // Wait: incircle diameter of right triangle with legs R, T and hypotenuse H is R + T - H!
  // Plus bottom rail sweep clearance normal to rake line.
  const hyp = isStair ? Math.hypot(stairRiseIn, stairRunIn) : 0;
  const stepThroatIncircleDiameterIn = isStair
    ? stairRiseIn + stairRunIn - hyp
    : 0;

  const leadingTapeMarks = Array.from({ length: balusterCount }, (_, i) => {
    const horizLead = exactHorizGapIn + i * horizOnCenterIn;
    return {
      index: i + 1,
      horizLeading: formatSixteenths(horizLead),
      slopedLeading: isStair ? formatSixteenths(horizLead / cosRake) : null,
    };
  });

  return {
    balusterCount,
    exactHorizGapIn: Number(exactHorizGapIn.toFixed(3)),
    exactHorizGapTape: formatSixteenths(exactHorizGapIn),
    irc4InchPass: exactHorizGapIn < 4.0,
    rakeAngleDeg: Number(rakeAngleDeg.toFixed(1)),
    slopedOnCenterTape: isStair
      ? formatSixteenths(horizOnCenterIn / cosRake)
      : null,
    stepThroatIncircleDiameterIn: Number(
      stepThroatIncircleDiameterIn.toFixed(2)
    ),
    sampleFirst3Marks: leadingTapeMarks.slice(0, 3),
  };
}

/**
 * Fence Post Equalized Bay & Concrete Cylinder Displacement Solver
 */
export function solveFenceConcreteMix({
  totalRunFt,
  gateCount = 1,
  gateWidthFt = 4,
  maxSpacingFt = 8,
  holeDiameterIn = 10,
  holeDepthIn = 30,
  postWidthIn = 3.5,
}) {
  const netFenceRunFt = Math.max(4, totalRunFt - gateCount * gateWidthFt);
  const bayCount = Math.ceil(netFenceRunFt / maxSpacingFt);
  const equalBayFt = netFenceRunFt / bayCount;
  const totalPosts = bayCount + 1 + gateCount;

  const holeRadiusFt = holeDiameterIn / 24;
  const concreteDepthFt = Math.max(1, (holeDepthIn - 4) / 12); // 4" gravel drainage base
  const postAreaSqFt = Math.pow(postWidthIn / 12, 2);
  const netCuFtPerHole =
    (Math.PI * holeRadiusFt * holeRadiusFt - postAreaSqFt) * concreteDepthFt;
  const totalCuFt = netCuFtPerHole * totalPosts;

  return {
    totalRunFt,
    netFenceRunFt,
    bayCount,
    equalBayFt: Number(equalBayFt.toFixed(2)),
    totalPosts,
    bags50LbFastSet: Math.ceil(totalCuFt / 0.375),
    bags80LbStandard: Math.ceil(totalCuFt / 0.6),
  };
}

/**
 * IRC R404.4 & NCMA Segmental Retaining Wall + Two-Zone Gravel Compaction Solver
 */
export function solveRetainingWallTakeoff({
  wallLengthFt,
  exposedHeightFt,
  blockHeightIn = 6,
  blockLengthIn = 16,
  blockDepthIn = 12,
  baseDepthIn = 6,
  drainageWidthIn = 12,
  wastePct = 8,
  hasSlopeOrDrivewaySurcharge = false,
}) {
  const exposedTargetIn = exposedHeightFt * 12;
  const exposedCourses = Math.ceil(exposedTargetIn / blockHeightIn);
  const minEmbedIn = Math.max(6, exposedTargetIn * 0.1);
  const buriedCourses = Math.max(1, Math.ceil(minEmbedIn / blockHeightIn));
  const totalCourses = exposedCourses + buriedCourses;

  const blocksPerCourse = Math.ceil((wallLengthFt * 12) / blockLengthIn);
  const totalBlocks = Math.ceil(
    blocksPerCourse * totalCourses * (1 + wastePct / 100)
  );

  const trenchWidthIn = Math.max(blockDepthIn + 12, Math.round(blockDepthIn * 1.8));
  const crusherRunCuYd =
    (wallLengthFt * (trenchWidthIn / 12) * (baseDepthIn / 12) * 1.15) / 27;
  const crusherRunTons = crusherRunCuYd * 1.4;

  const drainHeightFt = Math.max(0.5, (totalCourses * blockHeightIn - 2) / 12);
  const cleanStone57CuYd =
    (wallLengthFt * (drainageWidthIn / 12) * drainHeightFt * 1.08) / 27;
  const cleanStone57Tons = cleanStone57CuYd * 1.3;

  const totalStructuralHeightIn = totalCourses * blockHeightIn;
  const totalFootingToTopIn = totalStructuralHeightIn + baseDepthIn;
  const requiresGeogrid =
    totalStructuralHeightIn > 42 || hasSlopeOrDrivewaySurcharge;

  return {
    exposedCourses,
    buriedCourses,
    totalCourses,
    totalBlocks,
    crusherRunTons: Number(crusherRunTons.toFixed(2)),
    cleanStone57Tons: Number(cleanStone57Tons.toFixed(2)),
    ircPermitCheckTriggered:
      totalFootingToTopIn > 48 || hasSlopeOrDrivewaySurcharge,
    geogridLayers: requiresGeogrid
      ? Math.max(1, Math.floor((totalCourses - 1) / 2))
      : 0,
    minGeogridEmbedmentFt: requiresGeogrid
      ? Math.max(4.0, Number(((totalStructuralHeightIn / 12) * 0.7).toFixed(1)))
      : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("=== 1. IES Zonal Cavity Workshop Demo (24x24 ft, 10 ft ceiling, 75 fc) ===");
  console.log(
    solveZonalCavityFixtures({
      lengthFt: 24,
      widthFt: 24,
      ceilingHeightFt: 10,
      workplaneFt: 3.0,
      targetFootCandles: 75,
      lumensPerFixture: 5200,
    })
  );

  console.log("\n=== 2. IRC R312.1.3 Stair Spindle Rake Demo (92\" span, 7.5\"/10.5\" pitch) ===");
  console.log(
    solveIrcBalusterSpacing({
      clearSpanIn: 92,
      balusterWidthIn: 1.25,
      maxClearGapIn: 3.75,
      stairRiseIn: 7.5,
      stairRunIn: 10.5,
    })
  );

  console.log("\n=== 3. Equalized Fence Post & Concrete Displacement Demo (84 ft + 4 ft gate) ===");
  console.log(solveFenceConcreteMix({ totalRunFt: 84, gateCount: 1, gateWidthFt: 4 }));

  console.log("\n=== 4. IRC R404.4 & NCMA Retaining Wall Demo (36 ft × 3.5 ft, 6x16 SRW) ===");
  console.log(solveRetainingWallTakeoff({ wallLengthFt: 36, exposedHeightFt: 3.5 }));
}
