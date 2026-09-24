'use strict';
/**
 * Narrows the tier sim to the Pokemon worth more games.
 *
 *   node scripts/tier-focus.js                 -- keep the likelier half
 *   node scripts/tier-focus.js --keep 0.4      -- or another share
 *   node scripts/tier-sim.js --workers 8 --resume --focus data/tier-sim/focus.json
 *
 * Every Pokemon gets the chance that its true strength lies outside its current
 * tier's band (rating.js outsideChance). The top share is kept as focus: only
 * those are picked as the Pokemon a team is built around. The rest are not
 * thrown out - they still fill teams as teammates and opponents, so the meta
 * the candidates play in stays the whole pool and their games stay comparable.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const IN = path.resolve(ROOT, arg('in', path.join('data', 'tier-sim', 'games.jsonl')));
const OUT = path.resolve(ROOT, arg('out', path.join('data', 'tier-sim', 'focus.json')));
const KEEP = Math.max(0.05, Math.min(1, Number(arg('keep', 0.5)) || 0.5));

const dex = require('../src/rp-dex')();
const { buildPool } = require('../src/tier-sim/pool');
const { rate, outsideChance, LOCKED_TIERS, isLocked } = require('../src/tier-sim/rating');

const pool = buildPool(dex);
const good = [];
for (const l of fs.readFileSync(IN, 'utf8').split('\n')) {
	if (!l.trim()) continue;
	try { const r = JSON.parse(l); if (['a', 'b', 't'].includes(r.w) && r.sa && r.sb) good.push(r); } catch (e) { /* a cut-off line */ }
}
const fit = rate(pool, good);
// Locked tiers (the owner's Ubers) and the Simi monkeys are never candidates.
const ranked = outsideChance(fit.rows, fit.tierMean).filter(x => !isLocked(x)).sort((a, b) => b.p - a.p);
const lockedCount = fit.rows.length - ranked.length;
const n = Math.round(ranked.length * KEEP);
const keep = ranked.slice(0, n), drop = ranked.slice(n);

const r2 = x => Math.round(x * 1000) / 1000;
fs.writeFileSync(OUT, JSON.stringify({
	made: new Date().toISOString(), games: good.length, share: KEEP, cutoff: r2(keep.length ? keep[keep.length - 1].p : 0),
	keep: keep.map(x => x.name),
	detail: ranked.map(x => ({ name: x.name, tier: x.played, p: r2(x.p), up: r2(x.above), down: r2(x.below), theta: r2(x.theta), sd: r2(x.sd), apps: x.apps })),
}, null, '\t'));

const line = x => `${x.name} (${x.played}, ${Math.round(100 * x.p)}% ${x.above >= x.below ? 'up' : 'down'}, ${x.apps} apps)`;
console.log(`${good.length} games. ${lockedCount} locked (${[...LOCKED_TIERS].join(', ')} and the Simi monkeys) left out. Kept ${keep.length} of ${ranked.length} as focus (outside-band chance >= ${Math.round(100 * (keep.length ? keep[keep.length - 1].p : 0))}%).`);
console.log('Likeliest movers:', keep.slice(0, 15).map(line).join('; '));
console.log('Surest to stay (dropped from focus):', drop.slice(-8).map(line).join('; '));
console.log(`Written to ${path.relative(ROOT, OUT)}.`);
