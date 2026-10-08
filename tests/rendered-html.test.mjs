import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the planner and Friday demo path", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  const text = html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  assert.match(html, /<title>The Cost · Outside Lands food\/set planner<\/title>/i);
  assert.match(html, /Pick what matters\.<br\/>See what it costs\./);
  assert.match(html, /outside-llms-wordmark\.png/);
  assert.match(html, /Wise Sons x Outta Sight Pizza/);
  assert.match(html, /SET TIMES \+ FOOD · 3 DAYS · <!-- -->7<!-- --> STAGES/);
  assert.match(text, /Pizza bagel with burrata\. \$16\. You have 45 minutes between Tinashe and Clipse\./);
  assert.match(text, /Allow 25 minutes to walk, order, and get back\./);
  assert.match(text, /The line can take 20 minutes before you miss Clipse\./);
  assert.match(text, /6:00 PM Tinashe end to 6:45 PM Clipse start/);
  assert.match(text, /25 min allowance Walk, order, and return product assumption/);
  assert.doesNotMatch(text, /It puts you into Clipse 25 minutes late\./);
  assert.match(text, /\$16 Venue menu, confirmed 2026-08-02/);
  assert.doesNotMatch(html, /Half pizza bagel|half pizza bagel/);
  assert.match(html, /Polo Field North<!-- --> · <!-- -->Pizza bagel with burrata/);
  assert.match(html, /The allowance is not a measured route\./);
  assert.match(html, /Published inputs\. Named gaps\./);
  assert.match(html, /Outside Lands schedule, captured via RIFF/);
  assert.match(text, /20 min line limit 45 minus 25 computed/);
  assert.match(text, /No vendor coordinates are published\./);
  assert.match(text, /Prior-year Golden Gate Park festival maps/);
  assert.match(text, /27 area labels from individual iPhone app detail rows/);
  assert.doesNotMatch(html, /JamBase artist context|JamBase enrichment/);
  assert.match(html, /Built with Codex/);
  assert.match(html, /Built with JamBase/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/);
});
