'use strict';

/**
 * Weather teams, as a plan the builder sets out to make.
 *
 * The checklist only knew weather as a mistake to avoid (an abuser without its
 * setter, two setters undoing each other), so the bot never built around one: six
 * good Pokemon against the owner's sun team - Torkoal and Leafeon setting it, Gouging
 * Fire, Walking Wake and Infernape cashing it in (owner, 1 Oct 2026: "bot doesnt
 * understand weather team u can take example on mine").
 *
 * A weather team here is that shape: a setter with its weather ability (and its rock
 * when the format has one), two or three Pokemon whose ability the weather switches
 * on, and the rest leaning to the types the weather powers up. This file knows who can
 * do which; src/teambuilder.js (assembleTeam) puts the team together.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const WEATHERS = {
	sun: { ids: ['sunnyday', 'desolateland'], rock: 'Heat Rock', types: ['Fire'], move: 'sunnyday' },
	rain: { ids: ['raindance', 'primordialsea'], rock: 'Damp Rock', types: ['Water'], move: 'raindance' },
	sand: { ids: ['sandstorm'], rock: 'Smooth Rock', types: ['Rock', 'Ground', 'Steel'], move: 'sandstorm' },
	snow: { ids: ['snowscape', 'snow', 'hail'], rock: 'Icy Rock', types: ['Ice'], move: 'snowscape' },
};
/*
 * How each weather is actually played, after Smogon's rain, hail and sand teams (owner,
 * 1 Oct 2026: "inspire from smogon for rain and hail and add that as a template", "same
 * for sand", "glaceon is a top tier and abuses hail well... even a half hail would be good").
 *
 *   setterMoves  what the setter carries besides its weather: Pelipper pivots out so its
 *                sweeper comes in on full rain; the hail setter puts up Aurora Veil; the
 *                sand setter lays Stealth Rock.
 *   upgrades     attacks the weather makes better than the usual choice: Thunder and
 *                Hurricane never miss in rain, Blizzard never misses in snow. Taught to
 *                anyone on the team who has the lesser move and learns the better one.
 *   moveUsers    moves that make a Pokemon a user of the weather without an ability for
 *                it, when it has the STAB: a Zapdos with Thunder and Hurricane on rain, a
 *                Blizzard-spamming Ice type in hail, Electro Shot charging at once in rain.
 *   partners     types that like the weather around: Steel loses half its Fire weakness in
 *                rain; Rock, Ground and Steel take no sand chip (and Rock gains Sp. Def).
 *   clay         the setter holds Light Clay when it carries Aurora Veil (eight turns).
 *
 * "Half" weather is the same core with one user instead of two: the setter and its best
 * abuser on an otherwise ordinary team, the way Glaceon's snow is played here.
 */
const TEMPLATES = {
	sun: { setterMoves: [], upgrades: {}, moveUsers: ['hydrosteam', 'weatherball'], partners: ['Fire', 'Grass'] },
	rain: {
		setterMoves: ['uturn', 'flipturn', 'voltswitch'],
		upgrades: { thunderbolt: 'thunder', airslash: 'hurricane' },
		moveUsers: ['thunder', 'hurricane', 'electroshot'], partners: ['Steel', 'Water'],
	},
	sand: { setterMoves: ['stealthrock'], upgrades: {}, moveUsers: [], partners: ['Rock', 'Ground', 'Steel'] },
	snow: { setterMoves: ['auroraveil'], upgrades: { icebeam: 'blizzard' }, moveUsers: ['blizzard'], partners: ['Ice'], clay: true },
};
// One team in three planned around a weather is a "half" one.
const HALF_SHARE = 0.35;

const WEATHER_OF = {};
for (const [name, w] of Object.entries(WEATHERS)) for (const id of w.ids) WEATHER_OF[id] = name;

// The games' own abilities; this server's are found by reading them (below).
const SETTERS = { drought: 'sun', orichalcumpulse: 'sun', drizzle: 'rain', sandstream: 'sand', snowwarning: 'snow' };
const USERS = {
	chlorophyll: 'sun', solarpower: 'sun', flowergift: 'sun', harvest: 'sun', protosynthesis: 'sun',
	swiftswim: 'rain', raindish: 'rain', hydration: 'rain', dryskin: 'rain',
	sandrush: 'sand', sandforce: 'sand',
	slushrush: 'snow', icebody: 'snow', iceface: 'snow',
};

/*
 * How much an ability gets out of its weather. Doubling Speed is what a weather team is
 * built on; Protosynthesis and Solar Power are a real boost; healing a sixteenth a turn
 * (Ice Body, Rain Dish) is a perk, not a reason to be on the team.
 */
const USER_WORTH = {
	chlorophyll: 1.3, swiftswim: 1.3, sandrush: 1.3, slushrush: 1.3,
	protosynthesis: 1.25, solarpower: 1.15, sandforce: 1.1,
	flowergift: 0.85, harvest: 0.7, dryskin: 0.7, hydration: 0.6, raindish: 0.6, icebody: 0.6, iceface: 0.7,
};

const cache = new WeakMap();
/** { setterOf: abilityid -> weather, userOf: abilityid -> weather } for this dex, ours included. */
function abilityMaps(dex) {
	if (cache.has(dex)) return cache.get(dex);
	const setterOf = { ...SETTERS };
	const userOf = { ...USERS };
	for (const a of dex.abilities.all()) {
		if (!(a.num < 0)) continue;   // ours: read what the code does
		const src = Object.keys(a).filter(k => typeof a[k] === 'function').map(k => String(a[k])).join('\n');
		const sets = [...new Set([...src.matchAll(/setWeather\(\s*['"]([a-z]+)['"]/g)].map(m => WEATHER_OF[m[1]]).filter(Boolean))];
		if (sets.length === 1) { setterOf[a.id] = sets[0]; continue; }
		const uses = [...new Set([...src.matchAll(/['"](sunnyday|raindance|sandstorm|snowscape|snow|hail)['"]/g)].map(m => WEATHER_OF[m[1]]))];
		if (uses.length === 1 && !sets.length) userOf[a.id] = uses[0];
	}
	const out = { setterOf, userOf };
	cache.set(dex, out);
	return out;
}

/** What a species can do for each weather: { sun: { setter: 'Drought' }, rain: { user: 'Swift Swim' } }. */
function rolesOf(dex, species) {
	const { setterOf, userOf } = abilityMaps(dex);
	const out = {};
	for (const name of Object.values(species.abilities || {})) {
		const id = toID(name);
		if (setterOf[id]) (out[setterOf[id]] = out[setterOf[id]] || {}).setter = name;
		if (userOf[id]) (out[userOf[id]] = out[userOf[id]] || {}).user = name;
	}
	return out;
}

/**
 * The weathers this pool can field, with who would play which part:
 *   { sun: { setters: [{ species, ability }], users: [{ species, ability }] }, ... }
 * Only weathers with at least one setter and two users are worth planning around.
 */
function available(dex, pool, learnable = null) {
	const found = {};
	for (const species of pool) {
		// Fully evolved only: a Panpour sets rain as well as a Simipour and does nothing else.
		if (species.nfe || (species.evos && species.evos.length)) continue;
		for (const [weather, part] of Object.entries(rolesOf(dex, species))) {
			const w = found[weather] = found[weather] || { setters: [], users: [] };
			if (part.setter) w.setters.push({ species, ability: part.setter, worth: 1 });
			else if (part.user) w.users.push({ species, ability: part.user, worth: USER_WORTH[toID(part.user)] || 1 });
		}
	}
	/*
	 * And the ones that use it through a move (TEMPLATES.moveUsers): fully evolved, with the
	 * STAB for it, and not already there for an ability. Worth a little less than a Speed
	 * doubler, a little more than a perk.
	 */
	if (learnable) {
		for (const [name, w] of Object.entries(found)) {
			const template = TEMPLATES[name];
			const have = new Set([...w.setters, ...w.users].map(x => x.species.name));
			for (const species of pool) {
				if (have.has(species.name) || species.nfe || (species.evos && species.evos.length)) continue;
				if (clashes(dex, species, name)) continue;
				const can = learnable(species);
				const move = template.moveUsers.map(id => dex.moves.get(id))
					.find(m => m.exists && can.has(m.id) && (species.types.includes(m.type) || m.id === 'weatherball' || m.id === 'electroshot') &&
						// On the side it attacks from: a physical Corviknight is no Hurricane user.
						(m.category === 'Special' ? species.baseStats.spa >= species.baseStats.atk : species.baseStats.atk >= species.baseStats.spa));
				if (move) w.users.push({ species, ability: null, move: move.id, worth: 1.08 });
			}
		}
	}
	for (const name of Object.keys(found)) {
		if (!found[name].setters.length || found[name].users.length < 2) delete found[name];
	}
	return found;
}

/** Whether a species would set a different weather from the plan's (Tyranitar on a sun team). */
function clashes(dex, species, weather) {
	return Object.entries(rolesOf(dex, species)).some(([name, part]) => name !== weather && part.setter);
}

module.exports = { WEATHERS, TEMPLATES, HALF_SHARE, abilityMaps, rolesOf, available, clashes };
