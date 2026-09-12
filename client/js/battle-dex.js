"use strict";var _process$versions;/**
 * Pokemon Showdown Dex
 *
 * Roughly equivalent to sim/dex.js in a Pokemon Showdown server, but
 * designed for use in browsers rather than in Node.
 *
 * This is a generic utility library for Pokemon Showdown code: any
 * code shared between the replay viewer and the client usually ends up
 * here.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * Compiled into battledata.js which includes all dependencies
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */














































if(typeof window==='undefined'){

global.window=global;
}else{

window.exports=window;
}

window.nodewebkit=!!(typeof process!=='undefined'&&(_process$versions=process.versions)!=null&&_process$versions['node-webkit']);

function toID(text){var _text,_text2;
if((_text=text)!=null&&_text.id){
text=text.id;
}else if((_text2=text)!=null&&_text2.userid){
text=text.userid;
}
if(typeof text!=='string'&&typeof text!=='number')return'';
return(""+text).toLowerCase().replace(/[^a-z0-9]+/g,'');
}

function toUserid(text){
return toID(text);
}

var TEXT_LANGUAGES=[
{code:"en",legacyId:"english",name:"English",fullName:"English"},
{code:"de",legacyId:"german",name:"Deutsch",fullName:"Deutsch (German)"},
{code:"es",legacyId:"spanish",name:"Español",fullName:"Español (Spanish)"},
{code:"fr",legacyId:"french",name:"Français",fullName:"Français (French)"},
{code:"it",legacyId:"italian",name:"Italiano",fullName:"Italiano (Italian)"},
{code:"nl",legacyId:"dutch",name:"Nederlands",fullName:"Nederlands (Dutch)"},
{code:"pt",legacyId:"portuguese",name:"Português",fullName:"Português (Portuguese)"},
{code:"tr",legacyId:"turkish",name:"Türkçe",fullName:"Türkçe (Turkish)"},
{code:"hi",legacyId:"hindi",name:"हिंदी",fullName:"हिंदी (Hindi)"},
{code:"ja",legacyId:"japanese",name:"日本語",fullName:"日本語 (Japanese)"},
{code:"zh-cn",legacyId:"simplifiedchinese",name:"简体中文",fullName:"简体中文 (Simplified Chinese)"},
{code:"zh-tw",legacyId:"traditionalchinese",name:"繁體中文",fullName:"繁體中文 (Traditional Chinese)"},
{code:"ko",legacyId:"korean",name:"한국어",fullName:"한국어 (Korean)"}];


var TEXT_LANGUAGE_TABLE={};for(var _i2=0;_i2<
TEXT_LANGUAGES.length;_i2++){var _lang=TEXT_LANGUAGES[_i2];
TEXT_LANGUAGE_TABLE[toID(_lang.code)]=_lang;
TEXT_LANGUAGE_TABLE[_lang.code]=_lang;
TEXT_LANGUAGE_TABLE[_lang.legacyId]=_lang;
TEXT_LANGUAGE_TABLE[_lang.name]=_lang;
TEXT_LANGUAGE_TABLE[_lang.name.toLowerCase()]=_lang;
}
TEXT_LANGUAGE_TABLE['en-afd']={
code:"en-afd",legacyId:"english",name:"English (AFD)",fullName:"English (AFD)"
};



var TEXT_TABLES={
Item:'Items',
Ability:'Abilities',
Move:'Moves'
};

























function translate(strings){for(var _len=arguments.length,values=new Array(_len>1?_len-1:0),_key=1;_key<_len;_key++){values[_key-1]=arguments[_key];}
if(typeof strings!=='string'&&'effectType'in strings){
return typeof BattleText==='undefined'?strings.name:Dex.text.get(strings).name;
}

var source;
var context='';
if(typeof strings==='string'){
source=strings;
if(values.length)context=values[0];
values=[];
}else{
source=strings[0];
for(var i=1;i<strings.length;i++){
source+="{"+(i-1)+"}"+strings[i];
}
}

var translated=TL.inLanguage(source,Dex.text.getLanguage(),context);
return translated.replace(/\{(\d+)\}/g,function(placeholder,indexText){
var index=Number(indexText);
return index>=0&&index<values.length?String(values[index]):placeholder;
});
}

var initialText=typeof BattleText==='undefined'?undefined:BattleText.en;

function tagField(tags,field){
var table={};
for(var id in tags){
var value=tags[id][field];
if(value)table[id]=value;
}
return table;
}

var TL=Object.assign(translate,{
inLanguage:function(source,language){var _BattleUIText$languag,_ref;var context=arguments.length>2&&arguments[2]!==undefined?arguments[2]:'';
var translation=typeof BattleUIText==='undefined'?undefined:(_BattleUIText$languag=BattleUIText[language])==null?void 0:_BattleUIText$languag[source];
var fallback=source.startsWith('[')&&source.endsWith(']')?source.slice(1,-1):source;
return(_ref=typeof translation==='string'?translation:translation==null?void 0:translation[context])!=null?_ref:fallback;
},

label:function(label,value){
var labelText=TL(["",": "],label);
return value===undefined?labelText:labelText+String(value);
},
orList:function(items){
if(items.length<=1)return items.join();
if(items.length===2){
return TL([""," or ",""],items[0],items[1]);
}
var list=items[0];for(var _i4=0,_items$slice2=
items.slice(1,-1);_i4<_items$slice2.length;_i4++){var item=_items$slice2[_i4];list+=TL([", ",""],item);}
var last=items[items.length-1];
return list+TL([", or ",""],last);
},
andList:function(items){
if(items.length<=1)return items.join();
if(items.length===2){
return TL([""," and ",""],items[0],items[1]);
}
var list=items[0];for(var _i6=0,_items$slice4=
items.slice(1,-1);_i6<_items$slice4.length;_i6++){var item=_items$slice4[_i6];list+=TL([", ",""],item);}
var last=items[items.length-1];
return list+TL([", and ",""],last);
},

cappedUserList:function(items,cap){
if(items.length>cap+1){
var list=items[0];for(var _i8=0,_items$slice6=
items.slice(1,cap);_i8<_items$slice6.length;_i8++){var item=_items$slice6[_i8];list+=TL([", ",""],item);}
var others=items.length-cap;
return list+TL([", and "," others"],others);
}
return TL.andList(items);
},
type:(initialText==null?void 0:initialText.TypeNames)||{},
nature:(initialText==null?void 0:initialText.NatureNames)||{},
gender:(initialText==null?void 0:initialText.GenderNames)||{},
egggroup:(initialText==null?void 0:initialText.EggGroupNames)||{},
tag:tagField(initialText==null?void 0:initialText.Tags,'name'),
tagHint:tagField(initialText==null?void 0:initialText.Tags,'hint'),
color:(initialText==null?void 0:initialText.ColorNames)||{},
status:(initialText==null?void 0:initialText.StatusNames)||{},
target:(initialText==null?void 0:initialText.TargetNames)||{},
stat:(initialText==null?void 0:initialText.StatNames)||{},
statShort:(initialText==null?void 0:initialText.StatShortNames)||{},
statMedium:(initialText==null?void 0:initialText.StatMediumNames)||{}
});

function updateTranslatedNames(lang){
if(lang!==Dex.text.getLanguage())return;
if(typeof BattleText==='undefined')return;
var english=BattleText.en;
var text=BattleText[lang]||english;
if(!text)return;
TL.type=text.TypeNames||(english==null?void 0:english.TypeNames)||{};
TL.nature=text.NatureNames||(english==null?void 0:english.NatureNames)||{};
TL.gender=text.GenderNames||(english==null?void 0:english.GenderNames)||{};
TL.egggroup=text.EggGroupNames||(english==null?void 0:english.EggGroupNames)||{};
TL.tag=tagField(text.Tags||(english==null?void 0:english.Tags),'name');
TL.tagHint=tagField(text.Tags||(english==null?void 0:english.Tags),'hint');
TL.color=text.ColorNames||(english==null?void 0:english.ColorNames)||{};
TL.status=text.StatusNames||(english==null?void 0:english.StatusNames)||{};
TL.target=text.TargetNames||(english==null?void 0:english.TargetNames)||{};
TL.stat=text.StatNames||(english==null?void 0:english.StatNames)||{};
TL.statShort=text.StatShortNames||(english==null?void 0:english.StatShortNames)||{};
TL.statMedium=text.StatMediumNames||(english==null?void 0:english.StatMediumNames)||{};
}

function assignTextFields(target,source){for(var _i10=0,_Object$entries2=
Object.entries(source);_i10<_Object$entries2.length;_i10++){var _ref2=_Object$entries2[_i10];var key=_ref2[0];var value=_ref2[1];
if(value!==null)target[key]=value;
}
}






function getOtherName(table,name,lang){var _BattleText$lang,_BattleText$en;
var id=toID(name);
if(table==='GenderNames'){
id={m:'male',f:'female',n:'genderless'}[id]||id;
}
return((_BattleText$lang=BattleText[lang])==null||(_BattleText$lang=_BattleText$lang[table])==null?void 0:_BattleText$lang[id])||((_BattleText$en=BattleText.en)==null||(_BattleText$en=_BattleText$en[table])==null?void 0:_BattleText$en[id])||name;
}




function getTextEntry(effect,gen,lang){var _BattleText$en3,_BattleText$lang3;
if(effect.effectType==='Species'){var _BattleText$lang2,_BattleText$en2;
var _entry=((_BattleText$lang2=BattleText[lang])==null||(_BattleText$lang2=_BattleText$lang2.Pokedex)==null?void 0:_BattleText$lang2[effect.id])||((_BattleText$en2=BattleText.en)==null||(_BattleText$en2=_BattleText$en2.Pokedex)==null?void 0:_BattleText$en2[effect.id]);
return{
name:(_entry==null?void 0:_entry.name)||effect.name,
baseSpecies:(_entry==null?void 0:_entry.baseSpecies)||effect.baseSpecies,
forme:(_entry==null?void 0:_entry.forme)||null
};
}
if(effect.effectType==='Type'){
return{name:getOtherName('TypeNames',effect.name,lang)};
}
if(effect.effectType==='Nature'){
return{name:getOtherName('NatureNames',effect.name,lang)};
}
var tableName=TEXT_TABLES[effect.effectType];
var english=((_BattleText$en3=BattleText.en)==null||(_BattleText$en3=_BattleText$en3[tableName])==null?void 0:_BattleText$en3[effect.id])||{};
var localized=((_BattleText$lang3=BattleText[lang])==null||(_BattleText$lang3=_BattleText$lang3[tableName])==null?void 0:_BattleText$lang3[effect.id])||{};
var entry={};
assignTextFields(entry,english);
assignTextFields(entry,localized);
for(var i=1;i<=8;i++){
var genName="gen"+i;
var englishGen=english[genName];
var localizedGen=localized[genName];
if(typeof englishGen==='object'||typeof localizedGen==='object'){
var genEntry={};
if(englishGen&&typeof englishGen==='object')assignTextFields(genEntry,englishGen);
if(localizedGen&&typeof localizedGen==='object')assignTextFields(genEntry,localizedGen);
entry[genName]=genEntry;
}
}
for(var _i11=8;_i11>=gen;_i11--){
var _genName="gen"+_i11;
var _englishGen=english[_genName];
var _localizedGen=localized[_genName];
if(_englishGen&&typeof _englishGen==='object')assignTextFields(entry,_englishGen);
if(_localizedGen&&typeof _localizedGen==='object')assignTextFields(entry,_localizedGen);
}
var fallback=effect;
if(typeof entry.name!=='string')entry.name=effect.name;
if(typeof entry.desc!=='string'){
entry.desc=fallback.desc||fallback.shortDesc||(
typeof entry.shortDesc==='string'?entry.shortDesc:'');
}
if(typeof entry.shortDesc!=='string'){
entry.shortDesc=fallback.shortDesc||fallback.desc||entry.desc;
}
return entry;
}


var PSUtils=new(function(){function _class(){}var _proto=_class.prototype;_proto.










splitFirst=function splitFirst(str,delimiter){var limit=arguments.length>2&&arguments[2]!==undefined?arguments[2]:1;
var splitStr=[];
while(splitStr.length<limit){
var delimiterIndex=str.indexOf(delimiter);
if(delimiterIndex>=0){
splitStr.push(str.slice(0,delimiterIndex));
str=str.slice(delimiterIndex+delimiter.length);
}else{
splitStr.push(str);
str='';
}
}
splitStr.push(str);
return splitStr;
};_proto.












compare=function compare(a,b){
if(typeof a==='number'){
return a-b;
}
if(typeof a==='string'){
return a.localeCompare(b);
}
if(typeof a==='boolean'){
return(a?1:2)-(b?1:2);
}
if(Array.isArray(a)){
for(var i=0;i<a.length;i++){
var comparison=PSUtils.compare(a[i],b[i]);
if(comparison)return comparison;
}
return 0;
}
if(a.reverse){
return PSUtils.compare(b.reverse,a.reverse);
}
throw new Error("Passed value "+a+" is not comparable");
};_proto.












sortBy=function sortBy(array,callback){
if(!callback)return array.sort(PSUtils.compare);
return array.sort(function(a,b){return PSUtils.compare(callback(a),callback(b));});
};_proto.
normalizeError=function normalizeError(err){
var stack=err.stack||'';
var messagePrefix=err.name+": "+err.message;



if(stack&&!stack.startsWith(messagePrefix)){
return messagePrefix+"\n"+stack;
}
return stack||messagePrefix;
};return _class;}())(
);





function toRoomid(roomid){
return roomid.replace(/[^a-zA-Z0-9-]+/g,'').toLowerCase();
}

function toName(name){
if(typeof name!=='string'&&typeof name!=='number')return'';
name=(""+name).replace(/[|\s[\],\u202e]+/g,' ').trim();
if(name.length>18)name=name.substr(0,18).trim();


name=name.replace(
/[\u0300-\u036f\u0483-\u0489\u0610-\u0615\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g,
''
);
name=name.replace(/[\u239b-\u23b9]/g,'');

return name;
}
























var Dex=new(function(){function _class2(){var _this=this;this.
Ability=Ability;this.
Item=Item;this.
Move=Move;this.
Species=Species;this.

gen=9;this.
modid='gen9';this.
cache=null;this.

REGULAR=0;this.
WEAK=1;this.
RESIST=2;this.
IMMUNE=3;this.

statNames=['hp','atk','def','spa','spd','spe'];this.
statNamesExceptHP=['atk','def','spa','spd','spe'];this.

pokeballs=null;this.

resourcePrefix=function(_window$document){
var prefix='';
if(((_window$document=window.document)==null||(_window$document=_window$document.location)==null?void 0:_window$document.protocol)!=='http:')prefix='https:';
return prefix+"//"+(window.Config?Config.routes.client:'play.pokemonshowdown.com')+"/";
}();this.

fxPrefix=function(_window$document2){
var protocol=((_window$document2=window.document)==null||(_window$document2=_window$document2.location)==null?void 0:_window$document2.protocol)!=='http:'?'https:':'';
return protocol+"//"+(window.Config?Config.routes.client:'play.pokemonshowdown.com')+"/fx/";
}();this.

loadedSpriteData={xy:1,bw:0};this.
loadedTextData={en:1};this.
moddedDexes={};this.







afdMode=void 0;this.
















































































text={
getLanguage:function(text){var _Dex$prefs,_TEXT_LANGUAGE_TABLE$;
var lang=Dex.prefs('language')||((_Dex$prefs=Dex.prefs('serversettings'))==null?void 0:_Dex$prefs.language);
if(lang)lang=(_TEXT_LANGUAGE_TABLE$=TEXT_LANGUAGE_TABLE[lang])==null?void 0:_TEXT_LANGUAGE_TABLE$.code;


lang||(lang=window.Config&&Config.defaultLanguage||(window.PS?this.getBrowserLanguage():'en'));
if(Dex.afdMode===true&&lang==='en')return'en-afd';
return lang;
},
getBrowserLanguage:function(){var _navigator$languages;
if(typeof navigator==='undefined')return'en';
var languages=(_navigator$languages=navigator.languages)!=null&&_navigator$languages.length?navigator.languages:[navigator.language];for(var _i13=0;_i13<
languages.length;_i13++){var language=languages[_i13];
language=language.toLowerCase().replace(/_/g,'-');
if(language==='zh'||language.startsWith('zh-')){
return /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(language)?'zh-tw':'zh-cn';
}
var baseLanguage=language.split('-')[0];
if(baseLanguage in TEXT_LANGUAGE_TABLE)return baseLanguage;
}
return'en';
},
languages:function(){
return TEXT_LANGUAGES;
},
findLanguage:function(lang){
return TEXT_LANGUAGE_TABLE[lang.toLowerCase()]||TEXT_LANGUAGE_TABLE[toID(lang)]||null;
},
get:function(effect){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();
return getTextEntry(effect,9,lang);
},
typeName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('TypeNames',name,lang);},
natureName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('NatureNames',name,lang);},
categoryName:function(name){var _BattleText$lang4,_BattleText$en4;var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return(
((_BattleText$lang4=BattleText[lang])==null||(_BattleText$lang4=_BattleText$lang4.Tags)==null||(_BattleText$lang4=_BattleText$lang4[toID(name)])==null?void 0:_BattleText$lang4.name)||((_BattleText$en4=BattleText.en)==null||(_BattleText$en4=_BattleText$en4.Tags)==null||(_BattleText$en4=_BattleText$en4[toID(name)])==null?void 0:_BattleText$en4.name)||name);},
genderName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('GenderNames',name,lang);},
eggGroupName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('EggGroupNames',name,lang);},
colorName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('ColorNames',name,lang);}
};this.






















moves={
get:function(nameOrMove){
if(nameOrMove&&typeof nameOrMove!=='string'){

return nameOrMove;
}
var name=nameOrMove||'';
var id=toID(nameOrMove);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(!window.BattleMovedex)window.BattleMovedex={};
var data=window.BattleMovedex[id];
if(data&&typeof data.exists==='boolean')return data;

if(!data&&id.substr(0,11)==='hiddenpower'&&id.length>11){
var _ref3=/([a-z]*)([0-9]*)/.exec(id),hpWithType=_ref3[1],hpPower=_ref3[2];
data=Object.assign({},
window.BattleMovedex[hpWithType]||{},{
basePower:Number(hpPower)||60});

}
if(!data&&id.substr(0,6)==='return'&&id.length>6){
data=Object.assign({},
window.BattleMovedex['return']||{},{
basePower:Number(id.slice(6))});

}
if(!data&&id.substr(0,11)==='frustration'&&id.length>11){
data=Object.assign({},
window.BattleMovedex['frustration']||{},{
basePower:Number(id.slice(11))});

}

if(!data)data={exists:false};
var move=new Move(id,name,data);
window.BattleMovedex[id]=move;
return move;
}
};this.







items={
get:function(nameOrItem){
if(nameOrItem&&typeof nameOrItem!=='string'){

return nameOrItem;
}
var name=nameOrItem||'';
var id=toID(nameOrItem);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(!window.BattleItems)window.BattleItems={};
var data=window.BattleItems[id];
if(data&&typeof data.exists==='boolean')return data;
if(!data)data={exists:false};
var item=new Item(id,name,data);
window.BattleItems[id]=item;
return item;
}
};this.

abilities={
get:function(nameOrAbility){
if(nameOrAbility&&typeof nameOrAbility!=='string'){

return nameOrAbility;
}
var name=nameOrAbility||'';
var id=toID(nameOrAbility);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(!window.BattleAbilities)window.BattleAbilities={};
var data=window.BattleAbilities[id];
if(data&&typeof data.exists==='boolean')return data;
if(!data)data={exists:false};
var ability=new Ability(id,name,data);
window.BattleAbilities[id]=ability;
return ability;
}
};this.

species={
get:function(nameOrSpecies){
if(nameOrSpecies&&typeof nameOrSpecies!=='string'){

return nameOrSpecies;
}
var name=nameOrSpecies||'';
var id=toID(nameOrSpecies);
var formid=id;
if(!window.BattlePokedexAltForms)window.BattlePokedexAltForms={};
if(formid in window.BattlePokedexAltForms)return window.BattlePokedexAltForms[formid];
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}else if(window.BattlePokedex&&!(id in BattlePokedex)&&window.BattleBaseSpeciesChart){for(var _i15=0,_BattleBaseSpeciesCha2=
BattleBaseSpeciesChart;_i15<_BattleBaseSpeciesCha2.length;_i15++){var baseSpeciesId=_BattleBaseSpeciesCha2[_i15];
if(formid.startsWith(baseSpeciesId)){
id=baseSpeciesId;
break;
}
}
}
if(!window.BattlePokedex)window.BattlePokedex={};
var data=window.BattlePokedex[id];

var species;
if(data&&typeof data.exists==='boolean'){
species=data;
}else{var _evos;
if(!data)data={exists:false};
if(!data.tier&&id.endsWith('totem')){
data.tier=_this.species.get(id.slice(0,-5)).tier;
}
if(!data.tier&&data.baseSpecies&&toID(data.baseSpecies)!==id){
data.tier=_this.species.get(data.baseSpecies).tier;
}
data.nfe=data.id==='dipplin'||!!((_evos=data.evos)!=null&&_evos.some(function(evo){
var evoSpecies=_this.species.get(evo);
return!evoSpecies.isNonstandard||evoSpecies.isNonstandard===data.isNonstandard||

evoSpecies.isNonstandard==="Unobtainable";
}));
species=new Species(id,name,data);
window.BattlePokedex[id]=species;
}

if(species.cosmeticFormes){for(var _i17=0,_species$cosmeticForm2=
species.cosmeticFormes;_i17<_species$cosmeticForm2.length;_i17++){var forme=_species$cosmeticForm2[_i17];
if(toID(forme)===formid){
species=new Species(formid,name,Object.assign({},
species,{
name:forme,
forme:forme.slice(species.name.length+1),
baseForme:"",
baseSpecies:species.name,
otherFormes:null})
);
window.BattlePokedexAltForms[formid]=species;
break;
}
}
}

return species;
}
};this.

types={
allCache:null,
namesCache:null,
get:function(type){
if(!type||typeof type==='string'){var _window$BattleTypeCha;
var id=toID(type);
var _name=id.substr(0,1).toUpperCase()+id.substr(1);
type=((_window$BattleTypeCha=window.BattleTypeChart)==null?void 0:_window$BattleTypeCha[id])||{};
if(type.damageTaken)type.exists=true;
if(!type.id)type.id=id;
if(!type.name)type.name=_name;
if(!type.effectType){
type.effectType='Type';
}
}
return type;
},
all:function(){
if(_this.types.allCache)return _this.types.allCache;
var types=[];
for(var id in window.BattleTypeChart||{}){
types.push(Dex.types.get(id));
}
if(types.length)_this.types.allCache=types;
return types;
},
names:function(){
if(_this.types.namesCache)return _this.types.namesCache;
var names=_this.types.all().map(function(type){return type.name;});
names.splice(names.indexOf('Stellar'),1);
if(names.length)_this.types.namesCache=names;
return names;
},
isName:function(name){var _window$BattleTypeCha2;
var id=toID(name);
if(name!==id.substr(0,1).toUpperCase()+id.substr(1))return false;
return(_window$BattleTypeCha2=window.BattleTypeChart)==null?void 0:_window$BattleTypeCha2.hasOwnProperty(id);
}
};}var _proto2=_class2.prototype;_proto2.mod=function mod(modid){if(modid==='gen9')return this;if(!window.BattleTeambuilderTable)return this;if(modid in this.moddedDexes){return this.moddedDexes[modid];}this.moddedDexes[modid]=new ModdedDex(modid);return this.moddedDexes[modid];};_proto2.forGen=function forGen(gen){if(!gen)return this;return this.mod("gen"+gen);};_proto2.formatGen=function formatGen(format){var formatid=toID(format);if(!formatid)return Dex.gen;if(!formatid.startsWith('gen'))return 6;return parseInt(formatid.charAt(3))||Dex.gen;};_proto2.forFormat=function forFormat(format){var dex=Dex.forGen(Dex.formatGen(format));var formatid=toID(format).slice(4);if(dex.gen===7&&formatid.includes('letsgo')){dex=Dex.mod('gen7letsgo');}if(dex.gen===8&&formatid.includes('bdsp')){dex=Dex.mod('gen8bdsp');}if(dex.gen===9&&formatid.includes('champions')){dex=Dex.mod('champions');}return dex;};_proto2.resolveAvatar=function resolveAvatar(avatar){if(window.BattleAvatarNumbers&&avatar in BattleAvatarNumbers){avatar=BattleAvatarNumbers[avatar];}if(avatar.startsWith('#')){return Dex.resourcePrefix+'sprites/trainers-custom/'+toID(avatar.substr(1))+'.png';}if(avatar.includes('.')){var _window$Config;if(!((_window$Config=window.Config)!=null&&_window$Config.server)){return Dex.resourcePrefix+'sprites/trainers/unknown.png';}var protocol=Config.server.port===443?'https':'http';var server=protocol+"://"+Config.server.host+":"+Config.server.port;return server+"/avatars/"+encodeURIComponent(avatar).replace(/%3F/g,'?');}return Dex.resourcePrefix+'sprites/trainers/'+Dex.sanitizeName(avatar||'unknown')+'.png';};_proto2.sanitizeName=function sanitizeName(name){if(!name)return'';return(''+name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').slice(0,50);};_proto2.prefs=function prefs(prop){var _window$Storage,_window$PS;return(_window$Storage=window.Storage)!=null&&_window$Storage.prefs?window.Storage.prefs(prop):(_window$PS=window.PS)==null||(_window$PS=_window$PS.prefs)==null?void 0:_window$PS[prop];};_proto2.getShortName=function getShortName(name){var shortName=name.replace(/[^A-Za-z0-9]+$/,'');if(shortName.includes('(')){shortName+=name.slice(shortName.length).replace(/[^()]+/g,'').replace(/\(\)/g,'');}return shortName;};_proto2.getEffect=function getEffect(name){name=(name||'').trim();if(name.substr(0,5)==='item:'){return Dex.items.get(name.substr(5).trim());}else if(name.substr(0,8)==='ability:'){return Dex.abilities.get(name.substr(8).trim());}else if(name.substr(0,5)==='move:'){return Dex.moves.get(name.substr(5).trim());}var id=toID(name);return new PureEffect(id,name);};_proto2.getGen3Category=function getGen3Category(type){return['Fire','Water','Grass','Electric','Ice','Psychic','Dark','Dragon'].includes(type)?'Special':'Physical';};_proto2.

hasAbility=function hasAbility(species,ability){
for(var i in species.abilities){
if(ability===species.abilities[i])return true;
}
return false;
};_proto2.

loadSpriteData=function loadSpriteData(gen){
if(this.loadedSpriteData[gen])return;
this.loadedSpriteData[gen]=1;

var path=$('script[src*="pokedex-mini.js"]').attr('src')||'';
var qs='?'+(path.split('?')[1]||'');
path=(/.+?(?=data\/pokedex-mini\.js)/.exec(path)||[])[0]||'';

var el=document.createElement('script');
el.src=path+'data/pokedex-mini-bw.js'+qs;
document.getElementsByTagName('body')[0].appendChild(el);
};_proto2.
loadTextData=function loadTextData(){var _this2=this;var lang=arguments.length>0&&arguments[0]!==undefined?arguments[0]:this.text.getLanguage();
var text=typeof BattleText==='undefined'?undefined:BattleText;
updateTranslatedNames(lang);
if(text!=null&&text[lang]){
return Promise.resolve();
}

if(this.loadedTextData[lang]===1)delete this.loadedTextData[lang];
if(typeof document==='undefined')return Promise.resolve();
var existing=this.loadedTextData[lang];
if(existing)return existing===1?Promise.resolve():existing;

var loadScript=function(src){return new Promise(function(resolve,reject){
var el=document.createElement('script');
el.src=src;
el.onload=function(){return resolve();};
el.onerror=function(){return reject(new Error("Failed to load text data from "+src));};
document.getElementsByTagName('body')[0].appendChild(el);
});};
var cachebuster=Config.translationCachebuster?"?"+Config.translationCachebuster:'';
var textURL=Config.testclient?"data/text/"+lang+".js":this.resourcePrefix+"data/text/"+lang+".js";
var loading=loadScript(textURL+cachebuster);
if(Config.testclient){
loading=loading["catch"](function(){return(
loadScript("https://play.pokemonshowdown.com/data/text/"+lang+".js"+cachebuster));}
);
}
loading=loading.then(function(){return updateTranslatedNames(lang);})["catch"](function(){
delete _this2.loadedTextData[lang];
updateTranslatedNames(lang);
});
this.loadedTextData[lang]=loading;
return loading;
};_proto2.
getSpriteData=function getSpriteData(pokemon,isFront)







{var options=arguments.length>2&&arguments[2]!==undefined?arguments[2]:{gen:6};
var mechanicsGen=options.gen||6;
var isDynamax=!!options.dynamax;
if(pokemon instanceof Pokemon){
if(pokemon.volatiles.transform){
options.shiny=pokemon.volatiles.transform[2];
options.gender=pokemon.volatiles.transform[3];
}else{
options.shiny=pokemon.shiny;
options.gender=pokemon.gender;
}
var isGigantamax=false;
if(pokemon.volatiles.dynamax){
if(pokemon.volatiles.dynamax[1]){
isGigantamax=true;
}else if(options.dynamax!==false){
isDynamax=true;
}
}
pokemon=pokemon.getSpeciesForme()+(isGigantamax?'-Gmax':'');
}
var species=Dex.species.get(pokemon);

if(species.name.endsWith('-Gmax'))isDynamax=false;
var spriteData={
gen:mechanicsGen,
w:96,
h:96,
y:0,
url:Dex.resourcePrefix+'sprites/',
pixelated:true,
isFrontSprite:false,
cryurl:'',
shiny:options.shiny
};
var name=species.spriteid;
var dir;
var facing;
if(isFront){
spriteData.isFrontSprite=true;
dir='';
facing='front';
}else{
dir='-back';
facing='back';
}












var graphicsGen=mechanicsGen;
if(Dex.prefs('nopastgens'))graphicsGen=6;
if(Dex.prefs('bwgfx')&&graphicsGen>=6)graphicsGen=5;
spriteData.gen=Math.max(graphicsGen,Math.min(species.gen,5));
var baseDir=['','gen1','gen2','gen3','gen4','gen5','','','',''][spriteData.gen];

var miscData=null;
var speciesid=species.id;
if(species.isTotem)speciesid=toID(name);
if(window.BattlePokemonSprites)miscData=BattlePokemonSprites[speciesid];
if(!miscData&&window.BattlePokemonSpritesBW)miscData=BattlePokemonSpritesBW[speciesid];
if(!miscData)miscData={};

if(miscData.num!==0&&miscData.num>-5000){
var baseSpeciesid=toID(species.baseSpecies);
spriteData.cryurl='audio/cries/'+baseSpeciesid;
var formeid=species.formeid;
var specialFormeCries=[
'-bloodmoon','-crowned','-eternal','-eternamax','-four','-hangry','-hero','-lowkey','-noice','-primal','-rapidstrike','-roaming','-school','-sky','-starter','-super','-therian','-unbound'];

var specialBaseSpeciesCries=[
'calyrex','kyurem','cramorant','indeedee','lycanroc','necrozma','oinkologne','oricorio','slowpoke','tatsugiri','zygarde'];

if(species.isMega||
formeid&&(specialFormeCries.includes(formeid)||specialBaseSpeciesCries.includes(baseSpeciesid))){
if(species.isMega&&(baseSpeciesid==='meowstic'||baseSpeciesid==='tatsugiri')){
spriteData.cryurl+='-mega';
}else{
spriteData.cryurl+=formeid;
}
}
spriteData.cryurl+='.mp3';
}

if(options.shiny&&mechanicsGen>1)dir+='-shiny';


if(Dex.afdMode||options.afd){

dir='afd'+dir;
spriteData.url+=dir+'/'+name+'.png';


if(isDynamax&&!options.noScale){
spriteData.w*=0.25;
spriteData.h*=0.25;
spriteData.y+=-22;
}else if(species.isTotem&&!options.noScale){
spriteData.w*=0.5;
spriteData.h*=0.5;
spriteData.y+=-11;
}
return spriteData;
}


if(options.mod){
spriteData.cryurl="sprites/"+options.mod+"/audio/"+toID(species.baseSpecies);
spriteData.cryurl+='.mp3';
}

var animatedSprite=false;
if(!Dex.prefs('noanim')&&!Dex.prefs('nogif')&&spriteData.gen>=5){
var animationArray=[];
if(baseDir===''&&window.BattlePokemonSprites){
animationArray.push([BattlePokemonSprites[speciesid],'']);
}
if(window.BattlePokemonSpritesBW){
animationArray.push([BattlePokemonSpritesBW[speciesid],'gen5']);
}for(var _i19=0;_i19<
animationArray.length;_i19++){var _ref4=animationArray[_i19];var animationData=_ref4[0];var animDir=_ref4[1];
if(!animationData)continue;
if(animationData[facing+'f']&&options.gender==='F')facing+='f';
if(!animationData[facing])continue;
if(facing.endsWith('f'))name+='-f';
if(spriteData.gen>=6)spriteData.pixelated=false;
dir=animDir+'ani'+dir;
spriteData.w=animationData[facing].w;
spriteData.h=animationData[facing].h;
spriteData.url+=dir+'/'+name+'.gif';
animatedSprite=true;
break;
}
}
if(!animatedSprite){


dir=(baseDir||'gen5')+dir;



if(spriteData.gen>=4&&miscData['frontf']&&options.gender==='F'){
name+='-f';
}

spriteData.url+=dir+'/'+name+'.png';
}

if(!options.noScale){
if(graphicsGen>4){

}else if(spriteData.isFrontSprite){
spriteData.w*=2;
spriteData.h*=2;
spriteData.y+=-16;
}else{

spriteData.w*=2/1.5;
spriteData.h*=2/1.5;
spriteData.y+=-11;
}
if(spriteData.gen<=2)spriteData.y+=2;
}
if(isDynamax&&!options.noScale){
spriteData.w*=2;
spriteData.h*=2;
spriteData.y+=-22;
}else if(species.isTotem&&!options.noScale){
spriteData.w*=1.5;
spriteData.h*=1.5;
spriteData.y+=-11;
}

return spriteData;
};_proto2.

getPokemonIconNum=function getPokemonIconNum(id,isFemale,facingLeft){var _window$BattlePokemon,_window$BattlePokedex,_window$BattlePokemon2;
var num=0;
if((_window$BattlePokemon=window.BattlePokemonSprites)!=null&&(_window$BattlePokemon=_window$BattlePokemon[id])!=null&&_window$BattlePokemon.num){
num=BattlePokemonSprites[id].num;
}else if((_window$BattlePokedex=window.BattlePokedex)!=null&&(_window$BattlePokedex=_window$BattlePokedex[id])!=null&&_window$BattlePokedex.num){
num=BattlePokedex[id].num;
}
if(num<0)num=0;
if(num>1025)num=0;

if((_window$BattlePokemon2=window.BattlePokemonIconIndexes)!=null&&_window$BattlePokemon2[id]){
num=BattlePokemonIconIndexes[id];
}

if(isFemale){
if(['unfezant','frillish','jellicent','meowstic','pyroar'].includes(id)){
num=BattlePokemonIconIndexes[id+'f'];
}
}
if(facingLeft){
if(BattlePokemonIconIndexesLeft[id]){
num=BattlePokemonIconIndexesLeft[id];
}
}
return num;
};_proto2.

getPokemonIcon=function getPokemonIcon(pokemon,facingLeft){var _pokemon,_pokemon2,_pokemon3,_pokemon4,_pokemon5;
if(pokemon==='pokeball'){
return"background:transparent url("+Dex.resourcePrefix+"sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -0px 4px";
}else if(pokemon==='pokeball-statused'){
return"background:transparent url("+Dex.resourcePrefix+"sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -40px 4px";
}else if(pokemon==='pokeball-fainted'){
return"background:transparent url("+Dex.resourcePrefix+"sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px;opacity:.4;filter:contrast(0)";
}else if(pokemon==='pokeball-none'){
return"background:transparent url("+Dex.resourcePrefix+"sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px";
}

var id=toID(pokemon);
if(!pokemon||typeof pokemon==='string')pokemon=null;

if((_pokemon=pokemon)!=null&&_pokemon.speciesForme)id=toID(pokemon.speciesForme);

if((_pokemon2=pokemon)!=null&&_pokemon2.species)id=toID(pokemon.species);

if((_pokemon3=pokemon)!=null&&(_pokemon3=_pokemon3.volatiles)!=null&&_pokemon3.formechange&&!pokemon.volatiles.transform){

id=toID(pokemon.volatiles.formechange[1]);
}
var num=this.getPokemonIconNum(id,((_pokemon4=pokemon)==null?void 0:_pokemon4.gender)==='F',facingLeft);

var top=Math.floor(num/12)*30;
var left=num%12*40;
var fainted=(_pokemon5=pokemon)!=null&&_pokemon5.fainted?";opacity:.3;filter:grayscale(100%) brightness(.5)":"";

return"background:transparent url("+Dex.resourcePrefix+"sprites/pokemonicons-sheet.png?v22) no-repeat scroll -"+left+"px -"+top+"px"+fainted;
};_proto2.

getTeambuilderSpriteData=function getTeambuilderSpriteData(pokemon){var dex=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex;
var gen=dex.gen;
var id=toID(pokemon.species||pokemon);
var species=Dex.species.get(id);
var spriteid;
if(typeof pokemon==='string'){
spriteid=species.spriteid||id;
}else{
spriteid=pokemon.spriteid;
if(pokemon.species&&!spriteid){
spriteid=species.spriteid||id;
}
}
if(species.exists===false)return{spriteDir:'sprites/gen5',spriteid:'0',x:10,y:5,pixelated:true};
if(Dex.afdMode){
return{
spriteid:spriteid,
spriteDir:'sprites/afd',
shiny:!!pokemon.shiny,
x:10,
y:5
};
}
var spriteData={
spriteid:spriteid,
spriteDir:'sprites/dex',
x:-2,
y:-3
};
if(pokemon.shiny)spriteData.shiny=true;
if(dex.modid==='gen7letsgo')gen=8;
if(Dex.prefs('nopastgens'))gen=9;
if(Dex.prefs('bwgfx')&&gen>5)gen=5;

var homeExists=(!species.isNonstandard||!['CAP','Custom'].includes(species.isNonstandard)||
species.id==="xerneasneutral")&&![
"floetteeternal","pichuspikyeared","pikachubelle","pikachucosplay","pikachulibre","pikachuphd","pikachupopstar","pikachurockstar"].
includes(species.id)&&!(species.isMega&&species.gen===9);
if(gen>=8&&homeExists){
spriteData.spriteDir='sprites/home-centered';
spriteData.x=8;
spriteData.y=10;
spriteData.h=96;
return spriteData;
}
var xydexExists=!species.isNonstandard||species.isNonstandard==='Past'||species.isNonstandard==='CAP'||[
"pikachustarter","eeveestarter","meltan","melmetal","pokestarufo","pokestarufo2","pokestarbrycenman","pokestarmt","pokestarmt2","pokestargiant","pokestarhumanoid","pokestarmonster","pokestarf00","pokestarf002","pokestarspirit"].
includes(species.id);
if(species.gen>=8&&species.isNonstandard!=='CAP')xydexExists=false;
if(gen>=6&&xydexExists){
if(species.gen>=7){
spriteData.x=-6;
spriteData.y=-7;
}else if(id.substr(0,6)==='arceus'){
spriteData.x=-2;
spriteData.y=7;
}else if(id==='garchomp'){
spriteData.x=-2;
spriteData.y=2;
}else if(id==='garchompmega'){
spriteData.x=-2;
spriteData.y=0;
}
return spriteData;
}
spriteData.spriteDir='sprites/gen5';
if(gen<=1&&species.gen<=1)spriteData.spriteDir='sprites/gen1';else
if(gen<=2&&species.gen<=2)spriteData.spriteDir='sprites/gen2';else
if(gen<=3&&species.gen<=3)spriteData.spriteDir='sprites/gen3';else
if(gen<=4&&species.gen<=4)spriteData.spriteDir='sprites/gen4';
spriteData.pixelated=true;
spriteData.x=10;
spriteData.y=5;
return spriteData;
};_proto2.

getTeambuilderSprite=function getTeambuilderSprite(pokemon,dex){var xOffset=arguments.length>2&&arguments[2]!==undefined?arguments[2]:0;var yOffset=arguments.length>3&&arguments[3]!==undefined?arguments[3]:0;
if(!pokemon)return'';
var data=this.getTeambuilderSpriteData(pokemon,dex);
var shiny=data.shiny?'-shiny':'';
var resize=data.h?"background-size:"+data.h+"px":'';
return"background-image:url("+Dex.resourcePrefix+data.spriteDir+shiny+"/"+data.spriteid+".png);background-position:"+(data.x+xOffset)+"px "+(data.y+yOffset)+"px;background-repeat:no-repeat;"+resize;
};_proto2.

getItemIcon=function getItemIcon(item){var _item;
var num=0;
if(typeof item==='string'&&window.BattleItems)item=window.BattleItems[toID(item)];
if((_item=item)!=null&&_item.spritenum)num=item.spritenum;

var top=Math.floor(num/16)*24;
var left=num%16*24;
return"background:transparent url("+Dex.resourcePrefix+"sprites/itemicons-sheet.png?v1) no-repeat scroll -"+left+"px -"+top+"px";
};_proto2.

getTypeIcon=function getTypeIcon(type,b){
type=this.types.get(type).name;
if(!type)type='???';
var sanitizedType=type.replace(/\?/g,'%3f');
var alt=BattleLog.escapeHTML(TL.type[toID(type)]||type);
return"<img src=\""+Dex.resourcePrefix+"sprites/types/"+sanitizedType+".png\" alt=\""+alt+"\" height=\"14\" width=\"32\" class=\"pixelated"+(b?' b':'')+"\" />";
};_proto2.

getCategoryIcon=function getCategoryIcon(category){
var categoryID=toID(category);
var sanitizedCategory='';
switch(categoryID){
case'physical':
case'special':
case'status':
sanitizedCategory=categoryID.charAt(0).toUpperCase()+categoryID.slice(1);
break;
default:
sanitizedCategory='undefined';
break;
}
var alt=BattleLog.escapeHTML(TL.tag[categoryID]||sanitizedCategory);
return"<img src=\""+Dex.resourcePrefix+"sprites/categories/"+sanitizedCategory+".png\" alt=\""+alt+"\" height=\"14\" width=\"32\" class=\"pixelated\" />";
};_proto2.

getPokeballs=function getPokeballs(){var _window;
if(this.pokeballs)return this.pokeballs;
this.pokeballs=[];
(_window=window).BattleItems||(_window.BattleItems={});for(var _i21=0,_Object$values2=
Object.values(BattleItems);_i21<_Object$values2.length;_i21++){var data=_Object$values2[_i21];
if(!data.isPokeball)continue;
this.pokeballs.push(data.name);
}
return this.pokeballs;
};return _class2;}())(
);var

ModdedDex=function(){










function ModdedDex(modid){var _this3=this;this.gen=void 0;this.modid=void 0;this.cache={Moves:{},Items:{},Abilities:{},Species:{},Types:{}};this.pokeballs=null;this.






text={
getLanguage:function(){return Dex.text.getLanguage();},
getBrowserLanguage:function(){return Dex.text.getBrowserLanguage();},
languages:function(){return Dex.text.languages();},
findLanguage:function(lang){return Dex.text.findLanguage(lang);},
get:function(effect){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();
return getTextEntry(effect,_this3.gen,lang);
},
typeName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('TypeNames',name,lang);},
natureName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('NatureNames',name,lang);},
categoryName:function(name){var _BattleText$lang5,_BattleText$en5;var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return(
((_BattleText$lang5=BattleText[lang])==null||(_BattleText$lang5=_BattleText$lang5.Tags)==null||(_BattleText$lang5=_BattleText$lang5[toID(name)])==null?void 0:_BattleText$lang5.name)||((_BattleText$en5=BattleText.en)==null||(_BattleText$en5=_BattleText$en5.Tags)==null||(_BattleText$en5=_BattleText$en5[toID(name)])==null?void 0:_BattleText$en5.name)||name);},
genderName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('GenderNames',name,lang);},
eggGroupName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('EggGroupNames',name,lang);},
colorName:function(name){var lang=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();return getOtherName('ColorNames',name,lang);}
};this.
moves={
get:function(name){
var id=toID(name);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(_this3.cache.Moves.hasOwnProperty(id))return _this3.cache.Moves[id];

var data=Object.assign({},Dex.moves.get(name));

for(var i=Dex.gen-1;i>=_this3.gen;i--){
var table=window.BattleTeambuilderTable["gen"+i];
if(id in table.overrideMoveData){
Object.assign(data,table.overrideMoveData[id]);
}
}
if(_this3.modid!=="gen"+_this3.gen){
var _table=window.BattleTeambuilderTable[_this3.modid];
if(id in _table.overrideMoveData){
Object.assign(data,_table.overrideMoveData[id]);
}
}
if(_this3.gen<=3&&data.category!=='Status'){
data.category=Dex.getGen3Category(data.type);
}

var move=new Move(id,name,data);
_this3.cache.Moves[id]=move;
return move;
}
};this.

items={
get:function(name){
var id=toID(name);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(_this3.cache.Items.hasOwnProperty(id))return _this3.cache.Items[id];

var data=Object.assign({},Dex.items.get(name));

for(var i=Dex.gen-1;i>=_this3.gen;i--){
var table=window.BattleTeambuilderTable["gen"+i];
if(id in table.overrideItemData){
Object.assign(data,table.overrideItemData[id]);
}
}
if(_this3.modid!=="gen"+_this3.gen){
var _table2=window.BattleTeambuilderTable[_this3.modid];
if(id in _table2.overrideItemData){
Object.assign(data,_table2.overrideItemData[id]);
}
}

var item=new Item(id,name,data);
_this3.cache.Items[id]=item;
return item;
}
};this.

abilities={
get:function(name){
var id=toID(name);
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
if(_this3.cache.Abilities.hasOwnProperty(id))return _this3.cache.Abilities[id];

var data=Object.assign({},Dex.abilities.get(name));

for(var i=Dex.gen-1;i>=_this3.gen;i--){
var table=window.BattleTeambuilderTable["gen"+i];
if(id in table.overrideAbilityData){
Object.assign(data,table.overrideAbilityData[id]);
}
}
if(_this3.modid!=="gen"+_this3.gen){
var _table3=window.BattleTeambuilderTable[_this3.modid];
if(id in _table3.overrideAbilityData){
Object.assign(data,_table3.overrideAbilityData[id]);
}
}

var ability=new Ability(id,name,data);
_this3.cache.Abilities[id]=ability;
return ability;
}
};this.

species={
get:function(name){var _data$evos;
var id=toID(name);
var originalId=id;
if(window.BattleAliases&&id in BattleAliases){
name=BattleAliases[id];
id=toID(name);
}
var baseSpecies=Dex.species.get(originalId||name);
id=baseSpecies.id;
if(_this3.cache.Species.hasOwnProperty(id))return _this3.cache.Species[id];

var data=Object.assign({},baseSpecies);

for(var i=Dex.gen-1;i>=_this3.gen;i--){
var _table4=window.BattleTeambuilderTable["gen"+i];
if(id in _table4.overrideSpeciesData){
Object.assign(data,_table4.overrideSpeciesData[id]);
}
}
if(_this3.modid!=="gen"+_this3.gen){
var _table5=window.BattleTeambuilderTable[_this3.modid];
if(id in _table5.overrideSpeciesData){
Object.assign(data,_table5.overrideSpeciesData[id]);
}
}
if(_this3.gen<3||_this3.modid==='gen7letsgo'){
data.abilities={0:"No Ability"};
}

var table=window.BattleTeambuilderTable[_this3.modid];
if(id in table.overrideTier)data.tier=table.overrideTier[id];
if(!data.tier&&id.endsWith('totem')){
data.tier=_this3.species.get(id.slice(0,-5)).tier;
}
if(!data.tier&&data.baseSpecies&&toID(data.baseSpecies)!==id){
data.tier=_this3.species.get(data.baseSpecies).tier;
}
if(data.gen>_this3.gen)data.tier='Illegal';
data.nfe=data.id==='dipplin'||!!((_data$evos=data.evos)!=null&&_data$evos.some(function(evo){
var evoSpecies=_this3.species.get(evo);
return!evoSpecies.isNonstandard||evoSpecies.isNonstandard===data.isNonstandard||

evoSpecies.isNonstandard==="Unobtainable";
}));

var species=new Species(id,name,data);
_this3.cache.Species[id]=species;
return species;
}
};this.

types={
namesCache:null,
names:function(){
if(_this3.types.namesCache)return _this3.types.namesCache;
var names=Dex.types.names();
if(!names.length)return[];
var curNames=[].concat(names);

if(_this3.gen<6)curNames.splice(curNames.indexOf('Fairy'),1);
if(_this3.gen<2)curNames.splice(curNames.indexOf('Dark'),1);
if(_this3.gen<2)curNames.splice(curNames.indexOf('Steel'),1);
_this3.types.namesCache=curNames;
return curNames;
},
get:function(name){
var id=toID(name);
name=id.substr(0,1).toUpperCase()+id.substr(1);

if(_this3.cache.Types.hasOwnProperty(id))return _this3.cache.Types[id];

var data=Object.assign({},Dex.types.get(name));

for(var i=7;i>=_this3.gen;i--){
var table=window.BattleTeambuilderTable["gen"+i];
if(id in table.removeType){
data.exists=false;

break;
}
if(id in table.overrideTypeChart){
data=Object.assign({},data,table.overrideTypeChart[id]);
}
}

_this3.cache.Types[id]=data;
return data;
}
};this.modid=modid;var gen=parseInt(modid.charAt(3),10);if(this.modid==='champions')gen=9;if(modid!=='champions'&&!modid.startsWith('gen')||!gen)throw new Error("Unsupported modid");this.gen=gen;}var _proto3=ModdedDex.prototype;_proto3.

getPokeballs=function getPokeballs(){var _window2;
if(this.pokeballs)return this.pokeballs;
this.pokeballs=[];
(_window2=window).BattleItems||(_window2.BattleItems={});for(var _i23=0,_Object$values4=
Object.values(BattleItems);_i23<_Object$values4.length;_i23++){var data=_Object$values4[_i23];
if(data.gen&&data.gen>this.gen)continue;
if(!data.isPokeball)continue;
this.pokeballs.push(data.name);
}
return this.pokeballs;
};return ModdedDex;}();


if(typeof require==='function'){

global.Dex=Dex;
global.TL=TL;
global.toID=toID;
}
//# sourceMappingURL=battle-dex.js.map