/**
 * Samantha, for the client.
 *
 * The server knows her; the client does not. It loads its dex from Showdown's
 * own CDN into a handful of globals, so anything this server invents is missing
 * from the builder, missing from search, and drawn as a question mark in battle.
 *
 * This adds her to those globals after they load. It only ever adds - nothing
 * here rewrites an existing entry except Light Ball, which gains a holder.
 *
 * Loaded from index.html after the data scripts. Only this server's own client
 * has it; on Showdown's client at psim.us she is still unknown, which cannot be
 * fixed from here.
 */
(function () {
	'use strict';

	// Sprites are served by this server, next to the client itself.
	var SPRITES = 'sprites/';

	var SPECIES = {
		samantha: {
			num: -1,
			name: "Samantha",
			types: ["Dark", "Fairy"],
			genderRatio: { M: 0, F: 1 },
			baseStats: { hp: 250, atk: 250, def: 250, spa: 250, spd: 250, spe: 250 },
			abilities: { 0: "Queen Wrath", 1: "Queen's Morph" },
			heightm: 1.7,
			weightkg: 54,
			color: "Black",
			eggGroups: ["Undiscovered"],
			tier: "Illegal",
			isNonstandard: "Custom",
		},
	};

	var MOVES = {
		queenbeam: {
			num: -1, accuracy: true, basePower: 250, category: "Physical",
			name: "Queen Beam", pp: 30, priority: 0,
			flags: { protect: 1, mirror: 1, metronome: 1 },
			secondary: null, target: "normal", type: "Fairy",
			shortDesc: "Uses her better attacking stat. Fairy and Dark effectiveness. Never misses, ignores abilities.",
			desc: "Deals damage with both Fairy and Dark type effectiveness applied, the way Flying Press combines Fighting and Flying. Does not check accuracy and ignores the target's Ability.",
			isNonstandard: "Custom",
		},
		queensdance: {
			num: -2, accuracy: true, basePower: 0, category: "Status",
			name: "Queen's Dance", pp: 30, priority: 0,
			flags: { snatch: 1, dance: 1, metronome: 1 },
			boosts: { atk: 6, def: 6, spa: 6, spd: 6, spe: 6 },
			secondary: null, target: "self", type: "Fairy",
			shortDesc: "Raises all of the user's stats to the maximum.",
			desc: "Raises the user's Attack, Defense, Special Attack, Special Defense and Speed to +6 each.",
			isNonstandard: "Custom",
		},
		queensheal: {
			num: -3, accuracy: true, basePower: 0, category: "Status",
			name: "Queen's Heal", pp: 30, priority: 0,
			flags: { snatch: 1, heal: 1, metronome: 1 },
			secondary: null, target: "self", type: "Fairy",
			shortDesc: "Heals the user fully and cures its status.",
			desc: "The user is restored to full HP and any non-volatile status condition is cured.",
			isNonstandard: "Custom",
		},
	};

	var ABILITIES = {
		queenwrath: {
			num: -1, name: "Queen Wrath", rating: 5,
			shortDesc: "Doubles Atk and SpA, ignores abilities, blocks priority, Shadow Shield, Sturdy, Magic Guard.",
			desc: "Attack and Special Attack are doubled. This Pokemon's moves ignore the target's Ability. Priority moves cannot touch this side. At full HP, damage taken is halved. Survives a killing blow from full HP and is immune to OHKO moves. Takes no damage from anything that is not a move. Cannot be suppressed by Neutralizing Gas.",
			isNonstandard: "Custom",
		},
		queensmorph: {
			num: -2, name: "Queen's Morph", rating: 5,
			shortDesc: "Transforms into the foe on entry, then +6 Speed. Keeps Shadow Shield, Sturdy and Magic Guard.",
			desc: "On switch-in, this Pokemon Transforms into the opposing Pokemon and then raises its Speed by 6 stages. It keeps Shadow Shield, Sturdy and Magic Guard afterwards, and cannot be suppressed by Neutralizing Gas.",
			isNonstandard: "Custom",
		},
	};

	function install() {
		if (typeof window.BattlePokedex === 'undefined') return false;

		for (var id in SPECIES) if (!window.BattlePokedex[id]) window.BattlePokedex[id] = SPECIES[id];
		if (window.BattleMovedex) {
			for (var m in MOVES) if (!window.BattleMovedex[m]) window.BattleMovedex[m] = MOVES[m];
		}
		if (window.BattleAbilities) {
			for (var a in ABILITIES) if (!window.BattleAbilities[a]) window.BattleAbilities[a] = ABILITIES[a];
		}

		// Light Ball works on her too, and the builder floats an item to the top of
		// the list for the species named in `itemUser` - which is exactly how
		// Pikachu gets it. Adding her there gets the same behaviour for free.
		if (window.BattleItems && window.BattleItems.lightball) {
			var users = window.BattleItems.lightball.itemUser || ['Pikachu'];
			if (users.indexOf('Samantha') < 0) users = users.concat(['Samantha']);
			window.BattleItems.lightball.itemUser = users;
		}

		// Searchable by name, like anything else.
		if (window.BattleSearchIndex && window.BattleSearchIndex.push) {
			var known = {};
			for (var i = 0; i < window.BattleSearchIndex.length; i++) known[window.BattleSearchIndex[i][0]] = true;
			var extra = [['samantha', 'pokemon'], ['queenbeam', 'move'], ['queensdance', 'move'],
				['queensheal', 'move'], ['queenwrath', 'ability'], ['queensmorph', 'ability']];
			for (var j = 0; j < extra.length; j++) {
				if (!known[extra[j][0]]) window.BattleSearchIndex.push(extra[j]);
			}
		}

		var tableIn = installTeambuilder();
		installSprites();
		installIcon();
		// Not finished until the builder's own table has her too.
		return tableIn;
	}

	/**
	 * Put her in the builder's list.
	 *
	 * The species list is not the dex - it comes from BattleTeambuilderTable,
	 * a separate file of tier listings, which is why adding her to BattlePokedex
	 * made her lookupable but left the builder empty of her.
	 *
	 * Appended rather than inserted. The table carries `formatSlices`, a set of
	 * indexes into this very array that each format slices from, so putting her
	 * anywhere but the end would silently shift every tier boundary after her.
	 * At the end she is inside every slice, which is the wanted behaviour: she
	 * shows up wherever you look for her, marked illegal everywhere she is
	 * illegal, and selectable in Custom Game.
	 */
	function installTeambuilder() {
		var table = window.BattleTeambuilderTable;
		if (!table) return false;

		// The current generation's list sits at the top level; older ones are
		// nested under their own key. Both shapes get her.
		var targets = [table];
		for (var key in table) {
			if (key.indexOf('gen9') === 0 && table[key] && typeof table[key] === 'object') targets.push(table[key]);
		}

		var landed = false;
		for (var i = 0; i < targets.length; i++) {
			var t = targets[i];

			// Either form: the raw list, or the one already built from it.
			if (t.tiers && t.tiers.push) {
				if (!hasHer(t.tiers)) t.tiers.push(['header', 'Custom'], 'samantha');
				landed = true;
			}
			if (t.tierSet && t.tierSet.push) {
				if (!hasHer(t.tierSet)) t.tierSet.push(['header', 'Custom'], ['pokemon', 'samantha']);
				landed = true;
			}
			// The builder asks the table what tier something is in.
			if (t.overrideTier && !t.overrideTier.samantha) t.overrideTier.samantha = 'Custom';
		}
		installLearnset(table);
		if (!landed) return false;
		return true;
	}

	/**
	 * What the builder offers her, and in what order.
	 *
	 * She learns everything, so without a learnset the builder shows nothing and
	 * with a plain one it shows eight hundred moves in dex order, her own three
	 * buried somewhere in the middle of them.
	 *
	 * The builder walks the learnset in the order its keys were added, so adding
	 * hers first is all it takes to put them first - no sorting to hook, and
	 * nothing that has to be kept in step with how the search ranks results.
	 */
	function installLearnset(table) {
		var learnsets = table.learnsets || (table.learnsets = {});
		if (learnsets.samantha) return;
		if (!window.BattleMovedex) return;

		var mine = {};
		var signature = ['queenbeam', 'queensdance', 'queensheal'];
		for (var i = 0; i < signature.length; i++) mine[signature[i]] = '9M';
		for (var id in window.BattleMovedex) {
			if (!mine[id]) mine[id] = '9M';
		}
		learnsets.samantha = mine;
	}
	function hasHer(list) {
		for (var i = 0; i < list.length; i++) {
			var row = list[i];
			if (row === 'samantha') return true;
			if (row && row.length === 2 && row[1] === 'samantha') return true;
		}
		return false;
	}

	/**
	 * Point her sprites at this server.
	 *
	 * The client builds every sprite URL from Showdown's CDN, where she does not
	 * exist, so the request 404s and she is drawn as a substitute. Wrapping the
	 * one function that builds those URLs is far less invasive than trying to get
	 * her into the CDN's sprite sheets, and it keeps the animated/static/shiny
	 * logic for everybody else exactly as it was.
	 */
	function installSprites() {
		if (!window.Dex || !window.Dex.getSpriteData || window.Dex.__velvetSprites) return;
		var original = window.Dex.getSpriteData;
		window.Dex.__velvetSprites = true;
		window.Dex.getSpriteData = function (pokemon, isFront, options) {
			var data;
			try {
				data = original.call(this, pokemon, isFront, options);
			} catch (e) {
				// The original reads classes this page may not have loaded. Hers does
				// not need them, so fall back rather than take the whole sprite down.
				data = { gen: 9, w: 96, h: 96, y: 0, url: '', pixelated: true, isFrontSprite: !!isFront, cryurl: '', shiny: false };
			}
			var name = pokemon;
			if (name && typeof name !== 'string' && name.getSpeciesForme) name = name.getSpeciesForme();
			if (typeof name === 'string' && window.toID(name) === 'samantha') {
				data.url = SPRITES + (isFront ? 'samantha.png' : 'samantha-back.png');
				data.w = isFront ? 95 : 68;
				data.h = isFront ? 140 : 116;
				data.y = isFront ? -14 : -6;
				data.pixelated = true;
				// She has no animated form, so do not let the client ask for one.
				data.isBackSprite = !isFront;
				data.cryurl = '';
			}
			return data;
		};
	}

	/**
	 * The little icon beside her name in lists.
	 *
	 * Showdown builds these as a background-position into one big sheet of 40x30
	 * cells, indexed by national dex number. She has no number and is not on the
	 * sheet, so the default lands on cell zero - somebody else entirely. Hers is
	 * a standalone file served by this server, so the rule is replaced rather
	 * than the index.
	 */
	function installIcon() {
		if (!window.Dex || !window.Dex.getPokemonIcon || window.Dex.__velvetIcon) return;
		var original = window.Dex.getPokemonIcon;
		window.Dex.__velvetIcon = true;
		window.Dex.getPokemonIcon = function (pokemon, facingLeft) {
			var name = pokemon;
			if (name && typeof name === 'object') name = name.species || name.speciesForme || name.name;
			if (typeof name === 'string' && window.toID(name) === 'samantha') {
				return 'background:transparent url(' + SPRITES + 'samantha-icon.png) no-repeat scroll 0px 0px';
			}
			try {
				return original.call(this, pokemon, facingLeft);
			} catch (e) {
				return '';
			}
		};
	}
	// The data files come from a CDN and arrive in their own time, so each piece
	// is installed as soon as the thing it extends turns up rather than all at
	// once. Every step guards itself, so running repeatedly is harmless.
	var tries = 0;
	function attempt() {
		var done = install();
		if (done || ++tries > 150) clearInterval(timer);
	}
	var timer = setInterval(attempt, 100);
	attempt();
})();
