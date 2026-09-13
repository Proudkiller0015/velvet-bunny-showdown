/** @type {import('../play.pokemonshowdown.com/src/client-main').PSConfig} */
var Config = Config || {};

/* version */ Config.version = "0";

Config.bannedHosts = ['cool.jit.su', 'pokeball-nixonserver.rhcloud.com'];

Config.whitelist = [
	'wikipedia.org'

	// The full list is maintained outside of this repository so changes to it
	// don't clutter the commit log. Feel free to copy our list for your own
	// purposes; it's here: https://play.pokemonshowdown.com/config/config.js

	// If you would like to change our list, simply message Zarel on Smogon or
	// Discord.
];

// `defaultserver` specifies the server to use when the domain name in the
// address bar is `Config.routes.client`.
Config.defaultserver = {
	id: 'showdown',
	host: 'sim3.psim.us',
	port: 443,
	httpport: 8000,
	altport: 80,
	registered: true
};

Config.roomsFirstOpenScript = function () {
};

Config.customcolors = {
	'zarel': 'aeo'
};
/*** Begin automatically generated configuration ***/
Config.version = "0.11.2 (e47b8be4)";
Config.translationCachebuster = "";

Config.routes = {
	root: 'pokemonshowdown.com',
	client: 'play.pokemonshowdown.com',
	dex: 'dex.pokemonshowdown.com',
	replays: 'replay.pokemonshowdown.com',
	users: 'pokemonshowdown.com/users',
	teams: 'teams.pokemonshowdown.com',
};
/*** End automatically generated configuration ***/
/*** Velvet Bunny ***/
// Setting Config.server (not just defaultserver) pins the client to our server
// no matter what hostname it is served from - client-connection only falls back
// to defaultserver when Config.server is unset, so this wins.
Config.defaultserver = {
	id: 'velvetbunny',
	host: 'velvet-bunny-showdown.onrender.com',
	port: 443,
	httpport: 443,
	altport: 80,
	registered: false,
};
// This server, not Showdown's.
//
// `defaultserver` is the official one - it is what the bundled config ships
// with and what play.pokemonshowdown.com itself uses. Pointing Config.server at
// it sent this client to sim3.psim.us, so the copy served from our own domain
// was playing on Smogon's server and none of our formats or Pokemon existed.
//
// It has to be set explicitly because testclient skips the crossdomain handshake
// that would normally work the address out, and that handshake could not tell us
// anyway: it asks Smogon which server a hostname belongs to, and for a host they
// have never heard of the answer is theirs.
Config.server = {
	id: 'velvetbunny',
	host: window.location.hostname,
	port: window.location.protocol === 'https:' ? 443 : Number(window.location.port) || 80,
	httpport: window.location.protocol === 'https:' ? 443 : Number(window.location.port) || 80,
	altport: 80,
	https: window.location.protocol === 'https:',
	// Not registered with Smogon, which is what decides whether the client tries
	// to authenticate a name against their login server.
	registered: false,
};

// Without this the client, cross-origin to routes.client, injects a hidden
// crossdomain.php iframe into play.pokemonshowdown.com and waits forever for a
// postMessage that never comes - Showdown answers that handshake for hosts they
// route themselves and returns an empty page for ours. Skipping it costs
// nothing else: it only loads battle text relatively, which already falls back
// to the official CDN, and logging in goes through the server rather than that
// iframe (see src/login-relay.js).
Config.testclient = true;

// English unless the viewer chooses otherwise in Options. Without this the
// client follows the browser's Accept-Language list, so a French browser gets a
// French interface with no obvious cause.
Config.defaultLanguage = 'en';

// routes.client deliberately stays on the official host, so sprites, audio and
// dex data load from their CDN and this bundle stays small and never stale.

// The main-menu bot panel. Editing this file is enough to change the list.
Config.botChallenge = {
	name: 'Velvet Bunny',
	difficulties: ['easy', 'normal', 'hard', 'champion', 'stockfish'],
	// Shown after the name of any rung listed here.
	experimental: ['stockfish'],
	formats: [
		{ id: 'gen9randombattle', name: 'Random Battle', instant: true },
		{ id: 'gen9ou', name: 'OU' },
		{ id: 'gen9vgc2024regh', name: 'VGC' },
		{ id: 'gen9doublesou', name: 'Doubles OU' },
		{ id: 'gen9randomdoublesbattle', name: 'Random Doubles', instant: true },
	],
};
/*** end Velvet Bunny ***/
