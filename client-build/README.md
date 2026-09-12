# Building the custom client

The client at **https://proudkiller0015.github.io/arcade/showdown/** is a build of
the real Pokémon Showdown client with a *Battle Velvet Bunny* group added to the
main menu, directly under the ladder's Battle! button. It lives in the `arcade`
repo (`arcade/showdown/`) because that repo already publishes to GitHub Pages.

It is static, so it costs nothing to host and never touches the server's memory.

## Rebuild it

```bash
git clone --depth 1 https://github.com/smogon/pokemon-showdown-client.git psclient
cd psclient && npm install && cd ..

node patch-client.js                    # adds the panel + pins the server
cd psclient && node build && cd ..
node assemble-client.js ./client-dist   # static bundle, ~6MB
node build-log-misc.js \
  psclient/play.pokemonshowdown.com/src/battle-log-misc.js \
  ../node_modules/pokemon-showdown/dist/server/chat-formatter.js \
  client-dist/src/battle-log-misc.js
node fix-client-paths.js ./client-dist

cp -r client-dist/* ../../arcade/showdown/   # then commit and push
```

## The four things that are not obvious

**The panel is a `TeamForm`.** That is the component the ladder itself uses, so
the bot group gets the identical format dropdown and team selector and the
player picks a team exactly as they would for a ladder game. Submitting sends
the same `/utm <packed team>` handshake the ladder sends, then the challenge.

**`Config.testclient = true` is load-bearing.** Served from any host other than
`Config.routes.client`, the client injects a hidden `crossdomain.php` iframe into
play.pokemonshowdown.com and waits for a `postMessage` that never arrives for a
host it does not know. It sits on *Connecting…* and never attempts our server at
all — no request to it even appears in the network log. `testclient` skips that
handshake. Its only other effect is loading battle text by relative path, which
already falls back to the official CDN.

**`src/battle-log-misc.js` has to be generated.** Upstream builds it by compiling
the *server's* `chat-formatter.ts` into it (see `build-tools/update`, which needs
a pokemon-showdown checkout in `caches/`). A plain clone ships a stale copy with
no `formatText`, and the official CDN's copy is missing it too, so anything that
renders a chat line throws. `build-log-misc.js` wraps the compiled formatter out
of the `pokemon-showdown` package we actually run, which also keeps client and
server rendering identical.

**`Config.routes.client` deliberately stays on the official host.** Sprites,
audio and dex data then load from their CDN, which keeps this bundle at ~6MB
instead of ~60MB and means the data never goes stale. Only paths that must be
ours are rewritten to be relative, so the site works from a subdirectory.

## Changing the panel

The bot name, difficulty list and default format all come from `config.js`:

```js
Config.botChallenge = {
	name: 'Velvet Bunny',
	difficulties: ['easy', 'normal', 'hard', 'champion'],
	defaultFormat: 'gen9randombattle',
};
```

Editing that file in `arcade/showdown/config/config.js` is enough — no rebuild.
Run `fix-client-paths.js` afterwards so the cachebuster is restamped, or browsers
will keep serving the old config.
