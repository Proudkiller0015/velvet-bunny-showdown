'use strict';
/**
 * Pokemon Showdown server configuration for the Velvet Bunny battle server.
 *
 * This file is copied into node_modules/pokemon-showdown/config/config.js by
 * scripts/setup-config.js before the server boots, because that is the only
 * place Showdown looks. Edit it here - the copy is generated and disposable.
 *
 * It starts from Showdown's own config-example so that everything we do not
 * care about (group lists, room defaults, chat filters) keeps working, and then
 * changes only what this server actually needs.
 */

Object.assign(exports, require('./config-example.js'));

/**
 * Ranks: Owner, Admin, Bot.
 *
 * Showdown ships one global rank above room staff - '~', labelled
 * Administrator - and nothing above it, so out of the box the people who own
 * the server, anyone helping them run it, and the bot all end up wearing the
 * same symbol. That is three different jobs under one title.
 *
 * '~' is relabelled Owner and kept for the two accounts that actually own the
 * place. A global Admin is added under it: everything a moderator can do across
 * every room, plus the room and HTML permissions staff need, but not the
 * console, the lockdown or the ability to promote another Owner - those stay
 * with the owners. The bot sits on '*', the rank that exists for bots.
 */
/**
 * Ranks are Showdown's own, unchanged.
 *
 * This server briefly had a relabelled '~' and an invented '&' sitting under
 * it, which was wrong twice over: the rename only changed what the same rank
 * was called, and '&' is not a rank this version has at all, so it meant
 * nothing to the client and carried whatever permissions it was handed.
 *
 * What Showdown actually offers globally is '~' Administrator, then '@'
 * Moderator, '%' Driver, '*' Bot and '+' Voice. '#' Room Owner and '\u2605' Host
 * are room ranks and cannot be held globally. '~' is the top - console,
 * bypasses everything, and the only rank that can promote another - so it is
 * the owner rank whatever it is called, and it is left called Administrator
 * because that is what it is.
 */
exports.grouplist = exports.grouplist.map(group => ({ ...group }));

/**
 * The bot rank, with an administrator's reach.
 *
 * An account has exactly one rank in Showdown - there is no wearing two - so
 * 'the bot should be a bot and an administrator' has to be done by giving the
 * bot rank the powers rather than the bot a second symbol. It keeps '*', which
 * is what tells everyone it is a bot, and inherits '~', which is what lets it
 * do the job.
 *
 * Worth knowing what this rests on: '*' is only ever handed out by the config
 * below, to the bot's own accounts. It is the same assumption every rank here
 * already makes - that nobody takes somebody else's name - which is what a
 * server with no login server is.
 */
const botGroup = exports.grouplist.find(g => g.symbol === '*');
if (botGroup) {
	botGroup.inherit = '~';
	botGroup.editroom = true;   // a room intro is an edit to the room
}

/**
 * Owner, above Administrator.
 *
 * Showdown has no rank above '~' - on the main server the person who wrote it
 * holds '~' like everyone else at the top, and the thing named after him in the
 * source is `isSysop`, which is a support backdoor into other people's servers
 * rather than a rank, and is switched off here. A server with an owner and
 * staff under them has to define the tier itself, which is what side servers do.
 *
 * Defined rather than relabelled, which was the mistake the first time round:
 * it has its own symbol, it inherits '~' so it genuinely holds everything
 * Administrator holds, and it sits at the top of the list, which is what
 * Showdown reads rank order from. '&' because it is the symbol Showdown itself
 * used for the rank above moderator for years, so clients already know it.
 */
if (!exports.grouplist.some(g => g.symbol === '&')) {
	exports.grouplist.unshift({
		symbol: '&',
		id: 'owner',
		name: 'Owner',
		inherit: '~',          // everything Administrator can do, and then the list below
		jurisdiction: 'u',
		globalonly: true,

		// The only powers worth spelling out separately: an owner may promote
		// anyone, including another owner, and may demote an administrator. '~'
		// stops at promoting up to '~'.
		promote: '&~\u2605@*%+u',
		bypassall: true,
		console: true,
		lockdown: true,
	});
}

// Render and most hosts hand the port in through the environment.
exports.port = Number(process.env.PORT) || 8000;

/**
 * The address players actually reach this server on.
 *
 * Needed because anything this server puts in chat is rendered inside the
 * *client*, which is served from another domain entirely. A root-relative
 * '/avatars/x.png' resolves against the client, where nothing of ours exists, so
 * the images simply fail to load - which is exactly how the avatar list came out.
 * The client has the same problem and solves it the same way, building an
 * absolute URL from the server it is connected to.
 *
 * Render publishes the external address in the environment, so on the real host
 * this configures itself; the fallback is only for running it locally.
 */
// The real host is the last resort rather than the first: if the environment
// ever stops carrying the external address, falling back to localhost would
// break the images on the live server - the very fault this exists to fix -
// while falling back to the live host only means a local run shows the live
// avatars. Set PS_PUBLIC_URL to point a local run at itself.
exports.publicurl = String(
	process.env.RENDER_EXTERNAL_URL ||
	process.env.PS_PUBLIC_URL ||
	'https://velvet-bunny-showdown.onrender.com'
).replace(/\/+$/, '');
/**
 * Replays are served from here, not from Smogon.
 *
 * Their replay server only accepts uploads from servers registered with them -
 * an unregistered one gets "This server's request IP is not a registered
 * server" and the replay is lost. Pointing the route at this server means the
 * link a player is handed is one this server can actually answer; what happens
 * behind it is in src/replay-store.js.
 */
exports.routes = {
	...exports.routes,
	replays: `${exports.publicurl.replace(/^https?:\/\//, '')}/replay`,
};

exports.bindaddress = '0.0.0.0';
// Battles run in the main process. Each battle subprocess costs ~80MB, which
// on a 512MB free tier is the difference between booting and being OOM-killed.
// A casual server with a handful of concurrent battles does not need them.
/*
 * Every kind of helper process, and how many of each.
 *
 * A plain `0` here is the shorthand for "none of anything", and it is spelled
 * out instead because one of them has to be 1: the friends database is queried
 * through a process manager, and a process manager with nothing to ask answers
 * null - which reads as a friends system that takes a request, says all the
 * right things to both players, and stores nothing. Found exactly that way,
 * before it was ever deployed.
 *
 * The list is Showdown's own `processTypes`. It is written out rather than
 * spread over a `0` because handing this setting an object means every key it
 * does not mention falls back to that subsystem's own default, which is
 * usually one process each - the opposite of what a 512MB tier wants.
 */
const NO_SUBPROCESSES = {
	localartemis: 0, remoteartemis: 0, battlesearch: 0, datasearch: 0,
	friends: 0, chatdb: 0, pm: 0, modlog: 0,
	network: 0, simulator: 0, validator: 0, verifier: 0,
};

/**
 * Friends: off unless asked for, because it is not free.
 *
 * The system itself is Showdown's and it works - see the note further down -
 * but it wants a child process, and a child process measured at 51MB on a
 * service with 512MB for everything. This server has already given up battle
 * subprocesses for less.
 *
 * So it is opt-in rather than opt-out: deploying this changes nothing until
 * PS_FRIENDS=1 is set on the host, which means the decision is made after
 * looking at /velvet/health.json rather than by whoever deploys next. Turning
 * it on and off again costs a restart and no code.
 */
// And only where SQLite will not crash the process: on Node 20 it is a
// segmentation fault rather than an error - see sqliteUsable() in
// src/friends-store.js - so a host on the wrong Node goes without friends.
const FRIENDS = process.env.PS_FRIENDS === '1' && (() => {
	const usable = require('../../../src/friends-store').sqliteUsable();
	if (!usable) console.log(`[config] PS_FRIENDS=1 but Node ${process.version} cannot run better-sqlite3; friends stay off`);
	return usable;
})();
/*
 * And no child for it either, unless PS_FRIENDS_PROCESS=1 asks for the old way.
 *
 * The 51MB was never the database - the file is tens of kilobytes - it was a
 * whole second Node runtime whose only job was to hold it open and answer the
 * odd query about who is online. better-sqlite3 answers those in microseconds,
 * so they are answered in this process instead: see friendsInProcess() below,
 * which opens the same file with Showdown's own schema and statements and routes
 * the same queries to them. On a 512MB container that was running at 97%, a
 * process spent keeping one small file open was the cheapest thing to give up.
 */
const FRIENDS_CHILD = FRIENDS && process.env.PS_FRIENDS_PROCESS === '1';
exports.subprocesses = Number(process.env.PS_SUBPROCESSES || 0) ?
	Number(process.env.PS_SUBPROCESSES) :
	{ ...NO_SUBPROCESSES, friends: FRIENDS_CHILD ? 1 : 0 };

/**
 * Accounts: real Pokemon Showdown ones.
 *
 * There is no account database here and nothing registered with Smogon. The
 * official login server does the proving and this server checks its work: it
 * issues a challstr, the login server signs an assertion binding that challstr
 * to a userid, and the signature is verified against Showdown's public key,
 * which ships in their own config. An assertion names one account and one
 * challstr, so it is worth nothing anywhere else.
 *
 * Names mean something because of that. A rank or an avatar belongs to an
 * account rather than to whoever typed the name first, registering is real
 * registration on Pokemon Showdown, and someone who has not registered still
 * gets a name - the login server signs an assertion for unregistered userids
 * too, marked as such, so they appear exactly as unregistered players do on
 * the official client.
 *
 * Where the password goes depends on which address the client came from, and
 * the difference is worth knowing:
 *
 *   - on the psim.us address the client is served by Showdown, so it asks its
 *     own origin and nothing to do with logging in ever touches this server
 *   - on our own domain, which is where the bot panel and Samantha live, their
 *     crossdomain handshake returns nothing for our hostname and their login
 *     server sends no CORS headers, so the browser cannot reach them at all;
 *     src/http-hooks.js forwards that one request, which means a password
 *     typed there passes through this process on its way to Showdown
 *
 * PS_REAL_ACCOUNTS=0 goes back to the old behaviour - any name, no proof, no
 * login server - which is worth having for local testing without an account.
 */
const realAccounts = process.env.PS_REAL_ACCOUNTS !== '0';
// The HTTP hooks carry more than the login relay now - health, replays, the
// RP encounter endpoint - so they go in either way. `loginserver` and the key
// it is checked against are inherited from Showdown's own config.
require('../../../src/http-hooks').installHttpHooks(msg => console.log('[login]', msg));
if (!realAccounts) {
	// Open server: anyone picks a name and plays immediately, and nobody's name
	// is proof of anything.
	exports.noguestsecurity = true;
	exports.loginserver = '';
}
/**
 * Friends, and what they cost.
 *
 * Showdown has a whole friends system - requests, a list, "so-and-so just came
 * online", a page in the client - and it is switched off by default because it
 * wants a database. Switching it on is these two lines plus better-sqlite3,
 * which ships prebuilt and needs no compiler.
 *
 * The cost used to be a child process: the database is queried through a
 * process manager, and with no child to query the whole system silently answers
 * null. That was measured at 51MB, which is why it is a switch. It now runs in
 * this process instead (FRIENDS_CHILD above, friendsInProcess() below), so the
 * switch costs a few megabytes rather than a runtime. PS_FRIENDS=1 on the host
 * is still the whole switch; see FRIENDS above.
 *
 * The rank is the floor for using it at all: a space means everybody. Being
 * autoconfirmed is checked separately by Showdown itself and cannot be turned
 * off from here, which on this server means registered and having won a rated
 * game - the ladder queues are rated, so beating a bot is enough.
 *
 * The database lives on a disk this host wipes on every restart, so
 * src/friends-store.js keeps it in the repository the same way the ladder and
 * the replays are kept.
 */
exports.usesqlite = FRIENDS;
exports.usesqlitefriends = ' ';

exports.serverid = process.env.PS_SERVERID || 'velvetbunny';
exports.servertoken = '';

// Every battle is announced in the lobby and in the logs room. The lobby is
// where people see them; the logs room is where they are kept - see battleLog()
// below, which also writes them somewhere a restart cannot reach.
exports.reportbattles = ['lobby', 'logs'];

// Quieter, and nothing written that a free host would only throw away.
exports.loglevel = 2;
exports.logchat = false;
exports.logchallenges = false;
exports.loguserstats = 0;
exports.crashguardemail = null;
exports.repl = false;
exports.backdoor = false;
exports.watchconfig = false;

// Custom avatars are NOT configured here. Showdown reads config/avatars.json
// now and crash-logs on every boot if `customavatars` is still set, so the
// rights are written straight to that file by scripts/setup-config.js. The
// images live in avatars/ here and are copied into the package before boot;
// the client fetches them from this server at /avatars/<file>.

// One bot answering every challenge: rate limits only get in its way.
exports.nothrottle = true;
exports.noipchecks = true;

/**
 * Give the bot the rank it needs to post the difficulty picker as an HTML box.
 *
 * It cannot simply be listed in usergroups.csv: with no login server the bot
 * signs in as a guest, and guest login is refused for any account the server
 * considers trusted - which being in usergroups.csv would make it. Promoting it
 * after it connects sidesteps that, and because the account is unregistered
 * setGroup does not write the rank back to disk, so the next login still works.
 */
/**
 * Which rung each player has asked for, and the accounts that play them.
 *
 * This is the difference between a difficulty picker and a difficulty. Picking
 * one used to tell the *bot process* what to play as, which worked for a direct
 * challenge and did nothing at all on the ladder: the ladder queues each play a
 * fixed rung, and the server handed you whichever one was nearest your rating.
 * So you could click Stockfish and be sent to Normal, which is the one thing the
 * picker exists to prevent.
 *
 * Showdown loads the config as a chat plugin, so the command below lives here,
 * next to the matchmaking that has to honour it.
 */
const { botAccountIds, botDifficulties, toId: queueId } = require('../../../src/queue-names');

/*
 * The defaults come from src/ladder-defaults.js, not from a copy written out
 * here, and that is the whole point of that file existing.
 *
 * This list decides which accounts may claim their name without one - see
 * exemptBots() below - so a queue missing from it cannot log in at all. When
 * RP Random Battle was added to the ladder, this copy still said
 * 'gen9randombattle' and nothing else, so the server had never heard of the
 * five RP queues: they connected, asked for their names, were refused, and
 * spent their lives as Guest 7 while the five Random Battle rungs beside them
 * worked perfectly. Two lists of the same thing, one of them stale.
 */
const { ladderQueues } = require('../../../src/ladder-defaults');

const BOT_BASE = process.env.PS_BOT_NAME || 'Velvet Bunny';
// Straight from the module the queues are built by, rather than worked out
// again here. These two lists disagreeing is not hypothetical: it is how the
// matchmaking rules once applied to nobody.
const BOT_QUEUES = ladderQueues(BOT_BASE);
const BOT_DIFFICULTIES = [...new Set(BOT_QUEUES.map(queue => queue.difficulty))];

const BOT_IDS = botAccountIds(BOT_BASE, BOT_QUEUES);
const BOT_RUNG = botDifficulties(BOT_BASE, BOT_QUEUES);

/* The top three of a ladder wear it: in the ladder tab, on /rank and beside their name. */
const MEDALS = ['🥇 ', '🥈 ', '🥉 '];
/** userid -> the rung they want to be matched against, or PVP for no bots. */
const wantedRung = new Map();

/*
 * The guest book, made once and written out on a timer.
 *
 * Lazily, because this file is loaded by more than one process - the config is
 * read wherever Showdown needs it - and only the one that actually sees people
 * arrive has any reason to open it.
 *
 * Written on a timer rather than on every arrival: a login is a bad moment to
 * be doing file writes, and the wrapper process that commits this to the
 * repository is on a clock of its own anyway. On the way out it is flushed once
 * more, so the last arrival before a restart is not the one that gets lost.
 */
/**
 * The guest book as a table, for whoever is asking.
 *
 * Written once and used twice - the chat command and the page in the client -
 * because two copies of a table are two tables that drift apart. Returns the
 * HTML, or `{ error }` for the caller to raise in whichever way suits it.
 */
function velvetVisitorTable(target, limit) {
	const rows = velvetRoster().all();
	if (!rows.length) return `<b>Everyone who has been here</b><br/>Nobody has been written down yet.`;

	const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const wanted = toID(target);
	const shown = wanted ? rows.filter(row => row.id.includes(wanted)) : rows;
	if (!shown.length) return { error: `Nobody here matches "${target}".` };

	// A day is the useful unit: "who came by this week" rather than a timestamp
	// nobody reads.
	const when = stamp => {
		const then = new Date(stamp);
		if (isNaN(then)) return '?';
		const days = Math.floor((Date.now() - then.getTime()) / 86400000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days} days ago`;
		return then.toISOString().slice(0, 10);
	};

	const table = shown.slice(0, limit).map(row => {
		const here = Users.get(row.id);
		const online = here && here.connected ? ' <small style="color:#3a3">online</small>' : '';
		return `<tr><td style="padding:2px 8px">${esc(row.name)}${online}</td>` +
			`<td style="padding:2px 8px">${when(row.last)}</td>` +
			`<td style="padding:2px 8px">${when(row.first)}</td>` +
			`<td style="padding:2px 8px;text-align:right">${row.visits}</td></tr>`;
	}).join('');

	return `<b>Everyone who has been here</b> &mdash; ${shown.length}` +
		(wanted ? ` matching <code>${esc(target)}</code>` : ` account(s)`) + `<br/>` +
		`<table style="border-collapse:collapse">` +
		`<tr><th style="padding:2px 8px;text-align:left">Name</th>` +
		`<th style="padding:2px 8px;text-align:left">Last seen</th>` +
		`<th style="padding:2px 8px;text-align:left">First seen</th>` +
		`<th style="padding:2px 8px;text-align:right">Visits</th></tr>${table}</table>` +
		(shown.length > limit ? `<small>Showing the ${limit} most recent. Add a name to narrow it.</small>` : '');
}

/**
 * And the same thing as a panel, which is where it belongs.
 *
 * A reply box is a message in a room: it scrolls away, it cannot be reopened,
 * and a hundred names in one is unreadable. A page opens beside the rooms list
 * like the ladder does, stays there, and can hold the whole list.
 *
 * Gated the same way as the command. `checkCan` works here too - a page has the
 * same context - so there is one rule about who may see this, not two.
 */
exports.pages = {
	players(query, user, connection) {
		this.checkCan('bypassall');
		const html = velvetVisitorTable((query || []).join('-'), 500);
		if (typeof html !== 'string') throw new Chat.ErrorMessage(html.error);
		this.title = '[Guest book]';
		return `<div class="pad">${html}</div>`;
	},
};

let roster = null;
function velvetRoster() {
	if (roster) return roster;
	const { Roster } = require('../../../src/roster');
	roster = new Roster();
	roster.load();
	const timer = setInterval(() => roster.flush(), Number(process.env.PS_ROSTER_FLUSH_MS || 60000));
	if (timer.unref) timer.unref();
	for (const signal of ['SIGTERM', 'SIGINT']) {
		process.once(signal, () => { try { roster.flush(); } catch (e) {} });
	}
	return roster;
}
// Not a difficulty, so it can never match one: it is the absence of them.
const PVP = 'pvp';

const aOrAnName = name => (/^([AEIOU]|X )/i.test(name) ? `an ${name}` : `a ${name}`);

/**
 * The in-battle medicine panel: one button per item per Pokémon it can help,
 * rebuilt from each turn's request. It used to be a form with a typed Pokémon
 * name, which the client replaces with "Submitted!" after one use and which
 * failed silently on any typo, so players never got a Potion to work.
 */
function itemPanel(bag, team, active, beenIn) {
	const E = require('../../../src/encounters');
	const esc = s => String(s).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
	let activeIndex = 0;
	const mons = (team || []).map(p => {
		const cond = String(p.condition || '');
		const [hp, max] = cond.split(' ')[0].split('/').map(Number);
		const name = String(p.ident || '').replace(/^p\d+[a-z]?:\s*/, '');
		// Which of the request's active entries is this Pokémon's (doubles have two).
		const moves = p.active ? ((active || [])[activeIndex++] || {}).moves : null;
		return {
			name,
			active: !!p.active,
			fainted: / fnt$/.test(cond) || hp === 0,
			hurt: hp < max,
			status: (cond.match(/\s(brn|par|slp|frz|psn|tox)$/) || [])[1] || '',
			// PP: the request has it for the Pokémon out; one on the bench can only have used PP if it has been in.
			ppUsed: p.active ? !!(moves || []).some(mv => mv.maxpp && mv.pp < mv.maxpp) : !!(beenIn && beenIn.has(name)),
		};
	});
	const rows = [];
	const idle = [];
	for (const [id, n] of bag) {
		const item = E.findBattleItem(id);
		if (!item) continue;
		const helps = mons.filter(m => E.itemHelps(item, m));
		if (!helps.length) { idle.push(`${item.name} (${n})`); continue; }
		const buttons = helps.map(m => `<button class="button" name="send" value="/useitem ${item.id}, ${esc(m.name)}">${esc(m.name)}</button>`).join(' ');
		rows.push(`<div>${item.name} <small>(${n})</small>: ${buttons}</div>`);
	}
	if (!rows.length && !idle.length) return '';
	return `<div class="infobox" style="margin:4px 0"><b>Use an item</b> <small>(click the Pokémon; it uses your whole turn, so don't pick a move after)</small>` +
		(rows.length ? rows.join('') : '<div><small>Nothing in your bag would help right now.</small></div>') +
		(idle.length && idle.length <= 12 ? `<div><small style="opacity:.7">Not needed right now: ${idle.join(', ')}</small></div>` : '') + '</div>';
}

exports.commands = {
	/**
	 * Use a battle item (Potion, Revive...) from the character's bag in an RP
	 * encounter. Sent by the item panel.
	 */
	useitem(target, room, user) {
		room = this.requireRoom();
		const game = room.battle;
		if (!game || !/^gen\d+rp/.test(game.format)) throw new Chat.ErrorMessage('Items can only be used in RP battles.');
		if (!game.playerTable[user.id]) throw new Chat.ErrorMessage("You're watching this battle, not in it.");
		const E = require('../../../src/encounters');
		const rp = require('../../../src/rp-server');
		const [itemName, ...who] = String(target || '').split(',');
		const item = E.findBattleItem(itemName);
		const pokemon = who.join(',').trim();
		if (!item) throw new Chat.ErrorMessage(`There's no battle item called "${itemName}". Use the Bag under your moves: it only shows items that would help.`);
		if (!pokemon) throw new Chat.ErrorMessage('Which Pokémon? Type its name in the box.');
		const enc = game.rpEncounter && rp.encounters.get(game.rpEncounter);
		const used = rp.usedInLog(room.log.log, user.name, item.name);
		let allowed;
		if (enc && enc.userid === user.id) {
			allowed = rp.canUseItem(enc, item.id, used);
		} else if (RP_PVP_FORMATS.has(game.format) && !game.rpEncounter) {
			// A battle between players: the character's bag, or 5 of each for an NPC.
			allowed = rp.canUsePvpItem(user.id, item.id, used);
		} else if (game.format === 'gen9rpcustomgame') {
			// Anything goes: every item, as many as you like, and no bag is touched.
			allowed = { ok: true, left: 'unlimited' };
		} else {
			throw new Chat.ErrorMessage('Items can only be used in RP battles.');
		}
		if (!allowed.ok) throw new Chat.ErrorMessage(allowed.message);
		game.rpItemFrom = user.id;
		try {
			game.choose(user, `item ${item.id} ${pokemon}`);
		} finally {
			game.rpItemFrom = null;
		}
		const player = game.playerTable[user.id];
		if (player && player.request && player.request.isWait) {
			this.sendReply(`|raw|<small>Using ${aOrAnName(item.name)} on ${Chat.escapeHTML(pokemon)} (${allowed.left} left after this). Don't pick a move now, or it replaces the item.</small>`);
		}
	},
	/**
	 * The tutorial battle, for anyone, from here: a Lv. 5 Rattata challenges you
	 * and your team is a Lv. 5 Pikachu with 1 Potion and 1 Poke Ball. No team or
	 * Discord link needed, and nothing is recorded.
	 */
	tutorial(target, room, user) {
		if (!tutorialDeps) throw new Chat.ErrorMessage('The tutorial is still starting up. Try again in a minute.');
		const rp = require('../../../src/rp-server');
		const answer = rp.requestTutorial({ showdown: user.name }, tutorialDeps);
		if (!answer.ok) throw new Chat.ErrorMessage(String(answer.message || 'The tutorial could not start.').replace(/\*\*/g, ''));
		this.sendReply('A wild Rattata is about to challenge you. Click Accept (no team needed): you battle with a Lv. 5 Pikachu, 1 Potion and 1 Pokéball. Throw it and use the Potion from the Bag under your moves. Nothing counts, so try everything.');
	},
	/*
	 * The RP Guide saying it can't take an encounter right now (src/rp-bot.js,
	 * MAX_LIVE). Only the guide's own account, from this machine, is listened
	 * to; for anybody else it is a command that does nothing. Hidden: no help.
	 */
	rpbusy(target, room, user) {
		if (user.id !== toID(RP_BOT) || !isRpBot(user)) return;
		rpBusy(toID(target));
	},
	tutorialhelp: ['/tutorial - A practice wild battle: a Lv. 5 Pikachu with 1 Potion and 1 Pokéball against a Lv. 5 Rattata. Nothing is recorded.'],

	useitemhelp: ["/useitem [item], [pokemon] - In any RP battle, use an item from your character's bag instead of attacking: Potions, status heals, Revives (on a benched Pokémon), Ethers, X items... The item panel's buttons do this for you. NPCs have 5 of each; RP Custom Game is unlimited."],

	/**
	 * Throw a ball in an RP wild encounter. Sent by the buttons the battle
	 * posts; typing it works too.
	 */
	throwball(target, room, user) {
		room = this.requireRoom();
		const game = room.battle;
		if (!game || !RP_FORMATS.has(game.format)) {
			throw new Chat.ErrorMessage('You can only throw a ball in an RP wild encounter.');
		}
		if (!game.playerTable[user.id]) throw new Chat.ErrorMessage("You're watching this battle, not in it.");
		const E = require('../../../src/encounters');
		const rp = require('../../../src/rp-server');
		const ball = E.findBall(target || 'poke');
		if (!ball) throw new Chat.ErrorMessage(`There's no ball called "${target}".`);

		const enc = game.rpEncounter && rp.encounters.get(game.rpEncounter);
		const thrown = rp.thrownInLog(room.log.log, user.name, ball.name);
		const allowed = rp.canThrow(enc, ball.id, thrown);
		if (!allowed.ok) throw new Chat.ErrorMessage(allowed.message);

		game.rpBallFrom = user.id;
		// A trainer's first few catches land (src/rp-server.js freeCatch). Nothing is said.
		const wildSpecies = enc && Array.isArray(enc.team) && enc.team.length ? enc.team[0].species : null;
		const sure = rp.freeCatch(enc, wildSpecies) ? ' sure' : '';
		// A legendary the owner has unlocked for this one encounter (rp-server allowCatch).
		const allow = enc && enc.catchable ? ' allow' : '';
		try {
			game.choose(user, `ball ${ball.id}${sure}${allow}`);
		} finally {
			game.rpBallFrom = null;
		}
		const player = game.playerTable[user.id];
		if (player && player.request && player.request.isWait) {
			const left = allowed.left === undefined ? '' : ` (${allowed.left} left after this one)`;
			this.sendReply(`|raw|<small>Throwing ${ball.name}${left}. Don't pick a move now, or it replaces the throw.</small>`);
		}
	},
	throwballhelp: ['/throwball [ball] - In an RP wild encounter, throw a ball instead of attacking this turn.'],

	flee: 'run',
	escape: 'run',
	/**
	 * Run from a wild Pokémon (Patch 1.4). Your Speed against its Speed, every
	 * failed try making the next one likelier; a Poké Doll in the bag skips all
	 * of that. Trainers and legendaries are not escapable.
	 */
	run(target, room, user) {
		room = this.requireRoom();
		const game = room.battle;
		// A trainer battle (and a battle with another player, which uses the same
		// formats) is a person standing in front of you: the RP settles it.
		if (game && RP_PVP_FORMATS.has(game.format)) {
			throw new Chat.ErrorMessage("You can't run from a trainer - that battle is settled in the RP.");
		}
		if (!game || !RP_FORMATS.has(game.format)) {
			throw new Chat.ErrorMessage('You can only run in an RP wild encounter.');
		}
		if (!game.playerTable[user.id]) throw new Chat.ErrorMessage("You're watching this battle, not in it.");
		const E = require('../../../src/encounters');
		const item = target ? E.findBattleItem(target) : null;
		if (target && (!item || !item.escape)) throw new Chat.ErrorMessage(`"${target}" doesn't get you out of a battle. Try a Poké Doll.`);
		// An escape item comes out of the character's bag, like any other item.
		if (item) {
			const rp = require('../../../src/rp-server');
			const enc = game.rpEncounter && rp.encounters.get(game.rpEncounter);
			const used = rp.usedInLog(room.log.log, user.name, item.name);
			const allowed = enc && enc.userid === user.id ? rp.canUseItem(enc, item.id, used)
				: game.format === 'gen9rpcustomgame' ? { ok: true } : { ok: false, message: 'Escape items come from an !encounter bag.' };
			if (!allowed.ok) throw new Chat.ErrorMessage(allowed.message);
		}
		game.choose(user, `run ${item ? item.id : ''}`.trim());
	},
	runhelp: ['/run - In an RP wild encounter, try to get away instead of attacking this turn. /run pokedoll uses a Poké Doll.'],

	rp: 'roleplay',
	encounter: 'roleplay',
	roleplay(target, room, user) {
		this.runBroadcast();
		return this.sendReplyBox(roleplayIntro());
	},
	roleplayhelp: ['/roleplay - How RP battles work: names, the RP team, encounters and catching.'],

	botdifficulty: 'bot',
	difficulty: 'bot',
	bot(target, room, user) {
		const choice = toID(target);
		const names = BOT_DIFFICULTIES.slice();

		if (!choice) {
			const current = wantedRung.get(user.id);
			const pick = (value, text) => {
				const on = value === current;
				return `<button class="button${on ? ' disabled' : ''}" name="send" value="/bot ${value}">` +
					`${on ? '<b>' : ''}${text}${on ? '</b>' : ''}</button>`;
			};
			const buttons = names.map(name => pick(name, name.charAt(0).toUpperCase() + name.slice(1))).join(' ');
			const now = current === PVP ? 'players only - no bots'
				: current ? `<b>${current}</b>`
				: 'whoever is closest to your rating';
			return this.sendReplyBox(
				`<b>Who do you want to play?</b><br/>${buttons}<br/>` +
				`<div style="margin-top:4px">${pick(PVP, 'Players only')} ${pick('anyone', 'Anyone')}</div>` +
				`<small>Then hit <b>Battle!</b>. Currently ${now}.<br/>` +
				`<b>Players only</b> keeps you out of every bot's queue, so you will wait for a real opponent.</small>`
			);
		}

		if (choice === 'anyone' || choice === 'any' || choice === 'off') {
			wantedRung.delete(user.id);
			return this.sendReply('You will be matched with whichever bot is closest to your rating.');
		}
		if (choice === PVP || choice === 'players' || choice === 'human' || choice === 'humans' || choice === 'none' || choice === 'nobots') {
			wantedRung.set(user.id, PVP);
			return this.sendReply('Players only. The bots will leave you alone - you will wait for a real opponent.');
		}
		if (!names.includes(choice)) {
			throw new Chat.ErrorMessage(`No such difficulty. Pick one of: ${names.join(', ')}, or "pvp" for players only.`);
		}
		wantedRung.set(user.id, choice);
		this.sendReply(`Set to ${choice}. Hit Battle! and you will be matched with that one - it may take a moment if it is already in a game.`);
		// Keep the bot's own preference in step, so a direct challenge plays the
		// same rung as the ladder would. Sent as the user, which is how they would
		// have set it themselves.
		this.parse(`/msg ${BOT_BASE}, difficulty ${choice}`);
	},
	/*
	 * `/rank` is deliberately NOT an alias for this.
	 *
	 * It was, and it took the one command a player has for "how am I doing on the
	 * ladder" and gave it to a staff command nobody needs an alias for - there is
	 * a command per rank already. Showdown's own /rank (its Elo, wins and losses
	 * per format) is left alone; staff type /setrank, which is what it is called.
	 */
	/**
	 * Give somebody a rank, and remember it.
	 *
	 * /globalpromote cannot be used here: it refuses an unregistered account, and
	 * with no login server every account is unregistered, so there was no way to
	 * promote anyone in chat at all. Showdown's own promotion would not have
	 * survived the session either - setGroup only writes a rank down for a
	 * registered user.
	 */
	setrank(target, room, user) {
		this.checkCan('bypassall');   // owner and administrator only
		const [rawName, rawSymbol] = String(target || '').split(',').map(part => part.trim());
		if (!rawName || !rawSymbol) return this.parse('/help setrank');

		const id = toID(rawName);
		if (!id) throw new Chat.ErrorMessage('Who?');

		// Accept the symbol or the name of the rank, since nobody remembers which
		// squiggle is which.
		const wanted = rawSymbol.toLowerCase();
		const group = exports.grouplist.find(g =>
			g.symbol === rawSymbol || String(g.id).toLowerCase() === wanted || String(g.name).toLowerCase() === wanted);
		const clearing = ['none', 'reset', 'remove', 'user', 'regular'].includes(wanted);
		if (!group && !clearing) {
			const offered = exports.grouplist.filter(g => !g.roomonly && g.id && g.name)
				.map(g => `${g.symbol} ${g.name}`).join(', ');
			throw new Chat.ErrorMessage(`No such rank. Try one of: ${offered}, or "none".`);
		}
		if (group && group.roomonly) {
			throw new Chat.ErrorMessage(`${group.name} is a room rank - use /roomauth in the room instead.`);
		}

		// Nobody hands out a rank they do not hold themselves.
		// Compare the symbols directly. The Auth instance looks a user up in the
		// global auth map, which only holds registered accounts - nobody here is
		// registered, so it reads every rank back as a regular user, including the
		// owner's. What everyone actually holds is tempGroup.
		if (group && !Users.Auth.atLeast(user.tempGroup, group.symbol)) {
			throw new Chat.ErrorMessage(`You cannot give out ${group.name}; it is above your own rank.`);
		}

		const symbol = clearing ? Users.Auth.defaultSymbol() : group.symbol;
		if (clearing) delete savedRanks[id];
		else savedRanks[id] = symbol;
		saveRanks(savedRanks);
		lastApplied.set(id, symbol);

		const online = Users.get(id);
		if (online && online.connected) {
			online.setGroup(symbol);
			try { online.updateIdentity(); online.update(); } catch (e) { /* on their way out */ }
		}

		const what = clearing ? 'a regular user' : `${symbol} ${group.name}`;
		this.addModAction(`${user.name} set ${id} to ${what}.`);
		this.modlog('SETRANK', id, what);
		this.sendReply(`${id} is ${what}${online && online.connected ? '' : ', and will be when they next connect'}. This is remembered across restarts.`);
	},
	setrankhelp: [
		`/setrank [username], [rank] - give someone a global rank that survives restarts.`,
		`Rank can be the symbol or the name, eg "@" or "moderator". /setrank [username], none removes it.`,
		`Requires: & ~`,
	],
	customavatars: 'avatarlist',
	avatars2: 'avatarlist',
	/**
	 * Every custom avatar on the server and who wears it.
	 *
	 * Showdown's own /avatars only ever answers for one account, which is no help
	 * at all when the question is what the server has. This reads the directory
	 * rather than the rights file, so an avatar that has been built and granted to
	 * nobody still shows up - under nobody, which is the case worth being able to
	 * see.
	 */
	avatarlist(target, room, user) {
		this.runBroadcast();
		let files = [];
		try {
			files = require('fs').readdirSync('config/avatars').filter(f => /\.(png|gif|jpg|jpeg|webp)$/i.test(f));
		} catch (e) {
			throw new Chat.ErrorMessage('There is no avatar directory on this server.');
		}
		if (!files.length) return this.sendReplyBox('No custom avatars on this server yet.');

		// Who is entitled to each file. One avatar can belong to several accounts -
		// the bot's is worn by every ladder queue - so this is a list, not a name.
		const wearers = new Map(files.map(f => [f, []]));
		const rights = (Users.Avatars && Users.Avatars.avatars) || {};
		for (const [userid, entry] of Object.entries(rights)) {
			for (const file of (entry && entry.allowed) || []) {
				if (file && wearers.has(file)) wearers.get(file).push(userid);
			}
		}

		const esc = Chat.escapeHTML;
		const rows = files.sort().map(file => {
			const who = wearers.get(file);
			const applied = who.filter(id => {
				try { return Users.Avatars.getDefault(id) === file; } catch (e) { return false; }
			});
			const names = who.length
				? who.map(id => {
					const online = Users.get(id);
					const label = online && online.connected ? `<b>${esc(online.name)}</b>` : esc(id);
					// An avatar someone merely may wear is not the same as one they wear.
					return applied.includes(id) ? label : `${label} <small>(offered)</small>`;
				}).join(', ')
				: '<span style="color:#888">none</span>';
			return `<tr><td style="padding:3px 8px">` +
				`<img src="${Config.publicurl}/avatars/${encodeURIComponent(file)}" width="40" height="40" ` +
				`style="image-rendering:pixelated;vertical-align:middle" alt=""></td>` +
				`<td style="padding:3px 8px"><code>${esc(file)}</code></td>` +
				`<td style="padding:3px 8px">${names}</td></tr>`;
		}).join('');

		const spare = files.filter(f => !wearers.get(f).length).length;
		this.sendReplyBox(
			`<b>Custom avatars on this server</b> &mdash; ${files.length} ` +
			`(${spare} unassigned)<br/>` +
			`<table style="border-collapse:collapse">${rows}</table>` +
			`<small>Bold means they are wearing it; <i>offered</i> means they may switch to it ` +
			`with <code>/avatar [file]</code>.</small>`
		);
	},
	avatarlisthelp: [
		`/avatarlist - show every custom avatar on the server and who wears it.`,
	],

	bothelp: [
		`/bot - pick who the ladder should match you against.`,
		`/bot [difficulty] - always face that rung. /bot pvp - players only, no bots.`,
		`/bot anyone - go back to matching on rating.`,
	],

	players: 'visitors',
	guestbook: 'visitors',
	/**
	 * Everybody who has been here, not just who is here now.
	 *
	 * The count beside the client's user button is who is online this minute,
	 * which is the only answer this server could give to "who plays here" - and
	 * it is the wrong one for the person running it. Four people at midnight
	 * says nothing about the forty who came through during the day.
	 *
	 * Owner and administrators only, on the same check the rank command uses.
	 * It is a small private server and the list of who visits is theirs.
	 */
	/*
	 * `/rank`, with the numbers a local ladder can actually stand behind.
	 *
	 * Showdown's own /rank prints GXE and a Glicko-1 rating because the official
	 * ladder keeps them; this server's ladder is local and keeps Elo, wins and
	 * losses, so those columns came out empty and the table said less than the
	 * client's own ladder tab. This one adds what the numbers here do support:
	 * GXE (the share of games that Elo expects against an average 1500 player),
	 * the position on each ladder, and a bot's rating floor, which is why beating
	 * one is worth full points while its own rating does not move.
	 */
	rating: 'rank',
	async rank(target, room, user) {
		const name = String(target || user.name).trim();
		const id = toID(name);
		if (!id) return this.parse('/help rank');
		const { BOT_FLOORS } = require('../../../src/ladder-seed.js');
		// A bot's floor belongs to the rung it plays, not to its name.
		const floorOf = who => BOT_FLOORS[BOT_RUNG.get(who)];
		const rows = [];
		for (const format of Dex.formats.all()) {
			if (!format.searchShow) continue;
			let ladder = null;
			try { ladder = await new Ladders.LadderStore(format.id).getLadder(); } catch (e) { continue; }
			if (!ladder || !ladder.length) continue;
			const index = ladder.findIndex(row => toID(row[0]) === id);
			if (index < 0) continue;
			const row = ladder[index];
			const elo = Math.round(row[1]);
			// The share of games this Elo expects to win against an average player.
			const gxe = Math.round(100 / (1 + Math.pow(10, (1500 - elo) / 400)));
			const [w, l, t] = [row[3] || 0, row[4] || 0, row[5] || 0];
			const played = w + l + t;
			const floor = floorOf(id);
			rows.push(
				`<tr><td>${MEDALS[index] || ''}${Chat.escapeHTML(format.name)}</td>` +
				`<td><strong>${elo}</strong>${floor ? ` <small>(floor ${Math.round(floor)})</small>` : ''}</td>` +
				`<td>${gxe}%</td>` +
				`<td>#${index + 1}<small>/${ladder.length}</small></td>` +
				`<td>${w}</td><td>${l}</td><td>${played}</td></tr>`
			);
		}
		if (!rows.length) {
			return this.sendReplyBox(`<strong>${Chat.escapeHTML(name)}</strong> has not played a ladder game here yet.`);
		}
		this.sendReplyBox(
			`<div>User: <strong>${Chat.escapeHTML(name)}</strong></div>` +
			'<div style="overflow-x:auto"><table><tr>' +
			['Format', '<abbr title="Elo rating">Elo</abbr>', '<abbr title="Expected share of games won against an average 1500 player">GXE</abbr>', 'Rank', 'W', 'L', 'Total']
				.map(h => `<th>${h}</th>`).join('') + '</tr>' +
			rows.join('') + '</table></div>' +
			'<small>Elo is what the ladder pairs on. GXE here is what that Elo expects against a 1500 player - ' +
			'this server keeps its own ladder, so there is no Glicko deviation behind it. A bot never drops below its floor.</small>'
		);
	},
	rankhelp: [
		`/rank - your Elo, GXE, ladder position and record in every format you have played here.`,
		`/rank [user] - the same for somebody else.`,
	],

	visitors(target, room, user) {
		this.checkCan('bypassall');   // owner and administrator only
		const html = velvetVisitorTable(target, 100);
		if (typeof html !== 'string') throw new Chat.ErrorMessage(html.error);
		this.sendReplyBox(html +
			`<br/><small>A longer list, in its own panel: ` +
			`<button class="button" name="joinRoom" value="view-players">Open the guest book</button></small>`);
	},
	visitorshelp: [
		`/players - everyone who has ever been on this server, newest first. Owner and admin only.`,
		`/players [name] - only the accounts whose id contains that.`,
	],
};

/**
 * Write down who turns up.
 *
 * `loginfilter` rather than the rename handler, and the difference is the whole
 * bug: `onRename` runs *during* a rename, before the new name has settled, so a
 * handler there is handed a user who is still the guest they were a moment ago.
 * Everyone who logged in was written down as nobody. This one is called once
 * the rename has succeeded, which is the first moment the account exists, and
 * again on every reconnect - exactly what "last seen" wants.
 *
 * The bots are skipped. They are furniture - fifteen of them log in on every
 * boot - and a guest book of our own accounts is a guest book of nobody.
 */
exports.loginfilter = function (user, oldUser, usertype) {
	try {
		if (!user || !user.named) return;
		velvetRoster().see(user.id, user.name, { skip: id => BOT_IDS.has(id) });
	} catch (e) {
		// Never let the guest book break a login.
	}
};

/**
 * Make the ladder queue pair people sensibly.
 *
 * Two things were wrong with it, and they had the same cause.
 *
 * Showdown checks that two searchers are within a rating window of each other
 * before pairing them, and that window is the whole point of a ladder: it is
 * what makes the opponent you get mean something. But the check sits *after* an
 * early return for `noipchecks`, which this server sets so that the bot is not
 * refused for sharing a host with itself. So matchmaking never looked at rating
 * at all - it paired whoever happened to be queued. Searching got you a random
 * difficulty.
 *
 * And with a queue for every difficulty sitting in the same pool, the bots were
 * overwhelmingly each other's nearest searcher: five of every six battles on the
 * server were bot against bot. That burns a free tier's single CPU on games
 * nobody watches, and it moves the ratings around at random, which is the other
 * half of why the ladder meant nothing.
 *
 * So: bots never play each other, and the rating window is restored. The window
 * widens with how long the *newest* searcher has been waiting rather than the
 * oldest, because a bot waits indefinitely by design - measured from the oldest
 * it would be wide open within minutes of boot and we would be back to random.
 */
function fixMatchmaking(botIds) {
	// `Ladders` is a lookup function with properties hung off it, not the class -
	// so its prototype is empty and patching it silently did nothing. Take the
	// prototype from an actual instance, which does not care how it is exported.
	let proto = null;
	try { proto = Object.getPrototypeOf(Ladders('gen9randombattle')); } catch (e) { /* below */ }
	if (!proto || typeof proto.matchmakingOK !== 'function') {
		console.log('[config] could not reach matchmaking; leaving it alone');
		return;
	}
	if (proto.velvetMatchmaking) return;
	proto.velvetMatchmaking = true;

	proto.matchmakingOK = function (matches) {
		const users = matches.map(([, user]) => user);
		if (new Set(users).size !== users.length) return false;

		// The bots are here for people. Left to themselves they play each other
		// all day, and beat each other into meaningless ratings.
		if (users.every(user => botIds.has(user.id))) return false;

		// If someone picked a rung, give them that rung and nothing else. Rating
		// proximity is how you find a fair opponent when you have not asked for
		// one; it has no business overruling someone who has.
		const bots = users.filter(user => botIds.has(user.id));
		const asked = users
			.filter(user => !botIds.has(user.id))
			.map(user => wantedRung.get(user.id))
			.filter(rung => rung);
		// Players only: no bot may be in this game at all. Checked before the rest,
		// because it is a refusal rather than a preference - there is no rung that
		// would satisfy it.
		if (bots.length && asked.includes(PVP)) return false;

		if (bots.length && asked.length) {
			if (!bots.every(bot => asked.includes(BOT_RUNG.get(bot.id)))) return false;
			for (let i = 0; i < users.length; i++) users[i].lastMatch = users[(i + 1) % users.length].id;
			return true;
		}
		void queueId;

		// Rating proximity, which is what a ladder is. Same shape as Showdown's
		// own: a tight window that opens up the longer someone is left waiting.
		const times = matches.map(([search]) => search.time);
		const waiting = Date.now() - Math.max(...times);
		/*
		 * A bot and a player: no rating check at all. The bot was rung for this
		 * player (summonBots), its rating rests on a plateau well above a new
		 * player's 1000, and a window only meant waiting for it to open. The result
		 * is still rated. Between two players, Showdown's window as before.
		 */
		if (bots.length) {
			for (let i = 0; i < users.length; i++) users[i].lastMatch = users[(i + 1) % users.length].id;
			return true;
		}
		let range = toID(this.formatid) === `gen${Dex.gen}randombattle` ? 50 : 100;
		range += waiting / 300;
		if (range > 300) range = 300 + (range - 300) / 10;
		if (range > 600) range = 600;

		const ratings = matches.map(([search]) => search.rating);
		if (Math.max(...ratings) - Math.min(...ratings) > range) return false;

		// Showdown records this to avoid pairing the same two people twice in a
		// row. Here the bot is often the only opponent there is, so a rematch has
		// to stay allowed - it is recorded but not enforced.
		for (let i = 0; i < users.length; i++) users[i].lastMatch = users[(i + 1) % users.length].id;
		return true;
	};
	console.log('[config] matchmaking now goes by rating, and bots do not play each other');
}

/**
 * Ring the right bot when somebody is waiting.
 *
 * No rung sits in any queue. Every couple of seconds (and the moment anyone
 * presses Battle!) this looks at who is searching: a player with nobody to play
 * gets the rung they picked with /bot, or, if they did not pick one, the rung
 * whose measured strength is nearest their rating. That rung is sent
 * `|velvetsummon|<format>` and builds a team and searches (src/ladder.js). A bot
 * left searching a format nobody has waited in for a minute is sent
 * `|velvetunsummon|<format>` and drops out. So a format costs nothing until
 * somebody wants to play it, and every format works - OU included, which used to
 * wait forever because only four formats had bots sitting in them.
 */
function summonBots(botIds) {
	if (typeof Ladders === 'undefined' || !Ladders || !Ladders.searches) {
		console.log('[config] no ladder here; the bots will not be rung');
		return;
	}
	if (global.velvetSummonBots) return;
	global.velvetSummonBots = true;

	const { MEASURED } = require('../../../src/ladder-seed');
	const RUNG_ID = new Map();
	for (const [id, rung] of BOT_RUNG) RUNG_ID.set(rung, id);
	const online = id => { const u = Users.get(id); return u && u.connected ? u : null; };

	/*
	 * Each rung's actual rating in a format, looked up and kept for a minute.
	 * Ratings drift from the measured strength they were seeded at, and ringing a
	 * rung whose real rating is outside the player's window just means waiting
	 * for the window to open. Until a format's ratings have been read, the
	 * measured strengths stand in.
	 */
	const ratings = new Map();   // formatid -> { at, byRung: Map(rung -> rating) }
	const RATINGS_MS = 60000;
	const ratingsFor = formatid => {
		const cached = ratings.get(formatid);
		if (cached && (cached.byRung || Date.now() - cached.at < RATINGS_MS)) {
			if (cached.byRung && Date.now() - cached.at > RATINGS_MS && !cached.loading) load(formatid, cached);
			return cached.byRung;
		}
		load(formatid, cached || null);
		return null;
	};
	const load = (formatid, cached) => {
		const entry = cached || { at: Date.now(), byRung: null };
		entry.loading = true;
		ratings.set(formatid, entry);
		const store = new Ladders.LadderStore(formatid);
		Promise.all([...RUNG_ID].map(([rung, id]) => store.getRating(id).then(r => [rung, Number(r) || 1000], () => [rung, MEASURED[rung] || 1000])))
			.then(pairs => { entry.byRung = new Map(pairs); })
			.catch(() => {})
			.finally(() => { entry.at = Date.now(); entry.loading = false; setImmediate(() => { try { tick(); } catch (e) {} }); });
	};

	/** The rung a waiting player should get, or null for players only. */
	const rungFor = (search, formatid) => {
		const wanted = wantedRung.get(search.userid);
		if (wanted === PVP) return null;
		if (wanted && RUNG_ID.has(wanted)) return wanted;
		const rating = Number(search.rating) || 1000;
		const actual = ratingsFor(formatid);
		let best = null;
		let gap = Infinity;
		for (const rung of RUNG_ID.keys()) {
			const r = actual ? actual.get(rung) : MEASURED[rung];
			if (r === undefined) continue;
			const d = Math.abs(r - rating);
			if (d < gap) { gap = d; best = rung; }
		}
		return best || RUNG_ID.keys().next().value || null;
	};

	const rungAt = new Map();     // `${format}|${player}|${rung wanted}` -> when a bot was last rung for them
	const RING_AGAIN_MS = 15000;  // a bot still building a team is not rung twice
	const RELEASE_MS = 60000;     // how long a bot waits in a format nobody is in

	const tick = () => {
		const now = Date.now();
		for (const [formatid, table] of Ladders.searches) {
			if (!table || table.playerCount > 2) continue;
			const searches = [...table.searches.values()];
			const humans = searches.filter(search => !botIds.has(search.userid));
			const botsIn = new Set(searches.filter(search => botIds.has(search.userid)).map(search => search.userid));

			for (const human of humans) {
				const rung = rungFor(human, formatid);
				if (!rung) continue;
				const id = RUNG_ID.get(rung);
				// Already served: the rung they asked for is searching, or, with no
				// preference, any bot is.
				if (wantedRung.get(human.userid) ? botsIn.has(id) : botsIn.size) continue;
				const bot = online(id);
				if (!bot) continue;
				// One ring per waiting player at a time: a rung that is still building its
				// team is not joined by a second one because the ratings came in meanwhile.
				const key = `${formatid}|${human.userid}|${wantedRung.get(human.userid) || 'any'}`;
				if (now - (rungAt.get(key) || 0) < RING_AGAIN_MS) continue;
				rungAt.set(key, now);
				bot.send(`|velvetsummon|${formatid}`);
				if (process.env.PS_DEBUG_SUMMON) console.log(`[summon] ${formatid}: ${human.userid} (${human.rating}) -> ${id}`);
			}

			if (humans.length) continue;
			for (const id of botsIn) {
				const search = table.searches.get(id);
				if (!search || now - search.time < RELEASE_MS) continue;
				const bot = online(id);
				if (bot) bot.send(`|velvetunsummon|${formatid}`);
			}
		}
	};

	const timer = setInterval(() => { try { tick(); } catch (e) { console.log('[config] ringing bots failed:', e.message); } }, 2000);
	if (timer.unref) timer.unref();

	// And straight away when somebody presses Battle!, instead of up to two seconds later.
	let proto = null;
	try { proto = Object.getPrototypeOf(Ladders('gen9randombattle')); } catch (e) { /* timer only */ }
	if (proto && typeof proto.addSearch === 'function' && !proto.velvetSummon) {
		proto.velvetSummon = true;
		const addSearch = proto.addSearch;
		proto.addSearch = function (search, user) {
			const out = addSearch.call(this, search, user);
			if (user && !botIds.has(user.id)) setImmediate(() => { try { tick(); } catch (e) { /* the timer will */ } });
			return out;
		};
	}
	console.log(`[config] bots are rung on demand (${RUNG_ID.size} rung(s), any format)`);
}

/**
 * Let the bot in without an account, and nobody else.
 *
 * Requiring real accounts is the point - a name should belong to the person
 * who registered it. But the bot claims six names of its own, and registering
 * six accounts to run a bot on your own server is a chore with no security in
 * it: the passwords would sit in the environment of the machine the bot runs
 * on, which is the same machine as the server.
 *
 * So the bot is exempted, and the exemption is pinned to where it connects
 * from. The bot talks to the server over the loopback address, from inside the
 * same host; nobody on the internet can reach it that way. A remote connection
 * claiming to be Velvet Bunny is refused exactly like any other unproven name.
 */
function exemptBots(botIds) {
	const proto = Users && Users.User && Users.User.prototype;
	if (!proto || typeof proto.validateToken !== 'function') {
		console.log('[config] could not reach the login check; the bot will need an account');
		return;
	}
	if (proto.velvetBotExemption) return;
	proto.velvetBotExemption = true;

	const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
	const original = proto.validateToken;
	proto.validateToken = function (token, name, userid, connection) {
		const from = connection && connection.ip;
		if (!token && botIds.has(userid) && LOOPBACK.includes(from)) {
			// '1' is what Showdown itself returns for an accepted unproven name.
			return Promise.resolve('1');
		}
		return original.call(this, token, name, userid, connection);
	};
	console.log('[config] the bot may log in from this host without an account; everyone else must prove their name');
}

/**
 * Keep replays here instead of asking Smogon to host them.
 *
 * A battle room uploads by calling the login server with `addreplay`. That is
 * the only thing being replaced: the replay is written to this project's own
 * repository and the call returns the id it was filed under, exactly as the
 * login server would have. Everything either side of it - the popup, the link,
 * the "Upload and share replay" button - is Showdown's own code, untouched.
 */
function hostReplays() {
	if (typeof LoginServer === 'undefined' || LoginServer.velvetReplays) return;
	LoginServer.velvetReplays = true;

	const { ReplayStore } = require('../../../src/replay-store');
	const store = new ReplayStore(msg => console.log('[replays]', msg));
	const original = LoginServer.request.bind(LoginServer);

	/**
	 * Which boot this is, so two battles cannot be filed under one name.
	 *
	 * A battle room is called `gen9rpbattle-2`, and that number comes from a
	 * counter that lives in memory and starts again at one every time the server
	 * restarts. The replay was filed under exactly that name - so the second
	 * battle after a deploy overwrote the second battle before it. It is not a
	 * rare case: this server restarts on every deploy, and it cost somebody their
	 * replay within a day of the feature existing.
	 *
	 * The suffix is fixed for the lifetime of the process rather than generated
	 * per upload, and that distinction is the whole point. A room uploads its
	 * replay again every time the battle goes on - three times, in the case that
	 * lost the replay - and each upload has to land on the same file, or one
	 * battle becomes six replays and the link a player already shared stops
	 * being the newest one. Within a boot the room number is unique; across
	 * boots this makes it unique too.
	 */
	const BOOT = Math.trunc(Date.now() / 1000).toString(36);
	// The RP replay feed names replays before they are uploaded, so it needs this too.
	LoginServer.velvetReplayBoot = BOOT;

	LoginServer.request = async function (action, data) {
		if (action !== 'addreplay') return original(action, data);

		const roomid = String(data.id || '').trim();
		if (!roomid) return [{ errorip: 'no id' }, null];
		const id = `${roomid}-${BOOT}`;
		try {
			await store.save({
				id,
				format: data.format || '',
				players: String(data.players || '').split(',').filter(Boolean),
				rating: data.rating || null,
				log: data.log || '',
				inputlog: data.inputlog || null,
				uploadtime: Math.trunc(Date.now() / 1000),
			});
			console.log(`[replays] saved ${id}`);
		} catch (e) {
			// The player still gets a working link: the replay is in memory and on
			// disk either way, and only the copy that outlives a restart is lost.
			console.log(`[replays] ${id} was not committed: ${e.message}`);
		}
		return [{ replayid: id }, null];
	};
	console.log(`[replays] uploads are stored here, not on Smogon's replay server`);
}

/**
 * Say goodbye before the lights go out.
 *
 * A battle lives in this process's memory, so a restart ends it - there is no
 * mechanism in Showdown for carrying one across, and inventing one would mean
 * serialising an entire battle engine. What can be fixed is the *silence*: a
 * battle used to vanish mid-turn with no explanation and no record.
 *
 * So on the way out: everyone playing is told, in their own battle room, that
 * the server is restarting and roughly when to come back; every unfinished
 * battle has a replay saved, so the game is still there to read afterwards;
 * and only then does the process exit. src/index.js allows for this - it waits
 * for this process rather than killing it - and the whole thing is kept well
 * inside the time the host allows before it stops waiting.
 */
/*
 * A replay saved during the battle, not only at its end.
 *
 * The goodbye below is meant to save unfinished battles when the server stops,
 * and in practice no replay has ever carried its notice: on the host the process
 * does not get its grace period, and two of the owner's games were lost to
 * deploys in one evening. So every battle is saved as it goes - every few turns -
 * and a restart or a crash leaves the game up to those few turns back.
 *
 * Each save is a commit (src/replay-store.js), overwriting the same file, so it
 * is kept to one every SNAPSHOT_TURNS turns. The snapshot must not count as the
 * battle's replay: the end-of-battle upload only runs when `replaySaved` is
 * unset, so it is put back afterwards and the finished game is still saved whole.
 */
// The battle's turn, from its own log: a RoomBattle keeps no turn counter of its own
// (`battle.timer.turn` exists, but only while the timer is running).
function currentTurn(room) {
	const lines = (room.log && room.log.log) || [];
	for (let i = lines.length - 1; i >= 0; i--) {
		const m = /^\|turn\|(\d+)/.exec(lines[i]);
		if (m) return Number(m[1]);
	}
	return 0;
}
global.velvetCurrentTurn = currentTurn;

function replaySnapshots() {
	if (global.velvetSnapshots) return;
	global.velvetSnapshots = true;
	const SNAPSHOT_TURNS = Number(process.env.PS_REPLAY_SNAPSHOT_TURNS || 5);
	console.log(`[replays] saving battles every ${SNAPSHOT_TURNS} turns as they go`);
	const timer = setInterval(() => {
		if (process.env.PS_DEBUG_SNAPSHOT) {
			const battles = [...Rooms.rooms.values()].filter(r => r.battle);
			console.log(`[snapshot] tick: ${battles.length} battle room(s)` + battles.map(r => ` ${r.roomid} ended=${!!r.battle.ended} turn=${currentTurn(r)} last=${r.battle.velvetSnapshotTurn || 0}`).join(''));
		}
		for (const room of Rooms.rooms.values()) {
			try {
				const battle = room.battle;
				if (!battle || battle.ended || !room.uploadReplay) continue;
				const turn = currentTurn(room);
				if (turn < 1 || turn - (battle.velvetSnapshotTurn || 0) < SNAPSHOT_TURNS) continue;
				battle.velvetSnapshotTurn = turn;
				const wasSaved = battle.replaySaved;
				const upload = room.uploadReplay(undefined, undefined, 'auto');
				// uploadReplay marks the battle saved before its first await, so put the
				// mark back straight away - not when the upload finishes, by which time the
				// battle may have ended and its own save been skipped because of it.
				battle.replaySaved = wasSaved;
				if (upload && upload.catch) upload.catch(() => {});
			} catch (e) {
				// One room failing is no reason to stop saving the rest.
			}
		}
	}, Number(process.env.PS_REPLAY_SNAPSHOT_MS || 20000));
	if (timer.unref) timer.unref();
}

function goodbye() {
	if (global.velvetGoodbye) return;
	global.velvetGoodbye = true;

	const SECONDS = Number(process.env.PS_SHUTDOWN_NOTICE_SECONDS || 20);
	let leaving = false;

	const wave = () => {
		if (leaving) return;
		leaving = true;

		let battles = 0;
		for (const room of Rooms.rooms.values()) {
			try {
				if (room.battle && !room.battle.ended) {
					battles++;
					room.add(`|html|<div class="broadcast-red"><b>The server is restarting.</b> ` +
						`This battle cannot survive it - a replay is being saved, and you can ` +
						`reconnect in about a minute.</div>`).update();
					// 'auto' saves it without a popup at anyone.
					void room.uploadReplay(undefined, undefined, 'auto');
				} else if (room.type === 'chat') {
					room.add(`|html|<div class="broadcast-red">The server is restarting; ` +
						`back in about a minute.</div>`).update();
				}
			} catch (e) {
				// One room failing to be told is no reason to stop telling the rest.
			}
		}
		console.log(`[shutdown] told everyone; ${battles} battle(s) in progress, replays saved`);

		// Long enough for the messages to arrive and the replays to be committed,
		// short enough that the host is still waiting for us.
		setTimeout(() => {
			console.log('[shutdown] goodbye');
			process.exit(0);
		}, SECONDS * 1000);
	};

	process.on('SIGTERM', wave);
	process.on('SIGINT', wave);
}

/**
 * RP at the top of the format list.
 *
 * Formats are listed in the order the simulator loaded them, and anything this
 * server adds is merged in after all of Showdown's own - which puts our own
 * tiers below thirty sections of theirs, at the bottom of every dropdown. The
 * list is built once and cached, so moving our section to the front here, and
 * dropping the cached text, is enough for every client that connects after.
 *
 * Sorting the array rather than rewriting the text means the client gets a list
 * built by Showdown's own code, in the shape it expects.
 */
function rpSectionFirst() {
	// Both of them, in this order: the current generation first, the older ones
	// under it, and everything Showdown ships below that.
	const SECTIONS = ['RP', 'RP Past Gens'];

	const formats = Dex.formats.all();
	const ours = [];
	for (const section of SECTIONS) {
		ours.push(...formats.filter(format => format.section === section));
	}
	if (!ours.length) {
		console.log('[formats] no RP section found; leaving the list alone');
		return;
	}

	const rest = formats.filter(format => !SECTIONS.includes(format.section));
	formats.length = 0;
	formats.push(...ours, ...rest);

	// Built on first use and cached; drop it so the new order is what gets sent.
	Rooms.global.formatList = null;
	console.log(`[formats] RP first: ${ours.length} format(s) across ${SECTIONS.length} section(s)`);
}

/**
 * Every tier can be queued for.
 *
 * Showdown ships most of its formats challenge-only: 247 of 361, Gen 5 NU among
 * them, which means Battle! simply cannot search them. On a server where the
 * bots are rung on demand (summonBots) there is always an opponent, so every
 * two-player format Showdown offers for challenges is offered on the ladder too.
 * Nobody plays Gen 5 NU; now it can be played at all. The RP sections keep their
 * own settings - the tutorial and encounter formats are challenge-only on purpose.
 */
/*
 * RP battles are announced in the Roleplay room, not the lobby (22 Sep 2026: the
 * owner saw every encounter and RP fight "shoved inside lobby"). Anything else -
 * random battles, ladder games - is still reported in the lobby, and every
 * battle still goes to the logs room.
 */
function rpBattlesToRoleplay() {
	const G = Rooms.global;
	if (!G || G.__velvetRpReport || typeof G.onCreateBattleRoom !== 'function') return;
	G.__velvetRpReport = true;
	const original = G.onCreateBattleRoom;
	G.onCreateBattleRoom = function (players, room, options) {
		const format = String((room && room.battle && room.battle.format) || (options && options.format) || '');
		if (!/^gen\d+rp/.test(format)) return original.call(this, players, room, options);
		const saved = Config.reportbattles;
		Config.reportbattles = ['roleplay', 'logs'];
		try {
			return original.call(this, players, room, options);
		} finally {
			Config.reportbattles = saved;
		}
	};
}

function everyTierLadderable() {
	const RP_SECTIONS = ['RP', 'RP Past Gens'];
	let section = '';
	let opened = 0;
	for (const format of Dex.formats.all()) {
		if (format.section) section = format.section;
		if (!format.name || RP_SECTIONS.includes(section)) continue;
		if (format.searchShow || !format.challengeShow) continue;
		if ((format.playerCount || 2) !== 2 || /multi|freeforall/i.test(format.gameType || '')) continue;
		format.searchShow = true;
		opened++;
	}
	Rooms.global.formatList = null;
	console.log(`[formats] ${opened} challenge-only format(s) opened to the ladder`);
}

/**
 * Make a room, set it up, and make sure it actually opens for people.
 *
 * The last part is the one that bites. Showdown builds its two autojoin lists
 * once, at boot, out of the saved room file - public rooms in one, rooms behind
 * a modjoin in the other - and `checkAutojoin` only ever walks those lists. A
 * room created at runtime and then told `autojoin = true`, which is what this
 * config was doing, is in neither: the setting is saved, it reads correctly in
 * /roomsettings, and the room never opens for anybody.
 *
 * So the room is added to whichever list its settings actually mean.
 */
function makeRoom(title, settings) {
	const id = toID(title);
	let room = Rooms.get(id);
	if (!room) {
		Rooms.global.addChatRoom(title);
		room = Rooms.get(id);
	}
	if (!room) {
		console.log(`[config] could not create the ${title} room`);
		return null;
	}

	Object.assign(room.settings, settings);
	room.saveSettings();

	if (settings.autojoin) {
		const global = Rooms.global;
		const list = settings.modjoin ? global.modjoinedAutojoinList : global.autojoinList;
		if (list && !list.includes(id)) list.push(id);
	}
	return room;
}

/**
 * Somewhere to ask.
 *
 * A public room, separate from the lobby, so a question does not have to
 * compete with whatever the lobby is doing - and so the answer is somewhere a
 * person can be pointed at later.
 *
 * Not autojoined. Two rooms opening on every connection is how people learn to
 * close rooms; this one is in the room list, which is where someone looking for
 * help looks.
 */
/**
 * What `/help` says first on this server.
 *
 * Showdown's own `/help` lists its generic commands, which says nothing about
 * what is actually here: the bots and their difficulty picker, the RP rooms and
 * battles, replays. This box comes first; Showdown's list still follows, and
 * `/help [command]` is untouched. Staff see the staff commands too.
 */
function serverHelpBox(user) {
	const cmd = c => `<code>${c}</code>`;
	const btn = (room, label) => `<button class="button" name="joinRoom" value="${room}">${label}</button>`;
	const staff = user && user.can && user.can('bypassall');
	const section = (title, items) => `<p style="margin:6px 0 2px"><b>${title}</b></p><ul style="margin:0;padding-left:18px">` +
		items.map(i => `<li>${i}</li>`).join('') + `</ul>`;
	return `<div style="padding:2px">` +
		`<h3 style="margin:0 0 4px">Velvet Bunny Showdown: help</h3>` +
		`<p style="margin:0 0 4px">A custom Pok&eacute;mon Showdown server: the RP tiers, house bots you can ladder against, ` +
		`and the <b>Kagura RP</b> battles. Questions? ${btn('help', 'Help room')}</p>` +

		section('Getting started', [
			`Click <b>Choose name</b> (top right). You can play as a guest or with a Showdown account.`,
			`<b>Teambuilder</b> to make a team, then pick a format and <b>Battle!</b> Random Battle formats need no team.`,
			`${cmd('/avatar [name]')} to change your avatar &middot; ${cmd('/avatarlist')} to see this server's custom ones.`,
		]) +

		section('Battling the bots', [
			`Ladder formats match you against a house bot when nobody else is queuing.`,
			`${cmd('/bot')} picks which bot: ${cmd('/bot easy')}, ${cmd('normal')}, ${cmd('hard')}, ${cmd('champion')} or ${cmd('stockfish')}. ` +
			`${cmd('/bot pvp')} for players only, ${cmd('/bot anyone')} to match on rating again.`,
			`You can also challenge a bot directly, in any format.`,
		]) +

		section('Kagura RP battles', [
			`<b>First time?</b> <button class="button" name="send" value="/tutorial"><b>Start the tutorial</b></button> ${cmd('/tutorial')}: a 2-minute practice battle (Lv. 5 Pikachu, 1 Potion, 1 Pok&eacute; Ball vs a wild Rattata). No team needed, nothing counts.`,
			`${btn('roleplay', 'Roleplay room')} ${cmd('/roleplay')}: the full guide (team, encounters, catching).`,
			`Use <b>[Gen 9] RP Battle</b> for your RP team, built from your box in the <a href="https://docs.google.com/spreadsheets/d/1-XoCX0qkrshpiVvY4Sw1sBNAfiEnJYX67ZXZUkDDGrs/edit">RP doc</a>: ` +
			`any move it can learn whatever its level (TMs free), held items from your first gym badge. Wild Pok&eacute;mon and trainers come from ${cmd('!encounter')} on the Discord.`,
			`In a wild battle, the <b>Bag</b> button under your moves (Pokéballs, Medicine) and <b>Run</b>, or ${cmd('/throwball [ball]')} catch; ${cmd('/useitem [item], [pokemon]')} uses a Potion or Revive from your bag, in any RP battle (unlimited in RP Custom Game).`,
			`Your team is checked against your character's box, and Mega / Z / Dynamax / Tera need the story item.`,
			`<b>[Gen 9] RP Custom Game</b> is for hackmons, illegal and fun battles: anything goes (items unlimited), challenge only, and no EXP or RP progress.`,
		]) +

		section('Replays and more', [
			`Save a battle with the <b>Upload replay</b> button after it ends; replays stay on this server.`,
			`${cmd('/help [command]')} explains any command, e.g. ${cmd('/help bot')}.`,
		]) +

		(staff ? section('Staff', [
			`${cmd('/setrank [user], [rank]')}: a global rank that survives restarts.`,
			`${cmd('/players [name]')}: everyone who has visited (the guest book).`,
			`The <b>Logs</b> room records every battle.`,
		]) : '') +
		`</div>`;
}

/**
 * RP is this server's main format, so the data commands answer with RP's data.
 *
 * /dt, /learn, /weakness, /ds, /ms and the rest pick their dex through one
 * function: a format or generation you name (`/dt9`, `/dt normalize, gen8`),
 * else the room's own format (a battle's, or a room's default), else the base
 * dex. That last fallback is Showdown's own data, which is what the official
 * formats run on - so a plain `/dt normalize` in the lobby showed Game Freak's
 * Normalize, not the one RP plays. The fallback becomes the RP dex; naming a
 * generation, or asking in an official format's battle, still gets that
 * generation's official data.
 */
function rpDataByDefault() {
	const CC = typeof Chat !== 'undefined' && Chat.CommandContext;
	if (!CC || !CC.prototype.extractFormat) return false;
	if (CC.prototype.extractFormat.velvet) return true;
	const original = CC.prototype.extractFormat;
	const extractFormat = function (formatOrMod, allowRules) {
		const found = original.call(this, formatOrMod, allowRules);
		if (found && !found.isMatch && !found.format) found.dex = Dex.mod('gen9rp');
		return found;
	};
	extractFormat.velvet = true;
	CC.prototype.extractFormat = extractFormat;
	return true;
}

/** Put the server's box in front of Showdown's own `/help`. */
function serverHelp() {
	const original = Chat.commands && Chat.commands.help;
	if (typeof original !== 'function' || original.velvet) return false;
	const help = function (target, room, user, connection, cmd, message) {
		if (!String(target || '').trim()) {
			if (!this.runBroadcast()) return;
			this.sendReplyBox(serverHelpBox(user));
		}
		return original.call(this, target, room, user, connection, cmd, message);
	};
	help.velvet = true;
	Chat.commands.help = help;
	if (Chat.commands.h === original) Chat.commands.h = help;
	return true;
}

/**
 * Every bot rung has a plateau it never drops below.
 *
 * Bots can climb, but a run of losses to people used to drag a rung down until
 * beating it was worth almost nothing. Each rung is held at its own floor (its
 * starting rating, src/ladder-seed.js), so there is always rating to win from
 * it. Showdown still prints its own "+0 for losing" line; this adds one saying why.
 */
function botLadderPlateaus() {
	const store = typeof Ladders !== 'undefined' && Ladders && Ladders.LadderStore;
	const on = require('../../../src/ladder-plateau').installPlateaus(store && store.prototype, userid => BOT_RUNG.get(userid), { escape: Chat.escapeHTML });
	console.log(on ? '[config] bot ladder plateaus on' : '[config] could not find the ladder to put plateaus on');
	ladderMedals(store && store.prototype);
}

/**
 * The medal beside the avatar, for the top three of the ladder being played.
 *
 * The client already draws badges next to a player's avatar in a battle - it is
 * how the official server shows ladder trophies - and reads them off a `|badge|`
 * line: type, format, and a "top N" number for the tooltip. Nothing on this
 * server ever sent one, so first place looked like everybody else. Sent for the
 * battle's own format, on both rated and unrated games, so a challenge between
 * two people shows who is top of that ladder.
 */
async function ladderBadges(game) {
	try {
		if (!game || !game.room || !game.players || !game.format) return;
		if (typeof Ladders === 'undefined' || !Ladders || !Ladders.LadderStore) return;
		const format = Dex.formats.get(game.format);
		if (!format || !format.searchShow) return;
		const ladder = await new Ladders.LadderStore(format.id).getLadder();
		if (!ladder || !ladder.length) return;
		const types = ['gold', 'silver', 'bronze'];
		let sent = false;
		for (const player of game.players) {
			const index = ladder.findIndex(row => toID(row[0]) === toID(player.id));
			if (index < 0 || index > 2) continue;
			// type|format|threshold-place: the client turns it into the trophy and its tooltip.
			game.room.add(`|badge|${player.slot}|${types[index]}|${format.id}|${index + 1}-${index + 1}`);
			sent = true;
		}
		if (sent) game.room.update();
	} catch (e) { /* a battle must never fail over a decoration */ }
}

/**
 * A medal on the top three of every ladder.
 *
 * The ladder tab is a plain table of numbers, and first place looks like
 * fourteenth place with a bigger number. Showdown's own boards mark the top of
 * the list, so this does too: the medal goes in the ladder tab, on /rank, and
 * beside the name in a battle's player list.
 */
function ladderMedals(proto) {
	if (!proto || proto.velvetMedals) return;
	proto.velvetMedals = true;
	const original = proto.getTop;
	if (!original) return;
	proto.getTop = async function (...args) {
		const out = await original.apply(this, args);
		try {
			// out is [formatid, html]; the first three data rows get their medal.
			if (!Array.isArray(out) || typeof out[1] !== 'string') return out;
			let seen = 0;
			out[1] = out[1].replace(/<tr><td>(\d+)<\/td>/g, (whole, place) => {
				const medal = MEDALS[Number(place) - 1];
				seen++;
				return medal ? `<tr><td>${medal}</td>` : whole;
			});
			void seen;
		} catch (e) { /* the plain table is fine */ }
		return out;
	};
}

function helpRoom() {
	const room = makeRoom('Help', {
		isPrivate: false,
		modjoin: false,
		modchat: false,
		autojoin: false,
		introMessage: '<h2>Help</h2>' +
			'<p>Ask here. Anything about this server, the custom Pok&eacute;mon and moves, ' +
			'the RP tiers, the Kagura RP battles, or Pok&eacute;mon Showdown itself.</p>' +
			'<p>This server is a custom Pok&eacute;mon Showdown server: your account is a real ' +
			'Showdown account, and you can also play without one. What is different here ' +
			'is the RP tiers, house bots with a ladder of their own (<code>/bot</code> picks one), a few buffed ' +
			'Pok&eacute;mon, one that exists nowhere else, and the <b>Roleplay</b> room where Kagura RP battles happen ' +
			'(<code>/roleplay</code>).</p>' +
			'<p>Type <code>/help</code> for everything this server adds, or <code>/help [command]</code> for one command.</p>',
	});
	if (room) console.log('[config] the help room is open');
}

/**
 * A room that keeps every battle, and a file that outlives the room.
 *
 * The lobby announces battles as they start, but a chat room is a scrollback:
 * old lines fall off the end, and a restart takes the room with it. So there is
 * a `logs` room that gets the same announcements plus the result of every battle
 * as it ends - and every one of those lines is also appended to this project's
 * own repository, which is the part that survives.
 *
 * The room is hidden and staff-only: it is a record for whoever runs the server,
 * not a feed for the lobby.
 */
function battleLog() {
	const { BattleLogStore } = require('../../../src/battle-log-store');
	const store = new BattleLogStore(msg => console.log('[battle-log]', msg));

	// Hidden from everyone below driver, and opened automatically for everyone at
	// or above it: nobody should have to remember a room exists to read the
	// record of what happened on the server.
	const room = makeRoom('Logs', {
		isPrivate: 'hidden',
		modjoin: '%',
		autojoin: true,
		modchat: '~',   // nobody talks in here; it is a record
		introMessage: '<h2>Battle log</h2><p>Every battle on this server, ' +
			'as it starts and as it ends. Kept in the repository as well, one file a month, ' +
			'because a chat room forgets and a restart forgets faster.</p>',
	});
	if (room) console.log('[battle-log] the logs room is open; battles are kept in the repository');

	// Where a battle ends. Showdown writes its own log here, into a folder this
	// host wipes on every deploy; this rides along and keeps the summary.
	const battleProto = Rooms.RoomBattle && Rooms.RoomBattle.prototype;
	if (!battleProto || battleProto.velvetBattleLog) return;
	battleProto.velvetBattleLog = true;

	const original = battleProto.logBattle;
	battleProto.logBattle = function (p1score, ...rest) {
		try {
			const players = this.players.map(player => player.name);
			const result = p1score === 1 ? `${players[0]} won` :
				p1score === 0 ? `${players[1]} won` :
				p1score === 0.5 ? 'tie' : (this.endType || 'unfinished');

			store.record({
				format: this.room.format,
				players,
				result,
				battle: this.room.roomid,
			});

			const logs = Rooms.get('logs');
			if (logs) {
				const link = `<a href="/${this.room.roomid}">${this.room.roomid}</a>`;
				logs.add(`|raw|<small>${Chat.escapeHTML(this.room.format)} &mdash; ` +
					`<b>${Chat.escapeHTML(result)}</b> &mdash; ${link}</small>`).update();
			}
		} catch (e) {
			console.log(`[battle-log] ${e.message}`);
		}
		return original.call(this, p1score, ...rest);
	};
}
/**
 * Ranks handed out in chat, remembered.
 *
 * Showdown saves a promotion in setGroup only `if (this.registered)`, and with
 * no login server nobody here is ever registered - so /globalpromote lasted
 * until the person disconnected and not a moment longer. Restarting was not
 * even required to lose it.
 *
 * Its own file rather than usergroups.csv, which is the obvious place and the
 * wrong one: being listed there makes an account *trusted*, and a trusted
 * account is refused a guest login, so writing someone's rank down there is how
 * you lock them out of the server entirely.
 *
 * It lives in the package's config directory, which is inside node_modules and
 * therefore survives restarts and deploys on this host - the same reason the
 * avatar rights outlive them. That is a property of the host's caching rather
 * than a guarantee; with GITHUB_TOKEN set the ladder store already commits its
 * own state to the repository, and this could ride along with it.
 */
const RANK_FILE = require('path').join(__dirname, 'velvet-ranks.json');

// Shared between the command that sets a rank and the loop that applies it.
let savedRanks = {};
const lastApplied = new Map();   // what we set, so a change by anyone else is visible

function loadRanks() {
	try {
		const data = JSON.parse(require('fs').readFileSync(RANK_FILE, 'utf8'));
		return data && typeof data === 'object' ? data : {};
	} catch (e) {
		return {};   // nothing saved yet, which is the normal first boot
	}
}

function saveRanks(ranks) {
	try {
		require('fs').writeFileSync(RANK_FILE, JSON.stringify(ranks, null, '\t'));
	} catch (e) {
		console.log(`[config] could not save ranks: ${e.message}`);
	}
}

savedRanks = loadRanks();

/**
 * Put someone's avatar on them.
 *
 * `getDefault` returns the avatar they picked last if they have picked one and
 * the one they were granted otherwise, so re-applying it is both correct and
 * idempotent - it will not fight a choice, and it costs nothing on the rounds
 * where nothing has changed.
 */
function applyAvatar(user) {
	const avatars = Users.Avatars;
	if (!avatars || typeof avatars.getDefault !== 'function') return;
	let want;
	try { want = avatars.getDefault(user.id); } catch (e) { return; }
	if (!want || user.avatar === want) return;
	user.avatar = want;
	try {
		// Two different audiences. updateIdentity refreshes how the rooms see them;
		// update() sends the frame their own client reads its avatar out of, without
		// which everyone else sees the new one and they go on looking at the old.
		user.updateIdentity();
		user.update();
	} catch (e) { /* they are on their way out */ }
}


/**
 * The Roleplay room, and everything RP encounters need from the server.
 *
 * The RP happens on Discord; its battles happen here. This room is where those
 * players are sent: its introduction is the whole tutorial, written for people
 * who have never used Showdown, and the RP bot stands in it. The lobby stays
 * what it was - the house bot, its difficulties and the ladder - so the two
 * audiences never have to read each other's instructions.
 *
 * The encounter logic itself is in src/rp-server.js; this is the wiring.
 */
const RP_BOT = process.env.PS_RP_BOT_NAME || 'RP Guide';
/**
 * Whether a user is one of the RP bot's own connections: the RP Guide, or a
 * "Wild Pidgey" / "Hiker Bob" it logged in for an encounter. Filled in by
 * roleplay(), which knows the rolled names. These get the bot rank like every
 * other bot, but are never remembered - the next "Hiker Bob" could be a person.
 */
let isRpBot = () => false;
const RP_FORMATS = new Set(['gen9rpbattlewildencounter', 'gen9rpbattlewilddoubles', 'gen9rptutorial']);
// Set once the roleplay hooks are up: what /tutorial needs to start a battle.
let tutorialDeps = null;
// Set by roleplay(): the RP bot turning an encounter down (the /rpbusy command).
let rpBusy = () => {};
// Battles between players where bag items work (not RP Custom Game).
const RP_PVP_FORMATS = new Set(['gen9rpbattle', 'gen9rpbattledoubles']);

function roleplayIntro() {
	const discord = '<b>Discord</b>';
	const step = (title, body, open = false) =>
		`<details${open ? ' open' : ''} style="margin:4px 0"><summary><b>${title}</b></summary><div style="padding:4px 0 4px 12px">${body}</div></details>`;
	return `<div style="padding:4px">` +
		`<h2 style="margin:0 0 4px">Roleplay</h2>` +
		`<p style="margin:0 0 8px"><b>First time? Start here:</b> <button class="button" name="send" value="/tutorial" style="font-size:12pt;padding:4px 12px"><b>Start the tutorial</b></button> ` +
		`a 2-minute practice battle with a Lv. 5 Pikachu, 1 Potion and 1 Pok&eacute; Ball against a wild Rattata. No team or Discord needed, and nothing counts. (Or type <code>/tutorial</code>, or <code>!tutorial</code> on Discord.)</p>` +
		`<p style="margin:0 0 6px">Battles for the Kagura RP. <b>You don't challenge anybody here</b>: ` +
		`you ask for an encounter on ${discord} (<a href="https://discord.gg/pH86q7sdg7">join the Kagura RP</a>), and a wild Pok&eacute;mon or a trainer challenges you here.</p>` +
		`<p style="margin:0 0 6px"><b>The RP doc is your record</b>: your box (every Pok&eacute;mon, its level and ball), bag, money and badges. ` +
		`Build your team from it: <a href="https://docs.google.com/spreadsheets/d/1-XoCX0qkrshpiVvY4Sw1sBNAfiEnJYX67ZXZUkDDGrs/edit">open the doc</a>. ` +
		`<b>Moves:</b> any move it can learn, whatever its level, and TMs are free. <b>Held items:</b> from your first gym badge.</p>` +

		step('1. First time? Set up your name (once)',
			`<ol style="margin:0;padding-left:18px">` +
			`<li>Click <b>Choose name</b> at the top right and pick a name. Keep using the same one.</li>` +
			`<li>On ${discord}, type <code>!showdown YourName</code> so the bot knows where to send your battles.</li>` +
			`</ol>`, true) +

		step('2. Build your RP team (once, then update it as your team changes)',
			`<ol style="margin:0;padding-left:18px">` +
			`<li>Click <b>Teambuilder</b> (on the home screen, top left).</li>` +
			`<li>Click <b>New Team</b>. Set the format to <b>[Gen 9] RP Battle</b>. That one team is used for every RP battle, wild or trainer.</li>` +
			`<li>Click <b>Add Pok&eacute;mon</b> and type its name. Add the Pok&eacute;mon your character <i>actually has</i> in the doc, nothing else.</li>` +
			`<li>Set its <b>Level</b> to its level in the doc. It can't be higher than your level cap.</li>` +
			`<li>Pick up to 4 <b>moves</b>: any move it can learn, whatever its level. TMs are free too.</li>` +
			`<li>Pick its <b>ability</b>. <b>Held items</b> are allowed once you have your first badge.</li>` +
			`<li>Nature, EVs and IVs are free: set them however you like, as long as they're legal (nobody checks). ` +
			`Not sure what they are? Leave them; but trainers you meet get more EVs and IVs with every badge you earn.</li>` +
			`<li>Repeat for each Pok&eacute;mon, then click back to the team list. It saves on its own.</li>` +
			`</ol>` +
			`<small>Your first Pok&eacute;mon in the list is the one you send out first. ` +
			`<b>The team is checked against your box:</b> a Pok&eacute;mon you don't own, one above its box level (a blank level counts as 100), ` +
			`or one that's fainted or at the daycare gets the battle called off before it starts.</small>`) +

		step('3. Get an encounter',
			`<ol style="margin:0;padding-left:18px">` +
			`<li>Have this site open and your name chosen.</li>` +
			`<li>On ${discord}, in the channel your character is in, type <code>!encounter</code>. The bot already knows your badges and trainer level.</li>` +
			`<li>A challenge pops up here from someone like <b>Wild Pidgey</b> or <b>Hiker Bob</b>. Click <b>Accept</b> and choose your RP team.</li>` +
			`</ol>` +
			`<small>Only routes, wilds and outdoor spots have wild Pok&eacute;mon; the bot tells you if you're somewhere without any. ` +
			`Sometimes it's a double battle, so carry at least two Pok&eacute;mon once you have a badge.</small>`) +

		step('4. In the battle',
			`<ul style="margin:0;padding-left:18px">` +
			`<li>Click a move to attack, or a Pok&eacute;mon to switch. That's all a battle is.</li>` +
			`<li><b>Catching:</b> against a wild Pok&eacute;mon, open the <b>Bag</b> under your moves and pick a ball from Pokéballs; <b>Run</b> sits beside it. Throwing uses your whole turn.</li>` +
			`<li>Lower its HP and give it a status (sleep is best) to make catching easier. Every miss makes the next ball likelier.</li>` +
			`<li>Two wild Pok&eacute;mon? Knock one out first, then throw at the other.</li>` +
			`<li><b>Healing items:</b> the <b>Bag</b> under your moves, Medicine pocket (or <code>/useitem [item], [pokemon]</code>) uses a Potion, Revive and so on. It works in every RP battle: encounters and battles with players or NPC trainers use your character's bag (taken off afterwards; NPCs have 5 of each), and RP Custom Game is unlimited.</li>` +
			`<li>You can only throw balls your character has. Legendary and Mythical Pok&eacute;mon never appear here; those happen in the RP.</li>` +
			`<li><b>Mega Evolution, Z-Moves, Dynamax and Terastallization</b> stay locked until the story gives your character the Key Stone, Z-Ring, Dynamax Band or Tera Orb.</li>` +
			`</ul>`) +

		step('5. After the battle',
			`<ul style="margin:0;padding-left:18px">` +
			`<li>The bot on ${discord} posts the result: money for a win, the Pok&eacute;mon you caught, and the balls you used.</li>` +
			`<li>Then write it into your scene. Caught something? Add it to your team here when you want to use it.</li>` +
			`<li><b>Fainted Pok&eacute;mon stay fainted</b> (tagged KO) until you use <code>!heal</code> in a Pok&eacute;mon Centre channel. Take them off your team until then.</li>` +
			`<li>Winning also earns <b>team EXP</b>: give it to any Pok&eacute;mon with <code>!share</code>, then raise its level here to match.</li>` +
			`</ul>`) +

		step('Something went wrong?',
			`<ul style="margin:0;padding-left:18px">` +
			`<li><b>No challenge came:</b> check your name here matches <code>!showdown</code>, and that this page is open. ` +
			`If the site was asleep it takes about a minute to wake up; just try again.</li>` +
			`<li><b>Declined it by accident:</b> use <code>!encounter</code> again. The same one comes back.</li>` +
			`<li><b>"Your team is invalid":</b> the team's format must be <b>[Gen 9] RP Battle</b>.</li>` +
			`<li><b>"This RP battle is called off":</b> your team doesn't match your box. Fix what it lists, then <code>!encounter</code> again: the same one comes back.</li>` +
			`<li><b>Still stuck:</b> ask in this room, or ask Sam or Saku.</li>` +
			`</ul>`) +
		`</div>`;
}

function roleplay() {
	const rp = require('../../../src/rp-server');
	const E = require('../../../src/encounters');

	const room = makeRoom('Roleplay', {
		isPrivate: false,
		modjoin: false,
		modchat: false,
		autojoin: false,
		introMessage: roleplayIntro(),
	});
	if (room) console.log('[roleplay] the roleplay room is open');

	/*
	 * Names the RP bot may take without an account.
	 *
	 * Its trainers are called things like "Hiker Bob", and some of those are
	 * somebody's registered Showdown name. Only a name belonging to an encounter
	 * that was just rolled - or that name with a number after it, in case the
	 * plain one is taken - and only from this machine.
	 */
	const allowed = new Set([toID(RP_BOT)]);
	const proto = Users && Users.User && Users.User.prototype;
	if (proto && proto.validateToken && !proto.velvetRpNames) {
		proto.velvetRpNames = true;
		const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
		const original = proto.validateToken;
		proto.validateToken = function (token, name, userid, connection) {
			const local = connection && LOOPBACK.includes(connection.ip);
			if (!token && local && rolled(userid)) {
				return Promise.resolve('1');
			}
			return original.call(this, token, name, userid, connection);
		};
	}
	function rolled(userid) {
		return [...allowed].some(id => rp.isEncounterName(id, userid));
	}
	isRpBot = user => rolled(user.id) && rp.isLocalOnly(user);

	/*
	 * Put the player and the encounter's own account into a battle, once that
	 * account has finished logging in. Nobody accepts anything: the room simply
	 * opens, the same as a battle between two players.
	 *
	 * The account is found by the rule it logs in under (rp.encounterAccount):
	 * "Hiker Bob", or "Hiker Bob42" when a person has the plain name, and only
	 * from this machine. Looking up the exact name missed the renamed bot, and
	 * could have seated the person (23 Sep 2026).
	 *
	 * A battle that could not be opened closes the encounter as an error, with
	 * the reason, and sends the waiting opponent home: otherwise it stood in
	 * the Roleplay room for five minutes, and the encounter stayed "waiting",
	 * so the next !encounter came back as "still waiting from before" with no
	 * room and nothing on Discord to settle it (23 Sep 2026).
	 */
	async function openEncounter(enc, spawn) {
		const until = Date.now() + 20000;
		const failed = (why, message) => {
			console.log(`[roleplay] open encounter ${enc.id}: ${why}`);
			if (enc.status === 'waiting') {
				enc.status = 'error';
				enc.result = { outcome: 'error', message };
			}
			deps.cancel(enc);
			return null;
		};
		let bot = null;
		let player = null;
		while (Date.now() < until) {
			// Closed while we waited: the RP bot refused it (too many battles at
			// once, /rpbusy) or staff finished it. Nothing to wait for any more.
			if (enc.status !== 'waiting') {
				return failed(`no longer waiting (${enc.status})`, (enc.result && enc.result.message) || 'The encounter was closed.');
			}
			bot = rp.encounterAccount(Users.users.values(), spawn.name);
			player = Users.get(toID(enc.showdown));
			if (bot && player && player.connected) {
				let room = null;
				try {
					room = Rooms.createBattle({
						format: enc.format,
						players: [
							{ user: bot, team: spawn.team },
							{ user: player, team: Teams.pack(enc.playerTeam) },
						],
						rated: 0,
					});
				} catch (e) {
					return failed(`the battle would not open: ${e.stack || e.message}`, 'The battle server would not open the battle.');
				}
				if (!room) return failed('the battle would not open (no room)', 'The battle server would not open the battle (it may be restarting).');
				enc.roomid = room.roomid;
				player.popup(`|html|<b>Your encounter is ready.</b><br />It is open in front of you - nothing to accept.`);
				return room.roomid;
			}
			await new Promise(done => setTimeout(done, 400));
		}
		if (!player || !player.connected) {
			return failed('the player went offline', `${enc.showdown} is not on Showdown right now.`);
		}
		return failed('the opponent never came online', 'The encounter\'s opponent never logged in.');
	}
	/*
	 * Encounters being opened, by id, so the /rp/encounter answer can wait for
	 * the room and hand Discord its link (rp-server.js httpRoute, deps.opening).
	 */
	const openings = new Map();
	// The same, for as long as openEncounter is still running (spawn, below).
	const inFlight = new Map();
	/*
	 * The RP bot turned an encounter down because it is already running as
	 * many as it may (src/rp-bot.js MAX_LIVE). It says so with /rpbusy, and the
	 * encounter closes with that reason: an open stops waiting for an opponent
	 * that isn't coming, and Discord is told rather than left saying "you've
	 * been challenged" (23 Sep 2026).
	 */
	rpBusy = id => {
		const enc = rp.encounters.get(id);
		if (!enc || enc.status !== 'waiting') return;
		enc.status = 'error';
		enc.result = { outcome: 'error', message: 'The RP bot is running a lot of battles right now. Try !encounter again in a few minutes.' };
	};

	const deps = {
		isOnline: userid => {
			const user = Users.get(userid);
			return !!(user && user.connected);
		},
		spawn: enc => {
			const guide = Users.get(toID(RP_BOT));
			if (!guide || !guide.connected) {
				enc.status = 'error';
				enc.result = { outcome: 'error', message: 'The RP bot is not connected. Try again in a minute.' };
				return false;
			}
			allowed.add(toID(enc.name));
			const spawn = {
				id: enc.id, target: enc.showdown, name: enc.name, avatar: enc.avatar, format: enc.format,
				team: Teams.pack(enc.team), ai: enc.ai, kind: enc.kind, character: enc.character, balls: enc.balls, items: enc.items || null,
				className: enc.className || null, classId: enc.classId || null, warning: enc.warning || '',
				// The challenger's badges: a gym leader's Z-Moves, Dynamax and Tera wait for the fifth gym (src/rp-bot.js).
				badges: enc.badges || 0,
				// The player picked a team on Discord, so this one is opened rather
				// than challenged: the bot waits to be put in a room (src/rp-bot.js).
				open: !!enc.playerTeam,
			};
			// Straight down the bot's socket, as a PM from the server itself. A
			// player can't send one of these: a PM they type starting with "/" is
			// run as a command, and the bot only listens to "~".
			guide.send(`|pm|~|${guide.getIdentity()}|/rpspawn ${JSON.stringify(spawn)}`);
			/*
			 * With a team from Discord, the encounter is opened here rather than
			 * challenged. The opponent logs in as its own account first, which
			 * takes a moment, so this waits for it; the answer to Discord waits
			 * too, so it can post the room's link (deps.opening).
			 */
			if (enc.playerTeam) {
				/*
				 * Asked again while the first open is still waiting for the bot:
				 * the same wait answers both, rather than a second loop opening a
				 * second room with the same two people in it (23 Sep 2026).
				 */
				let pending = inFlight.get(enc.id);
				if (!pending) {
					pending = openEncounter(enc, spawn).finally(() => inFlight.delete(enc.id));
					inFlight.set(enc.id, pending);
				}
				openings.set(enc.id, pending);
			}
			return true;
		},
		/*
		 * The room an opened encounter landed in: its id, null if it could not be
		 * opened, or undefined when this encounter was a challenge all along.
		 */
		opening: id => {
			const pending = openings.get(id);
			openings.delete(id);
			return pending;
		},
	};
	tutorialDeps = deps;
	/*
	 * Put two people in a battle they already agreed to on Discord.
	 *
	 * The bot has both teams (each player picked one there) and both names, so
	 * there is nothing left to negotiate: Rooms.createBattle joins both of them
	 * into the room itself, which is why nobody has to accept anything here.
	 * Both must be online - a battle cannot open in front of somebody who is not
	 * looking - and whoever is missing is named rather than guessed at.
	 */
	deps.match = ({ players, format }) => {
		const seats = [];
		const missing = [];
		for (const side of players) {
			const user = Users.get(toID(side.showdown));
			if (!user || !user.connected) { missing.push(side.showdown); continue; }
			seats.push({ side, user });
		}
		if (missing.length) {
			return { ok: false, code: 'offline', message: `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not on Showdown right now.`, missing };
		}
		if (seats[0].user === seats[1].user) {
			return { ok: false, code: 'same', message: 'Both sides are the same Showdown account, and an account cannot battle itself.' };
		}
		const packed = seats.map(({ side, user }) => {
			let team;
			try { team = Teams.pack(side.team); } catch (e) { team = null; }
			return team ? { user, team } : { user };
		});
		if (packed.some(p => !p.team)) return { ok: false, code: 'bad', message: "I couldn't read one of those teams." };
		const room = Rooms.createBattle({ format, players: packed, rated: 0 });
		if (!room) return { ok: false, code: 'error', message: 'The server would not open a battle just now (it may be restarting).' };
		for (const { user } of seats) {
			user.popup(`|html|<b>Your RP battle is ready.</b><br />It is open in front of you - no challenge to accept.`);
		}
		// The bot puts its own host in front of the room id when it posts the link.
		return { ok: true, roomid: room.roomid };
	};
	deps.cancel = enc => {
		const guide = Users.get(toID(RP_BOT));
		if (guide && guide.connected) guide.send(`|pm|~|${guide.getIdentity()}|/rpcancel ${enc.id}`);
	};
	require('../../../src/http-hooks').addRoute(rp.httpRoute(deps, msg => console.log('[roleplay]', msg)));

	const battle = Rooms.RoomBattle && Rooms.RoomBattle.prototype;
	if (!battle || battle.velvetRoleplay) return;
	battle.velvetRoleplay = true;

	/** The encounter a battle belongs to: same format, the player, and the bot's name. */
	const encounterFor = game => {
		const ids = game.players.map(p => p.id);
		for (const enc of rp.encounters.values()) {
			if (enc.status !== 'waiting' || enc.format !== game.format || !ids.includes(enc.userid)) continue;
			const botId = toID(enc.name);
			if (ids.some(id => id !== enc.userid && id.startsWith(botId))) return enc;
		}
		return null;
	};

	// Each player's team as it was sent in, so an RP encounter can check it against the box.
	const addPlayer = battle.addPlayer;
	battle.addPlayer = function (user, playerOpts, ...rest) {
		try {
			const id = user && typeof user === 'object' ? user.id : toID(user);
			if (id && playerOpts && playerOpts.team) (this.rpTeams || (this.rpTeams = {}))[id] = playerOpts.team;
		} catch (e) { /* only ever used for the check */ }
		return addPlayer.call(this, user, playerOpts, ...rest);
	};

	/*
	 * A panel for one player, delivered with their battle request.
	 *
	 * The battle starts before its players have joined the room, and a message to
	 * a room only reaches connections already in it - so the item panel sent at the
	 * start went nowhere. A player's request is sent the same way, the moment it
	 * exists, and it arrives; so the panel waits for that request and goes out
	 * right behind it.
	 */
	// The item panel is re-sent with every new turn's request, so its buttons
	// follow who is hurt or fainted and the counts follow what was used.
	const sendPanel = (player, bag) => {
		const game = player && player.game;
		if (!game) return;
		(game.rpPanels || (game.rpPanels = {}))[player.slot] = bag;
	};
	const receive = battle.receive;
	battle.receive = function (lines) {
		const out = receive.call(this, lines);
		try {
			/*
			 * The Poké Balls pocket of the battle Bag (client/js/velvet-data.js
			 * installBagMenu): what this character has left, every turn, for the
			 * player only. The client moves it out of the chat into the Bag menu,
			 * next to Fight, where a button can't scroll away.
			 */
			if (lines[0] === 'sideupdate' && this.rpEncounter && String(lines[2]).startsWith('|request|') && this[lines[1]]) {
				const player = this[lines[1]];
				const enc = rp.encounters.get(this.rpEncounter);
				const request = JSON.parse(String(lines[2]).slice(9) || 'null');
				if (enc && toID(player.id) === enc.userid && request && !request.wait && !request.teamPreview && !request.forceSwitch) {
					const E = require('../../../src/encounters');
					const log = this.room.log.log;
					const balls = E.BALLS.map(b => {
						const have = enc.balls ? (enc.balls[b.id] || 0) - rp.thrownInLog(log, player.name, b.name) : null;
						return have === null || have > 0 ? `<button class="button" name="send" value="/throwball ${b.id}"${b.note ? ` title="${String(b.note).replace(/"/g, '&quot;')}"` : ''}>${b.name}${have === null ? '' : ` ×${have}`}</button>` : '';
					}).filter(Boolean).join(' ');
					const escapes = E.BATTLE_ITEMS.filter(it => it.escape).map(it => {
						const n = enc.items ? (enc.items[it.id] || 0) - rp.usedInLog(log, player.name, it.name) : 0;
						return n > 0 ? `<button class="button" name="send" value="/run ${it.id}">${it.name} ×${n}</button>` : '';
					}).filter(Boolean).join(' ');
					/*
					 * A trainer is not a wild Pokemon, and the panel says so instead of
					 * offering two things that will be refused (23 Sep 2026: a player
					 * pressed Run in a trainer battle and sat on "waiting for opponent"
					 * for five minutes). The balls stay on show - it is still their bag,
					 * and knowing what is in it matters - but with no `name="send"` they
					 * do nothing, and the only way out of a person's battle is the one
					 * the RP actually honours: forfeit.
					 */
					if (enc.kind !== 'wild') {
						const shown = E.BALLS.map(ball => {
							const have = enc.balls ? (enc.balls[ball.id] || 0) - rp.thrownInLog(log, player.name, ball.name) : null;
							return have === null || have > 0 ? `<button class="button disabled" title="A trainer's Pokémon can't be caught">${ball.name}${have === null ? '' : ` ×${have}`}</button>` : '';
						}).filter(Boolean).join(' ');
						player.sendRoom(`|uhtml|rpballs|<div class="infobox rp-balls" style="margin:4px 0"><b>Pokéballs:</b> ${shown || '<small>none</small>'}` +
							`<div><small>These do nothing here: <b>a trainer's Pokémon can't be caught</b>, and you can't run from a person.</small></div>` +
							`<div style="margin-top:4px"><b>Had enough?</b> <button class="button" name="send" value="/forfeit">Forfeit</button> ` +
							`<small>the RP settles it as a loss.</small></div></div>`);
					} else {
						player.sendRoom(`|uhtml|rpballs|<div class="infobox rp-balls" style="margin:4px 0"><b>Pokéballs:</b> ${balls || '<small>none left - buy some with !buy on Discord</small>'}` +
							(escapes ? `<div><b>Getting away:</b> ${escapes}</div>` : '') + '</div>');
					}
				}
			}
			// What applies to this player in a PvP or NPC battle, once, right behind their first request.
			if (lines[0] === 'sideupdate' && this.rpNotes && this.rpNotes[lines[1]] && String(lines[2]).startsWith('|request|') && this[lines[1]]) {
				this[lines[1]].sendRoom(this.rpNotes[lines[1]]);
				delete this.rpNotes[lines[1]];
			}
			if (lines[0] === 'sideupdate' && this.rpPanels && this.rpPanels[lines[1]] && String(lines[2]).startsWith('|request|')) {
				const player = this[lines[1]];
				const request = JSON.parse(String(lines[2]).slice(9) || 'null');
				if (player && request && !request.wait && !request.update && !request.teamPreview && !request.forceSwitch && request.side) {
					const bag = this.rpPanels[lines[1]].map(([id, n]) => {
						if (typeof n !== 'number') return [id, n];
						const item = require('../../../src/encounters').findBattleItem(id);
						return [id, Math.max(0, n - (item ? rp.usedInLog(this.room.log.log, player.name, item.name) : 0))];
					}).filter(([, n]) => n !== 0);
					// Benched Pokémon that have used PP: they used a move since their PP was last restored.
					const been = new Set();
					for (const l of this.room.log.log) {
						const moved = l.startsWith(`|move|${lines[1]}`) && /^\|move\|p\d[a-z]: ([^|]+)\|/.exec(l);
						if (moved) been.add(moved[1]);
						const restored = /^\|-message\|(.+?)(?:'s .+ had its PP restored|'s PP was restored)\.$/.exec(l);
						if (restored) been.delete(restored[1]);
					}
					const html = (bag.length && itemPanel(bag, request.side.pokemon, request.active, been)) || '<div class="infobox" style="margin:4px 0"><small>No items left in your bag.</small></div>';
					player.sendRoom(`|uhtml|rpitems|${html}`);
				}
			}
		} catch (e) { console.log(`[roleplay] panel: ${e.message}`); }
		return out;
	};

	const start = battle.start;
	battle.start = function (...args) {
		const out = start.apply(this, args);
		void ladderBadges(this);
		try {
			const enc = encounterFor(this);
			if (enc) {
				enc.status = 'battling';
				enc.roomid = this.room.roomid;
				this.rpEncounter = enc.id;

				// A team that doesn't match the character's box calls the battle off
				// before a turn is played. The encounter stays open, so fixing the team
				// and asking again brings the same one back.
				const raw = this.rpTeams && this.rpTeams[enc.userid];
				let sets = null;
				try { sets = typeof raw === 'string' ? (raw.trim().startsWith('[') ? JSON.parse(raw) : Teams.unpack(raw)) : raw; } catch (e) { sets = null; }
				const check = rp.checkTeam(enc, sets);
				if (!check.ok) {
					const list = check.problems.slice(0, 6);
					const message = list.join('; ').replace(/\*\*/g, '') + (check.problems.length > list.length ? ` (and ${check.problems.length - list.length} more)` : '') + '.';
					enc.invalid = { at: Date.now(), message: list.join('; ') + '.' };
					enc.status = 'waiting';
					this.rpEncounter = null;
					this.rpInvalid = true;
					this.room.add(`|raw|<div class="broadcast-red"><b>This RP battle is called off: your team doesn't match your box.</b><br />${message.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)}<br />` +
						`Fix the team in the Teambuilder (only Pok&eacute;mon your character owns, at or below their box level), then use <code>!encounter</code> on Discord again. The same encounter comes back.</div>`);
					this.room.update();
					void this.stream.write('>forcetie');
					return out;
				}
				// The medicine panel, for the player only.
				const player = this.playerTable[enc.userid];
				const bag = enc.items ? Object.entries(enc.items).filter(([, n]) => n > 0) : [];
				if (player && bag.length) sendPanel(player, bag);
			} else if (RP_PVP_FORMATS.has(this.format)) {
				/*
				 * Players battling each other, or a player and an NPC (Patch 1.5): each
				 * team is checked against its character's box like an encounter, and a
				 * battle that doesn't pass is called off before a turn. Each player is
				 * told what applies to them: their character, items and locks.
				 */
				const teamOf = (userid) => {
					const raw = this.rpTeams && this.rpTeams[userid];
					try { return typeof raw === 'string' ? (raw.trim().startsWith('[') ? JSON.parse(raw) : Teams.unpack(raw)) : raw; } catch (e) { return null; }
				};
				// Agreed on Discord with `!pvp`? Then it is checked and it counts. If not
				// it is a friendly: any team, every gimmick, and nothing recorded either side.
				this.rpFriendly = !rp.isAgreed(this.players.map(p => p.id));
				const { problems, notes } = rp.pvpCheck(this.players, teamOf, !this.rpFriendly);
				const esc = (text) => String(text).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n').join('<br />');
				if (problems.length) {
					this.rpInvalid = true;
					this.room.add(`|raw|<div class="broadcast-red"><b>This RP battle is called off.</b><br />${problems.slice(0, 8).map(esc).join('<br />')}<br />` +
						`Fix the team in the Teambuilder (only Pok&eacute;mon your character owns, at or below their box level), then challenge again. For anything-goes battles use <b>[Gen 9] RP Custom Game</b>.</div>`);
					this.room.update();
					void this.stream.write('>forcetie');
					return out;
				}
				// Delivered with each player's first request (see sendPanel: the room is empty at the start).
				this.rpNotes = {};
				for (const player of this.players) {
					const note = notes.get(player.id);
					// The only way out of a battle with a person, said once, where they can see it.
					const out = '<div style="margin-top:4px"><b>Had enough?</b> <button class="button" name="send" value="/forfeit">Forfeit</button> ' +
						'<small>you cannot run from a trainer; the RP settles a forfeit as a loss.</small></div>';
					if (note && player.slot) this.rpNotes[player.slot] = `|raw|<div class="infobox"><small>${esc(note)}</small>${out}</div>`;
				}
				// Players battling each other: each sees a panel of their own character's items.
				for (const player of this.players) {
					const items = rp.pvpItemsFor(player.id);
					const bag = items ? Object.entries(items).filter(([, n]) => n > 0) : [];
					if (bag.length) sendPanel(player, bag);
				}
			} else if (this.format === 'gen9rpcustomgame') {
				// RP Custom Game: every item, unlimited, for everyone.
				const E = require('../../../src/encounters');
				const every = E.BATTLE_ITEMS.map(item => [item.id, '∞']);
				for (const player of this.players) sendPanel(player, every);
			}
		} catch (e) { console.log(`[roleplay] ${e.message}`); }
		return out;
	};

	/** The team a player brought, as { species, level }: from the team sent in, so benched Pokémon count too. */
	const partyOf = (game, userid) => {
		try {
			const raw = game.rpTeams && game.rpTeams[userid];
			const sets = typeof raw === 'string' ? (raw.trim().startsWith('[') ? JSON.parse(raw) : Teams.unpack(raw)) : raw;
			return Array.isArray(sets) ? sets.map(set => ({ species: set.species || set.name, level: Number(set.level) || 100 })) : null;
		} catch (e) { return null; }
	};
	const withParties = (game, sides) => {
		for (const [id, side] of Object.entries(sides)) {
			const party = partyOf(game, id);
			if (party) side.party = party;
		}
		return sides;
	};
	const end = battle.end;
	battle.end = function (winnerName, ...rest) {
		const wasEnded = this.ended;
		let replay = null;
		let enc = null;
		try {
			// Every RP battle keeps a replay, so it can be posted on Discord - PvP
			// ones included. The name is known before the upload finishes.
			if (!wasEnded && /^gen\d+rp/.test(this.format) && !this.rpInvalid) {
				const boot = typeof LoginServer !== 'undefined' && LoginServer.velvetReplayBoot;
				const { id } = this.room.getReplayData();
				if (boot && id) replay = `/replay/${id}-${boot}`;
			}
			enc = this.rpEncounter && rp.encounters.get(this.rpEncounter);
			if (enc && !wasEnded && enc.status !== 'done') {
				// party: the whole team the player brought, benched Pokémon included (party EXP goes to all of it).
				enc.result = { ...rp.resultFromLog(enc, this.room.log.log, toID(winnerName)), replay, party: partyOf(this, enc.userid) };
				enc.status = 'done';
			}
		} catch (e) { console.log(`[roleplay] ${e.message}`); }
		const out = end.call(this, winnerName, ...rest);
		if (replay && !wasEnded) {
			try {
				if (!(enc && enc.tutorial)) rp.recordFinished({
					kind: enc ? enc.kind : 'pvp',
					format: this.format,
					players: this.players.map(p => p.name),
					winner: winnerName || '',
					replay,
					// Each player's team and who ended fainted: NPC trainer battles and the Hall of Fame use them on Discord.
					sides: withParties(this, rp.sidesInLog(this.room.log.log)),
					encounter: enc ? rp.publicView(enc) : null,
				});
				if (!this.replaySaved) void this.room.uploadReplay(undefined, undefined, 'silent');
			} catch (e) { console.log(`[roleplay] replay: ${e.message}`); }
		}
		return out;
	};

	// A ball only comes from /throwball, which checks the bag first. Typing the
	// choice by hand would skip that check.
	const choose = battle.choose;
	battle.choose = function (user, data) {
		if (RP_FORMATS.has(this.format) && /(^|,)\s*ball\b/i.test(String(data)) && this.rpBallFrom !== user.id) {
			const player = this.playerTable[user.id];
			if (player) player.sendRoom(`|error|[Invalid choice] Open the Bag under your moves to throw a ball`);
			return;
		}
		// Gimmicks need the story item: no Key Stone, no Mega Evolution, and so on.
		// In PvP and NPC battles too (Patch 1.5), from the bag table; NPCs are free.
		if (RP_PVP_FORMATS.has(this.format) && !this.rpEncounter && !this.rpFriendly) {
			const bag = rp.bagFor(user.id);
			const used = bag && bag.gimmicks && !bag.npc && rp.gimmickIn(data);
			if (used && !bag.gimmicks[used]) {
				const player = this.playerTable[user.id];
				if (player) player.sendRoom(`|error|[Invalid choice] ${bag.character} can't ${rp.GIMMICK_NAME[used]} without ${rp.GIMMICK_ITEM[used]}. The story hands it out; choose again without it.`);
				return;
			}
		}
		const enc = this.rpEncounter && rp.encounters.get(this.rpEncounter);
		if (enc && enc.gimmicks && user.id === enc.userid) {
			const used = rp.gimmickIn(data);
			if (used && !enc.gimmicks[used]) {
				const player = this.playerTable[user.id];
				if (player) player.sendRoom(`|error|[Invalid choice] ${enc.character || 'Your character'} can't ${rp.GIMMICK_NAME[used]} without ${rp.GIMMICK_ITEM[used]}. The story hands it out; choose again without it.`);
				return;
			}
		}
		// Same for items: only /useitem, which checks the bag, may send one.
		if (/^\s*item\s/i.test(String(data)) && this.rpItemFrom !== user.id) {
			const player = this.playerTable[user.id];
			if (player) player.sendRoom(`|error|[Invalid choice] Open the Bag under your moves to use an item`);
			return;
		}
		return choose.call(this, user, data);
	};
}

/**
 * The friends database, opened here rather than in a child process.
 *
 * Showdown only ever talks to it through a process manager: every query is
 * posted to the child, which runs one of a fixed set of prepared statements and
 * posts the answer back. With no child, `query` simply answers null and the
 * friends system goes quietly dead - which is how it was found the first time.
 *
 * So this does in this process exactly what the child does at startup - Showdown's
 * own setupDatabase(), same file, same schema, same statements - and points
 * `query` at the same handler the child would have run, error handling included.
 * The rest of the friends code, the commands and the pages, cannot tell the
 * difference. The one thing that does change is that a query now runs on this
 * process's thread, and these are single-row lookups on a tiny local file.
 */
function friendsInProcess() {
	if (!FRIENDS || FRIENDS_CHILD) return;
	if (typeof Chat === 'undefined' || !Chat.Friends || Chat.Friends.velvetInProcess) return;
	try {
		const friends = require('../dist/server/friends');
		friends.FriendsDatabase.setupDatabase();
		const handle = friends.PM._query;
		Chat.Friends.query = async function (input) {
			if (!Config.usesqlite || !Config.usesqlitefriends) return null;
			const result = handle(input);
			if (result.error) throw new Chat.ErrorMessage(result.error);
			return result.result;
		};
		Chat.Friends.velvetInProcess = true;
		console.log('[config] friends database opened in this process; no child process for it');
	} catch (e) {
		// Left as it was: queries answer null and nothing else is affected.
		console.log(`[config] could not open the friends database: ${e.message}`);
	}
}

exports.startuphook = function () {
	const botId = toID(process.env.PS_BOT_NAME || 'Velvet Bunny');
	// The people who run the place. Promoted the same way as the bot and for the
	// same reason: with no login server, anyone listed in usergroups.csv counts
	// as trusted and is then refused a guest login entirely.
	const owners = (process.env.PS_OWNERS || 'SlimeQueenSamantha')
		.split(',').map(n => toID(n)).filter(n => n);
	// Global administrators: everything short of owner.
	const admins = (process.env.PS_ADMINS || 'Unseen Face,Keiko_Sama')
		.split(',').map(n => toID(n)).filter(n => n);
	// Staff who help run the place, but do not own it.
	// Global moderators: the real staff rank below Administrator. They moderate
	// every room, and cannot reach the console, the lockdown or promotion.
	const mods = (process.env.PS_MODS || '')
		.split(',').map(n => toID(n)).filter(n => n);
	// Voiced regulars. Same reasoning as the owners: this cannot go in
	// usergroups.csv without locking them out of logging in at all.
	const voiced = (process.env.PS_VOICED || 'dana3166,Lady Milim,Simia Ignis,lavit,thegloriousfemboy')
		.split(',').map(n => toID(n)).filter(n => n);
	// Every account the bot plays under, worked out once at the top of this file
	// from the same module the queues name themselves with. When these were worked
	// out separately they disagreed, and the rules below applied to nobody.
	const botIds = BOT_IDS;

	const savedCount = Object.keys(savedRanks).length;
	if (savedCount) console.log(`[config] ${savedCount} remembered rank(s) restored`);

	fixMatchmaking(BOT_IDS);
	summonBots(BOT_IDS);
	exemptBots(BOT_IDS);
	botLadderPlateaus();
	hostReplays();
	friendsInProcess();
	// Before anyone connects: the first connection is what builds the list.
	require('../../../src/format-levels').installFormatList({
		Rooms, Dex, log: msg => console.log(msg),
	});
	rpSectionFirst();
	everyTierLadderable();
	battleLog();
	helpRoom();
	// Chat's commands may not all be loaded yet at startup; try again shortly if not.
	if (!serverHelp()) setTimeout(serverHelp, 3000).unref();
	if (!rpDataByDefault()) setTimeout(rpDataByDefault, 3000).unref();
	roleplay();
	rpBattlesToRoleplay();
	replaySnapshots();
	goodbye();

	setInterval(() => {
		// Bot rank for the bot, which is what it is for. It can post the lobby
		// format picker because the bot group is granted editroom above, rather
		// than because it was handed the keys to the server.
		for (const id of botIds) {
			const bot = Users.get(id);
			if (bot && bot.connected && bot.tempGroup !== '*') {
				bot.setGroup('*');
				console.log(`[config] ${id} is now a global bot`);
			}
		}
		// Showdown blocks private messages for anyone who is neither registered
		// nor autoconfirmed. With no login server nobody can ever be either, which
		// would leave the difficulty picker unreachable - so on this server every
		// guest counts as autoconfirmed.
		for (const user of Users.users.values()) {
			if (!user.connected) continue;
			if (!user.autoconfirmed) user.autoconfirmed = user.id;
			// The avatar someone has been given, actually put on them.
			//
			// Showdown applies it in handleLogin, which only runs for registered
			// accounts - and with no login server every account here is a guest, so
			// it never ran for anyone. Being granted an avatar meant being allowed to
			// go and ask for it, which is not what granting one is supposed to mean.
			// What goes on is whatever they picked, falling back to what they were
			// given, so this puts an avatar on and never takes one back off.
			applyAvatar(user);
			if (botIds.has(user.id)) continue;   // ranks for the bot are handled above
			if (isRpBot(user)) {
				// The RP Guide and its wild Pokémon and trainers are bots too.
				if (user.tempGroup !== '*') {
					user.setGroup('*');
					try { user.updateIdentity(); user.update(); } catch (e) { /* on their way out */ }
				}
				continue;
			}

			// The rank this account is supposed to have: whatever was last set for
			// them in chat, otherwise whatever the config declares. Owners are the
			// exception and always come from the config - a server that can be
			// permanently demoted out of its own ownership by one mistyped command is
			// a server nobody can get back into.
			const declared = owners.includes(user.id) ? '&'
				: admins.includes(user.id) ? '~'
				: mods.includes(user.id) ? '@'
				: voiced.includes(user.id) ? '+'
				: null;
			const want = owners.includes(user.id) ? '&' : (savedRanks[user.id] || declared);
			const now = user.tempGroup;

			if (lastApplied.has(user.id) && now !== lastApplied.get(user.id) && now !== want) {
				// Someone changed it since the last pass, so that is the new answer.
				// Recording it here is what makes /globalpromote outlive the session.
				if (now === Users.Auth.defaultSymbol()) delete savedRanks[user.id];
				else savedRanks[user.id] = now;
				saveRanks(savedRanks);
				lastApplied.set(user.id, now);
				console.log(`[config] remembered ${user.id} as ${now === Users.Auth.defaultSymbol() ? 'a regular user' : now}`);
			}
			else if (want && now !== want) {
				user.setGroup(want);
				// setGroup changes the rank and tells nobody. The rooms carry the symbol
				// in front of the name and the client keeps its own copy, so without
				// these two the rank is real and invisible until they rejoin.
				try { user.updateIdentity(); user.update(); } catch (e) { /* on their way out */ }
				lastApplied.set(user.id, want);
				console.log(`[config] ${user.id} is ${want}${savedRanks[user.id] ? ' (remembered)' : ''}`);
			}
			else {
				lastApplied.set(user.id, now);
			}
		}
	}, 2000).unref();
};
