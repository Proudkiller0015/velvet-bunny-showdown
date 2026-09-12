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
for (const dir of ['logs', 'logs/chat', 'logs/modlog', 'logs/repl', 'logs/responder',
	'config/chat-plugins', 'config/ladders', 'databases']) {
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
//
// Mirrored, not just copied into. The destination lives inside node_modules,
// which this host caches between deploys, so anything copied there once stays
// there - a renamed or deleted avatar went on being served from its old name
// indefinitely, on a directory the whole internet can read. Everything in that
// directory is put there by this script, so removing what is no longer in
// avatars/ takes nothing that is not ours.
const avatarSrc = path.join(__dirname, '..', 'avatars');
const avatarDest = path.join(pkgRoot, 'config', 'avatars');
if (fs.existsSync(avatarSrc)) {
	fs.mkdirSync(avatarDest, { recursive: true });
	const shipped = fs.readdirSync(avatarSrc);
	for (const file of shipped) {
		fs.copyFileSync(path.join(avatarSrc, file), path.join(avatarDest, file));
	}
	const stale = fs.readdirSync(avatarDest).filter(file => !shipped.includes(file));
	for (const file of stale) {
		try { fs.unlinkSync(path.join(avatarDest, file)); } catch (e) { /* already gone */ }
	}
	console.log(`avatars -> ${avatarDest} (${shipped.join(', ')})` +
		(stale.length ? ` - removed ${stale.join(', ')}` : ''));
}

// Who is allowed to wear what.
//
// Showdown used to take this from Config.customavatars. It now keeps it in
// config/avatars.json and crash-logs on every single boot while the old key is
// still present, so the file is written here directly. It has to be written on
// every boot regardless: this host throws its disk away when it restarts.
//
// Each account gets a list, because people collect these. The first entry is
// what they are given on login and the rest are theirs to switch to with
// /avatar <file>; a null in that first slot means every avatar in the list is
// only PERMITTED, which is the difference between giving someone an avatar and
// putting one on them.
//
// Files are named for the account that owns them, not for the character in the
// picture. The avatar directory is shared by the whole server, so a file called
// milim.png is claimed the moment someone named Milim turns up wanting one of
// their own - and there is only one of each name to go round.
const ladderNames = (process.env.PS_LADDER_DIFFICULTIES || 'easy,normal,hard,champion')
	.split(',').map(d => d.trim()).filter(d => d);   // mirrors DEFAULT_DIFFICULTIES in src/ladder.js
const botBase = process.env.PS_BOT_NAME || 'Velvet Bunny';
const toId = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const avatarRights = {
	[toId(botBase)]: ['bunny.png'],
	slimequeensamantha: ['queen.png'],
	// Offered rather than applied, at her own request, so she picks it herself.
	dana3166: [null, 'dana.png'],
	keikosama: ['keiko-milim.png'],
	ladymilim: ['milim.png'],
};
// Every rung of the ladder wears the same face - they are all the same bot.
for (const d of ladderNames) avatarRights[toId(`${botBase} ${d}`)] = ['bunny.png'];

// Merged, not overwritten. Choosing an avatar with /avatar writes it back to
// this file as that account's default, and replacing the file wholesale threw
// that away - so anyone whose avatar is offered rather than applied had to pick
// it again after every single restart.
const avatarsPath = path.join(pkgRoot, 'config', 'avatars.json');
// What actually exists to be worn. An avatar that has been renamed or removed
// lingers in everyone's list otherwise, and a stale name in the applied slot
// means logging in asks the server for a file that is not there.
const onDisk = new Set(fs.existsSync(avatarSrc) ? fs.readdirSync(avatarSrc) : []);
let avatarsJson = {};
try { avatarsJson = JSON.parse(fs.readFileSync(avatarsPath, 'utf8')) || {}; } catch (e) { avatarsJson = {}; }
for (const [userid, allowed] of Object.entries(avatarRights)) {
	const existing = avatarsJson[userid];
	if (!existing || !Array.isArray(existing.allowed)) {
		avatarsJson[userid] = { allowed };
		continue;
	}
	// Keep whatever they have chosen, and make sure everything they are entitled
	// to is still in the list. Index 0 is the one applied on login, so it is only
	// filled in when it is empty - that is what keeps "offered" from becoming
	// "imposed" behind their back, and what stops a restart replacing the one they
	// picked with the one they were given.
	const merged = existing.allowed.slice();
	if (!merged.length) merged.push(null);
	if (allowed[0] && !merged[0]) merged[0] = allowed[0];
	for (const file of allowed) {
		if (file && !merged.includes(file)) merged.push(file);
	}
	// Filling the applied slot from the list leaves the same file in it twice,
	// and anything that has since been renamed away should not stay on the list.
	const seen = new Set();
	const kept = merged.filter((file, i) => {
		if (!file) return i === 0;          // only the first slot may be empty
		if (seen.has(file) || !onDisk.has(file)) return false;
		seen.add(file);
		return true;
	});
	existing.allowed = kept.length ? kept : [allowed[0] || null];
	// A default pointing at a file that no longer ships would apply nothing.
	if (existing.default && !onDisk.has(existing.default)) delete existing.default;
}
fs.writeFileSync(avatarsPath, JSON.stringify(avatarsJson, null, '\t'));
console.log(`avatar rights -> ${Object.keys(avatarsJson).length} account(s)`);
