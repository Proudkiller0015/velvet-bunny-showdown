# Building the custom client

`../client/` is a build of the real Pokémon Showdown client with a *Battle Velvet
Bunny* group added to the main menu, directly under the ladder's Battle! button.

**The server serves it itself.** `scripts/setup-config.js` copies `client/` into
`node_modules/pokemon-showdown/server/static/` before boot, so opening the
server's own URL lands a player straight in it, already connected. There is no
separate host and no second URL to keep in sync.

## Rebuild it

```bash
git clone --depth 1 https://github.com/smogon/pokemon-showdown-client.git psclient
cd psclient && npm install && cd ..

node patch-client.js                 # adds the main-menu panel
node patch-language.js               # default to English, not the browser locale
cd psclient && node build && cd ..
node assemble-client.js ./dist       # static bundle + our config, ~6MB
node build-log-misc.js \
  psclient/play.pokemonshowdown.com/src/battle-log-misc.js \
  ../node_modules/pokemon-showdown/dist/server/chat-formatter.js \
  dist/src/battle-log-misc.js
node fix-client-paths.js ./dist

rm -rf ../client && cp -r dist ../client
```

Then commit and deploy the server. Nothing else needs doing — the copy into the
package happens at boot.

## The five things that are not obvious

**`node build` regenerates `config/config.js`.** Anything appended to it before
building is silently lost, which is why our settings are applied to the
*assembled* copy in `assemble-client.js` instead.

**`Config.testclient = true` is load-bearing.** Served from any host other than
`Config.routes.client`, the client injects a hidden `crossdomain.php` iframe into
play.pokemonshowdown.com and waits for a `postMessage` that never arrives for a
host it does not know. It sits on *Connecting…* and never attempts our server at
all — the give-away is zero requests to it in the network log.

**`src/battle-log-misc.js` has to be generated.** Upstream builds it by compiling
the *server's* `chat-formatter.ts` into it (`build-tools/update`, which wants a
pokemon-showdown checkout in `caches/`). A plain clone ships a stale copy with no
`formatText`, and the official CDN's copy lacks it too, so anything that renders
a chat line throws. `build-log-misc.js` wraps the compiled formatter out of the
`pokemon-showdown` package we actually run, so client and server format messages
identically.

**The panel is a `TeamForm`** — the same component the ladder uses — so it gets
the identical format dropdown and team selector and submits with the same
`/utm <packed team>` handshake.

**`Config.routes.client` deliberately stays on the official host**, so sprites,
audio and dex data load from their CDN: ~6MB shipped instead of ~60MB, and the
data never goes stale. Only our own paths are rewritten to be relative.

## Changing the panel without rebuilding

`client/config/config.js` holds the lot:

```js
Config.botChallenge = {
	name: 'Velvet Bunny',
	difficulties: ['easy', 'normal', 'hard', 'champion'],
	defaultFormat: 'gen9randombattle',
};
Config.defaultLanguage = 'en';
```

Edit it, then run `fix-client-paths.js ../client` so the cachebuster is
restamped — without that, browsers keep serving the config they already have.
