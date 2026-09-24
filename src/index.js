'use strict';
/**
 * Entry point: bring up a Pokemon Showdown server, then connect the bot to it.
 *
 * One process, one port - which is what free hosts hand you. Players point the
 * official client at this server and get every format, the teambuilder, replays
 * and all; the bot is simply the user sitting on it waiting to be challenged.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, fork } = require('child_process');
const net = require('net');

require('../scripts/setup-config');

const PORT = Number(process.env.PORT) || 8000;
const HOST = '127.0.0.1';

function waitForPort(port, timeoutMs = 90000) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const socket = net.connect(port, HOST);
			socket.once('connect', () => { socket.destroy(); resolve(); });
			socket.once('error', () => {
				socket.destroy();
				if (Date.now() > deadline) reject(new Error(`server did not open port ${port}`));
				else setTimeout(attempt, 500);
			});
		};
		attempt();
	});
}

function startServer() {
	const entry = require.resolve('pokemon-showdown/dist/server/index.js');
	const child = spawn(process.execPath, [entry, String(PORT)], {
		// The package root, not its parent: Showdown resolves its static files
		// (server/static/404.html and friends) relative to the working directory.
		// Forked battle workers happened to resolve them anyway, so getting this
		// wrong only showed up once battles moved in-process.
		cwd: path.dirname(require.resolve('pokemon-showdown/package.json')),
		/*
		 * Its own heap cap, rather than this process's.
		 *
		 * `NODE_OPTIONS` is inherited, so one `--max-old-space-size` in the host
		 * configuration was being applied to both processes in this container -
		 * a 400MB ceiling each, in a box that is killed at 512MB total. Neither
		 * had any reason to collect hard until it was alone past what the two of
		 * them could afford together.
		 *
		 * So the server is given its own, and PS_SERVER_HEAP_MB is the knob. It
		 * defaults to the same 400 the two of them shared, because the number
		 * that should replace it depends on what the *other* process actually
		 * holds - and nothing could see that until the memory note a few lines
		 * below this one. Measure for a day, then set it here; a knob shipped
		 * before the measurement would just be a guess with an env var on it.
		 *
		 * 24 Sep 2026: the measurement is in (render.yaml: 60MB idle, 130MB
		 * peak), and render.yaml has set 256 ever since. The default follows it,
		 * so a deploy that loses the env var does not quietly go back to a cap
		 * that alone is most of the 512MB box.
		 */
		env: {
			...process.env,
			PORT: String(PORT),
			NODE_OPTIONS: process.env.PS_SERVER_NODE_OPTIONS ||
				`--max-old-space-size=${Number(process.env.PS_SERVER_HEAP_MB || 256)} ` +
				/*
				 * And a small young generation, which is the one V8 knob that paid.
				 *
				 * Node lets the space new objects are born in grow to 16MB a half,
				 * and under battle load both processes kept it at full size, so a
				 * good 30-50MB of the container was allocation scratch space.
				 * Capped at 4MB, measured on Node 22 with six people battling the
				 * bots non-stop for three minutes: the two processes peaked 45MB
				 * lower (435 to 390MB) and averaged 35MB lower, with the same number
				 * of battles, the same turn times and no more CPU. 2MB was no better
				 * than 4. The wrapper gets the same flag through NODE_OPTIONS in
				 * render.yaml; this line is the server's copy, because its
				 * NODE_OPTIONS is replaced rather than inherited.
				 */
				`--max-semi-space-size=${Number(process.env.PS_SEMI_SPACE_MB || 4)}`,
		},
		stdio: ['ignore', 'inherit', 'inherit'],
	});
	child.on('exit', code => {
		console.error(`[server] exited with code ${code}`);
		process.exit(code || 1);
	});
	return child;
}

(async () => {
	// Ratings live in a file inside the package, on a disk this host wipes every
	// restart, so pull the saved copy back before Showdown reads it.
	//
	// The bot rungs are seeded from the round robin in test/elo.test.js, so a
	// player is matched against one near their own strength from their very first
	// search and beating Champion is worth more than beating Easy straight away.
	// Only missing rows are added - a rating earned against people always stands.
	const pkgRoot = path.dirname(require.resolve('pokemon-showdown/package.json'));
	const ladderDir = path.join(pkgRoot, 'config', 'ladders');
	const { LadderStore } = require('./ladder-store');
	const { FriendsStore } = require('./friends-store');
	const { RosterStore } = require('./roster-store');
	const store = new LadderStore(ladderDir, (...a) => console.log('[ladder-store]', ...a));
	await store.connect();
	await store.restore();

	/*
	 * And the friends list, for the same reason and in the same window.
	 *
	 * Showdown opens the database as it starts, so the saved copy has to be back
	 * on disk before the server is spawned a few lines below. It is put back only
	 * when there is no database here already, because a file on this disk is
	 * newer than the commit by definition.
	 */
	const friends = new FriendsStore(
		path.join(pkgRoot, 'databases', 'friends.db'),
		(...a) => console.log('[friends-store]', ...a));
	await friends.restore();

	// And the guest book, which the server appends to as people arrive.
	const roster = new RosterStore(undefined, (...a) => console.log('[roster]', ...a));
	await roster.restore();

	const { seedLadder } = require('./ladder-seed');
	// The names only: ./ladder would load the dex and the builder into this process.
	const { ladderQueues, DEFAULT_FORMATS } = require('./ladder-defaults');
	// The same list the rungs themselves are built from, so a seeded row can
	// never be named for an account that does not exist.
	const queues = ladderQueues(process.env.PS_BOT_NAME || 'Velvet Bunny');
	for (const format of DEFAULT_FORMATS) {
		seedLadder(ladderDir, format, queues, msg => console.log('[ladder-seed]', msg));
	}

	console.log(`[boot] starting Pokemon Showdown on port ${PORT}`);
	const server = startServer();
	// Nothing tells this process that somebody made a friend - it happens two
	// processes away - so it looks now and then. See src/friends-store.js.
	friends.start();
	roster.start();

	/*
	 * Say how much memory this process is using, where something can read it.
	 *
	 * There are two node processes in this container and the health endpoint
	 * could only see one of them - itself, the server. This one holds the bot,
	 * the team builder and its own copy of the dex, and it was simply unmeasured:
	 * the container total said 400MB and the server accounted for 300 of it, so
	 * a hundred megabytes were being attributed to "the rest" with no way to
	 * check. That matters now, because the two share a 512MB limit and inherit
	 * one `--max-old-space-size` between them - if both ever grew into that cap
	 * the sum would be well past what this box has.
	 *
	 * A file, because the two processes share a disk and nothing else.
	 */
	const wrapperStatus = path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-wrapper.json');
	const noteMemory = () => {
		try {
			const memory = process.memoryUsage();
			fs.mkdirSync(path.dirname(wrapperStatus), { recursive: true });
			fs.writeFileSync(wrapperStatus, JSON.stringify({
				pid: process.pid,
				uptimeSeconds: Math.round(process.uptime()),
				heapLimit: require('v8').getHeapStatistics().heap_size_limit,
				nodeOptions: process.env.NODE_OPTIONS || '',
				rss: memory.rss,
				heapUsed: memory.heapUsed,
				heapTotal: memory.heapTotal,
				external: memory.external,
				at: new Date().toISOString(),
			}));
		} catch (e) {
			// Diagnostics must never be the thing that breaks the server.
		}
	};
	noteMemory();
	const memoryTimer = setInterval(noteMemory, Number(process.env.PS_MEMORY_NOTE_MS || 30000));
	if (memoryTimer.unref) memoryTimer.unref();

	/*
	 * Keep the card game awake. Curtain Call is a free Render service of its own,
	 * asleep after fifteen minutes without an outside request, and GitHub's
	 * scheduled keep-awake turned out to run every four hours or so, not every ten
	 * minutes (24 Sep 2026). This server is up all day, so it knocks every five
	 * minutes; the card server knocks back, so neither sleeps. KEEP_AWAKE_URLS
	 * (comma-separated) overrides the list; "none" turns it off.
	 */
	const keepAwake = (process.env.KEEP_AWAKE_URLS || 'https://curtain-call-c5i4.onrender.com/health')
		.split(',').map(s => s.trim()).filter(u => /^https:\/\//.test(u));
	if (keepAwake.length) {
		const https = require('https');
		const knock = () => {
			for (const url of keepAwake) {
				const req = https.get(url, { timeout: 90000 }, res => res.resume());
				req.on('error', () => {});
				req.on('timeout', () => req.destroy());
			}
		};
		setTimeout(knock, 60000).unref();
		const awakeTimer = setInterval(knock, 5 * 60 * 1000);
		if (awakeTimer.unref) awakeTimer.unref();
	}

	/**
	 * Leave slowly enough for the server to say goodbye.
	 *
	 * A restart cannot preserve a battle - it lives in this process's memory and
	 * there is nowhere to put it - so the next best thing is to not lose it
	 * silently: the server is given a few seconds to warn everyone in a battle,
	 * save a replay of it, and let people finish reading the room before the
	 * socket closes under them (see the shutdown notice in the config).
	 *
	 * The window is deliberately shorter than the one the host allows between
	 * asking a process to stop and killing it outright, which on Render is 30
	 * seconds. Going over that would mean being killed mid-sentence, which is
	 * the thing this exists to avoid.
	 */
	const GOODBYE_MS = Number(process.env.PS_SHUTDOWN_GRACE_MS || 22000);
	let leaving = false;
	let stopBots = () => {};

	const shutdown = () => {
		if (leaving) return;   // a second Ctrl-C should not cut the first one short
		leaving = true;
		stopBots();

		// Ask the server to wind down. It has its own handler for this, and it
		// exits on its own when it is done.
		try { server.kill('SIGTERM'); } catch (e) { /* already gone */ }

		const done = () => {
			// Ratings and friendships last, so anything the wind-down changed is
			// included. Neither is allowed to hold the exit up on its own.
			Promise.allSettled([store.stop(), friends.stop(), roster.stop()])
				.finally(() => process.exit(0));
		};

		const deadline = setTimeout(() => {
			console.log('[boot] the server is taking too long; closing anyway');
			try { server.kill('SIGKILL'); } catch (e) {}
			done();
		}, GOODBYE_MS);
		if (deadline.unref) deadline.unref();

		server.once('exit', () => {
			clearTimeout(deadline);
			done();
		});
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	await waitForPort(PORT);
	console.log('[boot] server is up');

	if (process.env.PS_NO_BOT === '1') {
		console.log('[boot] PS_NO_BOT=1, not starting the bot');
		return;
	}
	/*
	 * The bots run in their own process (src/bots.js), and this one only minds it.
	 *
	 * Building teams for every tier loads a dex mod per generation that is never
	 * freed; in here that eventually killed this process, and with it the server.
	 * Over there it either restarts itself while nobody is playing, or at worst
	 * crashes alone - and is started again from here.
	 */
	const BOTS_HEAP_MB = Number(process.env.PS_BOTS_HEAP_MB || 200);
	let bots = null;
	let botsStartedAt = 0;
	let botsDelay = 1000;
	const startBots = () => {
		if (leaving) return;
		botsStartedAt = Date.now();
		bots = fork(path.join(__dirname, 'bots.js'), [], {
			execArgv: [],
			env: {
				...process.env,
				NODE_OPTIONS: process.env.PS_BOTS_NODE_OPTIONS ||
					`--max-old-space-size=${BOTS_HEAP_MB} --max-semi-space-size=${Number(process.env.PS_SEMI_SPACE_MB || 4)}`,
			},
			stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
		});
		bots.on('exit', (code, signal) => {
			bots = null;
			if (leaving) return;
			// A clean exit is a planned recycle: straight back. A crash backs off,
			// so a bot that dies on boot does not spin; a long run resets that.
			if (code === 0) botsDelay = 1000;
			else if (Date.now() - botsStartedAt > 5 * 60000) botsDelay = 2000;
			else botsDelay = Math.min(botsDelay * 2, 60000);
			console.log(`[boot] bots exited (${signal || `code ${code}`}); starting them again in ${botsDelay / 1000}s`);
			const timer = setTimeout(startBots, botsDelay);
			if (timer.unref) timer.unref();
		});
	};
	stopBots = () => { try { if (bots) bots.kill('SIGTERM'); } catch (e) {} };
	startBots();
	store.start();
})().catch(err => {
	console.error('[boot] failed:', err);
	process.exit(1);
});
