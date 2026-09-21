'use strict';
/**
 * Halloween 2026: the Witching Hour.
 *
 * The event's Pokemon is a *skin* of Mega Banette, not a new one: the same
 * Ghost-type Mega from a stone of its own, the Banettite-Halloween, with a
 * little on top so owning it feels like something. The ordinary Banettite and
 * the ordinary Mega Banette are untouched.
 *
 *   Banette-Mega-Halloween   64 / 175 / 75 / 93 / 83 / 85 (Mega Banette +10 Atk, +10 Spe)
 *   Witching Hour            Prankster, and its Ghost moves hit 1.2x
 *   Witch's Snatch           Ghost, physical, 110, 100% - takes the target's item
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
		baseStats: { ...mega.baseStats, atk: mega.baseStats.atk + 10, spe: mega.baseStats.spe + 10 },
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
	// Legal wherever Mega Banette is, at Mega Banette's tier.
	if (data.banettemega) data.banettemegahalloween = { ...data.banettemega };
	return data;
};

exports.items = (data) => {
	const stone = data.banettite;
	if (!stone) return data;
	data.banettitehalloween = {
		...stone,
		name: STONE,
		num: -20,
		gen: 9,
		megaStone: { Banette: FORME },
		itemUser: ['Banette'],
		desc: 'Halloween 2026 event item, from the Witching Hour board only. If held by a Banette, this item allows it to Mega Evolve into its limited-time Halloween form in battle.',
		shortDesc: 'Halloween 2026 event: Banette Mega Evolves into its Halloween form.',
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
		// Knock Off's own removal: the item is taken after the hit, and whatever
		// refuses to be taken (a Mega Stone on its owner, a Z-Crystal) stays.
		onAfterHit(target, source) {
			if (source.hp) {
				const item = target.takeItem();
				if (item) this.add('-enditem', target, item.name, "[from] move: Witch's Snatch", `[of] ${source}`);
			}
		},
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: "Removes the target's held item.",
		desc: "If the target is holding an item that can be removed, it is taken away after the hit. Banette's signature from the Halloween 2026 event.",
	};
	return data;
};

exports.learnsets = (data) => {
	// Banette's own, so the Mega learns it through its base form.
	for (const id of ['banette', 'shuppet']) {
		if (data[id] && data[id].learnset) data[id].learnset.witchssnatch = ['9L1'];
	}
	return data;
};

exports.FORME = FORME;
exports.STONE = STONE;
