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
// Serve our own build of the Showdown client from this server, so players open
// the server's own URL and land straight in it - with the Challenge-the-bot
// panel on the main menu - instead of being bounced to a client hosted
// elsewhere. Showdown's static server serves ./server/static from the package
// root, so the build goes there, replacing the stock redirect page.
const clientSrc = path.join(__dirname, '..', 'client');
const clientDest = path.join(pkgRoot, 'server', 'static');
if (fs.existsSync(clientSrc)) {
	fs.cpSync(clientSrc, clientDest, { recursive: true, force: true });
	console.log(`client -> ${clientDest}`);
} else {
	console.log('no client/ directory; leaving the stock redirect page in place');
}
