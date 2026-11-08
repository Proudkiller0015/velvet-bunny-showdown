exports.Pokedex = {};

// Base data from current Showdown that this package lacks (base-additions.js, scripts/sync-showdown.js).
{
	const table = module.exports.Pokedex;
	for (const [id, entry] of Object.entries(require('./base-additions.js').Pokedex)) {
		if (!table[id]) table[id] = entry;
		else if (table[id].inherit && !entry.inherit) table[id] = { ...entry, ...table[id], inherit: undefined };
		else if (table[id].inherit) table[id] = { ...entry, ...table[id] };
	}
}
