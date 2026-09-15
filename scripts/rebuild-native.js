'use strict';
/**
 * Rebuild native modules for the Node that is actually installing.
 *
 * better-sqlite3 ships a compiled binary for one Node version. Render keeps
 * node_modules in its build cache, so after the move from Node 20 to 22 the
 * cached Node 20 binary was reused and every database query failed with
 * "Module did not self-register". Rebuilding on each install fetches the
 * binary for the running Node (a prebuilt download, usually a few seconds).
 *
 * Never fails the install: without the database the server still runs (the
 * friends list is off), which is better than no deploy at all.
 */

const { execSync } = require('child_process');

try {
	execSync('npm rebuild better-sqlite3', { stdio: 'inherit', timeout: 5 * 60 * 1000 });
	// Prove it loads, so a bad binary shows up in the build log rather than at runtime.
	const Database = require(require.resolve('better-sqlite3', { paths: [require.resolve('pokemon-showdown/package.json')] }));
	new Database(':memory:').close();
	console.log(`[native] better-sqlite3 rebuilt and loads on Node ${process.version}`);
} catch (e) {
	console.log(`[native] could not rebuild better-sqlite3 (${e.message.split('\n')[0]}); the server will run without it`);
}
