'use strict';
/**
 * Legal team generation for ANY Pokemon Showdown format.
 *
 * The contract is simple: whatever format a player picks, hand back a team that
 * TeamValidator accepts for that exact format. Nothing else is trusted - every
 * set is run through the real validator, and the validator's own complaints are
 * used to repair the set. If a set cannot be repaired the species is dropped and
 * another is drawn, so an unknown or brand-new format degrades to "legal but
 * plain" rather than to "rejected challenge".
 *
 * Repair happens at two levels:
 *   - per set   (bad move / item / ability / EVs / level / tera)
 *   - per team  (shared-type clauses, total level caps, format-specific bans)
 * Team-level lessons are carried between attempts as `constraints`, so a format
 * like Monotype is solved on the retry instead of being brute-forced.
 *
 * Set quality comes from the best source that covers the species, in order:
 *   1. Smogon strategy-dex sets for THIS EXACT FORMAT  (data.pkmn.cc/sets)
 *   2. Usage statistics for this exact format          (data.pkmn.cc/stats)
 *   3. Battle Factory sets  (gens 6-9) - real competitive sets, tier tagged
 *   4. Random Battle sets   (gens 2-9) - role based movepools for every species
 *   5. Gen 1 random data    (gen 1)
 *   6. Movepool synthesis   - anything the above do not cover (LC, CAP, mods)
 *
 * 1 and 2 are fetched once per format and cached on disk; everything from 3 down
 * ships with the package, so the bot still builds legal teams with no network.
 */

const PS = require('pokemon-showdown');
const { Dex, TeamValidator, Teams } = PS;

// Some format handlers in the published pokemon-showdown build reference `Dex`,
// `toID` and `Teams` as globals, which only exist when the full server boots
// (Inheritance throws "Dex is not defined" otherwise). Provide them.
for (const [name, value] of [['Dex', Dex], ['toID', PS.toID], ['Teams', Teams]]) {
	if (global[name] === undefined) global[name] = value;
}

const DATA = require.resolve('pokemon-showdown/package.json').replace(/package\.json$/, 'data/random-battles/');
function tryRequire(p) { try { return require(DATA + p); } catch (e) { return null; } }

const FACTORY = {};   // gen -> { tier -> { speciesid -> {sets:[...]} } }
const RANDSETS = {};  // gen -> { speciesid -> {level, sets:[...]} }
for (let g = 1; g <= 9; g++) {
	const f = tryRequire(`gen${g}/factory-sets.json`); if (f) FACTORY[g] = f;
	const s = tryRequire(`gen${g}/sets.json`); if (s) RANDSETS[g] = s;
}
const GEN1 = tryRequire('gen1/data.json');

const fs = require('fs');
const path = require('path');
const CACHE_DIR = process.env.PS_CACHE_DIR || path.join(__dirname, '..', 'cache');
const REMOTE = 'https://data.pkmn.cc';
const CACHE_TTL = 7 * 24 * 3600 * 1000;

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Weighted pick from a {key: weight} usage table. */
function pickWeighted(rng, table, reject) {
	const entries = Object.entries(table || {}).filter(([k, v]) => v > 0 && (!reject || !reject(k)));
	if (!entries.length) return null;
	const total = entries.reduce((a, [, v]) => a + v, 0);
	let r = rng() * total;
	for (const [k, v] of entries) { r -= v; if (r <= 0) return k; }
	return entries[0][0];
}

const NATURES_PHYS = ['Adamant', 'Jolly'];
const NATURES_SPEC = ['Modest', 'Timid'];
const NATURES_BULK = ['Careful', 'Bold', 'Impish', 'Calm'];
const ITEM_PREFS = ['Leftovers', 'Life Orb', 'Choice Band', 'Choice Specs', 'Choice Scarf',
	'Assault Vest', 'Heavy-Duty Boots', 'Focus Sash', 'Rocky Helmet', 'Sitrus Berry', 'Eviolite'];

/** Curated JSON is inconsistent about single value vs array - normalise. */
function arr(v) { return v === undefined || v === null ? null : Array.isArray(v) ? v : [v]; }
function pick(rng, a) { return a[Math.floor(rng() * a.length)]; }
function shuffled(rng, a) {
	const out = a.slice();
	for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
	return out;
}

class TeamBuilder {
	constructor() {
		// Each cached format context costs roughly 4MB (its own TeamValidator, a
		// format-specific Dex and a species pool). Caching all 283 formats would
		// be well over a gigabyte, so this is an LRU with a hard cap: a busy
		// server stays flat no matter how many formats players wander through.
		this.maxContexts = Number(process.env.PS_FORMAT_CACHE || 8);
		this.formats = new Map();     // insertion order is used as LRU order
		this.speciesOk = new Map();   // `${formatId}|${speciesid}` -> boolean
		this.smogon = new Map();      // formatId -> strategy-dex sets | null
		this.usage = new Map();       // formatId -> usage stats | null
	}

	/** Random-team formats are generated server-side; we must NOT send a team. */
	needsTeam(formatId) {
		const format = Dex.formats.get(formatId);
		return format.exists && !format.team;
	}

	/** Drop the least recently used format contexts once over the cap. */
	evict() {
		while (this.formats.size > this.maxContexts) {
			const oldest = this.formats.keys().next().value;
			this.formats.delete(oldest);
			// Its per-species verdicts are only meaningful for that format.
			const prefix = `${oldest}|`;
			for (const k of this.speciesOk.keys()) {
				if (k.startsWith(prefix)) this.speciesOk.delete(k);
			}
			// The Smogon/usage payloads for a format we are no longer building
			// are on disk anyway, so let them go too.
			this.smogon.delete(oldest);
			this.usage.delete(oldest);
		}
	}

	// ------------------------------------------------------- remote Smogon data
	/**
	 * Pull the Smogon strategy-dex sets and usage stats for this format. Call and
	 * await this before build() to get format-accurate sets; skipping it (or
	 * having no network) just falls through to the bundled sources.
	 */
	async prefetch(formatId) {
		const id = Dex.formats.get(formatId).id;
		await Promise.all([
			this.fetchJSON('sets', id).then(d => this.smogon.set(id, d)),
			this.fetchJSON('stats', id).then(d => this.usage.set(id, d && d.pokemon)),
		]);
	}

	/** Formats data.pkmn.cc might file this format under, most specific first. */
	remoteAliases(id) {
		const out = [id];
		const trimmed = id.replace(/(blitz|bo3|bo5|suspecttest|beta|classic)$/, '');
		if (trimmed !== id) out.push(trimmed);
		const gen = (id.match(/^gen(\d)/) || [])[1];
		if (gen) {
			if (/doubles/.test(id)) out.push(`gen${gen}doublesou`);
			else if (/vgc|bss|battlestadium/.test(id)) out.push(`gen${gen}vgc2024regh`, `gen${gen}battlestadiumsingles`);
			else out.push(`gen${gen}ou`);
		}
		return [...new Set(out)];
	}

	async fetchJSON(kind, id) {
		for (const alias of this.remoteAliases(id)) {
			const file = path.join(CACHE_DIR, kind, `${alias}.json`);
			try {
				const stat = fs.statSync(file);
				if (Date.now() - stat.mtimeMs < CACHE_TTL) {
					const raw = fs.readFileSync(file, 'utf8');
					if (raw === 'null') continue;
					return JSON.parse(raw);
				}
			} catch (e) { /* not cached yet */ }

			let data = null;
			try {
				const res = await fetch(`${REMOTE}/${kind}/${alias}.json`, { signal: AbortSignal.timeout(15000) });
				if (res.ok) data = await res.json();
			} catch (e) { return null; }   // offline: do not poison the cache
			try {
				fs.mkdirSync(path.join(CACHE_DIR, kind), { recursive: true });
				fs.writeFileSync(file, JSON.stringify(data));
			} catch (e) { /* read-only fs is fine */ }
			if (data) return data;
		}
		return null;
	}

	context(formatId) {
		const key = Dex.formats.get(formatId).id;
		if (this.formats.has(key)) {
			// Re-insert so the most recently used format is last in iteration order.
			const cached = this.formats.get(key);
			this.formats.delete(key);
			this.formats.set(key, cached);
			return cached;
		}

		const format = Dex.formats.get(key);
		if (!format.exists) throw new Error(`Unknown format: ${formatId}`);
		const validator = new TeamValidator(format);
		const dex = validator.dex;
		const ruleTable = validator.ruleTable;

		const pool = [];
		for (const species of dex.species.all()) {
			if (species.battleOnly || species.isNonstandard === 'Custom') continue;
			if (species.forme && species.forme.startsWith('Mega')) continue;
			if (species.requiredItem || species.requiredMove) continue;
			if (ruleTable.isBannedSpecies(species)) continue;
			if (!dex.species.getMovePool(species.id).size) continue;
			pool.push(species);
		}

		// Items that actually exist in this format's dex, preferred ones first.
		const items = [];
		for (const name of ITEM_PREFS) { const it = dex.items.get(name); if (it.exists && !ruleTable.isBanned(`item:${it.id}`)) items.push(it.name); }
		if (!items.length) {
			for (const it of dex.items.all()) { if (it.exists && !it.isNonstandard && !ruleTable.isBanned(`item:${it.id}`)) items.push(it.name); if (items.length > 40) break; }
		}

		const ctx = {
			id: key, format, validator, dex, ruleTable,
			gen: dex.gen,
			size: Math.max(ruleTable.minTeamSize || 1, Math.min(ruleTable.maxTeamSize || 6, 6)),
			level: ruleTable.adjustLevel || ruleTable.defaultLevel || ruleTable.maxLevel || 100,
			gameType: format.gameType || 'singles',
			pool, items,
		};
		this.formats.set(key, ctx);
		this.evict();
		return ctx;
	}

	// ------------------------------------------------------------ set sourcing
	/** A real Smogon analysis set for this species in this exact format. */
	smogonSet(ctx, species, rng) {
		const data = this.smogon.get(ctx.id);
		if (!data) return null;
		const entry = data[species.name] || data[species.baseSpecies];
		if (!entry) return null;
		const names = Object.keys(entry);
		if (!names.length) return null;
		const s = entry[pick(rng, names)];

		// A move slot is either a move or a list of alternatives for that slot.
		// If the drawn alternative is already on the set, take another from the
		// same slot rather than silently handing back a three-move Pokemon.
		const moves = [];
		for (const slot of s.moves || []) {
			const options = shuffled(rng, arr(slot) || []);
			const choice = options.find(m => m && !moves.includes(m));
			if (choice) moves.push(choice);
		}
		// `evs`/`ivs` are either one spread or a list of spreads to choose from.
		const spread = v => (v ? { ...pick(rng, arr(v)) } : undefined);
		return {
			moves,
			item: s.item ? pick(rng, arr(s.item)) : undefined,
			ability: s.ability ? pick(rng, arr(s.ability)) : undefined,
			nature: s.nature ? pick(rng, arr(s.nature)) : undefined,
			evs: spread(s.evs),
			ivs: spread(s.ivs),
			teraType: s.teratypes ? pick(rng, arr(s.teratypes)) : undefined,
			level: s.level,
			source: 'smogon',
		};
	}

	/** Fall back to what people actually run: sample the format's usage stats. */
	usageSet(ctx, species, rng) {
		const stats = this.usage.get(ctx.id);
		if (!stats) return null;
		const entry = stats[species.name] || stats[species.baseSpecies];
		if (!entry || !entry.moves) return null;

		const moves = [];
		for (let i = 0; i < 40 && moves.length < 4; i++) {
			const m = pickWeighted(rng, entry.moves, k => k === 'Nothing' || moves.includes(k));
			if (!m) break;
			moves.push(m);
		}
		if (!moves.length) return null;

		const raw = {
			moves,
			item: entry.items ? pickWeighted(rng, entry.items, k => k === 'Nothing') || undefined : undefined,
			ability: entry.abilities ? pickWeighted(rng, entry.abilities) || undefined : undefined,
			teraType: entry.teraTypes ? pickWeighted(rng, entry.teraTypes) || undefined : undefined,
			source: 'usage',
		};
		const spread = entry.spreads ? pickWeighted(rng, entry.spreads) : null;
		if (spread) {
			const [nature, nums] = spread.split(':');
			const parts = (nums || '').split('/').map(n => parseInt(n, 10));
			if (parts.length === 6 && parts.every(n => !isNaN(n))) {
				raw.nature = nature;
				raw.evs = {};
				STAT_ORDER.forEach((st, i) => { if (parts[i]) raw.evs[st] = parts[i]; });
			}
		}
		return raw;
	}

	/** A move that raises the user's own stats - dead weight when locked in. */
	isSetupMove(ctx, moveName) {
		const move = ctx.dex.moves.get(moveName);
		if (!move.exists || move.category !== 'Status') return false;
		const boosts = move.boosts || (move.self && move.self.boosts);
		if (!boosts) return false;
		if (move.target !== 'self' && move.target !== 'adjacentAlly' && move.target !== 'allySide') return false;
		return Object.values(boosts).some(v => v > 0);
	}

	/**
	 * Keep a set internally coherent. Curated data is mixed and matched across
	 * slots, so a Choice item can end up stapled to a setup move - which is the
	 * single most obvious "the bot does not know what it is doing" tell.
	 * Utility status (Trick, Defog, Healing Wish, ...) stays: those are real sets.
	 */
	sanitize(ctx, species, set, rng) {
		const item = ctx.dex.items.get(set.item || '');
		const isChoice = /^(choiceband|choicespecs|choicescarf)$/.test(item.id);
		const isAV = item.id === 'assaultvest';
		if (!isChoice && !isAV) return set;

		const bad = set.moves.filter(m => {
			if (isAV) return ctx.dex.moves.get(m).category === 'Status';
			return this.isSetupMove(ctx, m);
		});
		if (!bad.length) return set;

		set.moves = set.moves.filter(m => !bad.includes(m));
		const pool = [...ctx.dex.species.getMovePool(species.id)]
			.map(id => ctx.dex.moves.get(id))
			.filter(m => m.exists && m.category !== 'Status' && !set.moves.includes(m.name));
		// STAB first so the replacement is actually worth clicking.
		pool.sort((a, b) => (species.types.includes(b.type) ? 1 : 0) - (species.types.includes(a.type) ? 1 : 0) ||
			(b.basePower || 0) - (a.basePower || 0));
		for (const m of pool) { if (set.moves.length >= 4) break; set.moves.push(m.name); }

		// Nothing left to click means the item was the wrong call, not the moves.
		if (!set.moves.length) { set.item = 'Leftovers'; set.moves = bad.slice(0, 4); }
		return set;
	}

	curatedSet(ctx, species, rng) {
		const id = species.id, gen = ctx.gen;

		const smogon = this.smogonSet(ctx, species, rng);
		if (smogon && smogon.moves.length) return smogon;
		const usage = this.usageSet(ctx, species, rng);
		if (usage && usage.moves.length) return usage;

		const fac = FACTORY[gen];
		if (fac) {
			const tiers = shuffled(rng, Object.keys(fac)).filter(t => fac[t][id] && fac[t][id].sets && fac[t][id].sets.length);
			if (tiers.length) {
				const s = pick(rng, fac[pick(rng, tiers)][id].sets);
				const moveSlots = (s.moves || []).map(slot => pick(rng, arr(slot) || []));
				return {
					moves: moveSlots.filter(m => m),
					item: s.item ? pick(rng, arr(s.item)) : undefined,
					ability: s.ability ? pick(rng, arr(s.ability)) : undefined,
					nature: s.nature ? pick(rng, arr(s.nature)) : undefined,
					evs: s.evs ? { ...s.evs } : undefined,
					ivs: s.ivs ? { ...s.ivs } : undefined,
					teraType: s.teraType ? pick(rng, arr(s.teraType)) : undefined,
					source: 'factory',
				};
			}
		}

		const rs = RANDSETS[gen];
		if (rs && rs[id] && rs[id].sets && rs[id].sets.length) {
			const s = pick(rng, rs[id].sets);
			const movepool = (arr(s.movepool) || []).map(m => ctx.dex.moves.get(m).name).filter(m => m);
			return {
				moves: this.chooseMoves(ctx, species, movepool, rng),
				ability: s.abilities ? pick(rng, arr(s.abilities)) : undefined,
				teraType: s.teraTypes ? pick(rng, arr(s.teraTypes)) : undefined,
				source: 'randbats',
			};
		}

		if (gen === 1 && GEN1 && GEN1[id] && GEN1[id].moves) {
			return { moves: GEN1[id].moves.map(m => ctx.dex.moves.get(m).name), source: 'gen1' };
		}
		return null;
	}

	/** Four moves from a bigger pool: keep the damage, cap the status, STAB first. */
	chooseMoves(ctx, species, movepool, rng) {
		const moves = movepool.map(m => ctx.dex.moves.get(m)).filter(m => m.exists);
		if (moves.length <= 4) return moves.map(m => m.name);
		const damaging = shuffled(rng, moves.filter(m => m.category !== 'Status'));
		const status = shuffled(rng, moves.filter(m => m.category === 'Status'));
		damaging.sort((a, b) => (species.types.includes(b.type) ? 1 : 0) - (species.types.includes(a.type) ? 1 : 0));

		const out = [];
		for (const m of damaging) { if (out.length >= 3) break; out.push(m.name); }
		for (const m of status) { if (out.length >= 4) break; out.push(m.name); }
		for (const m of damaging) { if (out.length >= 4) break; if (!out.includes(m.name)) out.push(m.name); }
		return out.slice(0, 4);
	}

	/**
	 * Which Pokemon this server changed, and what each of them gained.
	 *
	 * Read from the buff module itself rather than listed here, and read from the
	 * *installed* copy - the one inside the package, which is the copy that has
	 * actually run and therefore the only one whose record of what it did is
	 * filled in. Ours is the same file with an empty table.
	 *
	 * Missing is not an error: on a plain checkout with no buffs installed this
	 * is an empty object and everything below it quietly does nothing.
	 */
	buffed() {
		if (this._buffed) return this._buffed;
		try {
			const buffs = require('pokemon-showdown/dist/data/velvet/buffs.js');
			this._buffed = buffs.applied || {};
		} catch (e) {
			this._buffed = {};
		}
		return this._buffed;
	}

	/**
	 * Abilities this Pokemon has because we gave them to it.
	 *
	 * Two markers, because there are two kinds. One is an ability we wrote, which
	 * carries a negative number like everything else of ours. The other is a real
	 * ability handed to something that never had it - Shadow Tag on a Chandelure -
	 * and those sit in slots named `V0`, `V1` and so on, because a species has
	 * only four real slots (0, 1, H, S) and a buff can hand out more than fit.
	 */
	ourAbilities(ctx, species) {
		const out = [];
		for (const [slot, name] of Object.entries(species.abilities || {})) {
			const ability = ctx.dex.abilities.get(name);
			if (!ability.exists) continue;
			if (slot.startsWith('V') || ability.num < 0) out.push(ability.name);
		}
		return out;
	}

	/**
	 * Use one, sometimes.
	 *
	 * An ability we added to a Pokemon was added because it suits it - Verdant
	 * Surge is the reason to bring a Simisage at all - so this does not try to
	 * judge it against the curated one on the numbers, the way the move rule
	 * does. It just takes it half the time. Half, rather than always, for the
	 * same reason as the moves: a server where every Simisage is identical is
	 * duller than one where it is a coin flip, and the curated ability is a
	 * perfectly good Pokemon too.
	 */
	considerOurAbilities(ctx, species, set, rng) {
		if (!set.ability) return;
		const ours = this.ourAbilities(ctx, species);
		if (!ours.length || ours.includes(set.ability)) return;
		if (rng() > 0.5) return;
		set.ability = pick(rng, ours);
	}

	/**
	 * Items this server invented that name this Pokemon as their user.
	 *
	 * `itemUser` is the dex's own field for "this item is for these species" -
	 * it is what a Thick Club or a Light Ball carries - so the Elemental Banana
	 * naming the six monkeys and the Broken Pact naming Nuzleaf is the item
	 * itself saying who it is for. Nothing has to be listed here, which is the
	 * point: the next one is understood the day it is written.
	 */
	ourItems(ctx, species) {
		const out = [];
		for (const item of ctx.dex.items.all()) {
			if (!item.exists || item.num >= 0) continue;
			const users = item.itemUser || [];
			if (users.some(name => ctx.dex.species.get(name).id === species.id ||
				ctx.dex.species.get(name).id === species.baseSpecies.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
				out.push(item.name);
			}
		}
		return out;
	}

	/**
	 * Hand one over, when it is both theirs and allowed.
	 *
	 * A signature item is a stronger claim than a signature move - the Elemental
	 * Banana does nothing at all for anybody else, so a Simisage holding one is
	 * simply a better Simisage - so this takes it more often than the move rule
	 * takes a move. Not always, because a monkey holding Leftovers is still a
	 * perfectly ordinary Pokemon and a server where the same six sets appear
	 * every game is duller.
	 *
	 * The ban check matters: the Broken Pact is Ubers-only, and a team built
	 * with one in RP OU is a team the validator throws back. It would be
	 * repaired rather than lost, but a rebuild is wasted work and the reason is
	 * knowable here.
	 */
	considerOurItems(ctx, species, set, rng) {
		const ours = this.ourItems(ctx, species);
		if (!ours.length || ours.includes(set.item)) return;
		if (rng() > 0.7) return;
		const allowed = ours.filter(name => {
			try {
				return !ctx.format || !ctx.format.ruleTable || !ctx.format.ruleTable.isBannedSpecies &&
					!ctx.format.ruleTable.has(`-item:${ctx.dex.items.get(name).id}`);
			} catch (e) {
				return true;
			}
		});
		if (!allowed.length) return;
		set.item = pick(rng, allowed);
	}

	/**
	 * The moves this server invented, that this Pokemon can actually learn.
	 *
	 * Worked out from the dex rather than listed, by the same convention the rest
	 * of the project uses: anything we wrote has a negative number, because a
	 * real move's number is its place in the National Dex of moves and ours have
	 * no place in it. Add a move tomorrow and this finds it.
	 */
	ourMoves(ctx, species) {
		let pool;
		try {
			pool = ctx.dex.species.getMovePool(species.id);
		} catch (e) {
			return [];
		}
		const out = [];
		for (const id of pool) {
			const move = ctx.dex.moves.get(id);
			if (move.exists && move.num < 0) out.push(move);
		}
		return out;
	}

	/**
	 * Roughly what a move is worth to this Pokemon, in its own terms.
	 *
	 * Deliberately crude, and deliberately not a lookup table: it reads base
	 * power, type, category and priority off the move itself, so a move added
	 * next week is understood the same way. Enough to tell that Jungle Rush is a
	 * better Grass move on a Grass-type than a 60 base power one, and not enough
	 * to pretend it knows more than that.
	 */
	moveWorth(ctx, species, move, set) {
		if (move.category === 'Status') {
			// A setup move is worth having; a second one usually is not - and the
			// move being scored is not its own second one. Comparing against the
			// whole set meant Shell Smash scored as a redundant setup move because
			// Shell Smash was in the set, and Blastoise cheerfully swapped it out.
			const boosts = move.boosts ? Object.values(move.boosts).reduce((n, v) => n + Math.max(0, v), 0) : 0;
			const alreadySetup = (set.moves || []).some(name => {
				if (name === move.name) return false;
				const other = ctx.dex.moves.get(name);
				return other.category === 'Status' && other.boosts;
			});
			return boosts && !alreadySetup ? 40 + boosts * 15 : 15;
		}
		const stab = species.types.includes(move.type) ? 1.5 : 1;
		/*
		 * A move that works out its own damage has no base power to read.
		 *
		 * Merchant's Call, Final Gambit, Seismic Toss, Night Shade: zero in the
		 * table and not zero in a battle. Scored on base power alone they are
		 * worthless and get dropped; scored generously they replace real moves.
		 * The middle is about right, and about as much as this is meant to know.
		 */
		const fixed = !move.basePower && (move.damage || move.damageCallback || /counter|toss|shade|gambit|call/i.test(move.name));
		const power = fixed ? 60 : (move.basePower || 0) * stab;
		// Priority is worth a lot on something that is not fast, and little on
		// something that outruns the room anyway.
		const speed = species.baseStats ? species.baseStats.spe : 80;
		const priority = (move.priority || 0) > 0 ? (speed < 90 ? 35 : 15) : 0;
		// An attacking stat it cannot use is worth nothing at all.
		const attack = move.category === 'Physical' ? species.baseStats.atk : species.baseStats.spa;
		const other = move.category === 'Physical' ? species.baseStats.spa : species.baseStats.atk;
		const wrongSide = attack < other - 20 ? 0.6 : 1;
		return (power + priority) * wrongSide;
	}

	/**
	 * Give one of ours a slot, when it earns one.
	 *
	 * The rule asked for is "when relevant, without making it a priority", and
	 * both halves matter. Relevant: it only ever replaces a *weaker* move of the
	 * same kind, judged by the numbers above, so a Simisage that has been handed
	 * Jungle Rush is holding something better than what it dropped. Not a
	 * priority: at most one per Pokemon, only sometimes, and never at the cost of
	 * the set's best move - a team where every Pokemon is showing off the new
	 * toys is a worse team and an obviously artificial one.
	 *
	 * A free slot is different. If the curated set came back with three moves
	 * there is nothing to weigh, and ours goes in.
	 */
	considerOurMoves(ctx, species, set, rng) {
		const ours = this.ourMoves(ctx, species).filter(move => !set.moves.includes(move.name));
		if (!ours.length) return;

		const best = ours
			.map(move => ({ move, worth: this.moveWorth(ctx, species, move, set) }))
			.sort((a, b) => b.worth - a.worth)[0];
		if (!best) return;

		if (set.moves.length < 4) { set.moves.push(best.move.name); return; }

		// Two in three, so the same Pokemon is not always carrying it.
		if (rng() > 0.66) return;

		const ranked = set.moves
			.map(name => ({ name, worth: this.moveWorth(ctx, species, ctx.dex.moves.get(name), set) }))
			.sort((a, b) => a.worth - b.worth);
		const weakest = ranked[0];
		// Only if ours is properly better, not merely different: a coin-flip swap
		// is how a curated set quietly becomes a worse one.
		if (!weakest || best.worth <= weakest.worth * 1.15) return;
		set.moves = set.moves.map(name => name === weakest.name ? best.move.name : name);
	}

	synthesizeSet(ctx, species, rng) {
		const pool = [...ctx.dex.species.getMovePool(species.id)]
			.map(id => ctx.dex.moves.get(id)).filter(m => m.exists && !['Struggle', 'Sketch'].includes(m.name));
		if (!pool.length) return null;
		return { moves: this.chooseMoves(ctx, species, pool.map(m => m.name), rng), source: 'synth' };
	}

	dressSet(ctx, species, raw, rng, constraints) {
		const gen = ctx.gen;
		const set = {
			name: species.name, species: species.name,
			moves: (raw.moves || []).filter(m => m).slice(0, 4),
			level: constraints.level || ctx.level,
		};
		if (!set.moves.length) return null;
		if (constraints.onlyMove) set.moves = [constraints.onlyMove];

		if (gen >= 2 && !constraints.noItems) {
			const abilities = Object.values(species.abilities || {}).filter(a => a);
			set.ability = raw.ability || (abilities.length ? pick(rng, abilities) : undefined);
			set.item = raw.item !== undefined ? raw.item : (ctx.items.length ? pick(rng, ctx.items) : '');
		} else if (gen >= 2) {
			const abilities = Object.values(species.abilities || {}).filter(a => a);
			if (abilities.length) set.ability = raw.ability || pick(rng, abilities);
		}
		if (gen >= 3 && !constraints.noEVs) {
			const phys = set.moves.filter(m => ctx.dex.moves.get(m).category === 'Physical').length;
			const spec = set.moves.filter(m => ctx.dex.moves.get(m).category === 'Special').length;
			set.nature = raw.nature || (phys > spec ? pick(rng, NATURES_PHYS) : spec > phys ? pick(rng, NATURES_SPEC) : pick(rng, NATURES_BULK));
			set.evs = raw.evs || (spec > phys ? { hp: 4, spa: 252, spe: 252 } : { hp: 4, atk: 252, spe: 252 });
			if (raw.ivs) set.ivs = raw.ivs;
		}
		if (gen >= 9 && raw.teraType && !constraints.noTera) set.teraType = raw.teraType;
		// After the set is otherwise decided, and before it is checked: anything
		// of ours it gets has to survive the same validation as the rest.
		if (!constraints.onlyMove) this.considerOurMoves(ctx, species, set, rng);
		if (set.ability) this.considerOurAbilities(ctx, species, set, rng);
		if (set.item !== undefined && !constraints.noItems) this.considerOurItems(ctx, species, set, rng);
		this.sanitize(ctx, species, set, rng);
		// Cross Evolution: the set is validated as the target species, so the
		// ability has to be one the target can legally have.
		if (constraints.crossEvo) {
			const target = this.crossEvoTarget(ctx, species, rng);
			if (!target) return null;
			set.name = target.name;
			const targetAbilities = Object.values(target.abilities || {}).filter(a => a);
			if (targetAbilities.length) set.ability = pick(rng, targetAbilities);
			set.item = '';
		}
		return set;
	}

	// ------------------------------------------------------------ set repairing
	repair(ctx, set, problems, rng) {
		let changed = false;
		for (const problem of problems) {
			const p = problem.toLowerCase();

			// "Pokemon can only have one Metronome in their moveset" and friends:
			// the format allows exactly this move, so make that the whole set.
			const only = problem.match(/can only have one ([A-Z][\w' -]*) in their moveset/i);
			if (only) { set.moves = [only[1].trim()]; changed = true; continue; }

			if (/(is banned|is not obtainable|does not exist|is tagged|unreleased|is not usable|can't be used)/.test(p) &&
				!/move|item|ability|tera|nature/.test(p)) return false;

			const badMove = set.moves.find(m => p.includes(m.toLowerCase()));
			if (badMove && /move|learn|know|incompatible|event|transferred|illegal/.test(p)) {
				set.moves = set.moves.filter(m => m !== badMove);
				const pool = [...ctx.dex.species.getMovePool(ctx.dex.species.get(set.species).id)]
					.map(id => ctx.dex.moves.get(id).name).filter(m => m && !set.moves.includes(m));
				if (pool.length) set.moves.push(pick(rng, pool));
				changed = true; continue;
			}
			if (/illegal moves/.test(p)) { set.moves = set.moves.slice(0, 1); changed = true; continue; }
			if (/item/.test(p)) { if (set.item) { set.item = ''; changed = true; } else if (!changed) return false; continue; }
			if (/abilit/.test(p)) {
				const abilities = Object.values(ctx.dex.species.get(set.species).abilities || {}).filter(a => a && a !== set.ability);
				if (abilities.length) set.ability = pick(rng, abilities); else delete set.ability;
				changed = true; continue;
			}
			// A batch of problems often names the same fix repeatedly ("more than 32
			// Stat Points in HP", "... in Defense", ...). Once the fix is applied the
			// rest of the batch is already handled, so keep going rather than bailing.
			if (/tera/.test(p)) { if (set.teraType) { delete set.teraType; changed = true; continue; } if (changed) continue; return false; }
			// Some formats (the Champions family) replace EVs with "Stat Points":
			// a small per-stat cap plus a total cap, and investment is mandatory.
			// Learn both numbers from the complaint itself so a format with
			// different caps is handled without a code change.
			if (/stat points?/.test(p) || /ivs are not maxed out/.test(p)) {
				const per = problem.match(/more than (\d+) Stat Points? in/i);
				const total = problem.match(/limit of (\d+)/i);
				if (per) ctx.statPer = parseInt(per[1], 10);
				if (total) ctx.statTotal = parseInt(total[1], 10);
				delete set.ivs;
				this.applyStatPoints(ctx, set);
				changed = true; continue;
			}
			// EV systems differ wildly by format (510 caps, Stat Points, AVs, none).
			// Dropping EVs entirely is always legal; a tuned spread is not.
			if (/\bevs?\b|awakening|510|nature/.test(p)) {
				if (set.evs || set.ivs || set.nature) { delete set.evs; delete set.ivs; delete set.nature; changed = true; continue; }
				if (changed) continue;
				return false;
			}
			if (/level/.test(p)) {
				const m = p.match(/level (\d+)/);
				set.level = m ? Math.min(set.level || 100, parseInt(m[1], 10)) : ctx.level;
				changed = true; continue;
			}
			if (/cross evolve/.test(p)) {
				const target = this.crossEvoTarget(ctx, ctx.dex.species.get(set.species), rng, set.name);
				if (!target) return false;
				set.name = target.name;
				const abilities = Object.values(target.abilities || {}).filter(a => a);
				if (abilities.length) set.ability = pick(rng, abilities);
				changed = true; continue;
			}
			if (/happiness|shiny|gender|nickname/.test(p)) {
				delete set.happiness; delete set.shiny; delete set.gender; changed = true; continue;
			}
			return false;
		}
		return changed;
	}

	/**
	 * Cross Evolution encodes the target in the nickname. Showdown requires the
	 * base to be NFE and the two to be *consecutive* stages: a stage-1 base must
	 * name a stage-2 target, a stage-2 base a stage-3 target.
	 */
	crossEvoTarget(ctx, species, rng, avoid) {
		if (!species.nfe) return null;
		if (!ctx.evoTargets) {
			ctx.evoTargets = ctx.dex.species.all().filter(s =>
				s.prevo && !s.battleOnly && !s.isNonstandard && !ctx.ruleTable.isRestrictedSpecies(s));
		}
		const wantStage3 = !!species.prevo;
		const options = ctx.evoTargets.filter(s => {
			if (s.baseSpecies === species.baseSpecies || s.name === avoid) return false;
			const prevo = ctx.dex.species.get(s.prevo);
			return !!prevo.prevo === wantStage3;
		});
		return options.length ? pick(rng, options) : null;
	}

	/** Rebuild a spread under a learned per-stat / total "Stat Points" budget. */
	applyStatPoints(ctx, set) {
		const per = ctx.statPer || 32;
		const total = ctx.statTotal || per * 2;
		const phys = set.moves.filter(m => ctx.dex.moves.get(m).category === 'Physical').length;
		const spec = set.moves.filter(m => ctx.dex.moves.get(m).category === 'Special').length;
		const offense = spec > phys ? 'spa' : 'atk';
		const budget = Math.min(total, per * 2);
		const first = Math.min(per, budget);
		const second = Math.min(per, budget - first);
		set.evs = { [offense]: first };
		if (second > 0) set.evs.spe = second;
	}

	buildSet(ctx, species, teamHas, rng, constraints) {
		const cacheKey = `${ctx.id}|${species.id}|${constraints.tag || ''}`;
		if (this.speciesOk.get(cacheKey) === false) return null;

		for (let attempt = 0; attempt < 3; attempt++) {
			const raw = (attempt === 0 && this.curatedSet(ctx, species, rng)) || this.synthesizeSet(ctx, species, rng);
			if (!raw) break;
			const set = this.dressSet(ctx, species, raw, rng, constraints);
			if (!set) break;

			for (let fix = 0; fix < 8; fix++) {
				const scratch = { ...teamHas };
				let problems;
				try { problems = ctx.validator.validateSet(set, scratch); } catch (e) { problems = [String(e.message || e)]; }
				// Cross Evolution legalises its nicknames in a team-level hook, so the
				// base "nicknamed a different species" check cannot be the last word here.
				if (problems && constraints.crossEvo) {
					problems = problems.filter(x => !/must not be nicknamed a different/i.test(x));
				}
				if (!problems || !problems.length) {
					if (!set.moves.length) break;
					Object.assign(teamHas, scratch);
					this.speciesOk.set(cacheKey, true);
					return set;
				}
				if (!this.repair(ctx, set, problems, rng)) break;
				if (!set.moves.length) break;
				this.sanitize(ctx, species, set, rng);   // repairs can reintroduce incoherence
			}
		}
		this.speciesOk.set(cacheKey, false);
		return null;
	}

	// ----------------------------------------------------------- team repairing
	/** Turn team-wide complaints into constraints for the next attempt. */
	learn(ctx, team, problems, constraints) {
		let learned = false;
		for (const problem of problems) {
			const p = problem.toLowerCase();

			if (/cross evolution works using nicknames|cannot cross evolve/.test(p)) {
				constraints.crossEvo = true; constraints.mustEvolve = true; constraints.tag = 'xevo'; learned = true; continue;
			}
			if (/doesn't evolve|does not evolve/.test(p)) { constraints.mustEvolve = true; constraints.tag = 'evo'; learned = true; continue; }
			if (/share a type/.test(p)) { constraints.shareType = true; learned = true; continue; }
			if (/share a color|share a colour/.test(p)) { constraints.shareColor = true; learned = true; continue; }
			if (/total level limit of (\d+)/.test(p)) {
				const cap = parseInt(p.match(/total level limit of (\d+)/)[1], 10);
				const counted = ctx.ruleTable.pickedTeamSize || team.length;
				constraints.level = Math.max(1, Math.floor(cap / counted));
				constraints.tag = `lvl${constraints.level}`;
				learned = true; continue;
			}
			if (/item clause|two of the same item|more than one .* item/.test(p)) { constraints.uniqueItems = true; learned = true; continue; }
			if (/\bevs?\b|stat point|510/.test(p)) { constraints.noEVs = true; constraints.tag = 'noev'; learned = true; continue; }
			if (/tera/.test(p)) { constraints.noTera = true; constraints.tag = 'notera'; learned = true; continue; }

			// A complaint that names species: ban exactly those and redraw.
			const named = team.filter(s => p.includes(s.species.toLowerCase()));
			if (named.length) {
				constraints.banned = constraints.banned || new Set();
				for (const s of named) constraints.banned.add(ctx.dex.species.get(s.species).id);
				learned = true; continue;
			}
		}
		return learned;
	}

	/** Species still allowed given what we have learned so far. */
	candidates(ctx, constraints, rng) {
		let pool = ctx.pool;
		if (constraints.banned) pool = pool.filter(s => !constraints.banned.has(s.id));
		if (constraints.mustEvolve) {
			const evolving = pool.filter(s => s.evos && s.evos.length);
			if (evolving.length >= ctx.size) pool = evolving;
		}
		if (constraints.shareType) {
			const types = {};
			for (const s of pool) for (const t of s.types) (types[t] = types[t] || []).push(s);
			const viable = Object.keys(types).filter(t => types[t].length >= ctx.size);
			if (viable.length) pool = types[pick(rng, viable)];
		}
		if (constraints.shareColor) {
			const colors = {};
			for (const s of pool) (colors[s.color] = colors[s.color] || []).push(s);
			const viable = Object.keys(colors).filter(c => colors[c].length >= ctx.size);
			if (viable.length) pool = colors[pick(rng, viable)];
		}
		return this.rank(ctx, pool, rng);
	}

	/**
	 * Order the draw so real teams come out of real formats: Pokemon with a
	 * Smogon analysis first, then the rest of the metagame weighted by usage,
	 * then everything else that is merely legal. Obscure formats have neither
	 * source and fall straight through to a plain shuffle.
	 */
	rank(ctx, pool, rng) {
		const sets = this.smogon.get(ctx.id);
		const stats = this.usage.get(ctx.id);
		if (!sets && !stats) return shuffled(rng, pool);

		const has = (table, s) => table && (table[s.name] !== undefined || table[s.baseSpecies] !== undefined);
		const usageOf = s => {
			const e = stats && (stats[s.name] || stats[s.baseSpecies]);
			return e && e.usage ? (e.usage.weighted || e.usage.raw || 0) : 0;
		};

		/*
		 * A buffed Pokemon is worth more than its usage says, because its usage
		 * was measured on a different Pokemon.
		 *
		 * Chandelure's numbers are the numbers of a Chandelure without Shadow Tag,
		 * and a Simisage's are from a world where it had no Verdant Surge and no
		 * Jungle Rush. Left alone the draw goes on treating them as the
		 * also-rans they used to be, and the one thing this server changed never
		 * turns up in a game.
		 *
		 * A promotion, not a guarantee: they join the band of Pokemon the format
		 * actually uses, and are drawn from it by the same weighted draw as
		 * everything else. It is the difference between being in the conversation
		 * and being ignored.
		 */
		const buffed = this.buffed();
		const analysed = [], used = [], rest = [];
		for (const s of pool) {
			if (has(sets, s)) analysed.push(s);
			else if (usageOf(s) > 0 || buffed[s.id]) used.push(s);
			else rest.push(s);
		}
		// Within each band, draw without replacement proportional to usage so the
		// same six do not appear every game.
		const byUsage = list => {
			const remaining = list.slice();
			const out = [];
			while (remaining.length) {
				const weights = remaining.map(s => usageOf(s) + 0.001);
				const total = weights.reduce((a, b) => a + b, 0);
				let r = rng() * total, i = 0;
				for (; i < remaining.length; i++) { r -= weights[i]; if (r <= 0) break; }
				out.push(remaining.splice(Math.min(i, remaining.length - 1), 1)[0]);
			}
			return out;
		};
		return [...byUsage(analysed), ...byUsage(used), ...shuffled(rng, rest)];
	}

	/**
	 * @param {string} formatId
	 * @returns {string|null} packed team, or null when the server generates it
	 */
	build(formatId, seed) {
		if (!this.needsTeam(formatId)) return null;
		const ctx = this.context(formatId);
		let s = (seed === undefined ? (Date.now() ^ (Math.random() * 0xffffffff)) : seed) >>> 0;
		const rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };

		const constraints = {};
		let last = null;
		for (let pass = 0; pass < 8; pass++) {
			const team = [];
			const teamHas = {};
			const usedItems = new Set();
			for (const species of this.candidates(ctx, constraints, rng)) {
				if (team.length >= ctx.size) break;
				if (team.some(t => ctx.dex.species.get(t.species).baseSpecies === species.baseSpecies)) continue;
				const set = this.buildSet(ctx, species, teamHas, rng, constraints);
				if (!set) continue;
				if (constraints.uniqueItems && set.item) {
					if (usedItems.has(set.item)) set.item = ctx.items.find(i => !usedItems.has(i)) || '';
					if (set.item) usedItems.add(set.item);
				}
				team.push(set);
			}
			if (team.length < ctx.size) { last = [`only built ${team.length}/${ctx.size} sets`]; continue; }

			let problems;
			try { problems = ctx.validator.validateTeam(team); } catch (e) { problems = [String(e.message || e)]; }
			if (!problems || !problems.length) return Teams.pack(team);
			last = problems;
			// A species rejected under the old constraints may well be buildable
			// under the new ones, so the "cannot build this" cache must not
			// outlive the constraints it was recorded against.
			if (this.learn(ctx, team, problems, constraints)) {
				for (const key of [...this.speciesOk.keys()]) {
					if (key.startsWith(`${ctx.id}|`) && this.speciesOk.get(key) === false) this.speciesOk.delete(key);
				}
			}
		}
		throw new Error(`Could not build a legal team for ${formatId}: ${(last || []).slice(0, 2).join(' | ')}`);
	}
}

module.exports = { TeamBuilder };
