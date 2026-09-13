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

	// Sprites are served by this server, from its root - absolute, not relative.
	// A replay lives at /replay/<id>, so a relative path would look for them
	// under /replay/ and find nothing: she rendered as a broken image in every
	// replay while being perfectly fine in the client.
	var SPRITES = '/sprites/';

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

		installSearch();

		// Each of these needs something that loads after this file - the builder's
		// table, the search class, the sprite helpers - so none of them is allowed
		// to say the job is done on its own. The retry below keeps going until they
		// all agree, which is how the move-ordering hook used to get skipped: the
		// table landed first, the loop stopped, and the class it needed arrived to
		// an empty room.
		var tableIn = installTeambuilder();
		var orderIn = installMoveOrder();
		var spritesIn = installSprites();
		var iconIn = installIcon();
		var builderIn = installTeambuilderSprite();
		var tipsIn = installTooltipStats();
		var rpIn = installRpTiers();
		var listIn = installPokemonOrder();
		return tableIn && orderIn && spritesIn && iconIn && builderIn && tipsIn && rpIn && listIn;
	}

	/**
	 * Samantha at the top of the Pokemon list, in her own tier, in every format.
	 *
	 * The list a format offers is a slice of one big array ordered by tier, so
	 * there is no single position in it that is inside every tier: at the end she
	 * appears in OU and vanishes from Custom Game, above AG the reverse. Adding
	 * her to the results instead - after the list has been sliced - puts her in
	 * all of them, under a header of her own.
	 *
	 * Display only. Whether she is *legal* is the server's business, and the
	 * answer is no everywhere except RP Battle; the builder still marks her
	 * illegal in a tier she cannot be used in, which is the honest thing to show.
	 */
	function installPokemonOrder() {
		var search = window.BattlePokemonSearch;
		if (!search || !search.prototype || !search.prototype.getBaseResults) return false;
		if (search.__velvetOrder) return true;
		search.__velvetOrder = true;

		var original = search.prototype.getBaseResults;
		search.prototype.getBaseResults = function () {
			var results = original.apply(this, arguments);
			if (!results || !results.length) return results;

			var already = false;
			for (var i = 0; i < results.length; i++) {
				if (results[i][1] === 'samantha') { already = true; break; }
			}
			if (already) return results;

			return [['header', 'Dev'], ['pokemon', 'samantha']].concat(results);
		};
		return true;
	}

	/**
	 * Signature moves first, for whoever is being edited.
	 *
	 * A signature move is one only that evolution family can learn - Ivy Cudgel,
	 * Kowtow Cleave, Dark Void - and it is usually the move the list was opened
	 * to find. Alphabetical order buries it: Ogerpon's list starts at Acrobatics.
	 *
	 * Which moves those are is worked out from the dex at build time by
	 * scripts/build-signature-moves.js and shipped as a table: 148 families in
	 * 11KB. Working it out here would mean walking every learnset in the game on
	 * every page load.
	 *
	 * Samantha is not in that table and cannot be - she learns everything, so by
	 * the definition she owns nothing - so her three are named here.
	 */
	var HER_MOVES = ['queenbeam', 'queensdance', 'queensheal'];

	function signatureMovesFor(speciesid) {
		if (speciesid === 'samantha') return HER_MOVES;
		var table = window.VelvetSignatureMoves;
		return (table && table.get && table.get(speciesid)) || [];
	}

	function installMoveOrder() {
		var search = window.BattleMoveSearch;
		if (!search) return false;
		if (search.__velvetOrder) return true;
		search.__velvetOrder = true;

		var original = search.prototype.getBaseResults;
		search.prototype.getBaseResults = function () {
			var results = original.apply(this, arguments);
			if (!results) return results;

			var species = this.species;
			if (species && typeof species !== 'string') species = species.species || species.name || '';
			var own = signatureMovesFor(window.toID(species || ''));
			if (!own.length) return results;

			// Only the ones this list actually offers: a signature move the format
			// has banned, or that this forme cannot use, should not be conjured up.
			var offered = {};
			for (var i = 0; i < results.length; i++) {
				if (results[i][0] === 'move') offered[results[i][1]] = true;
			}
			var hoist = [];
			for (var j = 0; j < own.length; j++) {
				if (offered[own[j]]) hoist.push(own[j]);
			}
			if (!hoist.length) return results;

			var hoisted = [['header', hoist.length === 1 ? 'Signature move' : 'Signature moves']];
			for (var k = 0; k < hoist.length; k++) hoisted.push(['move', hoist[k]]);

			var rest = [];
			for (var m = 0; m < results.length; m++) {
				var row = results[m];
				if (row[0] === 'move' && hoist.indexOf(row[1]) >= 0) continue;
				rest.push(row);
			}
			return hoisted.concat(rest);
		};
		return true;
	}
	/**
	 * Show National Dex tiers when building for an RP tier.
	 *
	 * RP is this server's own National Dex, and the tiers stand on Smogon's ND
	 * lists - but the builder works out which list to show from the format's
	 * *name*, looking for 'nationaldex' or 'natdex' in it. `gen9rpou` matches
	 * nothing, so it fell back to the plain ninth-generation list: past-generation
	 * Pokemon marked illegal, and tiers that do not match what the server will
	 * actually accept.
	 *
	 * So the search - and only the search - is told the National Dex name instead.
	 * The team keeps its own format, the server validates against the real one,
	 * and the builder shows the tiers the tier is built from.
	 */
	var RP_TIERS = {
		gen9rpou: 'gen9nationaldex',
		gen9rpubers: 'gen9nationaldexubers',
		gen9rpuu: 'gen9nationaldexuu',
		gen9rpru: 'gen9nationaldexru',
		// Below RU there is no National Dex list, so these stand on the ninth
		// generation's own - which is also what the builder should show for them.
		gen9rpnu: 'gen9nu',
		gen9rppu: 'gen9pu',
		gen9rpzu: 'gen9zu',
	};

	function installRpTiers() {
		var search = window.DexSearch;
		if (!search || !search.prototype || !search.prototype.getTypedSearch) return false;
		if (search.__velvetRpTiers) return true;
		search.__velvetRpTiers = true;

		var original = search.prototype.getTypedSearch;
		search.prototype.getTypedSearch = function (searchType, format, speciesOrSet) {
			var mapped = RP_TIERS[window.toID(format || '')];
			return original.call(this, searchType, mapped || format, speciesOrSet);
		};
		return true;
	}

	/**
	 * Make her findable by typing, not just by scrolling.
	 *
	 * The search box does not scan the dex. It binary-searches BattleSearchIndex,
	 * a list sorted by id, so an entry appended to the end is unreachable: the
	 * search walks past it every time and a name that is really there comes back
	 * as no results. That is why she only turned up if you scrolled the whole
	 * Custom Game list.
	 *
	 * So each entry goes in at its sorted position, and two things have to move
	 * with it. BattleSearchIndexOffset is a parallel array - one string per row,
	 * mapping each character of the id to where it sits in the display name, which
	 * is how "queen beam" highlights correctly - and it is indexed by row number,
	 * so an insert that skips it shifts every offset after it onto the wrong row.
	 * Alias rows are worse: they carry the row number of the entry they point at,
	 * so every one of them after the insert has to be pushed along by one or it
	 * starts naming the wrong Pokemon.
	 *
	 * The offsets: '0' means the character sits where it does in the id, and each
	 * step up counts one extra character in the display name before it - a space
	 * in "Queen Beam", an apostrophe and a space in "Queen's Dance".
	 */
	function installSearch() {
		var index = window.BattleSearchIndex;
		if (!index || !index.length) return;
		var offsets = window.BattleSearchIndexOffset;

		var rows = [
			['samantha', 'pokemon', ''],
			['queenbeam', 'move', '000001111'],
			['queensdance', 'move', '00000122222'],
			['queensheal', 'move', '0000012222'],
			['queenwrath', 'ability', '0000011111'],
			['queensmorph', 'ability', '00000122222'],
		];

		for (var r = 0; r < rows.length; r++) {
			var id = rows[r][0];

			// Where it belongs, by the same comparison the search itself uses.
			var low = 0, high = index.length;
			while (low < high) {
				var mid = (low + high) >> 1;
				if (index[mid][0] < id) low = mid + 1;
				else high = mid;
			}
			if (index[low] && index[low][0] === id) continue;

			index.splice(low, 0, [id, rows[r][1]]);
			if (offsets) offsets.splice(low, 0, rows[r][2]);

			// Every alias pointing at or past the insert now points one row early.
			for (var i = 0; i < index.length; i++) {
				var entry = index[i];
				if (entry.length > 2 && typeof entry[2] === 'number' && entry[2] >= low) entry[2]++;
			}
		}
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

		// Her place in the list is not decided here, and cannot be: every tier's
		// list is a *slice* of this array, so any single position is inside some
		// tiers and outside others - at the end she shows up in OU and not in the
		// Custom Game browse list; above AG, the reverse. installPokemonOrder()
		// puts her at the top of the results instead, which is one place that is
		// inside every tier.

		var landed = false;
		for (var i = 0; i < targets.length; i++) {
			var t = targets[i];
			// What the builder calls her tier when it labels her.
			if (t.overrideTier) {
				t.overrideTier.samantha = 'Dev';
				landed = true;
			}
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

		// '9a': generation 9, obtainable in Paldea. The 'a' is not decoration -
		// in gen 9 the builder throws away every move whose entry lacks it, which
		// is region-born legality, so a learnset of '9M' listed her whole movepool
		// and the move box still came up empty.
		var mine = {};
		var signature = ['queenbeam', 'queensdance', 'queensheal'];
		for (var i = 0; i < signature.length; i++) mine[signature[i]] = '9a';
		for (var id in window.BattleMovedex) {
			if (!mine[id]) mine[id] = '9a';
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
		if (!window.Dex || !window.Dex.getSpriteData) return false;
		if (window.Dex.__velvetSprites) return true;
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
			// Who is being drawn. The client passes a name in some places and a
			// Pokemon in others, and the two kinds of Pokemon it has do not agree on
			// how to ask: the battle's own objects carry `speciesForme` as a plain
			// property, while a set from the builder answers `getSpeciesForme()`.
			// Reading only one of them is why she rendered everywhere except the
			// team preview.
			var name = pokemon;
			if (name && typeof name === 'object') {
				name = (name.getSpeciesForme && name.getSpeciesForme()) ||
					name.speciesForme || name.species || name.name || '';
			}
			if (typeof name === 'string' && window.toID(name) === 'samantha') {
				// Animated unless this viewer has turned animation off, which is the
				// same pair of preferences the client checks for everyone else - so
				// the 2D/animated switch in Options does something for her too.
				var animated = true;
				try {
					animated = !window.Dex.prefs('noanim') && !window.Dex.prefs('nogif');
				} catch (e) { /* no prefs yet; animation is the default */ }

				var art = animated ?
					(isFront ? ['samantha-front.gif', 80, 140] : ['samantha-back.gif', 74, 116]) :
					(isFront ? ['samantha.png', 95, 140] : ['samantha-back.png', 68, 116]);

				data.url = SPRITES + art[0];
				data.w = art[1];
				data.h = art[2];
				data.y = isFront ? -14 : -6;
				data.pixelated = true;
				// Whatever she is drawn from, it is one file - there is no sprite sheet
				// for the client to index into and no cry to play.
				data.isBackSprite = !isFront;
				data.cryurl = '';
			}
			return data;
		};
		return true;
	}

	/**
	 * Show what her ability and her Light Ball are actually doing.
	 *
	 * The tooltip does not read stats off the server - it recalculates them, and
	 * applies the modifiers it knows about by name: Huge Power doubles Attack,
	 * Light Ball doubles Pikachu's. Neither test matches her, so her numbers were
	 * shown raw while the damage told a different story.
	 *
	 * Both halves double both attacking stats, and they stack the way the server
	 * stacks them. A ceiling is applied at the end for the same reason the server
	 * needs none: this is only a display, and four digits is where the box stops
	 * being readable.
	 */
	function installTooltipStats() {
		var tips = window.BattleTooltips;
		if (!tips || !tips.prototype || !tips.prototype.calculateModifiedStats) return false;
		if (tips.__velvetStats) return true;
		tips.__velvetStats = true;

		var original = tips.prototype.calculateModifiedStats;
		tips.prototype.calculateModifiedStats = function (clientPokemon, serverPokemon, statStagesOnly) {
			var stats = original.apply(this, arguments);
			var mon = serverPokemon || clientPokemon;
			if (!stats || !mon) return stats;

			var species = mon.speciesForme || mon.species || (mon.getSpeciesForme && mon.getSpeciesForme()) || '';
			if (window.toID(species) !== 'samantha') return stats;

			var ability = window.toID(
				(clientPokemon && clientPokemon.ability) || (serverPokemon && serverPokemon.ability) || ''
			);
			var item = window.toID(mon.item || '');

			if (ability === 'queenwrath') {
				stats.atk *= 2;
				stats.spa *= 2;
			}
			if (item === 'lightball') {
				stats.atk *= 2;
				stats.spa *= 2;
			}

			for (var name in stats) {
				if (stats[name] > 9999) stats[name] = 9999;
			}
			return stats;
		};
		return true;
	}

	/**
	 * The sprite in the teambuilder's own set box.
	 *
	 * Not the same call as the battle sprite: the builder asks for a CSS
	 * background rather than an image, and builds the URL from the species name
	 * against Showdown's CDN, where she does not exist. The box was simply empty.
	 *
	 * Her art is tall where a Pokemon sprite is square, so it is given a size as
	 * well as a URL - left to itself the browser would draw it at full height and
	 * push it out of the box.
	 */
	function installTeambuilderSprite() {
		if (!window.Dex || !window.Dex.getTeambuilderSprite) return false;
		if (window.Dex.__velvetBuilderSprite) return true;
		window.Dex.__velvetBuilderSprite = true;

		var original = window.Dex.getTeambuilderSprite;
		window.Dex.getTeambuilderSprite = function (set, gen) {
			var name = set && (set.species || set.speciesForme || set.name || '');
			if (window.toID(name) === 'samantha') {
				return 'background-image:url(' + SPRITES + 'samantha.png);' +
					'background-position:28px 2px;background-size:50px 74px;background-repeat:no-repeat;';
			}
			return original.call(this, set, gen);
		};
		return true;
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
		if (!window.Dex || !window.Dex.getPokemonIcon) return false;
		if (window.Dex.__velvetIcon) return true;
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
		return true;
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
