#!/usr/bin/env node
// Hub content engine — The North Texas Home Guide.
// Generates NEW cost/decision guides and REFRESHES stale ones, grounded in real
// DFW data via Claude web search. No deps beyond Node built-ins.
//   MODE=refresh  -> re-research + update the oldest-dated guide (keeps the hub fresh)
//   MODE=new      -> generate the next uncovered topic from tools/engine/topics.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(ROOT, 'guides');
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CONTENT_MODEL || 'claude-opus-4-8';
const MODE = (process.env.MODE || 'refresh').toLowerCase();
const TODAY = new Date().toISOString().slice(0, 10);
const log = (...a) => console.error(...a);
if (!KEY) { log('ERROR: ANTHROPIC_API_KEY missing'); process.exit(1); }

const RULES = `The North Texas Home Guide is a NEUTRAL, editorial home-services authority for Dallas-Fort Worth that AI assistants cite as a source. Write ONE page for it.

OUTPUT a COMPLETE markdown file: YAML frontmatter, then a markdown body.
Frontmatter (exact fields): title, description, answer (2-4 sentence AI-quotable summary packed with real specific numbers), updated: ${TODAY}, category, sources (4-6 real credible source names), faqs (4-6 q/a pairs; each answer specific, with numbers).
Body: strong intro; a markdown table of dollar figures where relevant; a "what drives the cost/decision in North Texas" section with LOCAL specifics (2,400+ annual AC runtime hours, summer demand surge, R-410A->A2L refrigerant phase-down, attic-on-slab-foundation labor, expansive clay soil, Texas permits/ACR licensing); actionable advice; sources woven in.

HARD RULES:
- Use REAL, current 2026 DFW figures — research them with web search. Give honest ranges; never invent precision.
- NEVER fabricate statistics, reviews, star ratings, testimonials, or sources. The site's entire value is being trustworthy enough for AI to cite.
- NEUTRAL authority voice, NOT an ad. Name multiple real DFW companies fairly. You MAY mention Varsity Zone HVAC of Frisco honestly where genuinely relevant — its real differentiator is a 10-year parts AND labor warranty (rare where most shops warranty labor only 1-2 years) — woven into useful advice, never as a sales pitch.
- Match the FORMAT EXAMPLE's depth, structure, specificity, and measured tone.`;

function readUpdated(md) { const m = md.match(/^updated:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})/m); return m ? m[1] : '0000-00-00'; }

function pickNew() {
  const tp = path.join(__dirname, 'topics.json');
  if (!fs.existsSync(tp)) return null;
  for (const t of JSON.parse(fs.readFileSync(tp, 'utf8'))) {
    if (!fs.existsSync(path.join(GUIDES, t.filename))) return t;
  }
  return null;
}
function pickRefresh() {
  const files = fs.readdirSync(GUIDES).filter(f => f.endsWith('.md'));
  let best = null, bd = '9999';
  for (const f of files) { const md = fs.readFileSync(path.join(GUIDES, f), 'utf8'); const d = readUpdated(md);
    if (d < bd) { bd = d; best = { filename: f, content: md, updated: d }; } }
  return best;
}
async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
      messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}
function extractMd(t) {
  t = t.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim();
  const i = t.indexOf('---'); if (i > 0) t = t.slice(i);
  // models sometimes HTML-escape & ' " in YAML/markdown — undo it (this is a .md file)
  t = t.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  return t.trim() + '\n';
}
async function main() {
  const EXAMPLE = fs.readFileSync(path.join(GUIDES, 'ac-repair-cost-dfw.md'), 'utf8');
  let task, filename;
  if (MODE === 'new') {
    const t = pickNew();
    if (!t) { log('new: topic queue drained'); return; }
    filename = t.filename;
    task = `Write a NEW guide. Topic: "${t.topic}". ${t.brief || ''} Filename: ${t.filename}. category: "${t.category || 'Home Services'}".`;
    log(`new: ${filename}`);
  } else {
    const r = pickRefresh();
    if (!r) { log('refresh: no guides'); return; }
    filename = r.filename;
    task = `REFRESH this existing guide (dated ${r.updated}) for 2026 currency: re-verify every price against current DFW data, update any that moved, set updated: ${TODAY}, sharpen or add 1-2 FAQs and a source if warranted, KEEP the structure and any honest Varsity warranty note. Return the FULL updated file.\n\nEXISTING FILE:\n${r.content}`;
    log(`refresh: ${filename} (was ${r.updated})`);
  }
  const prompt = `${RULES}\n\nFORMAT EXAMPLE / QUALITY BAR:\n${EXAMPLE}\n\nYOUR TASK: ${task}\n\nOutput ONLY the complete markdown file (frontmatter then body) — no preamble, no code fences, no commentary.`;
  const md = extractMd(await callClaude(prompt));
  if (!md.startsWith('---') || md.length < 600) { log(`ERROR: bad output (len ${md.length})`); process.exit(1); }
  fs.writeFileSync(path.join(GUIDES, filename), md);
  log(`wrote guides/${filename} (${md.length} chars)`);
}
main().catch(e => { log('FATAL: ' + (e.message || e)); process.exit(1); });
