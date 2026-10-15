# Showdex, built for this client

Not the browser extension: a *standalone* build of
[Showdex](https://github.com/doshidak/showdex), which the project supports
precisely so a self-hosted client can carry it.

The extension cannot help us. Its manifest only matches
`play.pokemonshowdown.com`, `*.psim.us` and one other server, so it never runs
on our domain - and extensions do not exist on phones at all, which is where
half the point of a damage calculator is.

## Rebuilding

```
git clone --depth 1 --branch <tag> https://github.com/doshidak/showdex
cd showdex && corepack enable pnpm && pnpm install --frozen-lockfile
NODE_ENV=production BUILD_TARGET=standalone PROD_ANALYZE_BUNDLES=false \
  node --conditions=production ./scripts/build
```

`pnpm build:standalone` itself fails on Windows - its clean step passes a glob
to `rimraf`, which refuses it (`EINVAL`) - so the build script is run directly.
Copy `dist/standalone/*` here, minus `main.js.map`: it is 12MB of source map
that nothing here needs.

The default resource prefix is `/showdex`, which is why this directory is named
what it is. `client/index.html` loads `/showdex/main.js` on `window.load` (it
gives up if the client's own runtime is not ready when it loads) and pulls in
the two Google fonts it expects.

Version built: v1.4.1.

## Patched after the build

`main.js` is edited once after copying, and a rebuild has to redo it: the
calculator's `TYPE_CHART` gets the server's own **Bird** type (MissingNo.'s, see
data/velvet/missingno.js), neutral both ways, right after the chart is assigned
and before the calc builds its type tables. Without it every Bird move -
Data Corruption - calculates as 0 damage (15 Oct 2026). Search for `.Bird=1`.
