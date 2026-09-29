'use strict';
/**
 * Old-generation mechanics brought back into RP (the owner, 29 Sep 2026).
 *
 *   Belly Drum    Gen 2's: at half HP or less it doesn't fail - it raises Attack by
 *                 2 and costs nothing. Above half HP it is the usual half HP for +6.
 *   Recharging    Gen 1's: Hyper Beam and every other recharge move skips the
 *                 recharge turn when it knocks the target out.
 */

exports.moves = (data) => {
	const belly = data.bellydrum;
	if (belly) {
		data.bellydrum = {
			...belly,
			onHit(target) {
				if (target.boosts.atk >= 6 || target.maxhp === 1) return false;
				if (target.hp <= target.maxhp / 2) {
					this.boost({ atk: 2 }, target);
					return;
				}
				this.directDamage(target.maxhp / 2);
				this.boost({ atk: 12 }, target);
			},
			shortDesc: "User loses 50% max HP. Maximizes Attack. At 50% HP or less: +2 Atk, no HP cost.",
			desc: "Raises the user's Attack by 12 stages in exchange for the user losing 1/2 of its maximum HP, rounded down. If the user has 1/2 of its maximum HP or less, it instead raises its Attack by 2 stages and loses no HP, as in Generation 2. Fails if the user's Attack is already +6.",
		};
	}
	for (const [id, move] of Object.entries(data)) {
		if (!move || !move.flags || !move.flags.recharge) continue;
		const own = move.onAfterMove;
		data[id] = {
			...move,
			shortDesc: "User cannot move next turn, unless this knocks the target out.",
			desc: "If this move is successful, the user must recharge on the following turn and cannot select a move - unless it knocked the target out, as in Generation 1, in which case there is no recharge turn.",
			// Gen 1: a knockout means no recharge turn.
			onAfterMove(pokemon, target, activeMove) {
				if (own) own.call(this, pokemon, target, activeMove);
				if (target && (target.fainted || !target.hp) && pokemon.volatiles['mustrecharge']) {
					pokemon.removeVolatile('mustrecharge');
					this.add('-message', `${pokemon.name} doesn't need to recharge after the knockout!`);
				}
			},
		};
	}
	// Punishment, buffed (the owner): 75 base instead of 60, +20 per target boost, max 200.
	// Penance (balance-patch-1.js) is its Fairy, special twin on the same numbers.
	if (data.punishment) {
		data.punishment = {
			...data.punishment,
			basePowerCallback(pokemon, target) {
				return Math.min(200, 75 + 20 * target.positiveBoosts());
			},
			shortDesc: "75 power +20 for each of the target's stat boosts (max 200).",
			desc: "Power is 75, plus 20 for each of the target's positive stat stage changes, up to 200.",
		};
	}
	// Smeargle gets everything new (the owner): every move of ours can be Sketched,
	// the Balance Patch signatures included. Not Samantha's Queen moves, Nuzleaf-SOLD's
	// Merchant's Call, or the Halloween event's Witch's Snatch.
	const NEVER_SKETCH = ['queenbeam', 'queensdance', 'queensheal', 'queensblitz', 'merchantscall', 'witchssnatch'];
	for (const [id, move] of Object.entries(data)) {
		if (!move || !(move.num < 0) || move.isNonstandard === 'CAP') continue;
		// The excluded ones are locked outright: Queen's Blitz had no nosketch flag and
		// Smeargle could already take it.
		if (NEVER_SKETCH.includes(id)) { data[id] = { ...move, flags: { ...move.flags, nosketch: 1 } }; continue; }
		if (move.flags && move.flags.nosketch) {
			const flags = { ...move.flags };
			delete flags.nosketch;
			data[id] = { ...move, flags };
		}
	}
	// Z-Moves of our status moves (the owner): each gets its closest official move's
	// Z effect, so a Z-Crystal on one of ours does something, the way it would on theirs.
	for (const [id, zMove] of Object.entries(Z_STATUS)) {
		if (data[id] && !data[id].zMove) data[id] = { ...data[id], zMove };
	}
	return data;
};

const Z_STATUS = {
	queensdance: { effect: 'clearnegativeboost' },   // Dragon Dance
	queensheal: { effect: 'clearnegativeboost' },    // Recover
	hustleup: { effect: 'clearnegativeboost' },      // Dragon Dance
	chrysalisveil: { effect: 'clearnegativeboost' }, // Recover
	velvetguard: { effect: 'clearnegativeboost' },   // Cotton Guard
	sovereignrite: { effect: 'clearnegativeboost' }, // Tail Glow
	twilightexit: { effect: 'healreplacement' },     // Parting Shot: a pivot heals who comes in
	grandfeast: { boost: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } }, // Geomancy
	chillingmist: { boost: { spa: 1 } },             // Will-O-Wisp's +1 Atk, for the special burn
	gleamstalk: { boost: { spd: 1 } },               // Thunder Wave
	tectonicshell: { boost: { def: 1 } },            // Stealth Rock
	royaldecree: { boost: { def: 1 } },              // Roar
};
exports.Z_STATUS = Z_STATUS;

// For the client's move descriptions (scripts/build-buffs.js): every move this file changes.
exports.CHANGED_MOVES = ['punishment', 'bellydrum', 'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser', 'eternabeam', 'meteorassault'];
