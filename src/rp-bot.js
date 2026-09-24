'use strict';
/**
 * The RP bot: one account standing in the Roleplay room, and a short-lived
 * connection for every wild Pokemon and trainer it plays.
 *
 * Each encounter needs its own name - "Wild Pidgey", "Hiker Bob" - and a
 * Showdown account only has one name at a time, so every encounter is its own
 * connection, named for what it is, that challenges one player, plays the one
 * battle and leaves. They are cheap: the dex, the team builder and the AI's
 * data are shared by all of them, so each costs a socket and some bookkeeping.
 *
 * The guide itself never battles. It exists so that the server has somebody to
 * hand an encounter to (see src/rp-server.js), and so a player who PMs it gets
 * pointed at the tutorial instead of silence.
 */

const { ShowdownBot } = require('./bot');

const MAX_LIVE = Number(process.env.PS_RP_MAX_ENCOUNTERS || 12);
const CHALLENGE_MS = 5 * 60 * 1000;
const LIFETIME_MS = 60 * 60 * 1000;

/** A few things a trainer says. The class decides the flavour; most say something generic. */
const OPENERS = {
	hiker: ['Mountains make you tough. Let me show you!', 'You picked the wrong path to be on!'],
	swimmer: ['The water is fine. The battle, less so!', 'Race you! No? A battle then!'],
	swimmerf: ['The water is fine. The battle, less so!'],
	fisherman: ['Hooked one! Oh, it is a trainer.', 'You scared off the fish. You owe me a battle.'],
	bugcatcher: ['My bugs are the best bugs!', 'Look what I caught this morning!'],
	youngster: ['My Pokémon are in the top percentage!', 'Hey! Our eyes met! That means we battle!'],
	lass: ['You look nice. My team is nicer!', 'Don\'t go easy on me!'],
	abyssalgrunt: ['You saw nothing. Or you will, once I\'m done with you.', 'Team Abyssal doesn\'t like witnesses.'],
	twins: ['We battle together!', 'Two against one! Well, two against you!'],
	youngcouple: ['We never lose when we\'re together!', 'Sorry! It\'s our date, and we battle on dates.'],
	dragontamer: ['Dragons do not bow to the unprepared.'],
	hexmaniac: ['I saw you coming. The spirits told me.'],
	blackbelt: ['Hyah! Show me your strength!'],
	battlegirl: ['Hyah! Show me your strength!'],
};
const GENERIC = ['You look like a trainer. Let\'s battle!', 'I\'ve been waiting for someone like you!', 'Let\'s see what you\'ve got!'];

/** One wild Pokemon or one trainer, for one battle. */
/*
 * What the encounter's own side may not use (owner, 23 Sep 2026):
 *   wild Pokémon and route trainers   nothing at all
 *   gym leaders                       Mega Evolution always; Z-Moves, Dynamax and
 *                                     Terastallization from the fifth gym on
 *   the Elite Four and the Champion   everything
 * `badges` is the challenger's, so the fifth gym is four badges in.
 */
const BIG_GIMMICKS = ['canZMove', 'canDynamax', 'maxMoves', 'canTerastallize'];
function gimmicksHidden(spawn) {
	if (['elitefour', 'champion'].includes(spawn.classId)) return false;
	if (spawn.classId === 'gymleader') return (Number(spawn.badges) || 0) >= 4 ? false : BIG_GIMMICKS;
	return true;
}

class EncounterOpponent extends ShowdownBot {
	constructor(spawn, options) {
		super({
			url: options.url,
			name: spawn.name,
			password: '',
			avatar: spawn.avatar || 'unknown',
			difficulty: spawn.ai,
			homeRoom: null,
			builder: options.builder,
			log: (...a) => options.log(`[${spawn.name}]`, ...a),
		});
		this.spawn = spawn;
		this.noGimmicks = gimmicksHidden(spawn);
		this.onDone = options.onDone;
		this.renames = 0;
		this.challenged = false;
		this.battleRoom = null;
		this.timers = [];
		this.later(() => this.finish('the encounter ran too long'), LIFETIME_MS);
	}

	later(fn, ms) {
		const t = setTimeout(fn, ms);
		if (t.unref) t.unref();
		this.timers.push(t);
		return t;
	}

	onLine(roomid, parts, raw) {
		// Somebody really is called that. Try again with a number on the end.
		if (parts[0] === 'nametaken') {
			if (++this.renames > 5) return this.finish('no free name');
			const suffix = String(Math.floor(Math.random() * 90) + 10);
			this.name = `${this.spawn.name.slice(0, 18 - suffix.length)}${suffix}`;
			this.send(`|/trn ${this.name},0,`);
			return;
		}
		if (parts[0] === 'init' && roomid.startsWith('battle-')) {
			this.battleRoom = roomid;
			this.room(roomid, '/timer on');
		}
		return super.onLine(roomid, parts, raw);
	}

	onReady() {
		/*
		 * The player picked a team on Discord, so the server is opening this
		 * battle itself (config/showdown-config.js openEncounter). There is
		 * nothing to challenge and nothing for them to accept: this account
		 * just waits to be put in the room, and onLine picks it up from there.
		 */
		if (this.spawn.open) {
			this.log(`waiting to be put in a battle with ${this.spawn.target}`);
			this.later(() => {
				if (!this.battleRoom) this.finish('the battle was never opened');
			}, CHALLENGE_MS);
			return;
		}
		// Guests are made autoconfirmed on a two-second sweep, and a challenge from
		// somebody who isn't is refused - so wait out one sweep first.
		this.later(() => {
			// The tutorial format hands out the teams itself and refuses one sent in.
			this.send(`|/utm ${this.spawn.format === 'gen9rptutorial' ? 'null' : this.spawn.team}`);
			this.send(`|/challenge ${this.spawn.target}, ${this.spawn.format}`);
			this.challenged = true;
			this.log(`challenged ${this.spawn.target} in ${this.spawn.format}`);
		}, 2500);
		this.later(() => {
			if (!this.battleRoom) {
				this.send(`|/cancelchallenge ${this.spawn.target}`);
				this.finish('the challenge was not accepted');
			}
		}, CHALLENGE_MS);
	}

	// Nobody else gets to challenge a wild Pidgey.
	onChallenges(data) {
		for (const user of Object.keys(data.challengesFrom || {})) this.send(`|/reject ${user}`);
	}

	onPM(parts) {
		const message = parts.slice(3).join('|').trim();
		// An empty /challenge means ours was declined or withdrawn. If a battle
		// didn't start from it, there's nothing left to do.
		if (this.challenged && /^\/challenge\s*$/.test(message)) {
			this.later(() => { if (!this.battleRoom) this.finish('declined'); }, 4000);
		}
	}

	greeting(ai, roomid) {
		const s = this.spawn;
		const bag = s.balls ? Object.entries(s.balls).filter(([, n]) => n > 0) : null;
		const lines = [];
		if (s.kind === 'trainer') {
			const said = OPENERS[s.classId] || GENERIC;
			lines.push(`${said[Math.floor(Math.random() * said.length)]}`);
		}
		if (bag && s.kind === 'wild') {
			const E = require('./encounters');
			const list = bag.map(([id, n]) => `${n} ${E.findBall(id) ? E.findBall(id).name : id}`).join(', ');
			// Medicine too, so a Potion in the bag isn't a surprise.
			const items = s.items ? Object.entries(s.items).filter(([, n]) => n > 0)
				.map(([id, n]) => `${n} ${E.findBattleItem(id) ? E.findBattleItem(id).name : id}`).join(', ') : '';
			lines.push(`${s.character ? `${s.character}'s` : 'Your'} bag: ${list || 'no balls at all!'}${items ? ` · ${items} (in the Bag under your moves)` : ''}`);
		}
		// Reminders the Discord bot sent along: things this character can't use yet.
		if (s.warning) lines.push(s.warning);
		for (const line of lines.slice(1)) this.room(roomid, line);
		return lines[0] || null;
	}

	farewell(winner) {
		if (this.spawn.kind !== 'trainer') return null;
		return winner && winner !== this.name ? 'You got me. Good battle!' : 'Better luck next time!';
	}

	onBattleEnd() {
		this.finish('battle over');
	}

	finish(why) {
		if (this.finished) return;
		this.finished = true;
		this.log(`done: ${why}`);
		for (const t of this.timers) clearTimeout(t);
		this.stop();
		if (this.onDone) this.onDone(this);
	}
}

/** The account in the Roleplay room. */
class RpGuide extends ShowdownBot {
	constructor(options = {}) {
		super({
			...options,
			name: options.name || process.env.PS_RP_BOT_NAME || 'RP Guide',
			password: '',
			avatar: options.avatar || process.env.PS_RP_BOT_AVATAR || 'pokemonrangerf-gen6',
			homeRoom: 'roleplay',
			log: options.log || ((...a) => console.log('[rp]', ...a)),
		});
		this.live = new Map();   // encounter id -> EncounterOpponent
	}

	/** The server writes this room's introduction itself; there is no panel to publish. */
	publishLobbyPanel() {}

	onChallenges(data) {
		for (const user of Object.keys(data.challengesFrom || {})) {
			this.send(`|/reject ${user}`);
			this.pm(user, 'I don\'t battle - I send wild Pokémon and trainers your way. Use !encounter on Discord. Type /roleplay for how it works.');
		}
	}

	onPM(parts) {
		const from = (parts[1] || '').trim();
		const message = parts.slice(3).join('|').trim();
		if (from === '~' && message.startsWith('/rpcancel ')) {
			// Staff finished it on Discord: stop waiting, and leave any battle.
			const opponent = this.live.get(message.slice('/rpcancel '.length).trim());
			if (opponent && !opponent.finished) {
				if (opponent.battleRoom) opponent.room(opponent.battleRoom, '/forfeit');
				else opponent.send(`|/cancelchallenge ${opponent.spawn.target}`);
				opponent.finish('completed by staff');
			}
			return;
		}
		if (from === '~' && message.startsWith('/rpspawn ')) {
			let spawn;
			try { spawn = JSON.parse(message.slice('/rpspawn '.length)); } catch (e) { return this.log('unreadable spawn'); }
			return this.startEncounter(spawn);
		}
		const fromId = from.replace(/^[^A-Za-z0-9]/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
		if (!fromId || fromId === this.name.toLowerCase().replace(/[^a-z0-9]/g, '')) return;
		if (message.startsWith('/')) return;   // raw, uhtml and the like
		this.pm(from.replace(/^[^A-Za-z0-9]/, ''), 'Hi! I run the RP encounters. Ask for one on Discord with !encounter, and I\'ll challenge you here. Type /roleplay for the full guide.');
	}

	startEncounter(spawn) {
		const existing = this.live.get(spawn.id);
		if (existing && !existing.finished) {
			// Asked again for the same one: challenge again rather than start another.
			if (!existing.battleRoom) {
				existing.send(`|/challenge ${spawn.target}, ${spawn.format}`);
				return;
			}
			// It already had a battle, which the server has called off (the team didn't
			// match the box) - the server only asks again for an encounter that isn't
			// being battled. That opponent may not have noticed yet: retire it, send a new one.
			existing.finish('replaced after a called-off battle');
			this.live.delete(spawn.id);
		}
		if (this.live.size >= MAX_LIVE) {
			this.pm(spawn.target, 'The RP bot is running a lot of battles right now. Try !encounter again in a few minutes.');
			return;
		}
		const opponent = new EncounterOpponent(spawn, {
			url: this.url,
			builder: this.builder,
			log: this.log,
			onDone: done => this.live.delete(done.spawn.id),
		});
		this.live.set(spawn.id, opponent);
		opponent.connect();
	}
}

module.exports = { RpGuide, EncounterOpponent, gimmicksHidden };
