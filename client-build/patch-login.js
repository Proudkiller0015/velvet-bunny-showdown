// Let the client finish starting up when there is no login server to talk to.
//
// On boot the client asks the official login server whether you are already
// signed in, and only clears PS.user.initializing when that answer arrives. Our
// server has no login server, and a client served from our own domain cannot
// reach Smogon's either - their cross-domain bridge only answers for hosts they
// have whitelisted. So the query never settles, initializing stays true, and the
// top bar sits on "Connecting..." forever: the [Choose name] link never appears
// and nobody can get a name at all.
//
// Failing that query should mean "you are not logged in", not "wait forever".
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'psclient', 'play.pokemonshowdown.com', 'src', 'panel-mainmenu.tsx');
let s = fs.readFileSync(FILE, 'utf8');
// The checkout uses CRLF; work in LF and restore the original endings at the end.
const hadCRLF = s.includes('
');
if (hadCRLF) s = s.split('
').join('
');

if (s.includes('no login server to answer')) {
	console.log('panel-mainmenu.tsx already patched for login');
	process.exit(0);
}

const OLD = `			).then(res => {
				if (!res?.username) {
					PS.user.initializing = false;
					return;
				}`;
const NEW = `			).catch(() => null).then(res => {
				// A server with no login server to answer, or one we are not allowed
				// to ask, means we are simply not logged in - not that we should
				// wait forever. Without this the top bar never offers a name.
				if (!res?.username) {
					PS.user.initializing = false;
					return;
				}`;

const count = s.split(OLD).length - 1;
if (count !== 1) {
	console.error(`expected exactly one upkeep handler, found ${count}`);
	process.exit(1);
}
s = s.replace(OLD, NEW);

// Belt and braces: if the query neither resolves nor rejects, time it out.
const ANCHOR = `		case 'challstr': {
			const [, challstr] = args;
			PS.user.challstr = challstr;`;
if (!s.includes(ANCHOR)) {
	console.error('could not find the challstr handler');
	process.exit(1);
}
s = s.replace(ANCHOR, ANCHOR + `
			// Some failures hang rather than reject; do not let that strand the UI.
			setTimeout(() => { if (PS.user.initializing) PS.user.initializing = false; }, 5000);`);

if (hadCRLF) s = s.split('
').join('
');
fs.writeFileSync(FILE, s);
console.log('panel-mainmenu.tsx patched: login failure no longer strands the client');
