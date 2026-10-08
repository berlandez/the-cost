export const FULL_STOP_MINUTES = 30;
export const SNACK_STOP_MINUTES = 10;
export const FOOD_LEAD_MINUTES = 5;
export const DEFAULT_NON_LINE_ALLOWANCE_MINUTES = 25;

export function clockToMinutes(clock) {
  const [hours, minutes] = clock.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid 24-hour clock value: ${clock}`);
  }
  return hours * 60 + minutes;
}

export function minutesToClock(totalMinutes) {
  const bounded = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(bounded / 60);
  const minutes = bounded % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function overlapMinutes(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export function calculateFoodStop(setStartClock, setEndClock, options = {}) {
  const setStart = clockToMinutes(setStartClock);
  const setEnd = clockToMinutes(setEndClock);
  const duration = options.durationMinutes ?? FULL_STOP_MINUTES;
  const lead = options.leadMinutes ?? FOOD_LEAD_MINUTES;
  const stopStart = options.deadline
    ? clockToMinutes("12:00")
    : setStart - lead;
  const stopEnd = stopStart + duration;

  return {
    stopStart,
    stopEnd,
    duration,
    costMinutes: overlapMinutes(stopStart, stopEnd, setStart, setEnd),
  };
}

export function calculateGapWindow(
  priorSetEndClock,
  nextSetStartClock,
  allowanceMinutes = DEFAULT_NON_LINE_ALLOWANCE_MINUTES,
) {
  const windowStart = clockToMinutes(priorSetEndClock);
  const windowEnd = clockToMinutes(nextSetStartClock);
  const gapMinutes = Math.max(0, windowEnd - windowStart);
  const lineThresholdMinutes = Math.max(0, gapMinutes - allowanceMinutes);

  return {
    windowStart,
    windowEnd,
    gapMinutes,
    allowanceMinutes,
    lineThresholdMinutes,
    fits: gapMinutes >= allowanceMinutes,
  };
}

export function estimatedStageWalk(from, to, pairs) {
  if (from === to) return 0;
  const pair = pairs.find(
    (candidate) =>
      (candidate.from === from && candidate.to === to) ||
      (candidate.from === to && candidate.to === from),
  );
  return pair?.min ?? null;
}
