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

// The RP dex, so our own species and abilities are in it.
let DEX = null;
function dex() {
	if (!DEX) { try { DEX = require('./rp-dex')(); } catch (e) { DEX = false; } }
	return DEX || null;
}
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Whether a species is allowed this ability at all - including the ones we added. */
function canHave(species, ability) {
	const d = dex();
	if (!d || !species) return false;
	const sheet = d.species.get(species);
	if (!sheet || !sheet.exists) return false;
	const want = toId(ability);
	return Object.values(sheet.abilities || {}).some(a => toId(a) === want);
}

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
			/*
			 * [of] is not the ability's owner, it is the other Pokemon involved, and
			 * which one that is depends on the ability: Earth Eater heals the one the
			 * line names and blames the attacker, while Rough Skin damages the one the
			 * line names and belongs to the attacker. Reading [of] as the owner taught
			 * the bot that its own Glaceon had Earth Eater, so it fired Earth Power
			 * into a Mega Heatran, healed it, and fired again the turn after.
			 *
			 * So ask which of the two can actually have it, and only fall back to the
			 * old reading when the dex cannot say.
			 */
			const named = this.slotOf(args[0]);
			const other = of ? this.slotOf(of.slice('[of] '.length)) : null;
			const speciesOf = slot => {
				if (!slot) return null;
				const store = slot.side === this.myPlayer ? this.mine : this.opponent;
				return (store[slot.slot] && store[slot.slot].species) || slot.name;
			};
			let owner = null;
			const namedFits = named && canHave(speciesOf(named), ability);
			const otherFits = other && canHave(speciesOf(other), ability);
			if (namedFits !== otherFits) owner = namedFits ? named : other;
			else owner = other || named;
			if (owner && ability) {
				const store = owner.side === this.myPlayer ? this.mine : this.opponent;
				if (store[owner.slot]) store[owner.slot].ability = ability;
			}
		}
		/*
		 * The same for items: "|-damage|p2a: Tauros|80/100|[from] item: Life Orb" is
		 * the Life Orb announcing itself, and so are Leftovers healing and a Flame
		 * Orb burning. Only the ability line was read, so a Life Orb that had been
		 * showing its recoil for five turns was still an unknown item to the AI.
		 * With an [of] the item belongs to that Pokemon (Rocky Helmet hurts the
		 * attacker, not its holder). (24 Sep 2026)
		 */
		const fromItem = /^-(damage|heal|status)$/.test(parts[0]) && parts.find(p => /^\[from\] item: /.test(p));
		if (fromItem) {
			const owner = of ? this.slotOf(of.slice('[of] '.length)) : this.slotOf(args[0]);
			if (owner && owner.side !== this.myPlayer && this.opponent[owner.slot]) {
				this.opponent[owner.slot].item = fromItem.slice('[from] item: '.length).trim();
				this.opponent[owner.slot].itemGone = false;
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
		// |teamsize|p2|6 - how many they brought, so the endgame knows when it has
		// seen them all (24 Sep 2026).
		case 'teamsize': (this.teamSize = this.teamSize || {})[args[0]] = +args[1] || 0; break;
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
			/*
			 * What we knew about the one that just left, kept. Without a team preview
			 * a foe that switched out vanished from the state entirely, so neither a
			 * sack's "what can it still do against what they have left" (Pinkacross,
			 * The Art of Sacking) nor an exact endgame could count it. Boosts and
			 * volatiles go with the switch; HP, status and shown moves stay.
			 */
			if (id.side !== this.myPlayer) {
				this.theirSeen = this.theirSeen || new Set();
				this.theirBench = this.theirBench || {};
				const old = store[id.slot];
				if (old && !old.fainted && old.species && old.species !== mon.species) {
					this.theirBench[old.species] = { ...old, boosts: {}, transformed: null, slot: null, bench: true };
				}
				// Coming back, it still has the moves, item and ability it showed last time.
				const back = this.theirBench[mon.species];
				if (back) {
					for (const m of back.moves || []) mon.moves.add(m);
					if (back.ability && !mon.ability) mon.ability = back.ability;
					if (back.item && !mon.item) mon.item = back.item;
					// And how hard it has been seen to hit (the AI's item read), and a lost item.
					if (back.hits) mon.hits = back.hits;
					if (back.itemGone) mon.itemGone = true;
				}
				delete this.theirBench[mon.species];
				this.theirSeen.add(mon.species);
			}
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
			// Their fallen, by species: team preview lists the whole team, and this is what is gone from it.
			if (id.side === this.theirPlayer && store[id.slot]) (this.theirDown = this.theirDown || []).push(store[id.slot].species);
			// Keystone Legion (Spiritomb) mends whenever any other Pokemon faints.
			this.legionCracked = {};
			break;
		}
		case '-damage': case '-heal': case '-sethp': {
			const id = this.slotOf(args[0]);
			const cond = parseCondition(args[1]);
			if (!id || !cond) break;
			const store = id.side === this.myPlayer ? this.mine : this.opponent;
			const before = store[id.slot] ? store[id.slot].hp : null;
			if (store[id.slot]) Object.assign(store[id.slot], cond);
			/*
			 * How hard their attack actually hit us, for the AI to compare with what it
			 * expected (BattleAI.learnFoeScale). A Choice Band gives itself away only
			 * like this: a Tauros-Paldea-Combat Close Combat read as half of a Rotom-Mow
			 * and took nine tenths of it. Only a plain hit - no [from] (recoil, hazards,
			 * items), no critical hit, and not the hit that knocked us out, which says
			 * only "at least this much". (24 Sep 2026)
			 */
			if (cmd === '-damage' && id.side === this.myPlayer && store[id.slot] && !parts.some(p => /^\[from\]/.test(p))) {
				const lm = this.lastMove;
				const foe = lm && lm.side !== this.myPlayer && lm.slot ? this.opponent[lm.slot] : null;
				const mine = store[id.slot];
				if (foe && !foe.fainted && lm.name && typeof before === 'number' && cond.hp > 0 && cond.maxhp > 1 && before > cond.hp &&
					this.critOn !== args[0] && lm.turn === this.turn) {
					const mySide = this.hazards[this.myPlayer] || {};
					foe.hits = (foe.hits || []).slice(-5);
					foe.hits.push({
						move: lm.name, dealt: before - cond.hp, maxhp: cond.maxhp, target: mine.species, turn: this.turn,
						myBoosts: { ...(mine.boosts || {}) }, foeBoosts: { ...(foe.boosts || {}) }, foeTera: foe.tera || null,
						weather: this.weather || '', terrain: this.terrain || '',
						screens: !!(mySide['Reflect'] || mySide['Light Screen'] || mySide['Aurora Veil']),
					});
				}
			}
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
			if (id && this.opponent[id.slot] && id.side !== this.myPlayer) {
				this.opponent[id.slot].item = null;
				// Gone, not unknown: the AI stops guessing a damage item for it.
				this.opponent[id.slot].itemGone = true;
			}
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
					// Two different moves in one stay on the field: not Choice-locked, so
					// not holding a Choice item (the AI's item guess). (24 Sep 2026)
					if (mon.lastMove && mon.lastMove !== args[1] && !/^(Struggle|Max Guard)$/.test(args[1])) mon.movedFreely = true;
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
			this.lastMove = { side: id.side, slot: id.slot, name: args[1], target: args[2] || '', turn: this.turn };
			this.critOn = null;
			break;
		}
		case '-crit': this.critOn = args[0]; break;
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
			// No Retreat fails a second time; it lasts until the Pokemon leaves (a switch replaces the entry).
			if (cmd === '-start' && /No Retreat/.test(String(args[1] || ''))) {
				const nr = this.slotOf(args[0]);
				const nstore = nr && (nr.side === this.myPlayer ? this.mine : this.opponent);
				if (nstore && nstore[nr.slot]) nstore[nr.slot].noRetreat = true;
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

	/**
	 * Everything they still have: the Pokemon on the field as the log knows them,
	 * plus the rest of the team preview at full health. Without a preview (no
	 * Team Preview in the format) it is just the field.
	 */
	foeTeam() {
		const field = this.foes();
		const list = (this.preview && this.preview[this.theirPlayer]) || [];
		if (!list.length) return field;
		const base = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const down = [...(this.theirDown || [])].map(base);
		const out = [...field];
		for (const p of list) {
			const id = base(p.species);
			if (field.some(f => base(f.species).startsWith(id) || id.startsWith(base(f.species)))) continue;
			const gone = down.findIndex(d => d.startsWith(id) || id.startsWith(d));
			if (gone >= 0) { down.splice(gone, 1); continue; }
			out.push({ slot: null, species: p.species, level: p.level, hp: 100, maxhp: 100, status: '', boosts: {},
				moves: new Set(), immuneTo: new Set(), notImmuneTo: new Set(), bench: true });
		}
		return out;
	}
}

module.exports = { BattleState, parseIdent, parseCondition };
