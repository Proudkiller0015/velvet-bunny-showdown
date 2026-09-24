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
/*
 * Moves that simply fail unless something else set them up, which an RP team
 * built one Pokemon at a time never does: Steel Roller with no terrain on the
 * field is a lost turn, not a Steel STAB (it was Bronzor's "attack").
 */
const FAILS_ALONE = ['steelroller'];
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

/**
 * Hand-written sets for the Pokemon the learnset cannot steer.
 *
 * Smeargle sketches: every move in the game (ours included) is legal for it, so
 * scoring its movepool picked Boomburst next to Spore and Hustle Up. It has one
 * job worth doing - a fast lead that sets the field and puts something to sleep -
 * so that is the set. `core` is always taken; the last slot comes from the rest.
 */
const FIXED = {
	smeargle: [{
		role: 'Fast Support',
		core: ['Spore', 'Sticky Web', 'Stealth Rock'],
		movepool: ['Spore', 'Sticky Web', 'Stealth Rock', 'Whirlwind', 'Rapid Spin', 'Taunt', 'Ceaseless Edge'],
		abilities: ['Own Tempo'],
		item: 'Focus Sash',
		nature: 'Jolly',
		evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 0, spe: 252 },
	}],
};

/** Every move a species can learn, prevolutions and base forme included. */
function learnable(dex, species) {
	const out = new Set();
	// Sketch copies anything that is not flagged against it, this server's moves included.
	if (sketches(dex, species)) {
		for (const m of dex.moves.all()) {
			if (m.exists && !m.isNonstandard && !m.isZ && !m.isMax && !m.flags.nosketch) out.add(m.id);
		}
	}
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

function sketches(dex, species) {
	for (let s = species, i = 0; i < 5 && s && s.exists; i++) {
		const data = dex.data.Learnsets[s.id];
		if (data && data.learnset && data.learnset.sketch) return true;
		s = s.prevo ? dex.species.get(s.prevo) : null;
	}
	return false;
}

function lookup(species) {
	const ids = [species.id, toID(species.baseSpecies), species.changesFrom && toID(species.changesFrom)].filter(Boolean);
	for (const id of ids) if (FIXED[id]) return { sets: FIXED[id], fixed: true };
	for (const id of ids) if (VELVET[id]) return VELVET[id];
	for (const table of GEN_SETS) for (const id of ids) if (table[id] && table[id].sets) return table[id];
	return null;
}

/*
 * A little Pokemon with no sets of its own borrows its evolution's roles, kept
 * to the moves it can learn itself. Built from the learnset instead, a Shellder
 * came out a Rest "Bulky Attacker" with Skill Link and no multi-hit move, when
 * what it is for is Cloyster's Shell Smash, Icicle Spear and Rock Blast.
 */
function evolvedSets(dex, species, moves) {
	let step = (species.evos || []).map(n => dex.species.get(n));
	for (let depth = 0; depth < 2 && step.length; depth++) {
		for (const evo of step) {
			const found = evo.exists && lookup(evo);
			if (!found || !found.sets) continue;
			// Only the roles it can mostly play: three of the moves at least.
			const sets = found.sets.filter(set => (set.movepool || []).filter(n => moves.has(toID(n))).length >= 3);
			if (sets.length) return { sets };
		}
		step = step.flatMap(evo => (evo.evos || []).map(n => dex.species.get(n)));
	}
	return null;
}

/** A set built from the learnset, for a Pokemon no data has a set for. */
function synthesize(dex, species, moves) {
	const b = species.baseStats;
	const bulky = b.hp + b.def + b.spd > b.atk + b.spa + b.spe;
	const pool = [...moves].map(id => dex.moves.get(id)).filter(m => m.exists && !m.isNonstandard);
	const stat = b.atk >= b.spa ? 'Physical' : 'Special';
	// Two of a type at most: Elekid's best eight were six Electric moves and Psychic, so
	// its fourth slot went to a second Electric attack instead of coverage.
	const perType = {};
	const attacks = pool.filter(m => m.category === stat && m.basePower >= 50 && !AWKWARD.includes(m.id))
		.sort((x, y) => attackValue(species, y, stat) - attackValue(species, x, stat))
		.filter(m => (perType[m.type] = (perType[m.type] || 0) + 1) <= 2).slice(0, 8);
	const extras = pool.filter(m => (bulky ? [...RECOVERY, ...STATUS, ...HAZARDS] : [...(stat === 'Physical' ? PHYSICAL_SETUP : SPECIAL_SETUP), ...PIVOTS]).includes(m.id));
	return [{
		role: bulky ? 'Bulky Attacker' : 'Fast Attacker',
		movepool: [...attacks, ...extras].map(m => m.name),
		abilities: Object.values(species.abilities).sort((x, y) => (dex.abilities.get(y).rating || 0) - (dex.abilities.get(x).rating || 0)),
	}];
}

function attackValue(species, move, stat) {
	const power = move.basePower || (['seismictoss', 'nightshade'].includes(move.id) ? 75 : 0);
	/*
	 * Accuracy counts more than its share: a miss loses the turn as well as the damage.
	 * Scored as (0.5 + 0.5 * acc), Zap Cannon (120, 50%) tied Thunderbolt (90, 100%) and
	 * the RP's Build my team handed Elekid the one that misses half the time.
	 */
	const acc = Math.pow(move.accuracy === true ? 1 : (move.accuracy || 100) / 100, 1.5);
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
	// Half your HP (Steel Beam, Mind Blown) costs more than Flare Blitz's recoil; a
	// recharge turn (Rock Wrecker, Giga Impact) gives the opponent a free one.
	const drawback = AWKWARD.includes(move.id) ? 0.4 : move.id === 'foulplay' ? 0.6
		: move.mindBlownRecoil ? 0.6 : move.self && move.self.volatileStatus === 'mustrecharge' ? 0.5 : move.recoil ? 0.85 : 1;
	return power * acc * stab * fits * ours * drawback;
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
	const found = lookup(species) || evolvedSets(dex, species, moves);
	const base = found ? found.sets : synthesize(dex, species, moves);
	const own = Object.values(species.abilities).filter(Boolean);
	const oursAbility = own.find(a => dex.abilities.get(a).num < 0);
	// Our custom moves this species learns: signatures and the shared ones.
	const oursMoves = [...moves].map(id => dex.moves.get(id)).filter(m => m.exists && m.num < 0);

	return base.map(set => {
		const role = set.role === 'Tera Blast user' ? 'Setup Sweeper' : set.role;
		// Hidden Power's type is set by IVs these sets never pick, so it is left out.
		let pool = (set.movepool || []).filter(n => toID(n) !== 'terablast' && !toID(n).startsWith('hiddenpower') && !FAILS_ALONE.includes(toID(n))).map(n => dex.moves.get(n)).filter(m => m.exists && moves.has(m.id));
		// A hand-written set of ours is already what it should be, and a sketcher owns none of them.
		const handWritten = (found && found.fixed) || Object.values(VELVET).includes(found);
		/*
		 * The side this role attacks with: its own movepool's, not the species'. Mew's
		 * physical and special sets both drew every shared move it learns, so a Swords
		 * Dance set ran Hypno Whirl and a Leftovers wall ran Rime Cleaver.
		 */
		const count = { Physical: 0, Special: 0 };
		for (const m of pool) if (m.category !== 'Status') count[m.category]++;
		const stat = count.Physical === count.Special ? (species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special')
			: count.Physical > count.Special ? 'Physical' : 'Special';
		const fits = m => {
			if (m.category !== 'Status') return m.category === stat && species.types.includes(m.type);
			if (RECOVERY.includes(m.id)) return BULKY_ROLES.includes(role) || SUPPORT_ROLES.includes(role);
			if ([...HAZARDS, ...STATUS, ...UTILITY].includes(m.id)) return SUPPORT_ROLES.includes(role);
			if (SETUP.includes(m.id)) return SETUP_ROLES.includes(role);
			return false;
		};
		const shared = [];
		for (const m of handWritten || sketches(dex, species) ? [] : oursMoves) {
			if (pool.some(p => p.id === m.id)) continue;
			// Its own signature always joins; a move handed round the server joins where it fits.
			if (!m.velvetShared || m.flags.nosketch) pool.push(m);
			else if (fits(m)) shared.push(m);
		}
		// Two at most: a Pokemon that learns ten of them is still itself first.
		shared.sort((x, y) => attackValue(species, y, stat) - attackValue(species, x, stat));
		pool.push(...shared.slice(0, 2));
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
		// Whatever filled the pool above, a move that fails on its own stays out.
		pool = pool.filter(m => !FAILS_ALONE.includes(m.id));
		let abilities = (set.abilities || []).filter(a => own.includes(a));
		if (!abilities.length) abilities = own.slice();
		if (oursAbility) abilities = [oursAbility, ...abilities.filter(a => a !== oursAbility)];
		/*
		 * The priority attacks it learns, for a setup role that has none in its pool
		 * (pickMoves takes the strongest). Not for a hand-written set of ours, which
		 * says exactly what it runs.
		 */
		const priorityMoves = handWritten || !SETUP_ROLES.includes(role) ? [] : [...moves].map(id => dex.moves.get(id))
			.filter(m => m.exists && !m.isNonstandard && m.category !== 'Status' && m.priority > 0 &&
				!NOT_PRIORITY.includes(m.id) && !AWKWARD.includes(m.id) && !pool.some(p => p.id === m.id))
			.map(m => m.name);
		// A hand-written set (data/velvet/random-sets.js) may fix its nature, spread and item too.
		return { role, movepool: pool.map(m => m.name), abilities, teraTypes: set.teraTypes || species.types, nature: set.nature, evs: set.evs, item: set.item, core: set.core, synthetic: !found, priorityMoves };
	});
}

/**
 * How much a move adds to the attacks already chosen: over the eighteen types,
 * the sum of how much better it hits each than the best chosen attack does
 * (immune 0, resisted 0.5, neutral 1, super effective 2). Status moves add nothing.
 */
/** A move that lowers one of the user's own stats by two or more (Overheat, Draco Meteor, Leaf Storm). */
const hardDrop = m => !!(m.self && m.self.boosts && Object.values(m.self.boosts).some(v => v <= -2));

function coverageGain(dex, chosen, move) {
	if (move.category === 'Status') return 0;
	const hit = (type, target) => (!dex.getImmunity(type, target) ? 0 : 2 ** dex.getEffectiveness(type, target));
	const attacks = chosen.filter(c => c.category !== 'Status');
	let gain = 0;
	for (const target of dex.types.names().filter(t => t !== 'Stellar')) {
		const best = attacks.reduce((n, c) => Math.max(n, hit(c.type, target)), 0);
		gain += Math.max(0, hit(move.type, target) - Math.max(best, attacks.length ? 0 : 1));
	}
	return gain;
}

/*
 * How hard an attack hits a Pokemon of these types, for coverage: 0 immune, 0.25
 * to 4. Freeze-Dry is the one attack whose chart differs from its type's, and
 * an ability that makes the target immune (Levitate, Flash Fire, Water Absorb -
 * see src/team-logic.js) counts when the threat list says which one it runs.
 */
const ABILITY_IMMUNE = {
	levitate: 'Ground', eartheater: 'Ground', flashfire: 'Fire', wellbakedbody: 'Fire',
	waterabsorb: 'Water', stormdrain: 'Water', dryskin: 'Water', voltabsorb: 'Electric',
	lightningrod: 'Electric', motordrive: 'Electric', sapsipper: 'Grass', purifyingsalt: 'Ghost',
};
function hitOn(dex, move, types, ability = '') {
	if (ABILITY_IMMUNE[toID(ability)] === move.type) return 0;
	if (!dex.getImmunity(move.type, types)) return 0;
	let mult = 2 ** dex.getEffectiveness(move.type, types);
	if (move.id === 'freezedry' && types.includes('Water')) mult *= 4;
	return mult;
}

/** A threat list entry, whatever the caller handed in: { types, weight, ability }. */
function threatEntry(dex, threat) {
	const species = dex.species.get(threat.name || threat.species || '');
	const types = threat.types || (species.exists ? species.types : null);
	if (!types || !types.length) return null;
	return { types, weight: threat.weight > 0 ? threat.weight : 1, ability: threat.ability || '' };
}

/**
 * coverageGain, measured against the Pokemon that are actually out there.
 *
 * The eighteen-types count treats a Bug type and a Steel type as equally worth
 * hitting, whatever the format plays. What a coverage move is really for is the
 * common Pokemon that wall the set's STAB: Fire Blast on a Swords Dance
 * Garchomp is there for Corviknight and Skarmory (Earthquake cannot touch them,
 * Dragon is resisted), and if those are not common in the format it is a worse
 * slot than a stronger move or a priority attack. So each threat counts by its
 * usage (`weight`, any scale), and by its actual type pair and ability - a
 * Steel/Flying immune to Ground is not "a Steel type Earthquake hits".
 *
 * A threat the chosen attacks already hit neutrally or better gains a little
 * from a super effective move (a quarter); one they cannot hit well - the wall -
 * gains in full. Scaled to the eighteen-types count (a type's worth per share
 * of the list) so the two are interchangeable in the move picker.
 */
function threatGain(dex, chosen, move, threats) {
	if (move.category === 'Status' || !threats || !threats.length) return 0;
	const list = threats.map(t => threatEntry(dex, t)).filter(Boolean);
	const total = list.reduce((n, t) => n + t.weight, 0);
	if (!total) return 0;
	const attacks = chosen.filter(c => c.category !== 'Status');
	let gain = 0;
	for (const t of list) {
		const best = attacks.length ? attacks.reduce((n, c) => Math.max(n, hitOn(dex, c, t.types, t.ability)), 0) : 1;
		const mine = Math.min(2, hitOn(dex, move, t.types, t.ability));
		if (mine <= best) continue;
		gain += (mine - best) * (best < 1 ? 1 : 0.25) * t.weight / total;
	}
	return gain * 18;
}

/*
 * Priority on a setup sweeper.
 *
 * A Dragon Dance Dragonite that has Extreme Speed does not need to outspeed a
 * Scarf user after one boost: it moves first anyway, and at +1 an 80 base power
 * priority move is a finisher. Smogon's sets run it for that reason, and so do
 * Scizor's Bullet Punch, Kingambit's Sucker Punch and Azumarill's Aqua Jet. A
 * weak one (a non-STAB Ice Shard, 40) is not worth the slot, and moves that
 * only work on the first turn or against another priority move are not the
 * same thing. "Strong" is its value as attackValue reads it, Technician
 * included: 60 is a STAB 40 or anything 60 and up.
 */
const NOT_PRIORITY = ['fakeout', 'firstimpression', 'feint', 'upperhand'];
function priorityValue(species, move, stat, ability = '') {
	if (move.category === 'Status' || !(move.priority > 0) || NOT_PRIORITY.includes(move.id) || AWKWARD.includes(move.id)) return 0;
	if (stat && move.category !== stat) return 0;
	const technician = toID(ability) === 'technician' && move.basePower <= 60 ? 1.5 : 1;
	return attackValue(species, move) * technician;
}
const STRONG_PRIORITY = 60;

/*
 * Close Combat, Superpower, Draco Meteor, Make It Rain: an attack that lowers
 * the user's own Attack or defences. On a fast attacker that hits once and
 * leaves, that costs nothing - Close Combat is the best Fighting move there is
 * for it. On a wall that is meant to stay in and take hits it is a lowered
 * Defense it keeps until it switches, so a bulky role marks it down. A Speed
 * drop alone (Hammer Arm) does not count: a wall was not outspeeding anything.
 */
function selfDrop(m) {
	const boosts = (m.self && m.self.boosts) || (m.selfBoost && m.selfBoost.boosts) || null;
	return !!boosts && ['atk', 'def', 'spa', 'spd'].some(s => boosts[s] < 0);
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
function pickMoves(dex, species, set, rng = Math.random, { threats = null } = {}) {
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
		// Overheat, Draco Meteor: a real set (Smogon's, ours) that lists one means it; a set
		// built from the learnset has no one's judgement behind it, so the drop counts against it.
		let value = attackValue(species, m, stat) * (set.synthetic && hardDrop(m) ? 0.75 : 1);
		if (!defensive) return value;
		// Close Combat on a wall: see selfDrop.
		if (selfDrop(m)) value *= 0.5;
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
	// A fixed set's core is the set (Smeargle): take it, then one more from the rest.
	if (set.core) {
		for (const n of set.core) take(pool.find(m => m.id === toID(n)));
		while (chosen.length < 4) {
			const rest = pool.filter(m => !chosen.some(c => c.id === m.id));
			if (!rest.length) break;
			take(rest[Math.floor(rng() * rest.length)]);
		}
		if (chosen.length) return { moves: chosen.map(m => m.name), stat };
	}
	take(best(m => attack(m) && m.num < 0 && !m.velvetShared));
	// STAB - a real attack, not a pivot: Volt Switch taking this slot pushed Thunderbolt
	// out as "a second Electric move". Pivots have a slot of their own below.
	const stabAttack = m => attack(m) && species.types.includes(m.type) && !PIVOTS.includes(m.id);
	take(best(m => stabAttack(m) && !chosen.some(c => c.category !== 'Status' && c.type === m.type), wallValue) ||
		(chosen.length ? null : best(stabAttack, wallValue)) ||
		(chosen.length ? null : best(m => attack(m) && species.types.includes(m.type), wallValue)));
	// The role's job.
	if (SETUP_ROLES.includes(set.role)) {
		// Iron Defense is a Body Press user's attack boost: Zamazenta's Bulky Setup came out
		// Body Press, Rest and two coverage moves with nothing to press with.
		const pressSetup = m => m.id === 'irondefense' && chosen.some(c => c.id === 'bodypress');
		take(best(m => (stat === 'Physical' ? PHYSICAL_SETUP : SPECIAL_SETUP).includes(m.id) || (m.id === 'shellsmash') || pressSetup(m),
			m => (m.num < 0 ? 2 : 1) + (pressSetup(m) ? 2 : 0)));
		/*
		 * Then its strongest priority attack, if it has one worth the slot (see
		 * priorityValue) - from the role's movepool or, failing that, anything it
		 * learns: Showdown's Dragon Dance Dragonite pool does not always list
		 * Extreme Speed, and it is the best move that set can have.
		 */
		if (chosen.some(c => SETUP.includes(c.id))) {
			const ability = (set.abilities || [])[0] || '';
			const options = [...pool, ...(set.priorityMoves || []).map(n => dex.moves.get(n)).filter(m => m.exists)]
				.filter(m => !chosen.some(c => c.id === m.id))
				.map(m => [m, priorityValue(species, m, stat, ability)])
				.filter(([, v]) => v >= STRONG_PRIORITY)
				.sort((a, b) => b[1] - a[1]);
			if (options.length) take(options[0][0]);
		}
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
	// Only attacks count: Stealth Rock is Rock-type, and it was keeping Stone Edge out of Tyranitar's STAB slot.
	take(best(m => attack(m) && species.types.includes(m.type) && !chosen.some(c => c.category !== 'Status' && c.type === m.type), wallValue));
	/*
	 * Coverage is judged by what it adds, not by power alone. Focus Blast misses
	 * three times in ten, but on a Psychic type it is the one move that touches
	 * Steel and Dark - which is why Smogon runs it on Alakazam and Gengar. So a
	 * coverage move earns credit for every type the moves already chosen hit
	 * badly and it hits well, and the accuracy it pays is weighed against that.
	 */
	/*
	 * With a threat list (the format's usage, from src/teambuilder.js), coverage is
	 * what the move does to the common Pokemon that wall this set (threatGain); the
	 * type count stays on as a fifth of it, a tie-break between two moves that do
	 * the same to the threats. Without one - the RP bot's Build my team, a gym
	 * trainer - the type count is all there is.
	 */
	const gainOf = m => (threats && threats.length ? threatGain(dex, chosen, m, threats) + 0.2 * coverageGain(dex, chosen, m) : coverageGain(dex, chosen, m));
	const coverageValue = m => wallValue(m) * (1 + 0.15 * gainOf(m));
	/*
	 * On a wall, a self-dropping attack is the last resort for a coverage slot:
	 * Scizor's Bulky Support ran Close Combat whenever it was the only new type
	 * left, where Defog - what that set is for - was still in the pool.
	 */
	const wallJob = [...RECOVERY, ...HAZARDS, ...STATUS, ...UTILITY, ...PIVOTS];
	while (chosen.length < 4) {
		const newType = m => attack(m) && !chosen.some(c => c.category !== 'Status' && c.type === m.type);
		const next = (defensive && (best(m => newType(m) && !selfDrop(m), coverageValue) ||
			best(m => m.category === 'Status' && wallJob.includes(m.id), m => (m.num < 0 ? 2 : 1)))) ||
			best(newType, coverageValue) ||
			best(m => m.category === 'Status' && !(SETUP.includes(m.id) && chosen.some(c => SETUP.includes(c.id))) &&
				!(PHYSICAL_SETUP.includes(m.id) && stat === 'Special') && !(SPECIAL_SETUP.includes(m.id) && stat === 'Physical'), m => (m.num < 0 ? 2 : 1)) ||
			best(m => attack(m), wallValue);
		if (!next) break;
		take(next);
	}
	if (!chosen.length) chosen.push(dex.moves.get('tackle'));
	return { moves: chosen.map(m => m.name), stat };
}

/*
 * Items that do their job once and are gone (24 Sep 2026). Pinkacross's rule
 * for balance and anything bulkier: "no temporary items (Booster Energy,
 * Focus Sash, one-use berries)" - a long game outlasts them (Top 5 Team
 * Building Mistakes, part II). The assembler asks for none on such a team
 * (`oneUse: false`); they are then a last resort, still better than nothing.
 */
const ONE_USE = ['focussash', 'sitrusberry', 'lumberry', 'oranberry', 'boosterenergy', 'weaknesspolicy', 'whiteherb', 'airballoon'];

/**
 * An item that suits the role, from `allowed` when a bag limits the choice.
 * `options.oneUse` false: the team plays a long game, so a one-use item only
 * when nothing else fits.
 */
function itemFor(dex, species, set, moves, stat, allowed = null, { oneUse = true } = {}) {
	if (!oneUse) {
		return itemFor(dex, species, set, moves, stat, allowed ? new Set([...allowed].filter(id => !ONE_USE.includes(toID(id)))) : null, { oneUse: 'never' }) ||
			(allowed ? itemFor(dex, species, set, moves, stat, allowed) : '');
	}
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
		if (oneUse === 'never' && ONE_USE.includes(toID(name))) continue;
		if (!allowed || allowed.has(toID(name))) return name;
	}
	/*
	 * Nothing the role wants is in the bag: something harmless, never a Choice
	 * item on a set with status moves or a Life Orb on a wall. Not the trap items
	 * (24 Sep 2026): Shell Bell, Scope Lens, Wide Lens, Quick Claw and King's
	 * Rock do next to nothing in singles - "never Wide Lens, Scope Lens, Shell
	 * Bell" (Pinkacross's item traps, B10 in docs/research-pinkacross.md) - and
	 * the ladder builder refills an empty slot from the format's list anyway.
	 */
	const harmless = ['leftovers', 'sitrusberry', 'lumberry', 'rockyhelmet', 'heavydutyboots', 'expertbelt', 'blacksludge',
		'oranberry', 'muscleband', 'wiseglasses', 'lifeorb', 'focussash'];
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
function buildSet(dex, name, { role = null, rng = Math.random, level = 100, allowedItems = null, items = true, legal = null, threats = null } = {}) {
	const species = dex.species.get(name);
	const sets = roleSets(dex, name, legal);
	if (!sets.length) return null;
	const set = (role && sets.find(s => s.role === role)) || sets[Math.min(sets.length - 1, Math.floor(rng() * sets.length))];
	// `threats`: the format's common Pokemon ([{ name or types, weight, ability }]), when
	// the caller knows them - coverage is then judged against those (threatGain).
	const { moves, stat } = pickMoves(dex, species, set, rng, { threats });
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
	roleSets, buildSet, pickMoves, itemFor, spreadFor, learnable, attackValue, coverageGain,
	threatGain, priorityValue, selfDrop, hitOn, STRONG_PRIORITY, ONE_USE,
	SETUP, RECOVERY, HAZARDS, PIVOTS, STATUS, UTILITY, BULKY_ROLES, SETUP_ROLES, SUPPORT_ROLES,
};
