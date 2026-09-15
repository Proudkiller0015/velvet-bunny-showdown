/**
 * This server's Pokemon, moves, abilities and items, inside Showdown's own
 * damage calculator.
 *
 * The calculator is theirs and stays theirs - the mechanics in calc/*.js are
 * four thousand lines of careful work and none of it is reimplemented here.
 * Two things are added.
 *
 * **The data.** `calc.SPECIES[9]`, `MOVES[9]`, `ABILITIES[9]` and `ITEMS[9]`
 * are what every dropdown is built from and what every calculation reads, so
 * ours go straight into them. That alone makes Samantha a species with stats
 * rather than an unknown name, which is most of the distance.
 *
 * **The effects.** An ability or an item is only a *name* to the calculator:
 * what it does lives in its damage formula, keyed by the names it already
 * knows. Queen Wrath doubling both attacking stats means nothing to it. So
 * `calc.calculate` is wrapped, and ours are applied to the two Pokemon on the
 * way in.
 *
 * The way they are applied is the part worth explaining. The obvious approach -
 * work out the number the calculator would give and multiply it afterwards - is
 * wrong by a point or two, because the simulator truncates at every single
 * modifier rather than at the end. So instead the attacking and defending stats
 * are computed here exactly as the server computes them (boosts, then ability,
 * then item, each through the same 4096ths arithmetic), the result is handed to
 * the calculator as a flat stat with the boost already spent, and the
 * calculator does the rest untouched. The numbers match the server because the
 * arithmetic is the server's.
 *
 * scripts/check-calc.js is the proof: it runs the same fights through the real
 * simulator and through this file and refuses to agree they are done until
 * every roll is identical.
 */
(function () {
	'use strict';

	var DATA = window.__VELVET_CALC_DATA;
	if (!DATA) return;

	// Gen 9 is the last table in each of the calculator's per-generation arrays,
	// and the only one anything of ours exists in.
	var GEN = 9;

	/* ------------------------------------------------------------------ data */

	function toID(text) {
		return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	/**
	 * The dropdowns and the lookups are two different things, and both need us.
	 *
	 * `calc.SPECIES[9]` is the table the page builds its menus from. It is *not*
	 * what a calculation reads: every data file ends by walking its table once,
	 * at load, into a private by-id map, and `gen.species.get(id)` reads that.
	 * Adding to the table afterwards therefore fills the menus and changes
	 * nothing else - Samantha was selectable and then "cannot read properties of
	 * undefined", because the lookup had never heard of her.
	 *
	 * The maps are private, but the classes that read them are exported, so the
	 * second half of this is four one-line overrides on the prototypes: ours if
	 * it is ours, theirs otherwise.
	 */
	function inject() {
		if (!window.calc || !window.calc.SPECIES || window.calc.__velvet) return false;
		window.calc.__velvet = true;

		var species = window.calc.SPECIES[GEN];
		for (var name in DATA.species) if (!species[name]) species[name] = DATA.species[name];

		var moves = window.calc.MOVES[GEN];
		for (var move in DATA.moves) if (!moves[move]) moves[move] = DATA.moves[move];

		// These two are lists of names rather than tables of data: the calculator
		// only ever asks whether it has heard of them.
		add(window.calc.ABILITIES[GEN], DATA.abilities);
		add(window.calc.ITEMS[GEN], DATA.items);

		teachLookups();
		return true;
	}

	function add(list, names) {
		if (!list || !names) return;
		for (var i = 0; i < names.length; i++) {
			if (list.indexOf(names[i]) < 0) list.push(names[i]);
		}
		list.sort();
	}

	/** One of ours, in the shape their by-id map holds. */
	function asSpecies(name, data) {
		var out = {
			kind: 'Species',
			id: toID(name),
			name: name,
			baseStats: {
				hp: data.bs.hp, atk: data.bs.at, def: data.bs.df,
				spa: data.bs.sa, spd: data.bs.sd, spe: data.bs.sp,
			},
		};
		for (var key in data) if (key !== 'bs') out[key] = data[key];
		return out;
	}

	/** And a move, which is the same idea with a different set of flags. */
	function asMove(name, data) {
		var FLAGS = {
			makesContact: 'contact', isPunch: 'punch', isBite: 'bite', isBullet: 'bullet',
			isSound: 'sound', isPulse: 'pulse', isSlicing: 'slicing', isWind: 'wind',
		};
		var out = { kind: 'Move', id: toID(name), name: name, flags: {} };
		for (var key in data) {
			if (FLAGS[key]) { if (data[key]) out.flags[FLAGS[key]] = 1; continue; }
			if (key === 'bp' || key === 'zp' || key === 'maxPower') continue;
			out[key] = data[key];
		}
		out.basePower = data.bp;
		if (data.zp) out.zMove = { basePower: data.zp };
		if (data.maxPower) out.maxMove = { basePower: data.maxPower };
		if (!out.category) out.category = 'Status';
		return out;
	}

	function teachLookups() {
		var species = {}, moves = {}, abilities = {}, items = {};
		var name;
		for (name in DATA.species) species[toID(name)] = asSpecies(name, DATA.species[name]);
		for (name in DATA.moves) moves[toID(name)] = asMove(name, DATA.moves[name]);
		for (var i = 0; i < DATA.abilities.length; i++) {
			abilities[toID(DATA.abilities[i])] = { kind: 'Ability', id: toID(DATA.abilities[i]), name: DATA.abilities[i] };
		}
		for (var j = 0; j < DATA.items.length; j++) {
			items[toID(DATA.items[j])] = { kind: 'Item', id: toID(DATA.items[j]), name: DATA.items[j] };
		}

		teach(window.calc.Species, species);
		teach(window.calc.Moves, moves);
		teach(window.calc.Abilities, abilities);
		teach(window.calc.Items, items);
	}

	/**
	 * Make our changes survive the clone that `calculate` opens with.
	 *
	 * `calc.calculate` is one line: it hands the mechanics `attacker.clone()`.
	 * And `clone` rebuilds the Pokemon from its constructor options - level,
	 * nature, EVs, boosts - which recomputes every stat from the species. So a
	 * stat written by the wrapper is thrown away between the wrapper and the
	 * arithmetic, and the calculator goes on reporting flawless undoubled
	 * numbers with every one of our modifiers applied to an object nobody ever
	 * looks at again.
	 *
	 * The patch goes on the prototype of *the object in hand*, not on
	 * `calc.Pokemon.prototype`, and that distinction cost an hour. Their page
	 * loads calc/index.js and calc/adaptable.js, which re-export everything onto
	 * the shared object; `calc.Pokemon` there is not the class the instances
	 * actually belong to, so patching it left the real `clone` untouched. On a
	 * bare harness the two are the same object and everything passed.
	 *
	 * Moves need none of this: their clone already carries `isCrit` and
	 * `overrides` through, which is where ours are written.
	 */
	function carryThrough(pokemon) {
		var proto = Object.getPrototypeOf(pokemon);
		if (!proto || !proto.clone || proto.__velvetClone) return;
		proto.__velvetClone = true;
		var original = proto.clone;
		proto.clone = function () {
			var copy = original.call(this);
			if (this.__velvetStats && copy && copy.rawStats) {
				copy.__velvetStats = this.__velvetStats;
				for (var stat in this.__velvetStats) {
					copy.rawStats[stat] = this.__velvetStats[stat];
					copy.stats[stat] = this.__velvetStats[stat];
				}
			}
			return copy;
		};
	}

	/** Answer for ours, and for everything else let them answer. */
	function teach(klass, ours) {
		if (!klass || !klass.prototype || klass.prototype.__velvet) return;
		klass.prototype.__velvet = true;
		var original = klass.prototype.get;
		klass.prototype.get = function (id) {
			// Only in the generation ours exist in; every earlier one is untouched.
			if (this.gen === GEN && ours[id]) return ours[id];
			return original.call(this, id);
		};
	}

	/* ------------------------------------------- the server's own arithmetic */

	/**
	 * Showdown's `chainModify`, to the digit.
	 *
	 * Every multiplier in the game is a fraction of 4096 applied with this exact
	 * rounding - `tr(tr(value * modifier + 2048 - 1) / 4096)` - and the halves
	 * and thirds people quote are shorthand for it. 1.3x is 5324/4096, 1.5x is
	 * 6144/4096, and doing it in floating point instead lands a point out often
	 * enough to change whether something is a knockout.
	 */
	function modify(value, numerator, denominator) {
		var modifier = Math.floor(numerator * 4096 / (denominator || 1));
		return Math.floor((Math.floor(value * modifier) + 2048 - 1) / 4096);
	}

	/** A boosted stat, the way the simulator boosts one. */
	var BOOST = [2 / 8, 2 / 7, 2 / 6, 2 / 5, 2 / 4, 2 / 3, 1, 3 / 2, 4 / 2, 5 / 2, 6 / 2, 7 / 2, 8 / 2];
	function boosted(stat, stage) {
		var s = Math.max(-6, Math.min(6, stage || 0));
		return Math.floor(stat * BOOST[s + 6]);
	}

	/* ----------------------------------------------------------- our effects */

	var SIMI = {
		Pansage: 1, Simisage: 1, Pansear: 1, Simisear: 1, Panpour: 1, Simipour: 1,
	};

	/**
	 * What each of ours multiplies, as fractions of 4096.
	 *
	 * `atk` and `spa` are the attacking stats; `def` and `spd` the defending
	 * ones. Everything here is a stat modifier and nothing here touches base
	 * power, which is deliberate - base power effects are listed separately
	 * below, because the calculator has a place of its own for those.
	 */
	function statModifiers(pokemon, isAttacker) {
		var out = [];
		var ability = String(pokemon.ability || '');
		var item = String(pokemon.item || '');
		var species = String((pokemon.species && pokemon.species.name) || pokemon.name || '');

		// Queen Wrath and Queen's Morph: Huge Power on both halves at once.
		if (ability === 'Queen Wrath' || ability === "Queen's Morph") {
			out.push(['atk', 2, 1], ['spa', 2, 1]);
		}

		// Colossus Unbound (Regigigas, Balance Patch 1): 1.2x Attack while above
		// half HP. Its Mold Breaker half the calculator cannot be told about by
		// name, so a defender's ability is still applied here.
		if (ability === 'Colossus Unbound') {
			var cur = Number(pokemon.originalCurHP);
			var max = typeof pokemon.maxHP === 'function' ? pokemon.maxHP() : 0;
			if (!max || !(cur >= 0) || cur > max / 2) out.push(['atk', 4915, 4096]);
		}

		// The Elemental Banana, for the six it belongs to. 1.3x, or 1.5x once
		// that Pokemon has Terastallized or Dynamaxed - which the calculator
		// knows about, so it can be asked.
		if (item === 'Elemental Banana' && SIMI[species.split('-')[0]]) {
			var unleashed = !!(pokemon.teraType && pokemon.isTera !== false && pokemon.teraType !== '') ||
				!!pokemon.isDynamaxed;
			var n = unleashed ? 6144 : 5324;
			out.push(['atk', n, 4096], ['spa', n, 4096], ['spe', n, 4096]);
		}

		return out.filter(function (m) {
			return isAttacker ? (m[0] === 'atk' || m[0] === 'spa' || m[0] === 'spe') : true;
		});
	}

	/**
	 * Base power, where one of ours changes it.
	 *
	 * Verdant Surge is the only one: a Grass move from its holder is multiplied
	 * the way Grassy Terrain multiplies one, and the terrain it sets is already
	 * something the calculator understands, so only the ability's own boost has
	 * to be added here.
	 */
	function basePowerModifiers(attacker, move) {
		var out = [];
		if (String(attacker.ability || '') === 'Verdant Surge' && move.type === 'Grass') {
			out.push([4726, 4096]);
		}
		return out;
	}

	/* -------------------------------------------------------- the moves of ours
	 *
	 * Three of ours do something the calculator has no name for. Each is handled
	 * by describing it in terms the calculator does have, rather than by doing
	 * the sums here.
	 */

	/**
	 * Anything the move's own clone would forget, said the way it remembers.
	 *
	 * A Move rebuilds itself from `overrides` merged over the dex entry, so that
	 * is where a changed base power or type has to be written - `move.bp = x`
	 * alone is undone by the clone inside `calculate`.
	 */
	function override(move, changes) {
		move.overrides = move.overrides || {};
		for (var key in changes) move.overrides[key] = changes[key];
	}

	/** Queen's Blitz: always a critical hit, always STAB, neutral on everything. */
	function queensBlitz(attacker, defender, move, gen) {
		move.isCrit = true;

		// STAB regardless of the user. Telling the calculator the move is one of
		// the attacker's own types is how to say that in its vocabulary, and it
		// only matters that the type is shared - the effectiveness is forced to
		// neutral below anyway.
		if (attacker.types && attacker.types.length && attacker.types.indexOf(move.type) < 0) {
			move.type = attacker.types[0];
			override(move, { type: move.type });
		}

		// Neutral on every type. The calculator reads effectiveness off the chart
		// rather than from the move, so the move is given a type the defender is
		// exactly neutral to. Normal is that type against nearly everybody; the
		// chart is searched for one when it is not.
		var chart = window.calc.TYPE_CHART[gen];
		var types = defender.types || [];
		var candidates = Object.keys(chart);
		for (var i = 0; i < candidates.length; i++) {
			var type = candidates[i];
			var total = 1;
			for (var t = 0; t < types.length; t++) {
				var e = chart[type] && chart[type][types[t]];
				total *= (e === undefined ? 1 : e);
			}
			if (total === 1 && attacker.types.indexOf(type) >= 0) {
				move.type = type;
				override(move, { type: type });
				return;
			}
			if (total === 1 && !candidates.neutral) candidates.neutral = type;
		}
		if (candidates.neutral) {
			move.type = candidates.neutral;
			override(move, { type: candidates.neutral });
			giveType(attacker, candidates.neutral);
		}
	}

	/**
	 * STAB, when the neutral type is not one the attacker has.
	 *
	 * Queen's Blitz is both always-neutral and always-STAB, and against some
	 * defenders those two pull apart: no type Samantha has is neutral on a pure
	 * Dark type, so the move is given one she does not have and the same-type
	 * bonus quietly goes missing - a clean 1.5x short of the server.
	 *
	 * Giving her the type is the honest fix, since it is what the move does. It
	 * goes onto the species rather than onto `types` alone because the species
	 * is what the Pokemon's clone carries over, and `types` is rebuilt from it.
	 */
	function giveType(pokemon, type) {
		if (!pokemon.types || pokemon.types.indexOf(type) >= 0) return;
		var types = pokemon.types.slice();
		types.push(type);
		pokemon.types = types;
		var species = {};
		for (var key in pokemon.species) species[key] = pokemon.species[key];
		species.types = types;
		pokemon.species = species;
	}

	/** Merchant's Call: the user's remaining HP, dealt as damage. */
	function fixedDamage(attacker) {
		return attacker.curHP ? attacker.curHP() : attacker.originalCurHP;
	}

	/**
	 * The three surges put something on the field the moment they arrive.
	 *
	 * Verdant Surge is Grassy Terrain, Solar Surge is sun, Tidal Surge is rain -
	 * that is the whole reason those abilities exist rather than the real ones,
	 * which are banned by name in half the tiers this server runs. In a battle
	 * the field is simply set; in a calculator the field is a pair of dropdowns
	 * the user has to remember to change, and forgetting is worth about a third
	 * of the damage.
	 *
	 * So it is set for them, and only when they have not set it themselves.
	 */
	var SURGES = {
		'Verdant Surge': { terrain: 'Grassy' },
		'Solar Surge': { weather: 'Sun' },
		'Tidal Surge': { weather: 'Rain' },
	};

	function setTheField(attacker, defender, field) {
		var sides = [attacker, defender];
		for (var i = 0; i < sides.length; i++) {
			var surge = SURGES[String(sides[i].ability || '')];
			if (!surge) continue;
			if (surge.terrain && !field.terrain) field.terrain = surge.terrain;
			if (surge.weather && !field.weather) field.weather = surge.weather;
		}
	}

	/* ------------------------------------------------------------ the wrapper */

	function wrap() {
		if (!window.calc || !window.calc.calculate || window.calc.__velvetCalc) return false;
		window.calc.__velvetCalc = true;

		var original = window.calc.calculate;
		var wrapped = function (gen, attacker, defender, move, field) {
			var genNum = (gen && gen.num) || gen || GEN;
			var them = defender.clone ? defender.clone() : defender;
			var us = attacker.clone ? attacker.clone() : attacker;
			var theMove = move.clone ? move.clone() : move;

			/*
			 * Stats first, and spent rather than merely multiplied.
			 *
			 * The simulator boosts a stat and then applies abilities and items to
			 * the boosted number. Handing the calculator a multiplied stat *and*
			 * the boost would apply the boost twice; handing it the final number
			 * with the boost zeroed gives it exactly what the server would have
			 * computed, and leaves everything after that - the formula, the
			 * weather, the screens, the crit - to it.
			 */
			spend(us, statModifiers(us, true), true);
			spend(them, statModifiers(them, false), false);
			if (field) setTheField(us, them, field);

			var power = basePowerModifiers(us, theMove);
			for (var i = 0; i < power.length; i++) {
				theMove.bp = modify(theMove.bp, power[i][0], power[i][1]);
			}
			if (power.length) override(theMove, { basePower: theMove.bp });

			if (theMove.name === "Queen's Blitz") queensBlitz(us, them, theMove, genNum);

			/*
			 * The lake trio's abilities let Psychic moves hit Dark types. The
			 * calculator knows the chart, not our abilities, so Dark is taken off
			 * the (cloned) defender for a Psychic move - Dark only ever matters to
			 * a Psychic move as the immunity. Unbending Will is Tinted Lens too,
			 * which the calculator does know by name.
			 */
			var lake = { 'Mind Keeper': 1, 'Heartfelt Resolve': 1, 'Unbending Will': 1 };
			if (lake[String(us.ability || '')] && theMove.type === 'Psychic' && them.types && them.types.indexOf('Dark') >= 0) {
				var rest = them.types.filter(function (t) { return t !== 'Dark'; });
				them.types = rest.length ? rest : ['Normal'];
			}
			if (String(us.ability || '') === 'Unbending Will') us.ability = 'Tinted Lens';

			var result = original.call(this, gen, us, them, theMove, field);

			// A move that deals a flat number ignores the formula entirely, so the
			// result is corrected rather than computed.
			if (theMove.name === "Merchant's Call") {
				var flat = fixedDamage(us);
				result.damage = flat;
				result.rawDesc = result.rawDesc || {};
			}
			return result;
		};

		/*
		 * Defined rather than assigned, which is not a stylistic choice.
		 *
		 * Their page loads calc/index.js and calc/adaptable.js, both of which
		 * re-export everything onto the shared `exports` object as *getters*.
		 * `calc.calculate = ours` against a get-only property does nothing at all
		 * in loose mode and throws in strict mode - so the wrapper installed
		 * perfectly on a bare harness and silently did not exist on the real
		 * page, which reported flawless undoubled numbers.
		 */
		try {
			Object.defineProperty(window.calc, 'calculate', {
				value: wrapped, writable: true, configurable: true, enumerable: true,
			});
		} catch (e) {
			window.calc.calculate = wrapped;
		}
		return window.calc.calculate === wrapped;
	}

	/**
	 * Fold a list of modifiers into the Pokemon's stats and clear what they
	 * consumed, so nothing is counted twice.
	 */
	function spend(pokemon, modifiers, isAttacker) {
		if (!modifiers.length || !pokemon.stats) return;
		carryThrough(pokemon);
		var byStat = {};
		for (var i = 0; i < modifiers.length; i++) {
			(byStat[modifiers[i][0]] = byStat[modifiers[i][0]] || []).push(modifiers[i]);
		}
		for (var stat in byStat) {
			var value = boosted(pokemon.rawStats[stat], pokemon.boosts[stat]);
			for (var m = 0; m < byStat[stat].length; m++) {
				value = modify(value, byStat[stat][m][1], byStat[stat][m][2]);
			}
			/*
			 * Into `rawStats`, not just `stats`.
			 *
			 * The calculation recomputes `stats` from `rawStats` and the boosts
			 * before it does anything else, so a number written into `stats` here
			 * is overwritten a moment later and the modifier silently does
			 * nothing. Writing the finished number into both and clearing the
			 * boost makes that recomputation an identity.
			 */
			pokemon.rawStats[stat] = value;
			pokemon.stats[stat] = value;
			pokemon.boosts[stat] = 0;   // spent, in the line above
			// And recorded, so `calculate`'s own clone does not undo it.
			(pokemon.__velvetStats = pokemon.__velvetStats || {})[stat] = value;
		}
	}

	/* ---------------------------------------------------------------- startup
	 *
	 * Their scripts are loaded before this one, so `calc` is already there - but
	 * the page is also reachable before its own data has finished arriving, and
	 * a missed injection is an empty dropdown rather than an error. So it is
	 * tried until it takes, the same way the client's own additions are.
	 */
	var tries = 0;
	function attempt() {
		var done = inject() && wrap();
		if (window.calc && window.calc.__velvet && window.calc.__velvetCalc) done = true;
		if (done || ++tries > 100) clearInterval(timer);
	}
	var timer = setInterval(attempt, 50);
	attempt();
})();
