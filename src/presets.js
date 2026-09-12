'use strict';
/**
 * What the standard sets are, in the formats that have standard sets.
 *
 * Random Battle is not improvised. Every Pokemon in it is generated from a
 * short, published list of sets, so a Gastrodon is always Storm Drain and its
 * moves come out of one small pool - and any player past their first week knows
 * that. The bot did not. It asked the dex what abilities the species can have,
 * got Sticky Hold, Storm Drain and Sand Force, and spread its guess evenly
 * across all three, so Surf read as a third of a knockout when the real answer
 * was almost always zero.
 *
 * Showdown generates those teams itself, so the tables ship inside the package.
 * This reads them: no network, no scraping, and they are updated by the same
 * package upgrade that changes the teams.
 *
 * It deliberately does NOT apply to built teams. In OU a Landorus can carry
 * anything its trainer felt like, and pretending otherwise would be worse than
 * admitting ignorance - which is why this returns nothing for those formats and
 * the bot falls back to usage statistics and to what it has actually seen.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'node_modules', 'pokemon-showdown', 'dist', 'data', 'random-battles');
const cache = new Map();   // format -> Presets | null

const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Which table a format is generated from.
 *
 * The directory is whatever comes before "random" in the format name, which
 * covers the side games too: gen8bdsprandombattle reads gen8bdsp, and
 * gen9randomdoublesbattle reads gen9's doubles table.
 */
function tableFor(format) {
	const id = toId(format);
	if (!id.includes('random') || id.includes('factory')) return null;
	const dir = id.split('random')[0];
	if (!/^gen\d/.test(dir)) return null;
	const files = id.includes('randomdoubles')
		? ['doubles-sets.json', 'sets.json', 'data.json']
		: ['sets.json', 'data.json'];
	for (const file of files) {
		const full = path.join(ROOT, dir, file);
		if (fs.existsSync(full)) return full;
	}
	return null;
}

class Presets {
	constructor(raw) {
		this.byId = new Map();
		for (const [species, entry] of Object.entries(raw || {})) {
			if (!entry || typeof entry !== 'object') continue;
			const moves = new Set();
			const abilities = new Set();
			const teras = new Set();
			// Two shapes in the wild: a list of roles with their own movepools, and
			// the older one-pool-per-species form the early generations still use.
			const sets = Array.isArray(entry.sets) ? entry.sets : (Array.isArray(entry.moves) ? [entry] : []);
			for (const set of sets) {
				for (const m of set.movepool || set.moves || []) moves.add(toId(m));
				for (const a of set.abilities || []) abilities.add(a);
				for (const t of set.teraTypes || []) teras.add(t);
			}
			if (!moves.size && !abilities.size) continue;
			this.byId.set(toId(species), {
				moves: [...moves],
				abilities: [...abilities],
				teras: [...teras],
				level: entry.level || 0,
			});
		}
	}

	get size() { return this.byId.size; }

	entry(species) {
		return this.byId.get(toId(species)) || null;
	}

	/**
	 * The abilities this species is actually generated with.
	 *
	 * Usually one, which turns a guess into knowledge. Returns null when the
	 * species is not in the table, so the caller can tell "no information" apart
	 * from "no abilities" - a distinction the early generations depend on.
	 */
	abilities(species) {
		const e = this.entry(species);
		return e && e.abilities.length ? e.abilities : null;
	}

	/** Every move the species can turn up with, as ids. */
	moves(species) {
		const e = this.entry(species);
		return e && e.moves.length ? e.moves : null;
	}

	/** The Tera types it is generated with - what it is likely to change into. */
	teraTypes(species) {
		const e = this.entry(species);
		return e && e.teras.length ? e.teras : null;
	}
}

/** The set table for a format, or null where teams are built by hand. */
function presetsFor(format) {
	const key = toId(format);
	if (cache.has(key)) return cache.get(key);
	let presets = null;
	try {
		const file = tableFor(key);
		if (file) {
			const parsed = new Presets(JSON.parse(fs.readFileSync(file, 'utf8')));
			if (parsed.size) presets = parsed;
		}
	} catch (e) {
		presets = null;   // a missing or reshaped table is not worth failing a battle over
	}
	cache.set(key, presets);
	return presets;
}

module.exports = { presetsFor, Presets };
