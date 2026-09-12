'use strict';
/**
 * Showdown only reads its config from inside its own package directory, which
 * npm owns and will happily wipe on reinstall. So the real config lives in
 * config/showdown-config.js here and is copied into place before every boot.
 *
 * The bot account is also granted admin in usergroups.csv so it can post the
 * difficulty picker as an HTML box rather than a wall of text.
 */

const fs = require('fs');
const path = require('path');

const pkgRoot = path.dirname(require.resolve('pokemon-showdown/package.json'));
const target = path.join(pkgRoot, 'config', 'config.js');
const source = path.join(__dirname, '..', 'config', 'showdown-config.js');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`config -> ${target}`);

// Showdown writes logs eagerly and crashes on boot if the directories are not
// already there - npm does not ship empty directories, so make them.
for (const dir of ['logs', 'logs/chat', 'logs/modlog', 'logs/repl', 'logs/responder', 'config/chat-plugins', 'databases']) {
	fs.mkdirSync(path.join(pkgRoot, dir), { recursive: true });
}
for (const file of ['logs/errors.txt', 'logs/chatlog-access.txt']) {
	const p = path.join(pkgRoot, file);
	if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

// Deliberately empty. Listing the bot here would mark it trusted, and a trusted
// account cannot log in without a login server - see the startuphook in
// config/showdown-config.js, which promotes it at runtime instead.
const usergroups = path.join(pkgRoot, 'config', 'usergroups.csv');
fs.writeFileSync(usergroups, '');
console.log(`usergroups -> ${usergroups} (empty; the bot is promoted at runtime)`);

// ---------------------------------------------------------------- the client
// Our own build goes at /play/, NOT at the root.
//
// The root keeps Showdown's stock page, which bounces players into the official
// client. That client can sign them in with their real Pokemon Showdown account
// and shows the real news; ours cannot, because signing in means talking to
// Smogon's login server, and their cross-domain bridge only answers for hosts
// they have whitelisted. Ours is worth keeping for the main-menu bot panel, but
// it is the alternative rather than the default.
//
// The bot menu itself does not depend on either: it is published as the lobby's
// room introduction, which is server-side HTML and shows up in any client.
// An earlier version of this script copied the client over the package's own
// server/static, overwriting its index.html. node_modules survives between
// deploys, so that overwrite outlived the change that stopped doing it and the
// root kept serving our client - which cannot sign anyone in. Restore the stock
// page from our copy every boot, rather than trusting the package to be intact.
const stockPage = path.join(__dirname, '..', 'server-static', 'index.html');
if (fs.existsSync(stockPage)) {
	fs.mkdirSync(path.join(pkgRoot, 'server', 'static'), { recursive: true });
	fs.copyFileSync(stockPage, path.join(pkgRoot, 'server', 'static', 'index.html'));
	console.log('root page -> restored to the stock redirect');
}

const clientSrc = path.join(__dirname, '..', 'client');
const clientDest = path.join(pkgRoot, 'server', 'static', 'play');
if (fs.existsSync(clientSrc)) {
	fs.cpSync(clientSrc, clientDest, { recursive: true, force: true });
	console.log(`client -> ${clientDest} (served at /play/)`);
} else {
	console.log('no client/ directory; only the stock page will be served');
}

// ---------------------------------------------------------------- avatars
// Custom avatars are served from the package's config/avatars, which npm owns,
// so they are copied in from avatars/ here the same way the config is.
const avatarSrc = path.join(__dirname, '..', 'avatars');
const avatarDest = path.join(pkgRoot, 'config', 'avatars');
if (fs.existsSync(avatarSrc)) {
	fs.mkdirSync(avatarDest, { recursive: true });
	for (const file of fs.readdirSync(avatarSrc)) {
		fs.copyFileSync(path.join(avatarSrc, file), path.join(avatarDest, file));
	}
	console.log(`avatars -> ${avatarDest} (${fs.readdirSync(avatarSrc).join(', ')})`);
}
