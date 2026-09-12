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
exports.grouplist = exports.grouplist.map(group => ({ ...group }));

const groupBySymbol = symbol => exports.grouplist.find(g => g.symbol === symbol);

const ownerGroup = groupBySymbol('~');
if (ownerGroup) ownerGroup.name = 'Owner';

// Bots post the lobby's format picker, and a room introduction is an edit to
// the room - a permission the bot rank does not carry, which is the only reason
// the bot was ever given anything higher.
const botGroup = groupBySymbol('*');
if (botGroup) botGroup.editroom = true;

if (!groupBySymbol('&')) {
	const ownerIndex = exports.grouplist.findIndex(g => g.symbol === '~');
	exports.grouplist.splice(ownerIndex + 1, 0, {
		symbol: '&',
		id: 'globaladmin',
		name: 'Admin',
		inherit: '@',
		jurisdiction: 'u',
		globalonly: true,

		editroom: true,
		declare: true,
		addhtml: true,
		globalban: true,
		rangeban: true,
		makeroom: true,
		gamemanagement: true,
		tournaments: true,
		disableladder: true,
		forcewin: true,
		bypassafktimer: true,
		// Everything up to moderator, so an owner is only ever made by an owner.
		promote: '★@*%+u',
	});
}

// Render and most hosts hand the port in through the environment.
exports.port = Number(process.env.PORT) || 8000;
exports.bindaddress = '0.0.0.0';
// Battles run in the main process. Each battle subprocess costs ~80MB, which
// on a 512MB free tier is the difference between booting and being OOM-killed.
// A casual server with a handful of concurrent battles does not need them.
exports.subprocesses = Number(process.env.PS_SUBPROCESSES || 0);

// No login server: anyone can pick a name and play immediately. This is a
// casual battle server, not a ladder, and there are no accounts to protect.
exports.noguestsecurity = true;
exports.loginserver = '';
exports.serverid = process.env.PS_SERVERID || 'velvetbunny';
exports.servertoken = '';

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

const BOT_BASE = process.env.PS_BOT_NAME || 'Velvet Bunny';
const BOT_DIFFICULTIES = (process.env.PS_LADDER_DIFFICULTIES || 'easy,normal,hard,champion,stockfish')
	.split(',').map(d => d.trim()).filter(d => d);
const BOT_FORMATS = (process.env.PS_LADDER_FORMATS || 'gen9randombattle')
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
	const owners = (process.env.PS_OWNERS || 'Unseen Face,SlimeQueenSamantha')
		.split(',').map(n => toID(n)).filter(n => n);
	// Staff who help run the place, but do not own it.
	const admins = (process.env.PS_ADMINS || 'Keiko_Sama')
		.split(',').map(n => toID(n)).filter(n => n);
	// Voiced regulars. Same reasoning as the owners: this cannot go in
	// usergroups.csv without locking them out of logging in at all.
	const voiced = (process.env.PS_VOICED || 'dana3166,Lady Milim')
		.split(',').map(n => toID(n)).filter(n => n);
	// Every account the bot plays under, worked out once at the top of this file
	// from the same module the queues name themselves with. When these were worked
	// out separately they disagreed, and the rules below applied to nobody.
	const botIds = BOT_IDS;

	fixMatchmaking(BOT_IDS);

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
			if (owners.includes(user.id) && user.tempGroup !== '~') {
				user.setGroup('~');
				console.log(`[config] ${user.id} is now an owner`);
			}
			else if (admins.includes(user.id) && user.tempGroup !== '&') {
				user.setGroup('&');
				console.log(`[config] ${user.id} is now an admin`);
			}
			// Only lift them up to voice, never down: this runs every couple of
			// seconds, and it should not undo a promotion someone made by hand.
			else if (voiced.includes(user.id) && user.tempGroup === Users.Auth.defaultSymbol()) {
				user.setGroup('+');
				console.log(`[config] gave ${user.id} voice`);
			}
		}
	}, 2000).unref();
};
