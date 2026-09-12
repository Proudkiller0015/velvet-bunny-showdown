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
exports.startuphook = function () {
	const botId = toID(process.env.PS_BOT_NAME || 'Velvet Bunny');
	// The people who run the place. Promoted the same way as the bot and for the
	// same reason: with no login server, anyone listed in usergroups.csv counts
	// as trusted and is then refused a guest login entirely.
	const owners = (process.env.PS_OWNERS || 'Unseen Face,SlimeQueenSamantha')
		.split(',').map(n => toID(n)).filter(n => n);
	// Staff who help run the place, but do not own it.
	const admins = (process.env.PS_ADMINS || '')
		.split(',').map(n => toID(n)).filter(n => n);
	// Voiced regulars. Same reasoning as the owners: this cannot go in
	// usergroups.csv without locking them out of logging in at all.
	const voiced = (process.env.PS_VOICED || 'dana3166')
		.split(',').map(n => toID(n)).filter(n => n);
	// Every account the bot plays under, including one per ladder queue.
	const botIds = new Set([botId]);
	for (const d of (process.env.PS_LADDER_DIFFICULTIES || 'easy,normal,hard,champion').split(',')) {
		const name = d.trim();
		if (name) botIds.add(toID(`${process.env.PS_BOT_NAME || 'Velvet Bunny'} ${name}`));
	}

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
			if (botIds.has(user.id)) continue;   // handled above
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
