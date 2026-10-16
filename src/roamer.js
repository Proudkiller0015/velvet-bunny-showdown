'use strict';
/**
 * The roaming legendary beasts (the owner, 15 Oct 2026).
 *
 * Each is one shiny Pokemon for the whole server, always Lv. 50, roaming
 * Kagura until somebody catches it: Sparkles the Suicune first, then Crackles
 * the Raikou and Sizzles the Entei (the owner: "a raikou and entei with the
 * same moveset all 3 shiny"). Each is in one place at a time, or
 * nowhere anybody can reach, and moves on every MOVE_MS: one hundred slots for
 * seventy-odd places, so its chance of being in any one place averages 1%.
 * Anybody who looks for an encounter where it is meets it (not in a gym), and
 * only one trainer at a time: while it is in front of somebody nobody else
 * finds it, and once it gets away it moves on at once. It knows Recover
 * and Roar and nothing else: at half HP or more it roars and is gone, below
 * half it heals instead. Its HP is its own and nobody else's - what one
 * trainer takes off it, and what it heals back, is still the case in the next
 * trainer's grass. Knocked out, it is gone for KO_AWAY_MS and comes back at full
 * HP (the owner: "if KO it goes away for 12h"). A Master Ball does
 * not work on it, and every ball holds 1% of the time at full HP, rising to
 * 5% at 1 HP, whatever the ball, status or misses.
 *
 * "Random but always the same Suicune": its nature is rolled the first time it
 * is needed and kept with its HP (its IVs are perfect). The Suicune's first
 * appearance is the owner's - the next encounter of her character, wherever she
 * is (FIRST_FOR) - and it only starts roaming after that. The two that came
 * after start roaming as soon as the server first loads them.
 *
 * Each one's state is a small JSON file on this disk, which the wrapper commits to
 * the repository (src/roamer-store.js) the same way it keeps the guest book.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.PS_ROAMER_FILE ||
	path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-roamer.json');

const LEVEL = 50;
// Where it is changes every MOVE_MS, so somebody waiting in one place sees it come and go.
// Ten minutes until 15 Oct 2026, then three (the owner: "way too long... 3 min per location"),
// keeping the same run of places: the stops after SCHEDULE_FROM carry on from its ten-minute slot.
const OLD_MOVE_MS = 10 * 60 * 1000;
const MOVE_MS = 3 * 60 * 1000;
const SCHEDULE_FROM = 1792084200000;
// One slot in this many is each place; the rest are nowhere. 1% each, on average.
const SLOTS = 100;
const CATCH_FULL = 0.01;
const CATCH_ONE_HP = 0.05;
// The owner's Discord id: the first time the Suicune turns up, it is in front of her character.
const FIRST_FOR = '475765697633583114';
const NATURES = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
	'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle',
	'Sassy', 'Careful', 'Quirky'];
// An encounter that never reached a result (declined, timed out) stops holding it after this.
const HOLD_MS = 45 * 60 * 1000;
const KO_AWAY_MS = 12 * 60 * 60 * 1000;

/** Rolled once, then kept: the same one every time. Its IVs are perfect (the owner), so only the nature is rolled. */
function individual(rng = Math.random) {
	return { nature: NATURES[Math.floor(rng() * NATURES.length)] };
}

const hashOf = text => crypto.createHash('sha256').update(text).digest().readUInt32BE(0);

/** The stop `now` falls in: { key, start, end }, the key being its place in the run. */
function stopAt(state, now = Date.now()) {
	if (now < SCHEDULE_FROM) {
		const slot = Math.floor(now / OLD_MOVE_MS);
		return { key: slot, start: slot * OLD_MOVE_MS, end: (slot + 1) * OLD_MOVE_MS };
	}
	const step = Math.floor((now - SCHEDULE_FROM) / MOVE_MS);
	const start = SCHEDULE_FROM + step * MOVE_MS;
	return { key: SCHEDULE_FROM / OLD_MOVE_MS + step, start, end: start + MOVE_MS };
}

/**
 * The place it is in right now, out of `places` (the region's place ids), or
 * null when it is in none of them. The same answer for everybody during the same
 * stop, worked out from its seed rather than kept, so a restart does not move it.
 */
function where(places, state, now = Date.now()) {
	// Put somewhere by the owner for a while (`!roamer move`): there, whatever the schedule says.
	if (state.forced && now < state.forced.until && places.includes(state.forced.place)) return state.forced.place;
	if (!state.seed || !places.length) return null;
	const sorted = [...places].sort();
	const at = hashOf(`${state.seed}:${stopAt(state, now).key}:${state.moves || 0}`) % Math.max(SLOTS, sorted.length);
	return at < sorted.length ? sorted[at] : null;
}

/** 1% at full HP, 5% at 1 HP, straight between. Nothing else counts. */
function catchChance(currentHp, maxhp) {
	if (maxhp <= 1) return CATCH_ONE_HP;
	const missing = Math.max(0, Math.min(1, (maxhp - currentHp) / (maxhp - 1)));
	return CATCH_FULL + (CATCH_ONE_HP - CATCH_FULL) * missing;
}

/**
 * One roamer: its species, nickname, the file its state lives in, and whose
 * encounter it waits for before it starts roaming (null: it roams at once).
 */
function makeRoamer({ species, nickname, file, repoPath, firstFor = null }) {
	function blank() {
		return { species, individual: null, seed: null, moves: 0, hp: null, seen: 0, caught: null, holder: null, awayUntil: 0 };
	}

	function write(state) {
		try {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, JSON.stringify(state, null, 1) + '\n');
		} catch (e) {
			// The next save tries again; a roamer that forgets one battle is not worth a crash.
		}
	}

	function load() {
		let state;
		try {
			state = { ...blank(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
		} catch (e) {
			state = blank();
		}
		// One that waits for nobody is out roaming from the first time it is looked at.
		if (!firstFor && !state.seed) {
			state.individual = state.individual || individual();
			state.seed = crypto.randomBytes(8).toString('hex');
			write(state);
		}
		return state;
	}

	/** The one set it is ever met with, so its HP means the same thing in every battle. */
	function set(state = load()) {
		const self = state.individual || individual();
		return {
			name: nickname,
			species,
			level: LEVEL,
			moves: ['Recover', 'Roar'],
			ability: 'Pressure',
			nature: self.nature,
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			// Maxed HP and Speed (the owner).
			evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 0, spe: 252 },
			// Trapping never holds it (the owner): Mean Look, Block, Arena Trap and the rest.
			item: 'Shed Shell',
			shiny: true,
			rare: true,
		};
	}

	/**
	 * Whether it can turn up for somebody now: not caught, and not already out
	 * in front of somebody else. `isOpen(id)` says whether an encounter still
	 * exists, so one that was closed without a result frees it at once.
	 */
	function available(isOpen = () => true, now = Date.now()) {
		const state = load();
		if (state.caught || (state.awayUntil || 0) > now) return false;
		const h = state.holder;
		return !h || !isOpen(h.encounter) || now - h.at > HOLD_MS;
	}

	/** Whether it has started roaming. */
	const started = (state = load()) => !firstFor || (state.seen || 0) > 0;

	/**
	 * An encounter in `place`: the roamer if it is there and free, held for this encounter. Returns the encounter, or null.
	 * Until a waiting one has been seen once, it waits for that character, and meets them wherever they are.
	 */
	function roll({ encounterId, userid, discord, badges, place, places = [], isOpen, now = Date.now(), rng = Math.random, wildFormat }) {
		if (!available(isOpen, now)) return null;
		const state = load();
		if (!started(state) ? String(discord || '') !== firstFor : where(places, state, now) !== place) return null;
		if (!state.individual) state.individual = individual(rng);
		if (!state.seed) state.seed = crypto.randomBytes(8).toString('hex');
		state.seen = (state.seen || 0) + 1;
		state.holder = { encounter: encounterId, userid, at: Date.now() };
		write(state);
		return {
			kind: 'wild',
			double: false,
			name: `Wild ${species}`,
			avatar: '',
			team: [set(state)],
			ai: 'easy',
			format: wildFormat,
			badges,
			roamer: true,
		};
	}

	/** Whether this battle is the roamer, for the player on `userid`. */
	function heldBy(userid) {
		const state = load();
		return !state.caught && !!state.holder && state.holder.userid === userid;
	}

	/** Its HP as the last battle left it, or null for full. */
	function hp() {
		return load().hp;
	}

	/** It got away: its HP stays as it is, it is free again, and it moves on at once. */
	function release(currentHp, maxhp) {
		const state = load();
		if (state.caught) return;
		state.hp = currentHp >= maxhp ? null : Math.max(1, Math.round(currentHp));
		state.holder = null;
		state.moves = (state.moves || 0) + 1;
		state.forced = null;
		write(state);
	}

	/** Its HP at the end of a turn it stayed for (a Recover), so a battle walked away from keeps it too. */
	function note(currentHp, maxhp) {
		const state = load();
		if (state.caught) return;
		state.hp = currentHp >= maxhp ? null : Math.max(1, Math.round(currentHp));
		write(state);
	}

	/** Knocked out: gone for twelve hours, then back somewhere at full HP. */
	function knockedOut(now = Date.now()) {
		const state = load();
		if (state.caught) return;
		state.hp = null;
		state.holder = null;
		state.awayUntil = now + KO_AWAY_MS;
		state.moves = (state.moves || 0) + 1;
		state.forced = null;
		write(state);
	}

	/** The owner puts it in `place` for `ms` (`!roamer move`); after that the schedule takes over again. */
	function moveTo(place, ms, now = Date.now()) {
		const state = load();
		if (state.caught) return { ok: false, message: 'It has been caught.' };
		// No place: back on its schedule.
		state.forced = place ? { place, until: now + ms } : null;
		write(state);
		return { ok: true, until: state.forced ? state.forced.until : null };
	}

	/** Back from a knockout now rather than in twelve hours (the owners' ⏰ Wake up), at full HP. */
	function wake() {
		const state = load();
		if (state.caught) return { ok: false, message: 'It has been caught.' };
		if (!(state.awayUntil > Date.now())) return { ok: false, message: 'It is not knocked out.' };
		state.awayUntil = 0;
		state.hp = null;
		write(state);
		return { ok: true };
	}

	function markCaught(userid, name) {
		const state = load();
		state.caught = { userid, name, at: new Date().toISOString() };
		state.holder = null;
		write(state);
	}

	return {
		FILE: file, REPO_PATH: repoPath, SPECIES: species, NICKNAME: nickname, LEVEL, MOVE_MS, SLOTS, HOLD_MS, KO_AWAY_MS,
		FIRST_FOR: firstFor,
		set, load, write, available, started, stopAt, where: (places, state = load(), now = Date.now()) => where(places, state, now),
		roll, heldBy, hp, note, release, knockedOut, moveTo, wake, markCaught, catchChance,
	};
}

// Beside the Suicune's file: velvet-roamer-raikou.json and so on.
const fileFor = id => FILE.replace(/(\.json)?$/, `-${id}.json`);

/** Every roamer, the Suicune first: an encounter where two are at once meets the first. */
const ALL = [
	makeRoamer({ species: 'Suicune', nickname: 'Sparkles', file: FILE, repoPath: 'data/roamer.json', firstFor: FIRST_FOR }),
	makeRoamer({ species: 'Raikou', nickname: 'Crackles', file: fileFor('raikou'), repoPath: 'data/roamer-raikou.json' }),
	makeRoamer({ species: 'Entei', nickname: 'Sizzles', file: fileFor('entei'), repoPath: 'data/roamer-entei.json' }),
];

/** The roamer of this species or nickname, or null. */
function find(name) {
	const id = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	return ALL.find(r => r.SPECIES.toLowerCase() === id || r.NICKNAME.toLowerCase() === id) || null;
}

/** An encounter in `place`: whichever roamer is there and free, or null. */
function roll(opts) {
	for (const r of ALL) {
		const met = r.roll(opts);
		if (met) return met;
	}
	return null;
}

// The Suicune's own functions stay at the top, as they were before there were three.
module.exports = {
	...ALL[0], FIRST_FOR, ALL, find, roll, makeRoamer, stopAt, catchChance,
};
