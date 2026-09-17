'use strict';
/**
 * Sets with a role, for every Pokemon, including everything this server added.
 *
 * Picking moves by damage alone made Blissey a Modest Hyper Voice attacker and
 * Spiritomb an Adamant Body Slam user. A good set starts from what the Pokemon
 * is *for*. Showdown's Random Battle data already says that for nearly every
 * Pokemon - "Bulky Support: Soft-Boiled, Seismic Toss, Heal Bell, Stealth Rock,
 * Thunder Wave" - so that is the source, newest generation first, with our own
 * curated sets (data/velvet/random-sets.js) ahead of it.
 *
 * On top, this server's changes: a species' own ability (Keystone Legion, Crown
 * of Flame, Masquerade...) goes first, and its custom moves (Soul Toll, Pyre
 * Strike, Tectonic Shell...) join the movepool, where the move picker favours
 * them. A Pokemon with no set anywhere - most unevolved ones - gets one built
 * from its learnset.
 *
 * Used by src/team-assembler.js, which the RP bot's !preset, the RP trainers and
 * the bots' team builder all go through.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const DATA = require.resolve('pokemon-showdown/package.json').replace(/package\.json$/, 'data/random-battles/');
const GEN_SETS = [];
for (let g = 9; g >= 1; g--) {
	try { GEN_SETS.push(require(`${DATA}gen${g}/sets.json`)); } catch (e) { /* that generation has none */ }
}
let VELVET = {};
try { VELVET = require('../data/velvet/random-sets').SETS || {}; } catch (e) { /* data not installed */ }

const SETUP = ['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'shellsmash', 'bulkup', 'coil',
	'irondefense', 'curse', 'agility', 'tailglow', 'victorydance', 'filletaway', 'hustleup', 'tidyup', 'geomancy', 'shiftgear'];
const PHYSICAL_SETUP = ['swordsdance', 'dragondance', 'bulkup', 'coil', 'curse', 'hustleup', 'victorydance', 'filletaway', 'tidyup', 'shiftgear'];
const SPECIAL_SETUP = ['nastyplot', 'calmmind', 'quiverdance', 'tailglow', 'geomancy'];
const RECOVERY = ['recover', 'roost', 'softboiled', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'strengthsap',
	'shoreup', 'milkdrink', 'rest', 'wish', 'healorder', 'junglehealing', 'lunarblessing', 'tectonicshell', 'chrysalisveil', 'painsplit'];
const HAZARDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'tectonicshell', 'royaldecree'];
const PIVOTS = ['uturn', 'voltswitch', 'flipturn', 'teleport', 'partingshot', 'chillyreception', 'shedtail'];
const STATUS = ['willowisp', 'thunderwave', 'toxic', 'spore', 'sleeppowder', 'glare', 'nuzzle', 'yawn', 'gleamstalk', 'toxicspikes'];
const UTILITY = ['defog', 'rapidspin', 'mortalspin', 'knockoff', 'taunt', 'encore', 'haze', 'healbell', 'roar', 'whirlwind',
	'dragontail', 'trick', 'protect', 'substitute', 'destinybond', 'royaldecree', 'courtchange'];
// Attacks whose base power lies: no charge turn, no recharge, no conditions.
const AWKWARD = ['lastresort', 'focuspunch', 'dreameater', 'snore', 'naturalgift', 'beatup', 'synchronoise', 'bide',
	'razorwind', 'skyattack', 'selfdestruct', 'explosion', 'memento', 'healingwish', 'finalgambit', 'mefirst', 'thrash',
	'uproar', 'petaldance', 'hyperbeam', 'gigaimpact', 'blastburn', 'hydrocannon', 'frenzyplant', 'solarbeam', 'solarblade',
	'skullbash', 'belch', 'fling', 'steelbeam', 'mindblown'];

const TYPE_ITEMS = {
	silkscarf: 'Normal', charcoal: 'Fire', mysticwater: 'Water', miracleseed: 'Grass', magnet: 'Electric', nevermeltice: 'Ice',
	blackbelt: 'Fighting', poisonbarb: 'Poison', softsand: 'Ground', sharpbeak: 'Flying', twistedspoon: 'Psychic',
	silverpowder: 'Bug', hardstone: 'Rock', spelltag: 'Ghost', dragonfang: 'Dragon', blackglasses: 'Dark', metalcoat: 'Steel', fairyfeather: 'Fairy',
};

const BULKY_ROLES = ['Bulky Support', 'Bulky Attacker', 'Bulky Setup', 'AV Pivot'];
const SETUP_ROLES = ['Setup Sweeper', 'Bulky Setup', 'Fast Bulky Setup', 'Tera Blast user'];
const SUPPORT_ROLES = ['Bulky Support', 'Fast Support'];

/** Every move a species can learn, prevolutions and base forme included. */
function learnable(dex, species) {
	const out = new Set();
	let s = species;
	for (let i = 0; i < 5 && s && s.exists; i++) {
		const data = dex.data.Learnsets[s.id];
		for (const id of Object.keys((data && data.learnset) || {})) out.add(id);
		s = s.changesFrom ? dex.species.get(s.changesFrom)
			: s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies)
				: s.prevo ? dex.species.get(s.prevo) : null;
	}
	return out;
}

function lookup(species) {
	const ids = [species.id, toID(species.baseSpecies), species.changesFrom && toID(species.changesFrom)].filter(Boolean);
	for (const id of ids) if (VELVET[id]) return VELVET[id];
	for (const table of GEN_SETS) for (const id of ids) if (table[id] && table[id].sets) return table[id];
	return null;
}

/** A set built from the learnset, for a Pokemon no data has a set for. */
function synthesize(dex, species, moves) {
	const b = species.baseStats;
	const bulky = b.hp + b.def + b.spd > b.atk + b.spa + b.spe;
	const pool = [...moves].map(id => dex.moves.get(id)).filter(m => m.exists && !m.isNonstandard);
	const stat = b.atk >= b.spa ? 'Physical' : 'Special';
	const attacks = pool.filter(m => m.category === stat && m.basePower >= 50 && !AWKWARD.includes(m.id))
		.sort((x, y) => attackValue(species, y, stat) - attackValue(species, x, stat)).slice(0, 8);
	const extras = pool.filter(m => (bulky ? [...RECOVERY, ...STATUS, ...HAZARDS] : [...(stat === 'Physical' ? PHYSICAL_SETUP : SPECIAL_SETUP), ...PIVOTS]).includes(m.id));
	return [{
		role: bulky ? 'Bulky Attacker' : 'Fast Attacker',
		movepool: [...attacks, ...extras].map(m => m.name),
		abilities: Object.values(species.abilities).sort((x, y) => (dex.abilities.get(y).rating || 0) - (dex.abilities.get(x).rating || 0)),
	}];
}

function attackValue(species, move, stat) {
	const power = move.basePower || (['seismictoss', 'nightshade'].includes(move.id) ? 75 : 0);
	const acc = move.accuracy === true ? 1 : (move.accuracy || 100) / 100;
	const stab = species.types.includes(move.type) ? 1.5 : 1;
	const fits = !stat || move.category === stat ? 1 : 0.5;
	/*
	 * This server's own attacks are built to be used, so they are worth a little more
	 * than their base power reads - but a *signature* is the point of its owner, while
	 * a shared move (Wave Charge, Oxidize) is just another option. Alomomola replaced
	 * Scald with Wave Charge because both counted the same.
	 */
	const ours = move.num < 0 ? (move.velvetShared ? 1.08 : 1.3) : 1;
	// Foul Play hits with the target's Attack: a poor attack for anything that has its own.
	const drawback = AWKWARD.includes(move.id) ? 0.4 : move.id === 'foulplay' ? 0.6 : move.recoil ? 0.85 : 1;
	return power * (0.5 + 0.5 * acc) * stab * fits * ours * drawback;
}

/**
 * The role sets for a species: [{ role, movepool: [names], abilities: [names], teraTypes }].
 * Movepools are cut to moves the species can actually learn on this server.
 */
function roleSets(dex, name, legal = null) {
	const species = dex.species.get(name);
	if (!species.exists) return [];
	// `legal`: the moves this Pokemon may use here (a trainer's level-up moves, say), when not all of them.
	const moves = legal ? new Set([...legal].map(toID)) : learnable(dex, species);
	const found = lookup(species);
	const base = found ? found.sets : synthesize(dex, species, moves);
	const own = Object.values(species.abilities).filter(Boolean);
	const oursAbility = own.find(a => dex.abilities.get(a).num < 0);
	// Our custom moves this species learns: signatures and the shared ones.
	const oursMoves = [...moves].map(id => dex.moves.get(id)).filter(m => m.exists && m.num < 0);

	return base.map(set => {
		const role = set.role === 'Tera Blast user' ? 'Setup Sweeper' : set.role;
		// Hidden Power's type is set by IVs these sets never pick, so it is left out.
		let pool = (set.movepool || []).filter(n => toID(n) !== 'terablast' && !toID(n).startsWith('hiddenpower')).map(n => dex.moves.get(n)).filter(m => m.exists && moves.has(m.id));
		// A hand-written set of ours is already what it should be.
		for (const m of Object.values(VELVET).includes(found) ? [] : oursMoves) {
			if (pool.some(p => p.id === m.id)) continue;
			if (m.category !== 'Status') {
				// An attack of ours joins every role that attacks with that side, or shares its type.
				const stat = species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special';
				if (m.category === stat || species.types.includes(m.type) || m.flags.nosketch) pool.push(m);
			} else if ([...RECOVERY, ...HAZARDS, ...STATUS, ...UTILITY].includes(m.id) || m.flags.nosketch) {
				pool.push(m);
			}
		}
		if (pool.length < 4) {
			// Thin after the cut (an unevolved Pokemon, say): top up from the learnset.
			for (const m of synthesize(dex, species, moves)[0].movepool.map(n => dex.moves.get(n))) {
				if (pool.length >= 8) break;
				if (!pool.some(p => p.id === m.id)) pool.push(m);
			}
			// Still thin (a low-level trainer's Pokemon): whatever it knows that does something, attacks first.
			const useful = [...RECOVERY, ...HAZARDS, ...STATUS, ...UTILITY, ...SETUP, ...PIVOTS];
			const rest = [...moves].map(id => dex.moves.get(id)).filter(m => m.exists && !m.id.startsWith('hiddenpower') && !pool.some(p => p.id === m.id))
				.map(m => [m, m.category !== 'Status' ? attackValue(species, m) : useful.includes(m.id) ? 30 : 5])
				.sort((a, b) => b[1] - a[1]);
			for (const [m] of rest) { if (pool.length >= 6) break; pool.push(m); }
		}
		let abilities = (set.abilities || []).filter(a => own.includes(a));
		if (!abilities.length) abilities = own.slice();
		if (oursAbility) abilities = [oursAbility, ...abilities.filter(a => a !== oursAbility)];
		// A hand-written set (data/velvet/random-sets.js) may fix its nature, spread and item too.
		return { role, movepool: pool.map(m => m.name), abilities, teraTypes: set.teraTypes || species.types, nature: set.nature, evs: set.evs, item: set.item };
	});
}

/** Pick one entry of a list, weighted. */
function weighted(rng, entries) {
	const total = entries.reduce((n, [, w]) => n + Math.max(0, w), 0);
	if (total <= 0) return entries.length ? entries[0][0] : null;
	let r = rng() * total;
	for (const [value, w] of entries) { r -= Math.max(0, w); if (r <= 0) return value; }
	return entries[entries.length - 1][0];
}

/**
 * Four moves for a role: its STAB, what the role needs (setup for a sweeper,
 * recovery and a hazard or status for support), then coverage. Our own moves are
 * favoured. `rng` adds variety between sets of the same role.
 */
function pickMoves(dex, species, set, rng = Math.random) {
	const pool = set.movepool.map(n => dex.moves.get(n)).filter(m => m.exists);
	const b = species.baseStats;
	const statCount = { Physical: 0, Special: 0 };
	for (const m of pool) if (m.category !== 'Status') statCount[m.category]++;
	const stat = statCount.Physical === statCount.Special ? (b.atk >= b.spa ? 'Physical' : 'Special')
		: statCount.Physical > statCount.Special ? 'Physical' : 'Special';
	const chosen = [];
	const take = m => { if (m && !chosen.some(c => c.id === m.id) && chosen.length < 4) chosen.push(m); };
	const best = (filter, weight = m => attackValue(species, m, stat)) => {
		const options = pool.filter(m => !chosen.some(c => c.id === m.id) && filter(m));
		if (!options.length) return null;
		// Mostly the best, sometimes the next: variety without nonsense.
		options.sort((x, y) => weight(y) - weight(x));
		// A wall has one right answer more often than an attacker does, so it wanders less.
		const spread = defensive ? [1, 0.12, 0.04] : [1, 0.35, 0.15];
		return weighted(rng, options.slice(0, 3).map((m, i) => [m, weight(m) * spread[i]]));
	};
	const attack = m => m.category !== 'Status' && !AWKWARD.includes(m.id);

	/*
	 * What a defensive Pokemon wants out of an attack is not damage.
	 *
	 * Alomomola kept taking a 50 base power Water move that raises its Speed over
	 * Scald, because raw power is all attackValue reads. A wall's attack earns its
	 * slot by burning, poisoning or knocking an item off, so those count for more
	 * here - and only here, where the Pokemon is not in the team to hit things.
	 */
	const defensive = BULKY_ROLES.includes(set.role) || SUPPORT_ROLES.includes(set.role);
	const wallValue = m => {
		let value = attackValue(species, m, stat);
		if (!defensive) return value;
		if (m.secondary && m.secondary.status) value *= 1.7;
		if (m.id === 'knockoff' || m.id === 'scald' || m.id === 'lavaplume') value *= 1.3;
		// A pivot is how a wall does its job: it comes in, does something, and leaves.
		if (PIVOTS.includes(m.id)) value *= 1.6;
		// A move handed round the server is not what a wall is here for.
		if (m.velvetShared) value *= 0.8;
		return value;
	};
	// Its own signature first, if it has one: the Pokemon was rebuilt around it. A move
	// this server shares out is not a signature and takes its chances with the rest.
	take(best(m => attack(m) && m.num < 0 && !m.velvetShared));
	// STAB.
	take(best(m => attack(m) && species.types.includes(m.type) && !chosen.some(c => c.type === m.type), wallValue) ||
		(chosen.length ? null : best(m => attack(m) && species.types.includes(m.type), wallValue)));
	// The role's job.
	if (SETUP_ROLES.includes(set.role)) {
		take(best(m => (stat === 'Physical' ? PHYSICAL_SETUP : SPECIAL_SETUP).includes(m.id) || (m.id === 'shellsmash'), m => (m.num < 0 ? 2 : 1)));
	}
	if (BULKY_ROLES.includes(set.role) || SUPPORT_ROLES.includes(set.role)) {
		take(best(m => RECOVERY.includes(m.id), m => (m.id === 'rest' ? 0.3 : m.num < 0 ? 2 : 1)));
	}
	if (SUPPORT_ROLES.includes(set.role)) {
		take(best(m => HAZARDS.includes(m.id), m => (m.id === 'stealthrock' || m.id === 'tectonicshell' ? 2 : 1)));
		take(best(m => STATUS.includes(m.id) || UTILITY.includes(m.id), m => (m.num < 0 ? 2 : 1)));
	}
	if (set.role === 'AV Pivot' || set.role === 'Fast Attacker') take(best(m => PIVOTS.includes(m.id)));
	// A second STAB, then coverage of new types, then anything useful.
	take(best(m => attack(m) && species.types.includes(m.type) && !chosen.some(c => c.type === m.type), wallValue));
	while (chosen.length < 4) {
		const next = best(m => attack(m) && !chosen.some(c => c.category !== 'Status' && c.type === m.type), wallValue) ||
			best(m => m.category === 'Status' && !(SETUP.includes(m.id) && chosen.some(c => SETUP.includes(c.id))) &&
				!(PHYSICAL_SETUP.includes(m.id) && stat === 'Special') && !(SPECIAL_SETUP.includes(m.id) && stat === 'Physical'), m => (m.num < 0 ? 2 : 1)) ||
			best(m => attack(m), wallValue);
		if (!next) break;
		take(next);
	}
	if (!chosen.length) chosen.push(dex.moves.get('tackle'));
	return { moves: chosen.map(m => m.name), stat };
}

/** An item that suits the role, from `allowed` when a bag limits the choice. */
function itemFor(dex, species, set, moves, stat, allowed = null) {
	const moveData = moves.map(n => dex.moves.get(n));
	const allAttacks = moveData.every(m => m.category !== 'Status');
	const rockWeak = dex.getEffectiveness('Rock', species.types) >= 1 && dex.getImmunity('Rock', species.types);
	const nfe = species.nfe;
	const wants = [];
	if (nfe) wants.push('Eviolite');
	if (rockWeak) wants.push('Heavy-Duty Boots');
	// Trick is for handing over a Choice item.
	if (moveData.some(m => m.id === 'trick' || m.id === 'switcheroo')) wants.unshift(stat === 'Physical' ? 'Choice Band' : 'Choice Scarf');
	switch (set.role) {
	case 'AV Pivot': wants.push('Assault Vest', 'Leftovers'); break;
	case 'Fast Attacker': wants.push(allAttacks ? 'Choice Scarf' : 'Life Orb', allAttacks ? (stat === 'Physical' ? 'Choice Band' : 'Choice Specs') : 'Leftovers'); break;
	case 'Wallbreaker': wants.push(allAttacks ? (stat === 'Physical' ? 'Choice Band' : 'Choice Specs') : 'Life Orb', 'Life Orb'); break;
	case 'Setup Sweeper': case 'Fast Bulky Setup': case 'Tera Blast user': wants.push('Life Orb', 'Leftovers'); break;
	case 'Fast Support': wants.push('Focus Sash', 'Leftovers'); break;
	default: wants.push('Leftovers', 'Rocky Helmet', 'Sitrus Berry');
	}
	for (const name of wants) {
		if (!allowed || allowed.has(toID(name))) return name;
	}
	// Nothing the role wants is in the bag: something harmless, never a Choice item on a set with status moves
	// or a Life Orb on a wall.
	const harmless = ['leftovers', 'sitrusberry', 'lumberry', 'rockyhelmet', 'heavydutyboots', 'expertbelt', 'shellbell', 'blacksludge',
		'oranberry', 'quickclaw', 'kingsrock', 'scopelens', 'widelens', 'muscleband', 'wiseglasses', 'lifeorb', 'focussash'];
	const attacker = !BULKY_ROLES.includes(set.role) && !SUPPORT_ROLES.includes(set.role);
	if (allowed) {
		for (const id of allowed) {
			const item = dex.items.get(id);
			const boosts = TYPE_ITEMS[id];
			if (boosts) { if (moves.some(n => dex.moves.get(n).type === boosts && dex.moves.get(n).category !== 'Status')) return item.name; continue; }
			if (id === 'blacksludge' && !species.types.includes('Poison')) continue;
			if ((id === 'lifeorb' || id === 'focussash') && !attacker) continue;
			if (harmless.includes(id) || (attacker && ['muscleband', 'wiseglasses'].includes(id))) return item.name;
		}
	}
	return '';
}

/** Nature and EVs for a role and an attacking side. */
function spreadFor(species, set, stat) {
	const b = species.baseStats;
	if (set.role === 'Bulky Support') {
		const physicalWall = b.def > b.spd;
		const nature = physicalWall ? (stat === 'Physical' ? 'Impish' : 'Bold') : (stat === 'Physical' ? 'Careful' : 'Calm');
		return { nature, evs: physicalWall ? { hp: 252, def: 252, spd: 4 } : { hp: 252, def: 4, spd: 252 } };
	}
	if (set.role === 'Bulky Setup' || set.role === 'Bulky Attacker' || set.role === 'AV Pivot') {
		return { nature: stat === 'Physical' ? 'Adamant' : 'Modest', evs: stat === 'Physical' ? { hp: 252, atk: 252, spd: 4 } : { hp: 252, spa: 252, spd: 4 } };
	}
	const fast = b.spe >= 80;
	return {
		nature: stat === 'Physical' ? (fast ? 'Jolly' : 'Adamant') : (fast ? 'Timid' : 'Modest'),
		evs: stat === 'Physical' ? { atk: 252, spd: 4, spe: 252 } : { spa: 252, spd: 4, spe: 252 },
	};
}

/**
 * One complete set: { species, role, ability, item, moves, nature, evs, level, teraType }.
 * `allowedItems` (a Set of item ids) limits the item, '' when nothing is allowed.
 */
function buildSet(dex, name, { role = null, rng = Math.random, level = 100, allowedItems = null, items = true, legal = null } = {}) {
	const species = dex.species.get(name);
	const sets = roleSets(dex, name, legal);
	if (!sets.length) return null;
	const set = (role && sets.find(s => s.role === role)) || sets[Math.min(sets.length - 1, Math.floor(rng() * sets.length))];
	const { moves, stat } = pickMoves(dex, species, set, rng);
	const spread = spreadFor(species, set, stat);
	const nature = set.nature || spread.nature;
	const evs = set.evs || spread.evs;
	return {
		species: species.name,
		role: set.role,
		ability: set.abilities[0] || Object.values(species.abilities)[0] || '',
		item: !items ? '' : set.item && (!allowedItems || allowedItems.has(toID(set.item))) ? set.item : itemFor(dex, species, set, moves, stat, allowedItems),
		moves,
		nature,
		evs,
		level,
		teraType: (set.teraTypes || species.types)[0],
	};
}

module.exports = {
	roleSets, buildSet, pickMoves, itemFor, spreadFor, learnable, attackValue,
	SETUP, RECOVERY, HAZARDS, PIVOTS, STATUS, UTILITY, BULKY_ROLES, SETUP_ROLES, SUPPORT_ROLES,
};
