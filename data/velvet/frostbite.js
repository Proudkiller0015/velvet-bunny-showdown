'use strict';
/**
 * Frostbite: a sixth major status, the special side's burn (the owner, 29 Sep 2026).
 *
 *   - Special Attack is halved (burn halves Attack).
 *   - 1/16 of max HP lost at the end of every turn, like burn.
 *   - Ice types can't be frostbitten (Fire types can't be burned).
 *   - Freeze is untouched: this is an extra status, not a replacement.
 *
 * It is status id 'frb'. Everything that treats "any status" generically - Guts,
 * Facade, Hex, Natural Cure, Lum Berry, Heal Bell, Rest - already works with it;
 * the Aspear Berry, which thaws, also warms a frostbite here. The client learns to
 * read and draw it in client/js/velvet-data.js (installFrostbite).
 *
 * Inflicted by Chilling Mist (data/velvet/balance-patch-1.js), which Fire types are
 * immune to - the move, not the status.
 */

exports.conditions = (data) => {
	data.frb = {
		name: 'frb',
		effectType: 'Status',
		onStart(target, source, sourceEffect) {
			// The type immunity: returning false here makes setStatus fail cleanly.
			if (target.hasType('Ice')) return false;
			if (sourceEffect && sourceEffect.effectType === 'Ability') {
				this.add('-status', target, 'frb', '[from] ability: ' + sourceEffect.name, `[of] ${source}`);
			} else if (sourceEffect && sourceEffect.effectType === 'Item') {
				this.add('-status', target, 'frb', '[from] item: ' + sourceEffect.name);
			} else {
				this.add('-status', target, 'frb');
			}
		},
		onModifySpAPriority: 1,
		onModifySpA(spa, pokemon) {
			return this.chainModify(0.5);
		},
		onResidualOrder: 10,
		onResidual(pokemon) {
			this.damage(pokemon.baseMaxhp / 16);
		},
	};
	return data;
};

exports.items = (data) => {
	// The Aspear Berry thaws a freeze; here it also warms a frostbite.
	const aspear = data.aspearberry;
	if (aspear) {
		data.aspearberry = {
			...aspear,
			onUpdate(pokemon) {
				if (pokemon.status === 'frz' || pokemon.status === 'frb') pokemon.eatItem();
			},
			onEat(pokemon) {
				if (pokemon.status === 'frz' || pokemon.status === 'frb') pokemon.cureStatus();
			},
			desc: "Holder cures itself if it is frozen or frostbitten. Single use.",
			shortDesc: "Holder cures itself if it is frozen or frostbitten. Single use.",
		};
	}
	return data;
};

/*
 * Toxic's rule for the other status moves (the owner): used by a Pokemon of the
 * move's own type, it can't miss. Will-O-Wisp for Fire, Thunder Wave for Electric,
 * Chilling Mist for Ice (its own row in balance-patch-1.js does the same).
 */
const SURE_HIT = { willowisp: 'Fire', thunderwave: 'Electric' };
// Showdown keeps move text in its text files, not on the move rows, so it is written here.
const TEXT = {
	willowisp: { short: 'Burns the target. Fire-type user: never misses.', long: "Burns the target. If the user is a Fire type, this move can't miss." },
	thunderwave: { short: 'Paralyzes the target. Electric-type user: never misses.', long: "Paralyzes the target. This move does not ignore type immunity. If the user is an Electric type, this move can't miss." },
};
exports.moves = (data) => {
	for (const [id, type] of Object.entries(SURE_HIT)) {
		if (!data[id]) continue;
		data[id] = {
			...data[id],
			onModifyMove(move, pokemon) {
				if (pokemon.hasType(type)) move.accuracy = true;
			},
			shortDesc: TEXT[id].short,
			desc: TEXT[id].long,
		};
	}
	return data;
};
exports.SURE_HIT = { ...SURE_HIT, chillingmist: 'Ice' };
