'use strict';
/**
 * Nerfs this server undoes.
 *
 * The companion to buffs.js, and the other half of the same idea. A buff gives
 * a Pokemon something it never had; an un-nerf gives something back that was
 * taken away - a move whose accuracy was cut, an ability rewritten into a
 * weaker one - because the thing being fixed is the same either way: a Pokemon
 * that is worse than it was for reasons that had nothing to do with it.
 *
 * Each entry restores a real, previous version rather than inventing a stronger
 * one. Dark Void goes back to the accuracy it had in Generation 6, Protean and
 * Libero to how they worked in Generation 8, Battle Bond to the transformation
 * it was built around. Nothing here is a number somebody made up, which is also
 * why each one says which generation it is restoring.
 *
 * Applied to the live data on boot, the same way everything else here is, so it
 * holds in every format on this server.
 */

/**
 * The recovery moves, back to ten PP.
 *
 * Generation 9 halved the PP of every reliable recovery move - ten to five, so
 * eight to sixteen once PP Ups are in - and that single change is most of what
 * happened to defensive play. It does not make a wall weaker in any exchange it
 * is in; it just runs the clock out, so the way past a Blissey became waiting
 * for it rather than beating it.
 *
 * These are the Generation 8 numbers, not invented ones. Rest is in the list
 * because it was cut alongside the others and is the same move to the same
 * Pokemon.
 *
 * Measured rather than remembered: these seven are every move whose PP is lower
 * in Generation 9 than it was in Generation 8.
 */
const RECOVERY_PP = {
	recover: 10,
	roost: 10,
	softboiled: 10,
	slackoff: 10,
	milkdrink: 10,
	shoreup: 10,
	rest: 10,
};

/**
 * Dark Void, at the accuracy it had before Generation 7.
 *
 * Darkrai's signature move was cut from 80% to 50% and simultaneously locked to
 * Darkrai - two nerfs at once, aimed at Smeargle. The lock is the half that
 * worked and it stays: it costs Darkrai nothing, since it only ever stopped
 * other Pokemon using the move. The accuracy is the half that only ever hit the
 * Pokemon whose move it is, so it goes back.
 */
function unnerfMoves(Moves) {
	if (Moves) {
		for (const [id, pp] of Object.entries(RECOVERY_PP)) {
			if (Moves[id] && Moves[id].pp < pp) Moves[id].pp = pp;
		}
	}

	const darkVoid = Moves && Moves.darkvoid;
	if (darkVoid) {
		darkVoid.accuracy = 80;
		darkVoid.shortDesc = "Darkrai: Causes the foe(s) to fall asleep.";
		darkVoid.desc = "Causes the target to fall asleep. This move cannot be used successfully " +
			"unless the user's current form, while considering Transform, is Darkrai.";
	}
	return Moves;
}

/**
 * Protean and Libero, as they worked in Generation 8.
 *
 * Both changed the user's type to match every move it used. In Generation 9
 * both became once per switch-in, which does not weaken the ability so much as
 * remove the thing it did: the whole point was that the type kept moving, and a
 * single free change is closer to a held item than to an ability.
 *
 * The Generation 8 handler is the Generation 9 one with the guard taken out,
 * which is all the nerf ever was.
 */
function unnerfProtean(ability, name) {
	if (!ability) return;
	ability.onPrepareHit = function (source, target, move) {
		if (move.hasBounced || move.flags['futuremove'] || move.sourceEffect === 'snatch' || move.callsMove) return;
		const type = move.type;
		if (type && type !== '???' && source.getTypes().join() !== type) {
			if (!source.setType(type)) return;
			this.add('-start', source, 'typechange', type, `[from] ability: ${name}`);
		}
	};
	ability.rating = 4.5;
	ability.shortDesc = "This Pokemon's type changes to the type of the move it is using.";
	ability.desc = "This Pokemon's type changes to match the type of the move it is about to use. " +
		"This effect comes after all effects that change a move's type.";
}

/**
 * Battle Bond, back to being a transformation.
 *
 * It used to turn Greninja into Greninja-Ash on a knockout - a real forme with
 * better stats and a three-hit Water Shuriken. Generation 9 replaced that with
 * a one-off +1 to three stats, which is a fine ability attached to the wrong
 * Pokemon: Greninja-Ash still exists in the data, still has its stats, and
 * nothing can reach it any more.
 *
 * So the Generation 8 handler comes back, and with it the forme. Water
 * Shuriken's three hits are already handled by the ability's own onModifyMove,
 * which was never changed and has been sitting there doing nothing.
 */
function unnerfBattleBond(ability) {
	if (!ability) return;
	ability.onSourceAfterFaint = function (length, target, source, effect) {
		if (source.bondTriggered) return;
		if (effect?.effectType !== 'Move') return;
		if (source.species.id === 'greninjabond' && source.hp && !source.transformed && source.side.foePokemonLeft()) {
			this.add('-activate', source, 'ability: Battle Bond');
			source.formeChange('Greninja-Ash', this.effect, true);
			source.formeRegression = true;
			source.bondTriggered = true;
		}
	};
	ability.rating = 4;
	ability.shortDesc = "After KOing a Pokemon: becomes Ash-Greninja, Water Shuriken hits 3 times.";
	ability.desc = "If this Pokemon is a Greninja with this Ability, it transforms into Ash-Greninja " +
		"after knocking out a Pokemon. As Ash-Greninja, its Water Shuriken has 20 base power and always hits 3 times.";
}

function unnerfAbilities(Abilities) {
	if (!Abilities) return Abilities;
	unnerfProtean(Abilities.protean, 'Protean');
	unnerfProtean(Abilities.libero, 'Libero');
	unnerfBattleBond(Abilities.battlebond);
	return Abilities;
}

/**
 * What this file changes, by name.
 *
 * The client builds its dex from Showdown's own data files, so anything
 * corrected here is corrected on the server and nowhere else: the teambuilder
 * went on saying Dark Void was 50% accurate long after it was 80% in every
 * battle. A number a player reads and a number the game uses have to be the
 * same number.
 *
 * scripts/build-buffs.js reads this list, takes the patched values straight off
 * the dex, and ships them to the client. Add an un-nerf above and it reaches the
 * builder without anything else being touched.
 */
/**
 * Base stats Generation 9 cut, put back.
 *
 * Cresselia lost 10 Defense and 10 Special Defense in Scarlet and Violet
 * (120/130 to 110/120). These are its Generation 8 numbers.
 */
const SPECIES_STATS = {
	cresselia: { def: 120, spd: 130 },
	// Balance Patch 1: Kagura's starter Pikachu and Eevee get their Let's Go
	// partner stats. The partner formes themselves stay illegal.
	pikachu: { hp: 45, atk: 80, def: 50, spa: 75, spd: 60, spe: 120 },
	eevee: { hp: 65, atk: 75, def: 70, spa: 65, spd: 85, spe: 75 },
	// Patch 1.5: Spiritomb's 50 HP undercut the bulk it is built on.
	spiritomb: { hp: 85, def: 118, spd: 118 },
	// Patch 1.5: Roserade, 60 to 75 HP.
	roserade: { hp: 75 },
};

/*
 * Types this server changed. Luxray (Balance Patch 1): the Gleam Eyes Pokemon
 * that hunts by seeing through walls becomes Electric/Dark. Shinx and Luxio stay
 * pure Electric - the Dark comes with the full-grown hunter.
 */
const SPECIES_TYPES = {
	luxray: ['Electric', 'Dark'],
};

/*
 * Abilities this server changed on a species, replacing the whole set.
 * Mega Heatran (Patch 1.5, the owner's call): Earth Eater, so the Ground
 * weakness it walks around with becomes a heal.
 */
const SPECIES_ABILITIES = {
	heatranmega: { 0: 'Earth Eater' },
	// Mega Zeraora (Patch 1.5, the owner's call): Speed Boost.
	zeraoramega: { 0: 'Speed Boost' },
};

function unnerfSpecies(Pokedex) {
	if (!Pokedex) return Pokedex;
	for (const [id, types] of Object.entries(SPECIES_TYPES)) {
		if (Pokedex[id]) Pokedex[id].types = types.slice();
	}
	for (const [id, stats] of Object.entries(SPECIES_STATS)) {
		if (Pokedex[id] && Pokedex[id].baseStats) Object.assign(Pokedex[id].baseStats, stats);
	}
	for (const [id, abilities] of Object.entries(SPECIES_ABILITIES)) {
		if (Pokedex[id]) Pokedex[id].abilities = Object.assign({}, abilities);
	}
	return Pokedex;
}

exports.CHANGED = {
	moves: ['darkvoid', ...Object.keys(RECOVERY_PP)],
	abilities: ['protean', 'libero', 'battlebond'],
	species: [...new Set([...Object.keys(SPECIES_STATS), ...Object.keys(SPECIES_TYPES), ...Object.keys(SPECIES_ABILITIES)])],
};
exports.unnerfSpecies = unnerfSpecies;

exports.unnerfMoves = unnerfMoves;
exports.unnerfAbilities = unnerfAbilities;
