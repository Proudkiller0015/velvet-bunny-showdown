'use strict';
/**
 * Where this server puts a Pokemon, when it disagrees with Smogon.
 *
 * The RP tiers stand on National Dex's lists, which is the part nobody should
 * invent from scratch: they are built from real usage and they update when
 * Smogon updates. This file is the exception list - the handful of Pokemon this
 * server has decided belong somewhere else, with the reason written down beside
 * each one.
 *
 * A tier here is not a ban. Moving a Pokemon to Ubers does not remove it from
 * the game; it puts it in the tier where the things that answer it live, and
 * the existing banlists do the rest without a line of ours deciding anything.
 *
 * This is deliberately dex-wide rather than RP-only. "RP is its own tier" cuts
 * both ways: the dex this server runs is one dex, and a Gliscor that is Uber in
 * RP OU and OU in National Dex is two different Pokemon wearing one name. Every
 * other thing in data/velvet works the same way.
 */

/**
 * Smogon's tiers, strongest first. Shared shape with data/velvet/za-megas.js -
 * the two files disagreeing about what "above RU" means is a bug waiting to
 * happen.
 */
const LADDER = [
	'AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU',
	'NUBL', 'NU', 'PUBL', 'PU', 'ZUBL', 'ZU',
];

/**
 * The exceptions, and why.
 *
 * Keep the reason with the entry. A tier change with no reason beside it is
 * impossible to revisit later, because nobody remembers whether it was a
 * considered decision or a bad afternoon.
 */
const TIERS = {
	// Poison Heal plus Protect plus Toxic plus Substitute is a Pokemon that wins
	// by not losing, and the things that break it through are largely the things
	// already in Ubers. Moved up rather than banned outright so it still has a
	// tier to be played in.
	gliscor: 'Uber',

	/*
	 * The two that National Dex tiered under a Terastal ban this server does
	 * not have.
	 *
	 * RP stands on National Dex's lists and then hands Terastallization back,
	 * which is the tier's defining decision - see UNBAN_TERA in the format
	 * file. For almost everything that is a small change. For these two it is
	 * the change their whole tier placement was resting on, so the number
	 * National Dex arrived at is answering a different question than the one
	 * this server asks.
	 */

	// National Dex calls it OU because under a Terastal ban it never becomes
	// Terapagos-Stellar: 160 / 105 / 110 / 130 / 110 / 85, seven hundred base
	// stats, behind Tera Shell halving everything on a full HP bar. With Tera
	// handed back that forme is one turn away, and it is Uber in every format
	// that can actually reach it - including Smogon's own ninth-generation OU,
	// which bans the base Pokemon outright.
	terapagos: 'Uber',

	// Wonder Guard says only super-effective moves land, and National Dex tiered
	// that at RU on the assumption that the typing deciding "super-effective" is
	// fixed at team preview. Terastallization is what breaks the assumption: the
	// defending type is chosen after the other player has committed to their
	// coverage, so the four moves they brought to answer a Bug/Ghost are
	// answering something else by the time they are used.
	shedinja: 'Uber',

	/*
	 * The three monkeys, which this server rebuilt.
	 *
	 * National Dex has them at RU, and that tier describes the Pokemon Game
	 * Freak shipped: 498 base stats, a bad movepool and an ability nobody wants.
	 * Ours have a terrain setter in the second slot, the priority move that goes
	 * with it, and thirty-odd moves each that they did not have - Simisage alone
	 * gained Grassy Glide, Jungle Rush, Swords Dance, Close Combat and U-turn.
	 *
	 * A tier set against the old sheet is not a judgement about these any more,
	 * so they move up two to UU. Two rather than one because the change is a
	 * whole set rather than a single addition, and not further than UU because
	 * 101 Speed and 63 / 63 defences is still what they have to work with.
	 *
	 * This is the case the file was written for: a tier we invalidated
	 * ourselves, moved by us rather than left to drift.
	 */
	simisage: 'UU',
	simisear: 'UU',
	simipour: 'UU',

	// Its only ability is Shadow Tag. Base Chandelure can pick Flash Fire and go
	// on being an RU Pokemon, and the ability ban in the tiers below Ubers
	// already stops the trapping set there - but a Mega has one ability slot and
	// this one is always the trapper, so there is no version of it that belongs
	// anywhere else. Derived tiering put it at RUBL off its base form, which is
	// the right answer for a Mega and the wrong one for this Mega.
	chandeluremega: 'Uber',

	/*
	 * The Z-A Megas that are not an OU problem so much as an OU ending.
	 *
	 * Derived tiering puts a Mega one step above its base form, which is the
	 * right guess for most of forty-nine and visibly wrong for these. Each is
	 * here for something specific rather than for being strong.
	 */

	// 651 base stats - second only to Zygarde-Mega in the whole set. It landed in
	// RU because its base form is an unevolved Pokemon and the derived rule had
	// nothing better to say; that is the rule failing, not a judgement.
	floettemega: 'Uber',

	// Huge Power. That is the ability that put Mega Mawile in Ubers, on 120
	// Speed rather than 50.
	starmiemega: 'Uber',

	// Adaptability on 164 Special Attack at 151 Speed. There is no defensive
	// answer to that below Ubers.
	lucariomegaz: 'Uber',

	// 154 Attack at 151 Speed behind Magic Bounce, so the hazards and status
	// that would otherwise wear it down bounce back at whoever tried.
	absolmegaz: 'Uber',

	/*
	 * And two that are our fault rather than Game Freak's.
	 *
	 * Both are Pokemon this server made stronger this session, and a tier that
	 * was set against the weaker version does not describe them any more.
	 */

	// Protean, un-nerfed back to changing type on every move, on 630 base stats
	// at 142 Speed. The OU tier it was derived into assumed the Generation 9
	// once-per-switch-in version.
	greninjamega: 'Uber',

	// Battle Bond, un-nerfed back to becoming Ash-Greninja: 640 base stats, 153
	// Special Attack, 132 Speed and a Water Shuriken that hits three times.
	// That is precisely the set Smogon banned from OU when it last existed, and
	// we put it back.
	greninjabond: 'Uber',

	// Balance Patch 1 took Slow Start away and gave it Colossus Unbound (Mold
	// Breaker, Clear Body, 1.2x Attack above half HP) and Continental Heave, a
	// 110 power move that ignores Protect and shatters screens. 160 base Attack
	// with all of that is not a ZU Pokemon any more; it is an Ubers one.
	regigigas: 'Uber',

	// Balance Patch 1's second legend, aimed low on purpose: Polar Mantle halves
	// the Rock damage that kept Articuno out of every tier and sets snow, and
	// Aurora Squall gives it a spread Ice attack. A solid RU pick, no more.
	articuno: 'RU',

	// The rest of Balance Patch 1's "Legends Rise": each got a signature (Regice's
	// Permafrost Core, the lake trio's Memory Wipe, Soul Resonance and Resolute
	// Strike) aimed at RU; after the lake trio's rework (110 power, guaranteed effects, Mind Keeper and Heartfelt Resolve) all three are UU.
	regice: 'RU',
	uxie: 'UU',
	mesprit: 'UU',
	azelf: 'UU',
};

/**
 * Put the decisions into the tier tables.
 *
 * `natDexTier` always, and `tier` as well wherever the Pokemon exists. The
 * first is what a plain ninth-generation format reads and the second is what
 * National Dex reads, and the RP tiers are built on National Dex - so the one
 * that matters here is the second. They are kept in step rather than allowed to
 * drift, because two numbers describing one Pokemon is how it ends up legal in
 * one place and not its mirror; the one exception is a Pokemon that is not in
 * this generation at all, and the note below says why.
 */
exports.applyTiers = (FormatsData, Pokedex, log = () => {}) => {
	const applied = {};
	for (const [id, tier] of Object.entries(TIERS)) {
		if (!LADDER.includes(tier)) {
			log(`${id} is set to "${tier}", which is not a tier - skipped`);
			continue;
		}

		/*
		 * A forme often has no tier row of its own and inherits its base form's.
		 *
		 * Greninja-Bond is the case that matters: it is a separate Pokemon you
		 * can put on a team, and it had no row, so re-tiering it silently did
		 * nothing and it went on being UUBL like ordinary Greninja. Giving it a
		 * row of its own is the whole point - the two are not the same Pokemon
		 * any more, one of them turns into Ash-Greninja.
		 *
		 * Only for something that actually exists, so a typo in the table above
		 * is a warning rather than a row for a Pokemon nobody has heard of.
		 */
		let data = FormatsData[id];
		if (!data) {
			if (!Pokedex || !Pokedex[id]) {
				log(`${id} is not a Pokemon, so it cannot be re-tiered`);
				continue;
			}
			data = FormatsData[id] = {};
		}

		/*
		 * A Pokemon that is not in this generation keeps its Illegal.
		 *
		 * `tier` is what a plain ninth-generation format reads and `natDexTier`
		 * is what National Dex reads, and Shedinja is the case that separates
		 * them: it is not in Scarlet and Violet at all, so its ninth-generation
		 * tier is Illegal and that is the true answer there. Writing Uber over
		 * it would say this server had added a Pokemon to SV that it has not -
		 * harmless to the validator, which refuses it on `isNonstandard: 'Past'`
		 * anyway, and not harmless in the builder, which labels from the tier
		 * and would call it Uber in a format it cannot be picked in.
		 *
		 * So the decision lands where the decision applies. RP reads the second
		 * one.
		 */
		if (data.tier !== 'Illegal') data.tier = tier;
		data.natDexTier = tier;
		applied[id] = tier;
	}
	return applied;
};

exports.TIERS = TIERS;
exports.LADDER = LADDER;
