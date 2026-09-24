'use strict';
/**
 * The tier sim's maths and drafting, small and fast (no battles).
 *
 *   node test/tier-sim.test.js
 *
 * The rating code decides which Pokemon the owner is told to move, so it is
 * checked against games whose answer is known: strengths drawn at random,
 * outcomes drawn from the Bradley-Terry model, and the fit has to find them
 * again - in order, and inside its own error bars about as often as a 90%
 * interval should. The drafter is checked for the rules the validator would
 * normally enforce, because in the tier sim nothing else does.
 */

const R = require('../src/tier-sim/rating');
const { creditLog } = require('../src/tier-sim/credit');

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
	if (ok) { pass++; console.log(`  ok   ${name}`); }
	else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// A small seeded generator, so a failure can be reproduced.
function mulberry(seed) {
	return () => {
		seed |= 0; seed = seed + 0x6D2B79F5 | 0;
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
const gauss = rng => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());

console.log('\n--- linear algebra ---');
{
	// [[4,2],[2,3]]: inverse diagonal is [3/8, 4/8].
	const A = Float64Array.from([4, 2, 2, 3]);
	const L = R.cholesky(Float64Array.from(A), 2);
	const x = R.cholSolve(L, 2, Float64Array.from([2, 1]));
	check('cholesky solve', Math.abs(4 * x[0] + 2 * x[1] - 2) < 1e-9 && Math.abs(2 * x[0] + 3 * x[1] - 1) < 1e-9);
	const d = R.inverseDiagonal(L, 2);
	check('inverse diagonal', Math.abs(d[0] - 0.375) < 1e-9 && Math.abs(d[1] - 0.5) < 1e-9, JSON.stringify(Array.from(d)));
	const iso = R.isotonic([1, 3, 2, 4], [1, 1, 1, 1]);
	check('isotonic pools a violation', JSON.stringify(iso) === JSON.stringify([1, 2.5, 2.5, 4]), JSON.stringify(iso));
}

console.log('\n--- Bradley-Terry recovers known strengths ---');
{
	const rng = mulberry(7);
	const n = 36;
	const truth = Array.from({ length: n }, () => gauss(rng) * 0.4);
	const games = [];
	for (let g = 0; g < 2500; g++) {
		const idx = Array.from({ length: n }, (_, i) => i).sort(() => rng() - 0.5).slice(0, 12);
		const a = idx.slice(0, 6), b = idx.slice(6);
		const x = a.reduce((s, i) => s + truth[i], 0) - b.reduce((s, i) => s + truth[i], 0);
		games.push({ a, b, y: rng() < R.sigmoid(x) ? 1 : 0 });
	}
	const fit = R.fitBT(n, games, { mean: new Float64Array(n), prec: new Float64Array(n).fill(1 / 0.25) });
	const mt = truth.reduce((s, v) => s + v, 0) / n, mf = fit.theta.reduce((s, v) => s + v, 0) / n;
	let cov = 0, vt = 0, vf = 0, inside = 0;
	for (let i = 0; i < n; i++) {
		cov += (truth[i] - mt) * (fit.theta[i] - mf); vt += (truth[i] - mt) ** 2; vf += (fit.theta[i] - mf) ** 2;
		// Only differences are identified, so the interval is checked after centring.
		if (Math.abs((fit.theta[i] - mf) - (truth[i] - mt)) <= 1.645 * fit.sd[i]) inside++;
	}
	const corr = cov / Math.sqrt(vt * vf);
	check(`fitted strengths track the truth (r = ${corr.toFixed(2)})`, corr > 0.85);
	check(`90% intervals cover about 90% (${inside}/${n})`, inside / n >= 0.75);
}

console.log('\n--- tier priors and the full fit ---');
{
	// Two tiers of equal true strength but different priors: with plenty of games the
	// fitted tier means close up; the assigner then moves nobody without strong evidence.
	const pool = [];
	for (let i = 0; i < 12; i++) pool.push({ name: `ou${i}`, tier: 'OU', played: 'OU' });
	for (let i = 0; i < 12; i++) pool.push({ name: `uu${i}`, tier: 'UU', played: 'UU' });
	pool.push({ name: 'star', tier: 'UU', played: 'UU' });
	const rng = mulberry(11);
	const zero = () => Array.from({ length: 13 }, () => 0);
	const records = [];
	for (let g = 0; g < 3000; g++) {
		const names = pool.map(e => e.name).sort(() => rng() - 0.5).slice(0, 12);
		const a = names.slice(0, 6), b = names.slice(6);
		const s = x => (x === 'star' ? 1.2 : 0);
		const d = a.reduce((t, x) => t + s(x), 0) - b.reduce((t, x) => t + s(x), 0);
		records.push({ a, b, w: rng() < R.sigmoid(d) ? 'a' : 'b', sa: a.map(zero), sb: b.map(zero) });
	}
	const out = R.rate(pool, records);
	const tiers = R.assignTiers(out.rows, out.tierMean);
	const star = tiers.find(r => r.name === 'star');
	check(`a clearly stronger UU Pokemon is moved up (${star.proposed}, ${star.theta.toFixed(2)} +/- ${star.sd.toFixed(2)})`, star.move > 0);
	const moved = tiers.filter(r => r.name !== 'star' && r.move !== 0).length;
	check(`equal Pokemon mostly stay put (${moved} of 24 moved)`, moved <= 3);
	check('tier means stay ordered', out.tierMean.OU >= out.tierMean.UU);
}

console.log('\n--- credit from a battle log ---');
{
	const log = [
		'|player|p1|P1|', '|player|p2|P2|',
		'|switch|p1a: M1|Clefable, L100|394/394', '|switch|p2a: M1|Garchomp, L100|357/357',
		'|turn|1',
		'|move|p1a: M1|Stealth Rock|p2a: M1', '|-sidestart|p2: P2|move: Stealth Rock',
		'|move|p2a: M1|U-turn|p1a: M1', '|-damage|p1a: M1|300/394',
		'|switch|p2a: M2|Toxapex, L100|304/304', '|-damage|p2a: M2|266/304|[from] Stealth Rock',
		'|turn|2',
		'|switch|p1a: M2|Great Tusk, L100|412/412',
		'|move|p2a: M2|Toxic|p1a: M2', '|-status|p1a: M2|tox',
		'|-damage|p1a: M2|386/412|[from] psn',
		'|turn|3',
		'|move|p1a: M2|Headlong Rush|p2a: M2', '|-damage|p2a: M2|0 fnt', '|faint|p2a: M2',
		'|win|P1',
	];
	const c = creditLog(log, { p1: ['M1', 'M2'], p2: ['M1', 'M2'] });
	const F = require('../src/tier-sim/credit').FIELDS;
	const f = (row, name) => row[F.indexOf(name)];
	check('winner read', c.winner === 'p1');
	check('rocks credited per turn up', f(c.p1[0], 'hazTurns') === 2, JSON.stringify(c.p1[0]));
	check('rock damage goes to the setter', f(c.p1[0], 'dmg') === Math.round(38 / 304 * 100) || f(c.p1[0], 'dmg') === 13);
	check('pivot counted', f(c.p2[0], 'pivots') === 1);
	check('status and its damage go to the inflicter', f(c.p2[1], 'status') === 1 && f(c.p2[1], 'dmg') === 6);
	check('KO to the last damager', f(c.p1[1], 'kos') === 1 && f(c.p2[1], 'fainted') === 1);
	check('switch-in that took a hit and lived is an absorb', f(c.p1[1], 'absorb') === 1, JSON.stringify(c.p1[1]));
}

console.log('\n--- drafting ---');
{
	const dex = require('../src/rp-dex')();
	const { buildPool } = require('../src/tier-sim/pool');
	const { draftTeam, legalCandidates, BANNED_MOVES } = require('../src/tier-sim/draft');
	const pool = buildPool(dex);
	const by = n => pool.find(e => e.name === n);
	check('pool is a sensible size', pool.length > 500 && pool.length < 1200, String(pool.length));
	check('no Illegal, CAP or AG in the pool', !pool.some(e => ['Samantha', 'Syclant', 'Nuzleaf-SOLD'].includes(e.name) || e.tier === 'AG'));
	check('Megas are entries of their own, holding their stone', by('Scizor-Mega') && by('Scizor-Mega').species === 'Scizor' && by('Scizor-Mega').item === 'Scizorite');
	check('viable NFEs are in, first stages are not', !!by('Porygon2') && !!by('Dusclops') && !by('Bulbasaur'));
	check('current tiers match the RP ladders (Clefable UU, Gliscor OU)', by('Clefable').tier === 'UU' && by('Gliscor').tier === 'OU');

	const legal = legalCandidates([by('Rotom-Wash'), by('Rotom-Heat'), by('Scizor-Mega'), by('Garchomp-Mega'), by('Scizor')]);
	check('one per dex number, one Mega', legal.map(e => e.name).join() === 'Rotom-Wash,Scizor-Mega,Garchomp-Mega'.split(',').filter(n => n !== 'Garchomp-Mega').join(), legal.map(e => e.name).join());

	const rng = mulberry(3);
	const peers = pool.filter(e => ['UU', 'RUBL', 'UUBL'].includes(e.tier) && e.name !== 'Garchomp-Mega');
	const cands = [by('Garchomp-Mega'), ...peers.slice(0, 40).sort(() => rng() - 0.5).slice(0, 13)];
	const t0 = Date.now();
	const team = draftTeam(dex, cands, { rng });
	const ms = Date.now() - t0;
	check(`a team of six is drafted (${ms} ms)`, team && team.sets.length === 6);
	if (team) {
		check('the focus is on it, as Garchomp holding Garchompite', team.names.includes('Garchomp-Mega') &&
			team.sets[team.names.indexOf('Garchomp-Mega')].species === 'Garchomp' && team.sets[team.names.indexOf('Garchomp-Mega')].item === 'Garchompite');
		const nums = team.sets.map(s => dex.species.get(s.species).num);
		check('species clause holds', new Set(nums).size === 6);
		check('no OHKO or evasion moves', !team.sets.some(s => s.moves.some(m => BANNED_MOVES.has(m.toLowerCase().replace(/\W/g, '')))));
		check('no Tera type on the sheet', !team.sets.some(s => s.teraType));
		check('abilities belong to the Pokemon brought', team.sets.every(s => Object.values(dex.species.get(s.species).abilities).includes(s.ability)));
	}
}

// ---------------------------------------------------------------- focus
{
	console.log('focus');
	const means = { Uber: 1.2, OU: 1.0, UU: 0.8 };
	const rows = [
		{ name: 'Mid', played: 'OU', theta: 1.0, sd: 0.02 },     // dead centre, sure
		{ name: 'Edge', played: 'OU', theta: 1.09, sd: 0.05 },   // near the Uber line
		{ name: 'Riser', played: 'OU', theta: 1.3, sd: 0.05 },   // well above
		{ name: 'Unsure', played: 'OU', theta: 1.0, sd: 1 },     // no evidence
		{ name: 'Top', played: 'Uber', theta: 5, sd: 0.1 },      // Uber has no ceiling
	];
	const p = Object.fromEntries(R.outsideChance(rows, means).map(x => [x.name, x.p]));
	check('normal CDF is right at 0 and 1.645', Math.abs(R.normalCdf(0) - 0.5) < 1e-6 && Math.abs(R.normalCdf(1.645) - 0.95) < 1e-3);
	check('a sure mid-tier Pokemon has ~0 chance to move', p.Mid < 1e-6, p.Mid);
	check('ordered: Riser > Unsure/Edge > Mid', p.Riser > 0.95 && p.Edge > p.Mid && p.Unsure > p.Mid && p.Riser > p.Edge, JSON.stringify(p));
	check('nothing is above the top tier', p.Top === 0, p.Top);

	const { Matchmaker } = require('../src/tier-sim/match');
	const dex = require('../src/rp-dex')();
	const pool = require('../src/tier-sim/pool').buildPool(dex);
	const kept = pool.filter((e, i) => i % 10 === 0).map(e => e.name);
	const mm = new Matchmaker(pool, { focus: kept, rng: mulberry(7) });
	const set = new Set(kept);
	let onlyFocus = true, fillers = 0;
	for (let i = 0; i < 40; i++) {
		const j = mm.next();
		if (!set.has(j.a.names[0]) || !set.has(j.b.names[0])) onlyFocus = false;
		fillers += [...j.a.names, ...j.b.names].filter(n => !set.has(n)).length;
		mm.record([...j.a.names.slice(0, 6), ...j.b.names.slice(0, 6)]);
	}
	check('teams are built only around focus Pokemon', onlyFocus);
	check('the rest still fill teams', fillers > 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
