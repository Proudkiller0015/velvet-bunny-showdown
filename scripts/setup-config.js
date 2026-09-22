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
// Our own build IS the site, served from the root.
//
// It lived at /play/ while the root bounced players to the official client,
// for one reason: it could not sign anyone in. Showdown's cross-domain bridge
// answers only for hosts they route, so a browser on our domain could not reach
// their login server at all. The server forwards that one request itself now
// (src/http-hooks.js), so this client logs people in with their real Pokemon
// Showdown account - and unlike the official one it has the bot panel and knows
// about Samantha.
//
// It has to be the root and not a subdirectory. The client reads the room out
// of the path (`location.pathname.slice(1)`) and writes it back the same way, so
// under /play/ every link it produced pointed at the root anyway - and a deep
// link like /play/ladder is not a file, so it 404ed. At the root, Showdown's
// static server already falls back to index.html for paths that are not files,
// which is exactly the routing the client expects. /play/ is kept alive by a
// redirect in src/http-hooks.js rather than by a second copy.
//
// PS_ROOT_CLIENT=stock puts Showdown's own redirect back, which sends players to
// the official client on psim.us - worth having if the relay ever breaks, since
// that route does not use it.
//
// Everything here is written every boot rather than trusted to be intact:
// node_modules survives between deploys on this host, so whatever was copied
// once outlives the change that stopped copying it.
const staticDir = path.join(pkgRoot, 'server', 'static');
const clientSrc = path.join(__dirname, '..', 'client');
const stock = process.env.PS_ROOT_CLIENT === 'stock';
fs.mkdirSync(staticDir, { recursive: true });

// The copy at /play/ from when this was the alternative. It would shadow the
// redirect and serve a second, stale client, so it goes.
fs.rmSync(path.join(staticDir, 'play'), { recursive: true, force: true });

if (!stock && fs.existsSync(clientSrc)) {
	fs.cpSync(clientSrc, staticDir, { recursive: true, force: true });

	// Stamp every local script and stylesheet the page names with this build.
	//
	// They were pinned by hand - `velvet-data.js?v2` - which is the same URL
	// after a change as before it, so a browser that has the file keeps using it
	// and a deploy quietly does nothing. Whoever edits the client should not have
	// to remember to bump a number, so the number is the build.
	const stamp = (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || Date.now().toString(36);
	const indexPath = path.join(staticDir, 'index.html');
	const page = fs.readFileSync(indexPath, 'utf8')
		.replace(/(src|href)="(\/?(?:js|style|config|showdex)\/[^"?]+)(\?[^"]*)?"/g, `$1="$2?${stamp}"`);
	fs.writeFileSync(indexPath, page);

	console.log(`client -> ${staticDir} (served at the root; /play/ redirects here; build ${stamp})`);
} else {
	const stockPage = path.join(__dirname, '..', 'server-static', 'index.html');
	if (fs.existsSync(stockPage)) {
		fs.copyFileSync(stockPage, path.join(staticDir, 'index.html'));
		console.log("root page -> Showdown's own redirect, to the official client");
	} else {
		console.log('no client and no stock page; the root will 404');
	}
}

// ------------------------------------------------------------- custom data
// Everything data/velvet adds or changes - the buffs, our own Pokemon, moves and
// abilities, the re-tiers, Halloween - is RP's, and RP's alone. It lives in a mod
// per generation RP is played in (gen9rp ... gen1rp, see data/velvet/rp-mod.js),
// which the RP formats use; the base dex, and with it every official format and
// `/dt9`, stays exactly as Showdown ships it.
//
// It used to be the other way round: one line appended to each base data file,
// patching the base dex in place. Those lines are taken back out here, because
// this host caches node_modules between deploys and a patched file would
// otherwise stay patched.
const dataSrc = path.join(__dirname, '..', 'data', 'velvet');
const dataDest = path.join(pkgRoot, 'dist', 'data');
const MARKER = '/* velvet-bunny */';
const PATCHED = ['pokedex.js', 'abilities.js', 'moves.js', 'items.js', 'formats-data.js', 'learnsets.js'];
if (fs.existsSync(dataSrc)) {
	const velvetDir = path.join(dataDest, 'velvet');
	fs.mkdirSync(velvetDir, { recursive: true });
	for (const file of fs.readdirSync(dataSrc)) {
		fs.copyFileSync(path.join(dataSrc, file), path.join(velvetDir, file));
	}

	let unhooked = 0;
	for (const file of PATCHED) {
		const target = path.join(dataDest, file);
		if (!fs.existsSync(target)) continue;
		const body = fs.readFileSync(target, 'utf8');
		const at = body.indexOf(MARKER);
		if (at < 0) continue;
		fs.writeFileSync(target, body.slice(0, at).trimEnd() + '\n');
		unhooked++;
	}
	if (unhooked) console.log(`custom data -> took the old hook out of ${unhooked} base dex file(s)`);

	const { MODS } = require(path.join(dataSrc, 'rp-mod.js'));
	for (const mod of MODS) {
		const dir = path.join(dataDest, 'mods', mod.id);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, 'scripts.js'), [
			"'use strict';",
			`// Written by scripts/setup-config.js: RP's data over Gen ${mod.gen}. See data/velvet/rp-mod.js.`,
			'exports.Scripts = {',
			`	gen: ${mod.gen},`,
			`	inherit: '${mod.inherit}',`,
			"	init() { require('../../velvet/rp-mod.js').apply(this); },",
			'};',
			'',
		].join('\n'));
	}
	// RP Random Battle is the one generated format: Showdown finds a format's team
	// generator by its mod's name, so gen9rp points at the ninth generation's.
	const rbDir = path.join(dataDest, 'random-battles', 'gen9rp');
	fs.mkdirSync(rbDir, { recursive: true });
	fs.writeFileSync(path.join(rbDir, 'teams.js'), "'use strict';\n// Written by scripts/setup-config.js.\nmodule.exports = require('../gen9/teams');\n");
	console.log(`custom data -> RP mods ${MODS.map(m => m.id).join(', ')}`);
}

// The formats this server adds. dist/config, not config: dex-formats.js resolves
// the path relative to dist/sim, which is a different directory to the one the
// server config lives in.
const formatsSrc = path.join(__dirname, '..', 'config', 'custom-formats.js');
if (fs.existsSync(formatsSrc)) {
	const formatsDest = path.join(pkgRoot, 'dist', 'config', 'custom-formats.js');
	fs.mkdirSync(path.dirname(formatsDest), { recursive: true });
	fs.copyFileSync(formatsSrc, formatsDest);
	console.log('custom formats -> copied');
}

// What level each format is played at, written down so the server can build its
// format list without loading every mod Showdown ships - see src/format-levels.js.
// After the formats and the data hooks above, because both feed into it. Only
// does any work when one of those has changed since the file was written.
require('../src/format-levels').ensureLevels(msg => console.log(msg));

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
// Straight from the module the queues are named by, rather than worked out again
// here. Guessing produced "Velvet Bunny Easy" long after the queues had been
// renamed to fit Showdown's eighteen-character limit, so the avatar was granted
// to four accounts that do not exist and to none of the ones that do - and every
// queue was quietly refused its own face.
const { botAccountIds, toId } = require('../src/queue-names');
const { ladderQueues } = require('../src/ladder-defaults');
const botBase = process.env.PS_BOT_NAME || 'Velvet Bunny';

const avatarRights = {
	[toId(botBase)]: ['bunny.png'],
	slimequeensamantha: ['queen.png'],
	// Offered rather than applied, at her own request, so she picks it herself.
	dana3166: [null, 'dana.png'],
	// Yume, her OC (with her Dream Ball and Banette), is first: her new avatar.
	keikosama: ['keiko-yume.png', 'keiko-coral.png', 'keiko-silverwolf.png', 'keiko-silverwolf-2.png', 'keiko-coral-disguise.png', 'keiko-milim.png'],
	ladymilim: ['milim.png'],
	simiaignis: ['simia-ignis.png'],
	lavit: ['lavit.png'],
	thegloriousfemboy: ['thegloriousfemboy.png'],
};
// Every rung of the ladder wears the same face - they are all the same bot.
const botIds = botAccountIds(botBase, ladderQueues(botBase));
for (const id of botIds) avatarRights[id] = ['bunny.png'];

// Merged, not overwritten. Choosing an avatar with /avatar writes it back to
// this file as that account's default, and replacing the file wholesale threw
// that away - so anyone whose avatar is offered rather than applied had to pick
// it again after every single restart.
const avatarsPath = path.join(pkgRoot, 'config', 'avatars.json');
// Applied once on the next boot even if the account already has a different avatar in the applied slot
// (the merge below otherwise never changes what someone wears). Recorded as forcedApplied so a later
// /avatar choice sticks.
const FORCE_APPLIED = { keikosama: 'keiko-yume.png' };
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
	// A new applied avatar the owner asked for: replaces whatever is in the applied slot once.
	if (FORCE_APPLIED[userid] && onDisk.has(FORCE_APPLIED[userid]) && existing.forcedApplied !== FORCE_APPLIED[userid]) {
		existing.allowed = [FORCE_APPLIED[userid], ...existing.allowed.filter(f => f && f !== FORCE_APPLIED[userid])];
		existing.default = FORCE_APPLIED[userid];
		existing.forcedApplied = FORCE_APPLIED[userid];
	}
	// A default pointing at a file that no longer ships would apply nothing.
	if (existing.default && !onDisk.has(existing.default)) delete existing.default;
}
// Drop rights belonging to a bot account that no longer exists. Only entries
// whose entire entitlement is the bot's own avatar and which nobody has chosen
// anything on - a real person is never in that position, so this cannot take
// somebody's avatar away while clearing out four renamed queues.
for (const [userid, entry] of Object.entries(avatarsJson)) {
	if (botIds.has(userid)) continue;
	const allowed = (entry && entry.allowed) || [];
	const onlyBotFile = allowed.length && allowed.every(f => !f || f === 'bunny.png');
	if (onlyBotFile && !entry.default) {
		delete avatarsJson[userid];
		console.log(`avatar rights -> forgot ${userid}, which is not a queue any more`);
	}
}
fs.writeFileSync(avatarsPath, JSON.stringify(avatarsJson, null, '\t'));
console.log(`avatar rights -> ${Object.keys(avatarsJson).length} account(s)`);
