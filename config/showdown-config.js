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
exports.subprocesses = Number(process.env.PS_SUBPROCESSES || 0);

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
if (realAccounts) {
	// `loginserver` and the public key it is checked against are inherited from
	// Showdown's own config; only the forwarding has to be set up here.
	require('../../../src/http-hooks').installHttpHooks(msg => console.log('[login]', msg));
} else {
	// Open server: anyone picks a name and plays immediately, and nobody's name
	// is proof of anything.
	exports.noguestsecurity = true;
	exports.loginserver = '';
}
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
const { DEFAULT_FORMATS, DEFAULT_DIFFICULTIES } = require('../../../src/ladder-defaults');

const BOT_BASE = process.env.PS_BOT_NAME || 'Velvet Bunny';
const BOT_DIFFICULTIES = (process.env.PS_LADDER_DIFFICULTIES || DEFAULT_DIFFICULTIES.join(','))
	.split(',').map(d => d.trim()).filter(d => d);
const BOT_FORMATS = (process.env.PS_LADDER_FORMATS || DEFAULT_FORMATS.join(','))
	.split(',').map(f => f.trim()).filter(f => f);

const BOT_IDS = botAccountIds(BOT_BASE, BOT_DIFFICULTIES, BOT_FORMATS);
const BOT_RUNG = botDifficulties(BOT_BASE, BOT_DIFFICULTIES, BOT_FORMATS);
/** userid -> the rung they want to be matched against, or PVP for no bots. */
const wantedRung = new Map();
// Not a difficulty, so it can never match one: it is the absence of them.
const PVP = 'pvp';

exports.commands = {
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
	rank: 'setrank',
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

	LoginServer.request = async function (action, data) {
		if (action !== 'addreplay') return original(action, data);

		const id = String(data.id || '').trim();
		if (!id) return [{ errorip: 'no id' }, null];
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
function helpRoom() {
	const room = makeRoom('Help', {
		isPrivate: false,
		modjoin: false,
		modchat: false,
		autojoin: false,
		introMessage: '<h2>Help</h2>' +
			'<p>Ask here. Anything about this server, the custom Pok&eacute;mon and moves, ' +
			'the RP tiers, or Pok&eacute;mon Showdown itself.</p>' +
			'<p>This server is a custom Pok&eacute;mon Showdown server: your account is a real ' +
			'Showdown account, and you can also play without one. What is different here ' +
			'is the RP tiers, a house bot with a ladder of its own, a few buffed ' +
			'Pok&eacute;mon, and one that exists nowhere else.</p>',
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
	exemptBots(BOT_IDS);
	hostReplays();
	rpSectionFirst();
	battleLog();
	helpRoom();
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
