"use client";

import { useMemo, useState } from "react";
import dataset from "../osl2026_dataset_1.json";
import {
  DEFAULT_NON_LINE_ALLOWANCE_MINUTES,
  FULL_STOP_MINUTES,
  SNACK_STOP_MINUTES,
  calculateFoodStop,
  calculateGapWindow,
  estimatedStageWalk,
  minutesToClock,
} from "../lib/route-math.mjs";

type DayKey = keyof typeof dataset.schedule;
type SetRecord = { artist: string; start: string; end: string; flag?: string };
type ArtistOption = SetRecord & { id: string; stage: string; stageName: string };
type Snack = { dish: string; price_ceiling_usd: number };
type Price = { dish: string; price_usd: number; source: string };
type FoodOption = {
  id: string;
  vendor: string;
  location: string;
  dish: string;
  kind: "standard" | "limited" | "snack";
  portionsPerDay?: number;
  priceCeiling?: number;
  price?: Price;
  alternative?: Snack;
};

const dayOrder = Object.keys(dataset.schedule) as DayKey[];
const dayLabels: Record<DayKey, { tab: string; possessive: string; heading: string }> = {
  "friday_2026-08-07": {
    tab: "FRI 7",
    possessive: "Your Friday",
    heading: "Friday, August 7",
  },
  "saturday_2026-08-08": {
    tab: "SAT 8",
    possessive: "Your Saturday",
    heading: "Saturday, August 8",
  },
  "sunday_2026-08-09": {
    tab: "SUN 9",
    possessive: "Your Sunday",
    heading: "Sunday, August 9",
  },
};

const stageNames = new Map(dataset.stages.map((stage) => [stage.id, stage.name]));
const artistStageCount = dataset.stages.filter((stage) => stage.artist_lineup).length;

const foods: FoodOption[] = dataset.vendors.flatMap((vendor) => {
  const alternative = vendor.snack_series[0];
  const prices: Price[] = "prices" in vendor ? (vendor.prices ?? []) : [];
  const standard = vendor.dishes.map((dish) => ({
    id: `${vendor.name}::standard::${dish}`,
    vendor: vendor.name,
    location: vendor.location,
    dish,
    kind: "standard" as const,
    price: prices.find((price) => price.dish === dish),
    alternative,
  }));
  const limited = vendor.limited_edition.map((item) => ({
    id: `${vendor.name}::limited::${item.dish}`,
    vendor: vendor.name,
    location: vendor.location,
    dish: item.dish,
    kind: "limited" as const,
    portionsPerDay: item.portions_per_day,
    alternative,
  }));
  const snacks = vendor.snack_series.map((item) => ({
    id: `${vendor.name}::snack::${item.dish}`,
    vendor: vendor.name,
    location: vendor.location,
    dish: item.dish,
    kind: "snack" as const,
    priceCeiling: item.price_ceiling_usd,
  }));
  return [...standard, ...limited, ...snacks];
});

const defaultDay: DayKey = "friday_2026-08-07";
const defaultArtistId = "twin_peaks::Clipse::18:45";
const defaultPriorArtistId = "twin_peaks::Tinashe::17:10";
const defaultFoodId =
  "Wise Sons x Outta Sight Pizza::standard::Pizza bagel with burrata";

const sourceLinks = [
  { label: "RIFF set-time report", href: dataset.meta.sources[0] },
  { label: "San Francisco Standard food report", href: dataset.meta.sources[1] },
  { label: "SFist food-lineup report", href: dataset.meta.sources[2] },
  { label: "Edible San Francisco food guide", href: dataset.meta.sources[3] },
  { label: "Outside Lands Taste of the Bay Area", href: dataset.meta.sources[4] },
  { label: "SFist Snack Series and limited-edition report", href: dataset.meta.sources[5] },
];

function SourceTag({ children }: { children: React.ReactNode }) {
  return <small className="source-tag">{children}</small>;
}

function artistsForDay(day: DayKey): ArtistOption[] {
  const schedule = dataset.schedule[day] as Record<string, SetRecord[]>;
  return Object.entries(schedule)
    .flatMap(([stage, sets]) =>
      sets.map((set) => ({
        ...set,
        stage,
        stageName: stageNames.get(stage) ?? stage,
        id: `${stage}::${set.artist}::${set.start}`,
      })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

function formatRange(start: string, end: string) {
  const shortClock = (clock: string) => {
    const [hours, minutes] = clock.split(":").map(Number);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`;
  };
  return `${shortClock(start)}–${shortClock(end)}`;
}

function minutesToClockString(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function costSentence(food: FoodOption, artist: ArtistOption, cost: number) {
  if (food.dish === "Pizza bagel with burrata") {
    return `Pizza bagel with burrata. $${food.price?.price_usd}. It puts you into ${artist.artist} ${cost} minutes late.`;
  }
  if (cost === 0) {
    return `${food.dish} costs 0 minutes of ${artist.artist}.`;
  }
  return `${food.dish} puts you into ${artist.artist} ${cost} minutes late.`;
}

function Selector<T extends { id: string }>({
  label,
  emptyLabel,
  options,
  selected,
  onToggle,
  primary,
  secondary,
}: {
  label: string;
  emptyLabel: string;
  options: T[];
  selected: string[];
  onToggle: (id: string) => void;
  primary: (option: T) => string;
  secondary: (option: T) => string;
}) {
  const selectedOptions = selected
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is T => Boolean(option));
  const first = selectedOptions[0];

  return (
    <div className="selector-field">
      <span className="field-label">{label}</span>
      <details className="selector">
        <summary>
          <span>
            <strong>{first ? primary(first) : emptyLabel}</strong>
            <small>
              {first
                ? `${secondary(first)}${selectedOptions.length > 1 ? ` · +${selectedOptions.length - 1} more` : ""}`
                : "Choose one or more"}
            </small>
          </span>
          <span className="chevron" aria-hidden="true" />
        </summary>
        <div className="selector-menu" role="group" aria-label={label}>
          {options.map((option) => (
            <label className="option-row" key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>
                <strong>{primary(option)}</strong>
                <small>{secondary(option)}</small>
              </span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function Timeline({
  day,
  artists,
  selectedFoods,
  selectedAlternatives,
  onToggleAlternative,
}: {
  day: DayKey;
  artists: ArtistOption[];
  selectedFoods: FoodOption[];
  selectedAlternatives: string[];
  onToggleAlternative: (foodId: string) => void;
}) {
  const groupedFoods = new Map<string, FoodOption[]>();
  selectedFoods.forEach((food, index) => {
    const artist = artists.length > 1
      ? artists[Math.min(index + 1, artists.length - 1)]
      : artists[index % artists.length];
    groupedFoods.set(artist.id, [...(groupedFoods.get(artist.id) ?? []), food]);
  });

  return (
    <section className="timeline-panel" aria-live="polite">
      <h2>
        {dayLabels[day].heading}
        <SourceTag>OSL schedule</SourceTag>
      </h2>
      <div className="timeline">
        {artists.map((artist, artistIndex) => {
          const artistFoods = groupedFoods.get(artist.id) ?? [];
          const prior = artists[artistIndex - 1];
          const stageWalk = prior
            ? estimatedStageWalk(
                prior.stage,
                artist.stage,
                dataset.walk_times_minutes_estimated.pairs,
              )
            : null;

          return (
            <div className="timeline-group" key={artist.id}>
              {prior && stageWalk !== null && stageWalk > 0 ? (
                <div className="walk-row">
                  <span>
                    ~{stageWalk} min
                    <SourceTag>prior-year map estimate</SourceTag>
                  </span>
                  <p>
                    Estimated stage walk from {prior.stageName} to {artist.stageName}.
                  </p>
                </div>
              ) : null}

              {artistFoods.map((food) => {
                const useAlternative =
                  Boolean(food.alternative) && selectedAlternatives.includes(food.id);
                const activeFood: FoodOption = useAlternative && food.alternative
                  ? { ...food, dish: food.alternative.dish, kind: "snack" }
                  : food;
                const duration =
                  activeFood.kind === "snack" ? SNACK_STOP_MINUTES : FULL_STOP_MINUTES;
                const gapPlan = prior
                  ? calculateGapWindow(
                      prior.end,
                      artist.start,
                      DEFAULT_NON_LINE_ALLOWANCE_MINUTES,
                    )
                  : null;
                const usableGap = gapPlan && gapPlan.gapMinutes > 0 ? gapPlan : null;
                const timing = calculateFoodStop(artist.start, artist.end, {
                  durationMinutes: duration,
                  deadline: activeFood.kind === "limited",
                });
                const alternativeTiming = food.alternative
                  ? calculateFoodStop(artist.start, artist.end, {
                      durationMinutes: SNACK_STOP_MINUTES,
                    })
                  : null;

                return (
                  <article className="timeline-row food-row" key={food.id}>
                    <time>
                      {minutesToClock(usableGap ? usableGap.windowStart : timing.stopStart)}
                      <SourceTag>computed</SourceTag>
                    </time>
                    <span className="rail-dot food-dot" aria-hidden="true" />
                    <div className="event-copy">
                      <h3>{food.vendor}</h3>
                      <p>
                        {food.location === "TBD" ? "Vendor area not verified" : food.location}
                        {" · "}{activeFood.dish}
                        {usableGap ? (
                          <>
                            {" · "}{usableGap.gapMinutes} min window
                            <SourceTag>OSL set-time math</SourceTag>
                          </>
                        ) : (
                          <>
                            {" · "}{duration} min estimate
                            <SourceTag>fixed stop estimate</SourceTag>
                          </>
                        )}
                      </p>
                      {food.price ? (
                        <p className="price-source">
                          ${food.price.price_usd}
                          <SourceTag>{food.price.source}</SourceTag>
                        </p>
                      ) : null}
                      {usableGap ? (
                        <>
                          <p className="cost-sentence gap-sentence">
                            {activeFood.dish}. {food.price ? `$${food.price.price_usd}. ` : ""}
                            You have {usableGap.gapMinutes} minutes between {prior.artist} and {artist.artist}.
                            {" "}Allow {usableGap.allowanceMinutes} minutes to walk, order, and get back.
                            {" "}The line can take {usableGap.lineThresholdMinutes} minutes before you miss {artist.artist}.
                          </p>
                          <div className="gap-math" aria-label="Gap calculation">
                            <p>
                              <strong>{usableGap.gapMinutes} min window</strong>
                              <span>{minutesToClockString(prior.end)} {prior.artist} end to {minutesToClockString(artist.start)} {artist.artist} start</span>
                              <SourceTag>OSL schedule · computed</SourceTag>
                            </p>
                            <p>
                              <strong>{usableGap.allowanceMinutes} min allowance</strong>
                              <span>Walk, order, and return</span>
                              <SourceTag>product assumption</SourceTag>
                            </p>
                            <p>
                              <strong>{usableGap.lineThresholdMinutes} min line limit</strong>
                              <span>{usableGap.gapMinutes} minus {usableGap.allowanceMinutes}</span>
                              <SourceTag>computed</SourceTag>
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="cost-sentence">
                            {costSentence(activeFood, artist, timing.costMinutes)}
                          </p>
                          <p className="calculation-note">
                            {timing.costMinutes} min: OSL set time + {duration} min stop estimate.
                            Vendor walk excluded.
                          </p>
                        </>
                      )}
                      {!usableGap && food.alternative && alternativeTiming ? (
                        <button
                          className={`compromise${useAlternative ? " chosen" : ""}`}
                          type="button"
                          aria-pressed={useAlternative}
                          onClick={() => onToggleAlternative(food.id)}
                        >
                          <span>
                            {useAlternative
                              ? `Use the full portion. It costs ${calculateFoodStop(artist.start, artist.end).costMinutes} minutes of ${artist.artist}.`
                              : `Take the ${food.alternative.dish.toLowerCase()}. It costs ${alternativeTiming.costMinutes} minutes of ${artist.artist} instead.`}
                          </span>
                          <small>
                            {useAlternative
                              ? `${calculateFoodStop(artist.start, artist.end).costMinutes} min: OSL set + 30 min estimate · half: $${food.alternative.price_ceiling_usd} published ceiling`
                              : `${alternativeTiming.costMinutes} min: OSL set + 10 min estimate · $${food.alternative.price_ceiling_usd} published ceiling`}
                          </small>
                          <span className="arrow" aria-hidden="true">→</span>
                        </button>
                      ) : null}
                      {food.kind === "limited" ? (
                        <p className="scarcity-warning">
                          About {food.portionsPerDay} portions per day. Published limit. Treat
                          this as an early deadline, not a queue.
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              <article className="timeline-row music-row">
                <time>
                  {minutesToClockString(artist.start)}
                  <SourceTag>OSL schedule</SourceTag>
                </time>
                <span className="rail-dot music-dot" aria-hidden="true" />
                <div className="event-copy">
                  <h3>{artist.artist}</h3>
                  <p>
                    {artist.stageName} · until {minutesToClockString(artist.end)}
                    <SourceTag>OSL schedule</SourceTag>
                  </p>
                </div>
              </article>
            </div>
          );
        })}
      </div>
      <footer className="timeline-note">
        <strong>The allowance is not a measured route.</strong>
        <span>
          The 25 minute allowance covers walking, ordering, and returning. It is a product
          assumption. No vendor coordinates are published.
        </span>
      </footer>
    </section>
  );
}

export default function Home() {
  const [day, setDay] = useState<DayKey>(defaultDay);
  const [artistSelections, setArtistSelections] = useState<Record<DayKey, string[]>>({
    "friday_2026-08-07": [defaultArtistId, defaultPriorArtistId],
    "saturday_2026-08-08": [],
    "sunday_2026-08-09": [],
  });
  const [foodSelections, setFoodSelections] = useState<Record<DayKey, string[]>>({
    "friday_2026-08-07": [defaultFoodId],
    "saturday_2026-08-08": [],
    "sunday_2026-08-09": [],
  });
  const [built, setBuilt] = useState({
    day: defaultDay,
    artistIds: [defaultArtistId, defaultPriorArtistId],
    foodIds: [defaultFoodId],
  });
  const [message, setMessage] = useState("");
  const [selectedAlternatives, setSelectedAlternatives] = useState<string[]>([]);

  const artists = useMemo(() => artistsForDay(day), [day]);
  const builtArtists = useMemo(
    () =>
      artistsForDay(built.day).filter((artist) => built.artistIds.includes(artist.id)),
    [built],
  );
  const builtFoods = useMemo(
    () => foods.filter((food) => built.foodIds.includes(food.id)),
    [built],
  );

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Record<DayKey, string[]>>>,
    id: string,
  ) => {
    setter((current) => ({
      ...current,
      [day]: current[day].includes(id)
        ? current[day].filter((selectedId) => selectedId !== id)
        : [...current[day], id],
    }));
  };

  const buildTimeline = () => {
    const artistIds = artistSelections[day];
    const foodIds = foodSelections[day];
    if (!artistIds.length || !foodIds.length) {
      setMessage("Pick at least one artist and one dish.");
      return;
    }
    setMessage("");
    setSelectedAlternatives([]);
    setBuilt({ day, artistIds, foodIds });
    requestAnimationFrame(() =>
      document.querySelector(".timeline-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  return (
    <main>
      <div className="event-strip" aria-hidden="true">
        <span>OUTSIDELLMS 2026</span>
        <span>OUTSIDE LANDS FOOD / SET ROUTING</span>
        <span>AUGUST 7–9 · OSL DATES</span>
      </div>
      <header className="site-header">
        <a
          href="https://outsidellms.com/"
          className="outside-wordmark"
          aria-label="OutsideLLMS 2026"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="/outside-llms-wordmark.png"
            alt="OutsideLLMS"
            width="1909"
            height="322"
          />
        </a>
        <p>THE COST · OUTSIDE LANDS 2026</p>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="hero-ticket">
            SET TIMES + FOOD · 3 DAYS · {artistStageCount} STAGES <SourceTag>artist lineup</SourceTag>
          </p>
          <h1 id="page-title">
            Pick what matters.
            <br />
            See what it costs.
          </h1>
          <p className="hero-deck">Food decisions, measured in minutes of music.</p>
        </div>
        <div className="hero-mascot" aria-hidden="true">
          <img src="/ranger-dave-blossom.png" alt="" width="795" height="795" />
          <span>THE COST</span>
        </div>
      </section>

      <p className="estimate-banner">
        <strong>ROUGH ROUTING</strong>
        Walk and queue times are estimates. Vendor areas are shown only when verified.
      </p>

      <div className="app-shell" id="planner">
        <section className="planner-panel" aria-label="Plan your day">
          <div className="day-tabs" role="tablist" aria-label="Festival day">
            {dayOrder.map((dayKey) => (
              <button
                key={dayKey}
                type="button"
                role="tab"
                aria-selected={day === dayKey}
                className={day === dayKey ? "active" : ""}
                onClick={() => setDay(dayKey)}
              >
                {dayLabels[dayKey].tab}
                <small>OSL</small>
              </button>
            ))}
          </div>

          <h2>{dayLabels[day].possessive}</h2>

          <Selector
            label="Pick artists"
            emptyLabel="No artists selected"
            options={artists}
            selected={artistSelections[day]}
            onToggle={(id) => toggle(setArtistSelections, id)}
            primary={(artist) => artist.artist}
            secondary={(artist) =>
              `${formatRange(artist.start, artist.end)} · ${artist.stageName} · OSL schedule`
            }
          />

          <Selector
            label="Pick dishes"
            emptyLabel="No dishes selected"
            options={foods}
            selected={foodSelections[day]}
            onToggle={(id) => toggle(setFoodSelections, id)}
            primary={(food) => food.dish}
            secondary={(food) =>
              `${food.vendor}${food.location === "TBD" ? "" : ` · ${food.location}`}`
            }
          />

          <button className="build-button" type="button" onClick={buildTimeline}>
            Build my timeline
          </button>
          {message ? <p className="form-message" role="alert">{message}</p> : null}
          <p className="coverage-note">
            Only published dishes are listed. 77 vendor menus are unknown in the bundled
            dataset.
          </p>
        </section>

        <Timeline
          day={built.day}
          artists={builtArtists}
          selectedFoods={builtFoods}
          selectedAlternatives={selectedAlternatives}
          onToggleAlternative={(foodId) =>
            setSelectedAlternatives((current) =>
              current.includes(foodId)
                ? current.filter((id) => id !== foodId)
                : [...current, foodId],
            )
          }
        />
      </div>

      <section className="source-ledger" aria-labelledby="source-ledger-title">
        <div className="source-ledger-heading">
          <span>DATA PROVENANCE</span>
          <div>
            <h2 id="source-ledger-title">Published inputs. Named gaps.</h2>
            <p>Bundled August 2, 2026 · build record. No live data calls.</p>
          </div>
        </div>

        <div className="source-ledger-grid">
          <article>
            <h3>Set times</h3>
            <p>
              <a href={sourceLinks[0].href} target="_blank" rel="noreferrer">
                Outside Lands schedule, captured via RIFF
              </a>
              . Published times are bundled as listed.
            </p>
          </article>
          <article>
            <h3>Stage walks</h3>
            <p>
              Prior-year Golden Gate Park festival maps. Every walk is labeled as an
              estimate.
            </p>
          </article>
          <article>
            <h3>Food-stop time</h3>
            <p>
              25 minutes to walk, order, and return. Product assumption, not a measured
              vendor route. The remaining gap is the line limit.
            </p>
          </article>
          <article>
            <h3>Food and dishes</h3>
            <p>
              The official Outside Lands food directory plus published Bay Area
              reporting.
            </p>
          </article>
          <article>
            <h3>Scarcity</h3>
            <p>
              Published Snack Series price ceilings and limited-edition quantities. No
              stock status is live.
            </p>
          </article>
          <article>
            <h3>Vendor areas</h3>
            <p>
              27 area labels from individual iPhone app detail rows. 74 are still unknown.
              No coordinates. Vendor walks are excluded.
            </p>
          </article>
        </div>

        <details className="source-list">
          <summary>See source links</summary>
          <ol>
            {sourceLinks.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ol>
        </details>
      </section>

      <footer className="build-credits" aria-label="Build credits">
        <span>Built with Codex</span>
        <span>Built with JamBase</span>
      </footer>
    </main>
  );
}
