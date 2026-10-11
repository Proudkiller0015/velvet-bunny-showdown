'use strict';
/**
 * Staff's /whois and /ip say which client a player is on (whoisClient in
 * config/showdown-config.js), and nobody else sees it.
 *
 * Runs the wrapper over a stand-in /whois, with users that can or cannot see IPs.
 *
 *   node test/whois-client.test.js
 */
const path = require('path');
const config = require(path.join(__dirname, '..', 'node_modules', 'pokemon-showdown', 'config', 'config.js'));

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const shown = [];
const whois = function () { shown.push('whois'); };
global.Chat = { commands: { whois, ip: whois, alts: whois, help() {} } };

check(config.whoisClient() === true, 'the wrapper installs');
check(Chat.commands.ip === Chat.commands.whois && Chat.commands.alts === Chat.commands.whois && Chat.commands.whois !== whois, '/ip and /alts get it too');
const wrapped = Chat.commands.whois;
config.whoisClient();
check(Chat.commands.whois === wrapped, 'installing twice does not wrap it twice');

const staff = { id: 'staff', tempGroup: '@', can: perm => perm === 'ip' };
const player = { id: 'player', tempGroup: ' ', can: () => false };
const ours = { id: 'ours', connections: [{ velvetClient: true }] };
const mirror = { id: 'mirror', connections: [{}] };

function run(user, target) {
	shown.length = 0;
	const context = {
		getUserOrSelf: () => target,
		sendReplyBox: html => shown.push(html),
	};
	Chat.commands.whois.call(context, target.id, null, user, {}, 'whois', '');
	return shown.slice();
}

const staffOurs = run(staff, ours);
check(staffOurs[0] === 'whois' && /Client: Velvet Bunny/.test(staffOurs[1] || ''), `staff see "ours" for a player on our client (${staffOurs[1]})`);
const staffMirror = run(staff, mirror);
check(/Client: another/.test(staffMirror[1] || ''), `staff see "another" for a player on the mirror (${staffMirror[1]})`);
const playerSees = run(player, ours);
check(playerSees.length === 1, 'a player without the IP permission sees only the normal whois');
const self = run(staff, staff);
check(self.length === 1, 'nothing extra on your own whois');

// The command our client sends marks the connection and says nothing.
const connection = {};
const out = config.commands.velvetclient.call({ connection });
check(connection.velvetClient === true && out === undefined, '/velvetclient marks the connection and replies nothing');

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
