import test from "node:test";
import assert from "node:assert/strict";
import {
  solveZonalCavityFixtures,
  solveIrcBalusterSpacing,
  solveFenceConcreteMix,
  solveRetainingWallTakeoff,
  solveRcpObstacleLayout,
  computeCadScaleViewport,
} from "../formulas.mjs";

test("21.5 x 19.5 ft rotated 90° 4ft strip garage: auto 2x6 PASS (10.60 ft <= 11.00 ft) vs manual 3x4 WARNING (13.05 ft > 11.00 ft)", () => {
  const baseGarageInputs = {
    roomLengthFt: 21.5,
    roomWidthFt: 19.5,
    ceilingHeightFt: 10,
    workplaneHeightFt: 3.0,
    fixtureShape: "linear",
    fixtureLengthFt: 4.0,
    fixtureWidthFt: 0.42,
    rotateLinear90: true,
    lumensPerFixture: 5200,
    beamAngleDeg: 120,
    targetFc: 75,
    reflectance: "garage",
    llf: 0.8,
    garageDoorEnabled: true,
    garageDoorWidthFt: 16,
    garageDoorDepthFt: 8.5,
    avoidGarageDoor: true,
  };

  // 1) Auto-grid caps clear bay rows at maxClearBayRows = 2 -> selects 2x6 PASS
  const autoRes = solveRcpObstacleLayout({
    ...baseGarageInputs,
    autoGrid: true,
  });

  assert.equal(autoRes.envelope.spanXFt, 0.42);
  assert.equal(autoRes.envelope.spanYFt, 4.0);
  assert.equal(autoRes.doorZone.stopYFt, 11.0);
  assert.equal(autoRes.maxClearBayRows, 2);
  assert.equal(autoRes.rows, 2);
  assert.equal(autoRes.cols, 6);
  assert.equal(autoRes.maxDoorColumnSouthEdgeFt, 10.6);
  assert.ok(autoRes.maxDoorColumnSouthEdgeFt <= autoRes.doorZone.stopYFt);
  assert.equal(autoRes.doorBlockedCount, 0);
  assert.equal(autoRes.fixtureOverlapCount, 0);
  assert.equal(autoRes.auditStatus, "PASS");

  // 2) Manual 3x4 override overflows the 11.00 ft clear bay -> Row 3 reaches 13.05 ft > 11.00 ft (WARNING!)
  const manualRes = solveRcpObstacleLayout({
    ...baseGarageInputs,
    autoGrid: false,
    manualRows: 3,
    manualCols: 4,
  });

  assert.equal(manualRes.rows, 3);
  assert.equal(manualRes.cols, 4);
  assert.equal(manualRes.maxDoorColumnSouthEdgeFt, 13.05);
  assert.ok(manualRes.maxDoorColumnSouthEdgeFt > manualRes.doorZone.stopYFt);
  assert.equal(manualRes.maxDoorIntrusionFt, 2.05);
  assert.ok(manualRes.doorBlockedCount > 0);
  assert.equal(manualRes.fixtureOverlapCount, 0);
  assert.equal(manualRes.auditStatus, "WARNING");
});

test("4.85 x 4.25 m room with 52-inch ceiling fan: preserves baseGrid and radially pushes fanShifted coordinates clear of strobe zone", () => {
  const roomConfig = {
    roomLengthM: 4.85,
    roomWidthM: 4.25,
    ceilingHeightM: 2.75,
    workplaneHeightM: 0.76,
    fixtureShape: "round",
    fixtureDiameterIn: 6,
    autoGrid: false,
    manualRows: 2,
    manualCols: 3,
    ceilingFanEnabled: true,
    ceilingFanDiameterIn: 52,
  };

  // Without pushOutsideFan: center column fixtures sit ~13" from blade tips (< 24" danger threshold)
  const unshifted = solveRcpObstacleLayout({
    ...roomConfig,
    pushOutsideFan: false,
  });
  assert.equal(unshifted.fanDangerCount, 2);
  assert.equal(unshifted.auditStatus, "WARNING");

  // With pushOutsideFan: preserves baseGrid AND shifts the 2 center-column fixtures outside R_blade + 30"
  const shifted = solveRcpObstacleLayout({
    ...roomConfig,
    pushOutsideFan: true,
  });

  assert.equal(shifted.baseGrid.points.length, 6);
  assert.equal(shifted.fanShifted.pushedCount, 2);
  assert.equal(shifted.fanDangerCount, 0);
  assert.equal(shifted.auditStatus, "PASS");

  // Verify baseGrid coordinates stay untouched while fanShifted coordinates respect wall margins (>= 1.25 ft / 0.381 m)
  const pushedFixtures = shifted.fanShifted.fixtures.filter((f) => f.pushedForFan);
  assert.equal(pushedFixtures.length, 2);
  for (const f of pushedFixtures) {
    assert.notEqual(f.yFt, f.baseYFt);
    assert.ok(f.fanTipClearanceIn >= 30, `Expected >= 30" blade clearance, got ${f.fanTipClearanceIn}"`);
    assert.ok(f.xFt >= 1.25 && f.xFt <= shifted.roomLengthFt - 1.25);
    assert.ok(f.yFt >= 1.25 && f.yFt <= shifted.roomWidthFt - 1.25);
  }
});

test("computeCadScaleViewport sizes true 1/4\"=1'-0\" (1:48) Imperial and ISO 1:50 Metric CAD sheets", () => {
  // 21.5 x 19.5 ft at 1/4" = 1'-0" (1:48) -> 5.3750 in x 4.8750 in room drawing
  const imp = computeCadScaleViewport(21.5, 19.5, "imperial", 1);
  assert.equal(imp.ratioLabel, "1:48");
  assert.equal(imp.physicalUnit, "in");
  assert.equal(imp.scaleUnitsPerFt, 24);
  assert.equal(imp.roomPaperWidth, 5.375);
  assert.equal(imp.roomPaperHeight, 4.875);
  assert.match(imp.svgWidthAttr, /in$/);

  // 4.85 x 4.25 m at ISO 1:50 (20 mm = 1 m) -> 97.00 mm x 85.00 mm room drawing
  const met = computeCadScaleViewport(4.85 / 0.3048, 4.25 / 0.3048, "metric", 1);
  assert.equal(met.ratioLabel, "1:50");
  assert.equal(met.physicalUnit, "mm");
  assert.equal(met.roomPaperWidth, 97);
  assert.equal(met.roomPaperHeight, 85);
  assert.match(met.svgWidthAttr, /mm$/);
});

test("IRC R312.1.3 baluster spacing, fence post displacement, and NCMA retaining wall takeoff regressions", () => {
  const ies = solveZonalCavityFixtures({
    lengthFt: 24,
    widthFt: 24,
    ceilingHeightFt: 10,
    workplaneFt: 3.0,
    targetFootCandles: 75,
    lumensPerFixture: 5200,
  });
  assert.equal(ies.areaSqFt, 576);
  assert.ok(ies.minFixtures >= 11);

  const rail = solveIrcBalusterSpacing({
    clearSpanIn: 92,
    balusterWidthIn: 1.5,
    maxClearGapIn: 3.75,
    stairRiseIn: 7.5,
    stairRunIn: 10.5,
  });
  assert.equal(rail.irc4InchPass, true);
  assert.ok(rail.exactHorizGapIn < 4.0);

  const fence = solveFenceConcreteMix({ totalRunFt: 84, gateCount: 1, gateWidthFt: 4 });
  assert.equal(fence.netFenceRunFt, 80);
  assert.equal(fence.bayCount, 10);
  assert.equal(fence.equalBayFt, 8);

  const wall = solveRetainingWallTakeoff({ wallLengthFt: 36, exposedHeightFt: 3.5 });
  assert.equal(wall.exposedCourses, 7);
  assert.equal(wall.buriedCourses, 1);
  assert.equal(wall.ircPermitCheckTriggered, true);
});
