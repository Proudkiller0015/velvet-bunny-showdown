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
function pickMoves(dex, species, set, rng = Math.random, { threats = null, archetype = null } = {}) {
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
	/*
	 * Bulky offense and balance want two pivots or more ("pivots: at least 2
	 * users, except stall and HO" - Pinkacross, 18 Things; checklist rule 8), so
	 * there a Wallbreaker or Bulky Attacker takes its pivot move too, when its
	 * pool has one (24 Sep 2026). Hyper offense and stall keep the slot.
	 */
	if (['bulky offense', 'balance'].includes(archetype) && ['Wallbreaker', 'Bulky Attacker'].includes(set.role) &&
		chosen.some(c => c.category !== 'Status')) take(best(m => PIVOTS.includes(m.id) && m.category !== 'Status'));
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
function itemFor(dex, species, set, moves, stat, allowed = null, { oneUse = true, threats = null } = {}) {
	if (!oneUse) {
		return itemFor(dex, species, set, moves, stat, allowed ? new Set([...allowed].filter(id => !ONE_USE.includes(toID(id)))) : null, { oneUse: 'never', threats }) ||
			(allowed ? itemFor(dex, species, set, moves, stat, allowed, { threats }) : '');
	}
	const moveData = moves.map(n => dex.moves.get(n));
	const allAttacks = moveData.every(m => m.category !== 'Status');
	const real = moveData.filter(m => m.category !== 'Status' && (m.basePower || 0) >= 60);
	const mixed = real.filter(m => m.category === 'Physical').length >= 2 && real.filter(m => m.category === 'Special').length >= 2;
	const rockWeak = dex.getEffectiveness('Rock', species.types) >= 1 && dex.getImmunity('Rock', species.types);
	const nfe = species.nfe;
	const wants = [];
	/*
	 * Self-status abilities want their orb (24 Sep 2026): Guts, Flare Boost,
	 * Toxic Boost and Poison Heal are switched on deliberately with a Flame or
	 * Toxic Orb (Fildrong, D5 in docs/research-fildrong.md; Pinkacross does not
	 * disagree). Toxic for Poison Heal and Toxic Boost; Flame for Flare Boost
	 * and for Guts unless the holder is a Fire type (then Toxic, unless it
	 * cannot be poisoned either). Only when the set attacks.
	 */
	const ability = toID(set.ability || (set.abilities || [])[0]);
	const attacksAtAll = moveData.some(m => m.category !== 'Status');
	const burnable = !species.types.includes('Fire');
	const poisonable = !species.types.includes('Poison') && !species.types.includes('Steel');
	if (attacksAtAll || ability === 'poisonheal') {
		if (['poisonheal', 'toxicboost'].includes(ability) && poisonable) wants.push('Toxic Orb');
		else if (ability === 'flareboost' && burnable) wants.push('Flame Orb');
		else if (ability === 'guts') wants.push(burnable ? 'Flame Orb' : poisonable ? 'Toxic Orb' : null);
	}
	if (nfe) wants.push('Eviolite');
	if (rockWeak) wants.push('Heavy-Duty Boots');
	// Trick is for handing over a Choice item.
	if (moveData.some(m => m.id === 'trick' || m.id === 'switcheroo')) wants.unshift(stat === 'Physical' ? 'Choice Band' : 'Choice Scarf');
	/*
	 * An easy click (24 Sep 2026): a Band or Specs user is locked into one move,
	 * so its best STAB has to be one most of the format takes at least neutral
	 * damage from, or the set needs a pivot to leave on - "Specs Shadow Ball,
	 * which nothing common is immune to, versus Band Iron Leaves, where every
	 * move needs a read" (Pinkacross, How to Use Choice Items; R-T12). Judged
	 * against the format's threats when known: 70% of their usage.
	 */
	const easyClick = !threats || !threats.length || moveData.some(m => PIVOTS.includes(m.id)) || clickShare(dex, species, moveData, threats) >= 0.7;
	switch (set.role) {
	case 'AV Pivot': wants.push('Assault Vest', 'Leftovers'); break;
	/*
	 * A mixed attacker takes Life Orb, not a Choice item (24 Sep 2026): Band or
	 * Specs boosts half its moves, and "Life Orb only on ... mixed attackers"
	 * is one of Pinkacross's three right homes for it (B10 in
	 * docs/research-pinkacross.md). Mixed is two real attacks of each side.
	 */
	/*
	 * Scarf only where the speed changes something (24 Sep 2026): "a Choice
	 * Scarf trades power for speed; it pays only when the extra speed changes
	 * what the Pokemon outspeeds" (Smogon's SV OU speed tiers and HO guide; I1
	 * in docs/research-teambuilding.md). With the format's threats known, a
	 * fast attacker that already outruns them, or would still not, takes Band
	 * or Specs instead. Without a threat list, as before.
	 */
	case 'Fast Attacker': {
		const scarf = allAttacks && !mixed && (!threats || !threats.length || scarfPays(dex, species, threats));
		const power = stat === 'Physical' ? 'Choice Band' : 'Choice Specs';
		if (allAttacks && !mixed) wants.push(...(scarf ? ['Choice Scarf', power] : easyClick ? [power, 'Choice Scarf'] : ['Life Orb', power]));
		else wants.push('Life Orb', 'Leftovers');
		break;
	}
	case 'Wallbreaker': wants.push(allAttacks && !mixed && easyClick ? (stat === 'Physical' ? 'Choice Band' : 'Choice Specs') : 'Life Orb', 'Life Orb'); break;
	case 'Setup Sweeper': case 'Fast Bulky Setup': case 'Tera Blast user': wants.push('Life Orb', 'Leftovers'); break;
	case 'Fast Support': wants.push('Focus Sash', 'Leftovers'); break;
	default: wants.push('Leftovers', 'Rocky Helmet', 'Sitrus Berry');
	}
	for (const name of wants) {
		if (!name) continue;
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

/*
 * Set sanity (24 Sep 2026): the checks a strong player makes on a single set
 * before looking at the team, and the smallest repair for each.
 *
 * Every builder has produced a set that fails one of these at a glance -
 * the Smogon draw handed Regigigas Choice Specs with Protect and Substitute
 * (the item was drawn from a list with no look at the moves), Lilligant-Hisui
 * a Wide Lens, and Pangoro a set of Twilight Exit and Shuffle Jab. The rules
 * are the item traps and set hygiene of Pinkacross (B7, B10 in
 * docs/research-pinkacross.md: "never Wide Lens, Scope Lens, Shell Bell";
 * Life Orb on mixed or fast attackers, Band/Specs on all-out ones) and the
 * Smogon basics every guide opens with: a Choice item locks the holder into
 * one move, so a status move on it is a dead slot, and Assault Vest forbids
 * status moves outright; a set needs its STAB and enough moves that do
 * something. Written from the move and item data, never from a species list,
 * so this server's own moves and abilities are read the same way.
 */
const CHOICE_ITEMS = ['choiceband', 'choicespecs', 'choicescarf'];
// Trick and Switcheroo hand the Choice item over: the reason a Choice Scarf Trick set exists. Healing Wish,
// Lunar Dance and Memento end the user, so the lock never matters (Scarf Healing Wish is a standard set).
const CHOICE_STATUS_OK = ['trick', 'switcheroo', 'healingwish', 'lunardance', 'memento'];
// Items that do next to nothing in singles (Pinkacross's item traps), or only hurt the holder.
const TRAP_ITEMS = ['widelens', 'scopelens', 'shellbell', 'quickclaw', 'kingsrock', 'razorclaw', 'razorfang', 'blunderpolicy',
	'laggingtail', 'ironball', 'ringtarget', 'stickybarb', 'fullincense', 'laxincense', 'brightpowder', 'zoomlens', 'metronome',
	'machobrace', 'powerweight', 'powerbracer', 'powerbelt', 'powerlens', 'powerband', 'poweranklet', 'destinyknot',
	'smokeball', 'soothebell', 'luckyegg', 'amuletcoin', 'cleansetag', 'everstone', 'expshare', 'floatstone'];
// An orb that burns or poisons its holder is a trap unless the set turns the status into power or healing.
const ORB_USERS = ['guts', 'poisonheal', 'toxicboost', 'flareboost', 'marvelscale', 'quickfeet', 'magicguard'];
// The -ate abilities turn Normal moves into their own type: Pixilate Hyper Voice is Sylveon's STAB.
const ATE = { pixilate: 'Fairy', aerilate: 'Flying', refrigerate: 'Ice', galvanize: 'Electric', normalize: 'Normal' };
// Status moves that do nothing worth a turn in a real game: a stat drop on the foe, a turn spent on nothing.
const NOT_USEFUL = ['growl', 'tailwhip', 'leer', 'sandattack', 'smokescreen', 'kinesis', 'flash', 'harden', 'withdraw', 'defensecurl',
	'splash', 'celebrate', 'holdhands', 'charge', 'focusenergy', 'laserfocus', 'minimize', 'doubleteam', 'sweetscent', 'stringshot',
	'scaryface', 'cottonspore', 'charm', 'featherdance', 'playnice', 'confide', 'babydolleyes', 'nobleroar', 'tearfullook',
	'screech', 'metalsound', 'faketears', 'captivate', 'lockon', 'mindreader', 'foresight', 'odorsleuth', 'miracleeye', 'teeterdance',
	'supersonic', 'confuseray', 'sweetkiss', 'flatter', 'swagger', 'attract', 'mimic', 'conversion', 'conversion2', 'camouflage',
	'magiccoat', 'snatch', 'imprison', 'grudge', 'spite', 'endure', 'powertrick', 'powersplit', 'guardsplit',
	'powerswap', 'guardswap', 'speedswap', 'heartswap', 'skillswap', 'roleplay', 'entrainment', 'simplebeam', 'worryseed', 'gastroacid',
	'soak', 'magicpowder', 'forestscurse', 'trickortreat', 'electrify', 'iondeluge', 'powder', 'embargo', 'healblock', 'telekinesis',
	'magnetrise', 'ingrain', 'aquaring', 'lockon', 'stockpile', 'swallow', 'spitup', 'acupressure', 'helpinghand', 'followme', 'ragepowder',
	'allyswitch', 'aromaticmist', 'coaching', 'decorate', 'instruct', 'afteryou', 'quash', 'wideguard', 'quickguard', 'matblock', 'craftyshield'];
// In doubles these are the job itself: redirection, ally support, spread protection.
const DOUBLES_USEFUL = ['helpinghand', 'followme', 'ragepowder', 'allyswitch', 'coaching', 'decorate', 'instruct', 'afteryou',
	'wideguard', 'quickguard', 'icywind', 'electroweb', 'snarl'];

/** Whether a move does something a strong player would spend a slot on. */
// Charge moves a real set runs: the charge turn is the point (Meteor Beam raises SpA) or protects (Phantom Force).
const CHARGE_OK = ['meteorbeam', 'electroshot', 'phantomforce', 'shadowforce', 'geomancy'];
function usefulMove(dex, move, options = {}) {
	const { gameType = 'singles' } = options;
	if (!move || !move.exists) return false;
	if (move.category !== 'Status') {
		// A charge turn with no Power Herb or weather to skip it is a free turn for the foe (Fly, Dig, Sky Attack).
		if (move.flags && move.flags.charge && !CHARGE_OK.includes(move.id) && !options.skipsCharge) return false;
		return (move.basePower || 0) > 0 || !!move.basePowerCallback || !!move.damage || !!move.damageCallback || !!move.ohko;
	}
	if (gameType !== 'singles' && DOUBLES_USEFUL.includes(move.id)) return true;
	if (NOT_USEFUL.includes(move.id)) return false;
	// This server's own moves were each written with a job in mind (Twilight Exit sets Trick Room and pivots).
	if (move.num < 0) return true;
	if (move.selfSwitch || move.heal || move.status || move.sideCondition || move.weather || move.terrain || move.pseudoWeather ||
		move.slotCondition || move.forceSwitch || move.stallingMove) return true;
	const boosts = move.boosts || (move.self && move.self.boosts) || null;
	if (boosts && (move.target === 'self' || move.target === 'adjacentAllyOrSelf' || move.target === 'allySide') &&
		Object.values(boosts).some(v => v > 0)) return true;
	if (move.volatileStatus && !['confusion', 'attract', 'focusenergy', 'charge', 'minimize', 'lockon'].includes(move.volatileStatus)) return true;
	return [...RECOVERY, ...HAZARDS, ...PIVOTS, ...STATUS, ...UTILITY, ...SETUP, 'haze', 'clearsmog', 'painsplit', 'bellydrum',
		'sleeptalk', 'trickroom', 'tailwind', 'reflect', 'lightscreen', 'auroraveil', 'healingwish', 'lunardance', 'memento',
		'perishsong', 'meanlook', 'block', 'spiderweb', 'destinybond', 'psychup', 'transform', 'batonpass', 'revivalblessing',
		'shedtail', 'defog', 'courtchange', 'tidyup', 'whirlwind', 'roar', 'healbell', 'aromatherapy', 'lifedew'].includes(move.id);
}

/** Whether an attack is a STAB for this set, the -ate abilities and Protean included. */
function isStab(species, move, ability = '') {
	if (move.category === 'Status' || move.id === 'terablast') return false;
	if (!((move.basePower || 0) > 0 || move.basePowerCallback || move.damage || move.damageCallback)) return false;
	const ab = toID(ability);
	if (['protean', 'libero'].includes(ab)) return true;
	const type = ATE[ab] && move.type === 'Normal' ? ATE[ab] : move.type;
	return species.types.includes(type);
}

/**
 * The role a set plays, read off its moves and item, for a set that did not
 * come with one (a Smogon analysis, usage statistics, a factory set). The
 * names are role-sets.js's own, so itemFor() can be asked about any set.
 */
function inferRole(dex, set) {
	if (set.role) return set.role;
	const species = dex.species.get(set.species);
	const moves = (set.moves || []).map(n => dex.moves.get(n)).filter(m => m.exists);
	const attacks = moves.filter(m => m.category !== 'Status').length;
	const b = species.baseStats;
	const bulk = b.hp + b.def + b.spd;
	if (moves.some(m => SETUP.includes(m.id))) return bulk >= 280 && b.spe < 90 ? 'Bulky Setup' : 'Setup Sweeper';
	const heals = moves.some(m => RECOVERY.includes(m.id)) || toID(set.ability) === 'regenerator';
	const support = moves.filter(m => [...HAZARDS, ...STATUS, ...UTILITY].includes(m.id) && m.category === 'Status').length;
	if (attacks <= 2 && (heals || support >= 1)) return bulk >= 250 ? 'Bulky Support' : 'Fast Support';
	if (attacks >= 3 && moves.some(m => PIVOTS.includes(m.id)) && bulk >= 280 && b.spe < 90) return 'AV Pivot';
	if (attacks >= 3) return b.spe >= 95 ? 'Fast Attacker' : bulk >= 300 ? 'Bulky Attacker' : 'Wallbreaker';
	return bulk >= 280 ? 'Bulky Attacker' : 'Fast Attacker';
}

/** The side a set attacks from, 'Physical' or 'Special', by its attacks (Body Press physical), else its stats. */
function sideOf(dex, set) {
	const species = dex.species.get(set.species);
	let physical = 0, special = 0;
	for (const n of set.moves || []) {
		const m = dex.moves.get(n);
		if (!m.exists || m.category === 'Status') continue;
		if (m.category === 'Physical') physical++; else special++;
	}
	if (physical === special) return species.baseStats.atk >= species.baseStats.spa ? 'Physical' : 'Special';
	return physical > special ? 'Physical' : 'Special';
}

/**
 * What is wrong with one set: [{ code, text }], empty when a strong player
 * would accept it. Codes: choice-status, av-status, trap-item, wrong-side
 * (Band on a special set, Specs on a physical one), lo-passive (Life Orb with
 * at most one attack), thin (fewer than three moves that do something),
 * dead-move (a move that does nothing worth its slot), no-stab, dup-move.
 */
function setProblems(dex, set, { gameType = 'singles' } = {}) {
	const out = [];
	const species = dex.species.get(set.species);
	if (!species.exists) return out;
	const moves = (set.moves || []).map(n => dex.moves.get(n));
	const item = toID(set.item);
	const status = moves.filter(m => m.exists && m.category === 'Status');
	const attacks = moves.filter(m => m.exists && m.category !== 'Status' && usefulMove(dex, m));
	if (CHOICE_ITEMS.includes(item)) {
		// With Trick on the set the item is meant to be handed over, and what follows is free (Scarf Trick Recover Gholdengo).
		const tricks = status.some(m => ['trick', 'switcheroo'].includes(m.id));
		const bad = tricks ? [] : status.filter(m => !CHOICE_STATUS_OK.includes(m.id));
		if (bad.length) out.push({ code: 'choice-status', text: `${set.item} with ${bad.map(m => m.name).join(', ')}` });
		// Band on a special set (or Specs on a physical one) boosts nothing it clicks.
		const physical = attacks.filter(m => m.category === 'Physical').length;
		const special = attacks.length - physical;
		if ((item === 'choiceband' && special > physical) || (item === 'choicespecs' && physical > special)) {
			out.push({ code: 'wrong-side', text: `${set.item} on a ${item === 'choiceband' ? 'special' : 'physical'} set` });
		}
	}
	if (item === 'assaultvest' && status.length) out.push({ code: 'av-status', text: `Assault Vest with ${status.map(m => m.name).join(', ')}` });
	if (TRAP_ITEMS.includes(item)) out.push({ code: 'trap-item', text: `${set.item} does next to nothing` });
	if (['flameorb', 'toxicorb'].includes(item) && !ORB_USERS.includes(toID(set.ability)) &&
		!moves.some(m => ['facade', 'psychoshift', 'fling'].includes(m.id))) {
		out.push({ code: 'trap-item', text: `${set.item} with nothing that uses the status` });
	}
	if (item === 'lifeorb' && attacks.length <= 1) out.push({ code: 'lo-passive', text: 'Life Orb on a set with at most one attack' });
	// Power Herb, or the weather that skips the charge (Drought for Solar Beam), makes a charge move a real attack.
	const skipsCharge = item === 'powerherb' || ['drought', 'orichalcumpulse', 'desolateland', 'drizzle', 'primordialsea'].includes(toID(set.ability));
	const useful = moves.filter(m => usefulMove(dex, m, { gameType, skipsCharge }));
	if (useful.length < 3) {
		out.push({ code: 'thin', text: `only ${useful.length} useful move${useful.length === 1 ? '' : 's'} (${moves.map(m => m.name).join(', ')})` });
	} else if (useful.length < moves.length) {
		// A slot that does nothing (Swagger, Focus Energy, an unskipped Fly) when the set could hold a real move.
		out.push({ code: 'dead-move', text: `${moves.filter(m => !useful.includes(m)).map(m => m.name).join(', ')} does nothing worth a slot` });
	}
	/*
	 * A set's main attack is its STAB, with the exceptions every analysis has:
	 * fixed damage (Seismic Toss Blissey), Body Press on a Defense wall
	 * (Corviknight), Facade on a Toxic Orb or Guts set (Gliscor), Foul Play.
	 */
	const main = m => m.exists && (isStab(species, m, set.ability) || !!m.damage || ['bodypress', 'foulplay'].includes(m.id) ||
		(m.id === 'facade' && (['flameorb', 'toxicorb'].includes(item) || ORB_USERS.includes(toID(set.ability)))));
	if (!moves.some(main)) out.push({ code: 'no-stab', text: 'no STAB attack' });
	if (new Set(moves.map(m => m.id)).size !== moves.length) out.push({ code: 'dup-move', text: 'the same move twice' });
	return out;
}

/*
 * The smallest change that makes a set sane, in order: the item first when
 * the moves say what the set is (a support set with Choice Specs keeps its
 * support moves and gets Leftovers), the moves when the set is an attacker
 * (a Choice Band set with one stray Protect swaps it for its best missing
 * attack), then STAB, then enough useful moves.
 *
 * options: rng, threats (the format's common Pokemon, for coverage), allowedItems
 * (Set of ids; null any), oneUse (see itemFor), canLearn(moveName) -> bool (the
 * format's own learn check, from the ladder builder's validator), avoid (Set of
 * move ids the validator already refused), legal (the moves a trainer knows),
 * gameType, items (false: never touch the item), noStab (skip the STAB rule).
 */
function repairSet(dex, set, options = {}) {
	const { threats = null, allowedItems = null, oneUse = true, canLearn = null, avoid = null, legal = null, gameType = 'singles', items = true } = options;
	const species = dex.species.get(set.species);
	if (!species.exists || !Array.isArray(set.moves)) return set;
	const pool = legal ? new Set([...legal].map(toID)) : learnable(dex, species);
	const learns = m => m.exists && pool.has(m.id) && !m.isZ && !m.isMax && m.isNonstandard !== 'Unobtainable' && m.isNonstandard !== 'LGPE' &&
		!(avoid && avoid.has(m.id)) && !m.id.startsWith('hiddenpower') && !FAILS_ALONE.includes(m.id) && (!canLearn || canLearn(m.name));
	let candidates = null;
	const options_ = () => candidates || (candidates = [...pool].map(id => dex.moves.get(id)).filter(learns));
	const ability = set.ability || '';
	const itemId = () => toID(set.item);
	const skips = () => itemId() === 'powerherb' || ['drought', 'orichalcumpulse', 'desolateland', 'drizzle', 'primordialsea'].includes(toID(ability));
	const has = id => set.moves.some(n => toID(n) === id);
	const bestAttack = (filter) => {
		const side = sideOf(dex, set);
		const chosen = set.moves.map(n => dex.moves.get(n));
		const list = options_().filter(m => m.category !== 'Status' && usefulMove(dex, m) && !has(m.id) && !AWKWARD.includes(m.id) && filter(m));
		if (!list.length) return null;
		const value = m => attackValue(species, m, side) * (isStab(species, m, ability) ? 1.2 : 1) *
			(1 + 0.15 * (threats && threats.length ? threatGain(dex, chosen, m, threats) + 0.2 * coverageGain(dex, chosen, m) : coverageGain(dex, chosen, m)));
		return list.sort((a, b) => value(b) - value(a))[0];
	};
	// Which move a set misses least: a status move that does nothing, then a duplicate type, then the weakest attack.
	const weakest = (keep = () => false) => {
		let worst = -1, worstValue = Infinity;
		set.moves.forEach((n, i) => {
			const m = dex.moves.get(n);
			if (keep(m)) return;
			let v;
			if (!usefulMove(dex, m, { gameType, skipsCharge: skips() })) v = -100;
			else if (m.category === 'Status') v = 60;
			else {
				const sameType = set.moves.filter(x => dex.moves.get(x).category !== 'Status' && dex.moves.get(x).type === m.type).length;
				v = attackValue(species, m, sideOf(dex, set)) * (sameType > 1 ? 0.5 : 1) * (isStab(species, m, ability) && sameType === 1 ? 3 : 1);
			}
			if (v < worstValue) { worstValue = v; worst = i; }
		});
		return worst;
	};
	const reItem = () => {
		if (!items) return;
		const role = { role: inferRole(dex, set), ability: set.ability };
		const next = itemFor(dex, species, role, set.moves, sideOf(dex, set), allowedItems, { oneUse, threats });
		set.item = next || '';
	};

	// Duplicates first: they hide how many moves the set really has.
	set.moves = set.moves.filter((n, i) => set.moves.findIndex(x => toID(x) === toID(n)) === i);

	/*
	 * Moves before items: a two-move set is fixed by giving it moves, after
	 * which the item that suits it can be read off them (a Life Orb on a set
	 * with one attack stops being wrong once it has four).
	 */
	for (let round = 0; round < 4; round++) {
		const problems = setProblems(dex, set, { gameType });
		if (!problems.length) break;
		const codes = problems.map(p => p.code);
		if (codes.includes('no-stab') && !options.noStab) {
			const stab = bestAttack(m => isStab(species, m, ability));
			if (stab) {
				if (set.moves.length < 4) set.moves.push(stab.name);
				else {
					// The weakest attack or a move that does nothing; never the set's setup, recovery, hazard or pivot.
					let i = weakest(m => m.category === 'Status' && usefulMove(dex, m, { gameType }));
					// Four support moves and no attack at all: a passive set (Pinkacross's #1 mistake). The least
					// central status move goes - never recovery, hazards, removal, a pivot or setup.
					if (i < 0) i = weakest(m => [...RECOVERY, ...HAZARDS, ...PIVOTS, ...SETUP, 'defog', 'rapidspin', 'mortalspin', 'courtchange'].includes(m.id));
					if (i >= 0) set.moves[i] = stab.name;
				}
			}
		}
		if (codes.includes('thin') || codes.includes('dead-move') || set.moves.length < 4) {
			// Fill free slots, then replace moves that do nothing.
			while (set.moves.length < 4) {
				const next = bestAttack(() => true);
				if (!next) break;
				set.moves.push(next.name);
			}
			for (let i = 0; i < set.moves.length; i++) {
				if (usefulMove(dex, dex.moves.get(set.moves[i]), { gameType, skipsCharge: skips() })) continue;
				const next = bestAttack(() => true);
				if (next) set.moves[i] = next.name;
			}
		}
		// Item against moves: fix whichever is cheaper to change.
		if (codes.includes('choice-status') || codes.includes('av-status')) {
			const isChoice = CHOICE_ITEMS.includes(itemId());
			const tricks = isChoice && set.moves.some(n => ['trick', 'switcheroo'].includes(toID(n)));
			const bad = tricks ? [] : set.moves.filter(n => dex.moves.get(n).category === 'Status' && !(isChoice && CHOICE_STATUS_OK.includes(toID(n))));
			const attacks = set.moves.length - set.moves.filter(n => dex.moves.get(n).category === 'Status').length;
			// A set that is mostly attacks keeps its item and loses the stray status move; a support set keeps its moves.
			if ((attacks >= 3 && bad.length <= 1) || !items) {
				for (const n of bad) {
					const next = bestAttack(() => true);
					const i = set.moves.indexOf(n);
					if (next) set.moves[i] = next.name; else if (!items) set.moves.splice(i, 1);
				}
				if (items && setProblems(dex, set, { gameType }).some(p => p.code === 'choice-status' || p.code === 'av-status')) reItem();
			} else reItem();
			continue;
		}
		if (items && problems.some(p => ['trap-item', 'wrong-side', 'lo-passive'].includes(p.code))) reItem();
	}
	return set;
}

/*
 * How well a role suits an archetype, 0 to 2 (1 neutral), for choosing between
 * a species' roles when the team's archetype is known (24 Sep 2026). The
 * archetype quotas of docs/teambuilding-checklist.md section 2 and
 * Pinkacross's pacing rule (B8: setup and win-or-fail-fast sets for short
 * games, walls and pivots for long ones).
 */
const ARCHETYPE_ROLES = {
	'hyper offense': { 'Setup Sweeper': 2, 'Fast Bulky Setup': 1.8, 'Fast Attacker': 1.5, Wallbreaker: 1.5, 'Fast Support': 1.2,
		'Bulky Setup': 1, 'Bulky Attacker': 0.6, 'AV Pivot': 0.6, 'Bulky Support': 0.3 },
	'bulky offense': { 'Setup Sweeper': 1.2, 'Fast Bulky Setup': 1.3, 'Fast Attacker': 1.3, Wallbreaker: 1.6, 'Fast Support': 1,
		'Bulky Setup': 1.2, 'Bulky Attacker': 1.3, 'AV Pivot': 1.4, 'Bulky Support': 0.8 },
	balance: { 'Setup Sweeper': 0.8, 'Fast Bulky Setup': 0.9, 'Fast Attacker': 1.1, Wallbreaker: 1.6, 'Fast Support': 0.8,
		'Bulky Setup': 1.1, 'Bulky Attacker': 1.3, 'AV Pivot': 1.5, 'Bulky Support': 1.6 },
	stall: { 'Setup Sweeper': 0.4, 'Fast Bulky Setup': 0.6, 'Fast Attacker': 0.5, Wallbreaker: 0.6, 'Fast Support': 0.6,
		'Bulky Setup': 1.4, 'Bulky Attacker': 1, 'AV Pivot': 0.9, 'Bulky Support': 2 },
};
function archetypeFit(role, archetype) {
	const table = ARCHETYPE_ROLES[archetype];
	return table && table[role] !== undefined ? table[role] : 1;
}

/*
 * Whether a Choice Scarf moves this Pokemon past enough of the format's
 * threats to be worth its power: the usage share of threats (unboosted, or at
 * +1 for a setup sweeper) that are faster than it at top Speed but slower
 * than it scarfed. A quarter of the list is the bar.
 */
/** The usage share of threats the set's best STAB hits at least neutrally (ability immunities counted). */
function clickShare(dex, species, moveData, threats) {
	const stabs = moveData.filter(m => m.category !== 'Status' && (m.basePower || 0) >= 60 && species.types.includes(m.type));
	if (!stabs.length) return 1;
	let total = 0;
	const byMove = stabs.map(() => 0);
	for (const t of threats) {
		const entry = threatEntry(dex, t);
		if (!entry) continue;
		total += entry.weight;
		stabs.forEach((m, i) => { if (hitOn(dex, m, entry.types, entry.ability) >= 1) byMove[i] += entry.weight; });
	}
	return total ? Math.max(...byMove) / total : 1;
}

function scarfPays(dex, species, threats) {
	const top = base => Math.floor((2 * base + 31 + 63 + 5) * 1.1);
	const mine = top(species.baseStats.spe);
	let gain = 0, total = 0;
	for (const t of threats) {
		const sp = dex.species.get(t.name || t.species || '');
		const base = t.speed || (sp.exists ? sp.baseStats.spe : 0);
		if (!base) continue;
		const w = t.weight > 0 ? t.weight : 1;
		total += w;
		const theirs = top(base);
		if ((theirs >= mine && theirs < mine * 1.5) || (theirs * 1.5 >= mine && theirs * 1.5 < mine * 1.5)) gain += w;
	}
	return !total || gain / total >= 0.25;
}

/*
 * IVs a set does not want (24 Sep 2026): 0 Attack on a set with no physical
 * attack - Foul Play and confusion hit it with Attack, and Smogon's default is
 * 0 for such sets (E4 in docs/research-teambuilding.md) - and 0 Speed on a
 * slow Trick Room or Gyro Ball user, which wants to move last (E5). Body
 * Press and Foul Play do not use the user's own Attack. Only from Gen 3,
 * never with Hidden Power (its type is its IVs). Returns undefined when
 * nothing changes, so a set with no IVs stays one.
 */
function ivsFor(dex, species, moves) {
	const data = moves.map(n => dex.moves.get(n)).filter(m => m.exists);
	if (dex.gen < 3 || data.some(m => m.id.startsWith('hiddenpower'))) return undefined;
	const ivs = {};
	if (!data.some(m => m.category === 'Physical' && !['bodypress', 'foulplay'].includes(m.id))) ivs.atk = 0;
	if (species.baseStats.spe <= 60 && data.some(m => ['trickroom', 'gyroball'].includes(m.id))) ivs.spe = 0;
	return Object.keys(ivs).length ? ivs : undefined;
}

/** Nature and EVs for a role and an attacking side. */
function spreadFor(species, set, stat, moves = null) {
	const b = species.baseStats;
	// A slow Trick Room or Gyro Ball user moves last on purpose (see ivsFor): a -Speed nature, no Speed EVs.
	if (moves && b.spe <= 60 && moves.some(n => ['trickroom', 'gyroball'].includes(toID(n)))) {
		const bulky = BULKY_ROLES.includes(set.role) || SUPPORT_ROLES.includes(set.role);
		return {
			nature: stat === 'Physical' ? (bulky ? 'Relaxed' : 'Brave') : (bulky ? 'Sassy' : 'Quiet'),
			evs: bulky ? { hp: 252, def: b.def > b.spd ? 252 : 4, spd: b.def > b.spd ? 4 : 252 } : stat === 'Physical' ? { hp: 252, atk: 252, def: 4 } : { hp: 252, spa: 252, def: 4 },
		};
	}
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
function buildSet(dex, name, { role = null, rng = Math.random, level = 100, allowedItems = null, items = true, legal = null, threats = null, archetype = null } = {}) {
	const species = dex.species.get(name);
	const sets = roleSets(dex, name, legal);
	if (!sets.length) return null;
	/*
	 * `archetype` (optional, 24 Sep 2026): the team's plan - 'hyper offense',
	 * 'bulky offense', 'balance' or 'stall'. With no role asked for, the role is
	 * drawn weighted by archetypeFit(), so a hyper offense team gets the Swords
	 * Dance set and a balance team the Choice or pivot one; the item skips
	 * one-use items on balance and stall (see ONE_USE); and pickMoves gives an
	 * attacker on bulky offense or balance its pivot move when it has one.
	 */
	const drawn = archetype && !role && sets.length > 1
		? weighted(rng, sets.map(s => [s, archetypeFit(s.role, archetype)]))
		: null;
	const set = (role && sets.find(s => s.role === role)) || drawn || sets[Math.min(sets.length - 1, Math.floor(rng() * sets.length))];
	// `threats`: the format's common Pokemon ([{ name or types, weight, ability }]), when
	// the caller knows them - coverage is then judged against those (threatGain).
	const { moves, stat } = pickMoves(dex, species, set, rng, { threats, archetype });
	const spread = spreadFor(species, set, stat, moves);
	const nature = set.nature || spread.nature;
	const evs = set.evs || spread.evs;
	const ivs = ivsFor(dex, species, moves);
	return {
		species: species.name,
		role: set.role,
		ability: set.abilities[0] || Object.values(species.abilities)[0] || '',
		item: !items ? '' : set.item && (!allowedItems || allowedItems.has(toID(set.item))) ? set.item
			: itemFor(dex, species, set, moves, stat, allowedItems, { oneUse: !['balance', 'stall'].includes(archetype), threats }),
		moves,
		nature,
		evs,
		level,
		teraType: (set.teraTypes || species.types)[0],
		...(ivs ? { ivs } : {}),
	};
}

module.exports = {
	roleSets, buildSet, pickMoves, itemFor, spreadFor, learnable, attackValue, coverageGain,
	threatGain, priorityValue, selfDrop, hitOn, STRONG_PRIORITY, ONE_USE,
	setProblems, repairSet, usefulMove, isStab, inferRole, sideOf, archetypeFit, ivsFor, scarfPays, CHOICE_ITEMS, TRAP_ITEMS,
	SETUP, RECOVERY, HAZARDS, PIVOTS, STATUS, UTILITY, BULKY_ROLES, SETUP_ROLES, SUPPORT_ROLES,
};
