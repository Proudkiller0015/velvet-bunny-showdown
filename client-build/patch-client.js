// Add a "Battle the house bot" group to the client's main menu, directly under
// the Battle! (ladder search) button, and point the client at our server.
//
// The group is a TeamForm - the same component the ladder uses - so it gets the
// identical format dropdown and team selector, and the player picks a team the
// same way they would for a ladder game.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'psclient');
const MAIN = path.join(ROOT, 'play.pokemonshowdown.com/src/panel-mainmenu.tsx');

let s = fs.readFileSync(MAIN, 'utf8');
if (s.includes('renderBotChallenge')) {
	console.log('panel-mainmenu.tsx already patched (skipping)');
} else {
	const anchorRe = /[ \t]*renderBackgroundCredit\(\) \{/;
	const anchorMatch = anchorRe.exec(s);
	if (!anchorMatch) throw new Error('could not find the renderBackgroundCredit anchor');

	// The checkout uses CRLF, so build the insert with whatever the file uses.
	const eol = s.includes('\r\n') ? '\r\n' : '\n';
	const lines = [
		'	/**',
		'	 * Challenge the house bot. Sits directly under the ladder button so both',
		'	 * ways of getting a battle are in the same place, and is a TeamForm for',
		'	 * the same reason the ladder is one: the player needs the format dropdown',
		'	 * and their own team selector.',
		'	 *',
		'	 * Everything it offers comes from Config.botChallenge, so the bot name and',
		'	 * difficulty list can change without touching this file.',
		'	 */',
		'	submitBotChallenge = (ev: Event, format: string, team?: Team) => {',
		'		if (!PS.user.named) {',
		'			PS.join(\'login\' as RoomID, {',
		'				parentElem: this.base!.querySelector<HTMLElement>(\'.big.button\'),',
		'			});',
		'			return;',
		'		}',
		'		const cfg = (Config as any).botChallenge;',
		'		if (!cfg?.name) return;',
		'		// Same handshake the ladder uses: hand over the team, then ask for a game.',
		'		PS.send(`/utm ${team?.packedTeam || \'\'}`);',
		'		PS.send(`/challenge ${cfg.name}, ${format}`);',
		'	};',
		'	renderBotChallenge() {',
		'		const cfg = (Config as any).botChallenge;',
		'		if (!cfg?.name || PS.isOffline || !PS.user.userid) return null;',
		'		const difficulties: string[] = cfg.difficulties || [];',
		'		return <TeamForm',
		'			class="menugroup" selectType="challenge" onSubmit={this.submitBotChallenge}',
		'			defaultFormat={cfg.defaultFormat || undefined}',
		'		>',
		'			<p><strong>{`Battle ${cfg.name}`}</strong></p>',
		'			{!!difficulties.length && <p class="buttonbar">',
		'				{difficulties.map(d => <button',
		'					key={d} type="button" class="button"',
		'					data-cmd={`/msg ${cfg.name}, difficulty ${d}`}',
		'				>{d.charAt(0).toUpperCase() + d.slice(1)}</button>)}',
		'			</p>}',
		'			<button class="mainmenu2 mainmenu big button" type="submit">',
		'				<strong>{`Challenge ${cfg.name}`}</strong><br />',
		'				<small>{`It brings its own legal team`}</small>',
		'			</button>',
		'		</TeamForm>;',
		'	}',
		'',
	];
	s = s.replace(anchorMatch[0], lines.join(eol) + anchorMatch[0]);

	const callRe = /([ \t]*)\{this\.renderSearchButton\(\)\}(\r?\n)/;
	const m = callRe.exec(s);
	if (!m) throw new Error('could not find the renderSearchButton call site');
	s = s.replace(callRe, `${m[0]}${m[2]}${m[1]}{this.renderBotChallenge()}${m[2]}`);

	fs.writeFileSync(MAIN, s);
	console.log('panel-mainmenu.tsx patched');
}

// Point the client at our server and give it the bot config.
const CONFIG = path.join(ROOT, 'config/config.js');
let c = fs.readFileSync(CONFIG, 'utf8');

if (c.includes('botChallenge')) {
	console.log('config.js already patched (skipping)');
} else {
	c += [
		'',
		'/*** Velvet Bunny ***/',
		'// Setting Config.server, not just defaultserver, pins the client to our',
		'// server whatever hostname it is served from: client-connection only falls',
		'// back to defaultserver when Config.server is unset.',
		'Config.defaultserver = {',
		'	id: \'velvetbunny\',',
		'	host: \'velvet-bunny-showdown.onrender.com\',',
		'	port: 443,',
		'	httpport: 443,',
		'	altport: 80,',
		'	registered: false,',
		'};',
		'Config.server = Config.defaultserver;',
		'',
		'// Without this the client, being cross-origin to routes.client, injects a',
		'// hidden crossdomain.php iframe into play.pokemonshowdown.com and waits',
		'// forever for a postMessage that never comes - it never even tries to',
		'// reach our server. testclient skips that handshake entirely. Its only',
		'// other effect is loading battle text relatively, which falls back to the',
		'// official CDN on failure, so nothing extra needs hosting.',
		'Config.testclient = true;',
		'',
		'// routes.client deliberately stays on the official host so sprites, audio',
		'// and dex data keep loading from their CDN - we host only the client code.',
		'',
		'Config.botChallenge = {',
		'	name: \'Velvet Bunny\',',
		'	difficulties: [\'easy\', \'normal\', \'hard\', \'champion\'],',
		'	defaultFormat: \'gen9randombattle\',',
		'};',
		'/*** end Velvet Bunny ***/',
		'',
	].join('\n');
	fs.writeFileSync(CONFIG, c);
	console.log('config.js patched');
}
