'use strict';
/**
 * Punibird, from Lobotomy Corporation's "Punishing Bird" (O-02-56, TETH risk). A
 * small white bird that pecks at sinners, and opens the huge red mouth on its belly
 * at whoever hurts it - for a while. A Collab Pokemon: see collab.js for the tier.
 *
 *   Punibird         Flying/Dark   75 / 65 / 60 / 40 / 60 / 100    400   calm
 *   Punibird-Angry   Flying/Dark   75 / 150 / 80 / 40 / 80 / 110   535   angry
 *
 *   Punishment    struck by a damaging move (once per move), it is Punibird-Angry for
 *                 3 turns: the turn it was hit and the two after. Struck again while
 *                 angry, the 3 turns start over. Then it is Punibird again. Switching
 *                 out calms it at once, as it does Aegislash.
 *   Peck of Sin   Flying, physical, 20, 100%, +1 priority. 120 from Punibird-Angry.
 */

const ID = 'punibird';
const ANGRY = 'punibirdangry';
const ABILITY = 'Punishment';
const ANGRY_TURNS = 3;

const DEX_ENTRY = "It was set to watch over a peaceful forest and keep it free of sin, and found that everyone carries a little. Most days it only pecks, as a warning. Strike it, and the red mouth across its belly opens wide - but its anger never lasts, and soon it is a small bird again.";

exports.pokedex = (data) => {
	const common = {
		num: 2005,
		gen: 9,
		types: ['Flying', 'Dark'],
		gender: 'N',
		abilities: { 0: ABILITY },
		heightm: 0.3,
		weightkg: 1.8,
		color: 'White',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	data[ID] = {
		...common,
		name: 'Punibird',
		baseStats: { hp: 75, atk: 65, def: 60, spa: 40, spd: 60, spe: 100 },
		otherFormes: ['Punibird-Angry'],
		formeOrder: ['Punibird', 'Punibird-Angry'],
	};
	data[ANGRY] = {
		...common,
		name: 'Punibird-Angry',
		baseSpecies: 'Punibird',
		forme: 'Angry',
		baseStats: { hp: 75, atk: 150, def: 80, spa: 40, spd: 80, spe: 110 },
		requiredAbility: ABILITY,
		battleOnly: 'Punibird',
	};
	return data;
};

exports.abilities = (data) => {
	data.punishment = {
		name: ABILITY,
		num: -249,
		gen: 9,
		rating: 3,
		onDamagingHit(damage, target, source, move) {
			// Once per move: the hits of a Bullet Seed are one offence.
			if (!target.hp || move.hit > 1) return;
			if (target.baseSpecies.baseSpecies !== 'Punibird' || target.transformed) return;
			const anger = target.volatiles['punishment'];
			if (!anger) {
				target.addVolatile('punishment');
				return;
			}
			anger.duration = ANGRY_TURNS;
			this.add('-activate', target, `ability: ${ABILITY}`);
		},
		/*
		 * The anger is a volatile: its duration counts the 3 turns down, and a switch
		 * clears it with everything else, which is also when an in-battle forme goes back.
		 */
		condition: {
			duration: ANGRY_TURNS,
			onStart(pokemon) {
				pokemon.formeChange('Punibird-Angry', this.dex.abilities.get(ABILITY));
				this.add('-message', `${pokemon.name} is out to punish the sinner!`);
			},
			onEnd(pokemon) {
				if (!pokemon.hp || pokemon.species.id !== ANGRY) return;
				pokemon.formeChange('Punibird');
				this.add('-message', `${pokemon.name} calmed down.`);
			},
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		shortDesc: 'When hit by a damaging move: Punibird-Angry for 3 turns; hit again while angry, the 3 turns restart.',
		desc: "When Punibird is hit by a damaging move (once per move, however many hits), it becomes Punibird-Angry (75/150/80/40/80/110) for 3 turns, counting the turn it was hit, then goes back to Punibird. Hit again while angry, the 3 turns start over. Switching out ends the anger at once. This Ability can't be suppressed, copied, swapped or replaced.",
	};
	return data;
};

exports.moves = (data) => {
	data.peckofsin = {
		num: -301,
		gen: 9,
		accuracy: 100,
		basePower: 20,
		basePowerCallback(pokemon, target, move) {
			return pokemon.species.id === ANGRY ? 120 : move.basePower;
		},
		category: 'Physical',
		name: 'Peck of Sin',
		pp: 15,
		priority: 1,
		flags: { contact: 1, protect: 1, mirror: 1, distance: 1, metronome: 1 },
		secondary: null,
		target: 'any',
		type: 'Flying',
		shortDesc: 'Usually goes first. 120 power if the user is Punibird-Angry. Punibird.',
		desc: "Usually goes first. Power is 120 instead if the user is Punibird-Angry. Punibird's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [ANGRY];
exports.NAMES = ['Punibird', 'Punibird-Angry'];
exports.ABILITY_IDS = ['punishment'];
exports.SIGNATURE = ['peckofsin'];
exports.MOVES = [
	'bravebird', 'drillpeck', 'pluck', 'dualwingbeat', 'acrobatics', 'uturn', 'roost', 'tailwind', 'knockoff',
	'suckerpunch', 'crunch', 'throatchop', 'payback', 'retaliate', 'quickattack', 'taunt', 'torment', 'protect',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['punishingbird', ID, 0], ['angry', ANGRY, 8]];
