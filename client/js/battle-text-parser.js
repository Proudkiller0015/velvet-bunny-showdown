"use strict";function _readOnlyError(r){throw new TypeError('"'+r+'" is read-only');}/**
 * Text parser
 *
 * No dependencies
 * Optional dependency: BattleText
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */var















BattleTextParser=function(){











function BattleTextParser(){var perspective=arguments.length>0&&arguments[0]!==undefined?arguments[0]:'p1';var language=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();this.p1="Player 1";this.p2="Player 2";this.p3="Player 3";this.p4="Player 4";this.perspective=void 0;this.language=void 0;this.gen=9;this.turn=0;this.curLineSection='break';this.lowercaseRegExp=undefined;this.









































































































































































































































































































































































































































































































































pokemonName=function(pokemon){
if(!pokemon)return'';
if(!pokemon.startsWith('p'))return"???pokemon:"+pokemon+"???";
if(pokemon.charAt(3)===':')return pokemon.slice(4).trim();else
if(pokemon.charAt(2)===':')return pokemon.slice(3).trim();
return"???pokemon:"+pokemon+"???";
};this.perspective=perspective;this.language=language;Dex.loadTextData(language);}BattleTextParser.parseLine=function parseLine(line,noDefault){if(!line.startsWith('|')){return['',line];}if(line==='|'){return['done'];}var index=line.indexOf('|',1);var cmd=line.slice(1,index);switch(cmd){case'chatmsg':case'chatmsg-raw':case'raw':case'error':case'html':case'inactive':case'inactiveoff':case'warning':case'fieldhtml':case'controlshtml':case'pagehtml':case'bigerror':case'debug':case'tier':case'challstr':case'customgroups':case'popup':case'':return[cmd,line.slice(index+1)];case'c':case'chat':case'uhtml':case'uhtmlchange':case'queryresponse':case'showteam':var index2a=line.indexOf('|',index+1);return[cmd,line.slice(index+1,index2a),line.slice(index2a+1)];case'c:':case'pm':var index2b=line.indexOf('|',index+1);var index3b=line.indexOf('|',index2b+1);return[cmd,line.slice(index+1,index2b),line.slice(index2b+1,index3b),line.slice(index3b+1)];}if(noDefault)return null;return line.slice(1).split('|');};BattleTextParser.parseBattleLine=function parseBattleLine(line){var args=this.parseLine(line,true);if(args)return{args:args,kwArgs:{}};args=line.slice(1).split('|');var kwArgs={};while(args.length>1){var lastArg=args[args.length-1];if(!lastArg.startsWith('['))break;var bracketPos=lastArg.indexOf(']');if(bracketPos<=0)break;kwArgs[lastArg.slice(1,bracketPos)]=lastArg.slice(bracketPos+1).trim()||'.';args.pop();}return BattleTextParser.upgradeArgs({args:args,kwArgs:kwArgs});};BattleTextParser.parseNameParts=function parseNameParts(text){var group='';if(!/[A-Za-z0-9]/.test(text.charAt(0))){group=text.charAt(0);text=text.slice(1);}var name=text;var atIndex=text.indexOf('@');var status='';var away=false;if(atIndex>0){name=text.slice(0,atIndex);status=text.slice(atIndex+1);if(status.startsWith('!')){away=true;status=status.slice(1);}}return{group:group,name:name,away:away,status:status};};BattleTextParser.upgradeArgs=function upgradeArgs(_ref){var args=_ref.args,kwArgs=_ref.kwArgs;switch(args[0]){case'-activate':{if(kwArgs.item||kwArgs.move||kwArgs.number||kwArgs.ability)return{args:args,kwArgs:kwArgs};var _args=args,pokemon=_args[1],effect=_args[2],arg3=_args[3],arg4=_args[4];var target=kwArgs.of;var id=BattleTextParser.effectId(effect);if(kwArgs.block)return{args:['-fail',pokemon],kwArgs:kwArgs};if(id==='wonderguard')return{args:['-immune',pokemon],kwArgs:{from:'ability:Wonder Guard'}};if(id==='beatup'&&kwArgs.of)return{args:args,kwArgs:{name:kwArgs.of}};if(['ingrain','quickguard','wideguard','craftyshield','matblock','protect','mist','safeguard','electricterrain','mistyterrain','psychicterrain','telepathy','stickyhold','suctioncups','aromaveil','flowerveil','sweetveil','disguise','safetygoggles','protectivepads'].includes(id)){if(target){kwArgs.of=pokemon;return{args:['-block',target,effect,arg3],kwArgs:kwArgs};}return{args:['-block',pokemon,effect,arg3],kwArgs:kwArgs};}if(id==='charge'){return{args:['-singlemove',pokemon,effect],kwArgs:{of:target}};}if(['bind','wrap','clamp','whirlpool','firespin','magmastorm','sandtomb','infestation','snaptrap','thundercage','trapped'].includes(id)){return{args:['-start',pokemon,effect],kwArgs:{of:target}};}if(id==='fairylock'){return{args:['-fieldactivate',effect],kwArgs:{}};}if(id==='symbiosis'||id==='poltergeist'){kwArgs.item=arg3;}else if(id==='magnitude'){kwArgs.number=arg3;}else if(id==='skillswap'||id==='mummy'||id==='lingeringaroma'||id==='wanderingspirit'){kwArgs.ability=arg3;kwArgs.ability2=arg4;}else if(['eeriespell','gmaxdepletion','spite','grudge','forewarn','sketch','leppaberry','mysteryberry'].includes(id)){kwArgs.move=arg3;kwArgs.number=arg4;}args=['-activate',pokemon,effect,target||''];break;}case'-fail':{var _args2=args,_pokemon2=_args2[1],_effect2=_args2[2],_arg=_args2[3];if(kwArgs.from==='ability: Flower Veil'){return{args:['-block',kwArgs.of,'ability: Flower Veil'],kwArgs:{of:args[1]}};}if(_effect2==='unboost'&&_arg){var statMap={'Attack':'atk','Defense':'def','Special Attack':'spa','Special Defense':'spd','Speed':'spe'};if(statMap[_arg])args[3]=statMap[_arg];}break;}case'-start':{if(kwArgs.from==='Protean'||kwArgs.from==='Color Change')kwArgs.from='ability:'+kwArgs.from;break;}case'move':{if(kwArgs.from==='Magic Bounce')kwArgs.from='ability:Magic Bounce';break;}case'cant':{var _args3=args,_pokemon3=_args3[1],_effect3=_args3[2],move=_args3[3];if(['ability: Damp','ability: Dazzling','ability: Queenly Majesty','ability: Armor Tail'].includes(_effect3)){args[0]='-block';return{args:['-block',_pokemon3,_effect3,move,kwArgs.of],kwArgs:{}};}break;}case'-heal':{var _id=BattleTextParser.effectId(kwArgs.from);if(['dryskin','eartheater','voltabsorb','waterabsorb'].includes(_id))kwArgs.of='';break;}case'-restoreboost':{args[0]='-clearnegativeboost';break;}case'-weather':{if(args[1]==='Snow')args[1]='Snowscape';break;}case'-ability':{if(args[3]&&(args[3].startsWith('p1')||args[3].startsWith('p2')||args[3]==='boost')){args[4]=args[3];args[3]='';}break;}case'-nothing':return{args:['-activate','','move:Splash'],kwArgs:kwArgs};}return{args:args,kwArgs:kwArgs};};var _proto=BattleTextParser.prototype;_proto.extractMessage=function extractMessage(buf){var out='';for(var _i2=0,_buf$split2=buf.split('\n');_i2<_buf$split2.length;_i2++){var _line=_buf$split2[_i2];var _BattleTextParser$par=BattleTextParser.parseBattleLine(_line),args=_BattleTextParser$par.args,kwArgs=_BattleTextParser$par.kwArgs;out+=this.parseArgs(args,kwArgs)||'';}return out;};_proto.textField=function textField(table,id,field){var _BattleText$en,_BattleText$this$lang;var english=(_BattleText$en=BattleText.en)==null||(_BattleText$en=_BattleText$en[table])==null?void 0:_BattleText$en[id];var localized=(_BattleText$this$lang=BattleText[this.language])==null||(_BattleText$this$lang=_BattleText$this$lang[table])==null?void 0:_BattleText$this$lang[id];var value=(localized==null?void 0:localized[field])||(english==null?void 0:english[field]);for(var i=Dex.gen-1;i>=this.gen;i--){var genName="gen"+i;var englishGen=english==null?void 0:english[genName];var localizedGen=localized==null?void 0:localized[genName];if(localizedGen&&typeof localizedGen==='object'&&localizedGen[field])value=localizedGen[field];else if(englishGen&&typeof englishGen==='object'&&englishGen[field])value=englishGen[field];}return typeof value==='string'?value:'';};_proto.defaultText=function defaultText(field){return this.textField('Default','default',field);};_proto.uiText=function uiText(field,values){var template=this.textField('Default','ui',field);if(!template)return'';return this.render(template,values);};BattleTextParser.defaultText=function defaultText(field,values){var parser=BattleTextParser.uiParser||(BattleTextParser.uiParser=new BattleTextParser());parser.language=Dex.text.getLanguage();return parser.render(parser.defaultText(field),values);};BattleTextParser.ui=function ui(field,values){var parser=BattleTextParser.uiParser||(BattleTextParser.uiParser=new BattleTextParser());parser.language=Dex.text.getLanguage();return parser.uiText(field,values);};BattleTextParser.weatherName=function weatherName(weather){var language=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();var parser=BattleTextParser.uiParser||(BattleTextParser.uiParser=new BattleTextParser());parser.language=language;return parser.textField('Default',BattleTextParser.effectId(weather),'weatherName')||weather;};_proto.render=function render(template){var _this=this;var values=arguments.length>1&&arguments[1]!==undefined?arguments[1]:{};var categories={};var text=template.replace(/\{([A-Z][A-Z0-9]*)(?::([a-z]+(?::[a-z]+)*))?\}/g,function(match,placeholder,modifierText){var value=values[placeholder];if(value===undefined)return match;return _this.resolveRenderValue(placeholder,value,modifierText?modifierText.split(':'):[],categories);});return BattleTextParser.inflect(text,categories);};_proto.resolveRenderValue=function resolveRenderValue(placeholder,source,modifiers,categories){var value=typeof source==='string'?source:source.value;var category=typeof source==='string'?'ms':source.category||'ms';var articleRule='';if(typeof source!=='string'&&source.table&&source.id){var _BattleText$this$lang2,_BattleText$en2,_form,_form2,_form3;var entry=((_BattleText$this$lang2=BattleText[this.language])==null||(_BattleText$this$lang2=_BattleText$this$lang2[source.table])==null?void 0:_BattleText$this$lang2[source.id])||((_BattleText$en2=BattleText.en)==null||(_BattleText$en2=_BattleText$en2[source.table])==null?void 0:_BattleText$en2[source.id])||undefined;var form=entry;if(modifiers.includes('classified')&&entry!=null&&entry.classified&&typeof entry.classified==='object'){form=entry.classified;}value=typeof((_form=form)==null?void 0:_form.name)==='string'?form.name:value;category=typeof((_form2=form)==null?void 0:_form2.grammar)==='string'?form.grammar:category;articleRule=typeof((_form3=form)==null?void 0:_form3.articleRule)==='string'?form.articleRule:'';}categories[placeholder]=category;return BattleTextParser.modify(value,modifiers,this.language,category,articleRule);};_proto.fixLowercase=function fixLowercase(input){var _this2=this;if(this.lowercaseRegExp===undefined){var prefixes=['pokemon','opposingPokemon','team','opposingTeam','party','opposingParty'].map(function(templateId){var template=_this2.defaultText(templateId);if(template.startsWith(template.charAt(0).toUpperCase()))return'';var braceIndex=template.indexOf('{');if(braceIndex>=0)return template.slice(0,braceIndex);return template;}).filter(function(prefix){return prefix;});if(prefixes.length){var buf="((?:^|\n)(?:  |  \\(|\\[|\\{)?)("+prefixes.map(BattleTextParser.escapeRegExp).join('|')+")";this.lowercaseRegExp=new RegExp(buf,'g');}else{this.lowercaseRegExp=null;}}if(!this.lowercaseRegExp)return input;return input.replace(this.lowercaseRegExp,function(match,p1,p2){return p1+p2.charAt(0).toUpperCase()+p2.slice(1);});};BattleTextParser.escapeRegExp=function escapeRegExp(input){return input.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');};BattleTextParser.escapeReplace=function escapeReplace(input){return input.replace(/\$/g,'$$$$');};BattleTextParser.inflect=function inflect(template,categories){return template.replace(/\{INFLECT:([A-Z][A-Z0-9]*):((?:\\.|[^}\\])*)\}/g,function(match,placeholder,source){var category=categories[placeholder];if(!category)return match;var grammarCategory=/^[mfn][sup]$/.test(category);var normalizedCategory=grammarCategory&&category.endsWith('u')?category.charAt(0)+'s':category;var categoryFallback=grammarCategory?category.endsWith('p')?'p':'s':'';var fields=[];var field='';for(var i=0;i<source.length;i++){if(source.charAt(i)==='\\'&&i+1<source.length){field+=source.charAt(i)+source.charAt(++i);}else if(source.charAt(i)===':'){fields.push(field);field='';}else{field+=source.charAt(i);}}fields.push(field);for(var _i4=0;_i4<fields.length;_i4++){var candidate=fields[_i4];var equalsIndex=-1;for(var _i5=0;_i5<candidate.length;_i5++){if(candidate.charAt(_i5)==='\\'){_i5++;}else if(candidate.charAt(_i5)==='='){equalsIndex=_i5;break;}}if(equalsIndex<0||![normalizedCategory,categoryFallback].includes(candidate.slice(0,equalsIndex)))continue;return candidate.slice(equalsIndex+1).replace(/\\(.)/g,'$1');}return match;});};BattleTextParser.modify=function modify(value,modifiers,language){var category=arguments.length>3&&arguments[3]!==undefined?arguments[3]:'ms';var articleRule=arguments.length>4&&arguments[4]!==undefined?arguments[4]:'';var knownModifiers=['definite','indefinite','nominative','accusative','singular','plural','masculine','capitalize','classified','a','de','di','su','e','y','topic','object','subject','conjunctive','directional'];for(var _i7=0;_i7<modifiers.length;_i7++){var modifier=modifiers[_i7];if(!knownModifiers.includes(modifier))return value;}var has=function(modifier){return modifiers.includes(modifier);};var plural=category.endsWith('p');var uncountable=category.endsWith('u');var feminine=category.startsWith('f');var neuter=category.startsWith('n');if(has('singular'))plural=false;if(has('plural'))plural=true;if(has('masculine'))feminine=neuter=false;var initial=this.grammarInitial(value);var vowel=/^[aeiouà-æè-ïò-öù-ü]/i.test(initial);var prefix='';if(language==='fr'){var article='';var lead=(has('a')||has('de'))&&!has('definite')&&!has('indefinite')&&/^(\*\*)?(le |la |les |l’)/i.exec(value);if(lead){article=lead[2].toLowerCase();value=(lead[1]||'')+value.slice(lead[0].length);}else if(has('definite')){article=plural?'les ':vowel?'l’':feminine?'la ':'le ';}else if(has('indefinite')){article=uncountable?'':plural?'des ':feminine?'une ':'un ';}if(has('a')){if(article==='le ')prefix='au ';else if(article==='les ')prefix='aux ';else prefix='à '+article;}else if(has('de')){if(article==='le ')prefix='du ';else if(article==='les ')prefix='des ';else if(article)prefix='de '+article;else prefix=vowel||/^h/i.test(initial)?'d’':'de ';}else{prefix=article;}}else if(language==='es'){var articleFeminine=feminine&&articleRule!=='stressed-a';var _article='';var _lead=(has('a')||has('de'))&&!has('definite')&&!has('indefinite')&&/^(\*\*)?(el |la |los |las )/i.exec(value);if(_lead){_article=_lead[2].toLowerCase();value=(_lead[1]||'')+value.slice(_lead[0].length);}else if(has('definite'))_article=plural?feminine?'las ':'los ':articleFeminine?'la ':'el ';else if(has('indefinite')){_article=uncountable?'':plural?feminine?'unas ':'unos ':articleFeminine?'una ':'un ';}if(has('a'))prefix=_article==='el '?'al ':'a '+_article;else if(has('de'))prefix=_article==='el '?'del ':'de '+_article;else prefix=_article;if(has('y'))prefix=/^(?:i|hi)(?![aeou])/i.test(initial)?'e ':'y ';}else if(language==='it'){var special=/^(?:s[^aeiouàèéìòù]|z|gn|ps|pn|x|y)/i.test(initial);var _article2='';var hasDefinite=has('definite');var _lead2=(has('a')||has('di')||has('su'))&&!has('definite')&&!has('indefinite')&&/^(\*\*)?(il |lo |la |i |gli |le |l’)/i.exec(value);if(_lead2){_article2=_lead2[2].toLowerCase();value=(_lead2[1]||'')+value.slice(_lead2[0].length);hasDefinite=true;}else if(has('definite')){if(plural)_article2=feminine?'le ':vowel||special?'gli ':'i ';else if(vowel)_article2='l’';else _article2=feminine?'la ':special?'lo ':'il ';}else if(has('indefinite')){if(uncountable)_article2=feminine?vowel?'dell’':'della ':vowel?'dell’':special?'dello ':'del ';else if(feminine)_article2=vowel?'un’':'una ';else _article2=special?'uno ':'un ';}if(has('a')&&hasDefinite){prefix=this.italianContraction(_article2,['al ','allo ','all’','alla ','ai ','agli ','alle ']);}else if(has('di')&&hasDefinite){prefix=this.italianContraction(_article2,['del ','dello ','dell’','della ','dei ','degli ','delle ']);}else if(has('su')&&hasDefinite){prefix=this.italianContraction(_article2,['sul ','sullo ','sull’','sulla ','sui ','sugli ','sulle ']);}else if(has('a')){prefix=vowel?'ad ':'a ';}else if(has('di')){prefix=vowel?'d’':'di ';}else if(has('su')){prefix='su ';}else if(has('e')){prefix=vowel?'ed ':'e ';}else{prefix=_article2;}}else if(language==='de'){var accusative=has('accusative');if(has('definite')){prefix=plural?'die ':feminine?'die ':neuter?'das ':accusative?'den ':'der ';}else if(has('indefinite')){prefix=uncountable?'':feminine?'eine ':neuter?'ein ':accusative?'einen ':'ein ';}}else if(language==='ko'){var jong=this.koreanJongseong(value);if(has('topic'))value+=jong?'은':'는';else if(has('object'))value+=jong?'을':'를';else if(has('subject'))value+=jong?'이':'가';else if(has('conjunctive'))value+=jong?'과':'와';else if(has('directional'))value+=jong&&jong!==8?'으로':'로';}value=prefix+value;if(has('capitalize')){for(var i=0;i<value.length;i++){var letter=value.charAt(i);if(letter.toUpperCase()===letter.toLowerCase())continue;value=value.slice(0,i)+letter.toUpperCase()+value.slice(i+1);break;}}return value;};BattleTextParser.grammarInitial=function grammarInitial(value){return value.replace(/\*\*/g,'').replace(/^[^A-Za-zÀ-ɏ0-9ㄱ-힣]+/,'');};BattleTextParser.italianContraction=function italianContraction(article,forms){var articles=['il ','lo ','l’','la ','i ','gli ','le '];var index=articles.indexOf(article);return index<0?forms[0]:forms[index];};BattleTextParser.koreanJongseong=function koreanJongseong(value){var text=value.replace(/\*\*/g,'').replace(/[^A-Za-z0-9가-힣]+$/g,'');if(!text)return 0;var code=text.charCodeAt(text.length-1);if(code>=0xAC00&&code<=0xD7A3)return(code-0xAC00)%28;if(code>=0x30&&code<=0x39)return[1,8,0,1,0,0,1,8,8,0][code-0x30];return /[lmnr]$/i.test(text)?8:0;};_proto.

pokemon=function pokemon(_pokemon){
if(!_pokemon)return'';
var side=_pokemon.slice(0,2);
if(!['p1','p2','p3','p4'].includes(side))return"???pokemon:"+_pokemon+"???";
var name=this.pokemonName(_pokemon);
var isNear=side===this.perspective||side===BattleTextParser.allyID(side);
var template=this.defaultText(isNear?'pokemon':'opposingPokemon');
return this.render(template,{NICKNAME:name});
};_proto.

pokemonFull=function pokemonFull(pokemon,details){
var nickname=this.pokemonName(pokemon);

var species=details.split(',')[0];
var localizedSpecies=this.speciesName(species);
if(nickname===localizedSpecies)return[pokemon.slice(0,2),"**"+localizedSpecies+"**"];
var template=this.defaultText('fullName')||'{NICKNAME} ({SPECIES})';
return[pokemon.slice(0,2),this.render(template,{
NICKNAME:nickname,
SPECIES:"**"+localizedSpecies+"**"
})];
};_proto.

trainer=function trainer(side){
side=side.slice(0,2);
if(side==='p1')return this.p1;
if(side==='p2')return this.p2;
if(side==='p3')return this.p3;
if(side==='p4')return this.p4;
return"???side:"+side+"???";
};BattleTextParser.

allyID=function allyID(sideid){
if(sideid==='p1')return'p3';
if(sideid==='p2')return'p4';
if(sideid==='p3')return'p1';
if(sideid==='p4')return'p2';
return'';
};_proto.

team=function team(side){var isFar=arguments.length>1&&arguments[1]!==undefined?arguments[1]:false;
side=side.slice(0,2);
if(side===this.perspective||side===BattleTextParser.allyID(side)){
return this.defaultText(!isFar?'team':'opposingTeam');
}
return this.defaultText(isFar?'team':'opposingTeam');
};_proto.

own=function own(side){
side=side.slice(0,2);
if(side===this.perspective){
return'OWN';
}
return'';
};_proto.

party=function party(side){
side=side.slice(0,2);
if(side===this.perspective||side===BattleTextParser.allyID(side)){
return this.defaultText('party');
}
return this.defaultText('opposingParty');
};BattleTextParser.

effectId=function effectId(effect){
if(!effect)return'';
if(effect.startsWith('item:')||effect.startsWith('move:')){
effect=effect.slice(5);
}else if(effect.startsWith('ability:')){
effect=effect.slice(8);
}
return toID(effect);
};_proto.

effect=function effect(_effect){
if(!_effect)return'';
if(_effect.startsWith('item:'))return this.itemValue(_effect.slice(5));
if(_effect.startsWith('move:'))return this.moveName(_effect.slice(5));
if(_effect.startsWith('ability:'))return this.abilityName(_effect.slice(8));
return _effect.trim();
};_proto.

textName=function textName(table,name){var _BattleText$this$lang3,_BattleText$en3;
if(!name)return'';
name=name.trim();
var id=toID(name);
var localized=(_BattleText$this$lang3=BattleText[this.language])==null||(_BattleText$this$lang3=_BattleText$this$lang3[table])==null||(_BattleText$this$lang3=_BattleText$this$lang3[id])==null?void 0:_BattleText$this$lang3.name;
var english=(_BattleText$en3=BattleText.en)==null||(_BattleText$en3=_BattleText$en3[table])==null||(_BattleText$en3=_BattleText$en3[id])==null?void 0:_BattleText$en3.name;
var translated=localized||english;
return typeof translated==='string'?translated:name;
};_proto.

moveName=function moveName(name){
return this.textName('Moves',name);
};_proto.
itemName=function itemName(name){
return this.textName('Items',name);
};_proto.
itemValue=function itemValue(name){
return{value:this.itemName(name),table:'Items',id:toID(name)};
};_proto.
abilityName=function abilityName(name){
return this.textName('Abilities',name);
};_proto.
speciesName=function speciesName(name){
if(!name)return'';
name=name.trim();
return Dex.text.get(Dex.species.get(name),this.language).name||name;
};_proto.

template=function template(type){for(var _len=arguments.length,namespaces=new Array(_len>1?_len-1:0),_key=1;_key<_len;_key++){namespaces[_key-1]=arguments[_key];}for(var _i9=0;_i9<
namespaces.length;_i9++){var namespace=namespaces[_i9];
if(!namespace)continue;
if(namespace==='OWN'){
return this.defaultText(type+'Own')+'\n';
}
if(namespace==='NODEFAULT'){
return'';
}
var id=BattleTextParser.effectId(namespace);
var tables=void 0;
if(namespace.startsWith('item:'))tables=['Items','Default'];else
if(namespace.startsWith('ability:'))tables=['Abilities','Default'];else
if(namespace.startsWith('move:'))tables=['Moves','Default'];else
tables=['Items','Abilities','Moves','Default'];for(var _i11=0,_tables2=
tables;_i11<_tables2.length;_i11++){var table=_tables2[_i11];
var _template=this.textField(table,id,type);
if(!_template)continue;
if(_template.charAt(1)==='.'){
type=_template.slice(2);
_template=this.textField(table,id,type);
}
if(_template.startsWith('#')){
id=_template.slice(1);
_template=this.textField(table,id,type);
}
return _template?_template+'\n':'';
}
}
var template=this.defaultText(type);
if(!template)return'';
return template+'\n';
};_proto.

maybeAbility=function maybeAbility(effect,holder){
if(!effect)return'';
if(!effect.startsWith('ability:'))return'';
return this.ability(effect.slice(8).trim(),holder);
};_proto.

ability=function ability(name,holder){
if(!name)return'';
return this.render(this.defaultText('abilityActivation'),{
POKEMON:this.pokemon(holder),
ABILITY:this.abilityName(name)
})+'\n';
};BattleTextParser.

stat=function stat(_stat){var _BattleText$language,_BattleText$en4;var language=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();
var id=_stat||'stats';
var name=((_BattleText$language=BattleText[language])==null||(_BattleText$language=_BattleText$language.StatNames)==null?void 0:_BattleText$language[id])||((_BattleText$en4=BattleText.en)==null||(_BattleText$en4=_BattleText$en4.StatNames)==null?void 0:_BattleText$en4[id]);
return typeof name==='string'?name:"???stat:"+_stat+"???";
};BattleTextParser.
statMediumName=function statMediumName(stat){var _BattleText$language2,_BattleText$en5;var language=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();
var name=((_BattleText$language2=BattleText[language])==null||(_BattleText$language2=_BattleText$language2.StatMediumNames)==null?void 0:_BattleText$language2[stat])||((_BattleText$en5=BattleText.en)==null||(_BattleText$en5=_BattleText$en5.StatMediumNames)==null?void 0:_BattleText$en5[stat]);
return typeof name==='string'?name:"???stat:"+stat+"???";
};BattleTextParser.
statShortName=function statShortName(stat){var _BattleText$language3,_BattleText$en6;var language=arguments.length>1&&arguments[1]!==undefined?arguments[1]:Dex.text.getLanguage();
var name=((_BattleText$language3=BattleText[language])==null||(_BattleText$language3=_BattleText$language3.StatShortNames)==null?void 0:_BattleText$language3[stat])||((_BattleText$en6=BattleText.en)==null||(_BattleText$en6=_BattleText$en6.StatShortNames)==null?void 0:_BattleText$en6[stat]);
return typeof name==='string'?name:"???stat:"+stat+"???";
};_proto.
statValue=function statValue(stat){var _BattleText$this$lang4,_BattleText$en7;
var id=stat||'stats';
var grammar=((_BattleText$this$lang4=BattleText[this.language])==null||(_BattleText$this$lang4=_BattleText$this$lang4.StatNames)==null?void 0:_BattleText$this$lang4[id+":grammar"])||((_BattleText$en7=
BattleText.en)==null||(_BattleText$en7=_BattleText$en7.StatNames)==null?void 0:_BattleText$en7[id+":grammar"]);
return{
value:BattleTextParser.stat(stat,this.language),
category:grammar||(stat?'s':'p')
};
};_proto.

lineSection=function lineSection(args,kwArgs){
if(kwArgs.premajor)return'preMajor';
if(kwArgs.postmajor)return'postMajor';
if(kwArgs.major)return'major';

var cmd=args[0];
switch(cmd){
case'done':case'turn':
return'break';
case'move':case'cant':case'switch':case'drag':case'upkeep':case'start':
case'-mega':case'-candynamax':case'-terastallize':
return'major';
case'switchout':case'faint':
return'preMajor';
case'-zpower':
return'postMajor';
case'-damage':{
var id=BattleTextParser.effectId(kwArgs.from);
if(id==='confusion')return'major';
return'postMajor';
}
case'-curestatus':{
var _id2=BattleTextParser.effectId(kwArgs.from);
if(_id2==='naturalcure')return'preMajor';
return'postMajor';
}
case'-start':{
var _id3=BattleTextParser.effectId(kwArgs.from);
if(_id3==='protean')return'preMajor';
return'postMajor';
}
case'-activate':{
var _id4=BattleTextParser.effectId(args[2]);
if(_id4==='confusion'||_id4==='attract'||_id4==='pursuit')return'preMajor';
return'postMajor';
}
}
return cmd.startsWith('-')?'postMajor':'';
};_proto.

sectionBreak=function sectionBreak(args,kwArgs){
var prevSection=this.curLineSection;
var curSection=this.lineSection(args,kwArgs);
if(!curSection)return false;
this.curLineSection=curSection;
switch(curSection){
case'break':
if(prevSection!=='break')return true;
return false;
case'preMajor':
case'major':
if(prevSection==='postMajor'||prevSection==='major')return true;
return false;
case'postMajor':
return false;
}
};_proto.

parseArgs=function parseArgs(args,kwArgs,noSectionBreak){
var buf=!noSectionBreak&&this.sectionBreak(args,kwArgs)?'\n':'';
return buf+this.fixLowercase(this.parseArgsInner(args,kwArgs)||'');
};_proto.

parseArgsInner=function parseArgsInner(args,kwArgs){
var cmd=args[0];
switch(cmd){
case'player':{
var side=args[1],name=args[2];
if(side==='p1'&&name){
this.p1=name;
}else if(side==='p2'&&name){
this.p2=name;
}else if(side==='p3'&&name){
this.p3=name;
}else if(side==='p4'&&name){
this.p4=name;
}
return'';
}

case'gen':{
var num=args[1];
this.gen=parseInt(num,10);
return'';
}

case'turn':{
var _num=args[1];
this.turn=Number.parseInt(_num,10);
return this.render(this.template('turn'),{NUMBER:_num})+'\n';
}

case'start':{
return this.render(this.template('startBattle'),{TRAINER1:this.p1,TRAINER2:this.p2});
}

case'win':case'tie':{
var _name=args[1];
if(cmd==='tie'||!_name){
return this.render(this.template('tieBattle'),{TRAINER1:this.p1,TRAINER2:this.p2});
}
return this.render(this.template('winBattle'),{TRAINER:_name});
}

case'switch':{
var pokemon=args[1],details=args[2];
var _this$pokemonFull=this.pokemonFull(pokemon,details),_side=_this$pokemonFull[0],fullname=_this$pokemonFull[1];
var template=this.template('switchIn',this.own(_side));
return this.render(template,{TRAINER:this.trainer(_side),FULLNAME:fullname});
}

case'drag':{
var _pokemon4=args[1],_details=args[2];
var _this$pokemonFull2=this.pokemonFull(_pokemon4,_details),_side2=_this$pokemonFull2[0],_fullname=_this$pokemonFull2[1];
var _template2=this.template('drag');
return this.render(_template2,{TRAINER:this.trainer(_side2),FULLNAME:_fullname});
}

case'detailschange':case'-transform':case'-formechange':{
var _pokemon5=args[1],arg2=args[2],arg3=args[3];
var newSpecies='';
switch(cmd){
case'detailschange':newSpecies=arg2.split(',')[0].trim();break;
case'-transform':newSpecies=arg3;break;
case'-formechange':newSpecies=arg2;break;
}
var newSpeciesId=toID(newSpecies);
var id='';
var templateName='transform';
if(cmd!=='-transform'){
switch(newSpeciesId){
case'greninjaash':id='battlebond';break;
case'mimikyubusted':id='disguise';break;
case'zygardecomplete':id='powerconstruct';break;
case'necrozmaultra':id='ultranecroziumz';break;
case'darmanitanzen':id='zenmode';break;
case'darmanitan':id='zenmode';templateName='transformEnd';break;
case'darmanitangalarzen':id='zenmode';break;
case'darmanitangalar':id='zenmode';templateName='transformEnd';break;
case'aegislashblade':id='stancechange';break;
case'aegislash':id='stancechange';templateName='transformEnd';break;
case'wishiwashischool':id='schooling';break;
case'wishiwashi':id='schooling';templateName='transformEnd';break;
case'miniormeteor':id='shieldsdown';break;
case'minior':id='shieldsdown';templateName='transformEnd';break;
case'eiscuenoice':id='iceface';break;
case'eiscue':id='iceface';templateName='transformEnd';break;
case'terapagosterastal':id='terashift';break;
}
}else if(newSpecies){
id='transform';
}
var _template3=this.template(templateName,id,kwArgs.msg?'':'NODEFAULT');
var line1=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon5);
return line1+this.render(_template3,{
POKEMON:this.pokemon(_pokemon5),
SPECIES:this.speciesName(newSpecies)
});
}

case'switchout':{
var _pokemon6=args[1];
var _side3=_pokemon6.slice(0,2);
var _template4=this.template('switchOut',kwArgs.from,this.own(_side3));
return this.render(_template4,{
TRAINER:this.trainer(_side3),
NICKNAME:this.pokemonName(_pokemon6),
POKEMON:this.pokemon(_pokemon6)
});
}

case'faint':{
var _pokemon7=args[1];
var _template5=this.template('faint');
return this.render(_template5,{POKEMON:this.pokemon(_pokemon7)});
}

case'swap':{
var _pokemon8=args[1],target=args[2];
if(!target||!isNaN(Number(target))){
var _template6=this.template('swapCenter');
return this.render(_template6,{POKEMON:this.pokemon(_pokemon8)});
}
var _template7=this.template('swap');
return this.render(_template7,{POKEMON:this.pokemon(_pokemon8),TARGET:this.pokemon(target)});
}

case'move':{
var _pokemon9=args[1],move=args[2];
var _line2=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon9);
if(kwArgs.zeffect){
_line2=this.render(this.template('zEffect'),{POKEMON:this.pokemon(_pokemon9)});
}
var _template8=this.template('move',kwArgs.from);
return _line2+this.render(_template8,{
POKEMON:this.pokemon(_pokemon9),MOVE:this.moveName(move)
});
}

case'cant':{
var _pokemon10=args[1],effect=args[2],_move=args[3];
var _template9=this.template('cant',effect,'NODEFAULT')||
this.template(_move?'cant':'cantNoMove');
var _line3=this.maybeAbility(effect,kwArgs.of||_pokemon10);
return _line3+this.render(_template9,{
POKEMON:this.pokemon(_pokemon10),MOVE:this.moveName(_move)
});
}

case'-candynamax':{
var _side4=args[1];
var own=this.own(_side4);
var _template10='';
if(this.turn===1){
if(own)_template10=this.template('canDynamax',own);
}else{
_template10=this.template('canDynamax',own);
}
return this.render(_template10,{TRAINER:this.trainer(_side4)});
}

case'message':{
var message=args[1];
return''+message+'\n';
}

case'-start':{var _kwArgs$from;
var _pokemon11=args[1],_effect4=args[2],_arg2=args[3];
var _line4=this.maybeAbility(_effect4,_pokemon11)||this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon11);
var _id5=BattleTextParser.effectId(_effect4);
if(_id5==='typechange'){
var _template11=this.template('typeChange',kwArgs.from);
return _line4+this.render(_template11,{
POKEMON:this.pokemon(_pokemon11),TYPE:_arg2,SOURCE:this.pokemon(kwArgs.of)
});
}
if(_id5==='typeadd'){
var _template12=this.template('typeAdd',kwArgs.from);
return _line4+this.render(_template12,{POKEMON:this.pokemon(_pokemon11),TYPE:_arg2});
}
if(_id5.startsWith('stockpile')){
var _num2=_id5.slice(9);
var _template13=this.template('start','stockpile');
return _line4+this.render(_template13,{POKEMON:this.pokemon(_pokemon11),NUMBER:_num2});
}
if(_id5.startsWith('perish')){
var _num3=_id5.slice(6);
var _template14=this.template('activate','perishsong');
return _line4+this.render(_template14,{POKEMON:this.pokemon(_pokemon11),NUMBER:_num3});
}
if(_id5.startsWith('protosynthesis')||_id5.startsWith('quarkdrive')){
var stat=_id5.slice(-3);
var _template15=this.template('start',_id5.slice(0,_id5.length-3));
return _line4+this.render(_template15,{
POKEMON:this.pokemon(_pokemon11),STAT:this.statValue(stat)
});
}
var templateId='start';
if(kwArgs.already)templateId='alreadyStarted';
if(kwArgs.fatigue)templateId='startFromFatigue';
if(kwArgs.zeffect)templateId='startFromZEffect';
if(kwArgs.damage)templateId='activate';
if(kwArgs.block)templateId='block';
if(kwArgs.upkeep)templateId='upkeep';
if(templateId==='start'&&(_kwArgs$from=kwArgs.from)!=null&&_kwArgs$from.startsWith('item:')){
templateId+='FromItem';
}
var _template16=this.template(templateId,kwArgs.from,_effect4);
return _line4+this.render(_template16,{
POKEMON:this.pokemon(_pokemon11),
EFFECT:this.effect(_effect4),
MOVE:this.moveName(_arg2),
SOURCE:this.pokemon(kwArgs.of),
ITEM:this.effect(kwArgs.from)
});
}

case'-end':{var _kwArgs$from2;
var _pokemon12=args[1],_effect5=args[2];
var _line5=this.maybeAbility(_effect5,_pokemon12)||this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon12);
var _id6=BattleTextParser.effectId(_effect5);
if(_id6==='doomdesire'||_id6==='futuresight'){
var _template17=this.template('activate',_effect5);
return _line5+this.render(_template17,{TARGET:this.pokemon(_pokemon12)});
}
var _templateId='end';
var _template18='';
if((_kwArgs$from2=kwArgs.from)!=null&&_kwArgs$from2.startsWith('item:')){
_template18=this.template('endFromItem',_effect5);
}
if(!_template18)_template18=this.template(_templateId,_effect5);
return _line5+this.render(_template18,{
POKEMON:this.pokemon(_pokemon12),
EFFECT:this.effect(_effect5),
SOURCE:this.pokemon(kwArgs.of),
ITEM:this.effect(kwArgs.from)
});
}

case'-ability':{
var _pokemon13=args[1],ability=args[2],oldAbility=args[3];
var _line6='';
if(oldAbility)_line6+=this.ability(oldAbility,_pokemon13);
_line6+=this.ability(ability,_pokemon13);
if(kwArgs.fail){
var _template19=this.template('block',kwArgs.from);
return _line6+_template19;
}
if(kwArgs.from){
if(!oldAbility)_line6=this.maybeAbility(kwArgs.from,_pokemon13)+_line6;
var _template20=this.template('changeAbility',kwArgs.from);
return _line6+this.render(_template20,{
POKEMON:this.pokemon(_pokemon13),
ABILITY:this.abilityName(ability),
SOURCE:this.pokemon(kwArgs.of)
});
}
var _id7=BattleTextParser.effectId(ability);
if(_id7==='unnerve'){
var _template21=this.template('start',ability);
return _line6+this.render(_template21,{TEAM:this.team(_pokemon13.slice(0,2),true)});
}
var _templateId2='start';
if(_id7==='anticipation'||_id7==='sturdy')_templateId2='activate';
var _template22=this.template(_templateId2,ability,'NODEFAULT');
return _line6+this.render(_template22,{POKEMON:this.pokemon(_pokemon13)});
}

case'-endability':{
var _pokemon14=args[1],_ability=args[2];
if(_ability)return this.ability(_ability,_pokemon14);
var _line7=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon14);
var _template23=this.template('start','Gastro Acid');
return _line7+this.render(_template23,{POKEMON:this.pokemon(_pokemon14)});
}

case'-item':{
var _pokemon15=args[1],item=args[2];
var _id8=BattleTextParser.effectId(kwArgs.from);
var _target='';
if(['magician','pickpocket'].includes(_id8)){var _ref2=
[kwArgs.of,''];_target=_ref2[0];kwArgs.of=_ref2[1];
}
var _line8=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon15);
if(['thief','covet','bestow','magician','pickpocket'].includes(_id8)){
var _template24=this.template('takeItem',kwArgs.from);
return _line8+this.render(_template24,{
POKEMON:this.pokemon(_pokemon15),
ITEM:this.itemValue(item),
SOURCE:this.pokemon(_target||kwArgs.of)
});
}
if(_id8==='frisk'){
var hasTarget=kwArgs.of&&_pokemon15&&kwArgs.of!==_pokemon15;
var _template25=this.template(hasTarget?'activate':'activateNoTarget',"Frisk");
return _line8+this.render(_template25,{
POKEMON:this.pokemon(kwArgs.of),
ITEM:this.itemValue(item),
TARGET:this.pokemon(_pokemon15)
});
}
if(kwArgs.from){
var _template26=this.template('addItem',kwArgs.from);
return _line8+this.render(_template26,{
POKEMON:this.pokemon(_pokemon15),ITEM:this.itemValue(item)
});
}
var _template27=this.template('start',item,'NODEFAULT');
return _line8+this.render(_template27,{POKEMON:this.pokemon(_pokemon15)});
}

case'-enditem':{
var _pokemon16=args[1],_item=args[2];
var _line9=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon16);
if(kwArgs.eat){
var _template28=this.template('eatItem',kwArgs.from);
return _line9+this.render(_template28,{
POKEMON:this.pokemon(_pokemon16),ITEM:this.itemValue(_item)
});
}
var _id9=BattleTextParser.effectId(kwArgs.from);
if(_id9==='gem'){
var _template29=this.template('useGem',_item);
return _line9+this.render(_template29,{
POKEMON:this.pokemon(_pokemon16),
ITEM:this.itemValue(_item),
MOVE:this.moveName(kwArgs.move)
});
}
if(_id9==='stealeat'){
var _template30=this.template('removeItem',"Bug Bite");
return _line9+this.render(_template30,{
SOURCE:this.pokemon(kwArgs.of),ITEM:this.itemValue(_item)
});
}
if(kwArgs.from){
var _template31=this.template('removeItem',kwArgs.from);
return _line9+this.render(_template31,{
POKEMON:this.pokemon(_pokemon16),
ITEM:this.itemValue(_item),
SOURCE:this.pokemon(kwArgs.of)
});
}
if(kwArgs.weaken){
var _template32=this.template('activateWeaken');
return _line9+this.render(_template32,{
POKEMON:this.pokemon(_pokemon16),ITEM:this.itemValue(_item)
});
}
var _template33=this.template('end',_item,'NODEFAULT');
if(!_template33)_template33=this.template('activateItem');
return _line9+this.render(_template33,{
POKEMON:this.pokemon(_pokemon16),
ITEM:this.itemValue(_item),
TARGET:this.pokemon(kwArgs.of)
});
}

case'-status':{var _kwArgs$from3;
var _pokemon17=args[1],status=args[2];
var _line10=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon17);
if((_kwArgs$from3=kwArgs.from)!=null&&_kwArgs$from3.startsWith('item:')){
var _template34=this.template('startFromItem',status);
return _line10+this.render(_template34,{
POKEMON:this.pokemon(_pokemon17),ITEM:this.effect(kwArgs.from)
});
}
if(BattleTextParser.effectId(kwArgs.from)==='rest'){
var _template35=this.template('startFromRest',status);
return _line10+this.render(_template35,{POKEMON:this.pokemon(_pokemon17)});
}
var _template36=this.template('start',status);
return _line10+this.render(_template36,{POKEMON:this.pokemon(_pokemon17)});
}

case'-curestatus':{var _kwArgs$from4;
var _pokemon18=args[1],_status=args[2];
if(BattleTextParser.effectId(kwArgs.from)==='naturalcure'){
var _template37=this.template('activate',kwArgs.from);
return this.render(_template37,{POKEMON:this.pokemon(_pokemon18)});
}
var _line11=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon18);
if((_kwArgs$from4=kwArgs.from)!=null&&_kwArgs$from4.startsWith('item:')){
var _template38=this.template('endFromItem',_status);
return _line11+this.render(_template38,{
POKEMON:this.pokemon(_pokemon18),ITEM:this.effect(kwArgs.from)
});
}
if(kwArgs.thaw){
var _template39=this.template('endFromMove',_status);
return _line11+this.render(_template39,{
POKEMON:this.pokemon(_pokemon18),MOVE:this.effect(kwArgs.from)
});
}
var _template40=this.template('end',_status,'NODEFAULT');
if(!_template40)_template40=this.template('end');
return _line11+this.render(_template40,{POKEMON:this.pokemon(_pokemon18),EFFECT:_status});
}

case'-cureteam':{
return this.template('activate',kwArgs.from);
}

case'-singleturn':case'-singlemove':{
var _pokemon19=args[1],_effect6=args[2];
var _line12=this.maybeAbility(_effect6,kwArgs.of||_pokemon19)||
this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon19);
var _id10=BattleTextParser.effectId(_effect6);
if(_id10==='instruct'){
var _template41=this.template('activate',_effect6);
return _line12+this.render(_template41,{
POKEMON:this.pokemon(kwArgs.of),TARGET:this.pokemon(_pokemon19)
});
}
var _template42=this.template('start',_effect6,'NODEFAULT');
if(!_template42)_template42=this.template('start');
return _line12+this.render(_template42,{
EFFECT:this.effect(_effect6),
POKEMON:this.pokemon(_pokemon19),
SOURCE:this.pokemon(kwArgs.of),
TEAM:this.team(_pokemon19.slice(0,2))
});
}

case'-sidestart':{
var _side5=args[1],_effect7=args[2];
var _template43=this.template('start',_effect7,'NODEFAULT');
if(!_template43)_template43=this.template('startTeamEffect');
return this.render(_template43,{
EFFECT:this.effect(_effect7),TEAM:this.team(_side5),PARTY:this.party(_side5)
});
}

case'-sideend':{
var _side6=args[1],_effect8=args[2];
var _template44=this.template('end',_effect8,'NODEFAULT');
if(!_template44)_template44=this.template('endTeamEffect');
return this.render(_template44,{
EFFECT:this.effect(_effect8),TEAM:this.team(_side6),PARTY:this.party(_side6)
});
}

case'-weather':{
var weather=args[1];
if(!weather||weather==='none'){
var _template45=this.template('end',kwArgs.from,'NODEFAULT');
if(!_template45){
return this.render(this.template('endFieldEffect'),{EFFECT:this.effect(weather)});
}
return _template45;
}
if(kwArgs.upkeep){
return this.template('upkeep',weather,'NODEFAULT');
}
var _line13=this.maybeAbility(kwArgs.from,kwArgs.of);
var _template46=this.template('start',weather,'NODEFAULT');
if(!_template46)_template46=this.template('startFieldEffect');
return _line13+this.render(_template46,{EFFECT:this.effect(weather)});
}

case'-fieldstart':case'-fieldactivate':{
var _effect9=args[1];
var _line14=this.maybeAbility(kwArgs.from,kwArgs.of);
if(BattleTextParser.effectId(kwArgs.from)==='hadronengine'){
return _line14+this.render(this.template('start','hadronengine'),{
POKEMON:this.pokemon(kwArgs.of)
});
}
var _templateId3=cmd.slice(6);
if(BattleTextParser.effectId(_effect9)==='perishsong')_templateId3='start';
var _template47=this.template(_templateId3,_effect9,'NODEFAULT');
if(!_template47)_template47=this.template('startFieldEffect');
return _line14+this.render(_template47,{
EFFECT:this.effect(_effect9),POKEMON:this.pokemon(kwArgs.of)
});
}

case'-fieldend':{
var _effect10=args[1];
var _template48=this.template('end',_effect10,'NODEFAULT');
if(!_template48)_template48=this.template('endFieldEffect');
return this.render(_template48,{EFFECT:this.effect(_effect10)});
}

case'-sethp':{
var _effect11=kwArgs.from;
return this.template('activate',_effect11);
}

case'-message':{
var _message=args[1];
return'  '+_message+'\n';
}

case'-hint':{
var _message2=args[1];
return'  ('+_message2+')\n';
}

case'-activate':{
var _pokemon20=args[1],_effect12=args[2],_target2=args[3];
var _id11=BattleTextParser.effectId(_effect12);
if(_id11==='celebrate'){
return this.render(this.template('activate','celebrate'),{
TRAINER:this.trainer(_pokemon20.slice(0,2))
});
}
if(!_target2&&
['hyperdrill','hyperspacefury','hyperspacehole','phantomforce','shadowforce','feint'].includes(_id11)){var _ref3=
[kwArgs.of,_pokemon20];_pokemon20=_ref3[0];_target2=_ref3[1];
if(!_pokemon20)_pokemon20=_target2;
}
if(!_target2)_target2=kwArgs.of||_pokemon20;

var _line15=this.maybeAbility(_effect12,_pokemon20);

if(_id11==='lockon'||_id11==='mindreader'){
var _template49=this.template('start',_effect12);
return _line15+this.render(_template49,{
POKEMON:this.pokemon(kwArgs.of),SOURCE:this.pokemon(_pokemon20)
});
}

if((_id11==='mummy'||_id11==='lingeringaroma')&&kwArgs.ability){
_line15+=this.ability(kwArgs.ability,_target2);
_line15+=this.ability(_id11==='mummy'?'Mummy':'Lingering Aroma',_target2);
var _template50=this.template('changeAbility',_id11);
return _line15+this.render(_template50,{TARGET:this.pokemon(_target2)});
}

if(_id11==='commander'){


if(_target2===_pokemon20)return _line15;
var _template51=this.template('activate',_id11);
return _line15+this.render(_template51,{
POKEMON:this.pokemon(_pokemon20),TARGET:this.pokemon(_target2)
});
}

var _templateId4='activate';
if(_id11==='forewarn'&&_pokemon20===_target2){
_templateId4='activateNoTarget';
}
if((_id11==='protosynthesis'||_id11==='quarkdrive')&&kwArgs.fromitem){
_templateId4='activateFromItem';
}
if(_id11==='orichalcumpulse'&&kwArgs.source){
_templateId4='start';
}
var _template52=this.template(_templateId4,_effect12,'NODEFAULT');
if(!_template52){
if(_line15)return _line15;
_template52=this.template('activate');
return _line15+this.render(_template52,{EFFECT:this.effect(_effect12)});
}

if(kwArgs.ability){
_line15+=this.ability(kwArgs.ability,_pokemon20);
}
if(kwArgs.ability2){
_line15+=this.ability(kwArgs.ability2,_target2);
}
return _line15+this.render(_template52,{
TEAM:_id11==='brickbreak'?this.team(_target2.slice(0,2)):undefined,
MOVE:kwArgs.move?this.moveName(kwArgs.move):undefined,
NUMBER:kwArgs.number,
ITEM:kwArgs.item?this.itemValue(kwArgs.item):undefined,
NAME:kwArgs.name,
POKEMON:this.pokemon(_pokemon20),
TARGET:this.pokemon(_target2),
SOURCE:this.pokemon(kwArgs.of)
});
}

case'-prepare':{
var _pokemon21=args[1],_effect13=args[2],_target3=args[3];
var _template53=this.template('prepare',_effect13);
return this.render(_template53,{
POKEMON:this.pokemon(_pokemon21),TARGET:this.pokemon(_target3)
});
}

case'-damage':{
var _pokemon22=args[1],percentage=args[3];
var _template54=this.template('damage',kwArgs.from,'NODEFAULT');
var _line16=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon22);
var _id12=BattleTextParser.effectId(kwArgs.from);
if(_template54){
return _line16+this.render(_template54,{POKEMON:this.pokemon(_pokemon22)});
}

if(!kwArgs.from){
_template54=this.template(percentage?'damagePercentage':'damage');
percentage=percentage?percentage.replace(/%(\|\|)?$/,'$1'):'';
var _message3=this.render(_template54,{
POKEMON:this.pokemon(_pokemon22),PERCENTAGE:percentage
});

return _line16+_message3.replace(/\|\|([%％])/,'$1||');
}
if(kwArgs.from.startsWith('item:')){
_template54=this.template(kwArgs.of?'damageFromPokemon':'damageFromItem');
return _line16+this.render(_template54,{
POKEMON:this.pokemon(_pokemon22),
ITEM:this.effect(kwArgs.from),
SOURCE:this.pokemon(kwArgs.of)
});
}
if(kwArgs.partiallytrapped||_id12==='bind'||_id12==='wrap'){
_template54=this.template('damageFromPartialTrapping');
return _line16+this.render(_template54,{
POKEMON:this.pokemon(_pokemon22),MOVE:this.effect(kwArgs.from)
});
}

_template54=this.template('damage');
return _line16+this.render(_template54,{POKEMON:this.pokemon(_pokemon22)});
}

case'-heal':{
var _pokemon23=args[1];
var _template55=this.template('heal',kwArgs.from,'NODEFAULT');
var _line17=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon23);
if(_template55){
return _line17+this.render(_template55,{
POKEMON:this.pokemon(_pokemon23),
SOURCE:this.pokemon(kwArgs.of),
NICKNAME:kwArgs.wisher
});
}

if(kwArgs.from&&!kwArgs.from.startsWith('ability:')){
_template55=this.template('healFromEffect');
return _line17+this.render(_template55,{
POKEMON:this.pokemon(_pokemon23),EFFECT:this.effect(kwArgs.from)
});
}

_template55=this.template('heal');
return _line17+this.render(_template55,{POKEMON:this.pokemon(_pokemon23)});
}

case'-boost':case'-unboost':{var _kwArgs$from5;
var _pokemon24=args[1],_stat2=args[2],_num4=args[3];
if(_stat2==='spa'&&this.gen===1)_stat2='spc';
var amount=parseInt(_num4,10);
var _line18=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon24);
var _templateId5=cmd.slice(1);
if(amount>=3)_templateId5+='3';else
if(amount>=2)_templateId5+='2';else
if(amount===0)_templateId5+='0';
if(amount&&kwArgs.zeffect){
_templateId5+=kwArgs.multiple?'MultipleFromZEffect':'FromZEffect';
}else if(amount&&(_kwArgs$from5=kwArgs.from)!=null&&_kwArgs$from5.startsWith('item:')){
var _template56=this.template(_templateId5+'FromItem',kwArgs.from);
return _line18+this.render(_template56,{
POKEMON:this.pokemon(_pokemon24),
STAT:this.statValue(_stat2),
ITEM:this.effect(kwArgs.from)
});
}
var _template57=this.template(_templateId5,kwArgs.from);
return _line18+this.render(_template57,{
POKEMON:this.pokemon(_pokemon24),STAT:this.statValue(_stat2)
});
}

case'-setboost':{
var _pokemon25=args[1];
var _effect14=kwArgs.from;
var _line19=this.maybeAbility(_effect14,kwArgs.of||_pokemon25);
var _template58=this.template('boost',_effect14);
return _line19+this.render(_template58,{POKEMON:this.pokemon(_pokemon25)});
}

case'-swapboost':{
var _pokemon26=args[1],_target4=args[2];
var _line20=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon26);
var _id13=BattleTextParser.effectId(kwArgs.from);
var _templateId6='swapBoost';
if(_id13==='guardswap')_templateId6='swapDefensiveBoost';
if(_id13==='powerswap')_templateId6='swapOffensiveBoost';
var _template59=this.template(_templateId6,kwArgs.from);
return _line20+this.render(_template59,{
POKEMON:this.pokemon(_pokemon26),TARGET:this.pokemon(_target4)
});
}

case'-copyboost':{
var _pokemon27=args[1],_target5=args[2];
var _line21=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon27);
var _template60=this.template('copyBoost',kwArgs.from);
return _line21+this.render(_template60,{
POKEMON:this.pokemon(_pokemon27),TARGET:this.pokemon(_target5)
});
}

case'-clearboost':case'-clearpositiveboost':case'-clearnegativeboost':{
var _pokemon28=args[1],source=args[2];
var _line22=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon28);
var _templateId7='clearBoost';
if(kwArgs.zeffect)_templateId7='clearBoostFromZEffect';
var _template61=this.template(_templateId7,kwArgs.from);
return _line22+this.render(_template61,{
POKEMON:this.pokemon(_pokemon28),SOURCE:this.pokemon(source)
});
}

case'-invertboost':{
var _pokemon29=args[1];
var _line23=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon29);
var _template62=this.template('invertBoost',kwArgs.from);
return _line23+this.render(_template62,{POKEMON:this.pokemon(_pokemon29)});
}

case'-clearallboost':{
return this.template('clearAllBoost',kwArgs.from);
}

case'-crit':case'-supereffective':case'-resisted':{
var _pokemon30=args[1],effectiveness=args[2];
var _templateId8=cmd.slice(1);
if(_templateId8==='supereffective')_templateId8='superEffective';
if(effectiveness==='2'){
if(_templateId8==='superEffective')_templateId8='extremelyEffective';
if(_templateId8==='resisted')_templateId8='mostlyIneffective';
}
if(kwArgs.spread)_templateId8+='Spread';
var _template63=this.template(_templateId8);
return this.render(_template63,{POKEMON:this.pokemon(_pokemon30)});
}

case'-block':{
var _pokemon31=args[1],_effect15=args[2],_move2=args[3],attacker=args[4];
var _line24=this.maybeAbility(_effect15,kwArgs.of||_pokemon31);
var _template64=this.template('block',_effect15);
return _line24+this.render(_template64,{
POKEMON:this.pokemon(_pokemon31),
SOURCE:this.pokemon(attacker||kwArgs.of),
MOVE:this.moveName(_move2)
});
}

case'-fail':{
var _pokemon32=args[1],_effect16=args[2],_stat3=args[3];
var _id14=BattleTextParser.effectId(_effect16);
var blocker=BattleTextParser.effectId(kwArgs.from);
var _line25=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon32);
var _templateId9='block';
if(['desolateland','primordialsea'].includes(blocker)&&
!['sunnyday','raindance','sandstorm','hail','snowscape','chillyreception'].includes(_id14)){
_templateId9='blockMove';
}else if(blocker==='uproar'&&kwArgs.msg){
_templateId9='blockSelf';
}
var _template65=this.template(_templateId9,kwArgs.from);
if(_template65){
return _line25+this.render(_template65,{POKEMON:this.pokemon(_pokemon32)});
}

if(_id14==='unboost'){
_template65=this.template('fail','unboost');
return _line25+this.render(_template65,{
POKEMON:this.pokemon(_pokemon32),STAT:this.statValue(_stat3)
});
}

_templateId9='fail';
if(['brn','frz','par','psn','slp','substitute','shedtail'].includes(_id14)){
_templateId9='alreadyStarted';
}
if(kwArgs.heavy)_templateId9='failTooHeavy';
if(kwArgs.weak)_templateId9='fail';
if(kwArgs.forme)_templateId9='failWrongForme';
_template65=this.template(_templateId9,_id14);
return _line25+this.render(_template65,{POKEMON:this.pokemon(_pokemon32)});
}

case'-immune':{
var _pokemon33=args[1];
var _line26=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon33);
var _template66=this.template('block',kwArgs.from);
if(!_template66){
var _templateId10=kwArgs.ohko?'immuneOHKO':'immune';
_template66=this.template(_pokemon33?_templateId10:'immuneNoPokemon',kwArgs.from);
}
return _line26+this.render(_template66,{POKEMON:this.pokemon(_pokemon33)});
}

case'-miss':{
var _source=args[1],_pokemon34=args[2];
var _line27=this.maybeAbility(kwArgs.from,kwArgs.of||_pokemon34);
if(!_pokemon34){
var _template67=this.template('missNoPokemon');
return _line27+this.render(_template67,{SOURCE:this.pokemon(_source)});
}
var _template68=this.template('miss');
return _line27+this.render(_template68,{POKEMON:this.pokemon(_pokemon34)});
}

case'-center':case'-ohko':case'-combine':{
return this.template(cmd.slice(1));
}

case'-notarget':{
return this.template('noTarget');
}

case'-mega':case'-primal':{
var _pokemon35=args[1],species=args[2],_item2=args[3];
var _id15='';
var _templateId11=cmd.slice(1);
if(species==='Rayquaza'){
_id15='dragonascent';
_templateId11='megaNoItem';
}
if(!_item2&&cmd==='-mega')_templateId11='megaNoItem';
var _template69=this.template(_templateId11,_id15);
var _side7=_pokemon35.slice(0,2);
var pokemonName=this.pokemon(_pokemon35);
if(cmd==='-mega'){
_template69+=this.template('transformMega');
}
return this.render(_template69,{
POKEMON:pokemonName,
SPECIES:this.speciesName(species),
ITEM:this.itemValue(_item2),
TRAINER:this.trainer(_side7)
});
}

case'-terastallize':{
var _pokemon36=args[1],type=args[2];
var _id16='';
var _templateId12=cmd.slice(1);
var _template70=this.template(_templateId12,_id16);
var _pokemonName=this.pokemon(_pokemon36);
return this.render(_template70,{POKEMON:_pokemonName,TYPE:type});
}

case'-zpower':{
var _pokemon37=args[1];
var _template71=this.template('zPower');
return this.render(_template71,{POKEMON:this.pokemon(_pokemon37)});
}

case'-burst':{
var _pokemon38=args[1];
var _template72=this.template('activate',"Ultranecrozium Z");
return this.render(_template72,{POKEMON:this.pokemon(_pokemon38)});
}

case'-zbroken':{
var _pokemon39=args[1];
var _template73=this.template('zBroken');
return this.render(_template73,{POKEMON:this.pokemon(_pokemon39)});
}

case'-hitcount':{
var _num5=args[2];
return this.render(this.template('hitCount'),{
NUMBER:{value:_num5,category:_num5==='1'?'s':'p'}
});
}

case'-waiting':{
var _pokemon40=args[1],_target6=args[2];
var _template74=this.template('activate',"Water Pledge");
return this.render(_template74,{
POKEMON:this.pokemon(_pokemon40),TARGET:this.pokemon(_target6)
});
}

case'-anim':{
return'';
}

default:{
return null;
}
}
};return BattleTextParser;}();BattleTextParser.uiParser=null;




if(typeof require==='function'){

global.BattleTextParser=BattleTextParser;
}
//# sourceMappingURL=battle-text-parser.js.map