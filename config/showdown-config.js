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
	// Voiced regulars. Same reasoning as the owners: this cannot go in
	// usergroups.csv without locking them out of logging in at all.
	const voiced = (process.env.PS_VOICED || 'dana3166')
		.split(',').map(n => toID(n)).filter(n => n);

	// '~' is the highest global rank Showdown has - it carries the console, it
	// bypasses everything, and there is nothing above it - but it is labelled
	// Administrator. On a server with actual owners that reads as a job title
	// rather than ownership, so it is relabelled. Nothing about the rank changes.
	const top = Config.groups && Config.groups['~'];
	if (top && top.name === 'Administrator') top.name = 'Owner';
	setInterval(() => {
		const bot = Users.get(botId);
		// Top rank, not just bot rank: posting the lobby format picker as a room
		// introduction needs `declare`, which bot rank does not carry.
		if (bot && bot.connected && bot.tempGroup !== '~') {
			bot.setGroup('~');
			console.log(`[config] promoted ${botId} to owner`);
		}
		// Showdown blocks private messages for anyone who is neither registered
		// nor autoconfirmed. With no login server nobody can ever be either, which
		// would leave the difficulty picker unreachable - so on this server every
		// guest counts as autoconfirmed.
		for (const user of Users.users.values()) {
			if (!user.connected) continue;
			if (!user.autoconfirmed) user.autoconfirmed = user.id;
			if (owners.includes(user.id) && user.tempGroup !== '~') {
				user.setGroup('~');
				console.log(`[config] promoted ${user.id} to owner`);
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
