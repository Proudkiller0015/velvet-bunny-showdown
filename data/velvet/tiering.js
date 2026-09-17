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
	// tier to be played in. Then unbanned back to OU by the owner's call (Patch 1.5).
	gliscor: 'OU',

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
	// And then to OU, by the owner's call (Patch 1.5): with the Elemental Banana,
	// their terrain and the Rush moves they are built to be played with the best,
	// and OU is where people will actually meet them.
	simisage: 'OU',
	simisear: 'OU',
	simipour: 'OU',

	// Infernape, with Crown of Flame (Patch 1.5): up from RU beside the monkey it
	// was being measured against.
	infernape: 'OU',
	// And the rest of its trio, rebuilt the same way (Patch 1.5).
	torterra: 'OU',
	empoleon: 'OU',

	// Walking Wake, unbanned by the owner's call (Patch 1.5) "for the funny".
	walkingwake: 'OU',
	// Dragapult too (Patch 1.5), by the owner's call.
	dragapult: 'OU',
	// Derived Uber from its 700 base stats; unbanned by the owner's call (Patch 1.5).
	dragonitemega: 'OU',
	// Deoxys-Speed, unbanned by the owner's call (Patch 1.5).
	deoxysspeed: 'OU',
	// Magearna, both colours, unbanned by the owner's call (Patch 1.5). Its Mega stays Uber.
	magearna: 'OU',
	magearnaoriginal: 'OU',
	// Roaring Moon, unbanned by the owner's call (Patch 1.5).
	roaringmoon: 'OU',
	// Bloodmoon Ursaluna too (Patch 1.5).
	ursalunabloodmoon: 'OU',
	// Mega Zeraora (base Zeraora was already UU), unbanned by the owner's call (Patch 1.5).
	zeraoramega: 'OU',
	// Mega Heatran, now with Earth Eater (unnerfs.js), unbanned by the owner's call (Patch 1.5).
	heatranmega: 'OU',
	// Mega Blaziken, unbanned by the owner's call (Patch 1.5).
	blazikenmega: 'OU',
	// Pheromosa, unbanned by the owner's call (Patch 1.5).
	pheromosa: 'OU',
	// Genesect, every Drive, unbanned by the owner's call (Patch 1.5).
	genesect: 'OU',
	genesectdouse: 'OU',
	genesectshock: 'OU',
	genesectburn: 'OU',
	genesectchill: 'OU',
	// Zygarde (50%), unbanned by the owner's call (Patch 1.5). Its Mega stays Uber.
	zygarde: 'OU',
	// Mega Garchomp Z, unbanned by the owner's call (Patch 1.5).
	garchompmegaz: 'OU',

	// Spiritomb, rebuilt with Keystone Legion, Strength Sap and Parting Shot (Patch 1.5).
	spiritomb: 'UU',

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

	// Adaptability on 164 Special Attack at 151 Speed. It was Uber for that; the
	// owner unbanned it (Patch 1.5), along with Mega Dragonite below.
	lucariomegaz: 'OU',

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
	// ...and then unbanned by the owner's call (Patch 1.5): OU.
	greninjabond: 'OU',

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

	/*
	 * Balance Patch 1's tier review: the few that the patch lifted out of the tier
	 * below RU they were in. These only move the ninth-generation tier (the NU,
	 * PU and ZU lists); National Dex has nothing below RU, so they stay RU there.
	 * Everything else the patch touched was reviewed and left where it was, to be
	 * revisited once real usage comes in.
	 */

	/*
	 * The eeveelutions' signatures, tested in UU. Each turns a stat they could
	 * never use into a plan - Solstice and Diamond Dust bring their own weather
	 * and double Speed in it, Kindled Fury is a turn-one Guts burn that Speed
	 * Boosts, Prescience is Magic Guard and Magic Bounce, Liquid Body is Water
	 * Absorb and Regenerator on 130 HP, Moonlit Venom shuts out status. Checked
	 * with short sims: a Choice Band Kindled Fury Facade does about a third to a
	 * physically defensive Corviknight, a Life Orb Solar Blade half to Garchomp;
	 * strong, not unanswerable. Jolteon and Sylveon gained less and stay put.
	 * To be revisited with real usage.
	 */
	leafeon: 'UU',
	glaceon: 'UU',
	flareon: 'UU',
	umbreon: 'UU',
	vaporeon: 'UU',

	// Luxray, Electric/Dark with Prankster and Gleamstalk: a Prankster paralysis
	// that also gives +2 Speed and a Charge. The charged Life Orb Supercell Slam
	// after it removes a full-health physically defensive Toxapex. Tested in OU.
	luxray: 'OU',

	// Pikachu with its Let's Go partner stats (45/80/50/75/60/120): a Light Ball
	// doubles both attacks on 120 Speed, which is not ZU. Eevee keeps its LC tier
	// (partner stats plus Eviolite are strong there; one to watch).
	pikachu: 'PU',

	// Espeon with Prescience (Magic Guard + Magic Bounce + Regenerator): OU, the
	// owner's decision.
	espeon: 'OU',

	/*
	 * UUBL Pokemon strong enough for OU, moved up at the owner's call: Weavile,
	 * and the ones that already bullied UU - Speed Boost Blaziken, Hoopa-Unbound,
	 * Kartana, Latios, Galarian Zapdos, Meowscarada - plus Kommo-o and Hawlucha,
	 * which this patch gave Shuffle Jab. The niche UUBL Pokemon stay UUBL.
	 */
	weavile: 'OU',
	blaziken: 'OU',
	hoopaunbound: 'OU',
	kartana: 'OU',
	latios: 'OU',
	zapdosgalar: 'OU',
	meowscarada: 'OU',
	kommoo: 'OU',
	hawlucha: 'OU',

	// Melmetal: banned to Ubers at the owner's call.
	melmetal: 'Uber',

	// Urshifu, both styles: banned to Ubers at the owner's call.
	urshifu: 'Uber',
	urshifurapidstrike: 'Uber',

	// Reckless Brave Bird and Double-Edge on 110 Speed, and now Hustle Up and
	// U-turn beside them.
	dodrio: 'PU',
	// Quiver Dance and Sleep Powder already made it ZU's best sweeper; Earth
	// Power, Sludge Bomb and Solar Nectar remove what used to wall it.
	lilligant: 'PU',
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
		// National Dex stops at RU, so a tier below it only moves the SV list.
		const belowRU = LADDER.indexOf(tier) > LADDER.indexOf('RU');
		data.natDexTier = belowRU ? (data.natDexTier || 'RU') : tier;
		applied[id] = tier;
	}
	return applied;
};

exports.TIERS = TIERS;
exports.LADDER = LADDER;
