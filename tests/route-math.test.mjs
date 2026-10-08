import assert from "node:assert/strict";
import test from "node:test";
import {
  SNACK_STOP_MINUTES,
  calculateFoodStop,
  calculateGapWindow,
  clockToMinutes,
  estimatedStageWalk,
  overlapMinutes,
} from "../lib/route-math.mjs";

test("Friday gap leaves a 20-minute line threshold", () => {
  const result = calculateGapWindow("18:00", "18:45", 25);
  assert.equal(result.windowStart, clockToMinutes("18:00"));
  assert.equal(result.windowEnd, clockToMinutes("18:45"));
  assert.equal(result.gapMinutes, 45);
  assert.equal(result.allowanceMinutes, 25);
  assert.equal(result.lineThresholdMinutes, 20);
  assert.equal(result.fits, true);
});

test("Clipse demo costs 25 minutes for the full stop", () => {
  const result = calculateFoodStop("18:45", "19:35");
  assert.equal(result.stopStart, clockToMinutes("18:40"));
  assert.equal(result.stopEnd, clockToMinutes("19:10"));
  assert.equal(result.costMinutes, 25);
});

test("a 10-minute food stop overlap stays deterministic", () => {
  const result = calculateFoodStop("18:45", "19:35", { durationMinutes: SNACK_STOP_MINUTES });
  assert.equal(result.stopStart, clockToMinutes("18:40"));
  assert.equal(result.stopEnd, clockToMinutes("18:50"));
  assert.equal(result.costMinutes, 5);
});

test("overlap and stage walks are symmetric and deterministic", () => {
  assert.equal(overlapMinutes(10, 20, 20, 30), 0);
  assert.equal(overlapMinutes(10, 25, 20, 30), 5);
  assert.equal(estimatedStageWalk("twin_peaks", "lands_end", [{ from: "lands_end", to: "twin_peaks", min: 12 }]), 12);
});
