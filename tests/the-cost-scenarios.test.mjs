import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_NON_LINE_ALLOWANCE_MINUTES,
  FULL_STOP_MINUTES,
  SNACK_STOP_MINUTES,
  calculateFoodStop,
  calculateGapWindow,
  clockToMinutes,
  estimatedStageWalk,
} from "../lib/route-math.mjs";

const dataset = JSON.parse(
  readFileSync(new URL("../osl2026_dataset_1.json", import.meta.url), "utf8"),
);

const ARTIST_STAGE_IDS = new Set(
  dataset.stages.filter((stage) => stage.artist_lineup).map((stage) => stage.id),
);

const foods = dataset.vendors.flatMap((vendor) => [
  ...vendor.dishes.map((dish) => ({
    vendor: vendor.name,
    dish,
    kind: "standard",
    location: vendor.location,
    price: (vendor.prices ?? []).find((entry) => entry.dish === dish) ?? null,
    priceCeiling: null,
    portionsPerDay: null,
  })),
  ...vendor.snack_series.map((item) => ({
    vendor: vendor.name,
    dish: item.dish,
    kind: "snack",
    location: vendor.location,
    price: null,
    priceCeiling: item.price_ceiling_usd,
    portionsPerDay: null,
  })),
  ...vendor.limited_edition.map((item) => ({
    vendor: vendor.name,
    dish: item.dish,
    kind: "limited",
    location: vendor.location,
    price: null,
    priceCeiling: null,
    portionsPerDay: item.portions_per_day,
  })),
]);

function findArtist(day, selection) {
  const matches = Object.entries(dataset.schedule[day]).flatMap(([stage, sets]) =>
    sets
      .filter(
        (set) =>
          set.artist === selection.artist &&
          (!selection.stage || selection.stage === stage) &&
          (!selection.start || selection.start === set.start),
      )
      .map((set) => ({ ...set, stage })),
  );
  assert.equal(matches.length, 1, `Expected one set for ${selection.artist} on ${day}`);
  return matches[0];
}

function findFood(selection) {
  const matches = foods.filter(
    (food) => food.vendor === selection.vendor && food.dish === selection.dish,
  );
  assert.equal(matches.length, 1, `Expected one dish for ${selection.vendor}: ${selection.dish}`);
  return matches[0];
}

function evaluateCurrentApp(scenario) {
  const artists = scenario.artists
    .map((selection) => findArtist(scenario.day, selection))
    .sort((a, b) => a.start.localeCompare(b.start));
  const food = findFood(scenario.food);
  const next = artists.at(-1);
  const prior = artists.length > 1 ? artists.at(-2) : null;
  const durationMinutes = food.kind === "snack" ? SNACK_STOP_MINUTES : FULL_STOP_MINUTES;
  const timing = calculateFoodStop(next.start, next.end, {
    durationMinutes,
    deadline: food.kind === "limited",
  });

  let status = "forced_overlap";
  let gapMinutes = null;
  let lineLimitMinutes = null;
  let stageWalkMinutes = null;

  if (prior) {
    const rawGap = clockToMinutes(next.start) - clockToMinutes(prior.end);
    const gap = calculateGapWindow(
      prior.end,
      next.start,
      DEFAULT_NON_LINE_ALLOWANCE_MINUTES,
    );
    gapMinutes = gap.gapMinutes;
    lineLimitMinutes = gap.lineThresholdMinutes;
    stageWalkMinutes = estimatedStageWalk(
      prior.stage,
      next.stage,
      dataset.walk_times_minutes_estimated.pairs,
    );
    if (rawGap > 0) status = gap.fits ? "fit" : "treated_as_gap";
  }

  return {
    status,
    namedArtist: next.artist,
    gapMinutes,
    lineLimitMinutes,
    costMinutes: prior && gapMinutes > 0 ? null : timing.costMinutes,
    stageWalkMinutes,
    stageWalkPrecision: stageWalkMinutes > 0 ? "estimate" : null,
    artistSelectable: true,
    artistStage: next.stage,
    artistStageEligible: ARTIST_STAGE_IDS.has(next.stage),
    locationState: food.location === "TBD" ? "unknown" : "verified-area",
    location: food.location,
    priceKind: food.price ? "exact" : food.priceCeiling ? "ceiling" : "unknown",
    priceUsd: food.price?.price_usd ?? null,
    priceCeilingUsd: food.priceCeiling,
    snackTimingKnown: food.kind === "snack" ? true : null,
    stopDurationMinutes: durationMinutes,
    scarcityPortionsPerDay: food.portionsPerDay,
    deadlineModel:
      food.kind === "limited" && timing.stopStart === clockToMinutes("12:00")
        ? "fixed-noon"
        : food.kind === "limited"
          ? "inventory-deadline"
          : null,
    knownSourceConflictFlagged: false,
  };
}

const scenarios = [
  {
    id: "F01",
    name: "Friday demo: Tinashe to Clipse with the pizza bagel",
    day: "friday_2026-08-07",
    artists: [{ artist: "Tinashe" }, { artist: "Clipse" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "45-minute gap, 25-minute allowance, 20-minute line limit, exact $16 price, verified area.",
    expected: { status: "fit", namedArtist: "Clipse", gapMinutes: 45, lineLimitMinutes: 20, priceKind: "exact", priceUsd: 16, locationState: "verified-area" },
  },
  {
    id: "F02",
    name: "Friday forced miss: Clipse only with the pizza bagel",
    day: "friday_2026-08-07",
    artists: [{ artist: "Clipse" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "A 30-minute stop beginning 5 minutes before Clipse costs 25 minutes of Clipse and names Clipse.",
    expected: { status: "forced_overlap", namedArtist: "Clipse", costMinutes: 25, priceUsd: 16 },
  },
  {
    id: "F03",
    name: "Friday same-stage gap: GloRilla to Labrinth with Sandy's",
    day: "friday_2026-08-07",
    artists: [{ artist: "GloRilla" }, { artist: "Labrinth" }],
    food: { vendor: "Sandy's", dish: "Muffuletta sandwich" },
    correctLooksLike: "30-minute gap, 5-minute line limit, verified vendor area, unknown price.",
    expected: { status: "fit", gapMinutes: 30, lineLimitMinutes: 5, stageWalkMinutes: 0, priceKind: "unknown", locationState: "verified-area" },
  },
  {
    id: "F04",
    name: "Friday too-short gap: Goldie Boutilier to Clipse",
    day: "friday_2026-08-07",
    artists: [{ artist: "Goldie Boutilier" }, { artist: "Clipse" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Hot pastrami dip sandwich" },
    correctLooksLike: "The 5-minute gap is explicitly rejected as too short instead of presented as a usable food window.",
    expected: { status: "no-fit", gapMinutes: 5, lineLimitMinutes: 0 },
  },
  {
    id: "F05",
    name: "Friday back-to-back sets: Clipse to Dylan Brady",
    day: "friday_2026-08-07",
    artists: [{ artist: "Clipse" }, { artist: "Dylan Brady" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Cacio e pepe french fries" },
    correctLooksLike: "A zero-minute gap is rejected and the app names the set that would be missed.",
    expected: { status: "no-fit", gapMinutes: 0, lineLimitMinutes: 0, namedArtist: "Dylan Brady" },
  },
  {
    id: "F06",
    name: "Friday overlapping selected sets: Yousuke Yukimatsu and Tobiahs",
    day: "friday_2026-08-07",
    artists: [{ artist: "Yousuke Yukimatsu" }, { artist: "Tobiahs", stage: "duboce_triangle" }],
    food: { vendor: "Reem's x Lion Dance Cafe", dish: "Half lamb quesabirria flatbread" },
    correctLooksLike: "The overlapping artist selections are flagged as a schedule conflict before food is routed.",
    expected: { status: "conflict" },
  },
  {
    id: "F07",
    name: "Friday limited item with unknown vendor location",
    day: "friday_2026-08-07",
    artists: [{ artist: "Tinashe" }, { artist: "Clipse" }],
    food: { vendor: "Bodega SF", dish: "Shaking Wagyu beef burrito" },
    correctLooksLike: "The set gap remains computable, the location stays unknown, and the 10-per-day scarcity is shown as a deadline.",
    expected: { status: "fit", gapMinutes: 45, locationState: "unknown", scarcityPortionsPerDay: 10 },
  },
  {
    id: "F08",
    name: "Friday Snack Series item without sourced time savings",
    day: "friday_2026-08-07",
    artists: [{ artist: "Tinashe" }, { artist: "Clipse" }],
    food: { vendor: "Nobu", dish: "Mini chicken karaage donburi" },
    correctLooksLike: "Show a price ceiling of $16 or less and unknown location, but do not invent a 10-minute stop time.",
    expected: { status: "fit", priceKind: "ceiling", priceCeilingUsd: 16, locationState: "unknown", snackTimingKnown: false },
  },
  {
    id: "F09",
    name: "Friday non-artist programming: Cocktail Magic",
    day: "friday_2026-08-07",
    artists: [{ artist: "The Emo Night Tour", stage: "cocktail_magic" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "Cocktail Magic is excluded from the artist selector because artist_lineup is false.",
    expected: { artistSelectable: false },
  },
  {
    id: "S01",
    name: "Saturday clean gap: Dijon to The xx",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Dijon" }, { artist: "The xx" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "50-minute same-stage gap, 25-minute line limit, exact $16 price.",
    expected: { status: "fit", gapMinutes: 50, lineLimitMinutes: 25, stageWalkMinutes: 0, priceUsd: 16 },
  },
  {
    id: "S02",
    name: "Saturday too-short gap: Ethel Cain to Dijon",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Ethel Cain" }, { artist: "Dijon" }],
    food: { vendor: "Perry's", dish: "Snack burger" },
    correctLooksLike: "The 10-minute gap is rejected as too short.",
    expected: { status: "no-fit", gapMinutes: 10, lineLimitMinutes: 0 },
  },
  {
    id: "S03",
    name: "Saturday sub-allowance gap: Djo to The xx",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Djo" }, { artist: "The xx" }],
    food: { vendor: "Smish Smash", dish: "Smashburger" },
    correctLooksLike: "The 20-minute gap is rejected because it is shorter than the 25-minute allowance.",
    expected: { status: "no-fit", gapMinutes: 20, lineLimitMinutes: 0 },
  },
  {
    id: "S04",
    name: "Saturday overlapping sets: Lucy Dacus and Malcolm Todd",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Lucy Dacus" }, { artist: "Malcolm Todd" }],
    food: { vendor: "Sorrel", dish: "Fried chicken sandwich" },
    correctLooksLike: "The 5-minute artist overlap is flagged before routing food.",
    expected: { status: "conflict" },
  },
  {
    id: "S05",
    name: "Saturday five-minute transfer: Automatic to Malcolm Todd",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Automatic" }, { artist: "Malcolm Todd" }],
    food: { vendor: "Jollof Kitchen", dish: "Nigerian grilled chicken with jollof rice" },
    correctLooksLike: "The 5-minute gap is rejected and the verified vendor area remains visible.",
    expected: { status: "no-fit", gapMinutes: 5, locationState: "verified-area" },
  },
  {
    id: "S06",
    name: "Saturday single headliner with an explicitly half Snack Series dish",
    day: "saturday_2026-08-08",
    artists: [{ artist: "The Strokes" }],
    food: { vendor: "Reem's x Lion Dance Cafe", dish: "Half lamb quesabirria flatbread" },
    correctLooksLike: "The published half portion and $16 ceiling are shown, but no time saving is inferred without a source.",
    expected: { priceKind: "ceiling", priceCeilingUsd: 16, snackTimingKnown: false },
  },
  {
    id: "S07",
    name: "Saturday Snack Series item with unknown location",
    day: "saturday_2026-08-08",
    artists: [{ artist: "PinkPantheress" }],
    food: { vendor: "Piglet & Co", dish: "Mini chashao pork bao" },
    correctLooksLike: "Show $16-or-less and unknown location, with no invented stop duration.",
    expected: { priceKind: "ceiling", priceCeilingUsd: 16, locationState: "unknown", snackTimingKnown: false },
  },
  {
    id: "S08",
    name: "Saturday overlapping cross-stage sets: Surprise Guest and Haute & Freddy",
    day: "saturday_2026-08-08",
    artists: [{ artist: "Surprise Guest", stage: "duboce_triangle", start: "12:15" }, { artist: "Haute & Freddy" }],
    food: { vendor: "Arquet", dish: "Lobster roll with brown butter and chives" },
    correctLooksLike: "The 20-minute overlap is flagged instead of forcing a food stop against Haute & Freddy.",
    expected: { status: "conflict" },
  },
  {
    id: "U01",
    name: "Sunday known source conflict: Silvana Estrada and Infinity Song",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Silvana Estrada" }, { artist: "Infinity Song" }],
    food: { vendor: "Tacolicious", dish: "Tacos" },
    correctLooksLike: "The known 20-minute Panhandle overlap is labeled as an unresolved source conflict, not routed as fact.",
    expected: { status: "conflict", knownSourceConflictFlagged: true },
  },
  {
    id: "U02",
    name: "Sunday overlapping sets: early Death Cab and Sports",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Death Cab for Cutie (early set)" }, { artist: "Sports" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "The 20-minute artist overlap is flagged before food routing.",
    expected: { status: "conflict" },
  },
  {
    id: "U03",
    name: "Sunday cross-park estimate: Empire of the Sun to Baby Keem",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Empire of the Sun" }, { artist: "Baby Keem" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Pizza bagel with burrata" },
    correctLooksLike: "55-minute gap, 30-minute line limit, and the 12-minute Lands End/Twin Peaks walk is labeled as an estimate.",
    expected: { status: "fit", gapMinutes: 55, lineLimitMinutes: 30, stageWalkMinutes: 12, stageWalkPrecision: "estimate" },
  },
  {
    id: "U04",
    name: "Sunday same-stage gap: Not for Radio to Death Cab",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Not for Radio" }, { artist: "Death Cab for Cutie", stage: "sutro" }],
    food: { vendor: "Sandy's", dish: "Muffuletta sandwich" },
    correctLooksLike: "30-minute gap, 5-minute line limit, no stage-walk estimate, unknown price.",
    expected: { status: "fit", gapMinutes: 30, lineLimitMinutes: 5, stageWalkMinutes: 0, priceKind: "unknown" },
  },
  {
    id: "U05",
    name: "Sunday cross-stage gap: Mariah the Scientist to Rüfüs Du Sol",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Mariah the Scientist" }, { artist: "Rüfüs Du Sol" }],
    food: { vendor: "Wise Sons x Outta Sight Pizza", dish: "Hot pastrami dip sandwich" },
    correctLooksLike: "35-minute gap, 10-minute line limit, 12-minute stage-walk estimate, unknown price.",
    expected: { status: "fit", gapMinutes: 35, lineLimitMinutes: 10, stageWalkMinutes: 12, stageWalkPrecision: "estimate", priceKind: "unknown" },
  },
  {
    id: "U06",
    name: "Sunday same-stage gap: Night Tapes to Silvana Estrada",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Night Tapes" }, { artist: "Silvana Estrada" }],
    food: { vendor: "Parachute Bakery", dish: "Vanilla + passionfruit croissant cube" },
    correctLooksLike: "35-minute gap, 10-minute line limit, no stage-walk estimate, verified vendor area.",
    expected: { status: "fit", gapMinutes: 35, lineLimitMinutes: 10, stageWalkMinutes: 0, locationState: "verified-area" },
  },
  {
    id: "U07",
    name: "Sunday gap with an unsupported stage pair: Beya to Mariah the Scientist",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Beya" }, { artist: "Mariah the Scientist" }],
    food: { vendor: "Perry's", dish: "Snack burger" },
    correctLooksLike: "45-minute gap and 20-minute line limit; Dolores-to-Twin-Peaks walk remains unknown rather than invented.",
    expected: { status: "fit", gapMinutes: 45, lineLimitMinutes: 20, stageWalkMinutes: null, locationState: "verified-area" },
  },
  {
    id: "U08",
    name: "Sunday limited item against a headliner",
    day: "sunday_2026-08-09",
    artists: [{ artist: "Rüfüs Du Sol" }],
    food: { vendor: "Smish Smash", dish: "Uni smashburger" },
    correctLooksLike: "Show 10 portions per day as expiring inventory; do not manufacture a fixed noon pickup time.",
    expected: { scarcityPortionsPerDay: 10, deadlineModel: "inventory-deadline" },
  },
];

assert.equal(scenarios.length, 25, "The scenario pack must contain exactly 25 inputs");

for (const scenario of scenarios) {
  test(`${scenario.id} ${scenario.name}`, () => {
    const actual = evaluateCurrentApp(scenario);
    for (const [field, expected] of Object.entries(scenario.expected)) {
      assert.deepEqual(
        actual[field],
        expected,
        `${scenario.id} ${field}. Correct looks like: ${scenario.correctLooksLike}`,
      );
    }
  });
}

