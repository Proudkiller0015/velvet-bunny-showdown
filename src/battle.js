'use strict';
/**
 * Minimal battle-state tracker.
 *
 * The |request| payload tells us everything about our own side, but nothing
 * about the opponent beyond what the log has revealed. This keeps just enough
 * of the public log to make a sensible decision: who is out, how hurt they are,
 * their boosts and status, the field, and which moves they have shown.
 */

const IDENT = /^(p[12])([a-c]?): (.*)$/;

function parseIdent(raw) {
	const m = IDENT.exec(raw || '');
	if (!m) return null;
	return { side: m[1], slot: m[2] || 'a', name: m[3] };
}

function parseCondition(cond) {
	// "48/100", "0 fnt", "150/281 brn"
	if (!cond) return null;
	if (/fnt/.test(cond)) return { hp: 0, maxhp: 1, fainted: true, status: '' };
	const m = /^(\d+)\/(\d+)(?: (\w+))?/.exec(cond);
	if (!m) return null;
	return { hp: +m[1], maxhp: +m[2], fainted: false, status: m[3] || '' };
}

class BattleState {
	constructor(roomId) {
		this.room = roomId;
		this.myPlayer = null;      // 'p1' | 'p2'
		this.gen = 9;
		this.gameType = 'singles';
		this.turn = 0;
		// The turn each side last sent something out; see the switch handler.
		this.mineCameIn = 0;
		this.foeCameIn = 0;
		this.weather = '';
		this.terrain = '';
		this.pseudo = {};          // Trick Room / Gravity / Magic Room / Wonder Room
		this.opponent = {};        // slot -> {species, details, level, hp, maxhp, status, boosts, moves:Set, item, ability, tera}
		this.mine = {};            // slot -> {species, hp, maxhp, status, boosts, tera}
		this.hazards = { p1: {}, p2: {} };
		// The moves of the turn being played and of the one before, in order: who
		// moved first is how a Choice Scarf gives itself away.
		this.turnMoves = [];
		this.lastTurnMoves = [];
		// The turn each side last used Future Sight or Doom Desire; a second one fails until it lands.
		this.futureSight = { p1: -9, p2: -9 };
		this.rated = false;
		this.ended = false;
	}

	get theirPlayer() { return this.myPlayer === 'p1' ? 'p2' : 'p1'; }

	slotOf(ident) {
		const id = parseIdent(ident);
		if (!id) return null;
		return id;
	}

	blank(name, details) {
		const level = (/, L(\d+)/.exec(details || '') || [])[1];
		return {
			species: (details || name || '').split(',')[0].trim(),
			level: level ? +level : 100,
			hp: 100, maxhp: 100, status: '', fainted: false,
			boosts: {}, moves: new Set(), item: null, ability: null, tera: null, transformed: null,
			// What the battle itself has told us about its ability. A move that
			// lands rules out every ability that would have made it immune; one
			// that is shrugged off points straight at the ability that did it.
			immuneTo: new Set(), notImmuneTo: new Set(), keptItem: false,
		};
	}

	/** Feed one protocol line (already split on '|', without the leading empty). */
	line(parts) {
		const [cmd, ...args] = parts;
		/*
		 * Any line that says an ability did something names it: "|-weather|Snowscape|
		 * [from] ability: Diamond Dust|[of] p2a: Glaceon". Only the ability's own
		 * -ability line was read, so a Glaceon that announced Diamond Dust by setting
		 * snow stayed an unknown ability - and the bot went on thinking it outran a
		 * Pokemon whose Speed that weather doubles.
		 */
		const from = parts.find(p => /^\[from\] ability: /.test(p));
		const of = parts.find(p => /^\[of\] p[12][a-c]?: /.test(p));
		if (from) {
			const ability = from.slice('[from] ability: '.length).trim();
			const owner = of ? this.slotOf(of.slice('[of] '.length)) : this.slotOf(args[0]);
			if (owner && ability) {
				const store = owner.side === this.myPlayer ? this.mine : this.opponent;
				if (store[owner.slot]) store[owner.slot].ability = ability;
			}
		}
		switch (cmd) {
		case 'player': {
			// |player|p1|Username|avatar|rating
			if (this.myName && args[1] && args[1] === this.myName) this.myPlayer = args[0];
			break;
		}
		case 'gametype': this.gameType = args[0]; break;
		case 'gen': this.gen = +args[0] || 9; break;
		// Team preview: |poke|p1|Garchomp, M|item
		case 'poke': {
			this.preview = this.preview || { p1: [], p2: [] };
			const species = String(args[1] || '').split(',')[0].trim();
			const level = (/, L(\d+)/.exec(args[1] || '') || [])[1];
			if (this.preview[args[0]] && species) this.preview[args[0]].push({ species, level: level ? +level : 100 });
			break;
		}
		case 'rated': this.rated = true; break;
		case 'turn':
			this.turn = +args[0] || 0;
			this.lastTurnMoves = this.turnMoves;
			this.turnMoves = [];
			// Speed stages and paralysis as the turn began: what decided who moved first.
			this.lastTurnStart = this.turnStart || null;
			this.turnStart = {};
			for (const [side, store] of [[this.myPlayer, this.mine], [this.theirPlayer, this.opponent]]) {
				for (const [slot, mon] of Object.entries(store)) {
					if (mon && !mon.fainted) this.turnStart[`${side}${slot}`] = { species: mon.species, spe: (mon.boosts && mon.boosts.spe) || 0, status: mon.status };
				}
			}
			break;
		case 'switch': case 'drag': case 'replace': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			/*
			 * Which turn each side last brought something in.
			 *
			 * Two of the playbook's strongest signals are about exactly this -
			 * people leave far more often on the turn after the opponent brought
			 * something in, and more often again on the turn after they brought
			 * something in themselves, which is the shape of a double switch. The
			 * turn number is all that needs storing; "just came in" is then a
			 * comparison rather than a flag that has to be cleared.
			 */
			if (id.side === this.myPlayer) this.mineCameIn = this.turn;
			else this.foeCameIn = this.turn;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const mon = this.blank(id.name, args[1]);
			const cond = parseCondition(args[2]);
			if (cond) Object.assign(mon, cond);
			// HP for the opponent arrives as a percentage; ours arrives exact.
			store[id.slot] = mon;
			break;
		}
		case 'detailschange': case '-formechange': {
			/*
			 * It changed into something else and fights as that: a Mega Evolution, a
			 * Primal, Terapagos, Aegislash's stance. None of this was tracked, so the
			 * bot kept calculating against base Lucario while a Lucario-Mega-Z hit it
			 * with the Mega's Special Attack.
			 */
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const species = String(args[1] || '').split(',')[0].trim();
			// -formechange is an in-battle forme (Aegislash, Meloetta): it goes back on switch,
			// which is fine, because a switch replaces the entry anyway.
			if (store[id.slot] && species) store[id.slot].species = species;
			break;
		}
		case 'faint': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) { store[id.slot].fainted = true; store[id.slot].hp = 0; }
			// Keystone Legion (Spiritomb) mends whenever any other Pokemon faints.
			this.legionCracked = {};
			break;
		}
		case '-damage': case '-heal': case '-sethp': {
			const id = this.slotOf(args[0]);
			const cond = parseCondition(args[1]);
			if (!id || !cond) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) Object.assign(store[id.slot], cond);
			// Our move landing on them proves they are NOT immune to it, which
			// rules out every ability that would have absorbed it.
			if (cmd === '-damage' && id.side !== this.myPlayer && store[id.slot]) {
				const lm = this.lastMove;
				if (lm && lm.side === this.myPlayer && lm.name) store[id.slot].notImmuneTo.add(lm.name);
			}
			break;
		}
		case '-status': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) store[id.slot].status = args[1] || '';
			break;
		}
		case '-curestatus': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) store[id.slot].status = '';
			break;
		}
		case '-boost': case '-unboost': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const mon = store[id.slot];
			if (!mon) break;
			const delta = (+args[2] || 0) * (cmd === '-boost' ? 1 : -1);
			mon.boosts[args[1]] = Math.max(-6, Math.min(6, (mon.boosts[args[1]] || 0) + delta));
			break;
		}
		case '-setboost': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) store[id.slot].boosts[args[1]] = +args[2] || 0;
			break;
		}
		case '-clearboost': case '-clearallboost': {
			for (const store of [this.mine, this.opponent]) {
				for (const slot of Object.keys(store)) {
					if (cmd === '-clearallboost' || parseIdent(args[0])?.slot === slot) store[slot].boosts = {};
				}
			}
			break;
		}
		case '-transform': {
			// |-transform|POKEMON|SPECIES - the user now has the target's stats,
			// types, moves and ability. Its HP is its own, and so is its level.
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const mon = store[id.slot];
			if (mon) mon.transformed = (args[1] || '').split(',')[0].replace(/^p[12][a-c]?: /, '').trim() || null;
			break;
		}
		case '-terastallize': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) store[id.slot].tera = args[1];
			break;
		}
		case '-item': {
			const id = this.slotOf(args[0]);
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) this.opponent[id.slot].item = args[1];
			break;
		}
		case '-fail': {
			// Knock Off that fails to take the item is Sticky Hold, near enough.
			const id = this.slotOf(args[0]);
			const lm = this.lastMove;
			// Our own move failing (a Sucker Punch into a status move): remembered for next turn.
			if (id && id.side === this.myPlayer && this.mine[id.slot] && lm && lm.side === this.myPlayer) {
				this.mine[id.slot].lastFailed = lm.name;
			}
			if (id && id.side !== this.myPlayer && this.opponent[id.slot] &&
				lm && lm.side === this.myPlayer && /knock off/i.test(lm.name || '')) {
				this.opponent[id.slot].keptItem = true;
			}
			break;
		}
		case '-enditem': {
			const id = this.slotOf(args[0]);
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) this.opponent[id.slot].item = null;
			break;
		}
		case '-ability': {
			const id = this.slotOf(args[0]);
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) this.opponent[id.slot].ability = args[1];
			// Keystone Legion announces itself only when it saves its holder: spent until a faint, even across switches.
			if (id && args[1] === 'Keystone Legion') (this.legionCracked || (this.legionCracked = {}))[`${id.side}|${(id.side === this.myPlayer ? this.mine : this.opponent)[id.slot]?.species || id.name}`] = true;
			break;
		}
		case 'move': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			if (id.side !== this.myPlayer && this.opponent[id.slot]) this.opponent[id.slot].moves.add(args[1]);
			{
				const store = id.side === this.myPlayer ? this.mine : this.opponent;
				const mon = store[id.slot];
				// [from] lines (Magic Bounce, Dancer) and called moves are not the Pokemon's own choice.
				const own = !parts.some(p => /^\[from\]/.test(p));
				if (mon && own) {
					mon.lastMove = args[1];
					mon.lastFailed = null;
					mon.repeat = mon.lastMoveTurn === this.turn - 1 && mon.previousMove === args[1] ? (mon.repeat || 1) + 1 : 1;
					mon.previousMove = args[1];
					mon.lastMoveTurn = this.turn;
				}
				if (own) this.turnMoves.push({ side: id.side, slot: id.slot, name: args[1], species: mon ? mon.species : '' });
				if (/^(Future Sight|Doom Desire)$/.test(args[1])) this.futureSight[id.side] = this.turn;
			}
			// Remember what was just used, so the result line that follows can be
			// attributed to it.
			this.lastMove = { side: id.side, name: args[1], target: args[2] || '' };
			break;
		}
		case '-immune': {
			// Whatever just bounced off, its type is one this Pokemon is immune to.
			const id = this.slotOf(args[0]);
			if (!id || id.side === this.myPlayer) break;
			const mon = this.opponent[id.slot];
			const lm = this.lastMove;
			if (mon && lm && lm.side === this.myPlayer && lm.name) mon.immuneTo.add(lm.name);
			break;
		}
		case '-start': case '-end': {
			// Dynamax: three turns a Pokemon should stay in for, once spent.
			if (/^Dynamax$/.test(String(args[1] || '').trim())) {
				const dm = this.slotOf(args[0]);
				const dstore = dm && (dm.side === this.myPlayer ? this.mine : this.opponent);
				if (dstore && dstore[dm.slot]) dstore[dm.slot].dynamaxed = cmd === '-start';
				break;
			}
			// Charge (the move, or Luxray's Gleamstalk): the next Electric move is doubled.
			if (!/charge/i.test(String(args[1] || ''))) break;
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) store[id.slot].charged = cmd === '-start';
			break;
		}
		case '-weather': this.weather = args[0] === 'none' ? '' : args[0]; break;
		case '-fieldstart': {
			const name = (args[0] || '').replace('move: ', '');
			// Terrains and pseudo-weathers both arrive as -fieldstart but mean
			// very different things - Trick Room is not a terrain.
			if (/Terrain$/.test(name)) this.terrain = name; else this.pseudo[name] = true;
			break;
		}
		case '-fieldend': {
			const name = (args[0] || '').replace('move: ', '');
			if (/Terrain$/.test(name)) this.terrain = ''; else delete this.pseudo[name];
			break;
		}
		case '-sidestart': {
			const side = (args[0] || '').split(':')[0];
			const name = (args[1] || '').replace('move: ', '');
			if (this.hazards[side]) this.hazards[side][name] = (this.hazards[side][name] || 0) + 1;
			break;
		}
		case '-sideend': {
			const side = (args[0] || '').split(':')[0];
			const name = (args[1] || '').replace('move: ', '');
			if (this.hazards[side]) delete this.hazards[side][name];
			break;
		}
		case 'win': case 'tie': this.ended = true; break;
		}
	}

	get trickRoom() { return !!this.pseudo['Trick Room']; }

	/** What this side's Pokemon is effectively acting as right now. */
	actingAs(side, slot) {
		const store = side === this.myPlayer ? this.mine : this.opponent;
		const mon = store[slot];
		if (!mon) return null;
		return mon.transformed || mon.species;
	}

	/** Opposing Pokemon currently on the field. */
	foes() {
		return Object.entries(this.opponent)
			.filter(([, m]) => m && !m.fainted)
			.map(([slot, m]) => ({ slot, ...m }));
	}
}

module.exports = { BattleState, parseIdent, parseCondition };
