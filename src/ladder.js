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

const DEFAULT_FORMATS = [
	'gen9randombattle',
	'gen9ou',
	'gen9randomdoublesbattle',
	'gen9vgc2024regh',
];

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
		this.difficulty = options.difficulty || 'hard';
		this.log = options.log || (() => {});
		this.battles = new Map();
		this.searching = false;
		this.ws = null;
		this.reconnectDelay = 2000;
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
			this.send(`|/trn ${this.name},0,`);
			return;
		case 'updateuser':
			if (parts[2] === '1' && !this.ready) {
				this.ready = true;
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
			battle = { state: new BattleState(roomid), ai: new BattleAI({ difficulty: this.difficulty }) };
			battle.state.myName = this.name;
			const usage = this.builder.usage.get(this.format);
			if (usage) battle.ai.setUsage(usage);
			this.battles.set(roomid, battle);
		}
		const { state, ai } = battle;

		switch (parts[0]) {
		case 'player': {
			const id = (parts[2] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			if (id === this.name.toLowerCase().replace(/[^a-z0-9]/g, '')) state.myPlayer = parts[1];
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
		case 'win': case 'tie':
			setTimeout(() => {
				this.send(`${roomid}|/leave`);
				this.battles.delete(roomid);
				void this.search();
			}, 4000);
			break;
		}
		state.line(parts);
	}
}

/** Start one queue per format. */
function startLadderBots(options) {
	const formats = (process.env.PS_LADDER_FORMATS || DEFAULT_FORMATS.join(','))
		.split(',').map(f => f.trim()).filter(f => f);
	if (process.env.PS_LADDER === '0' || !formats.length) return [];

	const builder = options.builder || new TeamBuilder();
	const bots = formats.map((format, i) => new LadderBot({
		url: options.url,
		name: `${options.baseName || 'Velvet Bunny'} ${i + 2}`,
		format,
		builder,
		difficulty: options.difficulty,
		log: options.log,
	}));
	for (const bot of bots) bot.connect();
	return bots;
}

module.exports = { LadderBot, startLadderBots, DEFAULT_FORMATS };
