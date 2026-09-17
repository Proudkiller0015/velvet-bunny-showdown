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

	/**
	 * The art this server serves itself, for Pokemon no CDN has a picture of.
	 *
	 * Three different calls want three different shapes of the same answer - the
	 * battle sprite, the little list icon, the teambuilder's set box - so the
	 * files are named once here and the three hooks below read this rather than
	 * each carrying its own copy. Adding a Pokemon is adding a row.
	 *
	 * `still` is required; `animated` is optional and used only when the viewer
	 * has animation on, which is the same pair of preferences the client checks
	 * for everybody else. Each entry is [file, width, height], because these are
	 * single images rather than cells in a sprite sheet and nothing else knows
	 * how big they are.
	 */
	var ART = {
		samantha: {
			animated: { front: ['samantha-front.gif', 80, 140], back: ['samantha-back.gif', 74, 116] },
			still: { front: ['samantha.png', 95, 140], back: ['samantha-back.png', 68, 116] },
			y: { front: -14, back: -6 },
			icon: 'samantha-icon.png',
			builder: 'background-image:url(#SPRITES#samantha.png);background-position:28px 2px;' +
				'background-size:50px 74px;background-repeat:no-repeat;',
		},
		nuzleafsold: {
			/*
			 * An ordinary sprite, deliberately.
			 *
			 * Both files are 96x96 canvases with the Pokemon standing where the
			 * real Nuzleaf stands inside its own (scripts/make-nuzleaf-sold.js
			 * measures that rather than guessing), so nothing here has to say how
			 * big it is or where to put it - `standard` means swap the URL and
			 * leave every number the client worked out alone. The first version
			 * was cropped to its own edges at 86x96, which is not a shape anything
			 * in the client expects: it was too big in the battle, too low in the
			 * teambuilder, and wrong in a third way in the list icon.
			 */
			standard: true,
			still: { front: ['nuzleaf-sold.png', 96, 96], back: ['nuzleaf-sold-back.png', 96, 96] },
			icon: 'nuzleaf-sold-icon.png',
			// The set box draws a sprite the way gen 5 sprites are drawn there.
			builder: 'background-image:url(#SPRITES#nuzleaf-sold.png);' +
				'background-position:10px 5px;background-repeat:no-repeat;',
		},
	};

	/*
	 * Megas Showdown has no sprite for - most of the Z-A ones (its CDN only has an
	 * April Fools placeholder for Heatran's). Standard 96x96 front and back sprites
	 * from PokeAPI's sprite collection, drawn like any other gen 5 sprite. Mega
	 * Zygarde has no pixel sprite anywhere, so its HOME render is scaled down.
	 */
	var MEGA_SPRITES = {
		raichumegax: 'raichu-megax',
		raichumegay: 'raichu-megay',
		staraptormega: 'staraptor-mega',
		heatranmega: 'heatran-mega',
		darkraimega: 'darkrai-mega',
		scolipedemega: 'scolipede-mega',
		scraftymega: 'scrafty-mega',
		eelektrossmega: 'eelektross-mega',
		pyroarmega: 'pyroar-mega',
		malamarmega: 'malamar-mega',
		barbaraclemega: 'barbaracle-mega',
		dragalgemega: 'dragalge-mega',
		magearnamega: 'magearna-mega',
		magearnaoriginalmega: 'magearna-originalmega',
		zeraoramega: 'zeraora-mega',
		falinksmega: 'falinks-mega',
		tatsugiricurlymega: 'tatsugiri-curlymega',
		tatsugiridroopymega: 'tatsugiri-droopymega',
		tatsugiristretchymega: 'tatsugiri-stretchymega',
		zygardemega: 'zygarde-mega',
		// These have a static front on Showdown but no animated sprite and no back
		// sprite at all, so they came up broken in battle. Front and back both from
		// PokeAPI, so the pair matches.
		lucariomegaz: 'lucario-megaz',
		absolmegaz: 'absol-megaz',
		garchompmegaz: 'garchomp-megaz',
		golisopodmega: 'golisopod-mega',
		baxcaliburmega: 'baxcalibur-mega',
	};
	Object.keys(MEGA_SPRITES).forEach(function (id) {
		var file = MEGA_SPRITES[id];
		ART[id] = {
			standard: true,
			still: { front: [file + '.png', 96, 96], back: [file + '-back.png', 96, 96] },
			builder: 'background-image:url(#SPRITES#' + file + '.png);background-position:10px 5px;background-repeat:no-repeat;',
		};
	});

	// Which of ours this is, if it is one of ours at all. The client passes a
	// name in some places and a Pokemon in others, and its two kinds of Pokemon
	// do not agree on how to ask: a battle's own objects carry `speciesForme` as
	// a plain property, while a set from the builder answers getSpeciesForme().
	// Reading only one of them is why Samantha rendered everywhere except the
	// team preview.
	function oursFor(pokemon) {
		var name = pokemon;
		if (name && typeof name === 'object') {
			name = (name.getSpeciesForme && name.getSpeciesForme()) ||
				name.speciesForme || name.species || name.name || '';
		}
		if (typeof name !== 'string' || !name) return null;
		return ART[window.toID(name)] || null;
	}

	var SPECIES = {
		// Reachable only by a Nuzleaf fainting with a Broken Pact, so the
		// teambuilder should never offer it: Custom keeps it out of every legal
		// list, exactly as it does for Samantha. It is here at all because the
		// battle sends `|detailschange|...|Nuzleaf-SOLD` the moment it happens,
		// and a client with no row for that draws a substitute and reports the
		// wrong types in every tooltip.
		nuzleafsold: {
			num: -2,
			name: "Nuzleaf-SOLD",
			baseSpecies: "Nuzleaf",
			forme: "SOLD",
			types: ["Grass", "Dark"],
			baseStats: { hp: 10, atk: 190, def: 10, spa: 190, spd: 10, spe: 190 },
			abilities: { 0: "No Refunds" },
			heightm: 1,
			weightkg: 28,
			color: "Brown",
			eggGroups: ["Field", "Grass"],
			tier: "Illegal",
			isNonstandard: "Custom",
		},

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
		queensblitz: {
			num: -8, accuracy: true, basePower: 200, category: "Physical",
			name: "Queen's Blitz", pp: 10, priority: 6,
			flags: { protect: 1, mirror: 1, metronome: 1 },
			secondary: null, target: "normal", type: "Dark",
			shortDesc: "Goes before switches and Megas. Always STAB, always crits, neutral on every type. Double vs Mega/Dynamax/Tera.",
			desc: "Acts before every other action in the turn, including switching out and Mega Evolution. Always receives the same-type attack bonus, and is always neutrally effective - no type resists it, is immune to it, or is weak to it. It always results in a critical hit, uses whichever of the user's attacking stats is higher, and deals double damage to a target that has Mega Evolved, undergone Primal Reversion or Ultra Burst, Dynamaxed, or Terastallized.",
			isNonstandard: "Custom",
		},
		queensheal: {
			num: -3, accuracy: true, basePower: 0, category: "Status",
			name: "Queen's Heal", pp: 30, priority: 0,
			flags: { snatch: 1, heal: 1, metronome: 1 },
			secondary: null, target: "self", type: "Fairy",
			shortDesc: "Heals the user fully, cures its status, and takes back its held item.",
			desc: "The user is restored to full HP, any non-volatile status condition is cured, and the item it entered the battle holding is returned to it - whether that item was knocked off, stolen, traded away by Trick or Switcheroo, or used up. Anything else it happens to be holding at the time is discarded.",
			isNonstandard: "Custom",
		},
	};

	var ABILITIES = {
		norefunds: {
			num: -6, name: "No Refunds", rating: 2,
			shortDesc: "Cannot be forced out, and is immune to Intimidate.",
			desc: "This Pokemon cannot be forced to switch out by another Pokemon's attack or item, and its Attack cannot be lowered by Intimidate.",
			isNonstandard: "Custom",
		},
		queenwrath: {
			num: -1, name: "Queen Wrath", rating: 5,
			shortDesc: "Doubles Atk and SpA, ignores abilities, blocks priority, Shadow Shield, Sturdy, Magic Guard. Mold Breaker cannot touch it.",
			desc: "Attack and Special Attack are doubled. This Pokemon's moves ignore the target's Ability. Priority moves cannot touch this side. At full HP, damage taken is halved. Survives a killing blow from full HP and is immune to OHKO moves. Takes no damage from anything that is not a move. Cannot be suppressed by Neutralizing Gas, and cannot be ignored by Mold Breaker, Teravolt or Turboblaze.",
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
		var cutIn = installCutMoves();
		var listIn = installPokemonOrder();
		var buffsIn = installBuffs();
		var abilitiesIn = installBuffedAbilities();
		var itemIn = installItemIcon();
		var sigItemIn = installSignatureItem();
		var powerIn = installBuffedBasePower();
		var dmaxIn = installDynamaxBuilder();
		var awakenedIn = installAwakenedSearch();
		var textIn = installDescriptions();
		var zMaxIn = installZAndMax();
		return tableIn && orderIn && spritesIn && iconIn && builderIn && tipsIn && rpIn &&
			cutIn && listIn && buffsIn && abilitiesIn && itemIn && sigItemIn && powerIn && dmaxIn && awakenedIn && textIn && zMaxIn;
	}

	/*
	 * Z-Move and Dynamax on the same Pokemon.
	 *
	 * The RP formats allow both at once, which no real format does, and the battle
	 * UI (Showdown's old client, from their CDN) builds only one set of special move
	 * buttons: Z if the Pokemon can Z-Move, otherwise Max. So a Pokemon holding a
	 * Z-Crystal ticked Dynamax and nothing changed - no Max Move names, no power.
	 *
	 * The move menu is built once more with the Z-Move hidden to get the Max Move
	 * buttons, then as normal, and the Max buttons are added beside the Z ones. The
	 * two checkboxes untick each other, since only one can be used.
	 */
	function installZAndMax() {
		var R = window.BattleRoom;
		if (!R || !R.prototype || !R.prototype.updateMoveControls) return false;
		if (R.prototype.__velvetZMax) return true;
		R.prototype.__velvetZMax = true;
		var original = R.prototype.updateMoveControls;
		R.prototype.updateMoveControls = function () {
			var args = arguments;
			/*
			 * Already Dynamaxed (the turns after): the request still says it can Z-Move,
			 * and the client then draws the Z-moves - names and "1/1" - over the Max Moves.
			 * A Dynamaxed Pokemon can't use one, so the menu is drawn without it.
			 */
			try {
				var r0 = this.request;
				var p0 = this.choice && this.choice.choices ? this.choice.choices.length : 0;
				var c0 = r0 && r0.active && r0.active[p0];
				if (c0 && c0.maxMoves && !c0.canDynamax && c0.canZMove) {
					var heldZ = c0.canZMove;
					delete c0.canZMove;
					try { return original.apply(this, args); } finally { c0.canZMove = heldZ; }
				}
			} catch (e) { /* fall through to the usual menu */ }
			var result = original.apply(this, args);
			try {
				var req = this.request;
				var pos = this.choice && this.choice.choices ? this.choice.choices.length : 0;
				var cur = req && req.active && req.active[pos];
				if (!cur || !cur.canZMove || !cur.canDynamax || !cur.maxMoves || this.$('.movebuttons-max').length) return result;
				var savedZ = cur.canZMove;
				var maxHtml = '';
				delete cur.canZMove;
				try {
					original.apply(this, args);
					maxHtml = this.$('.movebuttons-max').prop('outerHTML') || '';
				} finally {
					cur.canZMove = savedZ;
				}
				result = original.apply(this, args);
				if (maxHtml) {
					this.$('.movebuttons-z').after(maxHtml);
					// The normal buttons answer to both checkboxes.
					this.$('.movebuttons-noz').addClass('movebuttons-nomax');
				}
			} catch (e) { /* leave the menu as Showdown built it */ }
			return result;
		};
		var z = R.prototype.updateZMove;
		var max = R.prototype.updateMaxMove;
		R.prototype.updateZMove = function () {
			var d = this.$('input[name=dynamax]')[0], zb = this.$('input[name=zmove]')[0];
			if (d && zb && d.checked && zb.checked) { d.checked = false; max.call(this); }
			return z.apply(this, arguments);
		};
		R.prototype.updateMaxMove = function () {
			var d = this.$('input[name=dynamax]')[0], zb = this.$('input[name=zmove]')[0];
			if (d && zb && d.checked && zb.checked) { zb.checked = false; z.call(this); }
			return max.apply(this, arguments);
		};
		return true;
	}

	/*
	 * Descriptions: every move, ability and item of ours, and every one we changed.
	 *
	 * The client does not read a description off the dex row. It asks
	 * `getTextEntry`, which looks in the language file (data/text/en.js, loaded
	 * later and on its own) and only falls back to the row when that has nothing -
	 * and by then the Move object it falls back to has no description either. So
	 * Oxidize, Prescience and every other one of ours showed a blank, and a move we
	 * changed showed Game Freak's text. The rows are written into the language
	 * table itself, as soon as it exists, and again if it is ever replaced.
	 */
	function fillDescriptions() {
		var text = window.BattleText;
		var en = text && text.en;
		if (!en || !en.Moves || !en.Abilities || !en.Items) return false;
		if (en.__velvetDescriptions) return true;
		var fill = function (tableName, dexTable, overrides) {
			var table = en[tableName];
			var put = function (id, row) {
				if (!row || (!row.desc && !row.shortDesc)) return;
				var entry = table[id] || (table[id] = { name: row.name });
				if (row.name && !entry.name) entry.name = row.name;
				if (row.desc) entry.desc = row.desc;
				if (row.shortDesc) entry.shortDesc = row.shortDesc;
				// A generation-specific line would otherwise win in older formats.
				for (var g = 1; g <= 8; g++) {
					var gen = entry['gen' + g];
					if (gen && typeof gen === 'object') { delete gen.desc; delete gen.shortDesc; }
				}
			};
			// Ours: negative numbers, whether they came with the buffs or with Samantha.
			for (var id in dexTable || {}) {
				var row = dexTable[id];
				if (row && typeof row.num === 'number' && row.num < 0) put(id, row);
			}
			for (var changed in overrides || {}) put(changed, overrides[changed]);
		};
		var buffs = window.VelvetBuffs || {};
		var over = buffs.overrides || {};
		fill('Moves', window.BattleMovedex, over.moves);
		fill('Abilities', window.BattleAbilities, over.abilities);
		fill('Items', window.BattleItems, over.items);
		en.__velvetDescriptions = true;
		return true;
	}

	function installDescriptions() {
		if (typeof window.getTextEntry !== 'function') return false;
		if (!window.getTextEntry.__velvet) {
			var original = window.getTextEntry;
			var wrapped = function () {
				fillDescriptions();
				return original.apply(this, arguments);
			};
			wrapped.__velvet = true;
			window.getTextEntry = wrapped;
		}
		fillDescriptions();
		return true;
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
	 * Lend a cut Pokemon the TMs it never got offered - in RP, and nowhere else.
	 *
	 * The server already allows these: levelFreeMoves in config/custom-formats.js
	 * forgives exactly the moves scripts/build-cut-moves.js measured, which are
	 * the generation 8 and 9 machine moves a Pokemon would have been handed had
	 * it not been cut from those games. The builder has no idea, because it
	 * builds its dex from Showdown's CDN where Pidgeot does not learn Tera Blast
	 * - so the move was legal in RP and could not be picked, which is the
	 * offer-and-refuse bug with its halves swapped.
	 *
	 * Lent rather than given. There is one learnset table and every format reads
	 * it, so writing these in permanently would offer them in Smogon's National
	 * Dex too, where the server refuses them - and "only for RP" is the whole
	 * point. So the entries go in for the length of one search and come straight
	 * back out, which is precise and costs a few object writes on a keystroke.
	 *
	 * The generation is written into the entry rather than assumed: a move gets
	 * `8M` or `9M` for the generation that introduced it, so an RP Gen 8 format
	 * is shown Body Press and not Tera Blast, which is exactly what its
	 * validator will accept.
	 */
	function installCutMoves() {
		var search = window.BattleMoveSearch;
		if (!search || !search.prototype || !search.prototype.getBaseResults) return false;
		if (search.__velvetCutMoves) return true;
		search.__velvetCutMoves = true;

		var original = search.prototype.getBaseResults;
		search.prototype.getBaseResults = function () {
			var give_back = lendCutMoves(this);
			try {
				return original.apply(this, arguments);
			} finally {
				give_back();
			}
		};
		return true;
	}

	function lendCutMoves(search) {
		var nothing = function () {};
		var buffs = window.VelvetBuffs;
		var cuts = buffs && buffs.cutMoves;
		var table = window.BattleTeambuilderTable;
		if (!cuts || !table || !table.learnsets || !search.species) return nothing;
		// RP only, and the format has been rewritten by now - see installRpTiers.
		if (!RP_TIERS[String(search.velvetFormat || '')]) return nothing;
		if (!window.Dex || !window.Dex.species) return nothing;

		var species = window.Dex.species.get(search.species);
		if (!species || !species.exists) return nothing;
		// Keyed by base form, because that is where the measurement was made and
		// because a forme has no movepool of its own.
		var list = cuts[window.toID(species.baseSpecies || species.name)] || cuts[species.id];
		if (!list || !list.length) return nothing;

		var key = typeof search.firstLearnsetid === 'function' ?
			search.firstLearnsetid(species.id) : species.id;
		if (!key) return nothing;

		var learnset = table.learnsets[key] || (table.learnsets[key] = {});
		var sources = buffs.cutMoveSources || {};
		var lent = [];
		for (var i = 0; i < list.length; i++) {
			if (learnset[list[i]]) continue;
			/*
			 * The generation comes from the server, not from here.
			 *
			 * The client works a move's generation out from its number against a
			 * table that stops at the eighth, so it answers 8 for Tera Blast and
			 * an entry built on that reads '8M' - hidden in every ninth-generation
			 * format and offered in the eighth, where it does not exist. Exactly
			 * the wrong way round, and silent. scripts/build-buffs.js writes these
			 * out against the real dex.
			 */
			learnset[list[i]] = sources[list[i]] || '9M';
			lent.push(list[i]);
		}
		if (!lent.length) return nothing;
		return function () {
			for (var j = 0; j < lent.length; j++) delete learnset[lent[j]];
		};
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
		/*
		 * RP Battle bans nothing at all, and had the smallest list in the builder.
		 *
		 * The client works out which Pokemon a format offers from the format's
		 * name. `gen9rpbattle` matches nothing it knows, so it fell back to the
		 * plain ninth-generation table - 866 Pokemon, no National Dex, and none
		 * of the past-generation Pokemon that are the whole point of the tier.
		 * Simisage, buffed to the teeth, could not be picked in the one format
		 * where everything is legal.
		 *
		 * National Dex AG is the honest match: everything that ever existed, with
		 * nothing taken out, which is what this format's rules actually say.
		 */
		gen9rpbattle: 'gen9nationaldexag',
		gen9rpag: 'gen9nationaldexag',
		gen9rpou: 'gen9nationaldex',
		gen9rpubers: 'gen9nationaldexubers',
		gen9rpuu: 'gen9nationaldexuu',
		gen9rpru: 'gen9nationaldexru',
		// Little Cup has a National Dex list of its own, which is the one this
		// server's buffed pre-evolutions belong in.
		gen9rplc: 'gen9nationaldexlc',
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
			var asked = window.toID(format || '');
			var mapped = RP_TIERS[asked];
			var typed = original.call(this, searchType, mapped || format, speciesOrSet);
			/*
			 * And keep the name it was asked by.
			 *
			 * Swapping the format is the point of this hook, and the cost of it is
			 * that from here on nothing downstream can tell an RP tier from the
			 * Smogon one it stands on - `gen9rpou` arrives at the move search as
			 * plain `ou` with a National Dex flag, exactly like `gen9nationaldex`.
			 * Anything that is true of RP and not of National Dex needs this.
			 */
			if (typed) typed.velvetFormat = asked;
			return typed;
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
	/**
	 * Where each character of an id sits in the display name.
	 *
	 * '0' means it sits where it does in the id; each step up counts one more
	 * character in the name that is not part of the id - the space in "Queen
	 * Beam", the apostrophe and space in "Queen's Dance", the hyphen in
	 * "Nuzleaf-SOLD".
	 */
	function offsetsFor(name) {
		var offset = 0;
		var out = '';
		for (var i = 0; i < name.length; i++) {
			if (/[a-z0-9]/i.test(name.charAt(i))) out += String(Math.min(offset, 9));
			else offset++;
		}
		return out;
	}

	function installSearch() {
		var index = window.BattleSearchIndex;
		if (!index || !index.length) return;
		var offsets = window.BattleSearchIndexOffset;

		/*
		 * Named rather than spelled out, because the offsets are derivable.
		 *
		 * Every one of these strings is a mechanical function of the display name
		 * - count the characters that are not letters or digits as you go - so
		 *   writing them by hand is just a chance to get one wrong, and a wrong
		 * one highlights the wrong letters rather than failing loudly. This is the
		 * same derivation scripts/build-buffs.js uses for the generated rows.
		 */
		var rows = [
			['samantha', 'pokemon', 'Samantha'],
			['nuzleafsold', 'pokemon', 'Nuzleaf-SOLD'],
			['queenbeam', 'move', 'Queen Beam'],
			['queensdance', 'move', "Queen's Dance"],
			['queensheal', 'move', "Queen's Heal"],
			['queensblitz', 'move', "Queen's Blitz"],
			['queenwrath', 'ability', 'Queen Wrath'],
			['queensmorph', 'ability', "Queen's Morph"],
			['norefunds', 'ability', 'No Refunds'],
		].map(function (row) {
			return [row[0], row[1], offsetsFor(row[2])];
		});

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
	 * Where a Pokemon sits when Smogon last said anything about it.
	 *
	 * One lookup from species id to the tier heading it is listed under, built
	 * from the current generation first and older ones only where the current
	 * one has nothing - a Pokemon that is not in Scarlet and Violet at all is
	 * still tiered in Sword and Shield, and one that is in neither is tiered in
	 * Sun and Moon. Every Pokemon in National Dex is in one of the three.
	 *
	 * Built newest-last so the newer table overwrites the older, which is the
	 * order that makes the freshest ranking win.
	 */
	function smogonSections(root, prefer) {
		var map = {};
		for (var i = prefer.length - 1; i >= 0; i--) {
			var rows = prefer[i] && prefer[i].tiers;
			if (!rows) continue;
			var section = null;
			for (var j = 0; j < rows.length; j++) {
				var row = rows[j];
				if (typeof row === 'string') { if (section) map[row] = section; continue; }
				if (row && row[0] === 'header') section = row[1];
			}
		}
		return map;
	}

	var LOWER = { NU: 'NU', NUBL: 'NU', PU: 'PU', PUBL: 'PU', ZU: 'ZU', ZUBL: 'ZU' };

	/**
	 * Give the National Dex list the tiers below RU that it does not have.
	 *
	 * Smogon ranks National Dex down to RU and stops, so its table has one RU
	 * heading with five hundred and thirty-nine Pokemon under it - RU, and
	 * everything Smogon never got round to ranking, in one alphabetical run.
	 * Every RP tier from RU upwards searches that table, so scrolling RP OU went
	 * OU, UUBL, UU, RUBL, RU, and then simply ended, with Luvdisc sitting in RU
	 * next to Gengar. The tiers below it were not missing Pokemon - they were
	 * missing headings, and a heading is how anybody finds anything by scrolling.
	 *
	 * Meanwhile RP NU, PU and ZU stand on the ordinary ninth-generation tiers,
	 * which do have those headings. So the same server had two shapes of list
	 * depending on which of its own tiers you were building for, which is the
	 * inconsistency being reported.
	 *
	 * So the block is split, and split on Smogon's own ranking rather than an
	 * invented one: the tier the Pokemon holds in Scarlet and Violet, or in the
	 * newest generation that has it. Anything RU or higher there stays under RU,
	 * because National Dex placing it this low is National Dex's own judgement
	 * and it is the authority for the tiers it does rank. The rest get the
	 * heading they hold everywhere else.
	 *
	 * The labels move with them - a Pokemon under a ZU heading that the builder
	 * calls RU is the same confusion in a smaller place - and so do the slice
	 * indexes, since every heading inserted pushes everything after it down.
	 */
	function sectionLowerTiers(table, sections) {
		if (!table || !table.tiers || !table.formatSlices) return;
		if (table.tiers.__velvetTiers) return;

		var headers = {};
		for (var i = 0; i < table.tiers.length; i++) {
			var row = table.tiers[i];
			if (typeof row === 'string') continue;
			if (row && row[0] === 'header') headers[row[1]] = i;
		}
		// Nothing to do for a table that already has the headings, and nothing
		// sensible to do for one with no RU at all.
		if (headers.RU === undefined || headers.NU !== undefined) return;
		table.tiers.__velvetTiers = true;

		var from = headers.RU + 1;
		var end = table.tiers.length;
		for (var i = from; i < table.tiers.length; i++) {
			if (typeof table.tiers[i] !== 'string') { end = i; break; }
		}

		var groups = { RU: [], NU: [], PU: [], ZU: [] };
		for (var i = from; i < end; i++) {
			var id = table.tiers[i];
			var into = LOWER[sections[id]] || 'RU';
			groups[into].push(id);
			if (into !== 'RU' && table.overrideTier) table.overrideTier[id] = into;
		}

		var rebuilt = groups.RU.slice();
		var order = ['NU', 'PU', 'ZU'];
		var placed = {};
		for (var k = 0; k < order.length; k++) {
			if (!groups[order[k]].length) continue;
			placed[order[k]] = from + rebuilt.length;
			rebuilt.push(['header', order[k]]);
			rebuilt = rebuilt.concat(groups[order[k]]);
		}

		var added = rebuilt.length - (end - from);
		table.tiers.splice.apply(table.tiers, [from, end - from].concat(rebuilt));
		for (var key in table.formatSlices) {
			if (table.formatSlices[key] >= end) table.formatSlices[key] += added;
		}
		// These pointed at the end of the RU block, which was the honest answer
		// when there was no such section. Now there is one.
		for (var tier in placed) table.formatSlices[tier] = placed[tier];
	}

	/**
	 * Put the Z-A Megas in the list you scroll through.
	 *
	 * Giving them a tier was only half of it, and the half that shows when you
	 * type a name. The builder's list is a different thing entirely: one long
	 * array per generation - `tiers` - of section headers and species ids, which
	 * each format shows a *suffix* of, starting at the index `formatSlices` gives
	 * for its tier. Ours were in the dex, in the search index, and correctly
	 * tiered, and simply were not in that array. So they were findable by typing
	 * and invisible to anybody scrolling, which is how most people look.
	 *
	 * Inserting into it means moving every index after the insertion, which is
	 * why nothing else in this file does: Samantha is appended at the very end
	 * and hoisted into the results instead, precisely to avoid this. A Mega
	 * cannot be handled that way, because it has to appear under its own tier
	 * heading next to the other Megas.
	 *
	 * So the slices are moved with it. Each Mega goes in immediately after its
	 * tier's header - the header index is the slice value, so inserting *after*
	 * it leaves that slice alone and pushes only the ones below - and every slice
	 * index past the insertion point goes up by one.
	 */
	function headerIndex(table, tier) {
		for (var i = 0; i < table.tiers.length; i++) {
			var row = table.tiers[i];
			if (typeof row !== 'string' && row && row[0] === 'header' && row[1] === tier) return i;
		}
		return -1;
	}

	/*
	 * In its alphabetical place, not at the top of the section.
	 *
	 * Each tier's block is sorted by id - alakazammega, annihilape, arceus - and
	 * dropping ours in directly after the header put every one of them above the
	 * As. The list is scrolled by people looking for a name, so a handful jumbled
	 * at the top of each tier is worse than not listing them at all: it reads as
	 * the order being broken, because it is.
	 *
	 * So the block is walked to the first entry that sorts after ours, and it
	 * goes there. A header ends the block.
	 */
	function placeFor(table, id, tier) {
		var start = headerIndex(table, tier);
		if (start < 0) return -1;
		for (var i = start + 1; i < table.tiers.length; i++) {
			var row = table.tiers[i];
			// A nested header ends this block: OU has "OU by technicality".
			if (typeof row !== 'string') return i;
			if (row > id) return i;
		}
		return table.tiers.length;
	}

	/**
	 * Put one Pokemon under the heading its tier names, wherever it is now.
	 *
	 * Both halves matter and only one of them was here before. Listing something
	 * that is missing is the Z-A Mega case. Moving something that is listed in
	 * the wrong place is the case this server creates every time it disagrees
	 * with Smogon about a tier: Gliscor is Uber here and OU in National Dex, so
	 * it sat in the OU block, was offered to anyone scrolling RP OU, and came
	 * back "Gliscor is tagged ND Uber, which is banned" when the team was sent.
	 * The label already said Uber - the label is read from a different table
	 * than the position - which is the builder disagreeing with itself on one
	 * screen.
	 *
	 * Every index after a move shifts, so the slices shift with it: taking the
	 * row out pulls down everything below it, putting it back pushes everything
	 * from the insertion point down again.
	 */
	function placeSpecies(table, id, tier) {
		if (headerIndex(table, tier) < 0) return false;   // no such section here
		var from = table.tiers.indexOf(id);
		if (from >= 0) {
			table.tiers.splice(from, 1);
			for (var key in table.formatSlices) {
				if (table.formatSlices[key] > from) table.formatSlices[key]--;
			}
		}
		var at = placeFor(table, id, tier);
		if (at < 0) return false;
		table.tiers.splice(at, 0, id);
		for (var slice in table.formatSlices) {
			if (table.formatSlices[slice] >= at) table.formatSlices[slice]++;
		}
		return true;
	}

	function listMegas(table, megaTiers) {
		if (!table || !table.tiers || !table.formatSlices) return;
		// The same array is shared between generations of the table, so doing this
		// twice would list every Mega twice.
		if (table.tiers.__velvetMegas) return;
		table.tiers.__velvetMegas = true;

		for (var id in megaTiers) {
			if (table.tiers.indexOf(id) >= 0) continue;      // already listed
			placeSpecies(table, id, megaTiers[id]);
		}
	}

	/**
	 * And move the ones that are listed under a heading this server disagrees
	 * with.
	 *
	 * Only what is already in the list: something missing from it is either not
	 * in this generation or is a Mega, and listMegas is the one that adds.
	 */
	function retierListed(table, tierMap) {
		if (!table || !table.tiers || !table.formatSlices) return;
		/*
		 * Unguarded, unlike listMegas, and it has to be: two tier tables reach
		 * the same National Dex array - the ninth-generation one and the
		 * National-Dex-only one - and a flag on the array would let the first
		 * through and silently drop the second. Moving something already under
		 * the right heading takes it out and puts it back in the same place, so
		 * running twice costs a splice and changes nothing.
		 */
		for (var id in tierMap) {
			if (table.tiers.indexOf(id) < 0) continue;
			placeSpecies(table, id, tierMap[id]);
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
		var natdexTargets = [];
		var megaTargets = [];
		for (var key in table) {
			if (!table[key] || typeof table[key] !== 'object') continue;
			if (key.indexOf('gen9') === 0) targets.push(table[key]);
			// The National Dex tables are where a Mega is a legal Pokemon at all,
			// and they are what the RP tiers search against - see installRpTiers.
			if (key.indexOf('natdex') >= 0) natdexTargets.push(table[key]);
			/*
			 * The Z-A Megas are ninth-generation data and only that.
			 *
			 * Gen 8 RP stands on Gen 8 National Dex, and the validator refuses an
			 * item from a later generation on its own: a Raichunite X in a Gen 8
			 * team comes back "does not exist in Gen 8", twice, along with the
			 * Pokemon it makes. Listing them in that table would offer a Mega the
			 * server will not accept - the same complaint as before, one
			 * generation down, and found by validating a set rather than by
			 * anyone hitting it.
			 */
			if (key.indexOf('gen9') === 0 && key.indexOf('natdex') >= 0) megaTargets.push(table[key]);
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
				// Not selectable and not meant to be - it is what a Nuzleaf becomes
				// when the Broken Pact goes off, and the only way to it is that. But
				// it should say so when looked up rather than simply not existing.
				t.overrideTier.nuzleafsold = 'Illegal';

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
					// And under the right heading, not just with the right label -
					// see placeSpecies. A Gliscor marked Uber in the middle of the
					// OU block is still offered to everyone scrolling OU.
					retierListed(t, buffs.tiers);
				}
				landed = true;
			}
		}
		/*
		 * Mega tiers, and only where a Mega is a real thing.
		 *
		 * Not in the plain ninth-generation table: there is no Mega Evolution
		 * there, Showdown marks every Mega forme Illegal, and it is right to.
		 * Putting ours in it is what made ours the only Megas in the game that
		 * read as legal in a format they cannot be used in.
		 *
		 * In National Dex they are legal, tiered, and ours had no tier at all -
		 * so the builder offered the stone and called the Pokemon it makes
		 * illegal. That is the complaint, and this is the half that was missing.
		 *
		 * The same pass gives those tables their tiers below RU, which has to
		 * happen first: a Mega is slotted into the section its tier names, so the
		 * sections have to be there before it goes looking for one.
		 */
		var ninth = smogonSections(table, [table.gen7, table.gen8, table]);
		var eighth = smogonSections(table, [table.gen7, table.gen8]);
		// Every National Dex table gets its lower tiers, whichever generation it
		// is: the missing headings are the same missing headings there.
		for (var n = 0; n < natdexTargets.length; n++) {
			var natdex = natdexTargets[n];
			sectionLowerTiers(natdex, natdex === table.gen8natdex ? eighth : ninth);
		}
		/*
		 * And the tiers that are a National Dex decision and only that.
		 *
		 * Shedinja is not in Scarlet and Violet, so its ninth-generation tier is
		 * Illegal and stays Illegal - this server moving it to Ubers is a thing
		 * it did to National Dex. Putting that Uber in the plain table would
		 * label it Uber in a format it cannot be picked in, which is the
		 * complaint the Mega split above already exists to answer.
		 */
		if (buffs && buffs.natdexTiers) {
			for (var d = 0; d < natdexTargets.length; d++) {
				var nd = natdexTargets[d];
				if (!nd.overrideTier) nd.overrideTier = {};
				for (var ndId in buffs.natdexTiers) nd.overrideTier[ndId] = buffs.natdexTiers[ndId];
			}
		}
		// And under the right heading in these tables too - including the ones
		// that are not ninth-generation keys, which the loop above never saw.
		for (var r = 0; r < natdexTargets.length; r++) {
			var moved = natdexTargets[r];
			if (buffs && buffs.tiers) retierListed(moved, buffs.tiers);
			if (buffs && buffs.natdexTiers) retierListed(moved, buffs.natdexTiers);
		}
		if (buffs && buffs.megaTiers) {
			for (var g = 0; g < megaTargets.length; g++) {
				var withMegas = megaTargets[g];
				if (!withMegas.overrideTier) withMegas.overrideTier = {};
				for (var megaId in buffs.megaTiers) withMegas.overrideTier[megaId] = buffs.megaTiers[megaId];
				listMegas(withMegas, buffs.megaTiers);
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
			var ours = oursFor(pokemon);
			if (ours) {
				// Animated unless this viewer has turned animation off, which is the
				// same pair of preferences the client checks for everyone else - so
				// the 2D/animated switch in Options does something here too.
				var animated = true;
				try {
					animated = !window.Dex.prefs('noanim') && !window.Dex.prefs('nogif');
				} catch (e) { /* no prefs yet; animation is the default */ }

				var set = (animated && ours.animated) || ours.still;
				var art = isFront ? set.front : set.back;

				data.url = SPRITES + art[0];
				// A standard 96x96 sheet needs none of the rest: whatever the
				// client computed for a sprite it could not find is exactly right
				// for one of these, and overriding it is how a sprite ends up
				// drawn at the wrong size in one place and not another.
				if (!ours.standard) {
					data.w = art[1];
					data.h = art[2];
					data.y = (ours.y && (isFront ? ours.y.front : ours.y.back)) || 0;
				}
				data.pixelated = true;
				// Whatever it is drawn from, it is one file - there is no sprite sheet
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

			/*
			 * Colossus Unbound's 1.2x Attack, while Regigigas is above half HP.
			 * The tooltip recalculates stats from its own list of abilities by
			 * name, so without this the number shown ignores the ability.
			 */
			/*
			 * The eeveelutions' abilities. Kindled Fury is Guts (1.5x Attack while
			 * statused); Diamond Dust and Solstice double Speed in their weather.
			 */
			var status = (clientPokemon && clientPokemon.status) || (serverPokemon && serverPokemon.status) || '';
			if (ability === 'kindledfury' && status && status !== 'fnt') stats.atk = Math.floor(stats.atk * 1.5);
			var weather = window.toID((this.battle && this.battle.weather) || '');
			if (ability === 'diamonddust' && (weather === 'snowscape' || weather === 'hail')) stats.spe *= 2;
			if (ability === 'solstice' && (weather === 'sunnyday' || weather === 'desolateland') && item !== 'utilityumbrella') stats.spe *= 2;

			if (ability === 'colossusunbound') {
				var hp = clientPokemon ? clientPokemon.hp : serverPokemon && serverPokemon.hp;
				var maxhp = clientPokemon ? clientPokemon.maxhp : serverPokemon && serverPokemon.maxhp;
				if (!maxhp || hp > maxhp / 2) stats.atk = Math.floor(stats.atk * 4915 / 4096);
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
			var ours = oursFor(set);
			if (ours && ours.builder) return ours.builder.split('#SPRITES#').join(SPRITES);
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
			var ours = oursFor(pokemon);
			if (ours && ours.icon) {
				return 'background:transparent url(' + SPRITES + ours.icon + ') no-repeat scroll 0px 0px';
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

		// Base stats this server restored (Cresselia's Generation 8 defences).
		correct(window.BattlePokedex, buffs.overrides && buffs.overrides.species);

		// Balance Patch 1's evolution levels: the CDN's rows still carry Game Freak's.
		if (window.BattlePokedex && buffs.evoLevels) {
			for (var evo in buffs.evoLevels) {
				var row = window.BattlePokedex[evo];
				if (!row) continue;
				// A stone evolution that can now also happen by level keeps its stone here.
				if (buffs.evoAlso && buffs.evoAlso[evo]) row.velvetLevelToo = buffs.evoAlso[evo];
				else row.evoLevel = buffs.evoLevels[evo];
			}
		}

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
	/**
	 * "awakened" and "signature" in the Pokemon search.
	 *
	 * "awakened" lists every Pokemon Balance Patch 1 and the earlier buffs gave a
	 * signature ability or signature move of ours. "signature" lists every
	 * Pokemon with a signature move, official or ours (the velvet-signatures.js
	 * table, which already counts ours). It is filed as an egg-group row - the
	 * builder's only filter that is a set of Pokemon - and answered here, from the lists scripts/build-buffs.js works out.
	 */
	function installAwakenedSearch() {
		var buffs = window.VelvetBuffs;
		var search = window.BattlePokemonSearch;
		if (!buffs || !buffs.awakened || !search || !search.prototype || !search.prototype.filter) return false;
		// The row renderer loads in a later script than the search itself.
		if (!window.BattleSearch && !window.PSSearchResults) return false;
		if (search.__velvetAwakened) return true;
		search.__velvetAwakened = true;

		var NAMES = { awakened: 'Awakened', signature: 'Signature' };
		var sets = { awakened: {}, signature: {} };
		var table = window.VelvetSignatureMoves;
		if (table && table.bySpecies) for (var sp in table.bySpecies) if (table.get(sp).length) sets.signature[sp] = true;
		for (var m = 0; m < (buffs.awakened.move || []).length; m++) sets.signature[buffs.awakened.move[m]] = true;
		var ids = (buffs.awakened.ability || []).concat(buffs.awakened.move || []);
		for (var n = 0; n < ids.length; n++) sets.awakened[ids[n]] = true;

		var filter = search.prototype.filter;
		search.prototype.filter = function (row, filters) {
			if (!filters || !row || row[0] !== 'pokemon') return filter.apply(this, arguments);
			var rest = [];
			for (var i = 0; i < filters.length; i++) {
				var set = filters[i][0] === 'egggroup' && sets[window.toID(filters[i][1])];
				if (!set) { rest.push(filters[i]); continue; }
				if (!set[row[1]]) return false;
			}
			return filter.call(this, row, rest.length ? rest : null);
		};

		// The row: labelled as a search term, not an egg group.
		var Old = window.BattleSearch;
		if (Old && Old.prototype && Old.prototype.renderEggGroupRow) {
			var row = Old.prototype.renderEggGroupRow;
			Old.prototype.renderEggGroupRow = function (egggroup, matchStart, matchLength, errorMessage) {
				var name = NAMES[window.toID(egggroup && egggroup.name)];
				if (!name) return row.apply(this, arguments);
				return row.call(this, { name: name }, matchStart, matchLength, errorMessage).replace('(egg group)', name === 'Signature' ? '(has a signature move)' : '(Awakened Pokémon)');
			};
		}
		var Results = window.PSSearchResults;
		if (Results && Results.prototype && Results.prototype.renderEggGroupRowHTML) {
			var rowHTML = Results.prototype.renderEggGroupRowHTML;
			Results.prototype.renderEggGroupRowHTML = function (index, id) {
				var html = rowHTML.apply(this, arguments);
				return NAMES[id] ? html.replace('(egg group)', id === 'signature' ? '(has a signature move)' : '(Awakened Pokémon)') : html;
			};
		}
		return true;
	}

	function installBuffedBasePower() {
		var tips = window.BattleTooltips;
		if (!tips || !tips.prototype || !tips.prototype.getMoveBasePower) return false;
		if (tips.__velvetBasePower) return true;
		tips.__velvetBasePower = true;

		// Ribbon Hymn turns Normal moves Fairy, the way the tooltip already shows Pixilate.
		var originalType = tips.prototype.getMoveType;
		if (originalType) {
			tips.prototype.getMoveType = function (move, value) {
				var out = originalType.apply(this, arguments);
				try {
					var mon = value && (value.pokemon || value.serverPokemon);
					var ab = window.toID((value && value.pokemon && value.pokemon.ability) || (value && value.serverPokemon && value.serverPokemon.ability) || '');
					var fixed = { judgment: 1, multiattack: 1, naturalgift: 1, revelationdance: 1, technoblast: 1, terrainpulse: 1, weatherball: 1 };
					if (mon && ab === 'ribbonhymn' && out && out[0] === 'Normal' && move && move.type === 'Normal' && !fixed[move.id]) out[0] = 'Fairy';
				} catch (e) {}
				return out;
			};
		}

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
				// Ribbon Hymn (Sylveon) is Pixilate: 1.2x on the Normal moves it turns Fairy.
				if (ability === 'ribbonhymn' && move && move.type === 'Normal' && moveType === 'Fairy' && out && out.modify) {
					out.modify(4915 / 4096, 'Ribbon Hymn');
				}
				// Solar Nectar: 135 power in harsh sunlight (Balance Patch 1).
				var moveId = move && (move.id || window.toID(move.name || ''));
				var weather = this.battle && window.toID(this.battle.weather || '');
				if (moveId === 'solarnectar' && (weather === 'sunnyday' || weather === 'desolateland') && out && out.modify) {
					out.modify(135 / 80, 'Sunlight');
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
		/*
		 * Where a Mega can actually happen.
		 *
		 * The search strips the generation off the format before storing it, and
		 * puts the interesting half somewhere else: `gen9nationaldex` arrives as
		 * format 'ou' with formatType 'natdex', and `gen9rpou` as format 'rpou'
		 * with no formatType at all. Checking the format string for 'nationaldex'
		 * therefore never matched - and since the RP tiers are pointed at
		 * National Dex for searching (see installRpTiers), that was the path the
		 * builder actually takes.
		 *
		 * The generation covers the rest: Mega Evolution is native to the sixth
		 * and seventh, so a past-generation RP tier there needs no help.
		 */
		var format = String(search.format || '');
		var formatType = String(search.formatType || '');
		var gen = search.dex && search.dex.gen;
		var megasWork = format.indexOf('rp') === 0 || formatType.indexOf('natdex') >= 0 ||
			gen === 6 || gen === 7;
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
	// Ours, so there is no cell for them on Showdown's item sheet - each is a
	// file of its own in this server's sprites folder.
	var ITEM_ICONS = {
		elementalbanana: 'elemental-banana.png',
		brokenpact: 'broken-pact.png',
	};

	function installItemIcon() {
		if (!window.Dex || !window.Dex.getItemIcon) return false;
		if (window.Dex.__velvetItemIcon) return true;
		var original = window.Dex.getItemIcon;
		window.Dex.__velvetItemIcon = true;
		window.Dex.getItemIcon = function (item) {
			var name = item;
			if (name && typeof name === 'object') name = name.name || name.id || '';
			var file = typeof name === 'string' ? ITEM_ICONS[window.toID(name)] : null;
			if (file) {
				return 'background:transparent url(' + SPRITES + file + ') no-repeat scroll 0px 0px';
			}
			try {
				return original.call(this, item);
			} catch (e) {
				return '';
			}
		};
		return true;
	}

	/**
	 * Animations for the moves this server invented.
	 *
	 * The client looks a move up in BattleMoveAnims by id and plays Tackle for
	 * anything it cannot find, so every custom move - Queen Beam, the Rush moves,
	 * Balance Patch 1's - hit like a Tackle. Each is given the animation of the
	 * real move it most looks like, trying a few in order because the animation
	 * table differs between client builds. Continental Heave gets a composite:
	 * Giga Impact on the target with the ground shaking under both sides.
	 *
	 * Its own timer, not the install() loop: the animation table only loads with
	 * the battle scripts, which may be long after the builder has finished.
	 */
	var MOVE_ANIMS = {
		queenbeam: ['lightofruin', 'moonblast'],
		queensdance: ['quiverdance', 'dragondance'],
		queensheal: ['lunardance', 'recover'],
		queensblitz: ['wickedblow', 'nightslash'],
		merchantscall: ['finalgambit', 'memento'],
		wavecharge: ['aquastep', 'aquajet'],
		junglerush: ['grassyglide', 'woodhammer', 'leafblade'],
		cinderrush: ['flamecharge', 'flareblitz'],
		torrentrush: ['aquajet', 'wavecrash'],
		hivefrenzy: ['lunge', 'attackorder', 'xscissor'],
		chrysalisveil: ['defendorder', 'quiverdance', 'recover'],
		hustleup: ['howl', 'bulkup', 'dragondance'],
		carrionfeast: ['crunch', 'bite'],
		sparkscamper: ['zippyzap', 'spark', 'quickattack'],
		undertow: ['whirlpool', 'surf', 'waterpulse'],
		solarnectar: ['gigadrain', 'energyball'],
		craghammer: ['headsmash', 'rockwrecker', 'stoneedge'],
		hypnowhirl: ['psybeam', 'confusion'],
		shufflejab: ['machpunch', 'drainpunch'],
		aurorasquall: ['blizzard', 'icywind'],
		voltaiclance: ['boltstrike', 'wildcharge', 'thunderbolt'],
		rimecleaver: ['iciclecrash', 'mountaingale', 'icepunch'],
		oxidize: ['sludgewave', 'acid', 'sludgebomb'],
		memorywipe: ['psychic', 'confusion'],
		soulresonance: ['heartstamp', 'drainingkiss', 'psyshock'],
		resolutestrike: ['zenheadbutt', 'psychocut'],
	};
	function installMoveAnims() {
		var anims = window.BattleMoveAnims;
		if (!anims || !anims.tackle) return false;
		for (var id in MOVE_ANIMS) {
			if (anims[id]) continue;
			for (var i = 0; i < MOVE_ANIMS[id].length; i++) {
				var base = anims[MOVE_ANIMS[id][i]];
				if (base && base.anim) { anims[id] = { anim: base.anim, velvetFrom: MOVE_ANIMS[id][i] }; break; }
			}
		}
		if (!anims.gleamstalk && anims.glare) {
			anims.gleamstalk = {
				velvetFrom: 'glare+charge',
				anim: function (scene, sprites) {
					anims.glare.anim(scene, sprites);
					if (anims.charge && anims.charge.anim) anims.charge.anim(scene, sprites);
				},
			};
		}
		if (!anims.continentalheave && anims.gigaimpact) {
			anims.continentalheave = {
				velvetFrom: 'gigaimpact+earthquake',
				anim: function (scene, sprites) {
					anims.gigaimpact.anim(scene, sprites);
					if (anims.earthquake && anims.earthquake.anim) anims.earthquake.anim(scene, sprites);
				},
			};
		}
		return true;
	}
	var animTimer = setInterval(function () {
		if (installMoveAnims()) clearInterval(animTimer);
	}, 250);
	installMoveAnims();

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
