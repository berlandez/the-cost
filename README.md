# The Cost

Food decisions, measured in minutes of music.

The Cost is a mobile web demo for Outside Lands 2026. Pick the artists you want to see and the dishes you want to eat, then see a timeline that makes the tradeoff explicit: how much music could this food stop cost you?

[Try the deployed demo](https://the-cost-outside-lands.jasonberland.chatgpt.site/)

## Built with Codex, directed by Jason Berland

Jason chose the framework, directed Codex, and checked its output. Codex wrote all the code. The first version was built at the OpenAI-sponsored OutsideLLMS hackathon, where an OpenAI judge picked it as her favorite project of the day. The repository also includes refinements and testing added after the event.

Jason's direction was to make the cost sentence the product: keep the scope small, calculate times in code, make uncertainty visible, and avoid inventing vendor coordinates. ChatGPT Sites was the required hackathon deployment target. A map, accounts, saved plans, and live data integrations were deliberately left out.

## The Friday demo

Tinashe ends at 6:00 PM. Clipse starts at 6:45 PM, both at Twin Peaks. You want the Wise Sons x Outta Sight pizza bagel with burrata, listed in the bundled data at $16.

That creates a 45-minute window. The app reserves a clearly labeled 25-minute allowance for walking, ordering, and returning, leaving 20 minutes for the line before you miss the start of Clipse.

The 45-minute window is calculated from the bundled set times. The 25-minute allowance is a product assumption, not a measured vendor route or live queue estimate.

## What the demo includes

- Friday, Saturday, and Sunday selection for August 7–9, 2026.
- Multiple artist and dish selection with a timeline and named-set cost sentences.
- Deterministic clock, gap, overlap, and estimated stage-walk calculations.
- Exact prices where sourced, published price ceilings where available, and limited-item quantity warnings.
- Source tags and a ledger showing published, computed, estimated, assumed, and missing information.
- A responsive phone layout and bundled data, with no runtime model or data API calls in the planner.

The dataset contains 157 set records, 8 stage records (7 marked as artist stages), and 101 vendor records. It includes dishes for 24 vendors, verified area labels for 27 vendors, and 1 exact item price. See `meta.known_gaps` and `meta.provenance` in `osl2026_dataset_1.json` before using the data.

## Run locally

Use Node.js 22.13.0 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. To build:

```bash
npm run build
npm run start
```

The app uses TypeScript, React 19, Next.js 16 conventions, vinext, Vite, and CSS. Cloudflare Worker integration supports its ChatGPT Sites deployment. Optional D1/Drizzle scaffolding comes from the starter; the planner does not use a database. The output sentences are deterministic templates, not runtime model responses.

## Source layout

- `app/page.tsx`: selection controls, timeline, cost sentences, and provenance UI.
- `app/globals.css`: responsive layout and visual styling.
- `lib/route-math.mjs`: clock, overlap, gap, and stage-walk calculations.
- `osl2026_dataset_1.json`: bundled schedule, vendor records, sources, and known gaps.
- `tests/`: arithmetic, rendered HTML, and scenario coverage.
- `AGENTS.md`: original product brief. Its dataset filename and some early assumptions are stale; the app imports `osl2026_dataset_1.json`.

## Validation and known limits

```bash
node --test tests/route-math.test.mjs
npm test
npm run test:scenarios
npm run lint
```

The original build thread records a passing build, arithmetic checks, rendered HTML check, and mobile QA. Its later 25-scenario review recorded 10 passing and 15 failing cases. The scenario suite intentionally exits nonzero while those product findings remain unresolved.

Known limits include short gaps being offered as food opportunities, overlapping sets not being flagged first, unsupported 10-minute Snack Series timing, Cocktail Magic remaining selectable, and limited inventory being assigned a manufactured noon deadline. Multiple foods are paired with selected sets rather than placed by a route optimizer.

Walk times and stop durations are assumptions or estimates. Vendor coordinates and live queues are unavailable. Most vendor areas, menus, and prices are missing, and the dataset flags a Sunday Panhandle schedule conflict. The Friday demo is the strongest sourced example; the app is a hackathon prototype, not a validated festival routing service.

## Next steps

Resolve the scenario failures, evaluate every food choice against feasible gaps, support user-entered queue assumptions, and improve sourced vendor areas, menus, and prices. Keep every estimate and missing field visible.

## Credits and data

Built with OpenAI Codex and ChatGPT Sites for OutsideLLMS. The interface credits JamBase. Published source links and capture details are retained in the dataset and the app's source ledger. JamBase artist enrichment was proposed but is not implemented.

Original app artwork is retained with Jason’s confirmation of ownership or permission to share it publicly. Video and working media are excluded from this source export. No repository license has been selected.
