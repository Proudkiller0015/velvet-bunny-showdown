'use strict';
/**
 * Funerfly, from Lobotomy Corporation's "The Funeral of the Dead Butterflies"
 * (T-01-68, HE risk). A humanoid in a suit with a coffin full of butterflies, whose
 * harm is to the mind - WHITE damage - so its attacks are special. A Collab Pokemon:
 * see collab.js for the tier.
 *
 *   Funerfly          Bug/Ghost   95 / 65 / 100 / 115 / 110 / 85   570   contained
 *   Funerfly-Breach   Bug/Ghost   95 / 75 / 85 / 150 / 95 / 120    620   breached
 *
 *   Qliphoth Counter   starts at 2; -1 when a super-effective move hits it, -1 when
 *                      a teammate faints beside it (doubles: in singles the teammate
 *                      that faints is the one out, never beside it). At 0 it breaches,
 *                      for good: Funerfly-Breach until it faints, switches included.
 *                      Also Technician: moves of 60 power or less are 1.5x.
 *   Solemn Lament      Ghost, special, 60 x2 (90 x2 with Technician), 100%. Each hit:
 *                      20% to lower Sp. Def by 1.
 *   Butterfly Procession  Bug, special, 120, 100%. Traps for 4 turns, 1/8 a turn.
 *   Last Rites         Ghost, special Last Respects: 50 +50 for each fainted Pokemon on
 *                      the user's side, 100%.
 */

const ID = 'funerfly';
const BREACH = 'funerflybreach';
const ABILITY = 'Qliphoth Counter';
const COUNTER_START = 2;
const BREACH_LINE = 'The funeral procession begins.';

const DEX_ENTRY = "Where does one go when they die? It carries a coffin full of butterflies for those who could never leave, though no coffin is large enough. Those whose spirit it breaks do not panic. They simply lie down, and the butterflies rest on them.";

exports.pokedex = (data) => {
	const common = {
		num: 2004,
		gen: 9,
		types: ['Bug', 'Ghost'],
		gender: 'N',
		abilities: { 0: ABILITY },
		heightm: 1.9,
		weightkg: 81,
		color: 'Black',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	data[ID] = {
		...common,
		name: 'Funerfly',
		baseStats: { hp: 95, atk: 65, def: 100, spa: 115, spd: 110, spe: 85 },
		otherFormes: ['Funerfly-Breach'],
		formeOrder: ['Funerfly', 'Funerfly-Breach'],
	};
	data[BREACH] = {
		...common,
		name: 'Funerfly-Breach',
		baseSpecies: 'Funerfly',
		forme: 'Breach',
		baseStats: { hp: 95, atk: 75, def: 85, spa: 150, spd: 95, spe: 120 },
		requiredAbility: ABILITY,
		battleOnly: 'Funerfly',
	};
	return data;
};

/** The counter lives on the Pokemon, not the ability's state, so a switch keeps it. */
function counterOf(pokemon) {
	if (pokemon.m.qliphoth === undefined) pokemon.m.qliphoth = COUNTER_START;
	return pokemon.m.qliphoth;
}

/** One step down the counter, and the breach when it reaches 0. */
function tick(battle, pokemon, why) {
	if (pokemon.baseSpecies.baseSpecies !== 'Funerfly' || pokemon.transformed) return;
	if (pokemon.baseSpecies.id === BREACH || counterOf(pokemon) <= 0) return;
	pokemon.m.qliphoth--;
	battle.add('-activate', pokemon, `ability: ${ABILITY}`);
	battle.add('-message', `${pokemon.name}'s Qliphoth Counter fell to ${pokemon.m.qliphoth} (${why}).`);
	if (pokemon.m.qliphoth > 0) return;
	pokemon.formeChange('Funerfly-Breach', battle.dex.abilities.get(ABILITY), true);
	// Back to Funerfly when it faints, as Zygarde-Complete goes back to Zygarde.
	pokemon.formeRegression = true;
	battle.add('-message', BREACH_LINE);
}

exports.abilities = (data) => {
	data.qliphothcounter = {
		name: ABILITY,
		num: -67,
		gen: 9,
		rating: 3,
		onStart(pokemon) {
			if (pokemon.baseSpecies.id !== ID) return;
			// Contained again after fainting (Revival Blessing): the count starts over.
			if (counterOf(pokemon) <= 0) pokemon.m.qliphoth = COUNTER_START;
			this.add('-ability', pokemon, ABILITY);
			this.add('-message', `${pokemon.name}'s Qliphoth Counter is at ${pokemon.m.qliphoth}.`);
		},
		onDamagingHit(damage, target, source, move) {
			if (!target.hp || target.getMoveHitData(move).typeMod <= 0) return;
			// Once per move: the two hits of a Double Kick are one blow to the counter.
			if (move.hit > 1) return;
			tick(this, target, 'struck by a super-effective move');
		},
		// Technician, as the original: 1.5x on a move of 60 power or less, after other power changes.
		onBasePowerPriority: 30,
		onBasePower(basePower, attacker, defender, move) {
			const basePowerAfterMultiplier = this.modify(basePower, this.event.modifier);
			this.debug(`Base Power: ${basePowerAfterMultiplier}`);
			if (basePowerAfterMultiplier <= 60) {
				this.debug('Qliphoth Counter: Technician boost');
				return this.chainModify(1.5);
			}
		},
		onAllyFaint(ally) {
			const self = this.effectState.target;
			if (ally === self || !self.hp || !self.isActive) return;
			tick(this, self, `${ally.name} fainted`);
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		shortDesc: 'Technician. Counter 2: -1 when hit super effectively or an ally faints. At 0: Funerfly-Breach.',
		desc: "This Pokemon's moves of 60 power or less have their power multiplied by 1.5, as Technician (this includes Struggle). Funerfly starts contained with a Qliphoth Counter of 2. The counter drops by 1 when a super-effective move hits it (once per move, however many hits), and by 1 when an ally faints while Funerfly is on the field. The counter is kept when it switches out. At 0 it breaches: it permanently becomes Funerfly-Breach (95/75/85/150/95/120) until it faints, switching included. This Ability can't be suppressed, copied, swapped or replaced.",
	};
	return data;
};

exports.moves = (data) => {
	data.solemnlament = {
		num: -63,
		gen: 9,
		accuracy: 100,
		basePower: 60,
		category: 'Special',
		name: 'Solemn Lament',
		pp: 10,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		multihit: 2,
		secondary: { chance: 20, boosts: { spd: -1 } },
		target: 'normal',
		type: 'Ghost',
		shortDesc: "Hits 2 times. Each hit: 20% chance to lower the target's Sp. Def by 1. Funerfly.",
		desc: "Hits twice. Each hit has a 20% chance to lower the target's Special Defense by 1 stage. If the first hit breaks the target's substitute, it will take damage for the second hit. Funerfly's signature move.",
	};
	data.butterflyprocession = {
		num: -64,
		gen: 9,
		accuracy: 100,
		basePower: 120,
		category: 'Special',
		name: 'Butterfly Procession',
		pp: 8,
		noPPBoosts: true,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		// Infestation's binding, held to four turns whatever the user holds.
		onHit(target, source, move) {
			if (target.addVolatile('partiallytrapped', source, move)) target.volatiles['partiallytrapped'].duration = 5;
		},
		secondary: null,
		target: 'normal',
		type: 'Bug',
		shortDesc: 'Traps and damages the target for 4 turns. Funerfly.',
		desc: "Prevents the target from switching for four turns and causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding Binding Band), rounded down, at the end of each turn during effect. The effect ends early if the user leaves the field or uses Rapid Spin or Mortal Spin successfully. Grip Claw does not lengthen it. Funerfly's signature move.",
	};
	// Last Respects, special: 50 power +50 for each fainted Pokemon on the user's side (counted to 100, as the original).
	data.lastrites = {
		num: -65,
		gen: 9,
		accuracy: 100,
		basePower: 50,
		basePowerCallback(pokemon, target, move) {
			return 50 + 50 * pokemon.side.totalFainted;
		},
		category: 'Special',
		name: 'Last Rites',
		pp: 10,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: '+50 power for each time a party member fainted. Funerfly.',
		desc: "Power is equal to 50+(X*50), where X is the total number of times any Pokemon has fainted on the user's side, and X cannot be greater than 100. Funerfly's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [BREACH];
exports.NAMES = ['Funerfly', 'Funerfly-Breach'];
exports.ABILITY_IDS = ['qliphothcounter'];
exports.SIGNATURE = ['solemnlament', 'butterflyprocession', 'lastrites'];
exports.MOVES = [
	'shadowball', 'bugbuzz', 'hex', 'willowisp', 'quiverdance', 'calmmind', 'strengthsap', 'painsplit', 'destinybond',
	'perishsong', 'memento', 'uturn', 'trickroom', 'psychic', 'silverwind', 'ominouswind', 'protect',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['funeral', ID, 0], ['funeralofthedeadbutterflies', ID, 0], ['deadbutterflies', ID, 0], ['breach', BREACH, 8]];
