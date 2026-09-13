'use strict';
/**
 * The bot on the ladder.
 *
 * Challenging is fine, but the button everyone actually reaches for is Battle!,
 * and a challenge does not count for anything. Sitting in the ladder queue fixes
 * both at once: the ordinary Find a random opponent button matches the player
 * against the bot, and because it came through the ladder the result is rated
 * and lands on a real Elo table that /ladder will show.
 *
 * One account can only queue for one format at a time, so each format gets its
 * own connection. They are cheap - the expensive data (dex, damage calculator,
 * team builder) is module state shared by all of them, so an extra queue costs a
 * socket and a little bookkeeping, not another copy of Pokemon.
 */

const WebSocket = require('ws');
const { TeamBuilder } = require('./teambuilder');
const { BattleAI } = require('./ai');
const { BattleState } = require('./battle');
const { logIn } = require('./login');

// One queue per difficulty, so each carries its OWN rating. That is the whole
// point: if a single account played at whatever difficulty each opponent asked
// for, its Elo would mean nothing - beating it at easy and at champion would be
// worth exactly the same. Kept to one format by default so the four ratings are
// directly comparable, which also makes them a real measurement of the bots
// against each other.
const { DEFAULT_FORMATS, DEFAULT_DIFFICULTIES } = require('./ladder-defaults');

// Shared with the server's matchmaking rules, which have to know which accounts
// are bots. See src/queue-names.js for why the names are as short as they are.
const { queueName } = require('./queue-names');

class LadderBot {
	/**
	 * @param {object} options
	 * @param {string} options.url        websocket url
	 * @param {string} options.name       this queue's account name
	 * @param {string} options.format     the format it queues for
	 * @param {TeamBuilder} options.builder  shared with the main bot
	 */
	constructor(options) {
		this.url = options.url;
		this.name = options.name;
		this.format = options.format;
		this.builder = options.builder;
		// Fixed for the life of this queue. Deliberately NOT taken from the
		// player's preference: a rating only means something if the thing being
		// rated played the same way every game.
		this.difficulty = options.difficulty || 'hard';
		this.log = options.log || (() => {});
		this.baseName = options.baseName || 'Velvet Bunny';
		// Every rung wears the bot's face. Like the main account these are guests,
		// so the avatar has to be asked for rather than left to login to apply.
		this.avatar = options.avatar || process.env.PS_BOT_AVATAR || 'bunny.png';
		// Each queue is its own account, so each needs its own proof of identity
		// once the server stops accepting unproven names. One password for all of
		// them is the usual arrangement; PS_LADDER_PASSWORD_<RUNG> overrides it.
		const perRung = process.env[`PS_LADDER_PASSWORD_${String(options.difficulty || '').toUpperCase()}`];
		this.password = options.password || perRung || process.env.PS_LADDER_PASSWORD ||
			process.env.PS_BOT_PASSWORD || '';
		this.battles = new Map();
		this.searching = false;
		this.ws = null;
		this.reconnectDelay = 2000;
		// A pause after a game against another rung. The server refuses to pair two
		// bots at all now, so this should never come up; it is kept as a brake in
		// case one ever slips through, because four queues left to play each other
		// filled five battle rooms in six and moved every rating at random.
		this.selfPlayCooldown = Number(process.env.PS_LADDER_SELFPLAY_COOLDOWN || 120000);
		this.stopped = false;
	}

	connect() {
		if (this.stopped) return;
		this.ws = new WebSocket(this.url);
		this.ws.on('open', () => { this.reconnectDelay = 2000; });
		this.ws.on('message', d => this.onData(String(d)));
		this.ws.on('error', () => {});
		this.ws.on('close', () => {
			this.searching = false;
			if (this.stopped) return;
			setTimeout(() => this.connect(), this.reconnectDelay);
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
		});
	}

	stop() {
		this.stopped = true;
		try { this.ws && this.ws.close(); } catch (e) { /* already gone */ }
	}

	send(line) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(line);
	}

	onData(frame) {
		const lines = frame.split('\n');
		let roomid = '';
		if (lines[0] && lines[0].startsWith('>')) roomid = lines.shift().slice(1).trim();
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			const parts = line.slice(1).split('|');
			try { this.onLine(roomid, parts); } catch (e) { this.log(`${this.name}: ${e.message}`); }
		}
	}

	onLine(roomid, parts) {
		switch (parts[0]) {
		case 'challstr':
			void logIn({
				name: this.name,
				password: this.password,
				challstr: `${parts[1]}|${parts[2]}`,
				send: line => this.send(line),
				log: this.log,
			});
			return;
		case 'updateuser':
			if (parts[2] === '1' && !this.ready) {
				this.ready = true;
				if (this.avatar) this.send(`|/avatar ${this.avatar}`);
				this.log(`${this.name} queueing for ${this.format}`);
				void this.search();
			}
			return;
		case 'updatesearch': {
			// Re-queue as soon as we stop being in the queue, unless a battle is
			// running - which is the usual reason the search ended.
			let data = {};
			try { data = JSON.parse(parts.slice(1).join('|') || '{}'); } catch (e) { return; }
			const inQueue = Array.isArray(data.searching) && data.searching.length > 0;
			const inGame = data.games && Object.keys(data.games).length > 0;
			this.searching = inQueue;
			if (!inQueue && !inGame) setTimeout(() => void this.search(), 3000);
			return;
		}
		}
		if (roomid && roomid.startsWith('battle-')) this.onBattleLine(roomid, parts);
	}

	/** Put a legal team up and join the queue. */
	async search() {
		if (this.stopped || this.searching) return;
		try {
			if (this.builder.needsTeam(this.format)) {
				try { await this.builder.prefetch(this.format); } catch (e) { /* offline */ }
				this.send(`|/utm ${this.builder.build(this.format)}`);
			} else {
				this.send('|/utm null');
			}
			this.send(`|/search ${this.format}`);
			this.searching = true;
		} catch (e) {
			this.log(`${this.name}: cannot queue for ${this.format}: ${e.message}`);
		}
	}

	onBattleLine(roomid, parts) {
		let battle = this.battles.get(roomid);
		if (!battle) {
			battle = { state: new BattleState(roomid), ai: new BattleAI({ difficulty: this.difficulty }), greeted: false };
			battle.state.myName = this.name;
			// The format decides what the bot may assume about the other side: in
			// Random Battle the sets are published, in a built format they are not.
			battle.ai.setFormat(this.format);
			const usage = this.builder.usage.get(this.format);
			if (usage) battle.ai.setUsage(usage);
			this.battles.set(roomid, battle);
		}
		const { state, ai } = battle;

		switch (parts[0]) {
		case 'player': {
			const id = (parts[2] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			const mine = this.name.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (id === mine) { state.myPlayer = parts[1]; break; }
			if (!id) break;
			// Every rung queues the same format, so left alone they would spend all
			// day playing each other on an instance with one shared CPU. Note when
			// the opponent is one of us and back off afterwards, which keeps a queue
			// waiting for real players without burning the box between games.
			const baseId = this.baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
			battle.versusBot = id.startsWith(baseId);
			if (!battle.greeted) {
				battle.greeted = true;
				this.send(`${roomid}|Good luck! Playing on **${ai.difficultyName}**.`);
			}
			break;
		}
		case 'request': {
			const raw = parts.slice(1).join('|');
			if (!raw) return;
			let request;
			try { request = JSON.parse(raw); } catch (e) { return; }
			const choice = ai.decide(request, state);
			if (choice) this.send(`${roomid}|/choose ${choice}|${request.rqid || ''}`);
			return;
		}
		case 'error':
			this.send(`${roomid}|/choose default`);
			return;
		case 'win': case 'tie': {
			const wait = battle.versusBot ? this.selfPlayCooldown : 4000;
			setTimeout(() => {
				this.send(`${roomid}|/leave`);
				this.battles.delete(roomid);
				void this.search();
			}, wait);
			break;
		}
		}
		state.line(parts);
	}
}

/** Start one queue for every difficulty, in every laddered format. */
function startLadderBots(options) {
	const formats = (process.env.PS_LADDER_FORMATS || DEFAULT_FORMATS.join(','))
		.split(',').map(f => f.trim()).filter(f => f);
	const difficulties = (process.env.PS_LADDER_DIFFICULTIES || DEFAULT_DIFFICULTIES.join(','))
		.split(',').map(d => d.trim()).filter(d => d);
	if (process.env.PS_LADDER === '0' || !formats.length || !difficulties.length) return [];

	const builder = options.builder || new TeamBuilder();
	const base = options.baseName || 'Velvet Bunny';
	const multi = formats.length > 1;
	const bots = [];
	for (const format of formats) {
		for (const difficulty of difficulties) {
			bots.push(new LadderBot({
				url: options.url,
				name: queueName(base, difficulty, format, multi),
				format,
				builder,
				difficulty,
				baseName: base,
				log: options.log,
			}));
		}
	}
	for (const bot of bots) bot.connect();
	return bots;
}

module.exports = { LadderBot, startLadderBots, queueName, DEFAULT_FORMATS, DEFAULT_DIFFICULTIES };
