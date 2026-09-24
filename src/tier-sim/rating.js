'use strict';
/**
 * From games to a strength per Pokemon, with an honest error bar.
 *
 * The model is Bradley-Terry over team members: the log-odds that team A beats
 * team B is the sum of A's six strengths minus the sum of B's. That one line is
 * what "the team's win rate with vs without it, adjusted for teammates and
 * opponents" means in practice - a Pokemon only gets credit for wins its
 * teammates' strengths do not already explain, and only blame for losses to
 * opponents that were not simply stronger.
 *
 * Three things keep it sane with far fewer games than parameters would like:
 *
 *   1. Priors from the current tier. Each strength starts at its tier's mean
 *      (Uber > OU > UU > ... > ZU > NFE) with a spread of `tau`. A Pokemon with
 *      twelve games stays near its tier; one with two hundred is wherever the
 *      games put it. The tier means themselves are fitted (empirical Bayes)
 *      and kept in order by isotonic regression, so the gap between OU and UU
 *      is measured rather than assumed.
 *
 *   2. Utility in the prior. A Pokemon whose per-game contribution (damage, KOs,
 *      hazards kept up, statuses, pivots, support, switch-ins absorbed - see
 *      src/tier-sim/credit.js) is above its tier-mates' gets a higher prior, by
 *      a slope `beta` that is itself fitted from how well contribution predicted
 *      the win-based strengths. This is how the owner's Clefable rule enters
 *      the maths: utility moves a Pokemon only as far as utility has been shown
 *      to win games, and the games still have the last word.
 *
 *   3. The posterior is fitted exactly (Newton's method on the full Hessian:
 *      with under a thousand Pokemon that is a few million numbers and a
 *      Cholesky factorisation per step), so the standard errors are the real
 *      ones from the inverse Hessian, correlations with usual teammates
 *      included, not a diagonal guess.
 *
 * Ties count half a win each way. Games that crashed are not in here at all.
 */

const { RANK } = require('./pool');
const { FIELDS } = require('./credit');

/**
 * The contribution index: fixed, written-down weights over standardised fields.
 * These say what counts, not how much it wins - the fitted beta says that.
 * `taken` has no weight on purpose: being hit is a wall's job and a frail
 * sweeper's failure, and the difference is already in `absorb` and `fainted`.
 */
const UTILITY_WEIGHTS = {
	dmg: 1.0, kos: 1.0, hazTurns: 0.6, hazRem: 0.6, status: 0.6, pivots: 0.4, support: 0.6,
	taken: 0, absorb: 0.6, turns: 0.4, fainted: -0.3, healed: 0.3, seen: 0,
};
/** "Utility" in the report's sense: everything that is not damage and KOs. */
const SUPPORT_FIELDS = ['hazTurns', 'hazRem', 'status', 'pivots', 'support', 'absorb', 'healed'];

const sigmoid = x => 1 / (1 + Math.exp(-x));

/** In-place Cholesky of a dense symmetric positive definite n x n matrix (row-major Float64Array). */
function cholesky(A, n) {
	for (let j = 0; j < n; j++) {
		let d = A[j * n + j];
		for (let k = 0; k < j; k++) d -= A[j * n + k] * A[j * n + k];
		if (d <= 0) d = 1e-9;
		const l = Math.sqrt(d);
		A[j * n + j] = l;
		for (let i = j + 1; i < n; i++) {
			let s = A[i * n + j];
			const ri = i * n, rj = j * n;
			for (let k = 0; k < j; k++) s -= A[ri + k] * A[rj + k];
			A[ri + j] = s / l;
		}
	}
	return A;
}

function cholSolve(L, n, b) {
	const y = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let s = b[i];
		for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
		y[i] = s / L[i * n + i];
	}
	const x = new Float64Array(n);
	for (let i = n - 1; i >= 0; i--) {
		let s = y[i];
		for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
		x[i] = s / L[i * n + i];
	}
	return x;
}

/** Diagonal of A^-1 from its Cholesky factor: column by column, O(n^3) but n is small. */
function inverseDiagonal(L, n) {
	// Invert L (lower triangular), then diag(A^-1)_i = sum_k (L^-1)_{k,i}^2.
	const Li = new Float64Array(n * n);
	for (let i = 0; i < n; i++) {
		Li[i * n + i] = 1 / L[i * n + i];
		for (let j = 0; j < i; j++) {
			let s = 0;
			for (let k = j; k < i; k++) s += L[i * n + k] * Li[k * n + j];
			Li[i * n + j] = -s / L[i * n + i];
		}
	}
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		for (let k = i; k < n; k++) s += Li[k * n + i] * Li[k * n + i];
		out[i] = s;
	}
	return out;
}

/**
 * MAP fit of Bradley-Terry with Gaussian priors.
 * games: [{ a: [idx], b: [idx], y: 1 | 0 | 0.5 }]; prior: { mean: Float64Array, prec: Float64Array }.
 * Returns { theta, sd }.
 */
function fitBT(n, games, prior, { iterations = 25, tol = 1e-6 } = {}) {
	const theta = Float64Array.from(prior.mean);
	let L = null;
	for (let it = 0; it < iterations; it++) {
		const H = new Float64Array(n * n);
		const g = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			H[i * n + i] = prior.prec[i];
			g[i] = -prior.prec[i] * (theta[i] - prior.mean[i]);
		}
		for (const game of games) {
			let x = 0;
			for (const i of game.a) x += theta[i];
			for (const i of game.b) x -= theta[i];
			const p = sigmoid(x);
			const r = game.y - p;
			const w = p * (1 - p);
			const idx = game.a.concat(game.b);
			const sign = game.a.map(() => 1).concat(game.b.map(() => -1));
			for (let u = 0; u < idx.length; u++) {
				g[idx[u]] += sign[u] * r;
				for (let v = 0; v < idx.length; v++) H[idx[u] * n + idx[v]] += w * sign[u] * sign[v];
			}
		}
		L = cholesky(H, n);
		const step = cholSolve(L, n, g);
		let biggest = 0;
		for (let i = 0; i < n; i++) { theta[i] += step[i]; biggest = Math.max(biggest, Math.abs(step[i])); }
		// Converged: the factor from this step is at a point within `tol` of the
		// optimum, which is as good as refreshing it for the error bars.
		if (biggest < tol) break;
	}
	const variance = inverseDiagonal(L, n);
	return { theta, sd: Array.from(variance, v => Math.sqrt(Math.max(0, v))) };
}

/** Pool-adjacent-violators: the best non-decreasing fit to `values` (weighted), in the given order. */
function isotonic(values, weights) {
	const blocks = [];
	for (let i = 0; i < values.length; i++) {
		blocks.push({ v: values[i], w: weights[i] || 1e-9, n: 1 });
		while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
			const b = blocks.pop(), a = blocks.pop();
			const w = a.w + b.w;
			blocks.push({ v: (a.v * a.w + b.v * b.w) / w, w, n: a.n + b.n });
		}
	}
	const out = [];
	for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.v);
	return out;
}

/**
 * Per-appearance contribution, standardised field by field over all appearances,
 * then averaged per Pokemon. Returns { index: Map(name -> {u, support, n, means}), fieldStats }.
 */
function contributions(records) {
	const k = FIELDS.length;
	const sum = new Float64Array(k), sq = new Float64Array(k);
	let count = 0;
	for (const r of records) for (const row of [...r.sa, ...r.sb]) {
		count++;
		for (let f = 0; f < k; f++) { sum[f] += row[f] || 0; sq[f] += (row[f] || 0) ** 2; }
	}
	const mean = Array.from(sum, s => s / Math.max(1, count));
	const sd = Array.from(sq, (s, f) => Math.sqrt(Math.max(1e-9, s / Math.max(1, count) - mean[f] ** 2)));
	const per = new Map();
	for (const r of records) {
		for (const [names, rows] of [[r.a, r.sa], [r.b, r.sb]]) {
			names.forEach((name, i) => {
				const row = rows[i] || [];
				let u = 0, s = 0;
				FIELDS.forEach((f, j) => {
					const z = ((row[j] || 0) - mean[j]) / sd[j];
					u += (UTILITY_WEIGHTS[f] || 0) * z;
					if (SUPPORT_FIELDS.includes(f)) s += z;
				});
				const e = per.get(name) || { u: 0, support: 0, n: 0, raw: new Float64Array(k) };
				e.u += u; e.support += s; e.n++;
				for (let j = 0; j < k; j++) e.raw[j] += row[j] || 0;
				per.set(name, e);
			});
		}
	}
	for (const e of per.values()) {
		e.u /= e.n; e.support /= e.n;
		e.means = Object.fromEntries(FIELDS.map((f, j) => [f, e.raw[j] / e.n]));
		delete e.raw;
	}
	return { index: per, fieldMean: mean, fieldSd: sd };
}

/**
 * The whole fit. pool: entries (name, tier); records: parsed JSONL lines
 * ({ a, b, w: 'a'|'b'|'t', sa, sb }). Options: tau (prior spread within a tier),
 * step (initial gap per tier rank), rounds (empirical-Bayes rounds).
 */
function rate(pool, records, { tau = 0.3, step = 0.18, rounds = 3 } = {}) {
	const n = pool.length;
	const at = new Map(pool.map((e, i) => [e.name, i]));
	const games = [];
	const apps = new Float64Array(n), wins = new Float64Array(n);
	for (const r of records) {
		if (!['a', 'b', 't'].includes(r.w)) continue;
		const a = r.a.map(x => at.get(x)), b = r.b.map(x => at.get(x));
		if (a.some(x => x === undefined) || b.some(x => x === undefined)) continue;
		const y = r.w === 'a' ? 1 : r.w === 'b' ? 0 : 0.5;
		games.push({ a, b, y });
		for (const i of a) { apps[i]++; wins[i] += y; }
		for (const i of b) { apps[i]++; wins[i] += 1 - y; }
	}
	const contrib = contributions(records.filter(r => r.sa && r.sb && ['a', 'b', 't'].includes(r.w)));
	const tiers = [...new Set(pool.map(e => e.tier))].sort((x, y) => RANK[x] - RANK[y]);
	let tierMean = Object.fromEntries(tiers.map(t => [t, step * RANK[t]]));
	let beta = 0;
	const util = pool.map(e => (contrib.index.get(e.name) || { u: 0 }).u);
	const utilN = pool.map(e => (contrib.index.get(e.name) || { n: 0 }).n);
	let fit = null;
	for (let round = 0; round < rounds; round++) {
		// Utility relative to tier-mates, shrunk by how few games it rests on.
		const tierUtil = {};
		for (const t of tiers) {
			const members = pool.map((e, i) => i).filter(i => pool[i].tier === t && utilN[i] > 0);
			tierUtil[t] = members.length ? members.reduce((s, i) => s + util[i], 0) / members.length : 0;
		}
		const relUtil = pool.map((e, i) => (utilN[i] ? (util[i] - tierUtil[e.tier]) * utilN[i] / (utilN[i] + 10) : 0));
		const mean = Float64Array.from(pool, (e, i) => tierMean[e.tier] + beta * relUtil[i]);
		const prec = Float64Array.from(pool, () => 1 / (tau * tau));
		fit = fitBT(n, games, { mean, prec });
		// Empirical Bayes: tier means from the fitted strengths (isotonic in tier order)...
		const raw = tiers.map(t => {
			const members = pool.map((e, i) => i).filter(i => pool[i].tier === t);
			let s = 0, w = 0;
			for (const i of members) { const wi = 1 / (fit.sd[i] ** 2 + tau * tau); s += (fit.theta[i] - beta * relUtil[i]) * wi; w += wi; }
			return { t, v: w ? s / w : tierMean[t], w };
		});
		const iso = isotonic(raw.map(x => x.v), raw.map(x => x.w));
		tierMean = Object.fromEntries(raw.map((x, i) => [x.t, iso[i]]));
		// ...and the utility slope from how far above its tier's mean a Pokemon's
		// strength sits against how far above its tier-mates its contribution is.
		let sxy = 0, sxx = 0;
		pool.forEach((e, i) => {
			if (apps[i] < 5) return;
			const w = apps[i] / (apps[i] + 20);
			sxy += w * relUtil[i] * (fit.theta[i] - tierMean[e.tier]);
			sxx += w * relUtil[i] * relUtil[i];
		});
		beta = sxx > 0 ? Math.max(0, Math.min(1, sxy / sxx)) : 0;
	}
	const rows = pool.map((e, i) => {
		const c = contrib.index.get(e.name);
		return {
			name: e.name, tier: e.tier, played: e.played,
			theta: fit.theta[i], sd: fit.sd[i],
			apps: apps[i], wins: wins[i],
			utility: c ? c.u : null, support: c ? c.support : null, means: c ? c.means : null,
		};
	});
	return { rows, tierMean, beta, games: games.length };
}

/**
 * Tiers by strength. The bands are the fitted means of the main tiers, split at
 * the midpoints. A Pokemon stays where it is unless its interval (z = 1.645,
 * 90%) sits wholly outside its current tier's band; then it goes to the band
 * its point estimate is in, at least one step in the direction of the evidence.
 */
const TIER_ORDER = ['Uber', 'OU', 'UU', 'RU', 'NU', 'PU', 'ZU', 'NFE'];
// Tiers the owner keeps as they are (24 Sep 2026: "im not moving em down" - Ubers).
// Never proposed to move and never built around; they still fill teams.
const LOCKED_TIERS = new Set(['Uber']);
// Same for these, by name: the Simi monkeys are Uber-worthy on purpose and stay put.
const LOCKED_NAMES = new Set(['Simisage', 'Simipour', 'Simisear']);
const isLocked = r => LOCKED_TIERS.has(r.played) || LOCKED_NAMES.has(r.name);

/** Each tier's band: from the midpoint with the tier below to the midpoint with the tier above. */
function tierBands(tierMean, order = TIER_ORDER) {
	const means = order.map(t => tierMean[t] !== undefined ? tierMean[t] : null);
	// Fill any tier the pool has none of, by interpolation, so bands stay ordered.
	for (let i = 0; i < means.length; i++) if (means[i] === null) means[i] = i > 0 ? means[i - 1] - 0.18 : 1;
	const upper = order.map((t, i) => (i === 0 ? Infinity : (means[i] + means[i - 1]) / 2));
	const lower = order.map((t, i) => (i === order.length - 1 ? -Infinity : (means[i] + means[i + 1]) / 2));
	const bandOf = x => { for (let i = 0; i < order.length; i++) if (x >= lower[i]) return i; return order.length - 1; };
	return { order, upper, lower, bandOf };
}

// Standard normal CDF (Abramowitz-Stegun 26.2.17, error under 1e-7).
function normalCdf(x) {
	const t = 1 / (1 + 0.2316419 * Math.abs(x));
	const d = 0.3989422804014327 * Math.exp(-x * x / 2);
	const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
	return x >= 0 ? 1 - p : p;
}

/**
 * How likely each Pokemon's true strength lies outside its current tier's band,
 * under the fit's normal approximation. The sim uses it to stop spending games on
 * Pokemon that are clearly where they belong.
 */
function outsideChance(rows, tierMean, order = TIER_ORDER) {
	const { upper, lower } = tierBands(tierMean, order);
	return rows.map(r => {
		const cur = Math.max(0, order.indexOf(r.played));
		const sd = Math.max(1e-6, r.sd);
		const below = lower[cur] === -Infinity ? 0 : normalCdf((lower[cur] - r.theta) / sd);
		const above = upper[cur] === Infinity ? 0 : 1 - normalCdf((upper[cur] - r.theta) / sd);
		return { name: r.name, played: r.played, theta: r.theta, sd: r.sd, apps: r.apps, p: below + above, below, above };
	});
}

function assignTiers(rows, tierMean, { z = 1.645, order = TIER_ORDER, locked = LOCKED_TIERS } = {}) {
	const { upper, lower, bandOf } = tierBands(tierMean, order);
	return rows.map(r => {
		const cur = Math.max(0, order.indexOf(r.played));
		const lo = r.theta - z * r.sd, hi = r.theta + z * r.sd;
		let to = cur, evidence = 'none';
		if (locked === LOCKED_TIERS ? isLocked(r) : locked.has(r.played)) evidence = 'locked';
		else if (lo > upper[cur]) { to = Math.min(cur - 1, bandOf(r.theta)); evidence = 'up'; }
		else if (hi < lower[cur]) { to = Math.max(cur + 1, bandOf(r.theta)); evidence = 'down'; }
		to = Math.max(0, Math.min(order.length - 1, to));
		return { ...r, proposed: order[to], move: to - cur === 0 ? 0 : cur - to, evidence, lo, hi, band: order[bandOf(r.theta)] };
	});
}

module.exports = { fitBT, rate, assignTiers, tierBands, LOCKED_TIERS, LOCKED_NAMES, isLocked, outsideChance, normalCdf, TIER_ORDER, isotonic, contributions, cholesky, cholSolve, inverseDiagonal, sigmoid, UTILITY_WEIGHTS, SUPPORT_FIELDS };
