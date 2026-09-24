'use strict';
/**
 * The tier sim's games, turned into proposed tiers.
 *
 *   node scripts/tier-report.js                          -- data/tier-sim/games.jsonl -> docs/tier-sim-report.md
 *   node scripts/tier-report.js --in <file> --out <file> [--label "pilot, 45 min"]
 *
 * Everything here is src/tier-sim/rating.js: Bradley-Terry with tier priors,
 * utility in the prior, isotonic tier means, and a Pokemon moves only when its
 * 90% interval is wholly outside its current tier's band. The report says so at
 * the top, because a list of "movers" without the rule that produced it reads
 * as a verdict when it is only evidence.
 *
 * The Simi monkeys are overtuned on purpose (the owner's Balance Patch); they
 * are reported like everything else and flagged, so a "move to Ubers" for them
 * is read as the design working rather than a bug.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const IN = path.resolve(ROOT, arg('in', path.join('data', 'tier-sim', 'games.jsonl')));
const OUT = path.resolve(ROOT, arg('out', path.join('docs', 'tier-sim-report.md')));
const LABEL = arg('label', '');
const MIN_APPS = Number(arg('min-apps', 15));

const dex = require('../src/rp-dex')();
const { buildPool, MAIN_TIERS } = require('../src/tier-sim/pool');
const { rate, assignTiers } = require('../src/tier-sim/rating');

const BY_DESIGN = new Set(['Simisage', 'Simipour', 'Simisear']);

const pool = buildPool(dex);
const lines = fs.readFileSync(IN, 'utf8').split('\n').filter(l => l.trim());
const all = [];
for (const l of lines) { try { all.push(JSON.parse(l)); } catch (e) { /* a line cut off by a hard stop */ } }
const good = all.filter(r => ['a', 'b', 't'].includes(r.w) && r.sa && r.sb);
const crashed = all.filter(r => !r.w).length;

const t0 = Date.now();
const fit = rate(pool, good);
const rows = assignTiers(fit.rows, fit.tierMean);
const fitSeconds = (Date.now() - t0) / 1000;
const byName = new Map(rows.map(r => [r.name, r]));

// Focus sets: the most recent set each Pokemon ran as a focus, for the movers table.
const setOf = new Map();
for (const r of good) {
	if (r.ks && r.fa) setOf.set(r.fa, r.ks[0]);
	if (r.ks && r.fb) setOf.set(r.fb, r.ks[1]);
}

const f2 = x => (x >= 0 ? '+' : '') + x.toFixed(2);
const pct = (w, n) => (n ? `${Math.round(100 * w / n)}%` : '-');
const flag = name => (BY_DESIGN.has(name) ? ' (overtuned by design)' : '');
const apps = rows.map(r => r.apps).sort((a, b) => a - b);
const median = a => (a.length ? a[Math.floor(a.length / 2)] : 0);
const halfWidths = rows.filter(r => r.apps >= 1).map(r => 1.645 * r.sd).sort((a, b) => a - b);
const bandWidth = (() => {
	const m = MAIN_TIERS.map(t => fit.tierMean[t]).filter(v => v !== undefined);
	const gaps = m.slice(1).map((v, i) => m[i] - v).filter(g => g > 0);
	return gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
})();
const turns = good.reduce((s, r) => s + (r.turns || 0), 0) / Math.max(1, good.length);
const dms = good.reduce((s, r) => s + (r.dms || 0) * (r.dec || 0), 0) / Math.max(1, good.reduce((s, r) => s + (r.dec || 0), 0));

const out = [];
const p = s => out.push(s);
p('# Tier simulation report');
p('');
p(`${LABEL ? `**${LABEL}.** ` : ''}Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from \`${path.relative(ROOT, IN).replace(/\\/g, '/')}\` by \`scripts/tier-report.js\`.`);
p('');
p(`- **${good.length}** games rated (${crashed} crashed or abandoned, excluded), ${pool.length} Pokemon in the pool, stockfish AI on both sides, average ${turns.toFixed(1)} turns, ${dms.toFixed(0)} ms per decision.`);
p(`- Appearances per Pokemon: median ${median(apps)}, minimum ${apps[0] || 0}, ${rows.filter(r => r.apps >= 40).length} of ${rows.length} at 40 or more.`);
p(`- Fitted tier means (logit strength per Pokemon): ${MAIN_TIERS.map(t => `${t} ${fit.tierMean[t] !== undefined ? fit.tierMean[t].toFixed(2) : '-'}`).join(', ')}. Average gap between tiers ${bandWidth.toFixed(2)}.`);
p(`- Utility slope (how much above-tier contribution raises the prior, fitted): ${fit.beta.toFixed(2)}. Fit took ${fitSeconds.toFixed(1)} s.`);
p(`- Median 90% interval half-width ${median(halfWidths).toFixed(2)} logit: ${halfWidths.filter(h => h < bandWidth / 2).length} Pokemon have intervals narrower than half a tier band.`);
p('');
p('## How to read this');
p('');
p('Strength is a Bradley-Terry coefficient: a team\'s log-odds of winning is the sum of its six strengths minus the opponent\'s, so each number is what the Pokemon adds to a team *after* its teammates and opponents are accounted for. Each Pokemon\'s prior is its current tier\'s fitted mean, shifted by how much more (or less) it contributed per game than its tier-mates - damage, KOs, hazard turns, removal, status, pivots, support, switch-ins absorbed, turns on the field - scaled by a slope fitted from the games themselves.');
p('');
p('**A Pokemon is proposed to move only when its whole 90% interval lies outside its current tier\'s band.** Otherwise it stays where it is, whatever its point estimate says. BL tiers are compared where they are played (UUBL in OU, and so on). Teams were drafted around each tested Pokemon from its own band with the bots\' team assembler, weighted by Smogon teammate data - peers first, not a sweeper carried by filler.');
p('');

const movers = rows.filter(r => r.move !== 0).sort((a, b) => b.move - a.move || b.theta - a.theta);
p(`## Proposed moves (${movers.length})`);
p('');
if (!movers.length) p('None yet: no interval is clear of its tier band. This is the expected result of a short run.');
else {
	p('| Pokemon | tier now | proposed | strength (90% CI) | apps | win % | utility | ran |');
	p('|---|---|---|---|---|---|---|---|');
	for (const r of movers) {
		p(`| ${r.name}${flag(r.name)} | ${r.tier}${r.tier !== r.played ? ` (in ${r.played})` : ''} | **${r.proposed}** ${r.move > 0 ? 'up' : 'down'} | ${r.theta.toFixed(2)} (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}) | ${r.apps} | ${pct(r.wins, r.apps)} | ${r.utility === null ? '-' : f2(r.utility)} | ${(setOf.get(r.name) || '').replace(/\|/g, '/')} |`);
	}
}
p('');

// Watch list: point estimate in another band, interval not yet clear.
const watch = rows.filter(r => r.move === 0 && r.band !== r.played && r.apps >= MIN_APPS)
	.sort((a, b) => Math.abs(b.theta - fit.tierMean[b.played]) / b.sd - Math.abs(a.theta - fit.tierMean[a.played]) / a.sd).slice(0, 30);
p(`## Watch list (point estimate in another tier, evidence not yet strong enough; ${MIN_APPS}+ appearances)`);
p('');
if (!watch.length) p('Nothing yet.');
else {
	p('| Pokemon | tier now | estimate sits in | strength (90% CI) | apps | win % |');
	p('|---|---|---|---|---|---|');
	for (const r of watch) p(`| ${r.name}${flag(r.name)} | ${r.played} | ${r.band} | ${r.theta.toFixed(2)} (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}) | ${r.apps} | ${pct(r.wins, r.apps)} |`);
}
p('');

p('## Proposed tiers');
p('');
for (const t of MAIN_TIERS) {
	const members = rows.filter(r => r.proposed === t).sort((a, b) => b.theta - a.theta);
	if (!members.length) continue;
	const tag = r => r.move > 0 ? ` (up from ${r.played})` : r.move < 0 ? ` (down from ${r.played})` : '';
	p(`**${t}** (${members.length}): ${members.map(r => `${r.name}${tag(r)}${BY_DESIGN.has(r.name) ? '*' : ''}`).join(', ')}`);
	p('');
}
p('\\* overtuned by design (the Simi monkeys).');
p('');

const util = rows.filter(r => r.apps >= MIN_APPS && r.support !== null).sort((a, b) => b.support - a.support).slice(0, 25);
p(`## Top utility Pokemon (non-damage contribution per game, ${MIN_APPS}+ appearances)`);
p('');
p('Per appearance: hazard turns kept up, hazards removed, statuses inflicted, pivots, support actions (screens, Heal Bell, Wish to a teammate), switch-ins absorbed, % HP healed. The index is the sum of those fields standardised over every appearance in the run.');
p('');
if (!util.length) p('Not enough appearances yet.');
else {
	p('| Pokemon | tier | index | hazard turns | removed | statuses | pivots | support | absorbed | healed % | strength |');
	p('|---|---|---|---|---|---|---|---|---|---|---|');
	for (const r of util) {
		const m = r.means;
		p(`| ${r.name}${flag(r.name)} | ${r.played} | ${f2(r.support)} | ${m.hazTurns.toFixed(1)} | ${m.hazRem.toFixed(2)} | ${m.status.toFixed(2)} | ${m.pivots.toFixed(2)} | ${m.support.toFixed(2)} | ${m.absorb.toFixed(2)} | ${m.healed.toFixed(0)} | ${r.theta.toFixed(2)} |`);
	}
}
p('');

const strongest = rows.filter(r => r.apps >= MIN_APPS).sort((a, b) => b.theta - a.theta).slice(0, 20);
p(`## Strongest overall (${MIN_APPS}+ appearances)`);
p('');
if (strongest.length) {
	p('| Pokemon | tier | strength (90% CI) | apps | win % | dmg/game | KOs/game |');
	p('|---|---|---|---|---|---|---|');
	for (const r of strongest) p(`| ${r.name}${flag(r.name)} | ${r.played} | ${r.theta.toFixed(2)} (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}) | ${r.apps} | ${pct(r.wins, r.apps)} | ${r.means.dmg.toFixed(0)} | ${r.means.kos.toFixed(2)} |`);
}
p('');

p('## The Simi monkeys');
p('');
for (const n of BY_DESIGN) {
	const r = byName.get(n);
	if (!r) { p(`- ${n}: not in the pool.`); continue; }
	p(`- ${n}: tier ${r.played}, strength ${r.theta.toFixed(2)} (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}), ${r.apps} appearances, ${pct(r.wins, r.apps)} wins; proposed ${r.proposed}. Overtuned on purpose - read a high number as the patch doing what it was meant to.`);
}
p('');

/*
 * How long a run needs. A Pokemon's standard error from the games alone falls
 * like 1/sqrt(appearances), so k = sd_data * sqrt(apps), measured on the
 * Pokemon that have played 20+ games, says how many
 * appearances bring a 90% interval down to a given half-width. Twelve
 * appearances per game spread over the pool turns that into games, and the
 * run's own pace (progress.json) into hours.
 */
{
	const settled = rows.filter(r => r.apps >= 20);
	// The data's own precision: the posterior's less the prior's (tau = 0.3, rating.js),
	// so the prior's head start is not mistaken for evidence.
	const ks = settled.map(r => Math.sqrt(r.apps / Math.max(1e-6, 1 / (r.sd * r.sd) - 1 / (0.3 * 0.3)))).sort((a, b) => a - b);
	let pace = 0;
	try { const pr = JSON.parse(fs.readFileSync(path.join(path.dirname(IN), 'progress.json'), 'utf8')); pace = pr.session.done / pr.session.hours; } catch (e) { /* no progress file */ }
	p('## Run length estimate');
	p('');
	if (ks.length < 20) p('Not enough Pokemon with 20+ appearances to estimate yet.');
	else {
		const k = median(ks);
		p(`Measured: sd (games alone) x sqrt(appearances) = ${k.toFixed(2)} (median over ${ks.length} Pokemon with 20+ appearances)${pace ? `; pace ${pace.toFixed(0)} games/hour` : ''}.`);
		p('');
		p('| goal | appearances each | games | hours at this pace |');
		p('|---|---|---|---|');
		const goals = [['40 appearances each (the owner\'s floor)', 40], ['90% CI half-width = half a tier gap', Math.pow(1.645 * k / (bandWidth / 2 || 0.1), 2)], ['90% CI half-width = a quarter tier gap (two-tier moves solid)', Math.pow(1.645 * k / (bandWidth / 4 || 0.05), 2)]];
		for (const [label, a] of goals) {
			const games = Math.ceil(a * pool.length / 12);
			p(`| ${label} | ${Math.ceil(a)} | ${games} | ${pace ? (games / pace).toFixed(1) : '-'} |`);
		}
	}
	p('');
}

p('## Confidence notes');
p('');
p(`- The prior carries most of the weight until a Pokemon has played a few dozen games; with ${median(apps)} median appearances, most strengths here are still close to their tier's mean by construction. "No move" means "no evidence yet", not "confirmed".`);
p('- Both sides are the same AI. A Pokemon whose value depends on play the AI does badly (e.g. careful Wish passing, prediction-heavy pivots) is under-rated; one the AI plays well is over-rated. The AI also plans with the calculator\'s copy of the dex, which knows our new moves, abilities and species but not stat or type changes to existing Pokemon (src/velvet-pkmn.js copies only species it has never heard of). Checked: Luxray, Roserade, Spiritomb, Togekiss, Cresselia, Pikachu and Eevee differ, so the AI plans with their pre-patch numbers on both sides - read their results with extra care.');
p('- One set per role, from the role-set data and the assembler: a Pokemon whose best set is unusual may be judged on a worse one.');
p('- The error bars come from the full inverse Hessian (teammate correlations included) but assume the model is right: that strengths add up on a team. Strong synergies (weather, Trick Room) break that and show up as noise.');
p('- Teams are drafted from each Pokemon\'s band, so a Pokemon is judged mostly among peers; its estimate says how good it is *there*. A move of two tiers or more rests on fewer cross-band games and deserves a second look.');
p('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'));
console.log(`${good.length} games -> ${path.relative(ROOT, OUT)} (${movers.length} proposed moves, fit ${fitSeconds.toFixed(1)} s)`);
