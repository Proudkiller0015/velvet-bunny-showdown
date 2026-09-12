"use strict";function _readOnlyError(r){throw new TypeError('"'+r+'" is read-only');}function _inheritsLoose(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,_setPrototypeOf(t,o);}function _setPrototypeOf(t,e){return _setPrototypeOf=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t;},_setPrototypeOf(t,e);}/**
 * Teambuilder team editor, extracted from the rest of the Preact
 * client so that it can be used in isolation.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */





















;var










TeamEditorState=function(_PSModel){







































function TeamEditorState(team){var _this;
_this=_PSModel.call(this)||this;_this.team=void 0;_this.sets=[];_this.lastPackedTeam='';_this.gen=Dex.gen;_this.dex=Dex;_this.deletedSet=null;_this.search=new DexSearch();_this.format="gen"+_this.gen;_this.originalSpecies=null;_this.narrow=false;_this.narrowStats=false;_this.innerFocus=null;_this.isLetsGo=false;_this.isNatDex=false;_this.isBDSP=false;_this.isChampions=false;_this.formeLegality='normal';_this.abilityLegality='normal';_this.defaultLevel=100;_this.readonly=false;_this.fetching=false;_this.handleParentKeyDown=void 0;_this.userSetsCache={};_this.











































































































































































































































































































































































































































































































































































































































































































































































_sampleSetPromises={};_this.team=team;_this.updateTeam(false);_this.setFormat(team.format);window.search=_this.search;return _this;}_inheritsLoose(TeamEditorState,_PSModel);var _proto=TeamEditorState.prototype;_proto.updateTeam=function updateTeam(readonly){if(this.lastPackedTeam!==this.team.packedTeam){this.sets=Teams.unpack(this.team.packedTeam);this.lastPackedTeam=this.team.packedTeam;}this.readonly=readonly;};_proto.setFormat=function setFormat(format){var team=this.team;var formatid=toID(format);this.format=formatid;team.format=formatid;this.dex=Dex.forFormat(formatid);this.gen=this.dex.gen;format=toID(format).slice(4);this.isLetsGo=formatid.includes('letsgo');this.isNatDex=formatid.includes('nationaldex')||formatid.includes('natdex');this.isBDSP=formatid.includes('bdsp');this.isChampions=formatid.includes('champions');if(formatid.includes('almostanyability')||formatid.includes('aaa')){this.abilityLegality='hackmons';}else{this.abilityLegality='normal';}if(formatid.includes('hackmons')||formatid.includes('bh')){this.formeLegality='hackmons';this.abilityLegality='hackmons';}else if(formatid.includes('metronome')||formatid.includes('customgame')){this.formeLegality='custom';this.abilityLegality='hackmons';}else{this.formeLegality='normal';}this.defaultLevel=100;if(formatid.includes('vgc')||formatid.includes('bss')||formatid.includes('ultrasinnohclassic')||formatid.includes('battlespot')||formatid.includes('battlestadium')||formatid.includes('battlefestival')||formatid.includes('letsgo')||formatid.includes('champions')){this.defaultLevel=50;}if(formatid.includes('lc')){this.defaultLevel=5;}};_proto.stringifyFocus=function stringifyFocus(focus){if(!focus)return'';return"set-"+focus.setIndex+"-"+focus.type+(focus.typeIndex>=0?"-"+focus.typeIndex:'');};_proto.parseFocus=function parseFocus(value){if(!value)return null;var match=value.split('-');var type=match[2];return{setIndex:parseInt(match[1]),type:type,typeIndex:match[3]?parseInt(match[3]):-1};};_proto.getField=function getField(_ref){var setIndex=_ref.setIndex,type=_ref.type,typeIndex=_ref.typeIndex;var set=this.sets[setIndex];if(!set)return'';switch(type){case'pokemon':return set.species||'';case'item':return set.item||'';case'ability':return set.ability||'';case'move':return set.moves[typeIndex]||'';case'nickname':return set.name||'';default:return'';}};_proto.normalizeField=function normalizeField(type,value){if(!value.trim())return'';switch(type){case'pokemon':{var species=this.dex.species.get(value);return species.exists?species.name:null;}case'item':{if(toID(value)==='noitem')return'';var item=this.dex.items.get(value);return item.exists?item.name:null;}case'ability':{if(toID(value)==='noability')return'';var ability=this.dex.abilities.get(value);return ability.exists?ability.name:null;}case'move':{var move=this.dex.moves.get(value);return move.exists?move.name:null;}default:return value;}};_proto.setSearchType=function setSearchType(type,i,value){var _this$search;var typeIndex=arguments.length>3&&arguments[3]!==undefined?arguments[3]:-1;var set=this.sets[i];this.search.setType(type,this.format,set);this.originalSpecies=null;this.search.prependResults=null;if(type==='move'){this.search.prependResults=this.getSearchMoves(set,typeIndex);if(value&&this.search.prependResults.some(function(row){return row[1].split('_')[2]===toID(value);})){value='';}}else if(value){switch(type){case'pokemon':if(this.dex.species.get(value).exists){this.originalSpecies=value;this.search.prependResults=[['pokemon',toID(value)]];value='';}break;case'item':if(toID(value)==='noitem')value='';if(this.dex.items.get(value).exists){this.search.prependResults=[['item',toID(value)]];value='';}break;case'ability':if(toID(value)==='selectability')value='';if(toID(value)==='noability')value='';if(this.dex.abilities.get(value).exists){this.search.prependResults=[['ability',toID(value)]];value='';}break;}}if(type==='item')((_this$search=this.search).prependResults||(_this$search.prependResults=[])).push(['item','']);this.search.find(value||'');};_proto.updateSearchMoves=function updateSearchMoves(set){var _this$search$prependR;var typeIndex=arguments.length>1&&arguments[1]!==undefined?arguments[1]:-1;var oldResultsLength=((_this$search$prependR=this.search.prependResults)==null?void 0:_this$search$prependR.length)||0;this.search.prependResults=this.getSearchMoves(set,typeIndex);var selection=Math.max(0,this.search.selection+this.search.prependResults.length-oldResultsLength);this.search.results=null;if(this.search.query){this.setSearchValue('');}else{this.search.find('');this.search.selection=selection;}};_proto.getSearchMoves=function getSearchMoves(set){var typeIndex=arguments.length>1&&arguments[1]!==undefined?arguments[1]:-1;var out=[];var start=typeIndex>=0?typeIndex:0;var end=typeIndex>=0?typeIndex+1:Math.max(set.moves.length,4);for(var i=start;i<end;i++){out.push(['move',"_"+(i+1)+"_"+toID(set.moves[i]||'')]);}return out;};_proto.setSearchValue=function setSearchValue(value){this.search.find(value);};_proto.changeSpecies=function changeSpecies(set,speciesName){var _this$getDefaultItem;var species=this.dex.species.get(speciesName);if(set.item===this.getDefaultItem(set.species))set.item=undefined;if(set.name===set.species.split('-')[0])delete set.name;set.species=species.name;set.ability=this.getDefaultAbility(set);set.item=(_this$getDefaultItem=this.getDefaultItem(species.name))!=null?_this$getDefaultItem:set.item;if(toID(speciesName)==='Cathy'){set.name="Cathy";set.species='Trevenant';set.level=undefined;set.gender='F';set.item='Starf Berry';set.ability='Harvest';set.moves=['Substitute','Horn Leech','Earthquake','Phantom Force'];set.evs={hp:36,atk:252,def:0,spa:0,spd:0,spe:220};set.ivs=undefined;set.nature='Jolly';}};_proto.deleteSet=function deleteSet(index){if(this.sets.length<=index)return;this.deletedSet={set:this.sets[index],index:index};this.sets.splice(index,1);};_proto.undeleteSet=function undeleteSet(){if(!this.deletedSet)return;this.sets.splice(this.deletedSet.index,0,this.deletedSet.set);this.deletedSet=null;};_proto.copySet=function copySet(index){var _TeamEditorState$clip,_TeamEditorState$clip2,_this$team$key;if(this.sets.length<=index)return;TeamEditorState.clipboard||(TeamEditorState.clipboard={teams:{},otherSets:null,readonly:false});(_TeamEditorState$clip=TeamEditorState.clipboard).teams||(_TeamEditorState$clip.teams={});(_TeamEditorState$clip2=TeamEditorState.clipboard.teams)[_this$team$key=this.team.key]||(_TeamEditorState$clip2[_this$team$key]={team:this.team,sets:{},entire:false});if(this.readonly)TeamEditorState.clipboard.readonly=true;if(TeamEditorState.clipboard.teams[this.team.key].sets[index]===this.sets[index]){TeamEditorState.clipboard.teams[this.team.key].entire=false;delete TeamEditorState.clipboard.teams[this.team.key].sets[index];if(!Object.keys(TeamEditorState.clipboard.teams[this.team.key].sets).length){delete TeamEditorState.clipboard.teams[this.team.key];}if(!Object.keys(TeamEditorState.clipboard.teams).length){TeamEditorState.clipboard.teams=null;if(!TeamEditorState.clipboard.otherSets){TeamEditorState.clipboard=null;}}return;}TeamEditorState.clipboard.teams[this.team.key].sets[index]=this.sets[index];};TeamEditorState.copyTeam=function copyTeam(team){var _TeamEditorState$clip3,_TeamEditorState$clip4,_team$key;TeamEditorState.clipboard||(TeamEditorState.clipboard={teams:{},otherSets:null,readonly:false});(_TeamEditorState$clip3=TeamEditorState.clipboard).teams||(_TeamEditorState$clip3.teams={});if(TeamEditorState.clipboard.teams[team.key]){delete TeamEditorState.clipboard.teams[team.key];if(!Object.keys(TeamEditorState.clipboard.teams).length){TeamEditorState.clipboard.teams=null;if(!TeamEditorState.clipboard.otherSets){TeamEditorState.clipboard=null;}}return;}(_TeamEditorState$clip4=TeamEditorState.clipboard.teams)[_team$key=team.key]||(_TeamEditorState$clip4[_team$key]={team:team,sets:{},entire:true});var sets=Teams.unpack(team.packedTeam);for(var i=0;i<sets.length;i++){TeamEditorState.clipboard.teams[team.key].sets[i]=sets[i];}};_proto.pasteSet=function pasteSet(index,isMove){if(!TeamEditorState.clipboard)return;if(this.readonly)return;if(isMove){if(TeamEditorState.clipboard.readonly)return;for(var key in TeamEditorState.clipboard.teams){var clipboardTeam=TeamEditorState.clipboard.teams[key];var sources=Object.keys(clipboardTeam.sets).map(Number);sources.sort(function(a,b){return-(a-b);});for(var _i2=0;_i2<sources.length;_i2++){var source=sources[_i2];if(key===this.team.key){this.sets.splice(source,1);if(source<index)index--;}else{var team=clipboardTeam.team;var _sets=Teams.unpack(team.packedTeam);_sets.splice(source,1);team.packedTeam=Teams.pack(_sets);team.iconCache=null;}}}}var sets=[];for(var _key in TeamEditorState.clipboard.teams){var _clipboardTeam=TeamEditorState.clipboard.teams[_key];for(var _i4=0,_Object$values2=Object.values(_clipboardTeam.sets);_i4<_Object$values2.length;_i4++){var set=_Object$values2[_i4];sets.push(set);}}sets.push.apply(sets,TeamEditorState.clipboard.otherSets||[]);var insertIndex=index;for(var _i6=0;_i6<sets.length;_i6++){var _set=sets[_i6];var newSet=JSON.parse(JSON.stringify(_set));this.sets.splice(index,0,newSet);index++;}TeamEditorState.clipboard=null;this.save();return insertIndex;};TeamEditorState.pasteTeam=function pasteTeam(index,isMove){var folder=arguments.length>2&&arguments[2]!==undefined?arguments[2]:'';if(!TeamEditorState.clipboard)return;if(isMove){if(TeamEditorState.clipboard.readonly)return;var indexesToRemove=[];for(var key in TeamEditorState.clipboard.teams){if(TeamEditorState.clipboard.teams[key].entire){var team=TeamEditorState.clipboard.teams[key].team;var i=PS.teams.list.indexOf(team);if(i>=0)indexesToRemove.push(i);}}indexesToRemove.sort(function(a,b){return-(a-b);});for(var _i9=0;_i9<indexesToRemove.length;_i9++){var _i7=indexesToRemove[_i9];PS.teams.list.splice(_i7,1);if(_i7<index)index--;}}var teams=[];var sets=[];for(var _key2 in TeamEditorState.clipboard.teams){var clipboardTeam=TeamEditorState.clipboard.teams[_key2];if(clipboardTeam.entire){if(isMove){teams.push(clipboardTeam.team);clipboardTeam.team.folder=folder;}else{var _team={name:clipboardTeam.team.name+" (copy)",format:clipboardTeam.team.format,folder:folder,packedTeam:clipboardTeam.team.packedTeam,isBox:clipboardTeam.team.isBox,iconCache:null,key:''};teams.push(_team);}}else{for(var _i11=0,_Object$values4=Object.values(clipboardTeam.sets);_i11<_Object$values4.length;_i11++){var set=_Object$values4[_i11];sets.push(set);}}}sets.push.apply(sets,TeamEditorState.clipboard.otherSets||[]);if(sets.length){var _team2={name:TL(["Pasted team"]),format:Dex.modid,folder:folder,packedTeam:Teams.pack(sets),isBox:false,iconCache:null,key:''};teams.push(_team2);}PS.teams.spliceIn(index,teams);TeamEditorState.clipboard=null;return teams;};_proto.canAdd=function canAdd(){return this.sets.length<6||this.team.isBox;};_proto.showItem=function showItem(set){return!!(this.gen>1&&!this.isLetsGo||set.item);};_proto.showAbility=function showAbility(set){return!!(this.gen>2&&!this.isLetsGo||set.ability);};_proto.getHPType=function getHPType(set){if(set.hpType)return set.hpType;var hpMove=set.ivs?null:this.getHPMove(set);if(hpMove)return hpMove;var hpTypes=['Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel','Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark'];if(this.gen<=2){if(!set.ivs)return'Dark';var atkDV=Math.floor(set.ivs.atk/2);var defDV=Math.floor(set.ivs.def/2);return hpTypes[4*(atkDV%4)+defDV%4];}else{var ivs=set.ivs||this.defaultIVs(set);var hpTypeX=0;var i=1;var statOrder=['hp','atk','def','spe','spa','spd'];for(var _i13=0;_i13<statOrder.length;_i13++){var s=statOrder[_i13];if(ivs[s]===undefined)ivs[s]=31;hpTypeX+=i*(ivs[s]%2);i*=2;}return hpTypes[Math.floor(hpTypeX*15/63)];}};_proto.hpTypeMatters=function hpTypeMatters(set){if(this.gen<2)return false;if(this.gen>7)return false;for(var _i15=0,_set$moves2=set.moves;_i15<_set$moves2.length;_i15++){var move=_set$moves2[_i15];var moveid=toID(move);if(moveid.startsWith('hiddenpower'))return true;if(moveid==='transform')return true;}if(toID(set.ability)==='imposter')return true;return false;};_proto.getHPMove=function getHPMove(set){if(set.moves){for(var _i17=0,_set$moves4=set.moves;_i17<_set$moves4.length;_i17++){var move=_set$moves4[_i17];var moveid=toID(move);if(moveid.startsWith('hiddenpower')){return moveid.charAt(11).toUpperCase()+moveid.slice(12);}}}return null;};_proto.getIVs=function getIVs(set){var ivs=this.defaultIVs(set);if(set.ivs)Object.assign(ivs,set.ivs);return ivs;};_proto.defaultIVs=function defaultIVs(set){var noGuess=arguments.length>1&&arguments[1]!==undefined?arguments[1]:!!set.ivs;var useIVs=this.gen>2;var defaultIVs={hp:31,atk:31,def:31,spa:31,spd:31,spe:31};if(this.isChampions)return defaultIVs;if(!useIVs){for(var _i19=0,_Dex$statNames2=Dex.statNames;_i19<_Dex$statNames2.length;_i19++){var stat=_Dex$statNames2[_i19];defaultIVs[stat]=15;}}if(noGuess)return defaultIVs;var hpType=this.getHPMove(set);var hpModulo=useIVs?2:4;var _this$prefersMinStats=this.prefersMinStats(set),minAtk=_this$prefersMinStats.minAtk,minSpe=_this$prefersMinStats.minSpe;if(minAtk)defaultIVs['atk']=0;if(minSpe)defaultIVs['spe']=0;if(!useIVs){var hpDVs=hpType?this.dex.types.get(hpType).HPdvs:null;if(hpDVs){for(var _stat in hpDVs)defaultIVs[_stat]=hpDVs[_stat];}}else{var hpIVs=hpType?this.dex.types.get(hpType).HPivs:null;if(hpIVs){if(this.canHyperTrain(set)){var _hpIVs$spe,_hpIVs$atk;if(minSpe)defaultIVs['spe']=(_hpIVs$spe=hpIVs['spe'])!=null?_hpIVs$spe:31;if(minAtk)defaultIVs['atk']=(_hpIVs$atk=hpIVs['atk'])!=null?_hpIVs$atk:31;}else{for(var _stat2 in hpIVs)defaultIVs[_stat2]=hpIVs[_stat2];}}}if(hpType){if(minSpe)defaultIVs['spe']%=hpModulo;if(minAtk)defaultIVs['atk']%=hpModulo;}if(minAtk&&useIVs){if(['Gouging Fire','Iron Boulder','Iron Crown','Raging Bolt'].includes(set.species)){defaultIVs['atk']=20;}else if(set.species.startsWith('Terapagos')){defaultIVs['atk']=15;}}return defaultIVs;};_proto.defaultHappiness=function defaultHappiness(set){if(set.moves.includes('Return'))return 255;if(set.moves.includes('Frustration'))return 0;return undefined;};_proto.prefersMinStats=function prefersMinStats(set){var _set$evs,_set$evs2,_this2=this;var minSpe=!((_set$evs=set.evs)!=null&&_set$evs.spe)&&set.moves.includes('Gyro Ball');var minAtk=!((_set$evs2=set.evs)!=null&&_set$evs2.atk);if(set.species.startsWith('Terapagos'))minSpe=false;var preferMaxAtkFormats=['1v1','categoryswap','noholdsbarred','partnersincrime','typesplit'];if(preferMaxAtkFormats.some(function(f){return _this2.format.includes(f);})){minAtk=false;return{minAtk:minAtk,minSpe:minSpe};}if(this.format==='gen7hiddentype')return{minAtk:minAtk,minSpe:minSpe};if(set.ability==='Battle Bond'||['Koraidon','Miraidon','Gimmighoul-Roaming'].includes(set.species)){minAtk=false;return{minAtk:minAtk,minSpe:minSpe};}if(!set.moves.length)minAtk=false;for(var _i21=0,_set$moves6=set.moves;_i21<_set$moves6.length;_i21++){var moveName=_set$moves6[_i21];if(!moveName)continue;var move=this.dex.moves.get(moveName);if(move.id==='transform'){var hasMoveBesidesTransform=set.moves.length>1;if(!hasMoveBesidesTransform)minAtk=false;}else if(move.category==='Physical'&&!move.damage&&!move.ohko&&!['foulplay','endeavor','counter','bodypress','seismictoss','bide','metalburst','superfang'].includes(move.id)&&!(this.gen<8&&move.id==='rapidspin')){minAtk=false;}else if(['metronome','assist','copycat','mefirst','photongeyser','shellsidearm','terablast'].includes(move.id)||this.gen===5&&move.id==='naturepower'){minAtk=false;}}return{minAtk:minAtk,minSpe:minSpe};};_proto.getNickname=function getNickname(set){return set.name||this.dex.species.get(set.species).baseSpecies||'';};_proto.canHyperTrain=function canHyperTrain(set){var format=this.format;if(this.gen<7||format==='gen7hiddentype')return false;if((set.level||this.defaultLevel)===100)return true;if((set.level||this.defaultLevel)>=50&&this.defaultLevel===50)return true;return false;};_proto.getHPIVs=function getHPIVs(hpType){switch(hpType){case'Dark':return['111111'];case'Dragon':return['011111','101111','110111'];case'Ice':return['010111','100111','111110'];case'Psychic':return['011110','101110','110110'];case'Electric':return['010110','100110','111011'];case'Grass':return['011011','101011','110011'];case'Water':return['100011','111010'];case'Fire':return['101010','110010'];case'Steel':return['100010','111101'];case'Ghost':return['101101','110101'];case'Bug':return['100101','111100','101100'];case'Rock':return['001100','110100','100100'];case'Ground':return['000100','111001','101001'];case'Poison':return['001001','110001','100001'];case'Flying':return['000001','111000','101000'];case'Fighting':return['001000','110000','100000'];default:return null;}};_proto.getStat=function getStat(stat,set,ivOverride,evOverride,natureOverride){var _ref2,_set$evs3,_BattleNatures,_BattleNatures2;var species=this.dex.species.get(set.species);if(!species.exists)return 0;var level=set.level||this.defaultLevel;var baseStat=species.baseStats[stat];var iv=ivOverride;var ev=(_ref2=evOverride!=null?evOverride:(_set$evs3=set.evs)==null?void 0:_set$evs3[stat])!=null?_ref2:this.gen>2?0:252;if(this.isChampions)ev*=8;if(stat==='hp'){if(baseStat===1)return 1;if(this.isLetsGo)return Math.trunc(Math.trunc(2*baseStat+iv+100)*level/100+10)+ev;return Math.trunc(Math.trunc(2*baseStat+iv+Math.trunc(ev/4)+100)*level/100+10);}var val=Math.trunc(Math.trunc(2*baseStat+iv+Math.trunc(ev/4))*level/100+5);if(this.isLetsGo){val=Math.trunc(Math.trunc(2*baseStat+iv)*level/100+5);}if(natureOverride){val*=natureOverride;}else if(((_BattleNatures=BattleNatures[set.nature])==null?void 0:_BattleNatures.plus)===stat){val*=1.1;}else if(((_BattleNatures2=BattleNatures[set.nature])==null?void 0:_BattleNatures2.minus)===stat){val*=0.9;}if(this.isLetsGo){var friendshipValue=Math.trunc((70/255/10+1)*100);val=Math.trunc(val)*friendshipValue/100+ev;}return Math.trunc(val);};_proto["export"]=function _export(includeTrailingSpaces){var exported=Teams["export"](this.sets,this.dex);if(includeTrailingSpaces)return exported.replace(/^(.+)$/gm,'$1  ');return exported;};_proto["import"]=function _import(value){this.sets=Teams["import"](value);this.save();};_proto.getTypeWeakness=function getTypeWeakness(type,attackType){var _this$dex$types$get$d;var weaknessType=(_this$dex$types$get$d=this.dex.types.get(type).damageTaken)==null?void 0:_this$dex$types$get$d[attackType];if(weaknessType===Dex.IMMUNE)return 0;if(weaknessType===Dex.RESIST)return 0.5;if(weaknessType===Dex.WEAK)return 2;return 1;};_proto.getWeakness=function getWeakness(types,abilityid,attackType){var abilityFactor=BattleTooltips.getTypeAbilityWeakness(attackType,abilityid,this.dex);if(abilityFactor===0)return 0;if(abilityid==='wonderguard'){for(var _i23=0;_i23<types.length;_i23++){var type=types[_i23];if(this.getTypeWeakness(type,attackType)<=1)return 0;}}var factor=abilityFactor;for(var _i25=0;_i25<types.length;_i25++){var _type=types[_i25];factor*=this.getTypeWeakness(_type,attackType);}return factor;};_proto.pokemonDefensiveCoverage=function pokemonDefensiveCoverage(set){var coverage={};var species=this.dex.species.get(set.species);var abilityid=toID(set.ability);for(var _i27=0,_this$dex$types$names2=this.dex.types.names();_i27<_this$dex$types$names2.length;_i27++){var type=_this$dex$types$names2[_i27];coverage[type]=this.getWeakness(species.types,abilityid,type);}return coverage;};_proto.teamDefensiveCoverage=function teamDefensiveCoverage(){var counters={};for(var _i29=0,_this$dex$types$names4=this.dex.types.names();_i29<_this$dex$types$names4.length;_i29++){var type=_this$dex$types$names4[_i29];counters[type]={type:type,resists:0,neutrals:0,weaknesses:0};}for(var _i31=0,_this$sets2=this.sets;_i31<_this$sets2.length;_i31++){var set=_this$sets2[_i31];var coverage=this.pokemonDefensiveCoverage(set);for(var _i33=0,_Object$entries2=Object.entries(coverage);_i33<_Object$entries2.length;_i33++){var _ref3=_Object$entries2[_i33];var _type2=_ref3[0];var _value=_ref3[1];if(_value<1){counters[_type2].resists++;}else if(_value===1){counters[_type2].neutrals++;}else{counters[_type2].weaknesses++;}}}return counters;};_proto.getDefaultAbility=function getDefaultAbility(set){if(this.gen<3||this.isLetsGo||this.formeLegality==='custom')return set.ability;var species=this.dex.species.get(set.species);if(this.formeLegality==='hackmons'){if(this.gen<9||species.baseSpecies!=='Xerneas')return set.ability;}else if(this.abilityLegality==='hackmons'){if(!species.battleOnly)return set.ability;if(species.requiredItems.length||species.baseSpecies==='Meloetta')return set.ability;return species.abilities[0];}var abilities=Object.values(species.abilities);if(abilities.length===1)return abilities[0];if(set.ability&&abilities.includes(set.ability))return set.ability;return undefined;};_proto.getDefaultItem=function getDefaultItem(speciesName){var species=this.dex.species.get(speciesName);var items=species.requiredItems;if(this.gen!==7&&!this.isNatDex){items=items.filter(function(i){return!i.endsWith('ium Z');});}if(items.length===1){if(this.formeLegality==='normal'||this.formeLegality==='hackmons'&&this.gen===9&&species.battleOnly&&!species.isMega&&!species.isPrimal&&species.name!=='Necrozma-Ultra'){return items[0];}}return undefined;};_proto.save=function save(){this.team.packedTeam=Teams.pack(this.sets);this.lastPackedTeam=this.team.packedTeam;this.team.iconCache=null;};_proto.
fetchSampleSets=function fetchSampleSets(formatid){var _this3=this;
if(formatid in TeamEditorState.sampleSets)return;
if(formatid.length<=4){
TeamEditorState.sampleSets[formatid]=null;
return;
}
if(!(formatid in this._sampleSetPromises)){
this._sampleSetPromises[formatid]=Net("https://"+
Config.routes.client+"/data/sets/"+formatid+".json"
).get().then(function(json){
var data=JSON.parse(json);
TeamEditorState.sampleSets[formatid]=data;
_this3.update();
})["catch"](function(){
TeamEditorState.sampleSets[formatid]=null;
});
}
};_proto.

getSampleSets=function getSampleSets(set){var _d$stats,_d$stats2;
var d=TeamEditorState.sampleSets[this.format];
if(d===undefined){
this.fetchSampleSets(this.format);
return null;
}
if(!(d!=null&&d.dex))return[];
var speciesid=toID(set.species);
var all=Object.assign({},
d.dex[set.species],
d.dex[speciesid],(_d$stats=
d.stats)==null?void 0:_d$stats[set.species],(_d$stats2=
d.stats)==null?void 0:_d$stats2[speciesid]);

return Object.keys(all);
};_proto.

getUserSets=function getUserSets(set){
if(!this.userSetsCache[this.format]){
var userSets={};for(var _i35=0,_ref5=

((_window$PS=window.PS)==null?void 0:_window$PS.teams.list)||[];_i35<_ref5.length;_i35++){var _window$PS;var team=_ref5[_i35];
if(team.format!==this.format||!team.isBox)continue;

var setList=Teams.unpack(team.packedTeam);
var duplicateNameIndices={};for(var _i37=0;_i37<

setList.length;_i37++){var _boxSet$species,_userSets$_boxSet$spe;var boxSet=setList[_i37];
var name=boxSet.name||boxSet.species;
if(duplicateNameIndices[name]){
name+=" "+duplicateNameIndices[name];
}
duplicateNameIndices[name]=(duplicateNameIndices[name]||0)+1;

(_userSets$_boxSet$spe=userSets[_boxSet$species=boxSet.species])!=null?_userSets$_boxSet$spe:userSets[_boxSet$species]={};
userSets[boxSet.species][name]=boxSet;
}
}

this.userSetsCache[this.format]=userSets;
}

var cachedSets=this.userSetsCache[this.format];
if(Object.keys(cachedSets).length===0)return null;
return cachedSets[set.species]||{};
};_proto.
loadSampleSet=function loadSampleSet(setIndex,setName){var _TeamEditorState$samp,_ref6,_ref7,_data$dex$set$species,_data$dex,_data$dex2,_data$stats,_data$stats2;
if(this.readonly)return false;
var set=this.sets[setIndex];
if(!(set!=null&&set.species))return false;

var data=(_TeamEditorState$samp=TeamEditorState.sampleSets)==null?void 0:_TeamEditorState$samp[this.format];
var sid=toID(set.species);
var setTemplate=(_ref6=(_ref7=(_data$dex$set$species=data==null||(_data$dex=data.dex)==null||(_data$dex=_data$dex[set.species])==null?void 0:_data$dex[setName])!=null?_data$dex$set$species:data==null||(_data$dex2=data.dex)==null||(_data$dex2=_data$dex2[sid])==null?void 0:_data$dex2[setName])!=null?_ref7:
data==null||(_data$stats=data.stats)==null||(_data$stats=_data$stats[set.species])==null?void 0:_data$stats[setName])!=null?_ref6:data==null||(_data$stats2=data.stats)==null||(_data$stats2=_data$stats2[sid])==null?void 0:_data$stats2[setName];
if(!setTemplate)return false;

var applied=JSON.parse(JSON.stringify(setTemplate));
Object.assign(set,applied);

this.save();
return true;
};_proto.
loadUserSet=function loadUserSet(setIndex,setName){
if(this.readonly)return false;
var set=this.sets[setIndex];
if(!(set!=null&&set.species))return false;

var userSets=this.getUserSets(set);
var setTemplate=userSets==null?void 0:userSets[setName];
if(!setTemplate)return false;

var applied=JSON.parse(JSON.stringify(setTemplate));
delete applied.name;
Object.assign(set,applied);

this.save();
return true;
};TeamEditorState.

renderClipboard=function renderClipboard(cancelClipboard){var _Object$values5,_TeamEditorState$clip5;
if(!TeamEditorState.clipboard)return null;

var renderSet=function(set){return preact.h("div",{"class":"set"},
preact.h("small",null,
preact.h(PSIcon,{pokemon:set})," ",set.name||set.species,
set.ability&&" ["+set.ability+"]",set.item&&" @ "+set.item,
" - ",set.moves.join(' / ')||'(No moves)'
)
);};
var renderTeam=function(team,sets){return preact.h("div",{"class":"set"},preact.h("small",null,
preact.h("strong",null,team.name),preact.h("br",null),
sets.map(function(set){return preact.h(PSIcon,{pokemon:set});})
));};

return preact.h("div",{"class":"infobox"},"Clipboard",(_Object$values5=

Object.values(TeamEditorState.clipboard.teams||{}))==null?void 0:_Object$values5.map(function(clipboardTeam){return(
clipboardTeam.entire?
renderTeam(clipboardTeam.team,Object.values(clipboardTeam.sets)):

Object.values(clipboardTeam.sets).map(function(set){return renderSet(set);}));}

),(_TeamEditorState$clip5=
TeamEditorState.clipboard.otherSets)==null?void 0:_TeamEditorState$clip5.map(function(set){return renderSet(set);}),
preact.h("button",{"class":"button",onClick:cancelClipboard},
preact.h("i",{"class":"fa fa-times","aria-hidden":true})," ",TL(["[Cancel]"])
)
);
};return TeamEditorState;}(PSModel);TeamEditorState.clipboard=null;TeamEditorState.sampleSets={};var


TeamEditor=function(_preact$Component){function TeamEditor(){var _this4;for(var _len=arguments.length,args=new Array(_len),_key3=0;_key3<_len;_key3++){args[_key3]=arguments[_key3];}_this4=_preact$Component.call.apply(_preact$Component,[this].concat(args))||this;_this4.




mode='form';_this4.
spacious=null;_this4.
zoomOutForms=false;_this4.
zoomOutSearch=false;_this4.
editor=void 0;_this4.
optionsMenu=null;_this4.









setTab=function(ev){
var target=ev.currentTarget;
_this4.mode=target.value;
_this4.forceUpdate();
};_this4.
setLayout=function(ev){
var layout=ev.currentTarget.value;
var spacious=layout==='automatic'?null:layout==='comfortable';
if(window.PS){
window.PS.prefs.set('teameditorspacious',spacious);
}else{
_this4.spacious=spacious;
}
_this4.forceUpdate();
};_this4.
setZoomOutForms=function(ev){
var checked=ev.currentTarget.checked;
if(window.PS){
window.PS.prefs.set('teameditorzoomoutforms',checked?true:null);
}
_this4.zoomOutForms=checked;
_this4.forceUpdate();
};_this4.
setZoomOutSearch=function(ev){
var checked=ev.currentTarget.checked;
if(window.PS){
window.PS.prefs.set('teameditorzoomoutsearch',checked?true:null);
}
_this4.zoomOutSearch=checked;
_this4.forceUpdate();
};_this4.
updateMobileScale=function(){
var elem=_this4.base;
if(!elem)return;
var scale=Math.min(window.innerWidth/635,1)||1;
elem.style.setProperty('--teameditor-mobile-scale',""+scale);
if(_this4.getZoomOutForms()){
var setList=elem.querySelector('.set-list, .team-focus-editor .set-form');
var heightOffset=setList?-setList.offsetHeight*(1-scale):0;
elem.style.setProperty('--teameditor-mobile-height-offset',heightOffset+"px");
}else{
elem.style.setProperty('--teameditor-mobile-height-offset',"0px");
}
if(_this4.getZoomOutSearch()){
var focusEditor=elem.querySelector('.team-focus-editor');
var searchResults=focusEditor==null?void 0:focusEditor.querySelector('.set-searchresults');
if(focusEditor&&searchResults){
var availableHeight=focusEditor.clientHeight-searchResults.offsetTop;
elem.style.setProperty('--teameditor-mobile-search-height',availableHeight/scale+"px");
}
}
};_this4.
closeOptionsOnClick=function(ev){var _this4$optionsMenu;
if(!((_this4$optionsMenu=_this4.optionsMenu)!=null&&_this4$optionsMenu.open))return;
if(ev.target&&_this4.optionsMenu.contains(ev.target))return;
_this4.optionsMenu.open=false;
};_this4.
handleResize=function(){
_this4.forceUpdate();
};_this4.


















































cancelClipboard=function(){
TeamEditorState.clipboard=null;
_this4.forceUpdate();
};_this4.
update=function(){
_this4.forceUpdate();
};return _this4;}_inheritsLoose(TeamEditor,_preact$Component);var _proto2=TeamEditor.prototype;_proto2.getSpacious=function getSpacious(){var _ref8,_window$PS$prefs$team,_window$PS2;return(_ref8=(_window$PS$prefs$team=(_window$PS2=window.PS)==null?void 0:_window$PS2.prefs.teameditorspacious)!=null?_window$PS$prefs$team:this.spacious)!=null?_ref8:document.documentElement.clientHeight>=950;};_proto2.getZoomOutForms=function getZoomOutForms(){var _window$PS$prefs$team2,_window$PS3;return(_window$PS$prefs$team2=(_window$PS3=window.PS)==null?void 0:_window$PS3.prefs.teameditorzoomoutforms)!=null?_window$PS$prefs$team2:this.zoomOutForms;};_proto2.getZoomOutSearch=function getZoomOutSearch(){var _window$PS$prefs$team3,_window$PS4;return(_window$PS$prefs$team3=(_window$PS4=window.PS)==null?void 0:_window$PS4.prefs.teameditorzoomoutsearch)!=null?_window$PS$prefs$team3:this.zoomOutSearch;};_proto2.componentDidMount=function componentDidMount(){window.addEventListener('click',this.closeOptionsOnClick);window.addEventListener('resize',this.handleResize);this.updateMobileScale();};_proto2.componentDidUpdate=function componentDidUpdate(){this.updateMobileScale();};_proto2.componentWillUnmount=function componentWillUnmount(){window.removeEventListener('click',this.closeOptionsOnClick);window.removeEventListener('resize',this.handleResize);};TeamEditor.probablyMobile=function probablyMobile(){return window.innerWidth<500;};_proto2.renderDefensiveCoverage=function renderDefensiveCoverage(){var editor=this.editor;if(editor.team.isBox)return null;if(!editor.sets.length)return null;var counters=Object.values(editor.teamDefensiveCoverage());PSUtils.sortBy(counters,function(counter){return[counter.resists,-counter.weaknesses];});var good=[],medium=[],bad=[];var renderTypeDefensive=function(counter){return preact.h("tr",null,preact.h("th",null,editor.dex.text.typeName(counter.type)),preact.h("td",null,counter.resists," ",preact.h("small",{"class":"gray"},TL(["Resist"]))),preact.h("td",null,counter.weaknesses," ",preact.h("small",{"class":"gray"},TL(["Weak"]))));};for(var _i39=0;_i39<counters.length;_i39++){var counter=counters[_i39];if(counter.resists>0){good.push(renderTypeDefensive(counter));}else if(counter.weaknesses<=0){medium.push(renderTypeDefensive(counter));}else{bad.push(renderTypeDefensive(counter));}}return preact.h("details",{"class":"details"},preact.h("summary",null,preact.h("strong",null,TL(["Defensive coverage"])),preact.h("table",{"class":"details-preview table"},bad,preact.h("tr",null,preact.h("td",{colSpan:3},preact.h("span",{"class":"details-preview ilink"},preact.h("small",null,TL(["[See all]"]))))))),preact.h("table",{"class":"table"},bad,medium,good));};_proto2.
render=function render(){var _this5=this,_this$props$narrow;
if(!this.editor){var _this$props$editorRef,_this$props;
this.editor=new TeamEditorState(this.props.team);
this.editor.subscribe(function(){
_this5.forceUpdate();
});
(_this$props$editorRef=(_this$props=this.props).editorRef)==null||_this$props$editorRef.call(_this$props,this.editor);
}
var editor=this.editor;
window.editor=editor;
editor.updateTeam(!!this.props.readOnly);
var mobileOptions=window.innerWidth<635;
var spacious=this.getSpacious();
var zoomOutForms=this.getZoomOutForms();
var zoomOutSearch=this.getZoomOutSearch();
var useZoomedOutForms=this.mode==='form'&&zoomOutForms&&mobileOptions;
var narrow=(_this$props$narrow=this.props.narrow)!=null?_this$props$narrow:window.innerWidth<500;
editor.narrow=!useZoomedOutForms&&narrow;
editor.narrowStats=useZoomedOutForms||narrow;
if(this.props.team.format!==editor.format){
editor.setFormat(this.props.team.format);
}
var useSpaciousCSS=spacious&&!mobileOptions||useZoomedOutForms;
var className="teameditor"+(useSpaciousCSS?' teameditor-spacious':'')+(""+(
useZoomedOutForms?' teameditor-zoom-out-forms':''))+(""+(
zoomOutSearch&&mobileOptions?' teameditor-full-size-search':''));
var layout=window.PS?window.PS.prefs.teameditorspacious:this.spacious;
var automaticLayout=document.documentElement.clientHeight>=950?TL(["Comfortable"]):TL(["Compact"]);

return preact.h("div",{"class":className},
preact.h("ul",{"class":"tabbar unpadded-tabbar"},
preact.h("li",null,preact.h("button",{onClick:this.setTab,value:"form","class":"button"+(this.mode==='form'?' cur':'')},
TL(["Form"])
)),
preact.h("li",null,preact.h("button",{onClick:this.setTab,value:"import","class":"button button-last"+(this.mode==='import'?' cur':'')},
TL(["Import/Export"])
)),
preact.h("li",{"class":"teameditor-options",style:"float: right; margin-top: 1px; margin-right: 8px;"},
preact.h("details",{ref:function(el){_this5.optionsMenu=el;}},
preact.h("summary",{"class":"button button-first"},TL(["[Options]"])),
preact.h("div",{"class":"teameditor-options-menu"},
mobileOptions?preact.h("label",{"class":"checkbox"},preact.h("input",{
name:"zoomoutforms",type:"checkbox",
checked:zoomOutForms,onChange:this.setZoomOutForms}
)," ",TL(["Zoom out forms"])):preact.h("label",null,TL.label(TL(["Layout"])),preact.h("select",{
name:"layout","class":"select",onChange:this.setLayout,
value:layout===null?'automatic':layout?'comfortable':'compact'},

preact.h("option",{value:"automatic"},TL(["Automatic (",")"],automaticLayout)),
preact.h("option",{value:"compact"},TL(["Compact"])),
preact.h("option",{value:"comfortable"},TL(["Comfortable"]))
)),
mobileOptions&&preact.h("label",{"class":"checkbox"},preact.h("input",{
name:"zoomoutsearch",type:"checkbox",
checked:zoomOutSearch,onChange:this.setZoomOutSearch}
)," ",TL(["Zoom out search results"]))
)
)
)
),
TeamEditorState.renderClipboard(this.cancelClipboard),
this.mode==='form'?
preact.h(TeamEditorForm,{editor:editor,onChange:this.props.onChange,onUpdate:this.update}):

preact.h(TeamTextbox,{editor:editor,onChange:this.props.onChange,onUpdate:this.update}),

!this.editor.innerFocus&&preact.h("div",{"class":"team-pad"},
this.props.children,
preact.h("div",{"class":"team-resources"},
preact.h("br",null),preact.h("hr",null),preact.h("br",null),
this.renderDefensiveCoverage(),
this.props.resources
)
)
);
};return TeamEditor;}(preact.Component);var


TeamTextbox=function(_preact$Component2){function TeamTextbox(){var _this6;for(var _len2=arguments.length,args=new Array(_len2),_key4=0;_key4<_len2;_key4++){args[_key4]=arguments[_key4];}_this6=_preact$Component2.call.apply(_preact$Component2,[this].concat(args))||this;_this6.



state={
copyButtonUsed:undefined
};_this6.

editor=void 0;_this6.
setInfo=



[];_this6.
textbox=null;_this6.
heightTester=null;_this6.

setDirty=false;_this6.
selection=




null;_this6.
innerFocus=








null;_this6.







input=function(){
_this6.updateText();
_this6.save();
};_this6.
keyUp=function(){return _this6.updateText(true);};_this6.
contextMenu=function(ev){
if(!ev.shiftKey){var _this6$innerFocus,_this6$innerFocus2;
var hadInnerFocus=(_this6$innerFocus=_this6.innerFocus)==null?void 0:_this6$innerFocus.range[1];
_this6.openInnerFocus();
if(hadInnerFocus!==((_this6$innerFocus2=_this6.innerFocus)==null?void 0:_this6$innerFocus2.range[1])){
ev.preventDefault();
ev.stopImmediatePropagation();
}
}
};_this6.













keyDown=function(ev){
var editor=_this6.editor;
switch(ev.keyCode){
case 27:
case 8:
if(_this6.innerFocus){
var atStart=_this6.innerFocus.range[0]===_this6.textbox.selectionStart&&
_this6.innerFocus.range[0]===_this6.textbox.selectionEnd;
if(ev.keyCode===27||atStart){
if(editor.search.removeFilter()){
editor.setSearchValue(_this6.getInnerFocusValue());
_this6.resetScroll();
_this6.forceUpdate();
ev.stopImmediatePropagation();
ev.preventDefault();
}else if(_this6.closeMenu()){
ev.stopImmediatePropagation();
ev.preventDefault();
}
}
}
break;
case 38:
if(_this6.innerFocus){
editor.search.moveSelection(-1);
ev.preventDefault();
}
break;
case 40:
if(_this6.innerFocus){
editor.search.moveSelection(1);
ev.preventDefault();
}
break;
case 9:
case 13:
if(ev.keyCode===13&&ev.shiftKey)return;
if(ev.altKey||ev.metaKey)return;
if(!_this6.innerFocus){
if(_this6.maybeReplaceLine()){

}else if(
_this6.textbox.selectionStart===_this6.textbox.value.length&&(
_this6.textbox.value.endsWith('\n\n')||!_this6.textbox.value))
{
_this6.addPokemon();
}else if(!_this6.openInnerFocus()){
break;
}
ev.stopImmediatePropagation();
ev.preventDefault();
}else{
var result=editor.search.selectResult();
if(result!==null){
var _editor$search$getRes=editor.search.getResultName(result).split('|'),name=_editor$search$getRes[0],moveSlot=_editor$search$getRes[1];
_this6.selectResult(_this6.innerFocus.type,name,moveSlot);
}else{
_this6.replaceNoFocus('',_this6.innerFocus.range[0],_this6.innerFocus.range[1]);
editor.setSearchValue('');
_this6.forceUpdate();
}
_this6.resetScroll();
ev.stopImmediatePropagation();
ev.preventDefault();
}
break;
case 80:
if(ev.metaKey){var _window$PS5;
(_window$PS5=window.PS)==null||_window$PS5.alert(editor["export"]());
ev.stopImmediatePropagation();
ev.preventDefault();
break;
}
}
};_this6.
maybeReplaceLine=function(){var _exec;
if(_this6.textbox.selectionStart!==_this6.textbox.selectionEnd)return;
var current=_this6.textbox.selectionEnd;
var lineStart=_this6.textbox.value.lastIndexOf('\n',current)+1;
var value=_this6.textbox.value.slice(lineStart,current);

var pokepaste=(_exec=/^https?:\/\/pokepast.es\/([a-z0-9]+)(?:\/.*)?$/.exec(value))==null?void 0:_exec[1];
if(pokepaste){
_this6.editor.fetching=true;
Net("https://pokepast.es/"+pokepaste+"/json").get().then(function(json){
var paste=JSON.parse(json);
var pasteTxt=paste.paste.replace(/\r\n/g,'\n');
if(_this6.textbox){

var valueIndex=_this6.textbox.value.indexOf(value);
_this6.replace(paste.paste.replace(/\r\n/g,'\n'),valueIndex,valueIndex+value.length);
}else{
_this6.editor["import"](pasteTxt);
_this6.props.onChange==null||_this6.props.onChange();
}
var notes=paste["notes"];
if(notes.startsWith("Format: ")){
var formatid=toID(notes.slice(8));
_this6.editor.setFormat(formatid);
}
var title=paste["title"];
if(title&&!title.startsWith('Untitled')){
_this6.editor.team.name=title.replace(/[|\\/]/g,'');
}
_this6.editor.fetching=false;
_this6.props.onUpdate==null||_this6.props.onUpdate();
});
return true;
}
return false;
};_this6.















closeMenu=function(){
if(_this6.innerFocus){
_this6.clearInnerFocus();
if(_this6.setDirty){
_this6.updateText();
_this6.save();
}else{
_this6.forceUpdate();
}
PSView.politeFocus(_this6.textbox);
return true;
}
return false;
};_this6.
updateText=function(noTextChange,autoSelect){
var textbox=_this6.textbox;
var value=textbox.value;
var selectionStart=textbox.selectionStart||0;
var selectionEnd=textbox.selectionEnd||0;

if(_this6.innerFocus){
if(!noTextChange){
var lineEnd=_this6.textbox.value.indexOf('\n',_this6.innerFocus.range[0]);
if(lineEnd<0)lineEnd=_this6.textbox.value.length;
var line=_this6.textbox.value.slice(_this6.innerFocus.range[0],lineEnd);
if(_this6.innerFocus.rangeEndChar){
var _index=line.indexOf(_this6.innerFocus.rangeEndChar);
if(_index>=0)lineEnd=_this6.innerFocus.range[0]+_index;
}
_this6.innerFocus.range[1]=lineEnd;
}
var _this6$innerFocus$ran=_this6.innerFocus.range,start=_this6$innerFocus$ran[0],end=_this6$innerFocus$ran[1];
if(selectionStart>=start&&selectionStart<=end&&selectionEnd>=start&&selectionEnd<=end){
if(!noTextChange){
_this6.updateSearch();
_this6.setDirty=true;
}
return;
}
_this6.clearInnerFocus();
value=textbox.value;
selectionStart=textbox.selectionStart||0;
selectionEnd=textbox.selectionEnd||0;
}

if(_this6.setDirty){
_this6.setDirty=false;
noTextChange=false;
}

_this6.heightTester.style.width=textbox.offsetWidth+"px";

var index=0;

var setIndex=null;
var moveIndex=0;
var nextSetIndex=0;
if(!noTextChange)_this6.setInfo=[];
_this6.selection=null;

while(index<value.length){
var nlIndex=value.indexOf('\n',index);
if(nlIndex<0)nlIndex=value.length;
var _line=value.slice(index,nlIndex);

if(!_line.trim()){
setIndex=null;
moveIndex=0;
index=nlIndex+1;
continue;
}

if(setIndex===null&&index&&!noTextChange&&_this6.setInfo.length){
_this6.setInfo[_this6.setInfo.length-1].bottomY=_this6.getYAt(index-1);
}

if(setIndex===null){
if(!noTextChange){
var atIndex=_line.indexOf('@');
var species=atIndex>=0?_line.slice(0,atIndex).trim():_line.trim();
if(species.endsWith(' (M)')||species.endsWith(' (F)')){
species=species.slice(0,-4);
}
if(species.endsWith(')')){
var parenIndex=species.lastIndexOf(' (');
if(parenIndex>=0){
species=species.slice(parenIndex+2,-1);
}
}
_this6.setInfo.push({
species:species,
bottomY:-1,
index:index
});
}
setIndex=nextSetIndex;
moveIndex=0;
nextSetIndex++;
}

var selectionEndCutoff=selectionStart===selectionEnd?nlIndex:nlIndex+1;
var _start=index,_end=index+_line.length;
if(index<=selectionStart&&selectionEnd<=selectionEndCutoff){

var type=null;
var lcLine=_line.toLowerCase().trim();

var typeIndex=-1;
if(lcLine.startsWith('ability:')){
type='ability';
}else if(lcLine.startsWith('-')){
type='move';
typeIndex=moveIndex;
}else if(
!lcLine||lcLine.startsWith('level:')||lcLine.startsWith('gender:')||
(lcLine+':').startsWith('shiny:')||(lcLine+':').startsWith('gigantamax:')||
lcLine.startsWith('tera type:')||lcLine.startsWith('dynamax level:'))
{
type='details';
}else if(
lcLine.startsWith('ivs:')||lcLine.startsWith('evs:')||
lcLine.endsWith(' nature'))
{
type='stats';
}else{
type='pokemon';
var _atIndex=_line.indexOf('@');
if(_atIndex>=0){
if(selectionStart>index+_atIndex){
type='item';
_start=index+_atIndex+1;
}else{
_end=index+_atIndex;
if(_line.charAt(_atIndex-1)===']'||_line.charAt(_atIndex-2)===']'){
type='ability';
}
}
}
}

if(typeof autoSelect==='string')autoSelect=autoSelect===type;
_this6.selection={
setIndex:setIndex,type:type,lineRange:[_start,_end],typeIndex:typeIndex
};
if(autoSelect)_this6.engageFocus();
}

if(_line.trim().startsWith('-'))moveIndex++;
index=nlIndex+1;
}
if(!noTextChange){
var _end2=value.endsWith('\n\n')?value.length-1:value.length;
var bottomY=_this6.getYAt(_end2,true);
if(_this6.setInfo.length){
_this6.setInfo[_this6.setInfo.length-1].bottomY=bottomY;
}

textbox.style.height=bottomY+100+"px";
}
_this6.forceUpdate();
};_this6.














































selectResult=function(type,name,moveSlot){
if(type===null){
_this6.resetScroll();
_this6.forceUpdate();
}else if(!type){
_this6.changeSet(_this6.innerFocus.type,'');
}else{
_this6.changeSet(type,name,moveSlot);
}
};_this6.













































































































































































clickDetails=function(ev){var _this6$innerFocus3;
var target=ev.currentTarget;
var i=parseInt(target.value||'0');
if(((_this6$innerFocus3=_this6.innerFocus)==null?void 0:_this6$innerFocus3.type)===target.name){
_this6.innerFocus=null;
_this6.forceUpdate();
return;
}
_this6.engageFocus({
offsetY:null,
setIndex:i,
type:target.name,
typeIndex:-1,
range:[0,0],
rangeEndChar:''
});
};_this6.
addPokemon=function(){
if(_this6.textbox.value&&!_this6.textbox.value.endsWith('\n\n')){
_this6.textbox.value+=_this6.textbox.value.endsWith('\n')?'\n':'\n\n';
}
var end=_this6.textbox.value==='\n\n'?0:_this6.textbox.value.length;
_this6.textbox.setSelectionRange(end,end);
PSView.politeFocus(_this6.textbox);
_this6.engageFocus({
offsetY:_this6.getYAt(end,true),
setIndex:_this6.setInfo.length,
type:'pokemon',
typeIndex:-1,
range:[end,end],
rangeEndChar:'@'
});
};_this6.












































handleSetChange=function(){
if(_this6.selection){
_this6.replaceSet(_this6.selection.setIndex);
_this6.forceUpdate();
}
};_this6.



copyAll=function(ev){
_this6.textbox.select();
document.execCommand('copy');
clearTimeout(_this6.state.copyButtonUsed);
_this6.setState({
copyButtonUsed:setTimeout(function(){return _this6.setState({copyButtonUsed:undefined});},3000)
});
};return _this6;}_inheritsLoose(TeamTextbox,_preact$Component2);var _proto3=TeamTextbox.prototype;_proto3.getYAt=function getYAt(index,fullLine){if(index<0)return 10;if(index===0)return 31;var newValue=this.textbox.value.slice(0,index);this.heightTester.value=fullLine&&!newValue.endsWith('\n')?newValue+'\n':newValue;return this.heightTester.scrollHeight;};_proto3.openInnerFocus=function openInnerFocus(){var _this$selection;var oldRange=(_this$selection=this.selection)==null?void 0:_this$selection.lineRange;this.updateText(true,true);if(this.selection){if(this.selection.lineRange===oldRange)return!!this.innerFocus;if(this.textbox.selectionStart===this.textbox.selectionEnd){var range=this.getSelectionTypeRange();if(range)this.textbox.setSelectionRange(range[0],range[1]);}}return!!this.innerFocus;};_proto3.getInnerFocusValue=function getInnerFocusValue(){if(!this.innerFocus)return'';return this.textbox.value.slice(this.innerFocus.range[0],this.innerFocus.range[1]);};_proto3.clearInnerFocus=function clearInnerFocus(){if(this.innerFocus){if(this.innerFocus.type==='pokemon'){var _value2=this.getInnerFocusValue();if(!toID(_value2)){this.replaceNoFocus(this.editor.originalSpecies||'',this.innerFocus.range[0],this.innerFocus.range[1]);}}this.innerFocus=null;}};_proto3.engageFocus=function engageFocus(focus){if(this.innerFocus&&!focus)return;var editor=this.editor;if(editor.readonly)return;if(!focus){var _this$selection2;if(!((_this$selection2=this.selection)!=null&&_this$selection2.type))return;var range=this.getSelectionTypeRange();if(!range)return;var _this$selection3=this.selection,type=_this$selection3.type,setIndex=_this$selection3.setIndex;var rangeEndChar=this.textbox.value.charAt(range[1]);if(rangeEndChar===' ')rangeEndChar+=this.textbox.value.charAt(range[1]+1);focus={offsetY:this.getYAt(range[0]),setIndex:setIndex,type:type,typeIndex:this.selection.typeIndex,range:range,rangeEndChar:rangeEndChar};}this.innerFocus=focus;if(focus.type==='details'||focus.type==='stats'||focus.type==='import'){this.forceUpdate();return;}var value=this.textbox.value.slice(focus.range[0],focus.range[1]);editor.setSearchType(focus.type,focus.setIndex,value,focus.typeIndex);this.resetScroll();this.textbox.setSelectionRange(focus.range[0],focus.range[1]);this.forceUpdate();};_proto3.updateSearch=function updateSearch(){if(!this.innerFocus)return;var range=this.innerFocus.range;var editor=this.editor;var value=this.textbox.value.slice(range[0],range[1]);editor.setSearchValue(value);this.resetScroll();this.forceUpdate();};_proto3.getSelectionTypeRange=function getSelectionTypeRange(){var selection=this.selection;if(!(selection!=null&&selection.lineRange))return null;var _selection$lineRange=selection.lineRange,start=_selection$lineRange[0],end=_selection$lineRange[1];var lcLine=this.textbox.value.slice(start,end).toLowerCase();if(lcLine.endsWith('  ')){end-=2;lcLine=lcLine.slice(0,-2);}switch(selection.type){case'pokemon':{if(lcLine.endsWith(' ')){lcLine=lcLine.slice(0,-1);end--;}if(lcLine.endsWith(' (m)')||lcLine.endsWith(' (f)')){lcLine=lcLine.slice(0,-4);end-=4;}if(lcLine.endsWith(')')){var parenIndex=lcLine.lastIndexOf(' (');if(parenIndex>=0){start=start+parenIndex+2;end--;}}return[start,end];}case'item':{if(lcLine.startsWith(' '))start++;return[start,end];}case'ability':{if(lcLine.startsWith('[')){start++;if(lcLine.endsWith(' ')){end--;lcLine=lcLine.slice(0,-1);}if(lcLine.endsWith(']')){end--;}return[start,end];}if(!lcLine.startsWith('ability:'))return null;start+=lcLine.startsWith('ability: ')?9:8;return[start,end];}case'move':{if(!lcLine.startsWith('-'))return null;start+=lcLine.startsWith('- ')?2:1;return[start,end];}}return[start,end];};_proto3.changeSet=function changeSet(type,name,moveSlot){var focus=this.innerFocus;if(!focus)return;if(type===focus.type&&type!=='pokemon'){this.replace(name,focus.range[0],focus.range[1]);this.updateText(false,true);return;}switch(type){case'pokemon':{var _this$editor$sets,_focus$setIndex;var set=(_this$editor$sets=this.editor.sets)[_focus$setIndex=focus.setIndex]||(_this$editor$sets[_focus$setIndex]={species:'',moves:[]});this.editor.changeSpecies(set,name);this.replaceSet(focus.setIndex);this.updateText(false,true);break;}case'ability':{this.editor.sets[focus.setIndex].ability=name;this.replaceSet(focus.setIndex);this.updateText(false,true);break;}}};_proto3.getSetRange=function getSetRange(index){if(!this.setInfo[index]){var _this$innerFocus;if(((_this$innerFocus=this.innerFocus)==null?void 0:_this$innerFocus.setIndex)===index){return this.innerFocus.range;}return[this.textbox.value.length,this.textbox.value.length];}var start=this.setInfo[index].index;var end=this.setInfo[index+1].index;return[start,end];};_proto3.replaceSet=function replaceSet(index){var editor=this.editor;var team=editor.team;if(!team)return;var newText=Teams.exportSet(editor.sets[index],editor.dex);var _this$getSetRange=this.getSetRange(index),start=_this$getSetRange[0],end=_this$getSetRange[1];if(start&&start===this.textbox.value.length&&!this.textbox.value.endsWith('\n\n')){newText=(this.textbox.value.endsWith('\n')?'\n':'\n\n')+newText;}this.replaceNoFocus(newText,start,end,start+newText.length);if(!this.setInfo[index]){this.updateText();this.save();}else{if(this.setInfo[index+1]){this.setInfo[index+1].index=start+newText.length;}this.setDirty=true;}};_proto3.replace=function replace(text,start,end){var selectionStart=arguments.length>3&&arguments[3]!==undefined?arguments[3]:start;var selectionEnd=arguments.length>4&&arguments[4]!==undefined?arguments[4]:start+text.length;var textbox=this.textbox;PSView.politeFocus(textbox);textbox.setSelectionRange(start,end);document.execCommand('insertText',false,text);this.save();};_proto3.replaceNoFocus=function replaceNoFocus(text,start,end){var selectionStart=arguments.length>3&&arguments[3]!==undefined?arguments[3]:start;var selectionEnd=arguments.length>4&&arguments[4]!==undefined?arguments[4]:start+text.length;var textbox=this.textbox;var value=textbox.value;textbox.value=value.slice(0,start)+text+value.slice(end);textbox.setSelectionRange(selectionStart,selectionEnd);this.save();};_proto3.save=function save(){var _this$props$onChange,_this$props2;this.editor["import"](this.textbox.value);(_this$props$onChange=(_this$props2=this.props).onChange)==null||_this$props$onChange.call(_this$props2);};_proto3.componentDidMount=function componentDidMount(){var _this7=this;this.textbox=this.base.getElementsByClassName('teamtextbox')[0];this.heightTester=this.base.getElementsByClassName('heighttester')[0];this.editor=this.props.editor;var exportedTeam=this.editor["export"](true);this.textbox.value=exportedTeam;this.updateText();setTimeout(function(){return _this7.updateText();});};_proto3.componentWillUnmount=function componentWillUnmount(){this.textbox=null;this.heightTester=null;};_proto3.resetScroll=function resetScroll(){var searchResults=this.base.querySelector('.searchresults');if(searchResults)searchResults.scrollTop=0;};_proto3.renderDetails=function renderDetails(set,i){var editor=this.editor;var species=editor.dex.species.get(set.species);var genderID=set.gender||species.gender||'N';var gender=genderID==='N'?"\u2014":editor.dex.text.genderName(genderID);return preact.h("button",{"class":"textbox setdetails",name:"details",value:i,onClick:this.clickDetails},preact.h("span",{"class":"detailcell"},preact.h("label",null,TL(["Level"])),set.level||editor.defaultLevel),preact.h("span",{"class":"detailcell"},preact.h("label",null,TL(["Shiny"])),set.shiny?'Yes':"\u2014"),editor.gen===9&&!editor.isChampions?preact.h("span",{"class":"detailcell"},preact.h("label",null,TL(["Tera"])),preact.h(PSIcon,{type:set.teraType||species.requiredTeraType||species.types[0]})):editor.hpTypeMatters(set)?preact.h("span",{"class":"detailcell"},preact.h("label",null,TL(["H. Power"])),preact.h(PSIcon,{type:editor.getHPType(set)})):preact.h("span",{"class":"detailcell"},preact.h("label",null,TL(["Gender"])),gender));};_proto3.renderStats=function renderStats(set,i){var editor=this.editor;return preact.h("button",{"class":"textbox setstats",name:"stats",value:i,onClick:this.clickDetails},StatForm.renderStatGraph(set,editor));};_proto3.bottomY=function bottomY(){var _this$setInfo$bottomY,_this$setInfo;return(_this$setInfo$bottomY=(_this$setInfo=this.setInfo[this.setInfo.length-1])==null?void 0:_this$setInfo.bottomY)!=null?_this$setInfo$bottomY:8;};_proto3.
render=function render(){var _this$setInfo$this$in,_this$setInfo$this$in2,_this8=this,_this$innerFocus2;
var editor=this.props.editor;
var statsDetailsOffset=editor.gen>=3?18:-1;
var resultsCSS=this.innerFocus&&"top:"+(
((_this$setInfo$this$in=(_this$setInfo$this$in2=this.setInfo[this.innerFocus.setIndex])==null?void 0:_this$setInfo$this$in2.bottomY)!=null?_this$setInfo$this$in:this.bottomY()+50)-12)+"px";

return preact.h("div",{"class":"team-pad"},
preact.h("p",null,
preact.h("button",{"class":"button "+(this.state.copyButtonUsed?'cur':''),onClick:this.copyAll},
this.state.copyButtonUsed?
preact.h(preact.Fragment,null,preact.h("i",{"class":"fa fa-check","aria-hidden":true})," ",TL(["Copied!"])):

preact.h(preact.Fragment,null,preact.h("i",{"class":"fa fa-copy","aria-hidden":true})," ",TL(["[Copy]"]))

)
),
preact.h("div",{"class":"teameditor-text"},
preact.h("textarea",{
"class":"textbox teamtextbox",style:"padding-left:"+(editor.narrow?'50px':'100px'),
onInput:this.input,onContextMenu:this.contextMenu,onKeyUp:this.keyUp,onKeyDown:this.keyDown,
onClick:this.keyUp,onChange:this.maybeReplaceLine,
placeholder:" Paste exported teams, pokepaste URLs, or JSON here",readOnly:editor.readonly}
),
preact.h("textarea",{
"class":"textbox teamtextbox heighttester",tabIndex:-1,"aria-hidden":true,
style:"padding-left:"+(editor.narrow?'50px':'100px')+";visibility:hidden;left:-15px"}
),
preact.h("div",{"class":"teamoverlays"},
this.setInfo.slice(0,-1).map(function(info){return(
preact.h("hr",{style:"top:"+(info.bottomY-18)+"px;pointer-events:none"}));}
),
editor.canAdd()&&!!this.setInfo.length&&preact.h("hr",{style:"top:"+(this.bottomY()-18)+"px"}),
this.setInfo.map(function(info,i){
if(!info.species)return null;
var set=editor.sets[i];
if(!set)return null;
var prevOffset=i===0?8:_this8.setInfo[i-1].bottomY;
var species=editor.dex.species.get(info.species);
var num=Dex.getPokemonIconNum(species.id);
if(!num)return null;

if(editor.narrow){
return preact.h("div",{style:"top:"+(prevOffset+1)+"px;left:5px;position:absolute;text-align:center;pointer-events:none"},
preact.h("div",null,preact.h(PSIcon,{pokemon:species.id})),
species.types.map(function(type){return preact.h("div",null,preact.h(PSIcon,{type:type}));}),
preact.h("div",null,preact.h(PSIcon,{item:set.item||null}))
);
}
var spriteData=Dex.getTeambuilderSpriteData(set,editor.dex);
return[preact.h("div",{
"class":spriteData.pixelated?'pixelated':'',
style:
"top:"+(prevOffset-7)+"px;left:0;position:absolute;text-align:right;"+"width:94px;padding:103px 5px 0 0;min-height:24px;pointer-events:none;"+

Dex.getTeambuilderSprite(set,editor.dex)},


preact.h("div",null,species.types.map(function(type){return preact.h(PSIcon,{type:type});}),preact.h(PSIcon,{item:set.item||null}))
),preact.h("div",{style:"top:"+(prevOffset+statsDetailsOffset)+"px;right:9px;position:absolute"},
_this8.renderStats(set,i)
),preact.h("div",{style:"top:"+(prevOffset+statsDetailsOffset)+"px;right:145px;position:absolute"},
_this8.renderDetails(set,i)
)];
}),
editor.canAdd()&&!(this.innerFocus&&this.innerFocus.setIndex>=this.setInfo.length)&&
preact.h("div",{style:"top:"+(this.bottomY()-3)+"px;left:"+(editor.narrow?55:105)+"px;position:absolute"},
preact.h("button",{"class":"button",onClick:this.addPokemon},
preact.h("i",{"class":"fa fa-plus","aria-hidden":true})," ",TL(["[Add Pok\xE9mon]"])
)
),

((_this$innerFocus2=this.innerFocus)==null?void 0:_this$innerFocus2.offsetY)!=null&&
preact.h("div",{
"class":"teaminnertextbox teaminnertextbox-"+this.innerFocus.type,
style:"top:"+(this.innerFocus.offsetY-21)+"px;left:"+(editor.narrow?46:96)+"px;"}
)

),
this.innerFocus&&(
this.innerFocus.type==='stats'?
preact.h("div",{"class":"searchresults",style:resultsCSS},
preact.h("button",{"class":"button closesearch",onClick:this.closeMenu},
!editor.narrow&&preact.h("kbd",null,"Esc")," ",preact.h("i",{"class":"fa fa-times","aria-hidden":true})," ",TL(["[Close]"])
),
preact.h(StatForm,{editor:editor,set:this.editor.sets[this.innerFocus.setIndex],onChange:this.handleSetChange})
):
this.innerFocus.type==='details'?
preact.h("div",{"class":"searchresults",style:resultsCSS},
preact.h("button",{"class":"button closesearch",onClick:this.closeMenu},
!editor.narrow&&preact.h("kbd",null,"Esc")," ",preact.h("i",{"class":"fa fa-times","aria-hidden":true})," ",TL(["[Close]"])
),
preact.h(DetailsForm,{editor:editor,set:this.editor.sets[this.innerFocus.setIndex],onChange:this.handleSetChange})
):

preact.h(PSSearchResults,{
"class":"searchresults",style:resultsCSS,
prepend:preact.h("button",{"class":"button closesearch",onClick:this.closeMenu},
!editor.narrow&&preact.h("kbd",null,"Esc")," ",preact.h("i",{"class":"fa fa-times","aria-hidden":true})," ",TL(["[Close]"])
),
search:editor.search,
onSelect:this.selectResult}
))


)
);
};return TeamTextbox;}(preact.Component);TeamTextbox.EMPTY_PROMISE=Promise.resolve(null);var


TeamEditorForm=function(_preact$Component3){function TeamEditorForm(){var _this9;for(var _len3=arguments.length,args=new Array(_len3),_key5=0;_key5<_len3;_key5++){args[_key5]=arguments[_key5];}_this9=_preact$Component3.call.apply(_preact$Component3,[this].concat(args))||this;_this9.


focusAnimationStartLocation=

null;_this9.
pendingSetScrollRestore=null;_this9.

pendingFocus=null;_this9.
pendingFocusValue=null;_this9.
pendingFocusSelection=null;_this9.

pendingFocusButton=false;_this9.
pendingFocusPolite=true;_this9.
mouseDownTextbox=null;_this9.




























setFocus=function(ev){
var editor=_this9.props.editor;
if(editor.readonly)return;
var target=ev.currentTarget;
if(!target.value||editor.stringifyFocus(editor.innerFocus)===target.value){
_this9.closeInnerFocus(ev);
return;
}
var focus=editor.parseFocus(target.value);
_this9.startFocusAnimation(target);
_this9.changeFocus(focus);
};_this9.
deleteSet=function(ev){
var target=ev.currentTarget;
var i=parseInt(target.value);
var editor=_this9.props.editor;
editor.deleteSet(i);
if(editor.innerFocus){
_this9.changeFocus({
setIndex:editor.sets.length,
type:'pokemon',
typeIndex:-1
});
}
_this9.handleSetChange();
ev.preventDefault();
};_this9.

































copySet=function(ev){var _window$PS6;
var target=ev.currentTarget;
var i=parseInt(target.value);
var editor=_this9.props.editor;
_this9.preserveSetScroll(i,target.closest('.set-form'));
editor.copySet(i);
editor.innerFocus=null;
_this9.props.onUpdate();
(_window$PS6=window.PS)==null||_window$PS6.update();
ev.preventDefault();
};_this9.
undeleteSet=function(ev){var _editor$deletedSet;
var editor=_this9.props.editor;
var setIndex=(_editor$deletedSet=editor.deletedSet)==null?void 0:_editor$deletedSet.index;
editor.undeleteSet();
if(editor.innerFocus&&setIndex!==undefined){
_this9.changeFocus({
setIndex:setIndex,
type:'pokemon',
typeIndex:-1
});
}
_this9.handleSetChange();
ev.preventDefault();
};_this9.
pasteSet=function(ev){var _window$PS7;
var target=ev.currentTarget;
var i=parseInt(target.value);
var editor=_this9.props.editor;
var insertIndex=editor.pasteSet(i);
_this9.preserveSetScroll(insertIndex,target);
_this9.handleSetChange();
(_window$PS7=window.PS)==null||_window$PS7.update();
ev.preventDefault();
};_this9.
moveSet=function(ev){
var target=ev.currentTarget;
var i=parseInt(target.value);
var editor=_this9.props.editor;
var insertIndex=editor.pasteSet(i,true);
_this9.preserveSetScroll(insertIndex,target);
_this9.handleSetChange();
ev.preventDefault();
};_this9.
handleSetChange=function(){
_this9.props.editor.save();
_this9.props.onChange==null||_this9.props.onChange();
_this9.forceUpdate();
};_this9.











































handleLoadSampleSet=function(setName){
var editor=_this9.props.editor;
if(!editor.innerFocus||!editor.loadSampleSet(editor.innerFocus.setIndex,setName))return;
_this9.props.onUpdate==null||_this9.props.onUpdate();
_this9.forceUpdate();
};_this9.
handleLoadUserSet=function(setName){
var editor=_this9.props.editor;
if(!editor.innerFocus||!editor.loadUserSet(editor.innerFocus.setIndex,setName))return;
_this9.props.onUpdate==null||_this9.props.onUpdate();
_this9.forceUpdate();
};_this9.
updateSearch=function(ev){
var searchBox=ev.currentTarget;
_this9.props.editor.setSearchValue(searchBox.value);
_this9.resetScroll();
_this9.forceUpdate();
};_this9.
handleClickFilters=function(ev){
var search=_this9.props.editor.search;
var target=ev.target;
while(target&&target.className!=='dexlist'){
if(target.tagName==='BUTTON'){
var filter=target.getAttribute('data-filter');
if(filter){
search.removeFilter(filter.split(':'));
var searchBox=_this9.base.querySelector('input[name=value]');
search.find((searchBox==null?void 0:searchBox.value)||'');
if(!TeamEditor.probablyMobile())searchBox==null||searchBox.select();
_this9.forceUpdate();
ev.preventDefault();
ev.stopPropagation();
break;
}
}

target=target.parentElement;
}
};_this9.


































































































































setFocusTextbox=function(ev){
var target=ev.currentTarget;
if(_this9.mouseDownTextbox===target)return;
_this9.openFocusTextbox(target);
};_this9.
mouseDownField=function(ev){
if(ev.button!==0)return;
var target=ev.currentTarget;
if(document.activeElement===target)return;
_this9.mouseDownTextbox=target;
document.addEventListener('mouseup',_this9.mouseUpField,{once:true});
PSView.politeFocus(target);
target.select();
ev.preventDefault();
};_this9.
mouseUpField=function(ev){
var target=_this9.mouseDownTextbox;
_this9.mouseDownTextbox=null;
if(!target||ev.target!==target)return;
_this9.openFocusTextbox(target);
};_this9.


















































































































































inputField=function(ev){var _focus,_focus2;
var target=ev.currentTarget;
target.classList.remove('incomplete');
var type=target.name;
if(type==='nickname'){
_this9.commitField(target);
return;
}
var focus=_this9.props.editor.innerFocus;
if(!focus){
_this9.openFocusTextbox(target);
focus=_this9.pendingFocus;
}
if(((_focus=focus)==null?void 0:_focus.type)==='move'&&focus.typeIndex>=0&&!target.value){

_this9.props.editor.search.prependResults=[['move',"_"+(focus.typeIndex+1)+"_"]];
_this9.props.editor.search.results=null;
}else if(((_focus2=focus)==null?void 0:_focus2.type)==='item'&&!target.value){

_this9.props.editor.search.prependResults=[['item','']];
_this9.props.editor.search.results=null;
}
_this9.props.editor.setSearchValue(target.value);
_this9.resetScroll();
_this9.forceUpdate();
};_this9.
blurField=function(ev){
_this9.commitField(ev.currentTarget);
};_this9.





































































































































keyDownField=function(ev){
if(!_this9.props.editor.innerFocus&&ev.keyCode===9){
var target=ev.currentTarget;
var focus=_this9.props.editor.parseFocus(target.getAttribute('data-focus'));
if(!_this9.commitField(target)){
ev.preventDefault();
return;
}
if(_this9.focusAdjacentField(focus,ev.shiftKey)){
ev.preventDefault();
}
return;
}
_this9.keyDownSearchInput(ev,false);
};_this9.
keyDownNickname=function(ev){
if(ev.keyCode!==9)return;
var target=ev.currentTarget;
_this9.commitField(target);
var focus=_this9.props.editor.parseFocus(target.getAttribute('data-focus'));
if(_this9.focusAdjacentField(focus,ev.shiftKey)){
ev.preventDefault();
}
};_this9.
keyDownSearch=function(ev){
_this9.keyDownSearchInput(ev,true);
};_this9.
clickPanelButton=function(ev){
var editor=_this9.props.editor;
if(editor.readonly)return;
var target=ev.currentTarget;
var focus=editor.parseFocus(target.value);
if(editor.stringifyFocus(editor.innerFocus)===target.value){
_this9.pendingFocus=focus;
_this9.pendingFocusButton=PSView.hasTapped;
_this9.forceUpdate();
return;
}
_this9.startFocusAnimation(target);
_this9.changeFocus(focus,PSView.hasTapped);
};_this9.
keyDownPanelButton=function(ev){
if(ev.keyCode!==9)return;
var target=ev.currentTarget;
var focus=_this9.props.editor.parseFocus(target.value);
if(!focus)return;
_this9.focusAdjacentField(focus,ev.shiftKey);
ev.preventDefault();
};_this9.
closeInnerFocus=function(ev){var _querySelector$getBou,_querySelector,_document$activeEleme;
var focus=_this9.props.editor.innerFocus;
if(!focus)return;
var expectedTop=(_querySelector$getBou=(_querySelector=_this9.base.querySelector(
'.team-focus-editor .set-form'
))==null?void 0:_querySelector.getBoundingClientRect().top)!=null?_querySelector$getBou:null;
var restoreNickname=((_document$activeEleme=document.activeElement)==null?void 0:_document$activeEleme.getAttribute('name'))==='nickname';
_this9.props.editor.innerFocus=null;
_this9.pendingFocus=null;
_this9.forceUpdate(function(){
var target=_this9.getOuterFocusTarget(focus,restoreNickname);
var setButton=_this9.getOuterSetButton(focus);
if(target&&(target.name==='nickname'||!target.classList.contains('set-field'))){
PSView.politeFocus(target);
target.select==null||target.select();
}
_this9.restoreOuterSetScroll(setButton||target||null,expectedTop);
});
_this9.props.onUpdate();
ev==null||ev.stopImmediatePropagation();
ev==null||ev.preventDefault();
};_this9.
handleKeyDown=function(ev){
if(ev.keyCode!==27)return;
_this9.closeInnerFocus(ev);
return false;
};_this9.






















































































selectResult=function(type,name,slot,reverse){var _this9$props$editor$i;
if(type===null){
_this9.resetScroll();
_this9.forceUpdate();
}else if(!type){
_this9.focusFocusedSetField();
var searchBox=_this9.base.querySelector('input[name=value]');
if(searchBox){
searchBox.value='';
searchBox.focus();
}
_this9.props.editor.setSearchValue('');
_this9.resetScroll();
_this9.forceUpdate();
}else if(type==='move'&&((_this9$props$editor$i=_this9.props.editor.innerFocus)==null?void 0:_this9$props$editor$i.typeIndex)===-1){
_this9.setMoveResult(name,slot,reverse);
}else{
_this9.setFocusedValue(name);
}
};return _this9;}_inheritsLoose(TeamEditorForm,_preact$Component3);var _proto4=TeamEditorForm.prototype;_proto4.startFocusAnimation=function startFocusAnimation(source){if(this.props.editor.innerFocus)return;var setButton=source==null?void 0:source.closest('.set-form');if(!setButton)return;var rect=setButton.getBoundingClientRect();this.focusAnimationStartLocation={rect:{left:rect.left,top:rect.top}};};_proto4.finishFocusAnimation=function finishFocusAnimation(){var _window$PS8;var start=this.focusAnimationStartLocation;if(!start)return;this.focusAnimationStartLocation=null;if((_window$PS8=window.PS)!=null&&_window$PS8.prefs.noanim||PSView.prefersReducedMotion())return;var setButton=this.base.querySelector('.team-focus-editor .set-form');if(!setButton)return;var rect=setButton.getBoundingClientRect();var dx=start.rect.left-rect.left;var dy=start.rect.top-rect.top;if(!dx&&!dy)return;setButton.animate==null||setButton.animate([{transform:"translate("+dx+"px, "+dy+"px)"},{transform:'translate(0, 0)'}],{duration:250,easing:'cubic-bezier(.2, 0, .2, 1)'});};_proto4.preserveSetScroll=function preserveSetScroll(index,elem){if(index===undefined||elem===null)return;this.pendingSetScrollRestore={index:index,top:elem.getBoundingClientRect().top};};_proto4.restorePendingSetScroll=function restorePendingSetScroll(){if(!this.base)return;var restore=this.pendingSetScrollRestore;if(!restore)return;this.pendingSetScrollRestore=null;var setButton=this.base.querySelector(".set-form[data-set-index=\""+restore.index+"\"]");if(!setButton)return;var dy=setButton.getBoundingClientRect().top-restore.top;if(!dy)return;var scrollParent=this.getSetScrollParent(setButton);if(scrollParent){scrollParent.scrollTop+=dy;}else{window.scrollBy(0,dy);}};_proto4.getSetScrollParent=function getSetScrollParent(elem){for(var parent=elem.parentElement;parent;parent=parent.parentElement){var style=getComputedStyle(parent);if(!/(auto|scroll)/.test(style.overflowY))continue;if(parent.scrollHeight<=parent.clientHeight)continue;return parent;}return null;};_proto4.selectMoveResult=function selectMoveResult(name,slot,reverse){var _editor$sets;var editor=this.props.editor;var setIndex=editor.innerFocus.setIndex;var set=(_editor$sets=editor.sets)[setIndex]||(_editor$sets[setIndex]={species:'',moves:[]});if(slot){var i=parseInt(slot)-1;if(set.moves[i]){set.moves[i]='';if(i===set.moves.length-1){while(set.moves.length>4&&!set.moves[set.moves.length-1]){set.moves.pop();}}if(set.moves.length>4&&i<set.moves.length-1){set.moves[i]=set.moves.pop();}}}else if(set.moves.includes(name)){set.moves.splice(set.moves.indexOf(name),1);}else{for(var _i40=0;_i40<set.moves.length+1;_i40++){if(!set.moves[_i40]){set.moves[_i40]=name;break;}}}if(reverse){this.changeFocus({setIndex:setIndex,type:'item',typeIndex:-1});}else{if(editor.search.query){this.resetScroll();}editor.updateSearchMoves(set);}};_proto4.resetScroll=function resetScroll(){var searchResults=this.base.querySelector('.set-searchresults');if(searchResults)searchResults.scrollTop=0;};_proto4.renderInnerFocus=function renderInnerFocus(){var _this10=this;var editor=this.props.editor;if(!editor.innerFocus)return null;var _editor$innerFocus=editor.innerFocus,type=_editor$innerFocus.type,setIndex=_editor$innerFocus.setIndex;var set=this.props.editor.sets[setIndex];var cur=function(i){return setIndex===i?' cur':'';};var isSearchMode=type!=='stats'&&type!=='details'&&type!=='import';var SEARCH_PLACEHOLDERS={'pokemon':TL(["Search species or filter by type, learnable moves, ability, tier, or egg group"]),'ability':TL(["Search abilities"]),'item':TL(["Search items"]),'move':TL(["Search moves or filter by type or category"])};return preact.h("div",{"class":"team-focus-editor",onKeyDown:editor.handleParentKeyDown},preact.h("div",{"class":isSearchMode&&((set==null?void 0:set.moves.length)||0)>5?'team-focus-top':''},preact.h("ul",{"class":"tabbar"},preact.h("li",{"class":"home-li"},preact.h("button",{"class":"button",onClick:this.closeInnerFocus},preact.h("i",{"class":"fa fa-chevron-left","aria-hidden":true})," ",TL(["[Back]"]))),editor.sets.map(function(curSet,i){return preact.h("li",null,preact.h("button",{"class":"button picontab"+cur(i),onClick:_this10.setFocus,value:"set-"+i+"-"+type},preact.h(PSIcon,{pokemon:curSet}),preact.h("br",null),editor.getNickname(curSet)));}),editor.canAdd()&&preact.h("li",null,preact.h("button",{"class":"button picontab"+cur(editor.sets.length),name:"addpokemon",onClick:this.setFocus,value:"set-"+editor.sets.length+"-pokemon","aria-label":TL(["[Add Pok\xE9mon]"])},preact.h("i",{"class":"fa fa-plus"})))),preact.h("div",{"class":"team-pad",style:"padding-top:0"},this.renderSet(set,setIndex)),isSearchMode&&preact.h("div",{"class":"searchboxwrapper pad",onClick:this.handleClickFilters},preact.h("input",{type:"search",name:"value","class":"textbox",placeholder:SEARCH_PLACEHOLDERS[type]||'',onInput:this.updateSearch,onKeyDown:this.keyDownSearch,autocomplete:"off"}),PSSearchResults.renderFilters(editor.search))),type==='stats'?preact.h(StatForm,{editor:editor,set:set,onChange:this.handleSetChange}):type==='details'?preact.h(DetailsForm,{editor:editor,set:set,onChange:this.handleSetChange}):type==='import'?preact.h(SetImportForm,{editor:editor,set:set,setIndex:setIndex,onChange:this.handleSetChange}):preact.h(PSSearchResults,{"class":"set-searchresults",search:editor.search,hideFilters:true,onSelect:this.selectResult},type==='ability'&&preact.h(SetSourceButtons,{editor:editor,set:set,onLoadSampleSet:this.handleLoadSampleSet,onLoadUserSet:this.handleLoadUserSet})));};_proto4.render=function render(){var _this11=this;var editor=this.props.editor;if(editor.innerFocus)return this.renderInnerFocus();if(editor.fetching){return preact.h("div",{"class":"teameditor"},TL(["Fetching Paste..."]));}var clipboard=TeamEditorState.clipboard;var willNotMove=function(i){var _clipboard$teams$edit,_clipboard$teams$edit2,_clipboard$teams$edit3;return(clipboard==null?void 0:clipboard.teams)&&!clipboard.otherSets&&clipboard.teams[editor.team.key]&&Object.keys((_clipboard$teams$edit=clipboard.teams[editor.team.key])==null?void 0:_clipboard$teams$edit.sets).length===1&&!!((_clipboard$teams$edit2=clipboard.teams[editor.team.key])!=null&&_clipboard$teams$edit2.sets[i]||(_clipboard$teams$edit3=clipboard.teams[editor.team.key])!=null&&_clipboard$teams$edit3.sets[i-1]);};var pasteControls=function(i){var _editor$deletedSet2;return editor.readonly?null:clipboard?preact.h("p",null,preact.h("button",{"class":"button notifying",onClick:_this11.pasteSet,value:i},preact.h("i",{"class":"fa fa-clipboard","aria-hidden":true})," ",TL(["[Paste copy here]"]))," ",!willNotMove(i)&&preact.h("button",{"class":"button notifying",onClick:_this11.moveSet,value:i,disabled:clipboard.readonly},preact.h("i",{"class":"fa fa-arrow-right","aria-hidden":true})," ",TL(["[Move here]"]))):((_editor$deletedSet2=editor.deletedSet)==null?void 0:_editor$deletedSet2.index)===i?preact.h("p",{style:"text-align:right"},preact.h("button",{"class":"button",onClick:_this11.undeleteSet},preact.h("i",{"class":"fa fa-undo","aria-hidden":true})," ",TL(["[Undo delete]"]))):null;};return preact.h("div",{"class":"set-list team-pad"+(editor.readonly?' readonly':'')},editor.sets.map(function(set,i){return[pasteControls(i),_this11.renderSet(set,i)];}),pasteControls(editor.sets.length),editor.canAdd()&&preact.h("p",null,preact.h("button",{"class":"button big",name:"addpokemon",onClick:this.setFocus,value:"set-"+editor.sets.length+"-pokemon"},preact.h("i",{"class":"fa fa-plus","aria-hidden":true})," ",TL(["[Add Pok\xE9mon]"]))));};_proto4.openFocusTextbox=function openFocusTextbox(target){var editor=this.props.editor;if(editor.readonly)return;var focus=editor.parseFocus(target.getAttribute('data-focus'));if(!focus)return;if(this.pendingFocus)return;this.pendingFocusValue=target.value;this.pendingFocusSelection=[target.selectionStart,target.selectionEnd,target.selectionDirection||undefined];target.classList.remove('incomplete');this.startFocusAnimation(target);var refocusing=editor.stringifyFocus(editor.innerFocus)===editor.stringifyFocus(focus);this.changeFocus(focus,false,true,refocusing);};_proto4.changeFocus=function changeFocus(focus){var focusButton=arguments.length>1&&arguments[1]!==undefined?arguments[1]:false;var polite=arguments.length>2&&arguments[2]!==undefined?arguments[2]:true;var preserveSearch=arguments.length>3&&arguments[3]!==undefined?arguments[3]:false;var editor=this.props.editor;editor.innerFocus=focus;this.pendingFocus=focus;this.pendingFocusButton=focusButton;this.pendingFocusPolite=polite;if(!focus){this.props.onUpdate();return;}var set=editor.sets[focus.setIndex];if(!preserveSearch&&focus.type!=='details'&&focus.type!=='stats'&&focus.type!=='import'){var _set$moves7;var _value3='';if(focus.type==='pokemon')_value3=(set==null?void 0:set.species)||'';else if(focus.type==='item')_value3=(set==null?void 0:set.item)||'';else if(focus.type==='ability')_value3=(set==null?void 0:set.ability)||'';else if(focus.type==='move'&&focus.typeIndex>=0)_value3=(set==null||(_set$moves7=set.moves)==null?void 0:_set$moves7[focus.typeIndex])||'';editor.setSearchType(focus.type,focus.setIndex,_value3,focus.typeIndex);this.resetScroll();}this.props.onUpdate();};_proto4.componentDidMount=function componentDidMount(){this.props.editor.handleParentKeyDown=this.handleKeyDown;};_proto4.componentWillUnmount=function componentWillUnmount(){this.props.editor.handleParentKeyDown=undefined;};_proto4.componentDidUpdate=function componentDidUpdate(){this.finishFocusAnimation();var editor=this.props.editor;var focus=this.pendingFocus;if(focus){var focusValue=editor.stringifyFocus(focus);var input=this.base.querySelector((focus.type==='details'||focus.type==='stats'||focus.type==='import')&&this.pendingFocusButton?"button[name=\""+focus.type+"\"][value=\""+focusValue+"\"]":focus.type==='details'?"div.set-details-form input:not([name=nickname]), div.set-details-form select":focus.type==='stats'?"div.set-stats-form input":focus.type==='import'?"div.set-import-form textarea":focus.type==='move'&&focus.typeIndex===-1?"input[name=value]":"input.set-field[data-focus=\""+focusValue+"\"]");if(input){if(focus.type!=='details'&&focus.type!=='stats'&&focus.type!=='import'&&!(focus.type==='move'&&focus.typeIndex===-1)){var _this$pendingFocusVal;input.value=(_this$pendingFocusVal=this.pendingFocusValue)!=null?_this$pendingFocusVal:editor.getField(focus);input.classList.remove('incomplete');}PSView.politeFocus(input,this.pendingFocusPolite);if(this.pendingFocusSelection&&input instanceof HTMLInputElement){input.setSelectionRange==null||input.setSelectionRange.apply(input,this.pendingFocusSelection);}else{input.select==null||input.select();}this.pendingFocus=null;this.pendingFocusPolite=true;this.pendingFocusValue=null;this.pendingFocusSelection=null;}}var activeElement=document.activeElement;for(var _i42=0,_querySelectorAll2=this.base.querySelectorAll('input.set-field');_i42<_querySelectorAll2.length;_i42++){var _input=_querySelectorAll2[_i42];if(_input===activeElement)continue;var curFocus=editor.parseFocus(_input.getAttribute('data-focus'));_input.value=editor.getField(curFocus);}var searchBox=this.base.querySelector('input[name=value]');var filters=this.base.querySelector('.dexlist-filters');if(searchBox){if(filters){var _filters$getBoundingC=filters.getBoundingClientRect(),width=_filters$getBoundingC.width;searchBox.style.paddingLeft=width+5+"px";}else{searchBox.style.paddingLeft="3px";}}this.restorePendingSetScroll();};_proto4.commitField=function commitField(target,selectNext,reverse){var _this$props$onChange3,_this$props4;var editor=this.props.editor;var focus=editor.parseFocus(target.getAttribute('data-focus'));if(!focus)return true;if(focus.type==='nickname'){var _this$props$onChange2,_this$props3;var set=editor.sets[focus.setIndex];if(!set)return true;var name=target.value.trim();if(name){set.name=name;}else{delete set.name;}editor.save();(_this$props$onChange2=(_this$props3=this.props).onChange)==null||_this$props$onChange2.call(_this$props3);this.forceUpdate();return true;}var canonical=editor.normalizeField(focus.type,target.value);if(canonical===null){target.classList.add('incomplete');canonical=target.value;}else{target.classList.remove('incomplete');}if(focus.type==='pokemon'){var _editor$sets2,_focus$setIndex2;if(!canonical)return true;var _set2=(_editor$sets2=editor.sets)[_focus$setIndex2=focus.setIndex]||(_editor$sets2[_focus$setIndex2]={species:'',moves:[]});editor.changeSpecies(_set2,canonical);target.value=_set2.species;}else{var _set3=editor.sets[focus.setIndex];if(!_set3)return true;switch(focus.type){case'item':if(canonical)_set3.item=canonical;else delete _set3.item;target.value=canonical;break;case'ability':if(canonical)_set3.ability=canonical;else delete _set3.ability;target.value=canonical;break;case'move':if(focus.typeIndex>=_set3.moves.length&&!canonical)return true;while(_set3.moves.length<=focus.typeIndex)_set3.moves.push('');_set3.moves[focus.typeIndex]=canonical;target.value=canonical;break;}}editor.save();(_this$props$onChange3=(_this$props4=this.props).onChange)==null||_this$props$onChange3.call(_this$props4);this.forceUpdate();if(selectNext)this.focusAdjacentField(focus,!!reverse);return true;};_proto4.getFocusedSetField=function getFocusedSetField(){var editor=this.props.editor;var focus=editor.innerFocus;if(!focus||focus.type==='details'||focus.type==='stats'||focus.type==='import'){return null;}if(focus.type==='move'&&focus.typeIndex===-1)return null;return this.base.querySelector("input.set-field[data-focus=\""+editor.stringifyFocus(focus)+"\"]");};_proto4.focusFocusedSetField=function focusFocusedSetField(){var input=this.getFocusedSetField();if(!input)return false;var focus=this.props.editor.parseFocus(input.getAttribute('data-focus'));if(!focus)return false;input.value=this.props.editor.getField(focus);input.classList.remove('incomplete');input.focus();input.select();return true;};_proto4.clearSearchFilters=function clearSearchFilters(){while(true){if(!this.props.editor.search.removeFilter())return;}};_proto4.keyDownSearchInput=function keyDownSearchInput(ev,inSearchBox){var editor=this.props.editor;var input=ev.currentTarget;switch(ev.keyCode){case 8:if(input.selectionStart===0&&input.selectionEnd===0){if(!editor.search.removeFilter()&&inSearchBox&&!input.value){if(this.focusFocusedSetField())ev.preventDefault();break;}editor.setSearchValue(input.value);this.resetScroll();this.forceUpdate();}break;case 27:if(inSearchBox){input.value='';this.clearSearchFilters();editor.setSearchValue('');this.resetScroll();if(!this.focusFocusedSetField())break;this.forceUpdate();ev.preventDefault();ev.stopImmediatePropagation();}break;case 38:editor.search.moveSelection(-1);ev.preventDefault();break;case 40:editor.search.moveSelection(1);ev.preventDefault();break;case 37:case 39:ev.stopImmediatePropagation();break;case 13:case 9:{if(ev.keyCode===9&&ev.shiftKey){this.commitField(input,true,true);this.tryDeleteEmptyMoveSlot(input);ev.preventDefault();return;}var result=editor.search.selectResult();var _value4=result&&editor.search.getResultName(result);if(_value4===''&&input.value){this.commitField(input,true);}else if(_value4!==null){var _editor$innerFocus2;var _value4$split=_value4.split('|'),name=_value4$split[0],moveSlot=_value4$split[1];if(((_editor$innerFocus2=editor.innerFocus)==null?void 0:_editor$innerFocus2.type)==='move'&&editor.innerFocus.typeIndex===-1){this.setMoveResult(name,moveSlot);}else{this.setFocusedValue(name,ev.shiftKey);}this.tryDeleteEmptyMoveSlot(input);if(inSearchBox)input.value='';}else{if(inSearchBox){input.value='';}else{var focus=editor.parseFocus(input.getAttribute('data-focus'));if(focus)input.value=editor.getField(focus);input.classList.remove('incomplete');var searchBox=this.base.querySelector('input[name=value]');if(searchBox){searchBox.value='';searchBox.focus();}}editor.setSearchValue('');this.resetScroll();this.forceUpdate();}ev.preventDefault();break;}}};_proto4.tryDeleteEmptyMoveSlot=function tryDeleteEmptyMoveSlot(input){var _editor$sets$focus$se,_editor$innerFocus3;if(input.value)return false;var editor=this.props.editor;var focus=editor.parseFocus(input.getAttribute('data-focus'));if((focus==null?void 0:focus.type)!=='move'||focus.typeIndex<0)return false;var moves=(_editor$sets$focus$se=editor.sets[focus.setIndex])==null?void 0:_editor$sets$focus$se.moves;if(!moves)return false;if(moves[focus.typeIndex])return false;moves.splice(focus.typeIndex,1);if((editor==null||(_editor$innerFocus3=editor.innerFocus)==null?void 0:_editor$innerFocus3.type)==='move'&&editor.innerFocus.typeIndex>focus.typeIndex){editor.innerFocus.typeIndex--;}input.value=moves[focus.typeIndex]||'';this.forceUpdate();return true;};_proto4.restoreOuterSetScroll=function restoreOuterSetScroll(target,expectedTop){if(!target||expectedTop===null)return;var setButton=target.closest('.set-form')||target;var dy=setButton.getBoundingClientRect().top-expectedTop;if(!dy)return;var scrollParent=this.getScrollParent(setButton);if(scrollParent){scrollParent.scrollTop+=dy;}else{window.scrollBy(0,dy);}};_proto4.getScrollParent=function getScrollParent(elem){for(var parent=elem.parentElement;parent;parent=parent.parentElement){var style=getComputedStyle(parent);if(!/(auto|scroll)/.test(style.overflowY))continue;if(parent.scrollHeight<=parent.clientHeight)continue;return parent;}return null;};_proto4.getOuterFocusTarget=function getOuterFocusTarget(focus){var restoreNickname=arguments.length>1&&arguments[1]!==undefined?arguments[1]:false;if(restoreNickname){return this.base.querySelector("input[data-focus=\"set-"+focus.setIndex+"-nickname\"]");}if(focus.type==='details'||focus.type==='stats'||focus.type==='import'){return this.base.querySelector("button[name=\""+focus.type+"\"][value=\""+this.props.editor.stringifyFocus(focus)+"\"]");}if(focus.type==='move'&&focus.typeIndex===-1){return this.base.querySelector("button[value=\""+this.props.editor.stringifyFocus(focus)+"\"]");}};_proto4.getOuterSetButton=function getOuterSetButton(focus){if(focus.setIndex>=this.props.editor.sets.length)return null;return this.base.querySelectorAll('.teameditor > .set-form')[focus.setIndex]||null;};_proto4.removeDuplicateMove=function removeDuplicateMove(name){var _this$props$onChange4,_this$props5;var editor=this.props.editor;var focus=editor.innerFocus;if(!name)return false;if((focus==null?void 0:focus.type)!=='move')return false;var set=editor.sets[focus.setIndex];if(!set)return false;var moveIndex=set.moves.indexOf(name);if(moveIndex<0||moveIndex===focus.typeIndex)return false;set.moves.splice(moveIndex,1);var emptyIndex=0;while(emptyIndex<4&&set.moves[emptyIndex])emptyIndex++;if(emptyIndex>=4)emptyIndex=focus.typeIndex;this.changeFocus({setIndex:focus.setIndex,type:'move',typeIndex:emptyIndex});editor.save();(_this$props$onChange4=(_this$props5=this.props).onChange)==null||_this$props$onChange4.call(_this$props5);this.forceUpdate();return true;};_proto4.setFocusedValue=function setFocusedValue(name,reverse){var focus=this.props.editor.innerFocus;if(!focus)return;if(this.removeDuplicateMove(name))return;var input=this.base.querySelector("input.set-field[data-focus=\""+this.props.editor.stringifyFocus(focus)+"\"]");if(!input)return;input.value=name;this.commitField(input,true,reverse);};_proto4.setMoveResult=function setMoveResult(name,slot,reverse){var _this$props$onChange5,_this$props6;this.selectMoveResult(name,slot,reverse);this.props.editor.save();(_this$props$onChange5=(_this$props6=this.props).onChange)==null||_this$props$onChange5.call(_this$props6);this.forceUpdate();};_proto4.
focusAdjacentField=function focusAdjacentField(focus,reverse){
var set=this.props.editor.sets[focus.setIndex];
var curField=""+focus.type+(focus.typeIndex===-1?'':focus.typeIndex);
var fields=['pokemon'];
if(set){
if(this.props.editor.showAbility(set))fields.push('ability');
if(this.props.editor.showItem(set))fields.push('item');
for(var i=0;i<Math.max(4,set.moves.length);i++)fields.push("move"+i);
fields.push('stats');
fields.push('details');
fields.push('nickname');
}
var fieldIndex=fields.indexOf(curField);
if(fieldIndex<0)return false;

var next=fields[fieldIndex+(reverse?-1:1)];
if(!next&&reverse&&focus.type==='pokemon'){
var prevButton=this.base.querySelector(".team-focus-editor .set-form button[name=delete][value=\""+
focus.setIndex+"\"]"
)||this.base.querySelector(".team-focus-editor .tabbar button[name=addpokemon]"

)||this.base.querySelector(".teameditor > .set-form button[name=delete][value=\""+
focus.setIndex+"\"]"
)||this.base.querySelector(".teameditor button[name=addpokemon]"

);
prevButton==null||prevButton.focus();
return!!prevButton;
}
if(!next)return false;
if(next==='nickname'){
var input=this.base.querySelector("input[data-focus=\"set-"+
focus.setIndex+"-nickname\"]"
);
input==null||input.focus();
input==null||input.select();
return!!input;
}
var nextType=next.startsWith('move')?'move':next;
var nextTypeIndex=parseInt(next.slice(nextType.length)||'-1');
this.changeFocus({setIndex:focus.setIndex,type:nextType,typeIndex:nextTypeIndex},true,false);
return true;
};_proto4.
cur=function cur(type,setIndex){var typeIndex=arguments.length>2&&arguments[2]!==undefined?arguments[2]:-1;
var focus=this.props.editor.innerFocus;
return(
(focus==null?void 0:focus.type)===type&&focus.setIndex===setIndex&&focus.typeIndex===typeIndex)?
' cur':'';
};_proto4.
renderInput=function renderInput(
setIndex,type,value)

{var typeIndex=arguments.length>3&&arguments[3]!==undefined?arguments[3]:-1;var placeholder=arguments.length>4&&arguments[4]!==undefined?arguments[4]:'';
var editor=this.props.editor;
return preact.h("input",{
type:"text","class":"textbox default-placeholder set-field",name:type,
"data-focus":editor.stringifyFocus({setIndex:setIndex,type:type,typeIndex:typeIndex}),
defaultValue:value||'',placeholder:placeholder,autocomplete:"off",readOnly:editor.readonly,
onMouseDown:this.mouseDownField,onFocus:this.setFocusTextbox,
onInput:this.inputField,onKeyDown:this.keyDownField,
onBlur:this.blurField}
);
};_proto4.
renderNicknameInput=function renderNicknameInput(setIndex){
var editor=this.props.editor;
var set=editor.sets[setIndex];
var species=editor.dex.species.get(set.species);
var baseSpecies=editor.dex.text.get(species).baseSpecies;
return preact.h("input",{
type:"text","class":"textbox default-placeholder set-field",name:"nickname",
"data-focus":"set-"+setIndex+"-nickname",
defaultValue:set.name||'',placeholder:baseSpecies,readOnly:editor.readonly,
onInput:this.inputField,onChange:this.inputField,onKeyDown:this.keyDownNickname,autocomplete:"off"}
);
};_proto4.
renderSet=function renderSet(set,i){var _TeamEditorState$clip6,_this12=this;
var editor=this.props.editor;
var sprite=Dex.getTeambuilderSprite(set,editor.dex);
var spriteClass=set&&Dex.getTeambuilderSpriteData(set,editor.dex).pixelated?' pixelated':'';
if(!set){
return preact.h("div",{"class":"set-form","data-set-index":i},
preact.h("div",{style:"text-align:right"},
editor.deletedSet?
preact.h("button",{onClick:this.undeleteSet,"class":"option"},preact.h("i",{"class":"fa fa-undo","aria-hidden":true})," ",TL(["[Undo delete]"])):

preact.h("button",{"class":"option",style:"visibility:hidden"},preact.h("i",{"class":"fa fa-trash","aria-hidden":true})," ",TL(["[Delete]"])),
" ",
preact.h("button",{
"class":"option",name:"import",onClick:this.clickPanelButton,
value:"set-"+i+"-import"},

preact.h("i",{"class":"fa fa-upload","aria-hidden":true})," ",TL(["[Import]"])
)
),
preact.h("table",{"class":spriteClass,style:sprite},
preact.h("tr",null,
preact.h("td",{rowSpan:2,"class":"set-pokemon"},preact.h("div",{"class":"border-collapse"},
preact.h("span",{"class":"sprite-inner"},
preact.h("strong",{"class":"label"},TL(["Pok\xE9mon"]))," ",
this.renderInput(i,'pokemon','')
)
)),
preact.h("td",{colSpan:2,"class":"set-details"}),
preact.h("td",{rowSpan:2,"class":"set-moves"}),
preact.h("td",{rowSpan:2,"class":"set-stats"})
),
preact.h("tr",null,
preact.h("td",{"class":"set-ability"}),
preact.h("td",{"class":"set-item"})
)
)
);
}
while(set.moves.length<4)set.moves.push('');

var species=editor.dex.species.get(set.species);
var tintClass=" tint-"+species.types[0];
var isCur=(_TeamEditorState$clip6=TeamEditorState.clipboard)!=null&&(_TeamEditorState$clip6=_TeamEditorState$clip6.teams)!=null&&(_TeamEditorState$clip6=_TeamEditorState$clip6[editor.team.key])!=null&&_TeamEditorState$clip6.sets[i]?' cur':'';
var overfull=set.moves.length>5?' overfull':set.moves.length>4?' overfull overfull5':'';
return preact.h("div",{"class":"set-form"+isCur,"data-set-index":i},
preact.h("div",{style:"text-align:right"},
preact.h("button",{"class":"option",onClick:this.copySet,value:i},
preact.h("i",{"class":"fa fa-copy","aria-hidden":true})," ",
isCur?TL(["[Deselect]"]):
TeamEditorState.clipboard?TL(["[Add to clipboard]"]):
editor.readonly?TL(["[Copy]"]):
TL(["[Copy/Move]"])

)," ",
!(TeamEditorState.clipboard||editor.readonly)&&preact.h("button",{
"class":"option",name:"import",onClick:this.clickPanelButton,
value:"set-"+i+"-import"},

preact.h("i",{"class":"fa fa-upload","aria-hidden":true})," ",TL(["[Import/Export]"])
)," ",
!(TeamEditorState.clipboard||editor.readonly)&&preact.h("button",{
"class":"option",name:"delete",onClick:this.deleteSet,value:i},

preact.h("i",{"class":"fa fa-trash","aria-hidden":true})," ",TL(["[Delete]"])
)
),
preact.h("table",{"class":""+spriteClass+tintClass,style:sprite},
preact.h("tr",null,
preact.h("td",{rowSpan:2,"class":"set-pokemon"},preact.h("div",{"class":"border-collapse"},
preact.h("span",{"class":"sprite-inner"},
preact.h("label",{"class":"label"},
preact.h("span",null,TL(["Pok\xE9mon"]))," ",
this.renderInput(i,'pokemon',set.species)
)
)
)),
preact.h("td",{colSpan:2,"class":"set-details"},preact.h("div",{"class":"border-collapse"},
preact.h("label",{"class":"label"},
TL(["Details"])," ",
preact.h("button",{
"class":"textbox"+this.cur('details',i),onClick:this.clickPanelButton,
onKeyDown:this.keyDownPanelButton,name:"details",
value:"set-"+i+"-details"},

preact.h("span",{"class":"detailcell"},
preact.h("label",null,TL(["Level"]))," ",
set.level||editor.defaultLevel
),
!!(set.shiny||editor.gen>=2)&&preact.h("span",{"class":"detailcell"},
preact.h("label",null,TL(["Shiny"]))," ",
set.shiny?preact.h("img",{
src:Dex.resourcePrefix+"sprites/misc/shiny.png",width:18,height:18,alt:"Yes",style:"margin-top: -2px"}
):"\u2014"
),
editor.gen===9&&!editor.isChampions&&preact.h("span",{"class":"detailcell"},
preact.h("label",null,TL(["Tera"]))," ",
preact.h(PSIcon,{type:set.teraType||species.requiredTeraType||species.types[0],"new":!editor.narrow,tera:true})
),
editor.hpTypeMatters(set)&&preact.h("span",{"class":"detailcell"},
preact.h("label",null,TL(["H.P."]))," ",
preact.h(PSIcon,{type:editor.getHPType(set),"new":!editor.narrow})
),
set.gender&&set.gender!=='N'&&preact.h("span",{"class":"detailcell"},
preact.h("label",null,TL(["Gender"]))," ",
preact.h(PSIcon,{gender:set.gender})
)
)
),
preact.h("div",null,
species.types.map(function(type){return preact.h(preact.Fragment,null,preact.h(PSIcon,{type:type,"new":!editor.narrow})," ");})
)
)),
preact.h("td",{rowSpan:2,"class":"set-moves"+overfull},preact.h("div",{"class":"border-collapse"},
preact.h("label",{"class":"label "+this.cur('move',i)},
TL(["Moves"])," ",preact.h("button",{
"class":"button "+this.cur('move',i),onClick:this.setFocus,value:"set-"+i+"-move"},
"+")
)," ",
[].concat(set.moves,['','','',''].slice(set.moves.length)).map(function(move,moveIndex){return(
preact.h("div",{"class":"moverow"},_this12.renderInput(i,'move',move,moveIndex)));}
)
)),
preact.h("td",{rowSpan:2,"class":"set-stats"},
preact.h("label",{"class":"label"},
TL(["Stats"])," ",
preact.h("button",{
"class":"textbox"+this.cur('stats',i),onClick:this.clickPanelButton,
onKeyDown:this.keyDownPanelButton,name:"stats",
value:"set-"+i+"-stats"},

StatForm.renderStatGraph(set,this.props.editor,true)
)
)
)
),
preact.h("tr",null,
preact.h("td",{"class":"set-ability"},preact.h("div",{"class":"border-collapse"},
editor.showAbility(set)&&preact.h("label",{"class":"label"},
TL(["Ability"])," ",
this.renderInput(
i,'ability',set.ability,-1,
editor.gen<=2?TL(["(no ability)"]):TL(["(choose ability)"])
)
)
)),
preact.h("td",{"class":"set-item"},preact.h("div",{"class":"border-collapse"},
editor.showItem(set)&&preact.h(preact.Fragment,null,
set.item&&preact.h(PSIcon,{item:set.item}),
preact.h("label",{"class":"label"},
TL(["Item"])," ",
this.renderInput(i,'item',set.item,-1,TL(["(no item)"]))
)
)
))
)
),
preact.h("div",{"class":"set-nickname"+tintClass},
preact.h("label",{"class":"label"},
preact.h("span",null,TL(["Nickname"])),
this.renderNicknameInput(i)
)
)
);
};return TeamEditorForm;}(preact.Component);


function SetSourceButtons(props)




{
var editor=props.editor,set=props.set;
if(!(set!=null&&set.species))return null;
var sampleSets=editor.getSampleSets(set);
var userSets=editor.getUserSets(set);
return preact.h(preact.Fragment,null,
(sampleSets==null?void 0:sampleSets.length)!==0&&
preact.h("div",{"class":"sample-sets"},
preact.h("h3",null,TL(["Sample sets"])),
sampleSets?
preact.h("div",null,
sampleSets.map(function(setName){return preact.h(preact.Fragment,null,
preact.h("button",{"class":"button",onClick:function(){return props.onLoadSampleSet(setName);}},
setName
)," "
);})
):

preact.h("div",null,TL(["Loading..."]))

),

userSets!==null&&
preact.h("div",{"class":"sample-sets"},
preact.h("h3",null,TL(["Box sets"])),
Object.keys(userSets).length>0?
preact.h("div",null,
Object.keys(userSets).map(function(setName){return preact.h(preact.Fragment,null,
preact.h("button",{"class":"button",onClick:function(){return props.onLoadUserSet(setName);}},
setName
)," "
);})
):

preact.h("div",null,"No ",set.species," sets found in boxes")

)

);
}var

SetImportForm=function(_preact$Component4){function SetImportForm(){var _this13;for(var _len4=arguments.length,args=new Array(_len4),_key6=0;_key6<_len4;_key6++){args[_key6]=arguments[_key6];}_this13=_preact$Component4.call.apply(_preact$Component4,[this].concat(args))||this;_this13.









state={
error:'',
copied:false,
dirty:false
};_this13.
textbox=null;_this13.
revertText='';_this13.











setTextbox=function(el){
_this13.textbox=el;
};_this13.




























revertTextToRevertPoint=function(){
var editor=_this13.props.editor;
if(editor.readonly||!_this13.textbox)return;
_this13.textbox.value=_this13.revertText;
if(!_this13.revertSetToRevertPoint())return;
PSView.politeFocus(_this13.textbox);
_this13.textbox.select();
_this13.setState({error:'',copied:false,dirty:false});
};_this13.
copyText=function(){
if(!_this13.textbox)return;
_this13.textbox.select();
document.execCommand('copy');
_this13.setState({copied:true});
};_this13.
loadSampleSet=function(setName){
var _this13$props=_this13.props,editor=_this13$props.editor,setIndex=_this13$props.setIndex;
if(!editor.loadSampleSet(setIndex,setName))return;
_this13.refreshText();
_this13.props.onChange();
};_this13.
loadUserSet=function(setName){
var _this13$props2=_this13.props,editor=_this13$props2.editor,setIndex=_this13$props2.setIndex;
if(!editor.loadUserSet(setIndex,setName))return;
_this13.refreshText();
_this13.props.onChange();
};_this13.
inputText=function(){
var _this13$props3=_this13.props,editor=_this13$props3.editor,setIndex=_this13$props3.setIndex;
if(editor.readonly||!_this13.textbox)return;
var dirty=_this13.textbox.value!==_this13.revertText;
var set=Teams["import"](_this13.textbox.value)[0];
if(!set){
_this13.revertSetToRevertPoint();
if(!_this13.textbox.value.trim()&&!_this13.revertText){
_this13.setState({error:'',copied:false,dirty:false});
}else{
_this13.setState({error:'No Pokemon set found.',copied:false,dirty:dirty});
}
return;
}
editor.sets[setIndex]=set;
editor.save();
_this13.props.onChange();
_this13.setState({error:'',copied:false,dirty:dirty});
};return _this13;}_inheritsLoose(SetImportForm,_preact$Component4);var _proto5=SetImportForm.prototype;_proto5.getExportText=function getExportText(){if(!this.props.set)return'';return Teams.exportSet(this.props.set,this.props.editor.dex).trim();};_proto5.componentDidMount=function componentDidMount(){this.setRevertPoint();};_proto5.componentDidUpdate=function componentDidUpdate(prevProps){if(prevProps.setIndex===this.props.setIndex)return;this.setRevertPoint();};_proto5.setRevertPoint=function setRevertPoint(){if(!this.textbox)return;this.revertText=this.getExportText();this.refreshText(this.revertText,false);};_proto5.refreshText=function refreshText(){var text=arguments.length>0&&arguments[0]!==undefined?arguments[0]:this.getExportText();var dirty=arguments.length>1&&arguments[1]!==undefined?arguments[1]:text!==this.revertText;if(!this.textbox)return;this.textbox.value=text;if(!PSView.hasTapped){PSView.politeFocus(this.textbox);this.textbox.select();}this.setState({error:'',copied:false,dirty:dirty});};_proto5.revertSetToRevertPoint=function revertSetToRevertPoint(){var _this$props7=this.props,editor=_this$props7.editor,setIndex=_this$props7.setIndex;var set=Teams["import"](this.revertText)[0];if(set){editor.sets[setIndex]=set;}else if(!this.revertText){if(editor.sets[setIndex])editor.sets.splice(setIndex,1);}else{return false;}editor.save();this.props.onChange();return true;};_proto5.
render=function render(){
var editor=this.props.editor;
return preact.h("div",{role:"dialog","aria-label":TL(["Import/Export"]),"class":"set-import-form"},
preact.h("div",{"class":"resultheader"},preact.h("h3",null,TL(["Import/Export set"]))),
preact.h("div",{"class":"pad"},
preact.h("p",null,
preact.h("button",{"class":"button"+(this.state.copied?' cur':''),onClick:this.copyText},
preact.h("i",{"class":"fa fa-"+(this.state.copied?'check':'copy'),"aria-hidden":true})," ",
this.state.copied?TL(["Copied!"]):TL(["[Copy]"])
)," ",
this.state.dirty&&preact.h("button",{
"class":"button",onClick:this.revertTextToRevertPoint,disabled:editor.readonly},

preact.h("i",{"class":"fa fa-undo","aria-hidden":true})," ",TL(["[Revert]"])
)
),
this.state.error&&preact.h("p",{"class":"message-error"},this.state.error),
preact.h("textarea",{
ref:this.setTextbox,"class":"textbox set-import-textbox",rows:14,
readOnly:editor.readonly,onInput:this.inputText,
style:"min-height:6em"}
),
preact.h(SetSourceButtons,{
editor:editor,set:this.props.set,
onLoadSampleSet:this.loadSampleSet,onLoadUserSet:this.loadUserSet}
)
)
);
};return SetImportForm;}(preact.Component);var


StatForm=function(_preact$Component5){function StatForm(){var _this14;for(var _len5=arguments.length,args=new Array(_len5),_key7=0;_key7<_len5;_key7++){args[_key7]=arguments[_key7];}_this14=_preact$Component5.call.apply(_preact$Component5,[this].concat(args))||this;_this14.
































































































































































handleGuess=function(){
var _this14$props=_this14.props,editor=_this14$props.editor,set=_this14$props.set;
var team=editor.team;

var guess=new BattleStatGuesser(team.format).guess(set);
set.evs=guess.evs;
_this14.plus=guess.plusStat||null;
_this14.minus=guess.minusStat||null;
_this14.updateNatureFromPlusMinus();
_this14.props.onChange();
};_this14.
handleOptimize=function(){
var _this14$props2=_this14.props,editor=_this14$props2.editor,set=_this14$props2.set;
var team=editor.team;

var optimized=BattleStatOptimizer(set,team.format);
if(!optimized)return;

set.evs=optimized.evs;
_this14.plus=optimized.plus||null;
_this14.minus=optimized.minus||null;
_this14.updateNatureFromPlusMinus();
_this14.props.onChange();
};_this14.





























































































plus=null;_this14.
minus=null;_this14.











changeEV=function(ev){
var target=ev.currentTarget;
var set=_this14.props.set;
var statID=target.name.split('-')[1];
var value=Math.abs(parseInt(target.value));

if(isNaN(value)){
if(set.evs)delete set.evs[statID];
}else{
if(_this14.maxEVs()<6*252||_this14.props.editor.isLetsGo){
set.evs||(set.evs={});
}else{
set.evs||(set.evs={hp:252,atk:252,def:252,spa:252,spd:252,spe:252});
}
set.evs[statID]=value;
}

if(target.type==='range'){

var maxEv=_this14.maxEVs();
var usableMaxEv=maxEv===510?508:maxEv;
if(maxEv<6*252){
var totalEv=0;for(var _i44=0,_Object$values7=
Object.values(set.evs||{});_i44<_Object$values7.length;_i44++){var curEv=_Object$values7[_i44];totalEv+=curEv;}
if(totalEv>maxEv&&totalEv-value<=maxEv){
set.evs[statID]=usableMaxEv-(totalEv-value);


var textbox=_this14.base.querySelector("input.stat-input[name=\"ev-"+statID+"\"]");
if(textbox)textbox.value=_this14.getEVText(statID);
}
}
}else{
if(target.value.includes('+')){
if(statID==='hp'){
alert(TL(["Natures cannot raise or lower HP."]));
return;
}
_this14.plus=statID;
}else if(_this14.plus===statID){
_this14.plus=null;
}
if(target.value.includes('-')){
if(statID==='hp'){
alert(TL(["Natures cannot raise or lower HP."]));
return;
}
_this14.minus=statID;
}else if(_this14.minus===statID){
_this14.minus=null;
}
_this14.updateNatureFromPlusMinus();
}

_this14.props.onChange();
};_this14.
keyDownStatInput=function(ev){


if(ev.keyCode!==9)return;
var target=ev.currentTarget;

var unsortedInputs=Array.from(_this14.base.querySelectorAll('.stat-input'));
var evInputs=unsortedInputs.filter(function(input){return input.name.startsWith('ev-');});
var ivInputs=unsortedInputs.filter(function(input){return input.name.startsWith('iv-');});
var inputs=[].concat(evInputs,ivInputs);

var inputIndex=inputs.indexOf(target);
if(inputIndex<0)return;
var nextInput=inputs[inputIndex+(ev.shiftKey?-1:1)];
if(!nextInput)return;
nextInput.focus();
nextInput.select();
ev.preventDefault();
};_this14.
changeNatureModifier=function(ev){
var target=ev.currentTarget;
var statID=target.value.slice(0,-1);
var modifier=target.value.slice(-1);
if(modifier==='+'){
_this14.plus=statID;
if(_this14.minus===statID)_this14.minus=null;
}else{
_this14.minus=statID;
if(_this14.plus===statID)_this14.plus=null;
}
_this14.updateNatureFromPlusMinus();
_this14.props.onChange();
};_this14.
updateNatureFromPlusMinus=function(){
var set=_this14.props.set;
set.nature=Teams.getNatureFromPlusMinus(_this14.plus,_this14.minus)||undefined;
};_this14.





























changeIV=function(ev){
var target=ev.currentTarget;
var set=_this14.props.set;
var statID=target.name.split('-')[1];
var value=_this14.dvToIv(target.value);
if(value===null){
if(set.ivs){
delete set.ivs[statID];
if(Object.values(set.ivs).every(function(iv){return iv===undefined;})){
set.ivs=undefined;
}
}
}else{
set.ivs||(set.ivs={hp:31,atk:31,def:31,spa:31,spd:31,spe:31});
set.ivs[statID]=value;
}
_this14.props.onChange();
};_this14.
changeNature=function(ev){
var target=ev.currentTarget;
var set=_this14.props.set;
var nature=target.value;
if(nature==='Serious'){
delete set.nature;
}else{
set.nature=nature;
}
_this14.props.onChange();
};_this14.
changeIVSpread=function(ev){
var target=ev.currentTarget;
var set=_this14.props.set;
if(!target.value)return;

if(target.value==='auto'){
set.ivs=undefined;
}else{
var _target$value$split$m=target.value.split('/').map(Number),hp=_target$value$split$m[0],atk=_target$value$split$m[1],def=_target$value$split$m[2],spa=_target$value$split$m[3],spd=_target$value$split$m[4],spe=_target$value$split$m[5];
set.ivs={hp:hp,atk:atk,def:def,spa:spa,spd:spd,spe:spe};
}
_this14.props.onChange();
};return _this14;}_inheritsLoose(StatForm,_preact$Component5);StatForm.renderStatGraph=function renderStatGraph(set,editor,evs){var defaultEV=editor.gen>2?0:252;var ivs=editor.getIVs(set);return Dex.statNames.map(function(statID){var _BattleNatures3,_BattleNatures4;if(statID==='spd'&&editor.gen===1)return null;var stat=editor.getStat(statID,set,ivs[statID]);var ev=set.evs?set.evs[statID]||0:defaultEV;var maxStat=statID==='hp'?Math.floor(176*editor.defaultLevel/25)+10:Math.floor(247*editor.defaultLevel/50)+5;var width=Math.min(stat*75/maxStat,75);var hue=Math.min(Math.floor(stat*180/maxStat),360);var statName=editor.gen===1&&statID==='spa'?TL.statShort.spc:TL.statShort[statID];if(evs&&!ev&&!set.evs&&statID==='hp')ev=TL(["EVs"]);return preact.h("span",{"class":"statrow"},preact.h("em",null,statName)," ",preact.h("span",{"class":"statgraph"},preact.h("span",{style:"width:"+width+"px;background:hsl("+hue+",40%,75%);border-color:hsl("+hue+",40%,45%)"}))," ",!evs&&preact.h("strong",null,stat),evs&&preact.h("strong",null,ev||''),evs&&(((_BattleNatures3=BattleNatures[set.nature])==null?void 0:_BattleNatures3.plus)===statID?preact.h("small",null,"+"):((_BattleNatures4=BattleNatures[set.nature])==null?void 0:_BattleNatures4.minus)===statID?preact.h("small",null,"\u2212"):null));});};var _proto6=StatForm.prototype;_proto6.renderIVMenu=function renderIVMenu(){var _this$props8=this.props,editor=_this$props8.editor,set=_this$props8.set;if(editor.gen<=2)return null;var hpType=editor.getHPMove(set);var hpIVdata=hpType&&!editor.canHyperTrain(set)&&editor.getHPIVs(hpType)||null;var autoSpread=set.ivs&&editor.defaultIVs(set,false);var autoSpreadValue=autoSpread&&Object.values(autoSpread).join('/');if(editor.isChampions)return null;if(!hpIVdata){return preact.h("select",{name:"ivspread","class":"select",onChange:this.changeIVSpread},preact.h("option",{value:"",selected:true},TL(["IV spreads"])),autoSpreadValue&&preact.h("option",{value:"auto"},TL(["Automatic (",")"],autoSpreadValue)),preact.h("optgroup",{label:TL(["min Atk"])},preact.h("option",{value:"31/0/31/31/31/31"},"31/0/31/31/31/31")),preact.h("optgroup",{label:TL(["min Atk, min Spe"])},preact.h("option",{value:"31/0/31/31/31/0"},"31/0/31/31/31/0")),preact.h("optgroup",{label:TL(["max all"])},preact.h("option",{value:"31/31/31/31/31/31"},"31/31/31/31/31/31")),preact.h("optgroup",{label:TL(["min Spe"])},preact.h("option",{value:"31/31/31/31/31/0"},"31/31/31/31/31/0")));}var minStat=editor.gen>=6?0:2;var hpIVs=hpIVdata.map(function(ivs){return ivs.split('').map(function(iv){return parseInt(iv);});});return preact.h("select",{name:"ivspread","class":"select",onChange:this.changeIVSpread},preact.h("option",{value:"",selected:true},TL(["Hidden Power "," IVs"],hpType)),autoSpreadValue&&preact.h("option",{value:"auto"},TL(["Automatic (",")"],autoSpreadValue)),preact.h("optgroup",{label:TL(["min Atk"])},hpIVs.map(function(ivs){var spread=ivs.map(function(iv,i){return(i===1?minStat:30)+iv;}).join('/');return preact.h("option",{value:spread},spread);})),preact.h("optgroup",{label:TL(["min Atk, min Spe"])},hpIVs.map(function(ivs){var spread=ivs.map(function(iv,i){return(i===5||i===1?minStat:30)+iv;}).join('/');return preact.h("option",{value:spread},spread);})),preact.h("optgroup",{label:TL(["max all"])},hpIVs.map(function(ivs){var spread=ivs.map(function(iv){return 30+iv;}).join('/');return preact.h("option",{value:spread},spread);})),preact.h("optgroup",{label:TL(["min Spe"])},hpIVs.map(function(ivs){var spread=ivs.map(function(iv,i){return(i===5?minStat:30)+iv;}).join('/');return preact.h("option",{value:spread},spread);})));};_proto6.smogdexLink=function smogdexLink(s){var editor=this.props.editor;var species=editor.dex.species.get(s);var format=editor.format;var smogdexid=toID(species.baseSpecies);if(species.id==='meowstic'){smogdexid='meowstic-m';}else if(species.forme){switch(species.baseSpecies){case'Alcremie':case'Basculin':case'Burmy':case'Castform':case'Cherrim':case'Deerling':case'Flabebe':case'Floette':case'Florges':case'Furfrou':case'Gastrodon':case'Genesect':case'Keldeo':case'Mimikyu':case'Minior':case'Pikachu':case'Polteageist':case'Sawsbuck':case'Shellos':case'Sinistea':case'Tatsugiri':case'Vivillon':break;default:smogdexid+='-'+toID(species.forme);break;}}var generationNumber=9;if(format.startsWith('gen')){var number=parseInt(format.charAt(3),10);if(1<=number&&number<=8){generationNumber=number;}format=format.slice(4);}var generation=['rb','gs','rs','dp','bw','xy','sm','ss','sv'][generationNumber-1];if(format==='battlespotdoubles'){smogdexid+='/vgc15';}else if(format==='doublesou'||format==='doublesuu'){smogdexid+='/doubles';}else if(format==='ou'||format==='uu'||format==='ru'||format==='nu'||format==='pu'||format==='lc'||format==='monotype'||format==='mixandmega'||format==='nfe'||format==='nationaldex'||format==='stabmons'||format==='1v1'||format==='almostanyability'){smogdexid+='/'+format;}else if(format==='balancedhackmons'){smogdexid+='/bh';}else if(format==='anythinggoes'){smogdexid+='/ag';}else if(format==='nationaldexag'){smogdexid+='/national-dex-ag';}return"http://smogon.com/dex/"+generation+"/pokemon/"+smogdexid+"/";};_proto6.renderSpreadGuesser=function renderSpreadGuesser(){var _this$props9=this.props,editor=_this$props9.editor,set=_this$props9.set;var team=editor.team;if(editor.gen<3){return preact.h("p",null,"(",preact.h("a",{target:"_blank",href:this.smogdexLink(set.species)},"Smogon\xA0analysis"),")");}var guess=new BattleStatGuesser(team.format).guess(set);var role=guess.role;var guessedEVs=guess.evs;var guessedPlus=guess.plusStat||null;var guessedMinus=guess.minusStat||null;return preact.h("p",{"class":"suggested"},preact.h("small",null,TL.label(TL(["Guessed spread"]))),role==='?'?TL(["(Please choose 4 moves to get a guessed spread)"]):preact.h("button",{name:"setStatFormGuesses","class":"button",onClick:this.handleGuess},role,": ",Dex.statNames.map(function(statID){return guessedEVs[statID]?guessedEVs[statID]+" "+TL.statShort[statID]:null;}).filter(Boolean).join(' / '),!!(guessedPlus&&guessedMinus)&&" (+"+TL.statShort[guessedPlus]+", -"+TL.statShort[guessedMinus]+")"),preact.h("small",null," (",preact.h("a",{target:"_blank",href:this.smogdexLink(set.species)},"Smogon\xA0analysis"),")"));};_proto6.renderStatOptimizer=function renderStatOptimizer(){var optimized=BattleStatOptimizer(this.props.set,this.props.editor.format);if(!optimized)return null;return preact.h("p",null,preact.h("small",null,preact.h("em",null,TL.label(TL(["Protip"]))),optimized.savedEVs?TL(["Use a different nature to save "," EVs:"],optimized.savedEVs):TL(["Use a different nature to get higher stats:"])," "),preact.h("button",{name:"setStatFormOptimization","class":"button",onClick:this.handleOptimize},Dex.statNames.map(function(statID){return optimized.evs[statID]?optimized.evs[statID]+" "+TL.statShort[statID]:null;}).filter(Boolean).join(' / '),!!(optimized.plus&&optimized.minus)&&" (+"+TL.statShort[optimized.plus]+", -"+TL.statShort[optimized.minus]+")"));};_proto6.setInput=function setInput(name,value){var evInput=this.base.querySelector("input[name=\""+name+"\"]");if(evInput)evInput.value=value;};_proto6.getEVText=function getEVText(statID){var _this$props$set$evs;var ev=""+(((_this$props$set$evs=this.props.set.evs)==null?void 0:_this$props$set$evs[statID])||'');var plusMinus=this.plus===statID?'+':this.minus===statID?'-':'';return ev+plusMinus;};_proto6.update=function update(init){var _querySelector2;var set=this.props.set;var nature=BattleNatures[set.nature];var skipID=!init?(_querySelector2=this.base.querySelector('input:focus'))==null?void 0:_querySelector2.name:undefined;if(nature!=null&&nature.plus){this.plus=(nature==null?void 0:nature.plus)||null;this.minus=(nature==null?void 0:nature.minus)||null;}else if(this.plus&&this.minus){this.plus=null;this.minus=null;}for(var _i46=0,_Dex$statNames4=Dex.statNames;_i46<_Dex$statNames4.length;_i46++){var _set$ivs;var statID=_Dex$statNames4[_i46];var iv=this.ivToDv((_set$ivs=set.ivs)==null?void 0:_set$ivs[statID]);if(skipID!=="ev-"+statID)this.setInput("ev-"+statID,this.getEVText(statID));if(skipID!=="iv-"+statID)this.setInput("iv-"+statID,iv);}};_proto6.componentDidMount=function componentDidMount(){this.update(true);};_proto6.componentDidUpdate=function componentDidUpdate(){this.update();};_proto6.renderStatbar=function renderStatbar(stat,statID){var editor=this.props.editor;var maxStat=statID==='hp'?Math.floor(176*editor.defaultLevel/25)+10:Math.floor(247*editor.defaultLevel/50)+5;var width=Math.min(stat*180/maxStat,180);var hue=Math.min(Math.floor(stat*180/maxStat),360);return preact.h("span",{style:"width:"+Math.floor(width)+"px;background:hsl("+hue+",85%,45%);border-color:hsl("+hue+",85%,35%)"});};_proto6.renderNatureButtons=function renderNatureButtons(statID){if(statID==='hp'||this.props.editor.gen<3)return null;var minus="\u2212";return preact.h("span",{"class":"stat-nature-buttons"},preact.h("button",{"class":"button button-first"+(this.minus===statID?' cur':''),value:statID+"-",onClick:this.changeNatureModifier,tabIndex:-1,"aria-label":TL([""," nature"],minus+TL.statShort[statID])},"\u2013"),preact.h("button",{"class":"button button-last"+(this.plus===statID?' cur':''),value:statID+"+",onClick:this.changeNatureModifier,tabIndex:-1,"aria-label":TL([""," nature"],'+'+TL.statShort[statID])},"+"));};_proto6.dvToIv=function dvToIv(dvOrIvString){var dvOrIv=Number(dvOrIvString);if(isNaN(dvOrIv))return null;var useIVs=this.props.editor.gen>2;return useIVs?dvOrIv:dvOrIv===15?31:dvOrIv*2;};_proto6.ivToDv=function ivToDv(iv){if(iv===null||iv===undefined)return'';var useIVs=this.props.editor.gen>2;return""+(useIVs?iv:Math.trunc(iv/2));};_proto6.
maxEVs=function maxEVs(){
var editor=this.props.editor;
var useCappedEVs=!editor.isLetsGo&&editor.gen>=3&&!editor.isChampions;
return editor.isChampions?66:useCappedEVs?510:Infinity;
};_proto6.
render=function render(){var _this15=this;
var _this$props10=this.props,editor=_this$props10.editor,set=_this$props10.set;
var narrow=editor.narrowStats;
var species=editor.dex.species.get(set.species);

var baseStats=species.baseStats;

var useEVs=!editor.isLetsGo&&!editor.isChampions;

var maxEV=editor.isChampions?32:useEVs?252:200;
var stepEV=useEVs?4:1;
var defaultEV=useEVs&&editor.gen<=2&&!set.evs?maxEV:0;
var useIVs=editor.gen>2;


var statNames=narrow?TL.statShort:TL.statMedium;
if(editor.gen===1)statNames=Object.assign({},statNames,{spa:statNames.spc});

var ivs=editor.getIVs(set);
var stats=Dex.statNames.filter(function(statID){return editor.gen>1||statID!=='spd';}).map(function(statID){return[
statID,statNames[statID],editor.getStat(statID,set,ivs[statID])];}
);

var remaining=null;
var maxEVs=this.maxEVs();
if(maxEVs<6*252){
var totalEv=0;for(var _i48=0,_Object$values9=
Object.values(set.evs||{});_i48<_Object$values9.length;_i48++){var ev=_Object$values9[_i48];totalEv+=ev;}
if(totalEv<=maxEVs&&!editor.isChampions){
remaining=totalEv>maxEVs-2?0:maxEVs-2-totalEv;
}else{
remaining=maxEVs-totalEv;
}
remaining||(remaining=null);
}
var defaultIVs=editor.defaultIVs(set);

return preact.h("div",{"class":"set-stats-form"+(narrow?' tiny-layout':''),role:"dialog","aria-label":TL(["Stats"])},
preact.h("div",{"class":"resultheader"},preact.h("h3",null,TL(["EVs, IVs, and nature"]))),
preact.h("div",{"class":"pad"},
this.renderSpreadGuesser(),
preact.h("table",null,
preact.h("tr",null,
preact.h("th",null),
preact.h("th",null,TL(["Base"])),
preact.h("th",{"class":"setstatbar"}),
preact.h("th",null,editor.isLetsGo?TL(["AVs"]):editor.isChampions?TL(["Points"]):TL(["EVs"])),
preact.h("th",null),
!editor.isChampions&&preact.h("th",null,useIVs?TL(["IVs"]):TL(["DVs"])),
preact.h("th",null)
),
stats.map(function(_ref9){var _set$evs$statID,_set$evs4;var statID=_ref9[0],statName=_ref9[1],stat=_ref9[2];return preact.h("tr",null,
preact.h("th",{style:"text-align:right;font-weight:normal"},statName),
preact.h("td",{style:"text-align:right"},preact.h("strong",null,baseStats[statID])),
preact.h("td",{"class":"setstatbar"},_this15.renderStatbar(stat,statID)),
preact.h("td",null,preact.h("input",{
name:"ev-"+statID,placeholder:""+(defaultEV||''),
type:"text",inputMode:"numeric","class":"textbox default-placeholder stat-input",style:"width:40px;vertical-align:middle",
onInput:_this15.changeEV,onChange:_this15.changeEV,onKeyDown:_this15.keyDownStatInput}
),_this15.renderNatureButtons(statID)),
preact.h("td",null,preact.h("input",{
name:"evslider-"+statID,value:(_set$evs$statID=(_set$evs4=set.evs)==null?void 0:_set$evs4[statID])!=null?_set$evs$statID:defaultEV,min:"0",max:maxEV,step:stepEV,
type:"range","class":"evslider",tabIndex:-1,"aria-hidden":true,
onInput:_this15.changeEV,onChange:_this15.changeEV}
)),
!editor.isChampions&&preact.h("td",null,preact.h("input",{
name:"iv-"+statID,min:0,max:useIVs?31:15,placeholder:""+defaultIVs[statID],
style:narrow?"width:22px":"width:40px",type:narrow?'text':'number',inputMode:"numeric",
"class":"textbox default-placeholder stat-input",onInput:_this15.changeIV,
onChange:_this15.changeIV,onKeyDown:_this15.keyDownStatInput}
)),
preact.h("td",{style:"text-align:right"},preact.h("strong",null,stat))
);}),
preact.h("tr",null,
preact.h("td",{colSpan:2}),
preact.h("td",{"class":"setstatbar",style:"text-align:right"},remaining!==null?TL.label(TL(["Remaining"])):preact.h(preact.Fragment,null,"\xA0")),
preact.h("td",{style:"text-align:center"},remaining&&remaining<0?preact.h("b",{"class":"message-error"},remaining):remaining),
preact.h("td",{colSpan:3,style:"text-align:right"},this.renderIVMenu())
)
),
editor.gen>=3&&preact.h("p",null,
TL.label(TL(["Nature"])),preact.h("select",{
name:"nature","class":"select",onChange:this.changeNature,value:set.nature||'Serious'},

Object.values(BattleNatures).map(function(curNature){return(
preact.h("option",{value:curNature.name},
TL(curNature),
curNature.plus&&" (+"+TL.statShort[curNature.plus]+", -"+TL.statShort[curNature.minus]+")"
));}
)
)
),
editor.gen>=3&&!narrow&&preact.h("p",null,
preact.h("small",null,preact.h("em",null,TL.label(TL(["Protip"]))),TL('You can also set natures by typing {PLUS} and {MINUS} in the EV box.').
split(/(\{(?:PLUS|MINUS)\})/).map(function(part){return(
part==='{PLUS}'?preact.h("kbd",null,"+"):part==='{MINUS}'?preact.h("kbd",null,"-"):part);}
))
),
editor.gen>=3&&this.renderStatOptimizer()
)
);
};return StatForm;}(preact.Component);var


DetailsForm=function(_preact$Component6){function DetailsForm(){var _this16;for(var _len6=arguments.length,args=new Array(_len6),_key8=0;_key8<_len6;_key8++){args[_key8]=arguments[_key8];}_this16=_preact$Component6.call.apply(_preact$Component6,[this].concat(args))||this;_this16.

















changeNickname=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.name=target.value.trim();
}else{
delete set.name;
}
_this16.props.onChange();
};_this16.
changeTera=function(ev){
var target=ev.currentTarget;
var _this16$props=_this16.props,editor=_this16$props.editor,set=_this16$props.set;
var species=editor.dex.species.get(set.species);
if(!target.value||target.value===(species.requiredTeraType||species.types[0])){
delete set.teraType;
}else{
set.teraType=target.value.trim();
}
_this16.props.onChange();
};_this16.
changeLevel=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.level=parseInt(target.value.trim());
}else{
delete set.level;
}
_this16.props.onChange();
};_this16.
changeGender=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.gender=target.value.trim();
}else{
delete set.gender;
}
_this16.props.onChange();
};_this16.
changeHappiness=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.happiness=parseInt(target.value.trim());
}else{
delete set.happiness;
}
_this16.props.onChange();
};_this16.
changeShiny=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.checked){
set.shiny=true;
}else{
delete set.shiny;
}
_this16.props.onChange();
};_this16.
changeDynamaxLevel=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.dynamaxLevel=parseInt(target.value.trim());
}else{
delete set.dynamaxLevel;
}
_this16.props.onChange();
};_this16.
changeGigantamax=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.checked){
set.gigantamax=true;
}else{
delete set.gigantamax;
}
_this16.props.onChange();
};_this16.
changeHPType=function(ev){
var target=ev.currentTarget;
var set=_this16.props.set;
if(target.value){
set.hpType=target.value;
}else{
delete set.hpType;
}
_this16.props.onChange();
};_this16.












































































































































selectSprite=function(ev){
var target=ev.currentTarget;
var formId=target.value;
var _this16$props2=_this16.props,editor=_this16$props2.editor,set=_this16$props2.set;
var species=editor.dex.species.get(formId);
if(!species.exists)return;
editor.changeSpecies(set,species.name);
_this16.props.onChange();
_this16.forceUpdate();
};return _this16;}_inheritsLoose(DetailsForm,_preact$Component6);var _proto7=DetailsForm.prototype;_proto7.update=function update(init){var _querySelector3;var set=this.props.set;var skipID=!init?(_querySelector3=this.base.querySelector('input:focus'))==null?void 0:_querySelector3.name:undefined;var nickname=this.base.querySelector('input[name="nickname"]');if(nickname&&skipID!=='nickname')nickname.value=set.name||'';};_proto7.componentDidMount=function componentDidMount(){this.update(true);};_proto7.componentDidUpdate=function componentDidUpdate(){this.update();};_proto7.renderGender=function renderGender(gender){if(gender==='N')return this.props.editor.dex.text.genderName(gender);return preact.h(preact.Fragment,null,preact.h(PSIcon,{gender:gender})," ",this.props.editor.dex.text.genderName(gender));};_proto7.render=function render(){var _set$level,_set$happiness,_set$dynamaxLevel,_this17=this;var _this$props11=this.props,editor=_this$props11.editor,set=_this$props11.set;var species=editor.dex.species.get(set.species);var baseSpecies=editor.dex.text.get(species).baseSpecies;return preact.h("div",{"class":"set-details-form",role:"dialog","aria-label":TL(["Details"])},preact.h("div",{"class":"resultheader"},preact.h("h3",null,TL(["Details"]))),preact.h("div",{"class":"pad"},preact.h("p",null,preact.h("label",{"class":"label"},TL.label(TL(["Nickname"])),preact.h("input",{name:"nickname","class":"textbox default-placeholder",placeholder:baseSpecies,onInput:this.changeNickname,onChange:this.changeNickname}))),preact.h("p",null,preact.h("label",{"class":"label"},TL.label(TL(["Level"])),preact.h("input",{name:"level",value:(_set$level=set.level)!=null?_set$level:'',placeholder:""+editor.defaultLevel,type:"number",inputMode:"numeric",min:"1",max:"100",step:"1","class":"textbox inputform numform default-placeholder",style:"width: 50px",onInput:this.changeLevel,onChange:this.changeLevel,disabled:editor.isChampions})),preact.h("small",null,"(You probably want to change the team's levels by changing the format, not here)")),editor.gen>1&&preact.h(preact.Fragment,null,preact.h("p",null,preact.h("div",{"class":"label"},TL.label(TL(["Shiny"])),preact.h("div",{"class":"labeled"},preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"checkbox",name:"shiny",checked:set.shiny,onInput:this.changeShiny,onChange:this.changeShiny})," ",preact.h("img",{src:Dex.resourcePrefix+"sprites/misc/shiny.png",width:22,height:22,alt:""})," ",TL(["Shiny"]))))),preact.h("p",null,preact.h("div",{"class":"label"},TL.label(TL(["Gender"])),species.gender?preact.h("strong",null,this.renderGender(species.gender)):preact.h("div",{"class":"labeled"},preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"radio",name:"gender",value:"M",checked:set.gender==='M',onInput:this.changeGender,onChange:this.changeGender})," ",this.renderGender('M')),preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"radio",name:"gender",value:"F",checked:set.gender==='F',onInput:this.changeGender,onChange:this.changeGender})," ",this.renderGender('F')),preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"radio",name:"gender",value:"",checked:!set.gender||set.gender==='N',onInput:this.changeGender,onChange:this.changeGender})," Random")))),editor.isLetsGo?preact.h("p",null,preact.h("label",{"class":"label"},TL.label(TL(["Happiness"])),preact.h("input",{name:"happiness",value:"",placeholder:"70",type:"number",inputMode:"numeric","class":"textbox inputform numform default-placeholder",style:"width: 50px",onInput:this.changeHappiness,onChange:this.changeHappiness}))):(editor.gen<8||editor.isNatDex)&&preact.h("p",null,preact.h("label",{"class":"label"},TL.label(TL(["Happiness"])),preact.h("input",{name:"happiness",value:(_set$happiness=set.happiness)!=null?_set$happiness:'',placeholder:"255",type:"number",inputMode:"numeric",min:"0",max:"255",step:"1","class":"textbox inputform numform default-placeholder",style:"width: 50px",onInput:this.changeHappiness,onChange:this.changeHappiness})))),editor.gen===8&&!editor.isBDSP&&!species.cannotDynamax&&preact.h("p",null,preact.h("label",{"class":"label",style:"display:inline"},TL.label(TL(["Dynamax Level"])),preact.h("input",{name:"dynamaxlevel",value:(_set$dynamaxLevel=set.dynamaxLevel)!=null?_set$dynamaxLevel:'',placeholder:"10",type:"number",inputMode:"numeric",min:"0",max:"10",step:"1","class":"textbox inputform numform default-placeholder",onInput:this.changeDynamaxLevel,onChange:this.changeDynamaxLevel}))," ",species.canGigantamax?preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"checkbox",name:"gigantamax",value:"true",checked:set.gigantamax,onInput:this.changeGigantamax,onChange:this.changeGigantamax})," Gigantamax"):species.forme==='Gmax'&&preact.h("label",{"class":"checkbox inline"},preact.h("input",{type:"checkbox",checked:true,disabled:true})," Gigantamax")),(!editor.isLetsGo&&editor.gen===7||editor.isNatDex||species.baseSpecies==='Unown')&&preact.h("p",null,preact.h("label",{"class":"label"},TL.label(TL(["Hidden Power Type"])),preact.h("select",{name:"hptype","class":"select",onChange:this.changeHPType,value:editor.getHPType(set)},Dex.types.all().map(function(type){return type.HPivs&&preact.h("option",{value:type.name},editor.dex.text.typeName(type.name));})))),editor.gen===9&&!editor.isChampions&&preact.h("p",null,preact.h("label",{"class":"label",title:TL(["Tera Type"])},TL.label(TL(["Tera Type"])),species.requiredTeraType&&editor.formeLegality==='normal'?preact.h("button",{name:"teratype","class":"button cur",disabled:true},preact.h(PSIcon,{type:species.requiredTeraType,"new":true,tera:true})):preact.h("select",{name:"teratype","class":"button base-select",onChange:this.changeTera,value:set.teraType||species.requiredTeraType||species.types[0]},preact.h("button",null,preact.h("selectedcontent",null)),Dex.types.all().map(function(type){return preact.h("option",{value:type.name},preact.h(PSIcon,{type:type.name,"new":true,tera:true}));})))),species.cosmeticFormes&&preact.h("div",null,preact.h("p",null,preact.h("strong",null,TL.label(TL(["Form"])))),preact.h("div",{style:"display:flex;flex-wrap:wrap;gap:6px;max-width:400px;"},function(_species$cosmeticForm){var baseId=toID(species.baseSpecies);var forms=(_species$cosmeticForm=species.cosmeticFormes)!=null&&_species$cosmeticForm.length?[baseId].concat(species.cosmeticFormes.map(toID)):[baseId];return forms.map(function(id){var sp=editor.dex.species.get(id);var isCur=toID(set.species)===id;return preact.h("button",{value:id,"class":"button piconbtn"+(isCur?' cur':''),style:{padding:'2px'},onClick:_this17.selectSprite},preact.h(PSIcon,{pokemon:{species:sp.name}}),preact.h("br",null),sp.forme||sp.baseForme||sp.baseSpecies);});}()))));};return DetailsForm;}(preact.Component);
//# sourceMappingURL=battle-team-editor.js.map