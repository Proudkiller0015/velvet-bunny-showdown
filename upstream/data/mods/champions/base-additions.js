// Showdown 567c1ced: base data the Champions mods rely on that this package's base lacks or has
// differently (scripts/sync-showdown.js baseAdditions). Laid into the Champions mod only. Do not edit.
exports.Pokedex = {
	"absolmegaz": { "inherit": true, "abilities": { "0": "Sharpness" } },
	"garchompmegaz": { "inherit": true, "abilities": { "0": "Levitate" } },
	"lucariomegaz": { "inherit": true, "abilities": { "0": "Aura Guard" } },
	"golisopodmega": { "inherit": true, "abilities": { "0": "Tough Claws" } },
	"baxcaliburmega": { "inherit": true, "abilities": { "0": "Thermal Exchange" } },
	"obliteryx": { "inherit": true, "abilities": { "0": "Opportunist", "1": "Early Bird", "H": "Sniper" }, "baseStats": { "hp": 102, "atk": 128, "def": 126, "spa": 45, "spd": 78, "spe": 64 } },
};
exports.Abilities = {
	"auraguard": { "isNonstandard": "Future", "onSourceModifyDamage": function onSourceModifyDamage(damage, source, target, move) {
      if (move.flags["contact"]) return this.chainModify(0.5);
    }, "flags": { "breakable": 1 }, "name": "Aura Guard", "rating": 3.5, "num": 319 },
};
exports.Items = {

};
exports.Moves = {

};
