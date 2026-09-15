'use strict';
/**
 * The bot: connects to a Pokemon Showdown server as a player, accepts any
 * challenge in any format, brings a legal team for it, and plays.
 *
 * Players get the full official client - teambuilder, every format, replays -
 * because this is a real Showdown server. The bot is just another user on it.
 */

const WebSocket = require('ws');
const { Dex } = require('pokemon-showdown');
const { TeamBuilder } = require('./teambuilder');
const { BattleAI } = require('./ai');
const { BattleState } = require('./battle');

const DIFFICULTY_BLURB = {
	easy: 'Misplays often. A good place to learn a format.',
	normal: 'Clicks the strongest attack. No tricks.',
	hard: 'Plays the matchup: switches, sets up, values its win condition.',
	champion: 'As above, and it counts the speed tiers before it commits.',
	stockfish: 'EXPERIMENTAL - searches its options against your likely replies. Strength comes from self-play training, so it will change over time.',
};

class ShowdownBot {
	constructor(options = {}) {
		this.url = options.url || `ws://localhost:${process.env.PORT || 8000}/showdown/websocket`;
		this.name = options.name || process.env.PS_BOT_NAME || 'Velvet Bunny';
		this.password = options.password || process.env.PS_BOT_PASSWORD || '';
		// Showdown only applies a default avatar to registered accounts, and with
		// no login server the bot is a guest, so it has to ask for its own.
		this.avatar = options.avatar || process.env.PS_BOT_AVATAR || 'bunny.png';
		this.defaultDifficulty = options.difficulty || process.env.PS_DIFFICULTY || 'hard';
		// `null` means stand nowhere: the RP bot's short-lived trainers have no
		// business sitting in a room's user list.
		this.homeRoom = options.homeRoom === null ? null : (options.homeRoom || process.env.PS_HOME_ROOM || 'lobby');

		this.builder = options.builder || new TeamBuilder();
		this.battles = new Map();        // roomid -> {state, ai}
		// Battles this bot has finished and left - see forgetBattle().
		this.ended = new Set();
		// Shared with the ladder queues, so a difficulty picked here applies to a
		// ladder game too rather than only to a direct challenge.
		this.difficultyFor = options.difficultyFor || new Map();  // userid -> difficulty
		this.log = options.log || ((...a) => console.log('[bot]', ...a));
		this.ws = null;
		this.reconnectDelay = 1000;
	}

	// ------------------------------------------------------------- connection
	connect() {
		this.log(`connecting to ${this.url}`);
		this.ws = new WebSocket(this.url);
		this.ws.on('open', () => { this.log('connected'); this.reconnectDelay = 1000; });
		// One frame is one room's payload: an optional ">roomid" line followed by
		// its protocol lines. Splitting on blank lines used to cut the roomid away
		// from everything after the first blank line in a room's backlog, so room
		// messages arrived looking global.
		this.ws.on('message', data => this.onData(String(data)));
		this.ws.on('error', err => this.log('socket error:', err.message));
		this.ws.on('close', () => {
			if (this.stopped) return;   // closed on purpose
			this.log(`disconnected, retrying in ${this.reconnectDelay}ms`);
			setTimeout(() => this.connect(), this.reconnectDelay);
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
		});
	}

	send(line) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(line);
	}

	room(roomid, message) { this.send(`${roomid}|${message}`); }
	pm(user, message) { this.send(`|/pm ${user}, ${message}`); }

	// ------------------------------------------------------------- dispatching
	onData(block) {
		const lines = block.split('\n');
		let roomid = '';
		if (lines[0] && lines[0].startsWith('>')) roomid = lines.shift().slice(1).trim();
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			const parts = line.slice(1).split('|');
			if (process.env.PS_DEBUG === '1') this.log(`<< [${roomid}] ${line.slice(0, 160)}`);
			try { this.onLine(roomid, parts, line); } catch (e) { this.log('handler error:', e.message); }
		}
	}

	onLine(roomid, parts, raw) {
		const [cmd] = parts;
		switch (cmd) {
		case 'challstr':
			this.login(parts[1], parts[2]);
			return;
		case 'updateuser':
			// |updateuser|name|named|avatar|settings
			if (parts[2] === '1' && !this.ready) {
				this.ready = true;
				this.log(`logged in as ${parts[1].trim()}`);
				if (this.avatar) this.send(`|/avatar ${this.avatar}`);
				// /pminfobox is a chat command: it has to be sent from a room, not
				// from the console, so the bot needs somewhere to stand.
				if (this.homeRoom) this.send(`|/join ${this.homeRoom}`);
				this.onReady();
			}
			return;
		case 'updatechallenges':
			this.onChallenges(JSON.parse(parts.slice(1).join('|') || '{}'));
			return;
		case 'pm':
			this.onPM(parts);
			return;
		case 'popup':
			this.log('popup:', parts.slice(1).join('|').slice(0, 200));
			return;
		case 'init': {
			// Showdown omits the ">roomid" line for the default room, so an empty
			// roomid here means the lobby rather than "no room".
			const room = roomid || 'lobby';
			// The room is ready - put the format picker up. Re-published on every
			// boot so a new Showdown version's format list is picked up.
			if (room === this.homeRoom) setTimeout(() => this.publishLobbyPanel(), 2500);
			return;
		}
		}

		if (roomid && roomid.startsWith('battle-')) this.onBattleLine(roomid, parts, raw);
	}

	/** Logged in and named. Nothing to do for the house bot; subclasses start here. */
	onReady() {}

	/** Close for good, without the reconnect a dropped connection gets. */
	stop() {
		this.stopped = true;
		try { if (this.ws) this.ws.close(); } catch (e) { /* already closed */ }
	}

	/** The line said when a battle starts, and the one when it ends. */
	greeting(ai) { return `Good luck! Playing on **${ai.difficultyName}**. (PM me to change it.)`; }
	farewell(winner) { return winner && winner !== this.name ? 'Good game!' : 'Good game - rematch any time.'; }

	login(challstr1, challstr2) {
		const challstr = `${challstr1}|${challstr2}`;
		if (!this.password) {
			// Open server: claim the name directly.
			this.send(`|/trn ${this.name},0,`);
			return;
		}
		const body = new URLSearchParams({
			act: 'login', name: this.name, pass: this.password, challstr,
		});
		fetch('https://play.pokemonshowdown.com/api/login', { method: 'POST', body })
			.then(r => r.text())
			.then(text => {
				const data = JSON.parse(text.startsWith(']') ? text.slice(1) : text);
				if (!data.assertion) throw new Error(data.actionerror || 'login refused');
				this.send(`|/trn ${this.name},0,${data.assertion}`);
			})
			.catch(e => {
				this.log('login failed, falling back to an unregistered name:', e.message);
				this.send(`|/trn ${this.name},0,`);
			});
	}

	// -------------------------------------------------------------- challenges
	async onChallenges(data) {
		const incoming = data.challengesFrom || {};
		this.log(`challenges update: ${JSON.stringify(incoming)}`);
		for (const [user, format] of Object.entries(incoming)) {
			this.log(`challenge from ${user} in ${format}`);
			try {
				await this.acceptChallenge(user, format);
			} catch (e) {
				this.log(`cannot accept ${format}:`, e.message);
				this.pm(user, `Sorry - I could not put a legal team together for ${format}. (${e.message})`);
				this.send(`|/reject ${user}`);
			}
		}
	}

	async acceptChallenge(user, formatId) {
		const format = Dex.formats.get(formatId);
		if (!format.exists) throw new Error(`unknown format ${formatId}`);

		if (this.builder.needsTeam(formatId)) {
			// Smogon sets for this exact format, when they exist.
			try { await this.builder.prefetch(formatId); } catch (e) { /* offline: bundled data still works */ }
			const team = this.builder.build(formatId);
			this.send(`|/utm ${team}`);
		} else {
			this.send('|/utm null');   // random formats: the server builds it
		}
		this.send(`|/accept ${user}`);
	}

	// --------------------------------------------------------------- messaging
	onPM(parts) {
		const from = (parts[1] || '').trim().replace(/^[^A-Za-z0-9]/, '');
		const fromId = from.toLowerCase().replace(/[^a-z0-9]/g, '');
		const myId = this.name.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (!fromId || fromId === myId) return;   // our own outgoing PMs echo back

		const message = parts.slice(3).join('|').trim();
		if (!message) return;

		// Challenges arrive as a PM command, not through |updatechallenges|.
		// An empty format means the challenge was withdrawn.
		if (message.startsWith('/challenge')) {
			const payload = message.slice('/challenge'.length).trim();
			const format = payload.split('|')[0].trim();
			if (format) {
				this.onChallenges({ challengesFrom: { [fromId]: format } });
			}
			return;
		}
		if (message.startsWith('/log') || message.startsWith('/text') || message.startsWith('/raw') ||
			message.startsWith('/uhtml') || message.startsWith('/error')) return;

		const set = /^[!/]?difficulty\s+(\w+)/i.exec(message);
		if (set) {
			const wanted = set[1].toLowerCase();
			if (!BattleAI.difficulties().includes(wanted)) {
				this.pm(from, `I do not know "${wanted}". Pick one of: ${BattleAI.difficulties().join(', ')}.`);
				return;
			}
			this.difficultyFor.set(fromId, wanted);
			this.pm(from, `Difficulty set to ${wanted}. Challenge me in any format and I will bring a legal team.`);
			return;
		}
		this.showDifficulty(from);
	}

	/**
	 * The lobby panel: every format the server will accept, as a button.
	 *
	 * Challenging through a PM conversation is a poor first experience - you have
	 * to know the bot's name, know the format id, and type both. This puts the
	 * whole format list one click away in the first room every player lands in.
	 *
	 * Formats that build their own teams are marked, because those start the
	 * moment you click; the rest open the client's team picker first.
	 */
	lobbyPanelHTML() {
		const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		const label = d => `${d[0].toUpperCase()}${d.slice(1)}` + (d === 'stockfish' ? ' *' : '');
		// /bot rather than a PM: the PM only ever reached this process, which picks
		// the difficulty for challenges. The ladder is matched by the server, so the
		// server has to be told too - clicking Stockfish and being sent to Normal is
		// what happens when it is not. /bot records it there and forwards it here.
		// Players only belongs next to the difficulties: it is the same question.
		const pvpButton = `<button class="button" name="send" value="/bot pvp">Players only</button>`;
		const diffButtons = BattleAI.difficulties().map(d =>
			`<button class="button" name="send" value="/bot ${d}">` +
			`${esc(label(d))}</button>`).join(' ');

		// Dex order matches the order the client lists formats in, so the sections
		// come out in the order players already expect to see them.
		const sections = new Map();
		for (const f of Dex.formats.all()) {
			if (f.effectType !== 'Format' || !f.exists) continue;
			if (f.challengeShow === false) continue;
			const name = f.section || 'Other';
			if (!sections.has(name)) sections.set(name, []);
			sections.get(name).push(f);
		}

		let total = 0;
		const blocks = [];
		for (const [name, formats] of sections) {
			const buttons = formats.map(f => {
				total++;
				const instant = !!f.team;   // random-team formats need no team from the player
				const label = esc(f.name.replace(/^\[Gen \d+\] /, ''));
				return `<button class="button" name="send" value="/challenge ${esc(this.name)}, ${f.id}" ` +
					`title="${esc(f.name)}">${instant ? '&#9889; ' : ''}${label}</button>`;
			}).join(' ');
			const open = blocks.length < 2 ? ' open' : '';
			blocks.push(`<details${open}><summary><b>${esc(name)}</b> <small>(${formats.length})</small></summary>` +
				`<div style="padding:4px 0">${buttons}</div></details>`);
		}

		return `<div style="padding:4px">` +
			`<h3 style="margin:0 0 4px">Battle the house bot</h3>` +
			`<p style="margin:0 0 6px"><small>Pick a difficulty, then click any format below to challenge ` +
			`<b>${esc(this.name)}</b>. It brings its own legal team to all ${total} of them. ` +
			`&#9889; needs no team from you - the battle starts as soon as you confirm; ` +
			`the rest will ask you to choose one of your teams first.</small></p>` +
			`<div style="margin:0 0 8px">Difficulty: ${diffButtons} ${pvpButton}</div>` +
			blocks.join('') +
			`</div>`;
	}

	/** Publish the panel as the lobby's introduction, so every visitor sees it. */
	publishLobbyPanel() {
		const html = this.lobbyPanelHTML();
		this.log(`publishing lobby panel (${html.length} bytes)`);
		this.room(this.homeRoom, `/roomintro ${html}`);
	}

	/** The difficulty picker, as its own box in the PM window. */
	showDifficulty(user) {
		const userId = user.toLowerCase().replace(/[^a-z0-9]/g, '');
		const current = this.difficultyFor.get(userId) || this.defaultDifficulty;
		const buttons = BattleAI.difficulties().map(d => {
			const mark = d === current ? ' style="font-weight:bold;border:1px solid #8a2be2"' : '';
			return `<button class="button" name="send" value="/bot ${d}"${mark}>` +
				`${d[0].toUpperCase()}${d.slice(1)}</button>`;
		}).join(' ');
		const rows = BattleAI.difficulties()
			.map(d => `<li><b>${d}</b> - ${DIFFICULTY_BLURB[d] || ''}</li>`).join('');

		const html = `<div style="padding:6px">` +
			`<b>Pick a difficulty, then hit Battle! or challenge me in any format.</b><br/>` +
			`<div style="margin:6px 0">${buttons}</div>` +
			`<small>Currently: <b>${current}</b></small>` +
			`<ul style="margin:6px 0 0 16px;padding:0;font-size:10px">${rows}</ul>` +
			`</div>`;
		// /pminfobox is a chat command and must come from a room, not the console.
		this.send(`${this.homeRoom}|/pminfobox ${user}, ${html}`);
		this.pm(user, `Difficulty: ${BattleAI.difficulties().join(' / ')} - reply "difficulty hard". Currently ${current}.`);
	}

	// ----------------------------------------------------------------- battles
	onBattleStart(roomid) {}
	onBattleEnd(roomid, winner) {}

	onBattleLine(roomid, parts, raw) {
		let battle = this.battles.get(roomid);
		// A line for a battle that is already over is not the start of a new one.
		if (!battle && isEndedBattle(this, roomid, parts)) return;
		if (!battle) {
			battle = { state: new BattleState(roomid), ai: new BattleAI({ difficulty: this.defaultDifficulty }), greeted: false };
			battle.state.myName = this.name;
			// Tell the AI what it is playing. The format decides both what it may
			// assume about the other side - Random Battle publishes its sets, a built
			// format does not - and, when it still has to guess an ability, which
			// guess the people who play that format would make.
			const format = /^battle-([a-z0-9]+)-/.exec(roomid);
			if (format) {
				battle.ai.setFormat(format[1]);
				const usage = this.builder.usage.get(format[1]);
				if (usage) battle.ai.setUsage(usage);
				else {
					this.builder.prefetch(format[1])
						.then(() => battle.ai.setUsage(this.builder.usage.get(format[1])))
						.catch(() => {});
				}
			}
			this.battles.set(roomid, battle);
		}
		const { state, ai } = battle;

		switch (parts[0]) {
		case 'player': {
			// Work out which side we are, and whose difficulty preference applies.
			const name = (parts[2] || '').trim();
			const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
			const myId = this.name.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (id === myId) state.myPlayer = parts[1];
			else if (id) {
				const wanted = this.difficultyFor.get(id);
				if (wanted) ai.setDifficulty(wanted);
				if (!battle.greeted) {
					battle.greeted = true;
					const hello = this.greeting(ai, roomid);
					if (hello) this.room(roomid, hello);
					this.onBattleStart(roomid);
				}
			}
			break;
		}
		case 'request': {
			const rawJson = parts.slice(1).join('|');
			if (!rawJson) return;
			let request;
			try { request = JSON.parse(rawJson); } catch (e) { return; }
			battle.retries = 0;
			const choice = ai.decide(request, state);
			if (choice) this.room(roomid, `/choose ${choice}|${request.rqid || ''}`);
			return;
		}
		case 'error': {
			// An illegal choice must never strand the battle - fall back to a
			// choice the server will always accept.
			this.log(`battle error in ${roomid}: ${parts.slice(1).join('|')}`);
			// Unless there is nothing to choose - the battle ended under a choice
			// already on its way, as a caught Pokemon does - where "default" is
			// refused in turn and the two would answer each other forever.
			const message = parts.slice(1).join('|');
			if (/nothing to choose|game is over|too late/i.test(message)) return;
			battle.retries = (battle.retries || 0) + 1;
			if (battle.retries > 5) return;
			this.room(roomid, '/choose default');
			return;
		}
		case 'win': case 'tie': {
			const winner = (parts[1] || '').trim();
			const bye = this.farewell(winner, roomid);
			if (bye) this.room(roomid, bye);
			setTimeout(() => { this.room(roomid, '/leave'); forgetBattle(this, roomid); this.onBattleEnd(roomid, winner); }, 4000);
			break;
		}
		}
		state.line(parts);
		void raw;
	}
}

/**
 * Let a finished battle go, and keep it gone.
 *
 * Deleting the battle was only half of it. Leaving the room makes the server
 * answer with a `|deinit` for that room, and anything already on its way - the
 * other player leaving, the replay link - lands after the delete too. Every one
 * of those is a line for a battle room this bot has no record of, which is
 * exactly what the start of a new battle looks like, so each finished game was
 * quietly brought back as a fresh entry with its own AI and nothing would ever
 * remove it again.
 *
 * An AI is not small: it holds the format's usage statistics, and those were a
 * new copy for nearly every game. Measured with six people playing the bots
 * back to back, the process holding the bots grew by a megabyte or two a game
 * and hit its 160MB ceiling in about seventy seconds - which is a crash, and on
 * the host a restart that drops every battle in progress. A server that is
 * merely busy for an evening gets there too, only slower.
 *
 * So a finished room is remembered, and lines for it are ignored until the
 * server says the bot is out of it. Room ids are never reused within a boot, and
 * the list is trimmed in case a `deinit` never arrives.
 */
const ENDED_LIMIT = 500;

function forgetBattle(bot, roomid) {
	bot.battles.delete(roomid);
	bot.ended.add(roomid);
	if (bot.ended.size > ENDED_LIMIT) bot.ended.delete(bot.ended.values().next().value);
}

function isEndedBattle(bot, roomid, parts) {
	if (!bot.ended.has(roomid)) return false;
	if (parts[0] === 'deinit') bot.ended.delete(roomid);
	return true;
}

module.exports = { ShowdownBot, forgetBattle, isEndedBattle };
