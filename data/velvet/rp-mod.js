'use strict';
/**
 * The RP data, as a mod of its own, so the official formats stay vanilla.
 *
 * Everything in data/velvet - the buffs, the un-nerfs, the re-tiers, our own
 * Pokemon, moves and abilities, the Z-A Megas, Halloween - used to be written
 * straight into Showdown's base dex. The base dex is every format's dex, so
 * Gen 9 OU and Random Battle ran on RP's Normalize and RP's Luxray, and `/dt9`
 * showed our numbers as if they were Game Freak's.
 *
 * Now the base dex is left alone, and each generation RP is played in gets a mod
 * (gen9rp, gen8rp ... gen1rp) that the RP formats use. The data files in
 * data/velvet are still written as patches over a whole table, which is what
 * they have always been, so this file runs them once over a copy of the base
 * tables and keeps only what they changed: that difference is the RP layer.
 * Each mod lays it over its own generation at load.
 *
 * Over a past generation, a field is only replaced where that generation still
 * has the base value - where it has its own (Gen 8's tiers, Gen 2's
 * learnsets), the RP layer leaves it, exactly as the old in-place patch did,
 * since a generation's own entry always overrode the patched base one.
 */

const TABLES = [
	['Pokedex', 'pokedex'],
	['Abilities', 'abilities'],
	['Moves', 'moves'],
	['Items', 'items'],
	['FormatsData', 'formats-data'],
	['Learnsets', 'learnsets'],
];
// The order the dex loads them in; data/velvet/index.js copes with any order,
// but the same one keeps its logs reading the same.
const HOOK = { Abilities: 'abilities', FormatsData: 'formatsData', Items: 'items', Learnsets: 'learnsets', Moves: 'moves', Pokedex: 'pokedex' };

function clone(v) {
	if (Array.isArray(v)) return v.map(clone);
	if (v && typeof v === 'object') {
		const out = {};
		for (const k of Object.keys(v)) out[k] = clone(v[k]);
		return out;
	}
	return v;
}

function same(a, b) {
	if (a === b) return true;
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	if (ka.length !== Object.keys(b).length) return false;
	for (const k of ka) if (!(k in b) || !same(a[k], b[k])) return false;
	return true;
}

let DIFF = null;

/** What data/velvet changes, table by table: whole new entries, and changed fields of existing ones. */
function diff() {
	if (DIFF) return DIFF;
	const pristine = {};
	const patched = {};
	for (const [table, file] of TABLES) {
		pristine[table] = require(`../${file}.js`)[table];
		patched[table] = {};
		for (const id of Object.keys(pristine[table])) patched[table][id] = clone(pristine[table][id]);
	}
	const velvet = require('./index.js');
	for (const table of ['Abilities', 'FormatsData', 'Items', 'Learnsets', 'Moves', 'Pokedex']) {
		velvet[HOOK[table]](patched[table]);
	}

	DIFF = {};
	for (const [table] of TABLES) {
		const out = DIFF[table] = {};
		for (const id of Object.keys(patched[table])) {
			const now = patched[table][id];
			const was = pristine[table][id];
			if (!was) { out[id] = { added: now }; continue; }
			const fields = {};
			const removed = [];
			let learnset = null;
			for (const k of Object.keys(now)) {
				if (same(now[k], was[k])) continue;
				if (table === 'Learnsets' && k === 'learnset' && was.learnset) {
					learnset = { add: {}, del: [] };
					for (const move of Object.keys(now.learnset)) {
						if (!same(now.learnset[move], was.learnset[move])) learnset.add[move] = now.learnset[move];
					}
					for (const move of Object.keys(was.learnset)) if (!(move in now.learnset)) learnset.del.push(move);
					continue;
				}
				fields[k] = now[k];
			}
			for (const k of Object.keys(was)) if (!(k in now)) removed.push(k);
			if (Object.keys(fields).length || removed.length || learnset) out[id] = { fields, removed, learnset, was };
		}
		// Anything data/velvet deleted outright.
		for (const id of Object.keys(pristine[table])) if (!(id in patched[table])) out[id] = { deleted: true };
	}
	return DIFF;
}

/**
 * Lay the RP layer over a mod's own tables. Called from each RP mod's
 * scripts.js init, with `this` the mod's dex; its tables are fresh objects
 * holding the parent's entries by reference, so an entry is replaced, never
 * edited, and the parent generation is untouched.
 */
function apply(dex) {
	const d = diff();
	const data = dex.dataCache;
	for (const [table] of TABLES) {
		const mine = data[table];
		if (!mine) continue;
		for (const [id, change] of Object.entries(d[table])) {
			if (change.deleted) { delete mine[id]; continue; }
			if (change.added) { if (!(id in mine)) mine[id] = change.added; continue; }
			const entry = mine[id];
			if (!entry) continue;
			let next = null;
			const own = k => !same(entry[k], change.was[k]);
			for (const [k, v] of Object.entries(change.fields)) {
				if (own(k)) continue;
				(next || (next = { ...entry }))[k] = v;
			}
			for (const k of change.removed) {
				if (own(k)) continue;
				next = next || { ...entry };
				delete next[k];
			}
			if (change.learnset && entry.learnset === change.was.learnset) {
				next = next || { ...entry };
				const learnset = { ...entry.learnset, ...change.learnset.add };
				for (const move of change.learnset.del) delete learnset[move];
				next.learnset = learnset;
			}
			if (next) mine[id] = next;
		}
	}
}

/** The mods, one per generation RP is played in. */
const MODS = [9, 8, 7, 6, 5, 4, 3, 2, 1].map(gen => ({ id: `gen${gen}rp`, gen, inherit: `gen${gen}` }));

exports.apply = apply;
exports.diff = diff;
exports.MODS = MODS;
