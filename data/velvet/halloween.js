'use strict';
/**
 * Halloween 2026: the Witching Hour.
 *
 * The event's Pokemon is a *skin* of Mega Banette, not a new one: the same
 * Ghost-type Mega from a stone of its own, the Banettite-Halloween, with a
 * little on top so owning it feels like something. The ordinary Banettite and
 * the ordinary Mega Banette are untouched.
 *
 *   Banette-Mega-Halloween   Mega Banette's own stats, 64 / 165 / 75 / 93 / 83 / 75
 *   Witching Hour            Prankster, and its Ghost moves hit 1.2x
 *   Witch's Snatch           Ghost, physical, 110, 100% - takes the target's item.
 *                            Not learned: Poltergeist BECOMES it when Banette Mega
 *                            Evolves into this form (the way Iron Head becomes
 *                            Behemoth Blade on a crowned Zacian).
 *
 * It rides the base dex the way Samantha does (see index.js), keeps Banette's
 * national number so the builder files it beside Banette, and borrows Mega
 * Banette's tiering. The sprite is ours: client/sprites/banette-megahalloween.png.
 */

const FORME = 'Banette-Mega-Halloween';
const STONE = 'Banettite-Halloween';

exports.pokedex = (data) => {
	const mega = data.banettemega;
	if (!mega) return data;
	data.banettemegahalloween = {
		...mega,
		name: FORME,
		forme: 'Mega-Halloween',
		// Mega Banette's own generation, so it is legal wherever Mega Banette is (Gen 6 on).
		gen: 6,
		// A skin: the stats are Mega Banette's, unchanged. What it gains is the ability and the move.
		baseStats: { ...mega.baseStats },
		abilities: { 0: 'Witching Hour' },
		color: 'Purple',
		requiredItem: STONE,
	};
	const base = data.banette;
	if (base) {
		if (!(base.otherFormes || []).includes(FORME)) base.otherFormes = [...(base.otherFormes || []), FORME];
		if (base.formeOrder && !base.formeOrder.includes(FORME)) base.formeOrder = [...base.formeOrder, FORME];
	}
	return data;
};

exports.formatsData = (data) => {
	// Legal wherever Mega Banette is; tiered UU by the owner's call.
	if (data.banettemega) data.banettemegahalloween = { ...data.banettemega, tier: 'UU', natDexTier: 'UU' };
	return data;
};

exports.items = (data) => {
	const stone = data.banettite;
	if (!stone) return data;
	data.banettitehalloween = {
		...stone,
		name: STONE,
		// A real positive number, like the Z-A stones: National Dex treats a negative
		// item number as not existing ("does not exist in Gen 9").
		num: 2026,
		// The regular Banettite's generation: legal wherever it is, Gen 6 on.
		gen: 6,
		megaStone: { Banette: FORME },
		itemUser: ['Banette'],
		// Not 'Past': National Dex looks for a generation where the item is standard
		// and this one has none, so it was refused as "does not exist in Gen 9" on the
		// RP ladders. Cleared the way the Z-A stones are (za-megas.js).
		isNonstandard: null,
		desc: "Halloween 2026 event item, from the Witching Hour board only. If held by a Banette, it Mega Evolves into the witch Mega Banette: Ghost, Mega Banette's stats (64/165/75/93/83/75), ability Witching Hour (Prankster, and its Ghost moves have 1.2x power). On Mega Evolving, its Poltergeist becomes Witch's Snatch (Ghost, physical, 110 power, 100% accuracy, hits Normal types, removes the target's held item and adds the Ghost type to it).",
		shortDesc: "Halloween 2026 event. Banette: Mega Evolves; Prankster + 1.2x Ghost; Poltergeist becomes Witch's Snatch.",
	};
	return data;
};

exports.abilities = (data) => {
	const prankster = data.prankster;
	data.witchinghour = {
		name: 'Witching Hour',
		num: -30,
		gen: 9,
		rating: 4,
		// Prankster, exactly as the game writes it - Dark types still ignore the boosted move.
		onModifyPriority: prankster && prankster.onModifyPriority,
		// Poltergeist becomes Witch's Snatch the moment this form arrives - Mega
		// Evolution sets the ability and runs this - and stays that way for the
		// battle, base slots included, so a switch out and back in keeps it.
		onStart(pokemon) {
			const snatch = this.dex.moves.get("Witch's Snatch");
			let changed = false;
			for (const slots of [pokemon.moveSlots, pokemon.baseMoveSlots]) {
				for (const slot of slots || []) {
					if (slot.id !== 'poltergeist') continue;
					slot.id = snatch.id;
					slot.move = snatch.name;
					changed = true;
				}
			}
			// The Mega Evolution turn: the Poltergeist it was about to use is already
			// queued, and would find no such move left - so the queued action changes too.
			const queued = this.queue.willMove(pokemon);
			if (queued && queued.move && queued.move.id === 'poltergeist') {
				queued.move = this.dex.getActiveMove(snatch.id);
				queued.moveid = snatch.id;
			}
			if (changed) this.add('-message', `${pokemon.name}'s Poltergeist became Witch's Snatch!`);
		},
		onBasePowerPriority: 21,
		onBasePower(basePower, attacker, defender, move) {
			if (move.type === 'Ghost') return this.chainModify([4915, 4096]);
		},
		flags: {},
		shortDesc: "Prankster; Ghost-type moves have 1.2x power. Halloween 2026 event form.",
		desc: "This Pokemon's non-damaging moves have their priority increased by 1; opposing Dark-type Pokemon are immune to these moves. This Pokemon's Ghost-type attacks have their power multiplied by 1.2.",
	};
	return data;
};

exports.moves = (data) => {
	data.witchssnatch = {
		num: -40,
		accuracy: 100,
		basePower: 110,
		category: 'Physical',
		name: "Witch's Snatch",
		pp: 10,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// Mind's Eye the other way round: a Ghost move Normal types are not immune to.
		ignoreImmunity: { Ghost: true },
		// Knock Off's own removal: the item is taken after the hit, and whatever
		// refuses to be taken (a Mega Stone on its owner, a Z-Crystal) stays.
		onAfterHit(target, source) {
			if (source.hp) {
				const item = target.takeItem();
				if (item) this.add('-enditem', target, item.name, "[from] move: Witch's Snatch", `[of] ${source}`);
			}
			// And the curse: Trick-or-Treat's added Ghost type, so the next one lands harder.
			if (target.hp && !target.hasType('Ghost') && target.addType('Ghost')) {
				this.add('-start', target, 'typeadd', 'Ghost', "[from] move: Witch's Snatch");
			}
		},
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: "Hits Normal types. Removes the target's item and adds Ghost to its types.",
		desc: "Normal-type Pokemon are not immune to this move. If the target is holding an item that can be removed, it is taken away after the hit, and the target gains the Ghost type in addition to its own, as Trick-or-Treat does. Poltergeist becomes this move when Banette Mega Evolves into its Halloween 2026 form.",
	};
	return data;
};

exports.learnsets = (data) => {
	// Banette's own, so the Mega learns it through its base form.
	// Witch's Snatch is never learned - Poltergeist turns into it (see the
	// ability). The Banette line has Poltergeist already; make sure it stays.
	for (const id of ['banette', 'shuppet']) {
		if (data[id] && data[id].learnset && !data[id].learnset.poltergeist) data[id].learnset.poltergeist = ['9M'];
	}
	return data;
};

// Found by typing "event" in the teambuilder's Pokemon search (scripts/build-buffs.js
// collects EVENT_SPECIES from every event file). Banette too: it is the one that holds the stone.
exports.EVENT_SPECIES = ['banette', 'banettemegahalloween'];

exports.FORME = FORME;
exports.STONE = STONE;
