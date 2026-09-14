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

	// Who the Elemental Banana works for - the same six the item itself checks.
	var BANANA_FAMILY = {
		pansage: 1, simisage: 1, pansear: 1, simisear: 1, panpour: 1, simipour: 1,
	};

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
		var buffsIn = installBuffs();
		var abilitiesIn = installBuffedAbilities();
		var itemIn = installItemIcon();
		var sigItemIn = installSignatureItem();
		var powerIn = installBuffedBasePower();
		var dmaxIn = installDynamaxBuilder();
		return tableIn && orderIn && spritesIn && iconIn && builderIn && tipsIn && rpIn &&
			listIn && buffsIn && abilitiesIn && itemIn && sigItemIn && powerIn && dmaxIn;
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
			var speciesid = window.toID(species || '');
			var own = signatureMovesFor(speciesid);
			var buffed = buffedMovesFor(speciesid);
			if (!own.length && !buffed.length) return results;

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
			// A move can be both - Simian Rush is Simisage's own and something this
			// server added - and it is listed once, as a signature move.
			var gained = [];
			for (var g = 0; g < buffed.length; g++) {
				if (offered[buffed[g]] && hoist.indexOf(buffed[g]) < 0) gained.push(buffed[g]);
			}
			if (!hoist.length && !gained.length) return results;

			var buffs = window.VelvetBuffs;
			var label = (buffs && buffs.label) || 'Awakened';
			var hoisted = [];
			if (hoist.length) {
				hoisted.push(['header', hoist.length === 1 ? 'Signature move' : 'Signature moves']);
				for (var k = 0; k < hoist.length; k++) hoisted.push(['move', hoist[k]]);
			}
			if (gained.length) {
				hoisted.push(['header', label + (gained.length === 1 ? ' move' : ' moves')]);
				for (var b = 0; b < gained.length; b++) hoisted.push(['move', gained[b]]);
			}

			var taken = hoist.concat(gained);
			var rest = [];
			for (var m = 0; m < results.length; m++) {
				var row = results[m];
				if (row[0] === 'move' && taken.indexOf(row[1]) >= 0) continue;
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
		gen9rpag: 'gen9nationaldexag',
		gen9rpou: 'gen9nationaldex',
		gen9rpubers: 'gen9nationaldexubers',
		gen9rpuu: 'gen9nationaldexuu',
		gen9rpru: 'gen9nationaldexru',
		// Below RU there is no National Dex list, so these stand on the ninth
		// generation's own - which is also what the builder should show for them.
		gen9rpnu: 'gen9nu',
		gen9rppu: 'gen9pu',
		gen9rpzu: 'gen9zu',

		// The past generations, each pointed at whatever it actually stands on.
		// The eighth has a National Dex and uses it; nothing older has one, so
		// those show that generation's own OU and Ubers.
		gen8rpou: 'gen8nationaldex',
		gen8rpubers: 'gen8nationaldexubers',
		gen7rpou: 'gen7ou',
		gen7rpubers: 'gen7ubers',
		gen6rpou: 'gen6ou',
		gen6rpubers: 'gen6ubers',
		gen5rpou: 'gen5ou',
		gen5rpubers: 'gen5ubers',
		gen4rpou: 'gen4ou',
		gen4rpubers: 'gen4ubers',
		gen3rpou: 'gen3ou',
		gen3rpubers: 'gen3ubers',
		gen2rpou: 'gen2ou',
		gen2rpubers: 'gen2ubers',
		gen1rpou: 'gen1ou',
		gen1rpubers: 'gen1ubers',
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

		// Everything the buffs added - Simian Rush, Wave Charge, Verdant Surge,
		// the Elemental Banana - comes from the generated file rather than being
		// listed twice, so adding a buff does not mean remembering to come here.
		var buffs = window.VelvetBuffs;
		if (buffs && buffs.search) rows = rows.concat(buffs.search);

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
		var buffs = window.VelvetBuffs;
		for (var i = 0; i < targets.length; i++) {
			var t = targets[i];
			// What the builder calls her tier when it labels her.
			if (t.overrideTier) {
				t.overrideTier.samantha = 'Dev';

				/*
				 * And anywhere this server disagrees with Smogon about a tier.
				 *
				 * The builder reads its tiers from the CDN, so a Pokemon this
				 * server moved to Ubers goes on being offered in OU and marked
				 * legal there, right up until the server refuses the team. The
				 * label and the rule have to be the same thing.
				 */
				if (buffs && buffs.tiers) {
					for (var id in buffs.tiers) t.overrideTier[id] = buffs.tiers[id];
				}
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
			var speciesid = window.toID(species);

			var ability = window.toID(
				(clientPokemon && clientPokemon.ability) || (serverPokemon && serverPokemon.ability) || ''
			);
			var item = window.toID(mon.item || '');

			/**
			 * The Elemental Banana, in the numbers the tooltip shows.
			 *
			 * This panel does not ask the server what a stat is - it recalculates
			 * it here, applying each item by name from a list that necessarily
			 * knows nothing about ours. So the banana was doing its 1.3x in the
			 * battle and showing none of it in the tooltip, which is worse than
			 * showing nothing: the number was confidently wrong.
			 *
			 * The family check matches the item's own, and the ripened multiplier
			 * matches too - 1.5x once this Pokemon has Terastallized or Dynamaxed.
			 */
			if (item === 'elementalbanana' && BANANA_FAMILY[speciesid]) {
				var tera = !!(clientPokemon && (clientPokemon.terastallized || clientPokemon.teraType && clientPokemon.terastallized));
				var maxed = !!(clientPokemon && clientPokemon.volatiles && clientPokemon.volatiles.dynamax);
				var ripe = tera || maxed ? 1.5 : 1.3;
				stats.atk = Math.floor(stats.atk * ripe);
				stats.spa = Math.floor(stats.spa * ripe);
				stats.spe = Math.floor(stats.spe * ripe);
			}

			if (speciesid !== 'samantha') {
				for (var capped in stats) {
					if (stats[capped] > 9999) stats[capped] = 9999;
				}
				return stats;
			}

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
	/**
	 * The buffs: what this server added to Pokemon that already existed.
	 *
	 * Everything here is read from window.VelvetBuffs, which is generated from
	 * data/velvet/buffs.js - see scripts/build-buffs.js. Nothing about which
	 * Pokemon or which moves is written twice, so a new buff needs no change in
	 * this file.
	 *
	 * Three separate things have to happen before a buffed Pokemon looks right:
	 * the moves and abilities we invented need rows in the client's dex, the
	 * Pokemon's own entry needs its new ability slots, and the builder's learnset
	 * table needs the moves. Miss the last one and the ability shows up while the
	 * movepool stays exactly as it was.
	 */
	function installBuffs() {
		var buffs = window.VelvetBuffs;
		if (!buffs) return false;
		var ready = true;

		/*
		 * Things this server brought into the game that the client still thinks
		 * do not exist.
		 *
		 * The Z-A Megas and their stones ship marked 'Future', which the client
		 * reads as "not in this generation" and draws as illegal. The server
		 * cleared that flag weeks of work ago; the builder never heard, so Mega
		 * Chandelure was refused in the one place a player actually picks it.
		 */
		unlock(window.BattlePokedex, buffs.unlocked && buffs.unlocked.species);
		unlock(window.BattleItems, buffs.unlocked && buffs.unlocked.items);

		// The rows the CDN has no idea about.
		if (window.BattleMovedex) {
			for (var m in buffs.moves) if (!window.BattleMovedex[m]) window.BattleMovedex[m] = buffs.moves[m];
			correct(window.BattleMovedex, buffs.overrides && buffs.overrides.moves);
		} else ready = false;
		if (window.BattleAbilities) {
			for (var a in buffs.abilities) if (!window.BattleAbilities[a]) window.BattleAbilities[a] = buffs.abilities[a];
			correct(window.BattleAbilities, buffs.overrides && buffs.overrides.abilities);
		} else ready = false;
		if (window.BattleItems) {
			for (var i in buffs.items) if (!window.BattleItems[i]) window.BattleItems[i] = buffs.items[i];
		} else ready = false;

		// The ability slots, straight from the server's own table - including any
		// slot past the four a species is built with, which is how a buffed
		// Pokemon ends up with more than three abilities to choose from.
		if (window.BattlePokedex) {
			for (var id in buffs.bySpecies) {
				var entry = window.BattlePokedex[id];
				// Only the Pokemon whose abilities actually changed carry a slot
				// table; everyone else keeps the one the client already has.
				var slots = buffs.bySpecies[id].slots;
				if (entry && slots) entry.abilities = slots;
			}
		} else ready = false;

		// The movepool. Merged into what is already there, never replacing it:
		// this table is the only copy of the Pokemon's real learnset the builder
		// has, and a species whose entry got overwritten would be left with the
		// nineteen moves we added and nothing it was born with.
		var table = window.BattleTeambuilderTable;
		if (table && table.learnsets) {
			for (var id2 in buffs.bySpecies) {
				var learnset = table.learnsets[id2] || (table.learnsets[id2] = {});
				var added = buffs.bySpecies[id2].moves;
				for (var k = 0; k < added.length; k++) {
					// '9a' is generation 9 plus the region-born letter the builder
					// insists on before it will list a move in a ninth-generation
					// format. These Pokemon were never in Scarlet and Violet, so
					// their real entries stop at '...9pq' and a buff written without
					// the 'a' is listed in National Dex and invisible everywhere else.
					if (!learnset[added[k]]) learnset[added[k]] = '9a';
				}
			}
		} else ready = false;

		return ready;
	}

	/** Stop the client calling something nonstandard that this server standardised. */
	function unlock(table, ids) {
		if (!table || !ids) return;
		for (var i = 0; i < ids.length; i++) {
			var entry = table[ids[i]];
			if (entry && entry.isNonstandard) entry.isNonstandard = null;
		}
	}

	/**
	 * Rows the client already has, and has wrong.
	 *
	 * The client builds its dex from Showdown's own data files, so anything this
	 * server corrects is corrected in the battle and nowhere a player can read
	 * it: the teambuilder went on saying Dark Void was 50% accurate long after
	 * it was 80% in every battle, and Recover still claimed 5 PP. A number
	 * somebody reads and the number the game uses have to be the same number,
	 * and that goes for the description under it too.
	 *
	 * Fields are copied one at a time rather than the row being replaced: the
	 * client keeps things on these objects that the server has never heard of,
	 * and a wholesale swap would quietly drop them.
	 */
	function correct(table, rows) {
		if (!table || !rows) return;
		for (var id in rows) {
			var target = table[id];
			if (!target) continue;
			var row = rows[id];
			for (var key in row) {
				if (row[key] !== undefined && row[key] !== null) target[key] = row[key];
			}
		}
	}

	/** The buffed moves this Pokemon got, if any. */
	function buffedMovesFor(speciesid) {
		var buffs = window.VelvetBuffs;
		var record = buffs && buffs.get ? buffs.get(speciesid) : null;
		return record ? record.moves : [];
	}

	/**
	 * More than three abilities, and a name on the ones that are ours.
	 *
	 * The builder reads a species' abilities out of four fixed slots - the two
	 * ordinary ones, the hidden one, and the event one - so an ability in a fifth
	 * slot is simply never drawn, and an ability we added to a slot that happened
	 * to be free is drawn as though it had always been there. Both are wrong for
	 * the same reason: a player cannot tell what this server changed.
	 *
	 * So the ones a buff added are pulled out of wherever they landed and shown
	 * together at the top, under a heading of their own, and anything past the
	 * four known slots is picked up on the way - which is what makes a fourth,
	 * fifth or sixth ability possible at all.
	 */
	function installBuffedAbilities() {
		var search = window.BattleAbilitySearch;
		if (!search || !search.prototype || !search.prototype.getBaseResults) return false;
		if (search.__velvetBuffedAbilities) return true;
		search.__velvetBuffedAbilities = true;

		var original = search.prototype.getBaseResults;
		search.prototype.getBaseResults = function () {
			var results = original.apply(this, arguments);
			var buffs = window.VelvetBuffs;
			if (!results || !buffs) return results;

			var species = this.species;
			if (species && typeof species !== 'string') species = species.species || species.name || '';
			var record = buffs.get(window.toID(species || ''));
			if (!record || !record.abilities.length) return results;

			// By id, because the rows carry ids and the record carries names.
			var ours = {};
			for (var i = 0; i < record.abilities.length; i++) ours[window.toID(record.abilities[i])] = true;

			var listed = {};
			var rest = [];
			for (var j = 0; j < results.length; j++) {
				var row = results[j];
				if (row[0] === 'ability' && ours[row[1]]) { listed[row[1]] = true; continue; }
				rest.push(row);
			}

			// Anything in a slot the builder does not know how to draw never made
			// it into the results at all, so it is added here rather than moved.
			var hoist = [];
			for (var k = 0; k < record.abilities.length; k++) {
				var abilityid = window.toID(record.abilities[k]);
				if (window.BattleAbilities && !window.BattleAbilities[abilityid]) continue;
				hoist.push(abilityid);
			}
			if (!hoist.length) return results;

			var header = [['header', buffs.label + (hoist.length === 1 ? ' ability' : ' abilities')]];
			var rows = [];
			for (var n = 0; n < hoist.length; n++) rows.push(['ability', hoist[n]]);
			return header.concat(rows, rest);
		};
		return true;
	}

	/**
	 * Dynamax Level and Gigantamax, in the builder, for the RP tiers.
	 *
	 * The RP tiers offer all three gimmicks, so a Charizard here really can
	 * Gigantamax - the server accepts the set, the battle fires G-Max Wildfire,
	 * and the only thing missing was any way to ask for it. The builder draws
	 * both controls inside a `gen === 8` branch, because on Showdown those are
	 * the only formats where Dynamax exists.
	 *
	 * Only the drawing is gated, though. What reads the form back is not: it
	 * looks for `input[name=gigantamax]` and `input[name=dynamaxlevel]` wherever
	 * they happen to be and saves what it finds. So the fix is to put the two
	 * rows on the page and let the existing code do the rest - no save path of
	 * ours, and nothing to keep in step if they change how a set is stored.
	 */
	function installDynamaxBuilder() {
		var room = window.TeambuilderRoom;
		if (!room || !room.prototype || !room.prototype.updateDetailsForm) return false;
		if (room.__velvetDynamax) return true;
		room.__velvetDynamax = true;

		var original = room.prototype.updateDetailsForm;
		room.prototype.updateDetailsForm = function () {
			var out = original.apply(this, arguments);
			try {
				addDynamaxRows(this);
			} catch (e) {
				// A missing row is better than a builder that will not draw.
			}
			return out;
		};
		return true;
	}

	function addDynamaxRows(room) {
		var set = room.curSet;
		var team = room.curTeam;
		if (!set || !team || !room.$chart) return;
		// Generation 8 already has both, drawn by the client itself.
		if (team.gen === 8) return;
		if (String(team.format || '').indexOf('gen9rp') !== 0) return;

		var dex = team.dex || window.Dex;
		var species = dex && dex.species ? dex.species.get(set.species) : null;
		if (!species || !species.exists) return;

		// A generation-9 dex may drop the Gigantamax flag on its way through, so
		// the raw table is the fallback: the flag is a fact about the Pokemon
		// rather than about the format being built for.
		var raw = window.BattlePokedex && window.BattlePokedex[window.toID(set.species)];
		var canGmax = species.canGigantamax || species.forme === 'Gmax' ||
			(raw && (raw.canGigantamax || raw.forme === 'Gmax'));

		var $form = room.$chart.find('form.detailsform');
		if (!$form.length) return;
		if ($form.find('input[name=gigantamax], input[name=dynamaxlevel]').length) return;

		var buf = '';
		if (!species.cannotDynamax) {
			buf += '<div class="formrow"><label class="formlabel">Dmax Level:</label><div>' +
				'<input type="number" min="0" max="10" step="1" name="dynamaxlevel" value="' +
				(typeof set.dynamaxLevel === 'number' ? set.dynamaxLevel : 10) + '" /></div></div>';
		}
		if (canGmax) {
			buf += '<div class="formrow"><label class="formlabel">Gigantamax:</label><div>';
			if (species.forme === 'Gmax') {
				buf += 'Yes';
			} else {
				buf += '<label class="checkbox inline"><input type="radio" name="gigantamax" value="yes"' +
					(set.gigantamax ? ' checked' : '') + ' /> Yes</label> ';
				buf += '<label class="checkbox inline"><input type="radio" name="gigantamax" value="no"' +
					(!set.gigantamax ? ' checked' : '') + ' /> No</label>';
			}
			buf += '</div></div>';
		}
		if (buf) $form.append(buf);
	}

	/**
	 * Verdant Surge's extra boost, in the move tooltip.
	 *
	 * The tooltip recomputes base power from its own list of modifiers, the same
	 * way the stat panel recomputes stats, so an ability it has never heard of
	 * simply does not exist to it: Simisage's Grass moves showed the ordinary
	 * 1.3x from Grassy Terrain while the battle was applying 1.5x. The damage was
	 * right and the number above it was wrong, which is the worst of both.
	 *
	 * Applied as a second factor on top of the terrain's, rather than as a
	 * replacement, because that is exactly what the server does: 4726/4096 after
	 * a 1.3x is 1.5x, chained in the same order with the same rounding.
	 */
	function installBuffedBasePower() {
		var tips = window.BattleTooltips;
		if (!tips || !tips.prototype || !tips.prototype.getMoveBasePower) return false;
		if (tips.__velvetBasePower) return true;
		tips.__velvetBasePower = true;

		var original = tips.prototype.getMoveBasePower;
		tips.prototype.getMoveBasePower = function (move, moveType, value, target) {
			var out = original.apply(this, arguments);
			try {
				var pokemon = value && value.pokemon;
				var serverPokemon = value && value.serverPokemon;
				var ability = window.toID(
					(pokemon && pokemon.ability) || (serverPokemon && serverPokemon.ability) || ''
				);
				var grassy = this.battle && this.battle.hasPseudoWeather &&
					this.battle.hasPseudoWeather('Grassy Terrain');
				var grounded = !pokemon || !pokemon.isGrounded || pokemon.isGrounded(serverPokemon);
				if (ability === 'verdantsurge' && moveType === 'Grass' && grassy && grounded && out && out.modify) {
					out.modify(4726 / 4096, 'Verdant Surge');
				}
			} catch (e) {
				// A tooltip is never worth throwing over.
			}
			return out;
		};
		return true;
	}

	/**
	 * A signature item, at the top of the item list, for everyone it belongs to.
	 *
	 * The builder does float an item towards the top for the species named in
	 * its `itemUser`, which is how Pikachu finds the Light Ball - but it is a
	 * nudge in the sort order with nothing said about why, and an item that
	 * exists for exactly one family deserves the same treatment its moves get.
	 *
	 * Driven entirely by `itemUser`, so this covers the pre-evolutions without
	 * naming them: the Elemental Banana lists all six of the simi family, and a
	 * Pansear sees it at the top for the same reason a Simisear does.
	 */
	function installSignatureItem() {
		var search = window.BattleItemSearch;
		if (!search || !search.prototype || !search.prototype.getBaseResults) return false;
		if (search.__velvetSignatureItem) return true;
		search.__velvetSignatureItem = true;

		var original = search.prototype.getBaseResults;
		search.prototype.getBaseResults = function () {
			var results = original.apply(this, arguments);
			var buffs = window.VelvetBuffs;
			if (!results || !buffs || !buffs.items) return results;

			var speciesName = this.species;
			if (speciesName && typeof speciesName !== 'string') {
				speciesName = speciesName.species || speciesName.name || '';
			}
			var speciesid = window.toID(speciesName || '');
			if (!speciesid) return results;
			var species = window.Dex && window.Dex.species ? window.Dex.species.get(speciesid) : null;

			var mine = [];
			for (var id in buffs.items) {
				var users = buffs.items[id].itemUser || [];
				for (var u = 0; u < users.length; u++) {
					if (window.toID(users[u]) === speciesid) { mine.push(id); break; }
				}
			}

			var stones = megaStonesFor(this, species);
			if (!mine.length && !stones.length) return results;

			var taken = mine.concat(stones);
			var rest = [];
			for (var i = 0; i < results.length; i++) {
				var row = results[i];
				if (row[0] === 'item' && taken.indexOf(row[1]) >= 0) continue;
				rest.push(row);
			}

			var hoisted = [];
			if (mine.length) {
				hoisted.push(['header', mine.length === 1 ? 'Signature item' : 'Signature items']);
				for (var k = 0; k < mine.length; k++) hoisted.push(['item', mine[k]]);
			}
			if (stones.length) {
				hoisted.push(['header', stones.length === 1 ? 'Mega Stone' : 'Mega Stones']);
				for (var s = 0; s < stones.length; s++) hoisted.push(['item', stones[s]]);
			}
			return hoisted.concat(rest);
		};
		return true;
	}

	/**
	 * The Mega Stone that belongs to the Pokemon being built.
	 *
	 * Showdown's builder does know how to turn a stone into a Mega - it reads
	 * `item.megaStone[baseSpecies]` and changes the set's forme - but it never
	 * offers the stone. Every Mega Stone comes back in the "Illegal results"
	 * pile, Charizardite X for Charizard in National Dex exactly like
	 * Chandelurite for Chandelure here, so the only way to reach a Mega is to
	 * know the stone's name and type it.
	 *
	 * Hoisting the stone into the ordinary results is what makes it offered, and
	 * makes the forme change follow for free, because the code that does that is
	 * already there and was only ever waiting for someone to pick the item.
	 *
	 * Only where a Mega can actually happen. In a plain ninth-generation format
	 * there is no Mega Evolution, and a stone offered there would be an item
	 * that does nothing.
	 */
	function megaStonesFor(search, species) {
		var format = String(search.format || '');
		var megasWork = format.indexOf('rp') >= 0 || format.indexOf('natdex') >= 0 ||
			format.indexOf('nationaldex') >= 0 || /^gen[1-7]/.test(format);
		if (!megasWork || !window.BattleItems || !species) return [];

		var base = species.baseSpecies || species.name;
		var out = [];
		for (var id in window.BattleItems) {
			var stone = window.BattleItems[id].megaStone;
			if (stone && stone[base]) out.push(id);
		}
		return out;
	}

	/**
	 * The Elemental Banana's icon.
	 *
	 * Item icons are cut out of one shared sprite sheet by number, so an item
	 * that is not on Showdown's sheet has no number to cut at and draws whatever
	 * happens to sit at position zero. Ours is a file of its own, served from
	 * this server, the same way her sprites are.
	 */
	function installItemIcon() {
		if (!window.Dex || !window.Dex.getItemIcon) return false;
		if (window.Dex.__velvetItemIcon) return true;
		var original = window.Dex.getItemIcon;
		window.Dex.__velvetItemIcon = true;
		window.Dex.getItemIcon = function (item) {
			var name = item;
			if (name && typeof name === 'object') name = name.name || name.id || '';
			if (typeof name === 'string' && window.toID(name) === 'elementalbanana') {
				return 'background:transparent url(' + SPRITES + 'elemental-banana.png) no-repeat scroll 0px 0px';
			}
			try {
				return original.call(this, item);
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
