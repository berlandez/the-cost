# The Cost — Outside Lands food/set routing

## What this is
A one-day hackathon build for OutsideLLMS (Aug 2, 2026). A user says who they
want to see and what they want to eat at Outside Lands, and the app returns a
route plus a plain sentence naming what the food call costs them in music.

The cost sentence IS the product. The map is not the product.

## Hard constraints
- **Ships on ChatGPT Sites. Sites is required by the organizers.** Every
  deployment URL is production; save a review version before deploying.
- Build window is 1:00pm to 5:30pm. Video shot before dinner.
- Solo build. Assume no second pair of hands.
- Do the simplest thing that works. No features beyond what's below.

## Architecture (decided, don't relitigate)
- **Bundle `osl2026_dataset.json`.** It's 48KB and static. No database, no
  backend, no Convex. Sites gives D1/R2 if ever needed; not needed here.
- **All clock and distance math happens in code, not in the model.** Set
  start/end, walk minutes, queue estimate, overlap. Arithmetic must be right
  every single time, including on stage.
- **The model writes the sentence, not the numbers.** Pass it the computed
  result and have it phrase the tradeoff.

## The data
`osl2026_dataset.json`. All three days, Aug 7–9. 157 sets across 8 stages,
101 vendors. Read `meta.known_gaps` before trusting any field.

Two things that matter and are easy to miss:
- `scarcity_rules.limited_edition` — 10 portions per day, festival-only.
  These are deadlines, not queues. Missing them can't be fixed by walking
  faster. Model them as expiring inventory.
- `scarcity_rules.snack_series` — half portions, $16 ceiling. A half pizza
  bagel is the compromise route: costs one song instead of three. Always
  offer the cheaper trade, don't force a yes/no.

**Vendor locations are TBD across the board.** Nobody publishes them. If real
coordinates arrive (JamBase dataset at kickoff, or the festival map), fill
`vendors[].location` and the routing gets real. Until then, be honest in the
UI that walk times are estimates. Do not invent coordinates.

## Voice of the output sentences
This is the differentiator, so it matters more than the UI.

Dry, specific, second person, no cheerleading. Name real things: the artist,
the vendor, the dish, the minutes. Numbers as digits.

Good: "Bagel at 3:40 puts you into Clipse 25 minutes late. Half bagel costs
you one song."
Bad: "Great choice! Let's optimize your festival journey! ✨"

Never: em dashes, "seamless", "elevate", "unlock", "curated experience",
exclamation points, emoji. No "It's not about X, it's about Y" constructions.
If a line sounds like marketing copy, rewrite it flatter.

## Done looks like
1. Pick artists and foods for any of the three days, get a timeline back.
2. Every food stop shows its cost in minutes of a named set.
3. Where a half portion exists, the cheaper alternative is offered.
4. Limited-edition items warn that they're gone after ~10 sold.
5. Deployed to a Sites URL that loads on a phone.

The Friday demo path (Clipse 6:45 Twin Peaks vs the Wise Sons x Outta Sight
pizza bagel) must work flawlessly. Everything else can be rougher.

## Don't
- Don't build a map. It eats the afternoon and it isn't the product.
- Don't add accounts, saving, or sharing.
- Don't let the model do arithmetic.
- Don't invent vendor locations, set times, or dishes. If it's not in the
  JSON, say it's unknown.
- Don't gold-plate. If the demo works at 4pm, stop and shoot the video.
