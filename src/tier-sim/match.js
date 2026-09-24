'use strict';
/**
 * Who plays next, on which team, against whom.
 *
 * Two jobs pull against each other. Every Pokemon has to be seen often enough
 * for its interval to mean something, which says "always pick whoever has
 * played least". And a game is only informative when neither side is a
 * foregone conclusion, which says "pair like with like". So:
 *
 *   - The focus of team A is drawn from the least-played Pokemon (a small
 *     random choice among them, so the order is not the dex's).
 *   - Its teammates come from its band: Pokemon whose current estimate is
 *     within about a tier of its own - its peers - weighted towards its usual
 *     partners (Smogon's teammate statistics, cache/stats/*.json), towards
 *     what this server actually uses (data/velvet/rp-usage.json), and towards
 *     the under-played. The drafter then builds a real team out of them.
 *   - Team B's focus is the least-played Pokemon of a similar estimate, and
 *     its team is built the same way. Swiss pairing, in effect: the estimates
 *     are refitted as games come in, so a Pokemon that turns out stronger than
 *     its tier starts meeting stronger teams.
 *
 * The estimates start as the tier priors (rating.js), so on the first game
 * "similar strength" means "similar current tier" - the owner's "existing tiers
 * are good guidelines".
 */

const fs = require('fs');
const path = require('path');
const { RANK } = require('./pool');

/** Where Smogon's usage statistics are cached: PS_CACHE_DIR, this checkout, or the checkout node_modules belongs to. */
function statsDirs(root) {
	const out = [];
	if (process.env.PS_CACHE_DIR) out.push(path.join(process.env.PS_CACHE_DIR, 'stats'));
	out.push(path.join(root, 'cache', 'stats'));
	try {
		// A worktree's node_modules is a junction to the main checkout's; its cache is beside it.
		out.push(path.join(path.dirname(fs.realpathSync(path.join(root, 'node_modules'))), 'cache', 'stats'));
	} catch (e) { /* no node_modules */ }
	return [...new Set(out)].filter(d => fs.existsSync(d));
}

const STATS_FILES = [
	'gen9nationaldexubers', 'gen9nationaldex', 'gen9nationaldexuu', 'gen9nationaldexru',
	'gen9ubers', 'gen9ou', 'gen9uu', 'gen9ru', 'gen9nu', 'gen9pu', 'gen9zu', 'gen9nfe', 'gen9lc',
	'gen9rpubers', 'gen9rpou', 'gen9rpuu', 'gen9rpru', 'gen9rpnu', 'gen9rppu', 'gen9rpzu',
];

/**
 * name -> Map(teammate -> share), the strongest share any format reports, top 40 each.
 * Only for Pokemon in the pool, and the big files are dropped as soon as they are read.
 */
function loadTeammates(root, names) {
	const want = new Set(names);
	const out = new Map();
	const dirs = statsDirs(root);
	let files = 0;
	for (const file of STATS_FILES) {
		const dir = dirs.find(d => fs.existsSync(path.join(d, `${file}.json`)));
		if (!dir) continue;
		let data;
		try { data = JSON.parse(fs.readFileSync(path.join(dir, `${file}.json`), 'utf8')); } catch (e) { continue; }
		if (!data || !data.pokemon) continue;
		files++;
		for (const [name, row] of Object.entries(data.pokemon)) {
			if (!want.has(name) || !row || !row.teammates) continue;
			const m = out.get(name) || new Map();
			for (const [mate, share] of Object.entries(row.teammates)) {
				if (!want.has(mate) || !(share > 0)) continue;
				m.set(mate, Math.max(m.get(mate) || 0, share));
			}
			out.set(name, m);
		}
	}
	for (const [name, m] of out) out.set(name, new Map([...m].sort((a, b) => b[1] - a[1]).slice(0, 40)));
	return { teammates: out, files };
}

/** This server's own usage score per Pokemon, best over the RP formats (0 when unseen). */
function loadServerUsage(root) {
	const out = new Map();
	let data = null;
	try { data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'velvet', 'rp-usage.json'), 'utf8')); } catch (e) { return out; }
	for (const [format, rows] of Object.entries((data && data.formats) || {})) {
		if (!/^gen9rp/.test(format)) continue;
		for (const [name, row] of Object.entries(rows)) out.set(name, Math.max(out.get(name) || 0, Number(row.score) || 0));
	}
	return out;
}

const ARCHETYPES = [['hyper offense', 0.25], ['bulky offense', 0.3], ['balance', 0.35], ['stall', 0.1]];

class Matchmaker {
	/**
	 * pool: entries. options: teammates (Map), usage (Map), rng, step (prior gap per
	 * tier rank, the same number rating.js starts from), band (how far a peer may be).
	 */
	constructor(pool, { teammates = new Map(), usage = new Map(), rng = Math.random, step = 0.18, band = 0.25, candidates = 14 } = {}) {
		this.pool = pool;
		this.byName = new Map(pool.map(e => [e.name, e]));
		this.teammates = teammates;
		this.usage = usage;
		this.rng = rng;
		this.band = band;
		this.size = candidates;
		this.apps = new Map(pool.map(e => [e.name, 0]));
		this.est = new Map(pool.map(e => [e.name, step * RANK[e.tier]]));
	}

	setEstimates(rows) {
		for (const r of rows) if (this.est.has(r.name) && Number.isFinite(r.theta)) this.est.set(r.name, r.theta);
	}

	record(names) {
		for (const n of names) if (this.apps.has(n)) this.apps.set(n, this.apps.get(n) + 1);
	}

	/** One of the `k` least-played entries passing `filter`, at random. */
	leastPlayed(filter, k = 12) {
		const list = this.pool.filter(filter);
		if (!list.length) return null;
		// Shuffle first so ties between equally-played Pokemon break at random.
		for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
		list.sort((a, b) => this.apps.get(a.name) - this.apps.get(b.name));
		return list[Math.floor(this.rng() * Math.min(k, list.length))];
	}

	peers(focus) {
		const x = this.est.get(focus.name);
		let width = this.band;
		let list = [];
		// Widen until there is a real choice: Ubers and the NFEs sit at the ends.
		for (let tries = 0; tries < 8; tries++, width *= 1.5) {
			list = this.pool.filter(e => e.num !== focus.num && Math.abs(this.est.get(e.name) - x) <= width);
			if (list.length >= 40) break;
		}
		return list;
	}

	/** focus plus `size - 1` teammates drawn from its peers. */
	candidatesFor(focus) {
		const mates = this.teammates.get(focus.name) || new Map();
		const meanApps = [...this.apps.values()].reduce((s, v) => s + v, 0) / Math.max(1, this.apps.size);
		const weighted = this.peers(focus).map(e => {
			const w = (1 + 4 * (mates.get(e.name) || 0)) * (1 + 0.5 * Math.min(1, this.usage.get(e.name) || 0)) *
				(1 / (1 + this.apps.get(e.name) / (meanApps + 1)));
			return { e, key: Math.pow(this.rng(), 1 / w) };   // weighted sampling without replacement
		}).sort((a, b) => b.key - a.key);
		return [focus, ...weighted.slice(0, this.size - 1).map(x => x.e)];
	}

	strengths(entries) {
		// For the assembler's "raw strength" term: relative, so only the ratios matter.
		return entries.map(e => Math.round(100 * Math.exp(this.est.get(e.name))));
	}

	archetype() {
		let r = this.rng();
		for (const [name, p] of ARCHETYPES) { r -= p; if (r <= 0) return name; }
		return ARCHETYPES[0][0];
	}

	next() {
		const fa = this.leastPlayed(() => true);
		const xa = this.est.get(fa.name);
		let fb = null;
		for (let width = this.band * 0.8, tries = 0; !fb && tries < 6; tries++, width *= 1.5) {
			fb = this.leastPlayed(e => e.num !== fa.num && Math.abs(this.est.get(e.name) - xa) <= width, 6);
		}
		fb = fb || this.leastPlayed(e => e.num !== fa.num);
		const a = this.candidatesFor(fa), b = this.candidatesFor(fb);
		return {
			a: { names: a.map(e => e.name), strengths: this.strengths(a), archetype: this.archetype() },
			b: { names: b.map(e => e.name), strengths: this.strengths(b), archetype: this.archetype() },
		};
	}
}

module.exports = { Matchmaker, loadTeammates, loadServerUsage, statsDirs };
