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
		this.weather = '';
		this.terrain = '';
		this.pseudo = {};          // Trick Room / Gravity / Magic Room / Wonder Room
		this.opponent = {};        // slot -> {species, details, level, hp, maxhp, status, boosts, moves:Set, item, ability, tera}
		this.mine = {};            // slot -> {species, hp, maxhp, status, boosts, tera}
		this.hazards = { p1: {}, p2: {} };
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
			boosts: {}, moves: new Set(), item: null, ability: null, tera: null,
		};
	}

	/** Feed one protocol line (already split on '|', without the leading empty). */
	line(parts) {
		const [cmd, ...args] = parts;
		switch (cmd) {
		case 'player': {
			// |player|p1|Username|avatar|rating
			if (this.myName && args[1] && args[1] === this.myName) this.myPlayer = args[0];
			break;
		}
		case 'gametype': this.gameType = args[0]; break;
		case 'gen': this.gen = +args[0] || 9; break;
		case 'rated': this.rated = true; break;
		case 'turn': this.turn = +args[0] || 0; break;
		case 'switch': case 'drag': case 'replace': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const mon = this.blank(id.name, args[1]);
			const cond = parseCondition(args[2]);
			if (cond) Object.assign(mon, cond);
			// HP for the opponent arrives as a percentage; ours arrives exact.
			store[id.slot] = mon;
			break;
		}
		case 'faint': {
			const id = this.slotOf(args[0]);
			if (!id) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) { store[id.slot].fainted = true; store[id.slot].hp = 0; }
			break;
		}
		case '-damage': case '-heal': case '-sethp': {
			const id = this.slotOf(args[0]);
			const cond = parseCondition(args[1]);
			if (!id || !cond) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			if (store[id.slot]) Object.assign(store[id.slot], cond);
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
		case '-enditem': {
			const id = this.slotOf(args[0]);
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) this.opponent[id.slot].item = null;
			break;
		}
		case '-ability': {
			const id = this.slotOf(args[0]);
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) this.opponent[id.slot].ability = args[1];
			break;
		}
		case 'move': {
			const id = this.slotOf(args[0]);
			if (id && id.side !== this.myPlayer && this.opponent[id.slot]) this.opponent[id.slot].moves.add(args[1]);
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

	/** Opposing Pokemon currently on the field. */
	foes() {
		return Object.entries(this.opponent)
			.filter(([, m]) => m && !m.fainted)
			.map(([slot, m]) => ({ slot, ...m }));
	}
}

module.exports = { BattleState, parseIdent, parseCondition };
