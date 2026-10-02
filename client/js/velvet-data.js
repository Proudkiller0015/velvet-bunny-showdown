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

	/*
	 * RP's data, switched on only where RP is played.
	 *
	 * Everything this server changes about a Pokemon, move or ability that
	 * Showdown already has (Normalize, Luxray's Dark type, Cresselia's stats, the
	 * extra ability slots, the Awakened moves in the learnsets) is RP's alone: the
	 * server plays the official formats on Showdown's own data. The client keeps
	 * one set of tables, so every one of those changes goes through rpSet, which
	 * remembers what the field held before. RP mode puts ours in; anything else
	 * puts Showdown's back - the teambuilder switches by the team's format, a
	 * battle's tooltips and move buttons by the battle's.
	 *
	 * Things that are simply new (our own Pokemon, moves, abilities, items) stay
	 * in the tables either way: nothing official uses them, and a replay or a
	 * chat link still needs to draw them.
	 */
	var RP = { on: true, patches: [], rows: [] };
	var patchIndex = typeof WeakMap === 'function' ? new WeakMap() : null;
	function rpSet(obj, key, value, del) {
		if (!obj) return;
		var byKey = patchIndex && patchIndex.get(obj);
		if (!byKey && patchIndex) { byKey = {}; patchIndex.set(obj, byKey); }
		var p = byKey && byKey[key];
		if (!p) {
			p = { o: obj, k: key, had: Object.prototype.hasOwnProperty.call(obj, key), old: obj[key] };
			if (byKey) byKey[key] = p;
			RP.patches.push(p);
		}
		p.val = value;
		p.del = !!del;
		if (RP.on) {
			if (p.del) delete obj[key]; else obj[key] = value;
		}
	}
	/** The row a table held when we changed it, so a cached copy can be thrown away on a switch. */
	function rpRow(tableName, id, row) {
		if (row) RP.rows.push([tableName, id, row]);
	}
	function isRpFormat(format) {
		return /gen\d+rp/.test(String(format || '').toLowerCase());
	}
	function setRpMode(on) {
		on = !!on;
		if (RP.on === on) return;
		RP.on = on;
		for (var i = 0; i < RP.patches.length; i++) {
			var p = RP.patches[i];
			if (on) {
				if (p.del) delete p.o[p.k]; else p.o[p.k] = p.val;
			} else if (p.had) {
				p.o[p.k] = p.old;
			} else {
				delete p.o[p.k];
			}
		}
		// The client caches a built Species, Move or Ability in place of the row it
		// came from; put the rows back so the next lookup builds from the switched data.
		for (var r = 0; r < RP.rows.length; r++) {
			var table = window[RP.rows[r][0]];
			if (table && table[RP.rows[r][1]] !== RP.rows[r][2]) table[RP.rows[r][1]] = RP.rows[r][2];
		}
		window.BattlePokedexAltForms = {};
		if (window.Dex && window.Dex.moddedDexes) window.Dex.moddedDexes = {};
	}
	window.VelvetRp = { isOn: function () { return RP.on; }, set: setRpMode, isRpFormat: isRpFormat };

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
	// Halloween 2026: the witch skin of Mega Banette, drawn for this server on a
	// grid a little larger than 96, so it carries its own size.
	ART.banettemegahalloween = {
		still: { front: ['banette-megahalloween.png', 106, 101], back: ['banette-megahalloween-back.png', 108, 104] },
		// Drawn like the regular Megas' builder sprites (96px at 10px 5px), fitted to 96 wide
		// and kept pixel-sharp; squeezing it to half size made it unreadable.
		builder: 'background-image:url(#SPRITES#banette-megahalloween.png);background-size:96px 91px;background-position:10px 8px;background-repeat:no-repeat;image-rendering:pixelated;',
	};
	// Makuro and Raishin (data/velvet/abyss-shrine.js): pixelized from the owner's art
	// onto standard 96x96 canvases, standing where a gen 5 sprite stands. The back is
	// the front turned round until a real back view is drawn.
	// SPRITE_V is bumped whenever the pictures are redrawn: the static server caches
	// sprites for an hour under the same name, so the ChatGPT redraws otherwise showed
	// the old converted ones until the cache ran out.
	var SPRITE_V = '?v=7';
	// MissingNo. (Halloween 2026) too: Showdown has its front sprite and nothing else,
	// so the back (the front turned round) and the icon are ours.
	['makuro', 'raishin', 'chimai', 'missingno'].forEach(function (id) {
		ART[id] = {
			standard: true,
			still: { front: [id + '.png' + SPRITE_V, 96, 96], back: [id + '-back.png' + SPRITE_V, 96, 96] },
			icon: id + '-icon.png' + SPRITE_V,
			builder: 'background-image:url(#SPRITES#' + id + '.png' + SPRITE_V + ');background-position:10px 5px;background-repeat:no-repeat;image-rendering:pixelated;',
		};
	});
	// The Shrine Trio's shinies (owner, 2 Oct 2026): their own colours, not a tint - Makuro
	// black and red, Raishin midnight violet with gold lightning, Chimai white with blue flames.
	var HD = { makuro: [208, 140], raishin: [200, 129], chimai: [168, 154] };
	// Their cries (tools/music/cries.py), played when one is sent out like anyone else's.
	['makuro', 'raishin', 'chimai'].forEach(function (id) { ART[id].cry = 'audio/cries/' + id + '.mp3'; });
	['makuro', 'raishin', 'chimai'].forEach(function (id) {
		ART[id].shiny = {
			still: { front: [id + '-shiny.png' + SPRITE_V, 96, 96], back: [id + '-back-shiny.png' + SPRITE_V, 96, 96] },
			animated: { front: [id + '-shiny-ani.webp' + SPRITE_V, 96, 96], back: [id + '-back-shiny-ani.webp' + SPRITE_V, 96, 96] },
		};
		// Animated in battle (owner, 2 Oct 2026: "lack animation, super pixelated compared to native ones").
		// The front is the creature's own artwork, smooth, with an idle loop (scripts/animate-sprite.py);
		// a fourth entry of true marks a smooth picture with its own size. The backs and the shinies
		// are the pixel sprites given the same loop until there is artwork of those views.
		ART[id].animated = { front: [id + '-ani.webp' + SPRITE_V, HD[id][0], HD[id][1], true], back: [id + '-back-ani.webp' + SPRITE_V, 96, 96] };
		ART[id].shinyBuilder = ART[id].builder.replace(id + '.png', id + '-shiny.png');
	});
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
		// Halloween 2026 (data/velvet/halloween.js): a skin of Mega Banette from the
		// Banettite-Halloween. Mega Banette's stats, its own ability and move.
		banettemegahalloween: {
			num: 354,
			name: "Banette-Mega-Halloween",
			baseSpecies: "Banette",
			forme: "Mega-Halloween",
			types: ["Ghost", "Dark"],
			baseStats: { hp: 64, atk: 165, def: 75, spa: 93, spd: 83, spe: 75 },
			abilities: { 0: "Witching Hour" },
			heightm: 1.2,
			weightkg: 13,
			color: "Purple",
			eggGroups: ["Amorphous"],
			requiredItem: "Banettite-Halloween",
			isMega: true,
			battleOnly: "Banette",
			tier: "UU",
		},

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

	/*
	 * The teambuilder switches with the team in front of you; a battle's tooltips
	 * and move buttons with that battle. Anywhere else stays RP, the main format.
	 */
	function installRpSwitch() {
		var tb = window.TeambuilderRoom;
		var tips = window.BattleTooltips;
		var R = window.BattleRoom;
		if (!tb || !tips || !R) return false;
		if (tb.__velvetRp) return true;
		tb.__velvetRp = true;
		var byTeam = function (name) {
			var original = tb.prototype[name];
			if (typeof original !== 'function') return;
			tb.prototype[name] = function () {
				var out = original.apply(this, arguments);
				setRpMode(!this.curTeam || isRpFormat(this.curTeam.format));
				return out;
			};
		};
		byTeam('focus');
		byTeam('edit');
		byTeam('changeFormat');
		byTeam('back');
		var byBattle = function (proto, name, battleOf) {
			var original = proto[name];
			if (typeof original !== 'function') return;
			proto[name] = function () {
				var battle = battleOf(this);
				if (battle) setRpMode(isRpFormat(battle.id || battle.roomid || battle.tier));
				return original.apply(this, arguments);
			};
		};
		var ofTips = function (t) { return t.battle; };
		for (var n in { showTooltip: 1, showMoveTooltip: 1, showPokemonTooltip: 1, showFieldTooltip: 1 }) byBattle(tips.prototype, n, ofTips);
		byBattle(R.prototype, 'updateMoveControls', function (room) { return room.battle || { id: room.id }; });
		return true;
	}

	function install() {
		if (typeof window.BattlePokedex === 'undefined') return false;

		for (var id in SPECIES) if (!window.BattlePokedex[id]) window.BattlePokedex[id] = SPECIES[id];
		// Whole new Pokemon (Makuro, Raishin): their rows are generated from the server's
		// dex by scripts/build-buffs.js, like everything else that is ours.
		var fresh = (window.VelvetBuffs && window.VelvetBuffs.newSpecies) || {};
		// Ours replaces a row the client already has: it ships MissingNo. as a typeless
		// curiosity with no ability, and the server's version is the one that is played.
		for (var ns in fresh) if (window.BattlePokedex[ns] !== fresh[ns]) window.BattlePokedex[ns] = fresh[ns];
		// Mini icons: a forme with no icon of its own borrows the one it is a skin of
		// (the witch Mega Banette shows Mega Banette's, not plain Banette's).
		var ICON_OF = { banettemegahalloween: 'banettemega' };
		var icons = window.BattlePokemonIconIndexes;
		if (icons) for (var ic in ICON_OF) if (icons[ic] === undefined && icons[ICON_OF[ic]] !== undefined) icons[ic] = icons[ICON_OF[ic]];
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
		var defaultIn = installDefaultFormat();
		var bagIn = installBagMenu();
		var usefulIn = installMoveUsefulness();
		var frbIn = installFrostbite();
		var sureIn = installSureHit();
		var gemIn = installGemItems();
		var switchIn = installRpSwitch();
		return switchIn && tableIn && orderIn && spritesIn && iconIn && builderIn && tipsIn && rpIn &&
			cutIn && listIn && buffsIn && abilitiesIn && itemIn && sigItemIn && powerIn && dmaxIn && awakenedIn && textIn && zMaxIn && defaultIn && bagIn && usefulIn && frbIn && sureIn && gemIn;
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
	/*
	 * The home screen's pre-selected format: RP Random Battle, this server's own,
	 * rather than Showdown's Gen 9 Random Battle. The client picks its default
	 * whenever it draws the button with no format (the same moments Showdown's
	 * own default applies); a format a player picks is passed in and kept.
	 */
	function installDefaultFormat() {
		var menu = window.MainMenuRoom;
		if (!menu || !menu.prototype || !menu.prototype.renderFormats) return false;
		if (menu.__velvetDefaultFormat) return true;
		menu.__velvetDefaultFormat = true;
		var original = menu.prototype.renderFormats;
		menu.prototype.renderFormats = function (formatid, noChoice) {
			if (!formatid && !noChoice && window.BattleFormats && window.BattleFormats.gen9rprandombattle) {
				formatid = 'gen9rprandombattle';
			}
			return original.call(this, formatid, noChoice);
		};
		// Already drawn with Showdown's default before this ran: draw it again.
		try {
			var room = window.app && window.app.rooms && window.app.rooms[''];
			if (room && room.curFormat === 'gen9randombattle' && window.BattleFormats && window.BattleFormats.gen9rprandombattle) {
				room.curFormat = '';
				var btn = room.$('button.formatselect[name=format]').first();
				if (btn.length && !btn.hasClass('preselected')) btn.replaceWith(room.renderFormats());
			}
		} catch (e) { /* the menu redraws on its own soon enough */ }
		return true;
	}

	/*
	 * The battle Bag, laid out like the games: Fight (the move buttons), then a
	 * Bag and a Run button under them, and the Pokemon (switch) menu as it was.
	 *
	 * The server still sends the ball pocket (uhtml rpballs, or the older rpball
	 * panels the tutorial or a staff encounter posts), the medicine panel (rpitems)
	 * and Run as chat panels. Those scrolled away, and on a phone the chat is a whole
	 * screen away from the moves. So they are hidden in the chat and their buttons
	 * rebuilt here, in the controls, every time the controls are drawn or a panel
	 * changes. A button sends the panel's own command, so the server checks exactly
	 * what it checked before.
	 */
	function installBagMenu() {
		var R = window.BattleRoom;
		if (!R || !R.prototype || !R.prototype.updateMoveControls || !window.jQuery) return false;
		if (R.prototype.__velvetBag) return true;
		R.prototype.__velvetBag = true;
		var $ = window.jQuery;

		if (!document.getElementById('velvet-bag-css')) {
			var css = document.createElement('style');
			css.id = 'velvet-bag-css';
			css.textContent =
				// rpforfeit: the Forfeit button a battle with a person sends, only to mark it as one (readBag).
				'.battle-log .uhtml-rpballs,.battle-log .uhtml-rpitems,.battle-log [class*="uhtml-rpball"],.battle-log .uhtml-rpforfeit{display:none!important}' +
				'.velvet-cmd{display:flex;gap:6px;margin:6px 0 4px;clear:both}' +
				'.velvet-cmd button{flex:1;min-height:40px;font-size:14px;font-weight:bold;border-radius:6px;cursor:pointer}' +
				'.velvet-cmd .velvet-bagbtn{background:#f0b429;border:1px solid #b7791f;color:#3a2600}' +
				'.velvet-cmd .velvet-runbtn{background:#4a90d9;border:1px solid #2c6aa8;color:#fff}' +
				'.velvet-bag{margin:4px 0;padding:6px;border:1px solid #b7791f;border-radius:8px;background:rgba(240,180,41,.12);clear:both}' +
				'.velvet-tabs{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}' +
				'.velvet-tabs button{flex:1;min-height:36px;min-width:80px;border-radius:6px;cursor:pointer;font-size:13px}' +
				'.velvet-tabs button.cur{background:#f0b429;color:#3a2600;font-weight:bold;border:1px solid #b7791f}' +
				'.velvet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}' +
				'.velvet-grid button{min-height:44px;font-size:14px;border-radius:6px;cursor:pointer;padding:4px 6px;white-space:normal}' +
				'.velvet-grid button small{display:block;opacity:.75;font-size:11px}' +
				'.velvet-bag .velvet-note{font-size:12px;margin:4px 0;opacity:.85}' +
				'.velvet-bag h4{margin:6px 0 4px;font-size:13px}';
			document.head.appendChild(css);
		}

		function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
		function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

		// What the chat panels offer this room right now.
		function readBag(room) {
			var log = room.$('.battle-log');
			var pocket = log.find('.uhtml-rpballs').last();
			var oldPanels = log.find('[class*="uhtml-rpball"]').not('.uhtml-rpballs');
			var latestOld = oldPanels.last();
			var source = pocket.length ? pocket : latestOld;
			/*
			 * A trainer (or another player) is not wild, though its panel has balls
			 * on show: the server gives it a Forfeit button instead of throws, and
			 * that is how it is told apart. Treating it as wild offered a Run the
			 * server refuses, and the menu sat on "waiting for the turn".
			 */
			var trainer = !!log.find('button[value="/forfeit"]').length;
			var bag = { wild: !trainer && !!(pocket.length || oldPanels.length), trainer: trainer, balls: [], escapes: [], run: null, note: '', medicine: [], idle: '' };
			if (trainer) source = $();
			source.find('button[value]').each(function () {
				var v = this.getAttribute('value') || '';
				var item = { value: v, label: clean($(this).text()), title: this.getAttribute('title') || '' };
				if (/^\/throwball /.test(v)) bag.balls.push(item);
				else if (/^\/run\s*$/.test(v)) bag.run = item;
				else if (/^\/run /.test(v)) bag.escapes.push(item);
			});
			// "Throw a Poke Ball" on the old panels reads better as the ball's name.
			for (var b = 0; b < bag.balls.length; b++) bag.balls[b].label = bag.balls[b].label.replace(/^Throw an? /, '');
			if (bag.wild && !bag.run) bag.run = { value: '/run', label: 'Run' };
			// "Missed. The next ball is 20% likelier to hold." - the note on the newest panel.
			var first = latestOld.find('.infobox').children().first();
			if (first.is('div') && !first.find('button').length) bag.note = clean(first.text());
			// Medicine: one row per item, "Potion (3): [Pikachu] [Eevee]".
			var items = log.find('.uhtml-rpitems').last();
			items.find('.infobox > div').each(function () {
				var row = $(this);
				var targets = [];
				row.find('button[value]').each(function () { targets.push({ value: this.getAttribute('value'), label: clean($(this).text()) }); });
				if (targets.length) {
					var name = clean(row.clone().children('button').remove().end().text()).replace(/:\s*$/, '');
					bag.medicine.push({ name: name, targets: targets });
				} else if (!bag.idle && !/^Nothing in your bag/.test(clean(row.text()))) {
					bag.idle = clean(row.text());
				}
			});
			bag.hasItems = !!items.length;
			return bag;
		}

		function pocketTabs(bag, tab) {
			var tabs = [];
			if (bag.wild) tabs.push(['balls', 'Pokéballs']);
			if (bag.hasItems) tabs.push(['medicine', 'Medicine']);
			var buf = '<div class="velvet-tabs">';
			for (var i = 0; i < tabs.length; i++) {
				buf += '<button type="button" data-velvet-tab="' + tabs[i][0] + '"' + (tabs[i][0] === tab ? ' class="cur"' : '') + '>' + tabs[i][1] + '</button>';
			}
			return buf + '<button type="button" data-velvet="close">&larr; Back</button></div>';
		}

		function actionButton(item, sub) {
			return '<button type="button" data-velvet-send="' + esc(item.value) + '"' + (item.title ? ' title="' + esc(item.title) + '"' : '') + '>' +
				esc(item.label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
		}

		function pocketHTML(room, bag, tab) {
			var buf = pocketTabs(bag, tab);
			if (tab === 'balls') {
				if (bag.note) buf += '<div class="velvet-note">' + esc(bag.note) + '</div>';
				buf += '<div class="velvet-grid">';
				for (var i = 0; i < bag.balls.length; i++) buf += actionButton(bag.balls[i]);
				buf += '</div>';
				if (!bag.balls.length) buf += '<div class="velvet-note">No Pokéballs left. Buy some with !buy on Discord.</div>';
				if (bag.escapes.length) {
					buf += '<h4>Getting away</h4><div class="velvet-grid">';
					for (var e = 0; e < bag.escapes.length; e++) buf += actionButton(bag.escapes[e], 'always works');
					buf += '</div>';
				}
				buf += '<div class="velvet-note">Throwing uses your turn. Weaken it and give it a status first.</div>';
			} else if (tab === 'medicine') {
				var chosen = null;
				for (var m = 0; m < bag.medicine.length; m++) if (bag.medicine[m].name === room.velvetBagItem) chosen = bag.medicine[m];
				if (chosen) {
					buf += '<h4>Use ' + esc(chosen.name) + ' on…</h4><div class="velvet-grid">';
					for (var t = 0; t < chosen.targets.length; t++) buf += actionButton(chosen.targets[t]);
					buf += '<button type="button" data-velvet-item="">Cancel</button></div>';
				} else {
					buf += '<div class="velvet-grid">';
					for (var k = 0; k < bag.medicine.length; k++) {
						buf += '<button type="button" data-velvet-item="' + esc(bag.medicine[k].name) + '">' + esc(bag.medicine[k].name) + '</button>';
					}
					buf += '</div>';
					if (!bag.medicine.length) buf += '<div class="velvet-note">Nothing in your bag would help right now.</div>';
					if (bag.idle) buf += '<div class="velvet-note">' + esc(bag.idle) + '</div>';
				}
				buf += '<div class="velvet-note">Using an item takes your whole turn.</div>';
			}
			return buf;
		}

		function forfeitButton(room) {
			return '<button type="button" class="velvet-runbtn" data-velvet="forfeit">' +
				(room.velvetForfeit ? 'Sure? Tap again to forfeit' : '🏳️ Forfeit') + '</button>';
		}

		/*
		 * Forfeit when there are no moves on screen: choosing who to send out
		 * after a faint, or waiting on the other side. It lived in the move
		 * controls only, so a player stuck on a switch they didn't want to make
		 * had no way out of a trainer battle at all (23 Sep 2026). Same two taps.
		 */
		function drawForfeitElsewhere(room) {
			if (!room.$controls) return;
			room.$controls.find('.velvet-cmd').remove();
			if (room.battle && room.battle.ended) return;
			var at = room.$controls.find('.switchcontrols');
			if (!at.length) at = room.$controls.find('.controls').first();
			if (!at.length || !readBag(room).trainer) return;
			at.append('<div class="velvet-cmd">' + forfeitButton(room) + '</div>');
		}

		// Draw (or redraw) the Bag and Run row under the moves.
		function drawBag(room) {
			try {
				var controls = room.$controls && room.$controls.find('.movecontrols');
				if (!controls || !controls.length) { drawForfeitElsewhere(room); return; }
				var bag = readBag(room);
				controls.find('.velvet-cmd, .velvet-bag').remove();
				if (!bag.wild && !bag.hasItems && !bag.trainer) { controls.find('.moveselect, .movemenu').show(); return; }
				var row = '<div class="velvet-cmd">' +
					(bag.wild || bag.hasItems ? '<button type="button" class="velvet-bagbtn" data-velvet="bag">🎒 Bag</button>' : '') +
					(bag.wild && bag.run ? '<button type="button" class="velvet-runbtn" data-velvet-send="' + esc(bag.run.value) + '">🏃 Run</button>' : '') +
					// Where Run would be: you can't run from a person, only give up.
					(bag.trainer ? forfeitButton(room) : '') +
					'</div>';
				controls.find('.movemenu').after(row);
				var tab = room.velvetBagTab;
				if (tab === 'balls' && !bag.wild) tab = 'medicine';
				if (tab === 'medicine' && !bag.hasItems) tab = bag.wild ? 'balls' : null;
				if (tab) {
					controls.find('.moveselect, .movemenu, .velvet-cmd').hide();
					controls.append('<div class="velvet-bag">' + pocketHTML(room, bag, tab) + '</div>');
				} else {
					controls.find('.moveselect, .movemenu').show();
				}
			} catch (e) { /* the moves stay as Showdown drew them */ }
		}

		/*
		 * Put the moves back. updateControls alone only redraws controls it thinks
		 * are hidden - once one Pokemon of a double has picked, it only ticks the
		 * timer - which is why Back did nothing and the battle looked frozen.
		 */
		function backToMoves(room) {
			room.velvetWaiting = false;
			room.controlsShown = false;
			room.updateControls();
		}

		function hook(room) {
			if (room.__velvetBagHooked || !room.$controls) return;
			room.__velvetBagHooked = true;
			room.$controls.on('click', '[data-velvet], [data-velvet-tab], [data-velvet-item], [data-velvet-send]', function (e) {
				e.preventDefault();
				e.stopPropagation();
				var el = this;
				var send = el.getAttribute('data-velvet-send');
				if (send) {
					var label = clean($(el).clone().children('small').remove().end().text());
					room.velvetBagTab = null;
					room.velvetBagItem = null;
					room.send(send);
					room.velvetWaiting = true;
					var what = /^\/run/.test(send) ? 'Trying to get away' : /^\/throwball/.test(send) ? 'Throwing a ' + label : 'Using an item on ' + label;
					room.$controls.html('<div class="controls"><p><em>' + esc(what) + '… waiting for the turn.</em> ' +
						'<button type="button" class="button" data-velvet="undo">Back</button></p></div>');
					return;
				}
				var act = el.getAttribute('data-velvet');
				if (act === 'undo') { backToMoves(room); return; }
				// Two taps: a forfeit is a loss, and one stray tap should not be.
				if (act === 'forfeit') {
					if (room.velvetForfeit) { room.velvetForfeit = false; room.send('/forfeit'); return; }
					room.velvetForfeit = true;
					setTimeout(function () { room.velvetForfeit = false; drawBag(room); }, 4000);
					drawBag(room);
					return;
				}
				if (act === 'bag') {
					room.velvetBagTab = readBag(room).wild ? 'balls' : 'medicine';
					room.velvetBagItem = null;
				} else if (act === 'close') {
					room.velvetBagTab = null;
					room.velvetBagItem = null;
				} else if (el.hasAttribute('data-velvet-tab')) {
					room.velvetBagTab = el.getAttribute('data-velvet-tab');
					room.velvetBagItem = null;
				} else if (el.hasAttribute('data-velvet-item')) {
					room.velvetBagItem = el.getAttribute('data-velvet-item') || null;
				}
				drawBag(room);
			});
			// The panels arrive right behind the request, often after the controls are
			// drawn, and change each turn - so the row is redrawn when they do.
			var logEl = room.$('.battle-log')[0];
			if (logEl && window.MutationObserver) {
				var pending = false;
				var isOurs = function (n) {
					if (!n || n.nodeType !== 1) return false;
					if (/uhtml-rp/.test(n.className || '')) return true;
					return !!(n.closest && n.closest('[class*="uhtml-rp"]'));
				};
				new MutationObserver(function (list) {
					/*
					 * A throw or a run the server refused (a legendary that won't let
					 * you leave, no balls left...) arrives as an error line and no new
					 * request, so "waiting for the turn" would wait for good. The moves
					 * come back instead, and the error says why.
					 */
					if (room.velvetWaiting) {
						for (var e = 0; e < list.length; e++) {
							var nodes = list[e].addedNodes || [];
							for (var n = 0; n < nodes.length; n++) {
								if (nodes[n].nodeType === 1 && /message-error/.test(nodes[n].className || '')) {
									backToMoves(room);
									return;
								}
							}
						}
					}
					var ours = false;
					for (var i = 0; i < list.length && !ours; i++) {
						if (isOurs(list[i].target)) { ours = true; break; }
						var added = list[i].addedNodes || [];
						for (var j = 0; j < added.length; j++) if (isOurs(added[j])) { ours = true; break; }
					}
					if (!ours || pending) return;
					pending = true;
					setTimeout(function () { pending = false; drawBag(room); }, 0);
				}).observe(logEl, { childList: true, subtree: true });
			}
		}

		var original = R.prototype.updateMoveControls;
		R.prototype.updateMoveControls = function () {
			var result = original.apply(this, arguments);
			hook(this);
			drawBag(this);
			return result;
		};
		// The switch and waiting screens get the Forfeit row too (drawForfeitElsewhere).
		['updateSwitchControls', 'updateWaitControls'].forEach(function (name) {
			var drawn = R.prototype[name];
			if (!drawn) return;
			R.prototype[name] = function () {
				var result = drawn.apply(this, arguments);
				try { hook(this); drawBag(this); } catch (e) { /* the controls stay as Showdown drew them */ }
				return result;
			};
		});
		// A new turn starts on the moves, the way the games do.
		var receiveRequest = R.prototype.receiveRequest;
		if (receiveRequest) {
			R.prototype.receiveRequest = function () {
				this.velvetBagTab = null;
				this.velvetBagItem = null;
				this.velvetWaiting = false;
				return receiveRequest.apply(this, arguments);
			};
		}
		return true;
	}

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
			var put = function (id, row, changed) {
				if (!row || (!row.desc && !row.shortDesc)) return;
				var entry = table[id] || (table[id] = { name: row.name });
				if (row.name && !entry.name) entry.name = row.name;
				var set = changed ? rpSet : function (o, k, v) { o[k] = v; };
				if (row.desc) set(entry, 'desc', row.desc);
				if (row.shortDesc) set(entry, 'shortDesc', row.shortDesc);
				// A generation-specific line would otherwise win in older formats.
				for (var g = 1; g <= 8; g++) {
					var gen = entry['gen' + g];
					if (!gen || typeof gen !== 'object') continue;
					if (changed) { rpSet(gen, 'desc', undefined, true); rpSet(gen, 'shortDesc', undefined, true); } else { delete gen.desc; delete gen.shortDesc; }
				}
			};
			// Ours: negative numbers, whether they came with the buffs or with Samantha.
			for (var id in dexTable || {}) {
				var row = dexTable[id];
				if (row && typeof row.num === 'number' && row.num < 0) put(id, row);
			}
			for (var changed in overrides || {}) put(changed, overrides[changed], true);
		};
		var buffs = window.VelvetBuffs || {};
		var over = buffs.overrides || {};
		fill('Moves', window.BattleMovedex, over.moves);
		fill('Abilities', window.BattleAbilities, over.abilities);
		// Every item this server ships, whatever its number: the Banettite-Halloween has a
		// positive one (National Dex refuses negative items), so the num < 0 test above
		// skipped it and its description vanished from the builder.
		var ourItems = {};
		for (var it in (buffs.items || {})) ourItems[it] = buffs.items[it];
		for (var ov in (over.items || {})) ourItems[ov] = over.items[ov];
		fill('Items', window.BattleItems, ourItems);
		// The battle lines for Makuro's and Raishin's terrains (data/velvet/abyss-shrine.js).
		// The server sends `-fieldstart|move: Abyssal Terrain`, and the log looks its
		// words up here by the effect's id, the way it finds Psychic Terrain's.
		var TERRAIN_TEXT = {
			abyssalterrain: {
				name: 'Abyssal Terrain',
				start: '  The battlefield sank into the abyss!',
				end: '  The abyss receded from the battlefield.',
				activate: '  {POKEMON} is shielded by the Abyssal Terrain!',
				shortDesc: 'Water and Dark moves 1.3x; priority moves fail against Dark types.',
			},
			shrineterrain: {
				name: 'Shrine Terrain',
				start: '  Purple lightning crackles over a shrine!',
				end: '  The shrine\'s lightning faded away.',
				activate: '  {POKEMON} is warded by the Shrine Terrain!',
				shortDesc: 'Electric and Ghost moves 1.3x; other Pokemon\'s status moves fail against Ghost types.',
			},
			sanctuaryterrain: {
				name: 'Sanctuary Terrain',
				start: '  A sanctuary rose from the earth, glowing pink!',
				end: '  The sanctuary sank back into the earth.',
				activate: '  {POKEMON} is sheltered by the Sanctuary Terrain!',
				shortDesc: 'Ground and Fairy moves 1.3x; other Pokemon cannot lower a Fairy type\'s stats.',
			},
		};
		// Frostbite ('frb'): the log looks a status's lines up by its id, like 'brn'.
		TERRAIN_TEXT.frb = {
			name: 'Frostbite',
			start: '  {POKEMON} got frostbite!',
			startFromItem: '  {POKEMON} got frostbite from the {ITEM}!',
			alreadyStarted: '  {POKEMON} is already frostbitten!',
			end: "  {POKEMON}'s frostbite was healed.",
			endFromItem: "  {POKEMON}'s {ITEM} healed its frostbite.",
			damage: '  {POKEMON} was hurt by its frostbite!',
		};
		for (var tid in TERRAIN_TEXT) if (!en.Moves[tid]) en.Moves[tid] = TERRAIN_TEXT[tid];
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
		// The battle log reads the same table without going through getTextEntry, so a
		// battle that starts before any tooltip was opened needs the fill here too.
		var Parser = window.BattleTextParser;
		if (Parser && Parser.prototype && Parser.prototype.textField && !Parser.prototype.textField.__velvet) {
			var textField = Parser.prototype.textField;
			var wrappedField = function () {
				fillDescriptions();
				return textField.apply(this, arguments);
			};
			wrappedField.__velvet = true;
			Parser.prototype.textField = wrappedField;
		}
		fillDescriptions();
		// Not done until the battle log's parser has been wrapped as well.
		return !!Parser;
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
			if (!results || !results.length || !RP.on) return results;

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
			if (!results || !RP.on) return results;

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
			if (!RP.on) return original.apply(this, arguments);
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
		// Below RU: the National Dex list, split into NU, PU and ZU headings by
		// sectionLowerTiers - the same ranking the server checks (lowTierOf).
		gen9rpnu: 'gen9nationaldexnu',
		gen9rppu: 'gen9nationaldexpu',
		gen9rpzu: 'gen9nationaldexzu',

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
			// Search is where the builder asks for a format's data, so this is where RP switches on or off.
			if (asked) setRpMode(isRpFormat(asked));
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

		/*
		 * Alias rows, the way Showdown's own index has them: "valiant" is a row of its
		 * own that points at Iron Valiant's row and says where in the name the match
		 * starts. Ours ("halloween" for the witch Mega Banette) go in after the rows
		 * they point at, found by id, and shift every other alias like any insert.
		 */
		var aliases = (buffs && buffs.searchAliases) || [];
		var rowOf = function (id) {
			var lo = 0, hi = index.length;
			while (lo < hi) { var m = (lo + hi) >> 1; if (index[m][0] < id) lo = m + 1; else hi = m; }
			return lo;
		};
		for (var a = 0; a < aliases.length; a++) {
			var target = rowOf(aliases[a][2]);
			if (!index[target] || index[target][0] !== aliases[a][2]) continue;
			var spot = rowOf(aliases[a][0]);
			// Several things share a later word ("orb": Flame Orb, Life Orb, Chilling Orb):
			// skip only an alias row with this key that already points at this target.
			var dup = false;
			for (var d = spot; d < index.length && index[d][0] === aliases[a][0]; d++) {
				if (index[d].length > 2 && index[index[d][2]] && index[index[d][2]][0] === aliases[a][2]) { dup = true; break; }
			}
			if (dup) continue;
			for (var k = 0; k < index.length; k++) {
				var row = index[k];
				if (row.length > 2 && typeof row[2] === 'number' && row[2] >= spot) row[2]++;
			}
			if (target >= spot) target++;
			index.splice(spot, 0, [aliases[a][0], aliases[a][1], target, aliases[a][3]]);
			if (offsets) offsets.splice(spot, 0, '');
		}

		/*
		 * "recharge" finds every recharge move (the owner): Hyper Beam and all the others
		 * that get Gen 1's no-recharge-after-a-KO rule. One alias row per move, all under
		 * the same word, so the search lists them together. Worked out from the flag, so a
		 * recharge move added later comes along.
		 */
		var recharge = [];
		for (var mid in (window.BattleMovedex || {})) {
			var mv = window.BattleMovedex[mid];
			if (mv && mv.flags && mv.flags.recharge && !mv.isZ && !mv.isMax) recharge.push(mid);
		}
		recharge.sort();
		for (var r2 = 0; r2 < recharge.length; r2++) {
			var tgt = rowOf(recharge[r2]);
			if (!index[tgt] || index[tgt][0] !== recharge[r2]) continue;
			// After any 'recharge' rows already in, so each move gets its own.
			var at = rowOf('recharge');
			while (index[at] && index[at][0] === 'recharge') at++;
			for (var k2 = 0; k2 < index.length; k2++) {
				var row2 = index[k2];
				if (row2.length > 2 && typeof row2[2] === 'number' && row2[2] >= at) row2[2]++;
			}
			if (tgt >= at) tgt++;
			index.splice(at, 0, ['recharge', 'move', tgt, 0]);
			if (offsets) offsets.splice(at, 0, '');
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
			// Listed already is not listed right: Mega Gengar sat under AG after this
			// server made it Uber, labelled Uber in the AG block (the Gliscor mistake
			// again). placeSpecies moves it if it is there and adds it if it is not.
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
		// Ours first: this server's own tiers below RU (data/velvet/tiering.js).
		var lowTiers = (window.VelvetBuffs || {}).lowTiers || {};
		for (var lowId in lowTiers) ninth[lowId] = lowTiers[lowId];
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
				var shiny = !!(data.shiny || (pokemon && pokemon.shiny) || (options && options.shiny));
				if (shiny && ours.shiny) set = (animated && ours.shiny.animated) || ours.shiny.still;
				var art = isFront ? set.front : set.back;

				data.url = SPRITES + art[0];
				// A standard 96x96 sheet needs none of the rest: whatever the
				// client computed for a sprite it could not find is exactly right
				// for one of these, and overriding it is how a sprite ends up
				// drawn at the wrong size in one place and not another.
				if (!ours.standard || art[3]) {
					data.w = art[1];
					data.h = art[2];
					data.y = (ours.y && (isFront ? ours.y.front : ours.y.back)) || 0;
				}
				data.pixelated = !art[3];
				// Whatever it is drawn from, it is one file - there is no sprite sheet
				// for the client to index into and no cry to play.
				data.isBackSprite = !isFront;
				data.cryurl = '';
				if (ours.cry) {
					// The client would fetch a cry from Showdown's host; hand it ours, already loaded.
					data.cryurl = ours.cry;
					try {
						if (window.BattleSound && BattleSound.soundCache && !BattleSound.soundCache[ours.cry]) {
							var cry = document.createElement('audio');
							cry.src = location.origin + '/' + ours.cry;
							BattleSound.soundCache[ours.cry] = cry;
						}
					} catch (e) { /* no sound: it comes out silently, as before */ }
				}
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
			if (!stats || !mon || !RP.on) return stats;

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
			// Frostbite halves Special Attack, the way burn halves Attack.
			if (status === 'frb') stats.spa = Math.floor(stats.spa / 2);
			var weather = window.toID((this.battle && this.battle.weather) || '');
			if (ability === 'diamonddust' && (weather === 'snowscape' || weather === 'hail')) stats.spe *= 2;
			if (ability === 'solstice' && (weather === 'sunnyday' || weather === 'desolateland') && item !== 'utilityumbrella') stats.spe *= 2;

			// The trio's signature items: Speed and the weaker attacking stat change places.
			var SWAP = { abyssalpearl: ['makuro', 'spa'], shrinebell: ['raishin', 'spa'], sanctuarylotus: ['chimai', 'atk'] };
			if (SWAP[item] && speciesid === SWAP[item][0]) {
				var other = SWAP[item][1];
				var keep = stats.spe;
				stats.spe = stats[other];
				stats[other] = keep;
			}

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
			if (ours && ours.shinyBuilder && set && set.shiny) return ours.shinyBuilder.split('#SPRITES#').join(SPRITES);
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
				// Greyed out when fainted, exactly as Showdown does it for its own icons -
				// returning early skipped that, so ours stayed bright after fainting.
				var fainted = pokemon && typeof pokemon === 'object' && pokemon.fainted ? ';opacity:.3;filter:grayscale(100%) brightness(.5)' : '';
				return 'background:transparent url(' + SPRITES + ours.icon + ') no-repeat scroll 0px 0px' + fainted;
			}
			try {
				return original.call(this, pokemon, facingLeft);
			} catch (e) {
				return '';
			}
		};
		/*
		 * And the number the icon sheet is indexed by. Ours are past the sheet (Makuro is
		 * 2001, Samantha -1), which the client turns into 0 - and the team editor skips
		 * drawing any icon whose number is 0. The number is only ever a truthiness check
		 * for ours, since getPokemonIcon above answers for them first.
		 */
		var originalNum = window.Dex.getPokemonIconNum;
		if (originalNum) {
			window.Dex.getPokemonIconNum = function (id) {
				var num = originalNum.apply(this, arguments);
				if (!num && ART[window.toID(id || '')] && ART[window.toID(id || '')].icon) return 1;
				return num;
			};
		}
		// The launcher caches each team's icon row the first time it draws it; drop what
		// was cached before these hooks were in, so ours are drawn.
		try {
			var teams = window.PS && window.PS.teams && window.PS.teams.list;
			if (teams) {
				for (var t = 0; t < teams.length; t++) teams[t].iconCache = null;
				if (window.PS.update) window.PS.update();
			}
		} catch (e) { /* the next team change redraws them anyway */ }
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
			correct(window.BattleMovedex, buffs.overrides && buffs.overrides.moves, 'BattleMovedex');
		} else ready = false;
		if (window.BattleAbilities) {
			for (var a in buffs.abilities) if (!window.BattleAbilities[a]) window.BattleAbilities[a] = buffs.abilities[a];
			correct(window.BattleAbilities, buffs.overrides && buffs.overrides.abilities, 'BattleAbilities');
		} else ready = false;
		if (window.BattleItems) {
			for (var i in buffs.items) if (!window.BattleItems[i]) window.BattleItems[i] = buffs.items[i];
		} else ready = false;

		// Base stats this server restored (Cresselia's Generation 8 defences).
		correct(window.BattlePokedex, buffs.overrides && buffs.overrides.species, 'BattlePokedex');

		// Balance Patch 1's evolution levels: the CDN's rows still carry Game Freak's.
		if (window.BattlePokedex && buffs.evoLevels) {
			for (var evo in buffs.evoLevels) {
				var row = window.BattlePokedex[evo];
				if (!row) continue;
				// A stone evolution that can now also happen by level keeps its stone here.
				rpRow('BattlePokedex', evo, row);
				if (buffs.evoAlso && buffs.evoAlso[evo]) rpSet(row, 'velvetLevelToo', buffs.evoAlso[evo]);
				else rpSet(row, 'evoLevel', buffs.evoLevels[evo]);
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
				if (entry && slots) { rpRow('BattlePokedex', id, entry); rpSet(entry, 'abilities', slots); }
			}
		} else ready = false;

		// The movepool. Merged into what is already there, never replacing it:
		// this table is the only copy of the Pokemon's real learnset the builder
		// has, and a species whose entry got overwritten would be left with the
		// nineteen moves we added and nothing it was born with.
		var table = window.BattleTeambuilderTable;
		if (table && table.learnsets) {
			// The new Pokemon's whole movepools: the client has no entry for them at all.
			for (var fresh in (buffs.newLearnsets || {})) {
				// Merged over whatever is there (MissingNo. has its Gen 1 moves in the client already).
				table.learnsets[fresh] = Object.assign({}, table.learnsets[fresh] || {}, buffs.newLearnsets[fresh]);
			}
			for (var id2 in buffs.bySpecies) {
				var learnset = table.learnsets[id2] || (table.learnsets[id2] = {});
				var added = buffs.bySpecies[id2].moves;
				for (var k = 0; k < added.length; k++) {
					// '9a' is generation 9 plus the region-born letter the builder
					// insists on before it will list a move in a ninth-generation
					// format. These Pokemon were never in Scarlet and Violet, so
					// their real entries stop at '...9pq' and a buff written without
					// the 'a' is listed in National Dex and invisible everywhere else.
					if (!learnset[added[k]] || learnset[added[k]] === '9a') rpSet(learnset, added[k], '9a');
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
			if (entry && entry.isNonstandard) rpSet(entry, 'isNonstandard', null);
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
	function correct(table, rows, tableName) {
		if (!table || !rows) return;
		for (var id in rows) {
			var target = table[id];
			if (!target) continue;
			rpRow(tableName, id, target);
			var row = rows[id];
			for (var key in row) {
				if (row[key] !== undefined && row[key] !== null) rpSet(target, key, row[key]);
			}
		}
	}

	/** The buffed moves this Pokemon got, if any. */
	function buffedMovesFor(speciesid) {
		var buffs = window.VelvetBuffs;
		if (!buffs || !buffs.get) return [];
		var record = buffs.get(speciesid);
		var moves = record ? record.moves.slice() : [];
		/*
		 * A Mega (or any battle-only form) learns through its BASE Pokemon, so it has
		 * the base's Awakened moves too - the same gap the abilities had (Mega Banette
		 * showed none of Banette's). Merged with anything the form has of its own.
		 */
		var base = baseFormOf(speciesid);
		var baseRecord = base ? buffs.get(base) : null;
		if (baseRecord) for (var i = 0; i < baseRecord.moves.length; i++) if (moves.indexOf(baseRecord.moves[i]) < 0) moves.push(baseRecord.moves[i]);
		return moves;
	}

	/** The Pokemon a Mega, Primal or battle-only form is picked as, or '' for anything else. */
	function baseFormOf(speciesid) {
		if (!window.Dex || !window.Dex.species) return '';
		var form = window.Dex.species.get(speciesid || '');
		if (!form || !form.exists) return '';
		var base = form.battleOnly || (form.isMega || /-Mega/.test(form.name || '') || form.isPrimal ? form.baseSpecies : '');
		if (base && typeof base !== 'string') base = base[0];
		return base ? window.toID(base) : '';
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
			if (!results || !buffs || !RP.on) return results;

			var species = this.species;
			if (species && typeof species !== 'string') species = species.species || species.name || '';
			var record = buffs.get(window.toID(species || ''));
			/*
			 * A Mega (or any battle-only form) is picked with its BASE Pokemon's abilities -
			 * that is what it holds before it transforms - so it takes the base's Awakened
			 * abilities too. Without this, picking Mega Banette lost Banette's Prankster.
			 */
			if ((!record || !record.abilities.length) && window.Dex && window.Dex.species) {
				var form = window.Dex.species.get(species || '');
				var base = form && (form.battleOnly || (form.isMega || /-Mega/.test(form.name || '') || form.isPrimal ? form.baseSpecies : ''));
				if (base && typeof base !== 'string') base = base[0];
				if (base) record = buffs.get(window.toID(base));
			}
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
			if (!RP.on) return out;
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

		var NAMES = { awakened: 'Awakened', signature: 'Signature', event: 'Event' };
		var LABELS = { awakened: '(Awakened Pokémon)', signature: '(has a signature move)', event: '(event Pokémon)' };
		var sets = { awakened: {}, signature: {}, event: {} };
		for (var e = 0; e < (buffs.events || []).length; e++) sets.event[buffs.events[e]] = true;
		var table = window.VelvetSignatureMoves;
		if (table && table.bySpecies) for (var sp in table.bySpecies) if (table.get(sp).length) sets.signature[sp] = true;
		for (var m = 0; m < (buffs.awakened.move || []).length; m++) sets.signature[buffs.awakened.move[m]] = true;
		var ids = (buffs.awakened.ability || []).concat(buffs.awakened.move || []);
		for (var n = 0; n < ids.length; n++) sets.awakened[ids[n]] = true;

		var filter = search.prototype.filter;
		search.prototype.filter = function (row, filters) {
			if (!filters || !row || row[0] !== 'pokemon' || !RP.on) return filter.apply(this, arguments);
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
				return row.call(this, { name: name }, matchStart, matchLength, errorMessage).replace('(egg group)', LABELS[window.toID(name)]);
			};
		}
		var Results = window.PSSearchResults;
		if (Results && Results.prototype && Results.prototype.renderEggGroupRowHTML) {
			var rowHTML = Results.prototype.renderEggGroupRowHTML;
			Results.prototype.renderEggGroupRowHTML = function (index, id) {
				var html = rowHTML.apply(this, arguments);
				return NAMES[id] ? html.replace('(egg group)', LABELS[id]) : html;
			};
		}
		return true;
	}

	/*
	 * "Usually useful" / "Usually useless" in the move list, made to know which side
	 * a Pokemon attacks from (the owner, 29 Sep 2026: "special moves on physical is
	 * troll, vice versa").
	 *
	 * Showdown's rule never compares a move's category with the Pokemon's stats, so
	 * Makuro (160 Atk / 50 SpA) was offered Hydro Pump as useful. And it calls every
	 * attack under 75 power useless unless it is on its own short list, which knows
	 * nothing of ours - Spark Scamper, a real priority move, sank to the bottom.
	 *
	 * RP formats only. Grouping only: legality is untouched.
	 */
	// Attacks worth having whatever the stats: fixed damage, another stat, utility, flexible category.
	var ANY_SIDE = {
		terablast: 1, bodypress: 1, foulplay: 1, seismictoss: 1, nightshade: 1, superfang: 1, ruination: 1,
		naturesmadness: 1, finalgambit: 1, endeavor: 1, counter: 1, mirrorcoat: 1, metalburst: 1, comeuppance: 1,
		knockoff: 1, uturn: 1, voltswitch: 1, flipturn: 1, rapidspin: 1, mortalspin: 1, nuzzle: 1, fakeout: 1,
		clearsmog: 1, dragontail: 1, circlethrow: 1, snarl: 1, icywind: 1, electroweb: 1, pursuit: 1, trailblaze: 1,
		photongeyser: 1, shellsidearm: 1, tripledive: 1,
	};
	/*
	 * Frostbite ('frb'), the sixth major status (data/velvet/frostbite.js).
	 *
	 * The client knows five statuses by name and ignores anything else: parseHealth
	 * drops an unknown one from "225/332 frb", and the HP bar has no tag for it. So the
	 * status is read, tagged FRB beside the HP bar, and worded in the battle log
	 * (fillDescriptions adds its lines), and the stat tooltip halves Special Attack.
	 */
	function installFrostbite() {
		var B = window.Battle, S = window.PokemonSprite;
		if (!B || !B.prototype || !B.prototype.parseHealth || !S || !S.prototype || !S.prototype.updateStatbar) return false;
		if (B.prototype.parseHealth.__velvetFrb) return true;
		var parse = B.prototype.parseHealth;
		var parseFrb = function (hpstring, output) {
			var out = parse.apply(this, arguments);
			var parts = String(hpstring || '').split(' ');
			if (out && parts[1] === 'frb') out.status = 'frb';
			return out;
		};
		parseFrb.__velvetFrb = true;
		B.prototype.parseHealth = parseFrb;
		var bar = S.prototype.updateStatbar;
		S.prototype.updateStatbar = function (pokemon) {
			var out = bar.apply(this, arguments);
			try {
				if (pokemon && pokemon.status === 'frb' && this.$statbar) {
					var $status = this.$statbar.find('.status');
					if (!$status.find('.frb').length) $status.prepend('<span class="frb">FRB</span> ');
				}
			} catch (e) { /* the bar stays as drawn */ }
			return out;
		};
		return true;
	}

	// Setup moves and the ones that do the same job better.
	var OUTCLASSED = {
		calmmind: ['quiverdance'],
		nastyplot: ['tailglow'],
		swordsdance: ['sovereignrite'],
		irondefense: ['cottonguard'],
		acidarmor: ['cottonguard'],
		barrier: ['cottonguard'],
		amnesia: ['velvetguard'],
	};
	function installMoveUsefulness() {
		var search = window.BattleMoveSearch;
		if (!search || !search.prototype || !search.prototype.moveIsNotUseless) return false;
		if (search.__velvetUseful) return true;
		search.__velvetUseful = true;
		var original = search.prototype.moveIsNotUseless;
		search.prototype.moveIsNotUseless = function (id, species, moves, set) {
			var verdict = original.apply(this, arguments);
			if (!RP.on) return verdict;
			try {
				var move = this.dex.moves.get(id);
				if (!move || !move.exists) return verdict;
				// Ours: a priority attack or one of our boosting moves is a real option.
				// (The client's rows of ours carry no `boosts` field, so every status move of ours counts.)
				if (move.num < 0 && (move.priority > 0 || move.category === 'Status')) verdict = true;
				// A setup move is useless beside a strictly better one the Pokemon also learns
				// (the owner: "Calm Mind is worse than Quiver so it's useless").
				var better = OUTCLASSED[id];
				if (better && moves) for (var b = 0; b < better.length; b++) if (moves.indexOf(better[b]) >= 0) return false;
				if (move.category === 'Status' || ANY_SIDE[id] || /^hiddenpower/.test(id)) return verdict;
				var stats = species && species.baseStats;
				if (!stats) return verdict;
				if (move.category === 'Physical' && stats.spa - stats.atk >= 40) return false;
				if (move.category === 'Special' && stats.atk - stats.spa >= 40) return false;
			} catch (e) { /* keep Showdown's answer */ }
			return verdict;
		};
		return true;
	}

	/*
	 * Type Gems, legal again in RP (data/velvet/gems.js). The builder's item list is
	 * Showdown's table for the format, which has no Gems in National Dex, and anything
	 * typed that is not in that list is shown as illegal. In RP mode the list gets a
	 * Gems section; official formats keep Showdown's own.
	 */
	var GEM_IDS = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'].map(function (t) { return t + 'gem'; });
	// Our items anyone can hold, listed first (the owner, 30 Sep 2026: "all custom items at the
	// top except mon-specific ones"). Ultra Shard is Beast Boost's and signature items are their
	// Pokemon's: those stay in their "Specific to" sections.
	var NEW_ITEMS = ['chillingorb', 'warpedhourglass'];
	function installGemItems() {
		var search = window.BattleItemSearch;
		if (!search || !search.prototype || !search.prototype.getDefaultResults) return false;
		if (search.__velvetGems) return true;
		search.__velvetGems = true;
		var original = search.prototype.getDefaultResults;
		search.prototype.getDefaultResults = function () {
			var out = original.apply(this, arguments);
			if (!RP.on || !out || (this.dex && this.dex.gen < 2)) return out;
			var have = {};
			for (var i = 0; i < out.length; i++) if (out[i][0] === 'item') have[out[i][1]] = true;
			var add = [];
			for (var g = 0; g < GEM_IDS.length; g++) if (!have[GEM_IDS[g]] && window.BattleItems && window.BattleItems[GEM_IDS[g]]) add.push(['item', GEM_IDS[g]]);
			// And this server's own items for everyone (Chilling Orb, Warped Hourglass,
			// Ultra Shard), which Showdown's list has never heard of either.
			var ours = [];
			for (var n = 0; n < NEW_ITEMS.length; n++) if (!have[NEW_ITEMS[n]] && window.BattleItems && window.BattleItems[NEW_ITEMS[n]]) ours.push(['item', NEW_ITEMS[n]]);
			var top = [];
			if (ours.length) top = top.concat([['header', 'New items']], ours);
			if (add.length) top = top.concat([['header', 'Gems']], add);
			return top.concat(out);
		};
		return true;
	}

	/*
	 * Battle music for RP events (the owner, 30 Sep 2026), live and in replays:
	 *   a wild legendary            its own theme (trios share one)
	 *   a rare or shiny wild         Black & White's rare wild theme
	 *   any other wild Pokemon       Black & White's wild theme
	 *   a gym leader                 Diamond & Pearl's gym leader theme
	 *   the Elite Four               Diamond & Pearl's Elite Four theme
	 *   the Champion                 Cynthia's theme (its piano intro once, then the battle loops)
	 *   an NPC trainer               Ruby & Sapphire's trainer theme
	 * Player-vs-player battles keep Showdown's music.
	 * The tables come from scripts/build-battle-music.js; the tracks are in client/audio.
	 *
	 * Who is who is read from the battle itself, so a replay sounds like the battle did:
	 * the wild side is named "Wild ...", and an NPC trainer battles with their class's
	 * avatar AND under its title ("Leader Lana" in brock-gen4) - a player who merely
	 * picked a trainer avatar is not mistaken for one.
	 */
	/* MUSIC-DATA-START: written by scripts/build-battle-music.js - edit the data files, not this. */
	var MUSIC_LOOP = {"legends/mew":[0,77000],"legends/raikou":[0,106000],"legends/entei":[0,91000],"legends/suicune":[0,177000],"legends/hooh":[0,112000],"legends/lugia":[0,77000],"legends/weather-trio":[0,94000],"legends/deoxys":[0,159000],"legends/regis":[0,95000],"legends/sinnoh-legendary":[0,63000],"legends/lake-trio":[0,112000],"legends/dialga-palkia":[0,157000],"legends/giratina":[0,223000],"legends/unova-legendary":[0,196000],"legends/reshiram-zekrom":[0,265000],"legends/kyurem":[0,265000],"legends/kyurem-black-white":[0,229000],"legends/mewtwo":[0,176000],"legends/xerneas-yveltal":[0,154000],"legends/solgaleo-lunala":[0,191000],"legends/tapu":[0,171000],"legends/ultra-necrozma":[0,188000],"legends/necrozma":[0,173000],"legends/ultra-beast":[0,163000],"legends/mysterious-being":[0,126000],"legends/zacian-zamazenta":[0,247000],"legends/eternatus":[0,618000],"legends/arceus":[0,179000],"legends/primal":[0,94070],"legends/makuro":[18663,152610],"legends/raishin":[9000,137000],"events/wild-bw":[0,175869],"events/rare-wild-bw":[0,174845],"events/trainer-rse":[0,175015],"events/gym-leader-dppt":[0,174620],"events/elite-four-dppt":[0,175378],"events/champion-cynthia":[38500,119500]};
	var MUSIC_EVENT = {"wild":"events/wild-bw","rarewild":"events/rare-wild-bw","trainer":"events/trainer-rse","gym":"events/gym-leader-dppt","elitefour":"events/elite-four-dppt","champion":"events/champion-cynthia"};
	var LEGEND_OF = {"mew":"legends/mew","raikou":"legends/raikou","entei":"legends/entei","suicune":"legends/suicune","hooh":"legends/hooh","lugia":"legends/lugia","groudon":"legends/weather-trio","kyogre":"legends/weather-trio","rayquaza":"legends/weather-trio","rayquazamega":"legends/weather-trio","deoxys":"legends/deoxys","deoxysattack":"legends/deoxys","deoxysdefense":"legends/deoxys","deoxysspeed":"legends/deoxys","regirock":"legends/regis","regice":"legends/regis","registeel":"legends/regis","rotom":"legends/sinnoh-legendary","heatran":"legends/sinnoh-legendary","darkrai":"legends/sinnoh-legendary","cresselia":"legends/sinnoh-legendary","manaphy":"legends/sinnoh-legendary","phione":"legends/sinnoh-legendary","shaymin":"legends/sinnoh-legendary","shayminsky":"legends/sinnoh-legendary","regigigas":"legends/sinnoh-legendary","uxie":"legends/lake-trio","azelf":"legends/lake-trio","mesprit":"legends/lake-trio","dialga":"legends/dialga-palkia","palkia":"legends/dialga-palkia","dialgaorigin":"legends/dialga-palkia","palkiaorigin":"legends/dialga-palkia","giratina":"legends/giratina","giratinaorigin":"legends/giratina","cobalion":"legends/unova-legendary","virizion":"legends/unova-legendary","terrakion":"legends/unova-legendary","victini":"legends/unova-legendary","keldeo":"legends/unova-legendary","landorus":"legends/unova-legendary","thundurus":"legends/unova-legendary","tornadus":"legends/unova-legendary","landorustherian":"legends/unova-legendary","thundurustherian":"legends/unova-legendary","tornadustherian":"legends/unova-legendary","meloetta":"legends/unova-legendary","genesect":"legends/unova-legendary","reshiram":"legends/reshiram-zekrom","zekrom":"legends/reshiram-zekrom","kyurem":"legends/kyurem","kyuremblack":"legends/kyurem-black-white","kyuremwhite":"legends/kyurem-black-white","mewtwo":"legends/mewtwo","mewtwomegax":"legends/mewtwo","mewtwomegay":"legends/mewtwo","xerneas":"legends/xerneas-yveltal","yveltal":"legends/xerneas-yveltal","zygarde":"legends/xerneas-yveltal","zygarde10":"legends/xerneas-yveltal","zygardecomplete":"legends/xerneas-yveltal","diancie":"legends/xerneas-yveltal","hoopa":"legends/xerneas-yveltal","hoopaunbound":"legends/xerneas-yveltal","volcanion":"legends/xerneas-yveltal","solgaleo":"legends/solgaleo-lunala","lunala":"legends/solgaleo-lunala","cosmog":"legends/solgaleo-lunala","cosmoem":"legends/solgaleo-lunala","tapukoko":"legends/tapu","tapulele":"legends/tapu","tapubulu":"legends/tapu","tapufini":"legends/tapu","necrozmaultra":"legends/ultra-necrozma","necrozma":"legends/necrozma","necrozmaduskmane":"legends/necrozma","necrozmadawnwings":"legends/necrozma","nihilego":"legends/ultra-beast","buzzwole":"legends/ultra-beast","pheromosa":"legends/ultra-beast","xurkitree":"legends/ultra-beast","celesteela":"legends/ultra-beast","kartana":"legends/ultra-beast","guzzlord":"legends/ultra-beast","poipole":"legends/ultra-beast","naganadel":"legends/ultra-beast","stakataka":"legends/ultra-beast","blacephalon":"legends/ultra-beast","calyrex":"legends/mysterious-being","calyrexice":"legends/mysterious-being","calyrexshadow":"legends/mysterious-being","glastrier":"legends/mysterious-being","spectrier":"legends/mysterious-being","regieleki":"legends/mysterious-being","regidrago":"legends/mysterious-being","kubfu":"legends/mysterious-being","urshifu":"legends/mysterious-being","urshifurapidstrike":"legends/mysterious-being","zacian":"legends/zacian-zamazenta","zamazenta":"legends/zacian-zamazenta","zaciancrowned":"legends/zacian-zamazenta","zamazentacrowned":"legends/zacian-zamazenta","eternatus":"legends/eternatus","eternatuseternamax":"legends/eternatus","arceus":"legends/arceus","groudonprimal":"legends/primal","kyogreprimal":"legends/primal","makuro":"legends/makuro","raishin":"legends/raishin"};
	var RARE_WILD = {"absol":1,"absolmega":1,"absolmegaz":1,"aegislash":1,"aegislashblade":1,"arceusbug":1,"arceusdark":1,"arceusdragon":1,"arceuselectric":1,"arceusfairy":1,"arceusfighting":1,"arceusfire":1,"arceusflying":1,"arceusghost":1,"arceusgrass":1,"arceusground":1,"arceusice":1,"arceuspoison":1,"arceuspsychic":1,"arceusrock":1,"arceussteel":1,"arceuswater":1,"arctibax":1,"articuno":1,"articunogalar":1,"bagon":1,"baxcalibur":1,"baxcaliburmega":1,"bayleef":1,"beldum":1,"blastoise":1,"blastoisegmax":1,"blastoisemega":1,"blaziken":1,"blazikenmega":1,"braixen":1,"brionne":1,"brutebonnet":1,"bulbasaur":1,"celebi":1,"charizard":1,"charizardgmax":1,"charizardmegax":1,"charizardmegay":1,"charmander":1,"charmeleon":1,"chesnaught":1,"chesnaughtmega":1,"chespin":1,"chienpao":1,"chikorita":1,"chimai":1,"chimchar":1,"chiyu":1,"cinderace":1,"cinderacegmax":1,"combusken":1,"crocalor":1,"croconaw":1,"cyndaquil":1,"darkraimega":1,"dartrix":1,"decidueye":1,"decidueyehisui":1,"deino":1,"delphox":1,"delphoxmega":1,"dewott":1,"dianciemega":1,"doublade":1,"dragapult":1,"dragonair":1,"dragonite":1,"dragonitemega":1,"drakloak":1,"dratini":1,"dreepy":1,"drizzile":1,"eevee":1,"eeveegmax":1,"eeveestarter":1,"emboar":1,"emboarmega":1,"empoleon":1,"enamorus":1,"enamorustherian":1,"espeon":1,"feebas":1,"fennekin":1,"feraligatr":1,"feraligatrmega":1,"fezandipiti":1,"flareon":1,"floragato":1,"fluttermane":1,"frigibax":1,"froakie":1,"frogadier":1,"fuecoco":1,"gabite":1,"garchomp":1,"garchompmega":1,"garchompmegaz":1,"genesectburn":1,"genesectchill":1,"genesectdouse":1,"genesectshock":1,"gholdengo":1,"gible":1,"gimmighoul":1,"gimmighoulroaming":1,"glaceon":1,"goodra":1,"goodrahisui":1,"goomy":1,"gougingfire":1,"greattusk":1,"greninja":1,"greninjaash":1,"greninjabond":1,"greninjamega":1,"grookey":1,"grotle":1,"grovyle":1,"hakamoo":1,"heatranmega":1,"honedge":1,"hydreigon":1,"incineroar":1,"infernape":1,"inteleon":1,"inteleongmax":1,"ironboulder":1,"ironbundle":1,"ironcrown":1,"ironhands":1,"ironjugulis":1,"ironleaves":1,"ironmoth":1,"ironthorns":1,"irontreads":1,"ironvaliant":1,"ivysaur":1,"jangmoo":1,"jirachi":1,"jolteon":1,"keldeoresolute":1,"kommoo":1,"kommoototem":1,"koraidon":1,"lapras":1,"laprasgmax":1,"larvitar":1,"latias":1,"latiasmega":1,"latios":1,"latiosmega":1,"leafeon":1,"litten":1,"lucario":1,"lucariomega":1,"lucariomegaz":1,"magearna":1,"magearnamega":1,"magearnaoriginal":1,"magearnaoriginalmega":1,"marshadow":1,"marshtomp":1,"meganium":1,"meganiummega":1,"melmetal":1,"melmetalgmax":1,"meloettapirouette":1,"meltan":1,"meowscarada":1,"metagross":1,"metagrossmega":1,"metang":1,"milotic":1,"mimikyu":1,"mimikyubusted":1,"mimikyubustedtotem":1,"mimikyutotem":1,"miraidon":1,"moltres":1,"moltresgalar":1,"monferno":1,"mudkip":1,"munchlax":1,"munkidori":1,"ogerpon":1,"ogerponcornerstone":1,"ogerponcornerstonetera":1,"ogerponhearthflame":1,"ogerponhearthflametera":1,"ogerpontealtera":1,"ogerponwellspring":1,"ogerponwellspringtera":1,"okidogi":1,"oshawott":1,"pecharunt":1,"pichu":1,"pichuspikyeared":1,"pignite":1,"pikachu":1,"pikachualola":1,"pikachubelle":1,"pikachucosplay":1,"pikachugmax":1,"pikachuhoenn":1,"pikachukalos":1,"pikachulibre":1,"pikachuoriginal":1,"pikachupartner":1,"pikachuphd":1,"pikachupopstar":1,"pikachurockstar":1,"pikachusinnoh":1,"pikachustarter":1,"pikachuunova":1,"pikachuworld":1,"piplup":1,"popplio":1,"primarina":1,"prinplup":1,"pupitar":1,"quaquaval":1,"quaxly":1,"quaxwell":1,"quilava":1,"quilladin":1,"raboot":1,"ragingbolt":1,"raichu":1,"raichualola":1,"raichumegax":1,"raichumegay":1,"rillaboom":1,"rillaboomgmax":1,"riolu":1,"roaringmoon":1,"rotomfan":1,"rotomfrost":1,"rotomheat":1,"rotommow":1,"rotomwash":1,"rowlet":1,"salamence":1,"salamencemega":1,"samurott":1,"samurotthisui":1,"sandyshocks":1,"sceptile":1,"sceptilemega":1,"scorbunny":1,"screamtail":1,"serperior":1,"servine":1,"shelgon":1,"silvally":1,"silvallybug":1,"silvallydark":1,"silvallydragon":1,"silvallyelectric":1,"silvallyfairy":1,"silvallyfighting":1,"silvallyfire":1,"silvallyflying":1,"silvallyghost":1,"silvallygrass":1,"silvallyground":1,"silvallyice":1,"silvallypoison":1,"silvallypsychic":1,"silvallyrock":1,"silvallysteel":1,"silvallywater":1,"skeledirge":1,"sliggoo":1,"sliggoohisui":1,"slitherwing":1,"snivy":1,"snorlax":1,"snorlaxgmax":1,"sobble":1,"spiritomb":1,"sprigatito":1,"squirtle":1,"swampert":1,"swampertmega":1,"sylveon":1,"tepig":1,"terapagos":1,"terapagosstellar":1,"terapagosterastal":1,"thwackey":1,"tinglu":1,"togekiss":1,"togepi":1,"togetic":1,"torchic":1,"torracat":1,"torterra":1,"totodile":1,"toxel":1,"toxtricity":1,"toxtricitygmax":1,"toxtricitylowkey":1,"toxtricitylowkeygmax":1,"treecko":1,"turtwig":1,"typenull":1,"typhlosion":1,"typhlosionhisui":1,"tyranitar":1,"tyranitarmega":1,"umbreon":1,"urshifugmax":1,"urshifurapidstrikegmax":1,"vaporeon":1,"venusaur":1,"venusaurgmax":1,"venusaurmega":1,"walkingwake":1,"wartortle":1,"wochien":1,"xerneasneutral":1,"zapdos":1,"zapdosgalar":1,"zarude":1,"zarudedada":1,"zeraora":1,"zeraoramega":1,"zoroark":1,"zoroarkhisui":1,"zorua":1,"zoruahisui":1,"zweilous":1,"zygardemega":1};
	var NPC_TRAINERS = {"youngster-gen4":{"role":"trainer","titles":["Youngster"]},"lass-gen4":{"role":"trainer","titles":["Lass"]},"bugcatcher-gen4dp":{"role":"trainer","titles":["Bug Catcher"]},"hiker-gen4":{"role":"trainer","titles":["Hiker"]},"camper-gen6":{"role":"trainer","titles":["Camper"]},"picnicker-gen6":{"role":"trainer","titles":["Picnicker"]},"fisherman-gen4":{"role":"trainer","titles":["Fisherman","Fisher"]},"swimmer-gen4":{"role":"trainer","titles":["Swimmer"]},"swimmerf-gen4":{"role":"trainer","titles":["Swimmer"]},"tuber-gen6":{"role":"trainer","titles":["Tuber"]},"sailor-gen6":{"role":"trainer","titles":["Sailor"]},"birdkeeper-gen4dp":{"role":"trainer","titles":["Bird Keeper"]},"blackbelt-gen4":{"role":"trainer","titles":["Black Belt"]},"battlegirl-gen4":{"role":"trainer","titles":["Battle Girl"]},"psychic-gen4":{"role":"trainer","titles":["Psychic"]},"psychicf-gen4":{"role":"trainer","titles":["Psychic"]},"hexmaniac-gen6":{"role":"trainer","titles":["Hex Maniac"]},"channeler-gen3":{"role":"trainer","titles":["Channeler"]},"sage-gen2":{"role":"trainer","titles":["Sage"]},"kimonogirl-gen2":{"role":"trainer","titles":["Kimono Girl","Kimono"]},"firebreather-gen2":{"role":"trainer","titles":["Fire Breather","Firebreather"]},"kindler-gen6":{"role":"trainer","titles":["Kindler"]},"skierf-gen4dp":{"role":"trainer","titles":["Skier"]},"pokemonranger-gen4":{"role":"trainer","titles":["Ranger"]},"pokemonrangerf-gen4":{"role":"trainer","titles":["Ranger"]},"pokemonbreederf-gen4":{"role":"trainer","titles":["Breeder"]},"backpacker-gen6":{"role":"trainer","titles":["Backpacker"]},"acetrainer-gen4dp":{"role":"trainer","titles":["Ace Trainer","Ace"]},"acetrainerf-gen4dp":{"role":"trainer","titles":["Ace Trainer","Ace"]},"veteran-gen6":{"role":"trainer","titles":["Veteran"]},"dragontamer-gen6":{"role":"trainer","titles":["Dragon Tamer","Tamer"]},"scientist-gen4":{"role":"trainer","titles":["Scientist"]},"worker-gen6":{"role":"trainer","titles":["Worker"]},"guitarist-gen4":{"role":"trainer","titles":["Guitarist"]},"beauty-gen4dp":{"role":"trainer","titles":["Beauty"]},"gentleman-gen4dp":{"role":"trainer","titles":["Gentleman"]},"lady-gen4":{"role":"trainer","titles":["Lady"]},"richboy-gen4":{"role":"trainer","titles":["Rich Boy"]},"pokefan-gen4":{"role":"trainer","titles":["Poke Fan"]},"artist-gen4":{"role":"trainer","titles":["Artist"]},"cyclist-gen4":{"role":"trainer","titles":["Cyclist"]},"ruinmaniac-gen6":{"role":"trainer","titles":["Ruin Maniac","Ruin Fan"]},"ninjaboy-gen6":{"role":"trainer","titles":["Ninja Boy","Ninja"]},"punkguy-gen7":{"role":"trainer","titles":["Punk"]},"delinquentf-gen9":{"role":"trainer","titles":["Delinquent"]},"schoolkid-gen4":{"role":"trainer","titles":["School Kid","Student"]},"teacher-gen7":{"role":"trainer","titles":["Teacher"]},"nurse":{"role":"trainer","titles":["Nurse"]},"policeman-gen4":{"role":"trainer","titles":["Officer"]},"aquagrunt":{"role":"trainer","titles":["Abyssal Grunt","Grunt"]},"galacticgrunt":{"role":"trainer","titles":["Galactic Grunt","Grunt"]},"cynthia":{"role":"champion","titles":["Champion"]},"lance-gen3":{"role":"elitefour","titles":["Elite Four","E4"]},"brock-gen4":{"role":"gym","titles":["Leader"]},"blue-gen3":{"role":"trainer","titles":["Rival"]},"twins-gen4":{"role":"trainer","titles":["Twins"]},"youngcouple-gen4dp":{"role":"trainer","titles":["Young Couple","Couple"]}};
	/* MUSIC-DATA-END */
	// Stronger music replaces weaker within a battle, never the other way.
	var MUSIC_RANK = { trainer: 1, wild: 1, rarewild: 2, gym: 3, elitefour: 3, champion: 3, legend: 4 };
	function speciesIdsOf(pokemon) {
		var id = window.toID(pokemon.speciesForme || pokemon.species || '');
		var species = window.Dex && Dex.species && Dex.species.get ? Dex.species.get(id) : null;
		return [id, window.toID((species && species.baseSpecies) || '')];
	}
	function npcRole(side) {
		var npc = side && NPC_TRAINERS[String(side.avatar || '').replace(/\.png$/, '')];
		if (!npc) return null;
		var name = String(side.name || '');
		var titled = npc.titles.some(function (t) { return name.toLowerCase().indexOf(t.toLowerCase() + ' ') === 0; });
		if (titled) return npc.role;
		// A leader whose name was too long for the title ("rock hard cock har", 1 Oct 2026):
		// the gym avatar alone, in an RP battle.
		var format = String((side.battle && (side.battle.tier || side.battle.id)) || '').toLowerCase();
		return npc.role === 'gym' && /rp/.test(format) ? 'gym' : null;
	}
	// What the scene should play for this Pokemon coming out, or null for no change.
	function musicFor(pokemon) {
		var side = pokemon && pokemon.side;
		if (!side) return null;
		if (/^wild\b/i.test(String(side.name || ''))) {
			var ids = speciesIdsOf(pokemon);
			var legend = LEGEND_OF[ids[0]] || LEGEND_OF[ids[1]];
			if (legend) return { kind: 'legend', file: legend };
			if (pokemon.shiny || RARE_WILD[ids[0]] || RARE_WILD[ids[1]]) return { kind: 'rarewild', file: MUSIC_EVENT.rarewild };
			return { kind: 'wild', file: MUSIC_EVENT.wild };
		}
		var role = npcRole(side);
		if (role === 'gym' || role === 'elitefour' || role === 'champion') return MUSIC_EVENT[role] ? { kind: role, file: MUSIC_EVENT[role] } : null;
		if (role === 'trainer') return { kind: 'trainer', file: MUSIC_EVENT.trainer };
		return null;
	}
	function playEventMusic(scene, pick, said) {
		if (!pick || !pick.file || !MUSIC_LOOP[pick.file] || !scene.updateBgm) return;
		var now = scene.velvetMusic;
		if (now && (now.file === pick.file || (!said && MUSIC_RANK[now.kind] >= MUSIC_RANK[pick.kind]))) return;
		scene.velvetMusic = pick;
		scene.bgmNum = 'velvet-' + pick.file;
		/*
		 * BattleSound.getSound puts "https://" + Config.routes.client + "/" in front of every
		 * path, which is play.pokemonshowdown.com on the replay page and gave nothing at all
		 * (the first release of these themes was silent everywhere because of it). So the
		 * player goes into its cache ready-made, pointing at this server.
		 */
		var key = 'audio/' + pick.file + '.mp3';
		if (BattleSound.soundCache && !BattleSound.soundCache[key]) {
			var audio = document.createElement('audio');
			audio.src = location.origin + '/' + key;
			audio.volume = (BattleSound.effectVolume || 50) / 100;
			BattleSound.soundCache[key] = audio;
		}
		var loop = MUSIC_LOOP[pick.file];
		scene.bgm = BattleSound.loadBgm(key, loop[0], Math.max(loop[0] + 5000, loop[1]), scene.bgm);
		scene.updateBgm();
	}
	/*
	 * Shiny sparkle (owner, 1 Oct 2026): a shiny sent out sparkles like the games - two
	 * rings of stars bursting from it, with the shiny sound - in every battle and replay.
	 * Drawn with the scene's own effect system, so it waits its turn like any animation,
	 * and skipped while a replay fast-forwards (no sound of a dozen shinies at once).
	 */
	var SPARKLE = { url: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'32'%20height%3D'32'%20viewBox%3D'0%200%2032%2032'%3E%3Cpath%20d%3D'M16%200%20L19%2013%20L32%2016%20L19%2019%20L16%2032%20L13%2019%20L0%2016%20L13%2013%20Z'%20fill%3D'%23fff8c8'%20stroke%3D'%23ffe060'%20stroke-width%3D'1'%2F%3E%3Ccircle%20cx%3D'16'%20cy%3D'16'%20r%3D'3'%20fill%3D'%23fff'%2F%3E%3C%2Fsvg%3E", w: 32, h: 32 };
	var SHINY_SOUND = 'audio/sfx/shiny.mp3';
	function shinySparkle(scene, pokemon, instant) {
		if (!pokemon || !pokemon.shiny || instant || !scene.showEffect) return;
		var battle = scene.battle;
		if (battle && (battle.seeking !== null && battle.seeking !== undefined)) return;
		var sprite = pokemon.sprite;
		if (!sprite || typeof sprite.x !== 'number') return;
		/*
		 * On a layer of our own: Showdown empties its effects layer (startAnimations) about
		 * 100 ms after a switch-in, before anything delayed can show - it wiped these stars
		 * and its own shiny "shine" alike. Positions come from the scene's own maths (pos).
		 */
		var layer = scene.velvetSparkleLayer;
		if (!layer || !document.contains(layer[0])) {
			layer = scene.velvetSparkleLayer = jQuery('<div style="position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:5"></div>');
			scene.$battle.append(layer);
		}
		var speed = Math.max(1, scene.acceleration || 1);
		var burst = function (start, end, delay, duration) {
			var sp = scene.pos(start, SPARKLE);
			var ep = scene.pos(end, SPARKLE);
			var el = jQuery('<img src="' + SPARKLE.url + '" style="display:block;position:absolute" />');
			layer.append(el);
			el.css(Object.assign({}, sp, { opacity: 0 })).delay(delay / speed).animate({ opacity: sp.opacity }, 1)
				.animate(ep, duration / speed).animate({ opacity: 0 }, 120 / speed, function () { el.remove(); });
		};
		var at = 650;   // after the Poke Ball opens
		var base = { x: sprite.x, y: sprite.y + 10, z: sprite.z };
		var rings = [[8, 0, 0], [8, Math.PI / 8, 220]];
		for (var r = 0; r < rings.length; r++) {
			for (var i = 0; i < rings[r][0]; i++) {
				var angle = rings[r][1] + (i * 2 * Math.PI) / rings[r][0];
				burst(Object.assign({}, base, { scale: 0.2, opacity: 1 }),
					Object.assign({}, base, { x: base.x + Math.cos(angle) * 55, y: base.y + Math.sin(angle) * 45, scale: 0.7, opacity: 0.3 }),
					at + rings[r][2], 480);
			}
		}
		// A last twinkle on the Pokemon itself.
		burst(Object.assign({}, base, { scale: 0.3, opacity: 1 }), Object.assign({}, base, { scale: 1.3, opacity: 0 }), at + 500, 400);
		if (window.BattleSound && BattleSound.soundCache) {
			if (!BattleSound.soundCache[SHINY_SOUND]) {
				var audio = document.createElement('audio');
				audio.src = location.origin + '/' + SHINY_SOUND;   // not Showdown's host (see playEventMusic)
				BattleSound.soundCache[SHINY_SOUND] = audio;
			}
			setTimeout(function () {
				try {
					BattleSound.soundCache[SHINY_SOUND].currentTime = 0;
					BattleSound.playEffect(SHINY_SOUND);
				} catch (e) { /* silent sparkle */ }
			}, at / Math.max(1, (scene.acceleration || 1)));
		}
	}
	function installEventMusic() {
		// The scene's animSummon runs whenever a Pokemon is sent out, in a live battle and in a
		// replay alike (the replay page's newer engine has no Battle.switchIn).
		var S = window.BattleScene;
		var B = window.Battle;
		if (!S || !S.prototype || !S.prototype.animSummon || !window.BattleSound) return false;
		if (!B || !B.prototype || !B.prototype.runMajor) return false;
		if (S.__velvetEventMusic) return true;
		S.__velvetEventMusic = true;
		/*
		 * Team preview: the music starts before anything is sent out, so the battle's own
		 * lines pick it there - "|player|" names the trainer, "|poke|" shows the wild
		 * Pokemon. Without this the preview played Showdown's music and the theme only
		 * came in on the first switch (owner, 1 Oct 2026).
		 */
		/*
		 * The server's word on the music: "|velvetmusic|<kind>|<track>" (src/rp-server.js
		 * musicFor). It plays that and stops guessing; the line itself never reaches the log.
		 */
		var run = B.prototype.run;
		if (run) {
			B.prototype.run = function (str) {
				if (typeof str === 'string' && str.indexOf('|velvetmusic|') === 0) {
					try {
						var parts = str.split('|');
						this.velvetMusicSaid = true;
						if (this.scene) playEventMusic(this.scene, { kind: parts[2], file: parts[3] }, true);
					} catch (e) { /* the battle goes on with its own music */ }
					return;
				}
				return run.apply(this, arguments);
			};
		}
		var runMajor = B.prototype.runMajor;
		B.prototype.runMajor = function (args) {
			var out = runMajor.apply(this, arguments);
			try {
				var cmd = args && args[0];
				if ((cmd === 'poke' || cmd === 'player') && this.scene && this.getSide && !this.velvetMusicSaid) {
					var side = this.getSide(args[1]);
					if (cmd === 'player') playEventMusic(this.scene, musicFor({ side: side }));
					else {
						var details = String(args[2] || '');
						playEventMusic(this.scene, musicFor({ side: side, speciesForme: details.split(',')[0], shiny: /,\s*shiny\b/.test(details) }));
					}
				}
			} catch (e) { /* the battle goes on with its own music */ }
			return out;
		};
		var animSummon = S.prototype.animSummon;
		// Sent out by a switch or dragged in (Roar, Whirlwind, Dragon Tail): a shiny sparkles.
		var animDragIn = S.prototype.animDragIn;
		if (animDragIn) {
			S.prototype.animDragIn = function (pokemon) {
				var out = animDragIn.apply(this, arguments);
				try { shinySparkle(this, pokemon, false); } catch (e) { /* no sparkle, the battle goes on */ }
				return out;
			};
		}
		S.prototype.animSummon = function (pokemon, slot, instant) {
			var out = animSummon.apply(this, arguments);
			try { shinySparkle(this, pokemon, instant); } catch (e) { /* no sparkle, the battle goes on */ }
			try { if (!(this.battle && this.battle.velvetMusicSaid)) playEventMusic(this, musicFor(pokemon)); } catch (e) { /* the battle goes on with its own music */ }
			return out;
		};
		/*
		 * The music volume slider: Showdown sets a track's volume only when it starts, so
		 * moving the slider did nothing to the music already playing (ours or Showdown's).
		 */
		if (BattleSound.setBgmVolume && !BattleSound.__velvetVolume) {
			BattleSound.__velvetVolume = true;
			var setVolume = BattleSound.setBgmVolume;
			BattleSound.setBgmVolume = function () {
				var out = setVolume.apply(this, arguments);
				try {
					var cur = this.currentBgm && this.currentBgm();
					if (cur && cur.sound) cur.sound.volume = Math.max(0, Math.min(1, this.bgmVolume / 100));
				} catch (e) { /* the next track takes the new volume anyway */ }
				return out;
			};
		}
		// Keep the event's music once it plays: the scene picks music again at moments of its own.
		var setBgm = S.prototype.setBgm;
		if (setBgm) {
			S.prototype.setBgm = function () {
				if (this.velvetMusic) return;
				// The player's own pick, for battles the server named no music for (ladder, challenges).
				try { if (playChosenMusic(this)) return; } catch (e) { /* Showdown's own, then */ }
				return setBgm.apply(this, arguments);
			};
		}
		// A replay rewinds by resetting the scene: let it pick again.
		var reset = S.prototype.resetBgm;
		if (reset) {
			S.prototype.resetBgm = function () {
				this.velvetMusic = null;
				return reset.apply(this, arguments);
			};
		}
		return true;
	}

	/*
	 * The avatar picker in Settings showed only Showdown's 293 numbered avatars (owner,
	 * 1 Oct 2026: "an outdated avatar list"). Below them now: every other official one,
	 * with a search box. Pictures load as they scroll into view. The names come from the
	 * server package (scripts/build-avatars.js); Showdown's personal custom avatars are
	 * not official and never listed.
	 */
	/* AVATAR-DATA-START: written by scripts/build-avatars.js */
	var OFFICIAL_AVATARS = ["aarune","acerola","acerola-masters","acerola-masters2","acerola-masters3","acetrainer-gen1","acetrainer-gen1rb","acetrainer-gen2","acetrainer-gen3","acetrainer-gen3jp","acetrainer-gen3rs","acetrainer-gen6","acetrainer-gen6xy","acetrainer-gen7","acetrainercouple-gen3","acetrainerf-gen1","acetrainerf-gen1rb","acetrainerf-gen2","acetrainerf-gen3","acetrainerf-gen3rs","acetrainerf-gen6","acetrainerf-gen6xy","acetrainerf-gen7","adaman","adaman-masters","adaman-masters2","aetheremployee","aetheremployeef","aetherfoundation","aetherfoundation2","aetherfoundationf","agatha-gen1","agatha-gen1rb","agatha-gen3","agatha-lgpe","akari","akari-isekai","alain","alec-anime","allister","allister-masters","allister-unmasked","amarys","amelia-shuffle","anabel","anabel-gen3","anabel-gen7","ansha","ansha-cook","anthe","anthea","anvin","aquagrunt","aquagrunt-rse","aquagruntf","aquagruntf-rse","aquasuit","archie-gen3","archie-gen6","archie-usum","arezu","arlo","aromalady-gen3","aromalady-gen3rs","aromalady-gen6","artist-gen6","artist-gen8","artist-gen9","artistf-gen6","arven-masters","arven-s","arven-v","ash-alola","ash-capbackward","ash-hoenn","ash-johto","ash-kalos","ash-sinnoh","ash-unova","atticus","avery","az","az-lza","backpacker-gen6","backpacker-gen8","backpacker-gen9","ballguy","ballguy-masters","baoba","barry-masters","battlegirl-gen3","battlegirl-gen6","battlegirl-gen6xy","bea","bea-masters","beauty-gen1","beauty-gen1rb","beauty-gen2","beauty-gen2jp","beauty-gen3","beauty-gen3rs","beauty-gen6","beauty-gen6xy","beauty-gen7","beauty-gen8","beauty-gen9","beauty-masters","becca","bede","bede-leader","bede-masters","bede-masters2","bellhop","bellis","beni","beni-ninja","bianca-masters","bianca-pwt","biker-gen1","biker-gen1rb","biker-gen2","biker-gen3","bill","bill-gen3","birch","birch-gen3","birdkeeper-gen1","birdkeeper-gen1rb","birdkeeper-gen2","birdkeeper-gen3","birdkeeper-gen3rs","birdkeeper-gen6","blackbelt-gen1","blackbelt-gen1rb","blackbelt-gen2","blackbelt-gen3","blackbelt-gen3rs","blackbelt-gen6","blackbelt-gen7","blackbelt-gen8","blackbelt-gen9","blaine-gen1","blaine-gen1rb","blaine-gen2","blaine-gen3","blaine-lgpe","blanche","blanche-casual","blue-gen1","blue-gen1champion","blue-gen1rb","blue-gen1rbchampion","blue-gen1rbtwo","blue-gen1two","blue-gen2","blue-gen3","blue-gen3champion","blue-gen3two","blue-gen7","blue-lgpe","blue-masters","blue-masters2","boarder-gen2","bodybuilder-gen9","bodybuilderf-gen9","brandon","brandon-gen3","brassius","brawly-gen3","brawly-gen6","brendan","brendan-contest","brendan-e","brendan-gen3","brendan-gen3rs","brendan-masters","brendan-masters2","brendan-masters3","brendan-rs","briar","brigette","brock-gen1","brock-gen1rb","brock-gen2","brock-gen3","brock-lgpe","brock-masters","bruno-gen1","bruno-gen1rb","bruno-gen2","bruno-gen3","bryony","bugcatcher","bugcatcher-gen1","bugcatcher-gen1rb","bugcatcher-gen2","bugcatcher-gen3","bugcatcher-gen3rs","bugcatcher-gen6","bugmaniac-gen3","bugmaniac-gen6","bugsy-gen2","bugsy-masters","burgh-masters","burglar-gen1","burglar-gen1rb","burglar-gen2","burglar-gen3","burglar-lgpe","burnet","burnet-radar","butler","cabbie","cabbie-gen9","cafemaster","caitlin-gen4","caitlin-masters","calaba","calem","calem-masters","cameraman-gen6","cameraman-gen8","camper-gen2","camper-gen3","camper-gen3rs","camper-gen6","canari","candela","candela-casual","candice-masters","caraliss","caretaker","carmine","carmine-festival","carmine-masters","cedricjuniper","celio","channeler-gen1","channeler-gen1rb","channeler-gen3","channeler-lgpe","charm","charon","chase","chef","cheren-masters","choy","christoph","chuck-gen2","clair-gen2","clair-masters","clavell-s","clerk-gen8","clerk-unite","clerkf-gen8","cliff","clive-v","clover","cogita","coin","collector-gen3","collector-gen6","collector-gen7","collector-masters","colress-gen7","colza","concordia","cook","cook-gen7","cook-gen9","corbeau","courier","courtney","courtney-gen3","crispin","crushgirl-gen3","crushkin-gen3","cueball-gen1","cueball-gen1rb","cueball-gen3","curtis","cyllene","cynthia-anime","cynthia-anime2","cynthia-gen7","cynthia-masters","cynthia-masters2","cynthia-masters3","cynthia-masters4","cynthia-masters5","cyrano","cyrus-masters","dagero","daisy","daisy-gen3","dana","dancer-gen7","dancer-gen8","darach","dawn-contest","dawn-masters","dawn-masters2","dawn-masters3","delinquent","delinquent-gen9","delinquentf-gen9","delinquentf2-gen9","dendra","dexio","dexio-gen6","diamondclanmember","diantha","diantha-masters","diantha-masters2","doctor-gen8","doctorf-gen8","dragontamer-gen3","dragontamer-gen6","dragontamer-gen9","drake-gen3","drasna","drayton","dulse","elaine","elesa-masters","elesa-masters2","elesa-masters3","elio","elio-masters","elio-usum","elm","emma","emma-lza","emmet-masters","engineer-gen1","engineer-gen1rb","engineer-gen3","erbie-unite","eri","erika-gen1","erika-gen1rb","erika-gen2","erika-gen3","erika-lgpe","erika-masters","erika-masters2","erika-masters3","essentia","ethan-gen2","ethan-gen2c","ethan-masters","ethan-pokeathlon","eusine-gen2","evelyn","expert-gen3","expert-gen6","expertf-gen3","expertf-gen6","faba","fairytalegirl","falkner-gen2","fennel","firebreather-gen2","firefighter","fisher-gen8","fisherman-gen1","fisherman-gen1rb","fisherman-gen2jp","fisherman-gen3","fisherman-gen3rs","fisherman-gen6","fisherman-gen6xy","fisherman-gen7","flannery-gen3","flannery-gen6","flaregrunt","flaregruntf","florian-bb","florian-festival","florian-masters","florian-s","freediver","furisodegirl-black","furisodegirl-blue","furisodegirl-pink","furisodegirl-white","gaeric","gambler-gen1","gambler-gen1rb","gamer-gen3","garcon","gardener","gardenia-masters","geeta","gentleman-gen1","gentleman-gen1rb","gentleman-gen2","gentleman-gen3","gentleman-gen3rs","gentleman-gen6","gentleman-gen6xy","gentleman-gen7","gentleman-gen8","gentleman-lgpe","giacomo","ginchiyo-conquest","ginter","giovanni-gen1","giovanni-gen1rb","giovanni-gen3","giovanni-lgpe","giovanni-masters","giovanni-masters2","glacia","glacia-gen3","gladion","gladion-masters","gladion-masters2","gladion-stance","gloria","gloria-dojo","gloria-league","gloria-masters","gloria-masters2","gloria-tundra","golfer","gordie","grace","grant","green","greta","greta-gen3","grimsley-gen7","grimsley-masters","grisham","grusha","guitarist-gen2","guitarist-gen3","guitarist-gen6","gurkinn","guzma","guzma-masters","gwynn","hala","hanbei-conquest","hapu","harmony","hassel","hau","hau-masters","hau-stance","hayley","heath","hero-conquest","hero2-conquest","heroine-conquest","heroine2-conquest","hexmaniac-gen3","hexmaniac-gen3jp","hexmaniac-gen6","hiker-gen1","hiker-gen1rb","hiker-gen2","hiker-gen3","hiker-gen3rs","hiker-gen6","hiker-gen7","hiker-gen8","hiker-gen9","hilbert-masters","hilbert-masters2","hilbert-masters3","hilda-masters","hilda-masters2","hilda-masters3","hilda-masters4","hop","hop-masters","hugh-masters","hyde","ilima","ingo-hisui","ingo-masters","interviewers-gen3","interviewers-gen6","iono","iono-masters","iono-masters2","irida","irida-masters","irida-masters2","iris-masters","iris-masters2","iscan","ivor","jacinthe","jacq","jamie","janine-gen2","janitor-gen7","janitor-gen9","jasmine-contest","jasmine-gen2","jasmine-masters","jasmine-masters2","jasmine-masters3","jessiejames-gen1","johanna","johanna-contest","jrtrainer-gen1","jrtrainer-gen1rb","jrtrainerf-gen1","jrtrainerf-gen1rb","juan-gen3","juggler-gen1","juggler-gen1rb","juggler-gen2","juggler-gen3","juliana-bb","juliana-festival","juliana-masters","juliana-s","juniper","kabu","kabu-masters","kahili","kamado","kamado-armor","karen-gen2","katy","kiawe","kieran","kieran-champion","kieran-festival","kieran-masters","kimonogirl-gen2","kindler-gen3","kindler-gen6","klara","kofu","koga-gen1","koga-gen1rb","koga-gen2","koga-gen3","koga-lgpe","korrina","korrina-masters","kris","kris-gen2","kris-masters","kris-masters2","kukui","kukui-stand","kunoichi-conquest","kunoichi2-conquest","kurt","lacey","lacey-masters","lady-gen3","lady-gen3rs","lady-gen6","lady-gen6oras","lana","lana-masters","lana-masters2","lance-gen1","lance-gen1rb","lance-gen2","lance-gen3","lance-lgpe","lance-masters","lance-masters2","lanette","larry","larry-masters","larry-masters2","lass-gen1","lass-gen1rb","lass-gen2","lass-gen3","lass-gen3rs","lass-gen6","lass-gen6oras","lass-gen7","lass-gen8","laventon","laventon2","leaf-gen3","leaf-masters","leaf-masters2","leaguestaff","leaguestafff","lebanne","leon","leon-masters","leon-masters2","leon-tower","lian","lida","liko","lillie","lillie-masters","lillie-masters2","lillie-masters3","lillie-masters4","lillie-masters5","lillie-z","lisia","lisia-masters","liza-gen6","liza-masters","lorelei-gen1","lorelei-gen1rb","lorelei-gen3","lorelei-lgpe","ltsurge-gen1","ltsurge-gen1rb","ltsurge-gen2","ltsurge-gen3","lucas-contest","lucy","lucy-gen3","lusamine","lusamine-masters","lusamine-nihilego","lyra-masters","lyra-masters2","lyra-pokeathlon","lysandre","lysandre-masters","mable","madame-gen6","madame-gen7","madame-gen8","magmagrunt","magmagrunt-rse","magmagruntf","magmagruntf-rse","magmasuit","magnolia","magnus","mai","maid-gen4","maid-gen6","mallow","mallow-masters","malva","marley-masters","marnie","marnie-league","marnie-masters","marnie-masters2","marnie-masters3","marnie-masters4","masamune-conquest","mateo","matt","matt-gen3","maxie-gen3","maxie-gen6","may","may-contest","may-e","may-gen3","may-gen3rs","may-masters","may-masters2","may-masters3","may-masters4","may-rs","medium-gen2jp","mela","melli","melony","miku-fairy","miku-fire","miku-flying","miku-ghost","miku-grass","miku-ground","miku-ice","miku-psychic","miku-water","milo","mina","mina-lgpe","mina-masters","miriam","mirror","misty-gen1","misty-gen1rb","misty-gen2","misty-gen3","misty-lgpe","misty-masters","model-gen8","mohn","mohn-anime","molayne","mom-alola","mom-hoenn","mom-johto","mom-paldea","mom-unova","mom-unova2","morgan","morty-gen2","morty-masters","morty-masters2","morty-masters3","mrbriney","mrfuji-gen3","mrstone","musician-gen8","musician-gen9","mustard","mustard-champion","mustard-master","n-masters","n-masters2","n-masters3","nancy","nanu","nate-masters","nate-pokestar","nate-pokestar3","naveen","nemona-masters","nemona-s","nemona-v","neroli","nessa","nessa-masters","ninjaboy-gen3","ninjaboy-gen6","nita","nobunaga-conquest","noland","noland-gen3","norman-gen3","norman-gen6","oak","oak-gen1","oak-gen1rb","oak-gen2","oak-gen3","officer-gen2","officeworker","officeworker-gen9","officeworkerf","officeworkerf-gen9","ogreclan","oichi-conquest","oldcouple-gen3","oleana","olivia","olympia","opal","ortega","owner","painter-gen3","palina","parasollady-gen3","parasollady-gen6","paulo-masters","paxton","pearlclanmember","penny","peonia","peony","peony-league","perrin","perrin-masters","pesselle","phil","phillipe","phoebe-gen3","phoebe-gen6","phoebe-masters","phorus-unite","phyco","picnicker-gen2","picnicker-gen3","picnicker-gen3rs","picnicker-gen6","piers","piers-league","piers-masters","player-go","playerf-go","plumeria","plumeria-league","pokefan-gen2","pokefan-gen3","pokefan-gen6","pokefan-gen6xy","pokefanf-gen2","pokefanf-gen3","pokefanf-gen6","pokefanf-gen6xy","pokekid-gen8","pokekidf-gen8","pokemaniac-gen1","pokemaniac-gen1rb","pokemaniac-gen2","pokemaniac-gen3","pokemaniac-gen3rs","pokemaniac-gen6","pokemaniac-gen9","pokemonbreeder-gen3","pokemonbreeder-gen6","pokemonbreeder-gen6xy","pokemonbreeder-gen7","pokemonbreeder-gen8","pokemonbreederf-gen3","pokemonbreederf-gen3frlg","pokemonbreederf-gen6","pokemonbreederf-gen6xy","pokemonbreederf-gen7","pokemonbreederf-gen8","pokemoncenterlady","pokemonranger-gen3","pokemonranger-gen3rs","pokemonranger-gen6","pokemonranger-gen6xy","pokemonrangerf-gen3","pokemonrangerf-gen3rs","pokemonrangerf-gen6","pokemonrangerf-gen6xy","policeman-gen7","policeman-gen8","poppy","poppy-masters","postman","preschooler-gen6","preschooler-gen7","preschoolerf-gen6","preschoolerf-gen7","preschoolers","pryce-gen2","psychic-gen1","psychic-gen1rb","psychic-gen2","psychic-gen3","psychic-gen3rs","psychic-gen6","psychic-lgpe","psychicf-gen3","psychicf-gen3rs","psychicfjp-gen3","punkgirl","punkgirl-gen7","punkgirl-masters","punkguy","punkguy-gen7","raifort","raihan","raihan-masters","railstaff","rainbowrocketgrunt","rainbowrocketgruntf","ramos","ranmaru-conquest","red-gen1","red-gen1main","red-gen1rb","red-gen1title","red-gen2","red-gen3","red-gen7","red-lgpe","red-masters","red-masters2","red-masters3","red-masters4","rei","rei-isekai","rei-masters","reporter-gen6","reporter-gen8","rhi","richboy-gen3","richboy-gen6","richboy-gen6xy","rika","rika-masters","risingstar","risingstar-gen6","risingstarf","risingstarf-gen6","rita","river","rocker-gen1","rocker-gen1rb","rocker-gen3","rocket-gen1","rocket-gen1rb","rocketexecutive-gen2","rocketexecutivef-gen2","rocketgrunt-gen2","rocketgruntf-gen2","rollerskater","rollerskaterf","rosa-masters","rosa-masters2","rosa-masters3","rosa-masters4","rosa-pokestar","rosa-pokestar2","rosa-pokestar3","rose","rose-zerosuit","rowan","roxanne-gen3","roxanne-gen6","roxanne-masters","roxie-masters","roy","ruffian","ruinmaniac-gen3","ruinmaniac-gen3rs","ruinmaniac-gen6","rye","ryme","ryuki","sabi","sabrina-frlg","sabrina-gen1","sabrina-gen1rb","sabrina-gen2","sabrina-gen3","sabrina-lgpe","sabrina-masters","sada","sada-ai","sage-gen2","sage-gen2jp","saguaro","sailor-gen1","sailor-gen1rb","sailor-gen2","sailor-gen3","sailor-gen3jp","sailor-gen3rs","sailor-gen6","salvatore","samsonoak","sanqua","sbcmember","schoolboy","schoolboy-gen2","schoolgirl","schoolkid-gen3","schoolkid-gen6","schoolkid-gen8","schoolkidf-gen3","schoolkidf-gen6","schoolkidf-gen8","scientist-gen1","scientist-gen1rb","scientist-gen2","scientist-gen3","scientist-gen6","scientist-gen7","scientist-gen9","scientistf-gen6","scott","scottie-masters","scubadiver","securitycorps","securitycorpsf","selene","selene-masters","selene-masters2","selene-usum","serena","serena-anime","serena-masters","serena-masters2","serena-masters3","shauna","shauna-masters","shauntal-masters","shelly","shelly-gen3","shielbert","sidney","sidney-gen3","siebold","siebold-masters","sierra","sightseer","sightseerf","silver-gen2","silver-gen2kanto","silver-masters","silver-masters2","sina","sina-gen6","sisandbro-gen3","sisandbro-gen3rs","skier-gen2","skullgrunt","skullgruntf","skyla-masters","skyla-masters2","skyla-masters3","skytrainer","skytrainerf","soliera","sonia","sonia-masters","sonia-masters2","sonia-professor","sophocles","sordward","sordward-shielbert","spark","spark-casual","spenser","spenser-gen3","srandjr-gen3","stargrunt-s","stargrunt-v","stargruntf-s","stargruntf-v","steven-gen3","steven-gen6","steven-masters","steven-masters2","steven-masters3","steven-masters4","steven-masters5","streetthug","streetthug-masters","supernerd-gen1","supernerd-gen1rb","supernerd-gen2","supernerd-gen3","surfer","swimmer-gen1","swimmer-gen1rb","swimmer-gen4jp","swimmer-gen6","swimmer-gen7","swimmer-gen8","swimmer-masters","swimmerf-gen2","swimmerf-gen3","swimmerf-gen3rs","swimmerf-gen6","swimmerf-gen7","swimmerf-gen8","swimmerf2-gen6","swimmerf2-gen7","swimmerfjp-gen2","swimmerm-gen2","swimmerm-gen3","swimmerm-gen3rs","sycamore","sycamore-masters","tabitha","tabitha-gen3","tamer-gen1","tamer-gen1rb","tamer-gen3","taohua","tarragon","tate-gen6","tate-masters","tateandliza-gen3","tateandliza-gen6","taunie","teacher-gen2","teacher-gen7","teamaquabeta-gen3","teamaquagruntf-gen3","teamaquagruntm-gen3","teammagmagruntf-gen3","teammagmagruntm-gen3","teammates","teamrocketgruntf-gen3","teamrocketgruntm-gen3","theroyal","tierno","tina-masters","toddsnap","toddsnap2","tourist","touristf","touristf2","trace","trevor","trialguide","trialguidef","triathletebiker-gen6","triathletebikerf-gen3","triathletebikerm-gen3","triathleterunner-gen6","triathleterunnerf-gen3","triathleterunnerm-gen3","triathleteswimmer-gen6","triathleteswimmerf-gen3","triathleteswimmerm-gen3","tricia-masters","trinnia-masters","trista-masters","tuber-gen3","tuber-gen6","tuberf-gen3","tuberf-gen3rs","tuberf-gen6","tucker","tucker-gen3","tuli","tulip","turo","turo-ai","twins-gen2","twins-gen3","twins-gen3rs","twins-gen6","tyme","ultraforestkartenvoy","urbain","valerie","vessa","veteran-gen6","veteran-gen7","veteranf-gen6","veteranf-gen7","victor","victor-dojo","victor-league","victor-masters","victor-tundra","vince","viola","viola-masters","volkner-masters","volo","volo-ginkgo","waiter-gen9","waitress-gen6","waitress-gen9","wallace-gen3","wallace-gen3rs","wallace-gen6","wallace-masters","wally-gen3","wally-masters","wally-rse","wattson-gen3","whitney-gen2","whitney-masters","wicke","wikstrom","will-gen2","willem","willow","willow-casual","winona-gen3","winona-gen6","worker-gen6","worker-gen7","worker-gen8","worker-gen9","worker-lgpe","worker2-gen6","workerf-gen8","wulfric","xerosic","yancy","yellgrunt","yellgruntf","youngathlete","youngathletef","youngcouple-gen3","youngcouple-gen3rs","youngcouple-gen6","youngn","youngster-gen1","youngster-gen1rb","youngster-gen2","youngster-gen3","youngster-gen3rs","youngster-gen4","youngster-gen6","youngster-gen6xy","youngster-gen7","youngster-gen8","youngster-gen9","youngster-masters","yukito-hideko","zinnia-masters","zirco-unite","zisu","zossie"];
	/* AVATAR-DATA-END */
	/*
	 * The old client (what the site serves): its popup is HTML built in initialize, and a
	 * button named setAvatar sends its value as /avatar. The list goes in the same way.
	 */
	function installOldAvatarList() {
		var P = window.AvatarsPopup;
		if (!P || !P.prototype || !P.prototype.initialize || !window.jQuery) return false;
		if (P.__velvetAll) return true;
		P.__velvetAll = true;
		var initialize = P.prototype.initialize;
		P.prototype.initialize = function () {
			var out = initialize.apply(this, arguments);
			try {
				var cur = window.app && app.user && String(app.user.get('avatar'));
				var buf = '<div class="velvet-avatars" style="clear:left;padding-top:6px"><p><strong>All official avatars</strong> ' +
					'<input type="search" class="textbox" placeholder="Search (cynthia, ace trainer, gen4...)" style="width:250px;margin-left:6px" /> ' +
					'<small class="velvet-avatar-count" style="color:#888"></small></p>' +
					'<div class="velvet-avatar-grid" style="max-height:380px;overflow-y:auto">';
				for (var i = 0; i < OFFICIAL_AVATARS.length; i++) {
					var name = OFFICIAL_AVATARS[i];
					var src = window.Dex ? Dex.resolveAvatar(name) : 'https://play.pokemonshowdown.com/sprites/trainers/' + name + '.png';
					buf += '<button name="setAvatar" value="' + name + '" data-search="' + name.replace(/[^a-z0-9]/g, '') + '" title="/avatar ' + name + '" class="button' + (name === cur ? ' cur' : '') + '" style="width:84px;height:84px;padding:1px;margin:2px;vertical-align:top">' +
						'<img src="' + src + '" loading="lazy" width="80" height="80" alt="" style="image-rendering:pixelated;object-fit:contain" /></button>';
				}
				buf += '</div></div>';
				var $section = jQuery(buf);
				var $last = this.$el.children('p').last();
				if ($last.length) $section.insertBefore($last); else this.$el.append($section);
				this.$el.css('max-width', 900);
				var $count = $section.find('.velvet-avatar-count').text(OFFICIAL_AVATARS.length + ' avatars');
				$section.find('input').on('input', function () {
					var q = String(this.value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
					var shown = 0;
					$section.find('button').each(function () {
						var hit = !q || this.getAttribute('data-search').indexOf(q) >= 0;
						this.style.display = hit ? '' : 'none';
						if (hit) shown++;
					});
					$count.text(shown + ' shown');
				});
			} catch (e) { /* the numbered grid still works */ }
			return out;
		};
		return true;
	}
	function installAvatarList() {
		var old = installOldAvatarList();
		var P = window.AvatarsPanel;
		if (!P || !P.prototype || !P.prototype.render || !window.preact) return old;
		if (P.__velvetAll) return true;
		P.__velvetAll = true;
		var render = P.prototype.render;
		P.prototype.render = function () {
			var tree = render.apply(this, arguments);
			try {
				var h = preact.h;
				var self = this;
				var filter = String((this.state && this.state.velvetFilter) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
				var list = OFFICIAL_AVATARS.filter(function (n) { return !filter || n.replace(/[^a-z0-9]/g, '').indexOf(filter) >= 0; });
				var current = window.PS && PS.user && PS.user.avatar;
				var section = h('div', { 'class': 'velvet-avatars', style: 'clear:left;padding-top:8px' },
					h('label', { 'class': 'optlabel' }, h('strong', null, 'All official avatars '),
						h('input', {
							type: 'search', 'class': 'textbox', placeholder: 'Search (cynthia, ace trainer, gen4...)', style: 'width:260px;margin-left:6px',
							value: (this.state && this.state.velvetFilter) || '',
							onInput: function (e) { self.setState({ velvetFilter: e.currentTarget.value }); },
						}),
						h('small', { style: 'margin-left:8px;color:#888' }, list.length + ' shown')),
					h('div', { style: 'max-height:420px;overflow-y:auto;margin-top:6px' },
						list.map(function (name) {
							return h('button', {
								key: name, 'data-cmd': '/closeand /avatar ' + name, title: '/avatar ' + name,
								'class': 'button' + (name === current ? ' cur' : ''),
								style: 'width:84px;height:84px;padding:1px;margin:2px;vertical-align:top;' + (name === current ? 'outline:2px solid #4a8;' : ''),
							}, h('img', {
								src: window.Dex ? Dex.resolveAvatar(name) : 'https://play.pokemonshowdown.com/sprites/trainers/' + name + '.png',
								loading: 'lazy', width: 80, height: 80, alt: name, style: 'image-rendering:pixelated;object-fit:contain',
							}));
						})));
				// Into the panel, after the numbered grid.
				var pad = tree && tree.props && tree.props.children;
				pad = Array.isArray(pad) ? pad[0] : pad;
				if (pad && pad.props) {
					var kids = [].concat(pad.props.children);
					var at = kids.length - 1;   // before the closing Cancel button
					kids.splice(at, 0, section);
					pad.props.children = kids;
				}
			} catch (e) { /* the numbered grid still works */ }
			return tree;
		};
		return true;
	}

	/*
	 * The battle music picker (owner, 1 Oct 2026: "add a battle music player for ladder and
	 * custom challenges"). In the sound menu (the speaker): Auto keeps Showdown's random
	 * pick; otherwise one track, or a shuffle, plays in every battle the server did not
	 * name music for - ladder and challenges. RP encounters keep their own themes.
	 * Saved in this browser. Showdown's own tracks play from Showdown's server, as they
	 * always have (they are not copied here); ours play from this one.
	 */
	var NATIVE_MUSIC = [
		['dpp-trainer', 'Diamond & Pearl: Trainer', 13440, 96959], ['dpp-rival', 'Diamond & Pearl: Rival', 13888, 66352],
		['hgss-johto-trainer', 'HeartGold & SoulSilver: Johto Trainer', 23731, 125086], ['hgss-kanto-trainer', 'HeartGold & SoulSilver: Kanto Trainer', 13003, 94656],
		['bw-trainer', 'Black & White: Trainer', 14629, 110109], ['bw-rival', 'Black & White: Rival', 19180, 57373],
		['bw-subway-trainer', 'Black & White: Subway Trainer', 15503, 110984], ['bw2-kanto-gym-leader', 'Black 2 & White 2: Kanto Gym Leader', 14626, 58986],
		['bw2-rival', 'Black 2 & White 2: Rival', 7152, 68708], ['bw2-homika-dogars', 'Black 2 & White 2: Homika (Dogars)', 1661, 68131],
		['xy-trainer', 'X & Y: Trainer', 7802, 82469], ['xy-rival', 'X & Y: Rival', 7802, 58634],
		['oras-trainer', 'Omega Ruby & Alpha Sapphire: Trainer', 13579, 91548], ['oras-rival', 'Omega Ruby & Alpha Sapphire: Rival', 14303, 69149],
		['sm-trainer', 'Sun & Moon: Trainer', 8323, 89230], ['sm-rival', 'Sun & Moon: Rival', 11389, 62158],
		['spl-elite4', 'Elite Four (SPL)', 3962, 152509], ['xd-miror-b', 'XD: Miror B.', 9000, 57815], ['colosseum-miror-b', 'Colosseum: Miror B.', 896, 47462],
	];
	var OUR_MUSIC_NAMES = {
		'events/wild-bw': 'Black & White: Wild Pokemon', 'events/rare-wild-bw': 'Black & White: Rare Wild Pokemon',
		'events/trainer-rse': 'Ruby & Sapphire: Trainer', 'events/gym-leader-dppt': 'Diamond & Pearl: Gym Leader',
		'events/elite-four-dppt': 'Diamond & Pearl: Elite Four', 'events/champion-cynthia': 'Champion Cynthia',
	};
	var MUSIC_PREF = 'velvetBattleMusic';
	function musicChoice() {
		try { return localStorage.getItem(MUSIC_PREF) || 'auto'; } catch (e) { return 'auto'; }
	}
	function ourMusicName(file) {
		if (OUR_MUSIC_NAMES[file]) return OUR_MUSIC_NAMES[file];
		return 'Legendary: ' + file.replace(/^legends\//, '').replace(/-/g, ' ').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
	}
	// Every track the picker offers: id -> how to load it.
	function musicLibrary() {
		var lib = {};
		for (var file in MUSIC_LOOP) lib['ours:' + file] = { name: ourMusicName(file), ours: file };
		for (var i = 0; i < NATIVE_MUSIC.length; i++) lib['ps:' + NATIVE_MUSIC[i][0]] = { name: NATIVE_MUSIC[i][1], native: NATIVE_MUSIC[i] };
		return lib;
	}
	function loadTrack(scene, id, track) {
		if (scene.bgmNum === 'picked-' + id) return true;
		scene.bgmNum = 'picked-' + id;
		if (track.ours) {
			var key = 'audio/' + track.ours + '.mp3';
			if (BattleSound.soundCache && !BattleSound.soundCache[key]) {
				var audio = document.createElement('audio');
				audio.src = location.origin + '/' + key;
				BattleSound.soundCache[key] = audio;
			}
			var loop = MUSIC_LOOP[track.ours];
			scene.bgm = BattleSound.loadBgm(key, loop[0], Math.max(loop[0] + 5000, loop[1]), scene.bgm);
		} else {
			scene.bgm = BattleSound.loadBgm('audio/' + track.native[0] + '.mp3', track.native[2], track.native[3], scene.bgm);
		}
		scene.updateBgm();
		return true;
	}
	// True when the player's pick is now playing; false leaves it to Showdown.
	function playChosenMusic(scene) {
		var choice = musicChoice();
		if (choice === 'auto' || scene.velvetMusic) return false;
		var lib = musicLibrary();
		if (choice === 'shuffle' || choice === 'shuffle-ours') {
			if (scene.velvetShuffled && lib[scene.velvetShuffled]) return loadTrack(scene, scene.velvetShuffled, lib[scene.velvetShuffled]);
			var ids = Object.keys(lib).filter(function (id) { return choice === 'shuffle' || id.indexOf('ours:') === 0; });
			scene.velvetShuffled = ids[Math.floor(Math.random() * ids.length)];
			return loadTrack(scene, scene.velvetShuffled, lib[scene.velvetShuffled]);
		}
		return lib[choice] ? loadTrack(scene, choice, lib[choice]) : false;
	}
	// A new pick takes effect in the battles already open.
	function applyMusicChoice() {
		try {
			var rooms = (window.app && app.rooms) || {};
			for (var id in rooms) {
				var scene = rooms[id] && rooms[id].battle && rooms[id].battle.scene;
				if (!scene || !scene.setBgm || scene.velvetMusic) continue;
				scene.velvetShuffled = null;
				scene.bgmNum = -1;
				if (scene.rollBgm) scene.rollBgm();
			}
		} catch (e) { /* the next battle picks it up */ }
	}
	function installMusicPlayer() {
		var P = window.SoundsPopup;
		if (!P || !P.prototype || !P.prototype.initialize || !window.jQuery) return false;
		if (P.__velvetMusic) return true;
		P.__velvetMusic = true;
		var initialize = P.prototype.initialize;
		P.prototype.initialize = function () {
			var out = initialize.apply(this, arguments);
			try {
				var lib = musicLibrary();
				var cur = musicChoice();
				var opt = function (id, name) { return '<option value="' + id + '"' + (id === cur ? ' selected' : '') + '>' + name + '</option>'; };
				var by = function (prefix) {
					return Object.keys(lib).filter(function (id) { return id.indexOf(prefix) === 0; })
						.sort(function (a, b) { return lib[a].name < lib[b].name ? -1 : 1; })
						.map(function (id) { return opt(id, lib[id].name); }).join('');
				};
				var buf = '<p class="velvet-music"><label class="optlabel">Battle music:</label>' +
					'<select name="velvetmusic" class="button" style="max-width:230px">' +
					opt('auto', 'Auto (Showdown picks)') + opt('shuffle', 'Shuffle everything') + opt('shuffle-ours', 'Shuffle Velvet tracks') +
					'<optgroup label="Velvet Bunny">' + by('ours:') + '</optgroup>' +
					'<optgroup label="Showdown">' + by('ps:') + '</optgroup>' +
					'</select><br /><small style="color:#888">Ladder and challenge battles. RP encounters keep their own themes.</small></p>';
				var $section = jQuery(buf);
				var $mute = this.$el.find('input[name=muted]').closest('p');
				if ($mute.length) $section.insertBefore($mute); else this.$el.append($section);
				$section.find('select').on('change', function () {
					try { localStorage.setItem(MUSIC_PREF, this.value); } catch (e) { /* this session only */ }
					applyMusicChoice();
				});
			} catch (e) { /* the volume sliders still work */ }
			return out;
		};
		return true;
	}

	/*
	 * A search you can always cancel (owner, 1 Oct 2026: "relogin doesnt offer the cancel").
	 * Showdown adds the Cancel button only when you click Battle!. A search the server tells
	 * the page about - one still running when you log back in, or from another tab - showed
	 * "Searching..." with no way out but typing /cancelsearch. Whenever the menu shows a
	 * running search now, the button is there.
	 */
	function installSearchCancel() {
		var M = window.MainMenuRoom;
		if (!M || !M.prototype || !M.prototype.updateSearch || !window.jQuery) return false;
		if (M.__velvetCancel) return true;
		M.__velvetCancel = true;
		var updateSearch = M.prototype.updateSearch;
		M.prototype.updateSearch = function () {
			var out = updateSearch.apply(this, arguments);
			try {
				var searching = this.searching && (!jQuery.isArray(this.searching) || this.searching.length);
				var $form = jQuery('.mainmenu button.big').closest('form');
				if (searching && $form.length && !$form.find('p.cancel').length) {
					$form.append('<p class="cancel buttonbar"><button name="cancelSearch" class="button">Cancel</button></p>');
				}
			} catch (e) { /* the menu as Showdown draws it */ }
			return out;
		};
		// A search announced before this was installed: draw it again.
		try { if (window.app && app.rooms && app.rooms[''] && app.rooms[''].updateSearch) app.rooms[''].updateSearch(); } catch (e) {}
		return true;
	}

	// Toxic's rule for Will-O-Wisp, Thunder Wave and Chilling Mist, in the accuracy tooltip.
	var SURE_HIT = { willowisp: 'Fire', thunderwave: 'Electric', chillingmist: 'Ice' };
	function installSureHit() {
		var tips = window.BattleTooltips;
		if (!tips || !tips.prototype || !tips.prototype.getMoveAccuracy) return false;
		if (tips.__velvetSureHit) return true;
		tips.__velvetSureHit = true;
		var original = tips.prototype.getMoveAccuracy;
		tips.prototype.getMoveAccuracy = function (move, value) {
			var out = original.apply(this, arguments);
			try {
				var type = RP.on && move && SURE_HIT[move.id];
				if (type && this.pokemonHasType(value.pokemon, type)) out.set(0, type + ' type');
			} catch (e) {}
			return out;
		};
		return true;
	}

	// The multipliers the server applies (data/velvet/balance-patch-1.js, halloween.js), as shown.
	var ABILITY_POWER = {
		crownofflame: { name: 'Crown of Flame', types: { Fire: 1.3, Fighting: 1.3 }, flags: { punch: 1.2 } },
		kindlingcrown: { name: 'Kindling Crown', types: { Fire: 1.2, Fighting: 1.2 }, flags: { punch: 1.1 } },
		worldturtle: { name: 'World Turtle', types: { Grass: 1.3, Ground: 1.3 } },
		saplingshell: { name: 'Sapling Shell', types: { Grass: 1.2, Ground: 1.2 } },
		emperorspride: { name: "Emperor's Pride", types: { Water: 1.3, Steel: 1.3 } },
		proudchick: { name: 'Proud Chick', types: { Water: 1.2, Steel: 1.2 } },
		bulldoggrip: { name: 'Bulldog Grip', flags: { bite: 1.5 } },
		witchinghour: { name: 'Witching Hour', types: { Ghost: 1.5 } },
	};
	// How a move type does against a target's types: 2, 4 (super effective), 1, 0.5, 0...
	function superEffectiveness(moveType, target, move) {
		var types = target.getTypeList ? target.getTypeList() : (target.getTypes ? target.getTypes()[0] : []);
		var total = 1;
		for (var i = 0; i < (types || []).length; i++) {
			if (move && move.id === 'freezedry' && types[i] === 'Water') { total *= 2; continue; }
			var taken = window.Dex && Dex.types && Dex.types.get(types[i]).damageTaken;
			var code = taken ? taken[moveType] : 0;
			if (code === 1) total *= 2;
			else if (code === 2) total *= 0.5;
			else if (code === 3) total = 0;
		}
		return total;
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
			if (!RP.on) return out;
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
				/*
				 * Our abilities that raise a move's power by its type or kind (data/velvet,
				 * onBasePower). The battle always applied them; the tooltip showed nothing, so
				 * Infernape's Ice Punch read 75 with Crown of Flame (owner, 1 Oct 2026). Type
				 * and kind stack, as on the server. Crown of Flame's 1.2x on super effective
				 * hits is damage, not power, so it is not part of this number.
				 */
				var boost = ABILITY_POWER[ability];
				if (boost && move && out && out.modify) {
					if (boost.types && boost.types[moveType]) out.modify(boost.types[moveType], boost.name);
					var flags = move.flags || {};
					for (var flag in (boost.flags || {})) {
						if (flags[flag]) out.modify(boost.flags[flag], boost.name + (boost.types ? ' (' + flag + ')' : ''));
					}
				}
				/*
				 * Super effective against the Pokemon in front of you: Expert Belt's 1.2x, and
				 * Crown of Flame's own (its built-in belt), shown in the power (owner, 1 Oct 2026).
				 * They are damage boosts on the server, which comes to the same number. Only
				 * with a target to measure against, and never for a status move.
				 */
				if (target && move && move.category !== 'Status' && out && out.modify && out.value) {
					var eff = superEffectiveness(moveType, target, move);
					if (eff > 1) {
						var held = window.toID((serverPokemon && serverPokemon.item) || (pokemon && pokemon.item) || '');
						if (held === 'expertbelt') out.modify(1.2, 'Expert Belt');
						if (ability === 'crownofflame') out.modify(1.2, 'Crown of Flame (super effective)');
					}
				}
				// Solar Nectar: 135 power in harsh sunlight (Balance Patch 1).
				var moveId = move && (move.id || window.toID(move.name || ''));
				var weather = this.battle && window.toID(this.battle.weather || '');
				if (moveId === 'solarnectar' && (weather === 'sunnyday' || weather === 'desolateland') && out && out.modify) {
					out.modify(135 / 80, 'Sunlight');
				}
				// Makuro's, Raishin's and Chimai's terrains: 1.3x for their two types, grounded or not.
				var has = this.battle && this.battle.hasPseudoWeather ? this.battle.hasPseudoWeather.bind(this.battle) : null;
				if (has && out && out.modify) {
					if (has('Abyssal Terrain') && (moveType === 'Water' || moveType === 'Dark')) out.modify(5325 / 4096, 'Abyssal Terrain');
					if (has('Shrine Terrain') && (moveType === 'Electric' || moveType === 'Ghost')) out.modify(5325 / 4096, 'Shrine Terrain');
					if (has('Sanctuary Terrain') && (moveType === 'Ground' || moveType === 'Fairy')) out.modify(5325 / 4096, 'Sanctuary Terrain');
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
			if (!results || !buffs || !buffs.items || !RP.on) return results;

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
			// The Ultra Shard is the Ultra Beasts' Booster Energy, and is shown the way Showdown
			// shows Booster Energy to a Paradox Pokemon: under its ability, at the top.
			var abilityItems = [];
			var abilities = species && species.abilities ? Object.keys(species.abilities).map(function (k) { return species.abilities[k]; }) : [];
			if (abilities.indexOf('Beast Boost') >= 0 && buffs.items.ultrashard) abilityItems.push('ultrashard');
			if (!mine.length && !stones.length && !abilityItems.length) return results;

			var taken = mine.concat(stones, abilityItems);
			var rest = [];
			for (var i = 0; i < results.length; i++) {
				var row = results[i];
				if (row[0] === 'item' && taken.indexOf(row[1]) >= 0) continue;
				rest.push(row);
			}

			var hoisted = [];
			if (mine.length) {
				// Showdown's own wording for an item that belongs to one Pokemon (Light Ball, Rusted Sword).
				hoisted.push(['header', 'Specific to ' + ((species && species.name) || speciesName)]);
				for (var k = 0; k < mine.length; k++) hoisted.push(['item', mine[k]]);
			}
			if (stones.length) {
				hoisted.push(['header', stones.length === 1 ? 'Mega Stone' : 'Mega Stones']);
				for (var st = 0; st < stones.length; st++) hoisted.push(['item', stones[st]]);
			}
			if (abilityItems.length) {
				hoisted.push(['header', 'Specific to Beast Boost']);
				for (var ai = 0; ai < abilityItems.length; ai++) hoisted.push(['item', abilityItems[ai]]);
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
		// 24 Sep 2026: the ten added since this table was written, which all
		// played Tackle. Each borrows the move it is described as a version of.
		twilightexit: ['trickroom', 'partingshot'],            // Trick Room, then out
		greatsagestrike: ['aurasphere', 'focusblast'],         // special Fighting
		pyrestrike: ['flareblitz', 'fireblast'],               // Flare Blitz sans recoil
		eldertimber: ['woodhammer', 'leafblade'],              // Wood Hammer sans recoil
		tectonicshell: ['shoreup', 'recover'],                 // Ground heal (+ rocks)
		imperialtorrent: ['hydropump', 'surf'],                // the Hydro Pump that lands
		royaldecree: ['roar', 'whirlwind'],                    // Roar (+ Spikes)
		thornedbouquet: ['petalblizzard', 'gigadrain'],        // flowers, drained
		soultoll: ['hex', 'shadowclaw'],                       // Hex's rule, physical
		bulldogmaul: ['crunch', 'playrough'],               // a Fairy bite
		uilasurge: ['risingvoltage', 'thunderbolt'],        // Koko's Rising Voltage
		manapierce: ['psyshock', 'psychic'],             // Lele's, at the weaker defence
		nahelerush: ['grassyglide', 'woodhammer'],       // Bulu's Grassy Glide
		ohuwave: ['moonblast', 'dazzlinggleam'],        // Fini's misty Fairy wave
		witchssnatch: ['spectralthief', 'knockoff', 'shadowclaw'], // a Ghost that takes
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
	/*
	 * 24 Sep 2026: capped. On a page that never loads the battle scripts (the
	 * teambuilder alone, the calculator) this polled four times a second for as
	 * long as the tab was open. Ten minutes is far longer than the scripts take
	 * to arrive when they arrive at all; after that it checks on a click
	 * instead - opening a battle takes one, and a battle is the only time an
	 * animation is needed. The install is cheap and returns early once done.
	 */
	var animTries = 0;
	var animTimer = setInterval(function () {
		if (installMoveAnims() || ++animTries > 2400) clearInterval(animTimer);
	}, 250);
	document.addEventListener('click', function () {
		if (animTries > 2400) installMoveAnims();
	}, true);
	installMoveAnims();

	// The event music hooks the battle engine, which only arrives when a battle or a
	// replay opens: the same patient install as the animations.
	// The avatar picker lives in the panels script, which loads with the client.
	var avatarTries = 0;
	var avatarTimer = setInterval(function () {
		var playerIn = installMusicPlayer() && installSearchCancel();
		if ((installAvatarList() && playerIn) || ++avatarTries > 600) clearInterval(avatarTimer);
	}, 250);

	var musicTries = 0;
	var musicTimer = setInterval(function () {
		if (installEventMusic() || ++musicTries > 2400) clearInterval(musicTimer);
	}, 250);
	document.addEventListener('click', function () {
		if (musicTries > 2400) installEventMusic();
	}, true);

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
