#!/usr/bin/env node
// IndexNow submit for the hub. Fetches the live sitemap and notifies Bing/Yandex/Seznam.
// Footprint-safe (key-file auth, no account). Hub deploys via Cloudflare Pages git
// integration, so this runs as its own scheduled/on-push workflow.
const KEY = 'feb9444375cc7ad44a94afc2b0e55ef0';
const HOST = 'thenorthtexashomeguide.com';
const locs = async (u) => { try { const t = await (await fetch(u)).text(); return [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()); } catch { return []; } };
let urls = await locs(`https://${HOST}/sitemap.xml`);
if (urls.some(u => /sitemap[^/]*\.xml$/i.test(u))) { const all = []; for (const c of urls) { if (/sitemap[^/]*\.xml$/i.test(c)) all.push(...await locs(c)); else all.push(c); } urls = all; }
urls = [...new Set(urls)].filter(u => { try { return new URL(u).host === HOST; } catch { return false; } });
if (!urls.length) { console.error('indexnow: no urls'); process.exit(0); }
const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(0, 10000) };
const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
console.error(`indexnow: ${HOST} submitted ${urls.length} urls -> HTTP ${res.status}`);
