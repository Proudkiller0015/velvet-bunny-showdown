"use strict";function _inheritsLoose(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,_setPrototypeOf(t,o);}function _setPrototypeOf(t,e){return _setPrototypeOf=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t;},_setPrototypeOf(t,e);}/**
 * Chat panel
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */var


























ChatRoom=function(_PSRoom){






























function ChatRoom(options){var _options$args,_options$args2,_options$args3;var _this;
_this=_PSRoom.call(this,options)||this;_this.classType='chat';_this.users={};_this.userCount=0;_this.onlineUsers=[];_this.connectMode='normal';_this.pmTarget=null;_this.challengeMenuOpen=false;_this.initialSlash=false;_this.challenging=null;_this.teamSent=null;_this.challenged=null;_this.battle=null;_this.log=null;_this.connectError=null;_this.tour=null;_this.lastMessage=null;_this.lastViewedTime=null;_this.joinLeave=null;_this.userActivity=[];_this.timeOffset=0;_this.
































































































































































































































































handleHighlight=function(args){var _PS$prefs$ignore;
var name;
var message;
var serverTime=0;
if(args[0]==='c:'){
serverTime=parseInt(args[1]);
name=args[2];
message=args[3];
}else{
name=args[1];
message=args[2];
}
var userid=toID(name);
if(!message)return false;
if(userid===PS.user.userid)return false;

var isDM=_this.id.startsWith("dm-");
var highlightType=ChatRoom.isHighlightableChatMessage(message,isDM);
var isIgnored=(_PS$prefs$ignore=PS.prefs.ignore)==null?void 0:_PS$prefs$ignore[userid];
if(isIgnored||!highlightType)return false;
if(highlightType==='subtle'){
_this.subtleNotify();
return false;
}

if(isDM){
_this.notify({
title:""+_this.title,
body:_this.getChatNotificationBody(message)
});
return false;
}

var isBeforeLastSeenMessage=_this.isBeforeLastSeenMessage(serverTime);

if(ChatRoom.getHighlight(message,_this.id)){
if(!isBeforeLastSeenMessage){
_this.notify({
title:"Mentioned by "+name+" in "+_this.id,
body:_this.getChatNotificationBody(message),
id:'highlight'
});
}
return true;
}
if(!isBeforeLastSeenMessage)_this.subtleNotify();
return false;
};_this.
clientCommands=_this.parseClientCommands({
'chall,challenge':function(target){var _this2=this;
if(target){
var _target$split=target.split(','),targetUser=_target$split[0],format=_target$split[1];
if(this.pmTarget&&(format===undefined||targetUser.includes('@@@'))){
format=target;
targetUser=this.pmTarget;
}
format=BattleLog.formatId(format||'');
PS.mainmenu.makeQuery('userdetails',targetUser).then(function(data){
if(data.rooms===false)return _this2.errorReply(TL(["This player does not exist or is not online."]));
PS.join("challenge-"+toID(targetUser),{args:{format:format}});
});
return;
}
if(this.challengeMenuOpen){
this.cancelChallenge();
return;
}
this.openChallenge();
},
'cchall,cancelchallenge':function(target){
this.cancelChallenge();
},
'reject':function(target){
this.challenged=null;
this.teamSent=null;
this.update(null);
this.sendDirect("/reject "+target);
},
'clear':function(){var _this$log;
(_this$log=this.log)==null||_this$log.reset();
this.update(null);
},
'debug':function(target){var _PSView$debugMenu;
var targetID=toID(target);
if(targetID==='off'){
PSView.setDebug(null);
this.add('||Debug menu: OFF');
this.handleSend('/hidedebug');
return;
}else if(targetID==='snap'){
PSView.setDebug('snap');
this.add('||Debug menu: SCROLL-SNAP');
return;
}else if(targetID==='panels'){
PSView.setDebug('panels');
this.add('||Debug menu: PANELS');
return;
}else if(targetID==='battles'){
this.handleSend('/showdebug');
return;
}
this.add("||Debug menu: "+(((_PSView$debugMenu=PSView.debugMenu)==null?void 0:_PSView$debugMenu.toUpperCase())||'OFF')+".");
this.add("||Debug battle messages: "+(PS.prefs.showdebug?'ON':'OFF'));
this.add('||Usage: /debug [off|snap|panels|battles]');
},
'togglemessages':function(target){
if(this.pmTarget||
this.type!=='chat')return this.errorReply(TL(["This command can only be used in proper chat rooms."]));
if(this.log){
var userid=toID(target);
var classStart='revealed chat chatmessage-'+userid;
var nodes=[];
var isHidden=true;for(var _i2=0,_this$log$innerElem$c2=
this.log.innerElem.childNodes;_i2<_this$log$innerElem$c2.length;_i2++){var node=_this$log$innerElem$c2[_i2];
if(node.className&&(node.className+' ').startsWith(classStart)){
nodes.push(node);
}
}
if(this.log.preemptElem){for(var _i4=0,_this$log$preemptElem2=
this.log.preemptElem.childNodes;_i4<_this$log$preemptElem2.length;_i4++){var _node=_this$log$preemptElem2[_i4];
if(_node.className&&(_node.className+' ').startsWith(classStart)){
nodes.push(_node);
}
}
}
isHidden=nodes[0].style.display==='none';
nodes.every(function(node){
node.style.display=isHidden?'':'none';
return true;
});
isHidden=!isHidden;
var toggleButtons=this.log.innerElem.querySelectorAll("button[name=\"toggleMessages\"][value=\""+userid+"\"]");for(var _i6=0;_i6<
toggleButtons.length;_i6++){var button=toggleButtons[_i6];
button.innerHTML=isHidden?"<small>("+
nodes.length+" line"+(nodes.length>1?'s':'')+" from "+userid+" hidden)</small>":"<small>(Hide "+
nodes.length+" line"+(nodes.length>1?'s':'')+" from "+userid+")</small>";
}
}
},
'rank,ranking,rating,ladder':function(target){var _this3=this;
if(PS.teams.usesLocalLadder)return"/rank "+target;

var arg=target;
if(!arg){
arg=PS.user.userid;
}
if(this.battle&&!arg.includes(',')){
arg+=", "+this.id.split('-')[1];
}

var targets=arg.split(',');
var formatTargeting=false;
var formats={};
var gens={};
for(var i=1,len=targets.length;i<len;i++){
targets[i]=$.trim(targets[i]);
if(targets[i].length===4&&targets[i].startsWith('gen')){
gens[targets[i]]=1;
}else{
formats[toID(targets[i])]=1;
}
formatTargeting=true;
}

PSLoginServer.query("ladderget",{
user:targets[0]
}).then(function(data){
if(!data||!Array.isArray(data))return _this3.errorReply(TL(["Error: corrupted ranking data"]));
var buffer="<div class=\"ladder\"><table><tr><td colspan=\"9\">User: <strong>"+toID(targets[0])+"</strong></td></tr>";
if(!data.length){
buffer+='<tr><td colspan="9"><em>This user has not played any ladder games yet.</em></td></tr>';
buffer+='</table></div>';
return _this3.add("|html|"+buffer);
}
buffer+='<tr><th>Format</th><th><abbr title="Elo rating">Elo</abbr></th><th><abbr title="user\'s percentage chance of winning a random battle (aka GLIXARE)">GXE</abbr></th><th><abbr title="Glicko-1 rating: rating &#177; deviation">Glicko-1</abbr></th><th>COIL</th><th>W</th><th>L</th><th>Total</th>';
var suspect=false;for(var _i8=0;_i8<
data.length;_i8++){var item=data[_i8];
if('suspect'in item)suspect=true;
}
if(suspect)buffer+='<th>Suspect reqs possible?</th>';
buffer+='</tr>';
var hiddenFormats=[];for(var _i10=0;_i10<
data.length;_i10++){var row=data[_i10];
if(!row)return _this3.errorReply(TL(["Error: corrupted ranking data"]));
var formatId=toID(row.formatid);
var matchesTarget=
formats[formatId]||
gens[formatId.slice(0,4)]||
gens['gen6']&&!formatId.startsWith('gen');

if(matchesTarget||!formatTargeting&&row.elo>=1001&&row.w+row.l+row.t>0){
buffer+='<tr>';
}else{
buffer+='<tr class="hidden">';
hiddenFormats.push(window.BattleLog.escapeFormat(formatId,true));
}for(var _i12=0,_ref2=


[row.elo,row.rpr,row.rprd,row.gxe,row.w,row.l,row.t];_i12<_ref2.length;_i12++){var value=_ref2[_i12];
if(typeof value!=='number'&&typeof value!=='string'){
return _this3.errorReply(TL(["Error: corrupted ranking data"]));
}
}

buffer+="<td> "+BattleLog.escapeHTML(BattleLog.formatName(formatId,true))+" </td><td><strong>"+Math.round(row.elo)+"</strong></td>";
if(row.rprd>100){

buffer+="<td>&ndash;</td>";
buffer+="<td><span style=\"color:#888\"><em>"+Math.round(row.rpr)+" <small> &#177; "+Math.round(row.rprd)+" </small></em> <small>(provisional)</small></span></td>";
}else{
buffer+="<td>"+Math.trunc(row.gxe)+"<small>."+row.gxe.toFixed(1).slice(-1)+"%</small></td>";
buffer+="<td><em>"+Math.round(row.rpr)+" <small> &#177; "+Math.round(row.rprd)+"</small></em></td>";
}
var N=parseInt(row.w,10)+parseInt(row.l,10)+parseInt(row.t,10);
var COIL_B=undefined;




if(COIL_B){
buffer+="<td>"+Math.round(40.0*parseFloat(row.gxe)*Math.pow(2.0,-COIL_B/N))+"</td>";
}else{
buffer+='<td>&mdash;</td>';
}
buffer+="<td> "+row.w+" </td><td> "+row.l+" </td><td> "+N+" </td>";
if(suspect){
if(typeof row.suspect==='undefined'){
buffer+='<td>&mdash;</td>';
}else{
buffer+='<td>';
buffer+=row.suspect?"Yes":"No";
buffer+='</td>';
}
}
buffer+='</tr>';
}
if(hiddenFormats.length){
if(hiddenFormats.length===data.length){
if(formatTargeting){
var formatsText=Object.keys(gens).concat(Object.keys(formats)).join(', ');
buffer+="<tr class=\"no-matches\"><td colspan=\"8\">"+
eHTML(["<em>This user has not played any ladder games that match ",".</em></td></tr>"],formatsText);
}else{
buffer+="<tr class=\"no-matches\"><td colspan=\"8\"><em>This user has no notable ladder activity.</em></td></tr>";
}
}
buffer+="<tr><td colspan=\"8\"><button class=\"button\" name=\"showOtherFormats\">"+("Show "+
hiddenFormats.length+" hidden format"+(hiddenFormats.length===1?'':'s')+"</button></td></tr>");
}
var userid=toID(targets[0]);
var registered=PS.user.registered;
if(registered&&PS.user.userid===userid){
buffer+="<tr><td colspan=\"8\" style=\"text-align:right\"><a href=\"//"+Config.routes.users+"/"+userid+"\">Reset W/L</a></tr></td>";
}
buffer+='</table></div>';
_this3.add("|html|"+buffer);
});
},



'play':function(){
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
if(this.battle.atQueueEnd){
if(this.battle.ended)this.battle.isReplay=true;
this.battle.reset();
}
this.battle.play();
this.update(null);
},
'pause':function(){
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
this.battle.pause();
this.update(null);
},
'ffto,fastfowardto':function(target,cmd,parentElem){var _this4=this;
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
if(!target){
PS.prompt(TL(["Turn number?"]),{
defaultValue:""+this.battle.turn,
type:'numeric',
okButton:TL(["[Go]"]),
parentElem:parentElem
}).then(function(turnNum){
if(turnNum!=null&&turnNum.trim())_this4.send("/ffto "+turnNum,parentElem);
});
return;
}

var turnNum=Number(target);
if(target.startsWith('+')||turnNum<0){var _this$battle$seeking;
turnNum+=(_this$battle$seeking=this.battle.seeking)!=null?_this$battle$seeking:this.battle.turn;
if(turnNum<0)turnNum=0;
}else if(target==='end'){
turnNum=Infinity;
}
if(isNaN(turnNum)){
this.errorReply(TL(["Invalid turn number: ",""],target));
return;
}
if(this.battle.hardcoreMode){
this.errorReply(TL(["Turn navigation is disabled in hardcore mode."]));
return;
}
this.battle.seekTurn(turnNum);
this.update(null);
},
'switchsides':function(){
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
this.battle.switchViewpoint();
},
'cancel,undo,cancelone':function(_target,cmd){
if(!this.battle)return this.send('/cancelchallenge');

var room=this;
if(!room.choices||!room.request){
this.errorReply('/choose - '+TL(["You are not a player in this battle"]));
return;
}
if(room.choices.isDone()||room.choices.isEmpty()){

this.sendDirect('/undo');
}
if(cmd==='cancel'){
room.choices=new BattleChoiceBuilder(room.request);
}else{
room.choices=room.choices.previous();
}
room.updateChoiceNotification();
this.update(null);
},
'move,switch,team,pass,shift,choose':function(target,cmd){
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
var room=this;
if(!room.choices||!room.request){
this.errorReply('/choose - '+TL(["You are not a player in this battle"]));
return;
}

var choices=cmd==='choose'?new BattleChoiceBuilder(room.request):room.choices;
if(cmd!=='choose')target=cmd+" "+target;
var possibleError=choices.addChoices(target);
if(possibleError){
this.errorReply(possibleError);
return;
}

room.choices=choices;
if(choices.isDone()){
this.sendDirect("/choose "+choices.toString());
}
room.updateChoiceNotification();
room.overlayActive=null;
this.update(null);
},
'movemenu,switchmenu':function(target,cmd){
if(!this.battle)return this.errorReply(TL(["You are not in a battle"]));
var room=this;
if(!target&&cmd==='movemenu'){
room.overlayActive=room.overlayActive==='move'?null:'move';
this.update(null);
return;
}
if(!target&&cmd==='switchmenu'){
room.overlayActive=room.overlayActive==='switch'?null:'switch';
this.update(null);
return;
}
this.errorReply('???');
}
});if(options.connectMode!==undefined)_this.connectMode=options.connectMode;if((_options$args=options.args)!=null&&_options$args.pmTarget)_this.pmTarget=options.args.pmTarget;if((_options$args2=options.args)!=null&&_options$args2.challengeMenuOpen)_this.challengeMenuOpen=true;if((_options$args3=options.args)!=null&&_options$args3.initialSlash)_this.initialSlash=true;_this.updateTarget(_this.pmTarget);_this.connect();return _this;}_inheritsLoose(ChatRoom,_PSRoom);var _proto=ChatRoom.prototype;_proto.connect=function connect(){if(!this.connected&&(this.connectMode==='normal'||this.connectMode==='pending-reconnect'||this.connectMode==='pending-login')){if(this.pmTarget===null){PS.send("/join "+this.id);this.connected='pending';}else{this.connectMode=null;}}};_proto.interruptClose=function interruptClose(explicit,elem){if(this.type==='chat'&&this.connected===true&&PS.prefs.leavePopupRoom&&!explicit){PS.join('confirmleaveroom',{parentElem:elem});return true;}if(this.challenging){this.cancelChallenge();}return false;};_proto.receiveLine=function receiveLine(args){switch(args[0]){case'users':var usernames=args[1].split(',');var count=parseInt(usernames.shift(),10);this.setUsers(count,usernames);return;case'join':case'j':case'J':this.addUser(args[1]);if(this.battle)break;this.showJoinLeave("join",args[1],args[0]==="J");return true;case'leave':case'l':case'L':this.removeUser(args[1]);if(this.battle)break;this.showJoinLeave("leave",args[1],args[0]==="L");return true;case'name':case'n':case'N':this.renameUser(args[1],args[2]);break;case'tournament':case'tournaments':this.tour||(this.tour=new ChatTournament(this));this.tour.receiveLine(args);return;case'noinit':if(this.connectMode==='deleted'){if(args[2])this.connectError=args[2];}else if(this.battle&&args[1]==='joinfailed'){this.connectError=args[2]||'Not found';}else if(this.battle){this.loadReplay();}else{this.connectError=args[2]||"Chatroom \""+this.title+"\" not found";}this.update(null);return;case'expire':this.connected=false;this.connectMode='deleted';this.connectError=args[1]||"This room has expired (you can't chat in it anymore)";this.update(null);return;case'chat':case'c':if((args[2]+" ").startsWith('/challenge ')){this.updateChallenge(args[1],args[2].slice(11));return;}else if(args[2].startsWith('/warn ')){var reason=args[2].replace('/warn ','');PS.join("rules-warn",{args:{type:'warn',message:(reason==null?void 0:reason.trim())||undefined},parentElem:null});return;}case'c:':if(args[0]==='c:')PS.lastMessageTime=args[1];this.lastMessage=args;this.joinLeave=null;var name=args[args[0]==='c:'?2:1];this.markUserActive(name);if(this.tour)this.tour.joinLeave=null;break;case':':this.timeOffset=Math.trunc(Date.now()/1000)-(parseInt(args[1],10)||0);PS.lastMessageTime=args[1];break;}_PSRoom.prototype.receiveLine.call(this,args);};_proto.handleReconnect=function handleReconnect(msg){var _PS$connection,_this$lastMessage,_lines$;var lines=msg.split('\n');var cutOffStart=0;var cutOffEnd=lines.length;var cutOffTime=((_PS$connection=PS.connection)==null?void 0:_PS$connection.lastMessageTimeBeforeReconnect)||0;var cutOffExactLine=this.lastMessage?'|'+((_this$lastMessage=this.lastMessage)==null?void 0:_this$lastMessage.join('|')):null;var reconnectMessage='|raw|<div class="infobox">You reconnected.</div>';for(var i=0;i<lines.length;i++){if(lines[i].startsWith('|users|')){this.add(lines[i]);}if(lines[i]===cutOffExactLine){cutOffStart=i+1;}else if(lines[i].startsWith("|c:|")){var time=parseInt(lines[i].split('|')[2]||'');if(time<cutOffTime)cutOffStart=i;}if(lines[i].startsWith('|raw|<div class="infobox"> You joined ')){var _PS$prefs$timestamps;var timestamp=BattleLog.renderTimestamp(Date.now()/1000,(_PS$prefs$timestamps=PS.prefs.timestamps)==null?void 0:_PS$prefs$timestamps.chatrooms);reconnectMessage="|raw|<div class=\"infobox\">"+timestamp+"You reconnected to "+lines[i].slice(38);cutOffEnd=i;if(!lines[i-1])cutOffEnd=i-1;}}lines=lines.slice(cutOffStart,cutOffEnd);if((_lines$=lines[0])!=null&&_lines$.startsWith('|init|')){lines[0]="||Note: Scrollback doesn't go all the way back to when you disconnected.";}if(lines.length){var _PS$prefs$timestamps2;var _timestamp=BattleLog.renderTimestamp(cutOffTime,(_PS$prefs$timestamps2=PS.prefs.timestamps)==null?void 0:_PS$prefs$timestamps2.chatrooms);this.receiveLine(["raw","<div class=\"infobox\">"+_timestamp+"You disconnected.</div>"]);for(var _i14=0,_lines2=lines;_i14<_lines2.length;_i14++){var line=_lines2[_i14];this.receiveLine(BattleTextParser.parseLine(line));}this.receiveLine(BattleTextParser.parseLine(reconnectMessage));}this.update(null);return true;};_proto.updateTarget=function updateTarget(name){var selfWithGroup=""+(PS.user.group||' ')+PS.user.name;if(this.id==='dm-'){this.pmTarget=selfWithGroup;this.setUsers(1,[selfWithGroup]);this.title="Console";}else if(this.id.startsWith('dm-')){var id=this.id.slice(3);if(toID(name)!==id)name=null;name||(name=this.pmTarget||id);if(/[A-Za-z0-9]/.test(name.charAt(0)))name=" "+name;var nameWithGroup=name;name=name.slice(1);this.pmTarget=name;if(!PS.user.userid){this.setUsers(1,[nameWithGroup]);}else{this.setUsers(2,[nameWithGroup,selfWithGroup]);}this.title="["+TL(["DM"])+"] "+nameWithGroup.trim();}};ChatRoom.getHighlight=function getHighlight(message,roomid){var _this$highlightRegExp,_this$highlightRegExp2;var highlights=PS.prefs.highlights||{};if(Array.isArray(highlights)){highlights={global:highlights};PS.prefs.set('highlights',highlights);}if(!PS.prefs.noselfhighlight&&PS.user.nameRegExp){var _PS$user$nameRegExp;if((_PS$user$nameRegExp=PS.user.nameRegExp)!=null&&_PS$user$nameRegExp.test(message))return true;}if(!this.highlightRegExp){try{this.updateHighlightRegExp(highlights);}catch(_unused){return false;}}var id=PS.server.id+'#'+roomid;var globalHighlightsRegExp=(_this$highlightRegExp=this.highlightRegExp)==null?void 0:_this$highlightRegExp['global'];var roomHighlightsRegExp=(_this$highlightRegExp2=this.highlightRegExp)==null?void 0:_this$highlightRegExp2[id];return(globalHighlightsRegExp==null?void 0:globalHighlightsRegExp.test(message))||(roomHighlightsRegExp==null?void 0:roomHighlightsRegExp.test(message));};ChatRoom.updateHighlightRegExp=function updateHighlightRegExp(highlights){this.highlightRegExp={};for(var i in highlights){if(!highlights[i].length){this.highlightRegExp[i]=null;continue;}this.highlightRegExp[i]=new RegExp('(?:\\b|(?!\\w))(?:'+highlights[i].join('|')+')(?:\\b|(?!\\w))','i');}};ChatRoom.isHighlightableChatMessage=function isHighlightableChatMessage(message){var isDM=arguments.length>1&&arguments[1]!==undefined?arguments[1]:false;if(!message.startsWith('/'))return true;var _PSUtils$splitFirst=PSUtils.splitFirst(message.slice(1),' '),cmd=_PSUtils$splitFirst[0];if(['raw','nonotify','text','error'].includes(cmd)){return false;}if(['uhtml','uhtmlchange'].includes(cmd)){return isDM;}if(cmd==='subtlenotify'){return'subtle';}return true;};_proto.isBeforeLastSeenMessage=function isBeforeLastSeenMessage(serverTime){var lastMessageDates=Dex.prefs('logtimes')||(PS.prefs.set('logtimes',{}),Dex.prefs('logtimes'));if(!lastMessageDates[PS.server.id])lastMessageDates[PS.server.id]={};var lastMessageDate=lastMessageDates[PS.server.id][this.id]||0;var time=serverTime-(this.timeOffset||0);if(PS.isVisiblePanel(this)){this.lastViewedTime=null;lastMessageDates[PS.server.id][this.id]=time;PS.prefs.set('logtimes',lastMessageDates);}else{var lastViewedTime=this.lastViewedTime||0;if(lastViewedTime<time)this.lastViewedTime=time;}return time<=lastMessageDate;};_proto.getChatNotificationBody=function getChatNotificationBody(message){if(/^\/(log|raw|html|uhtml|uhtmlchange) /.test(message)){return'"'+message.split(' ').slice(1).join(' ').replace(/<[^>]*?>/g,'')+'"';}return'"'+message+'"';};_proto.
openChallenge=function openChallenge(){
if(!this.pmTarget){
this.errorReply(TL(["Can only be used in a DM."]));
return;
}
this.challengeMenuOpen=true;
this.update(null);
};_proto.
cancelChallenge=function cancelChallenge(){
if(!this.pmTarget){
this.errorReply(TL(["Can only be used in a DM."]));
return;
}
if(this.teamSent&&this.challengeMenuOpen||this.challenging){
this.sendDirect('/cancelchallenge');
this.challenging=null;
this.challengeMenuOpen=true;
}else{
this.challengeMenuOpen=false;
}
this.challenging=null;
this.teamSent=null;
this.update(null);
};_proto.
parseChallenge=function parseChallenge(challengeString){var _splitChallenge$;
if(!challengeString)return null;

var splitChallenge=challengeString.split('|');

var challenge={
formatName:splitChallenge[0],
teamFormat:(_splitChallenge$=splitChallenge[1])!=null?_splitChallenge$:splitChallenge[0],
message:splitChallenge[2],
acceptButtonLabel:splitChallenge[3],
rejectButtonLabel:splitChallenge[4]
};
if(!challenge.formatName&&!challenge.message){
return null;
}
return challenge;
};_proto.
updateChallenge=function updateChallenge(name,challengeString){var _this$args;
var challenge=this.parseChallenge(challengeString);
var userid=toID(name);
if((_this$args=this.args)!=null&&_this$args.format)this.args.format=null;
this.teamSent=null;



if(!challenge){



this.challenged=null;
this.challenging=null;
}else if(userid===PS.user.userid){

this.challenging=challenge;
this.challengeMenuOpen=false;
PS.mainmenu.lastChallenged=Date.now();
}else{

this.challenged=challenge;
this.notify({
title:"Challenge from "+name,
body:"Format: "+BattleLog.formatName(challenge.formatName),
id:'challenge'
});
}
this.update(null);
};_proto.
markUserActive=function markUserActive(name){
var userid=toID(name);
var idx=this.userActivity.indexOf(userid);
this.users[userid]=name;
if(idx!==-1){
this.userActivity.splice(idx,1);
}
this.userActivity.push(userid);
if(this.userActivity.length>100){

this.userActivity.splice(0,20);
}
};_proto.
sendDirect=function sendDirect(line){var _this5=this;
if(this.pmTarget){
line=line.split('\n').filter(Boolean).map(function(row){return"/pm "+_this5.pmTarget+", "+row;}).join('\n');
PS.send(line);
return;
}
_PSRoom.prototype.sendDirect.call(this,line);
};_proto.
setUsers=function setUsers(count,usernames){
this.userCount=count;
this.onlineUsers=[];for(var _i16=0;_i16<
usernames.length;_i16++){var username=usernames[_i16];
var userid=toID(username);
this.users[userid]=username;
this.onlineUsers.push([userid,username]);
}
this.sortOnlineUsers();
this.update(null);
};_proto.
sortOnlineUsers=function sortOnlineUsers(){
PSUtils.sortBy(this.onlineUsers,function(_ref3){var id=_ref3[0],name=_ref3[1];return(
[PS.server.getGroup(name.charAt(0)).order,!name.endsWith('@!'),id]);}
);
};_proto.
addUser=function addUser(username){
if(!username)return;

var userid=toID(username);
this.users[userid]=username;
var index=this.onlineUsers.findIndex(function(_ref4){var curUserid=_ref4[0];return curUserid===userid;});
if(index>=0){
this.onlineUsers[index]=[userid,username];
}else{
this.userCount++;
this.onlineUsers.push([userid,username]);
this.sortOnlineUsers();
}
this.update(null);
};_proto.
removeUser=function removeUser(username,noUpdate){
if(!username)return;

var userid=toID(username);
var index=this.onlineUsers.findIndex(function(_ref5){var curUserid=_ref5[0];return curUserid===userid;});
if(index>=0){
this.userCount--;
this.onlineUsers.splice(index,1);
if(!noUpdate)this.update(null);
}
};_proto.
renameUser=function renameUser(username,oldUsername){
this.removeUser(oldUsername,true);
this.addUser(username);
this.update(null);
};_proto.

showJoinLeave=function showJoinLeave(action,name,silent){var _PS$prefs$showjoins,_ref6,_showjoins$this$id;
var showjoins=(_PS$prefs$showjoins=PS.prefs.showjoins)==null?void 0:_PS$prefs$showjoins[PS.server.id];
if(!((_ref6=(_showjoins$this$id=showjoins==null?void 0:showjoins[this.id])!=null?_showjoins$this$id:showjoins==null?void 0:showjoins['global'])!=null?_ref6:!silent))return;

this.joinLeave||(this.joinLeave={
join:[],
leave:[],
messageId:"joinleave-"+Date.now()
});
var user=BattleTextParser.parseNameParts(name);
var formattedName=user.group+user.name;
if(action==='join'&&this.joinLeave['leave'].includes(formattedName)){
this.joinLeave['leave'].splice(this.joinLeave['leave'].indexOf(formattedName),1);
}else if(action==='leave'&&this.joinLeave['join'].includes(formattedName)){
this.joinLeave['join'].splice(this.joinLeave['join'].indexOf(formattedName),1);
}else{
this.joinLeave[action].push(formattedName);
}

var joinedMessage=this.formatJoinLeave(this.joinLeave['join'],'joined');
var leftMessage=this.formatJoinLeave(this.joinLeave['leave'],'left');
var message=joinedMessage&&leftMessage?TL(["","; ",""],joinedMessage,leftMessage):joinedMessage||leftMessage;

this.add("|uhtml|"+this.joinLeave.messageId+"|<small class=\"gray\">"+message+"</small>");
};_proto.

formatJoinLeave=function formatJoinLeave(preList,action){
if(!preList.length)return'';

var message='';
var list=[];
var named={};for(var _i18=0;_i18<
preList.length;_i18++){var item=preList[_i18];
if(!named[item])list.push(item);
named[item]=true;
}
for(var j=0;j<list.length;j++){
if(j>=5){
message+=", and "+(list.length-5)+" others";
break;
}
if(j>0){
if(j===1&&list.length===2){
message+=' and ';
}else if(j===list.length-1){
message+=', and ';
}else{
message+=', ';
}
}
message+=BattleLog.escapeHTML(list[j]);
}
return message+" "+action;
};_proto.

destroy=function destroy(){
if(this.battle){

this.battle.destroy();
}else{var _this$log2;
(_this$log2=this.log)==null||_this$log2.destroy();
}
_PSRoom.prototype.destroy.call(this);
};return ChatRoom;}(PSRoom);ChatRoom.highlightRegExp=null;var


CopyableURLBox=function(_preact$Component){function CopyableURLBox(){var _this6;for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++){args[_key]=arguments[_key];}_this6=_preact$Component.call.apply(_preact$Component,[this].concat(args))||this;_this6.
copy=function(){
var input=_this6.base.children[0];
input.select();
document.execCommand('copy');
};return _this6;}_inheritsLoose(CopyableURLBox,_preact$Component);var _proto2=CopyableURLBox.prototype;_proto2.
render=function render(){
return preact.h("div",null,
preact.h("input",{
name:"url",type:"text","class":"textbox",readOnly:true,size:45,value:this.props.url,
style:"field-sizing:content"}
)," ",
preact.h("button",{"class":"button",onClick:this.copy},TL(["[Copy]"]))," ",
preact.h("a",{href:this.props.url,target:"_blank","class":"no-panel-intercept"},
preact.h("button",{"class":"button"},TL(["[Visit]"]))
)
);
};return CopyableURLBox;}(preact.Component);var















ChatTextEntry=function(_preact$Component2){function ChatTextEntry(){var _this7;for(var _len2=arguments.length,args=new Array(_len2),_key2=0;_key2<_len2;_key2++){args[_key2]=arguments[_key2];}_this7=_preact$Component2.call.apply(_preact$Component2,[this].concat(args))||this;_this7.



subscription=null;_this7.
textbox=null;_this7.
miniedit=null;_this7.
history=[];_this7.
historyIndex=0;_this7.
tabComplete=






null;_this7.






























focusIfNoSelection=function(e){
if(e.target.tagName==='TEXTAREA')return;
var selection=window.getSelection();
if(selection.type==='Range')return;
var elem=_this7.base.children[0].children[1];
PSView.politeFocus(elem);
};_this7.






onKeyDown=function(e){
if(e.isComposing)return;
if(_this7.handleKey(e)||_this7.props.onKey(e)){
e.preventDefault();
e.stopImmediatePropagation();
}
};return _this7;}_inheritsLoose(ChatTextEntry,_preact$Component2);var _proto3=ChatTextEntry.prototype;_proto3.componentDidMount=function componentDidMount(){var _this8=this,_this$props$room$args;this.subscription=PS.user.subscribe(function(){_this8.forceUpdate();});var textbox=this.base.querySelector('textarea[name=message], pre, input[name=url]');if(textbox.tagName==='TEXTAREA'||textbox.tagName==='INPUT'){this.textbox=textbox;}else{this.miniedit=new MiniEdit(textbox,{setContent:function(text){var _textbox$classList;textbox.innerHTML=formatText(text,false,false,true)+'\n';(_textbox$classList=textbox.classList)==null||_textbox$classList.toggle('textbox-empty',!text);},onKeyDown:this.onKeyDown});}if((_this$props$room$args=this.props.room.args)!=null&&_this$props$room$args.initialSlash){this.props.room.args.initialSlash=false;this.setValue('/',1);}this.props.room.__textentry=this;};_proto3.componentWillUnmount=function componentWillUnmount(){var _this$miniedit;if(this.subscription){this.subscription.unsubscribe();this.subscription=null;}(_this$miniedit=this.miniedit)==null||_this$miniedit.destroy();};_proto3.submit=function submit(){var _this$miniedit2;this.props.onMessage(this.getValue(),((_this$miniedit2=this.miniedit)==null?void 0:_this$miniedit2.element)||this.textbox);this.historyPush(this.getValue());this.setValue('',0);return true;};_proto3.


getValue=function getValue(){
return this.miniedit?this.miniedit.getValue():this.textbox.value;
};_proto3.
setValue=function setValue(value,start){var end=arguments.length>2&&arguments[2]!==undefined?arguments[2]:start;
if(this.miniedit){
this.miniedit.setValue(value,{start:start,end:end});
}else{var _setSelectionRange,_ref7;
this.textbox.value=value;
(_setSelectionRange=(_ref7=this.textbox).setSelectionRange)==null||_setSelectionRange.call(_ref7,start,end);
}
};_proto3.
getSelection=function getSelection(){
var value=this.getValue();
var _ref8=this.miniedit?
this.miniedit.getSelection()||{start:value.length,end:value.length}:
{start:this.textbox.selectionStart,end:this.textbox.selectionEnd},start=_ref8.start,end=_ref8.end;
return{value:value,start:start,end:end};
};_proto3.
setSelection=function setSelection(start,end){
if(this.miniedit){
this.miniedit.setSelection({start:start,end:end});
}else{var _setSelectionRange2,_ref9;
(_setSelectionRange2=(_ref9=this.textbox).setSelectionRange)==null||_setSelectionRange2.call(_ref9,start,end);
}
};_proto3.
replaceSelection=function replaceSelection(text){
if(this.miniedit){
this.miniedit.replaceSelection(text);
}else{
var _this$getSelection=this.getSelection(),value=_this$getSelection.value,start=_this$getSelection.start,end=_this$getSelection.end;
var newSelection=start+text.length;
this.setValue(value.slice(0,start)+text+value.slice(end),newSelection);
}
};_proto3.

historyUp=function historyUp(ifSelectionCorrect){
if(ifSelectionCorrect){
var _this$getSelection2=this.getSelection(),value=_this$getSelection2.value,start=_this$getSelection2.start,end=_this$getSelection2.end;
if(start!==end)return false;
if(end!==0){
if(end<value.length)return false;
}
}

if(this.historyIndex===0)return false;
var line=this.getValue();
if(line!=='')this.history[this.historyIndex]=line;
var newValue=this.history[--this.historyIndex];
this.setValue(newValue,newValue.length);
return true;
};_proto3.
historyDown=function historyDown(ifSelectionCorrect){
if(ifSelectionCorrect){
var _this$getSelection3=this.getSelection(),value=_this$getSelection3.value,start=_this$getSelection3.start,end=_this$getSelection3.end;
if(start!==end)return false;
if(end<value.length)return false;
}

var line=this.getValue();
if(line!=='')this.history[this.historyIndex]=line;
if(this.historyIndex===this.history.length){
if(!line)return false;
this.setValue('',0);
}else if(++this.historyIndex===this.history.length){
this.setValue('',0);
}else{
var newValue=this.history[this.historyIndex];
this.setValue(newValue,newValue.length);
}
return true;
};_proto3.
historyPush=function historyPush(line){
var duplicateIndex=this.history.lastIndexOf(line);
if(duplicateIndex>=0)this.history.splice(duplicateIndex,1);
if(this.history.length>100)this.history.splice(0,20);
this.history.push(line);
this.historyIndex=this.history.length;
};_proto3.
handleKey=function handleKey(ev){
var cmdKey=(ev.metaKey?1:0)+(ev.ctrlKey?1:0)===1&&!ev.altKey&&!ev.shiftKey;

if(ev.keyCode===13&&!ev.shiftKey){
return this.submit();
}else if(ev.keyCode===13){
this.replaceSelection('\n');
return true;
}else if(ev.keyCode===73&&cmdKey){
return this.toggleFormatChar('_');
}else if(ev.keyCode===66&&cmdKey){
return this.toggleFormatChar('*');
}else if(ev.keyCode===192&&cmdKey){
return this.toggleFormatChar('`');
}else if(ev.keyCode===9&&!ev.ctrlKey){
var reverse=!!ev.shiftKey;
return this.handleTabComplete(reverse);
}else if(ev.keyCode===38&&!ev.shiftKey&&!ev.altKey){
return this.historyUp(true);
}else if(ev.keyCode===40&&!ev.shiftKey&&!ev.altKey){
return this.historyDown(true);
}else if(ev.keyCode===27){
if(this.undoTabComplete()){
return true;
}
if(PS.room!==PS.panel){
PS.leave(PS.room.id);
return true;
}




}
return false;
};_proto3.

handleTabComplete=function handleTabComplete(reverse){var _this$tabComplete,_this9=this;

var _this$getSelection4=this.getSelection(),value=_this$getSelection4.value,start=_this$getSelection4.start,end=_this$getSelection4.end;
if(start!==end||end===0)return false;

var users=this.props.room.users;
var prefix=value.slice(0,end);
if(prefix===((_this$tabComplete=this.tabComplete)==null?void 0:_this$tabComplete.cursor)){

if(reverse){
this.tabComplete.candidateIndex--;
if(this.tabComplete.candidateIndex<0){
this.tabComplete.candidateIndex=this.tabComplete.candidates.length-1;
}
}else{
this.tabComplete.candidateIndex++;
if(this.tabComplete.candidateIndex>=this.tabComplete.candidates.length){
this.tabComplete.candidateIndex=0;
}
}
}else if(!value||reverse){

return false;
}else{



prefix=prefix.trim();


var match1=/^([\s\S!/]*?)([A-Za-z0-9][^, \n]*)$/.exec(prefix);

var match2=/^([\s\S!/]*?)([A-Za-z0-9][^, \n]* [^, ]*)$/.exec(prefix);
if(!match1&&!match2)return true;

var candidates=[];
var idprefix=match1?toID(match1[2]):'';
var spaceprefix=match2?match2[2].replace(/[^A-Za-z0-9 ]+/g,'').toLowerCase():'';
if(match2&&(match2[0]==='/'||match2[0]==='!'))spaceprefix='';
for(var userid in users){
if(spaceprefix&&users[userid].slice(1).replace(/[^A-Za-z0-9 ]+/g,'').
toLowerCase().
startsWith(spaceprefix)){
if(match2)candidates.push({type:"user",userid:userid,prefixIndex:match2[1].length});
}else if(idprefix&&userid.startsWith(idprefix)){
if(match1)candidates.push({type:"user",userid:userid,prefixIndex:match1[1].length});
}
}


var userActivity=this.props.room.userActivity;
candidates.sort(function(a,b){var _userActivity$indexOf,_userActivity$indexOf2;

if(a.type!=="user"||b.type!=="user")return 0;
if(a.prefixIndex!==b.prefixIndex){

return a.prefixIndex-b.prefixIndex;
}
var aIndex=(_userActivity$indexOf=userActivity==null?void 0:userActivity.indexOf(a.userid))!=null?_userActivity$indexOf:-1;
var bIndex=(_userActivity$indexOf2=userActivity==null?void 0:userActivity.indexOf(b.userid))!=null?_userActivity$indexOf2:-1;
if(aIndex!==bIndex){
return bIndex-aIndex;
}
return a.userid<b.userid?-1:1;
});

var currentLine=prefix.substring(prefix.lastIndexOf('\n')+1);
var isCommandWord=function(word){return word.startsWith('/')&&!word.startsWith('//')||word.startsWith('!');};
var currentWord=currentLine.substring(currentLine.lastIndexOf(' ')+1);
var isCommandSearch=isCommandWord(currentWord);
if(isCommandSearch){
PS.mainmenu.makeQuery('cmdsearch',currentWord,true).then(function(data){var _this9$tabComplete$ca,_this9$tabComplete;
var cmds=data.sort(function(a,b){return a.length<b.length?1:-1;});
var nextCmd=cmds[cmds.length-1];
var newValue=nextCmd+value.substring(end);
_this9.setValue(newValue,nextCmd.length,nextCmd.length);
var currentCandidates=(_this9$tabComplete$ca=(_this9$tabComplete=_this9.tabComplete)==null?void 0:_this9$tabComplete.candidates)!=null?_this9$tabComplete$ca:[];for(var _i20=0;_i20<
cmds.length;_i20++){var cmd=cmds[_i20];
currentCandidates.unshift({type:"command",command:cmd});
}
_this9.tabComplete={
candidates:currentCandidates,
candidateIndex:0,
prefix:nextCmd,
cursor:nextCmd
};
});
return true;
}

if(!candidates.length){
this.tabComplete=null;
return true;
}
this.tabComplete={
candidates:candidates,
candidateIndex:0,
prefix:prefix,
cursor:prefix
};
}

var candidate=this.tabComplete.candidates[this.tabComplete.candidateIndex];
if(candidate.type==="user"){
var name=users[candidate.userid];
if(!name)return true;

name=Dex.getShortName(name.slice(1));
var cursor=this.tabComplete.prefix.slice(0,candidate.prefixIndex)+name;
this.setValue(cursor+value.slice(end),cursor.length);
this.tabComplete.cursor=cursor;
}else{
var prefixIndex=prefix.lastIndexOf('\n')+1;
var fullPrefix=prefix.substring(0,prefixIndex)+Dex.getShortName(candidate.command);
var newValue=fullPrefix+value.substring(end);
this.setValue(newValue,fullPrefix.length,fullPrefix.length);
this.tabComplete.cursor=fullPrefix;
this.tabComplete.prefix=fullPrefix;
}
return true;
};_proto3.
undoTabComplete=function undoTabComplete(){
if(!this.tabComplete)return false;
var value=this.getValue();
if(!value.startsWith(this.tabComplete.cursor))return false;

this.setValue(this.tabComplete.prefix+value.slice(this.tabComplete.cursor.length),this.tabComplete.prefix.length);
this.tabComplete=null;
return true;
};_proto3.
toggleFormatChar=function toggleFormatChar(formatChar){
var _this$getSelection5=this.getSelection(),value=_this$getSelection5.value,start=_this$getSelection5.start,end=_this$getSelection5.end;


if(value.charAt(start)===formatChar&&value.charAt(start-1)===formatChar&&
value.charAt(start-2)!==formatChar){
start++;
}
if(value.charAt(end)===formatChar&&value.charAt(end-1)===formatChar&&
value.charAt(end-2)!==formatChar){
end--;
}


var wrap=formatChar+formatChar;
value=value.slice(0,start)+wrap+value.slice(start,end)+wrap+value.slice(end);
start+=2;
end+=2;


var nesting=wrap+wrap;
if(value.slice(start-4,start)===nesting){
value=value.slice(0,start-4)+value.slice(start);
start-=4;
end-=4;
}else if(start!==end&&value.slice(start-2,start+2)===nesting){
value=value.slice(0,start-2)+value.slice(start+2);
start-=2;
end-=4;
}
if(value.slice(end,end+4)===nesting){
value=value.slice(0,end)+value.slice(end+4);
}else if(start!==end&&value.slice(end-2,end+2)===nesting){
value=value.slice(0,end-2)+value.slice(end+2);
end-=2;
}

this.setValue(value,start,end);
return true;
};_proto3.
render=function render(){
var room=this.props.room;
var OLD_TEXTBOX=!PSView.useContentEditable&&!this.miniedit;
if(room.connectMode===null&&room.id.startsWith('battle-')){
return preact.h("div",{
"class":"chat-log-add hasuserlist",onClick:this.focusIfNoSelection,style:{left:this.props.left||0}},
preact.h(CopyableURLBox,{url:"https://psim.us/r/"+room.id.slice(7)}));
}

var canTalk=PS.user.named||room.id==='dm-';
var connected=room.connected===true||room.connectMode===null;
return preact.h("div",{
"class":"chat-log-add",onClick:this.focusIfNoSelection,style:{left:this.props.left||0}},

preact.h("form",{"class":"chatbox"+(this.props.tinyLayout?' nolabel':''),style:canTalk?{}:{display:'none'}},
preact.h("label",{style:"color:"+BattleLog.usernameColor(PS.user.userid)},PS.user.name,":"),
OLD_TEXTBOX?preact.h(PSTextarea,{
name:"message",
"class":connected&&canTalk?'autofocus':'disabled',minHeight:"16px",
placeholder:PSView.focusPreview(room),onKeyDown:this.onKeyDown}
):preact.h(ChatTextBox,{
disabled:!connected||!canTalk,
placeholder:PSView.focusPreview(room)}
)
),
!canTalk&&preact.h("button",{"data-href":"login","class":"button autofocus"},
TL(["[Choose a name before sending messages]"])
)
);
};return ChatTextEntry;}(preact.Component);var


ChatTextBox=function(_preact$Component3){function ChatTextBox(){return _preact$Component3.apply(this,arguments)||this;}_inheritsLoose(ChatTextBox,_preact$Component3);var _proto4=ChatTextBox.prototype;_proto4.
shouldComponentUpdate=function shouldComponentUpdate(nextProps){var _classList,_classList2;
this.base.setAttribute("placeholder",nextProps.placeholder);
(_classList=this.base.classList)==null||_classList.toggle('disabled',!!nextProps.disabled);
(_classList2=this.base.classList)==null||_classList2.toggle('autofocus',!nextProps.disabled);
return false;
};_proto4.
render=function render(){
return preact.h("pre",{
"class":"textbox textbox-empty "+(this.props.disabled?' disabled':' autofocus'),placeholder:this.props.placeholder},
'\n');
};return ChatTextBox;}(preact.Component);var


ChatPanel=function(_PSRoomPanel){function ChatPanel(){var _this10;for(var _len3=arguments.length,args=new Array(_len3),_key3=0;_key3<_len3;_key3++){args[_key3]=arguments[_key3];}_this10=_PSRoomPanel.call.apply(_PSRoomPanel,[this].concat(args))||this;_this10.











send=function(text,elem){
_this10.props.room.send(text,elem);
};_this10.
onKey=function(e){
if(e.keyCode===33){
var chatLog=_this10.base.getElementsByClassName('chat-log')[0];
chatLog.scrollTop=chatLog.scrollTop-chatLog.offsetHeight+60;
return true;
}else if(e.keyCode===34){
var _chatLog=_this10.base.getElementsByClassName('chat-log')[0];
_chatLog.scrollTop=_chatLog.scrollTop+_chatLog.offsetHeight-60;
return true;
}
return false;
};_this10.
makeChallenge=function(e,format,team){
var elem=e.target;
var now=Date.now();
var lastChallenged=PS.mainmenu.lastChallenged||0;
if(now-lastChallenged<5_000){
PS.alert(TL(["Please wait 5 seconds before challenging again."]),{
parentElem:elem
});
return;
}

PS.requestNotifications();
var room=_this10.props.room;
var packedTeam=team?team.packedTeam:'';
var privacy=PS.mainmenu.adjustPrivacy();
if(!room.pmTarget)throw new Error("Not a PM room");
PS.send("/utm "+packedTeam);
PS.send(privacy+"/challenge "+room.pmTarget+", "+format);
room.teamSent=format||'-';
room.update(null);
};_this10.
acceptChallenge=function(e,format,team){
var room=_this10.props.room;
var packedTeam=team?team.packedTeam:'';
if(!room.pmTarget)throw new Error("Not a PM room");
PS.send("/utm "+packedTeam);
_this10.props.room.send("/accept");
room.teamSent=format||'-';
room.update(null);
};return _this10;}_inheritsLoose(ChatPanel,_PSRoomPanel);var _proto5=ChatPanel.prototype;_proto5.componentDidMount=function componentDidMount(){var _this11=this;_PSRoomPanel.prototype.componentDidMount.call(this);this.subscribeTo(PS.user,function(){_this11.props.room.updateTarget();});};_proto5.
renderControls=function renderControls(){var _room$args;
var room=this.props.room;
var connectError=this.renderConnectError();

var defaultFormat=(_room$args=room.args)==null?void 0:_room$args.format;
if(defaultFormat!=null&&defaultFormat.startsWith('!!')){
room.args.format=undefined;
}

var challengeSent=room.teamSent&&!room.challenged;
var challengeTo=room.challenging?preact.h("div",{"class":"challenge outgoing"},
preact.h("p",null,"Waiting for ",room.pmTarget,"..."),
preact.h(TeamForm,{
format:room.challenging.formatName,teamFormat:room.challenging.teamFormat,
onSubmit:null,selectType:"challenge"},

preact.h("button",{"data-cmd":"/cancelchallenge","class":"button"},TL(["[Cancel]"]))
)
):room.challengeMenuOpen?preact.h("div",{"class":"challenge outgoing"},
preact.h(TeamForm,{onSubmit:this.makeChallenge,defaultFormat:defaultFormat,selectType:"challenge"},
challengeSent&&preact.h("button",{"class":"button",disabled:true},
TL(["Challenging..."])
),
!challengeSent&&preact.h("button",{type:"submit","class":"button button-first",disabled:!!room.challenged},
preact.h("strong",null,TL(["[Challenge]"]))
),
!challengeSent&&preact.h("button",{"data-href":"battleoptions","class":"button button-last","aria-label":TL(["[Battle options]"])},
preact.h("i",{"class":"fa fa-caret-down","aria-hidden":true})
)," ",
preact.h("button",{"data-cmd":"/cancelchallenge","class":"button"},TL(["[Cancel]"]))
)
):null;

var challengeFrom=room.challenged?preact.h("div",{"class":"challenge"},
!!room.challenged.message&&preact.h("p",null,room.challenged.message),
preact.h(TeamForm,{
format:room.challenged.formatName,teamFormat:room.challenged.teamFormat,
onSubmit:this.acceptChallenge,selectType:"challenge"},

room.teamSent&&preact.h("button",{"class":"button",disabled:true},
TL(["Accepting..."])
),
!room.teamSent&&preact.h("button",{
type:"submit","class":room.challenged.formatName?"button button-first":"button",
"data-cmdpreview":"/accept"},

preact.h("strong",null,room.challenged.acceptButtonLabel||TL(["[Accept]"]))
),
!room.teamSent&&room.challenged.formatName&&preact.h("button",{
"data-href":"battleoptions","class":"button button-last","aria-label":TL(["[Battle options]"])},

preact.h("i",{"class":"fa fa-caret-down","aria-hidden":true})
)," ",
preact.h("button",{"data-cmd":"/reject","class":"button"},room.challenged.rejectButtonLabel||TL(["[Reject]"]))
)
):null;

if(!challengeTo&&!challengeFrom&&!PS.isOffline&&!connectError)return null;
return preact.h(preact.Fragment,null,
connectError,
challengeTo,challengeFrom,PS.isOffline&&preact.h("p",{"class":"buttonbar"},
preact.h("button",{"class":"button","data-cmd":"/reconnect"},
preact.h("i",{"class":"fa fa-plug","aria-hidden":true})," ",preact.h("strong",null,TL(["[Reconnect]"]))
)," ",
preact.h(ReconnectTimer,null)
)
);
};_proto5.
renderConnectError=function renderConnectError(){
var room=this.props.room;
if(room.connectMode!=='deleted'&&room.connectMode!=='not-found'){
return null;
}
return preact.h("div",{"class":"pad"},preact.h("div",{"class":"broadcast-red pad"},
preact.h("h3",null,room.connectError||"Error"),
preact.h("p",{"class":"buttonbar"},preact.h("button",{"class":"button","data-cmd":"/close"},preact.h("strong",null,TL(["[Close]"]))))
));
};_proto5.

render=function render(){var _room$tour;
var room=this.props.room;
var userListWidth=room.width<550?0:146;
var challengeOpen=room.challengeMenuOpen||room.challenging||room.challenged;
return preact.h(PSPanelWrapper,{room:room,focusClick:true,noScroll:true,fullSize:true},
preact.h(ChatLog,{
"class":"chat-log"+(!userListWidth?'':' hasuserlist')+(challengeOpen?' challenge-open':''),
room:this.props.room,left:userListWidth,top:(_room$tour=room.tour)!=null&&_room$tour.info.isActive?30:0},

this.renderControls()
),
room.tour&&preact.h(TournamentBox,{tour:room.tour,left:userListWidth}),
preact.h(ChatTextEntry,{
room:this.props.room,onMessage:this.send,onKey:this.onKey,left:userListWidth,
tinyLayout:room.width-userListWidth<400}
),
preact.h(ChatUserList,{room:this.props.room,minimized:!userListWidth})
);
};return ChatPanel;}(PSRoomPanel);ChatPanel.id='chat';ChatPanel.routes=['dm-*','groupchat-*','*'];ChatPanel.Model=ChatRoom;ChatPanel.location='right';ChatPanel.icon=preact.h("i",{"class":"fa fa-comment-o","aria-hidden":true});var


ChatUserList=function(_preact$Component4){function ChatUserList(){return _preact$Component4.apply(this,arguments)||this;}_inheritsLoose(ChatUserList,_preact$Component4);var _proto6=ChatUserList.prototype;_proto6.


render=function render(){
var room=this.props.room;
var pmTargetid=room.pmTarget?toID(room.pmTarget):null;
var userCountText=room.userCount===1?TL([""," user"],room.userCount):TL([""," users"],room.userCount);
return preact.h("div",{
"class":'userlist'+(this.props.minimized?' userlist-hidden':this.props["static"]?' userlist-static':''),
style:{left:this.props.left||0,top:this.props.top||0}},

!this.props.minimized?
preact.h("div",{"class":"userlist-count"},preact.h("small",null,userCountText)):
room.id==='dm-'?
preact.h(preact.Fragment,null,
preact.h("button",{"class":"button button-middle","data-cmd":"/help"},TL(["[Commands]"]))
):
pmTargetid?
preact.h(preact.Fragment,null,
preact.h("button",{"class":"button button-middle","data-cmd":"/challenge"},TL(["[Challenge]"])),
preact.h("button",{"class":"button button-middle","data-href":"useroptions-"+pmTargetid},"\u2026")
):
room.battle?
preact.h(preact.Fragment,null,
preact.h("button",{"data-href":"userlist","class":"button button-middle"},userCountText),
preact.h("button",{"data-href":"battleoptions","class":"button button-middle"},TL(["[Battle options]"]))
):

preact.h("button",{"data-href":"userlist","class":"button button-middle"},userCountText),

preact.h("ul",null,
room.onlineUsers.map(function(_ref10){var userid=_ref10[0],name=_ref10[1];
var groupSymbol=name.charAt(0);
var group=PS.server.groups[groupSymbol]||{type:'user',order:0};
var color;
if(name.endsWith('@!')){
name=name.slice(0,-2);
color='#888888';
}else{
color=BattleLog.usernameColor(userid);
}
return preact.h("li",{key:userid},preact.h("button",{"class":"userbutton username"},
preact.h("em",{"class":"group"+(['leadership','staff'].includes(group.type)?' staffgroup':'')},
groupSymbol
),
group.type==='leadership'?
preact.h("strong",null,preact.h("em",{style:"color:"+color},name.slice(1))):
group.type==='staff'?
preact.h("strong",{style:"color:"+color+" "},name.slice(1)):

preact.h("span",{style:"color:"+color},name.slice(1))

));
})
)
);
};return ChatUserList;}(preact.Component);var


ChatLogInner=function(_preact$Component5){function ChatLogInner(){return _preact$Component5.apply(this,arguments)||this;}_inheritsLoose(ChatLogInner,_preact$Component5);var _proto7=ChatLogInner.prototype;_proto7.
shouldComponentUpdate=function shouldComponentUpdate(){
return false;
};_proto7.
render=function render(){
return preact.h("div",null,preact.h("div",{"class":this.props["class"]}));
};return ChatLogInner;}(preact.Component);var


ChatLog=function(_preact$Component6){function ChatLog(){var _this12;for(var _len4=arguments.length,args=new Array(_len4),_key4=0;_key4<_len4;_key4++){args[_key4]=arguments[_key4];}_this12=_preact$Component6.call.apply(_preact$Component6,[this].concat(args))||this;_this12.



subscription=null;return _this12;}_inheritsLoose(ChatLog,_preact$Component6);var _proto8=ChatLog.prototype;_proto8.
moveLogContents=function moveLogContents(source,target){
if(source===target)return;
var parent=target.parentElement;
parent.removeChild(target);
parent.appendChild(source);
};_proto8.
componentDidMount=function componentDidMount(){var _this13=this;
var room=this.props.room;
var elem=this.base;
var innerElem=elem.querySelector('.inner');
var preemptElem=elem.querySelector('.inner-preempt');
if(room.log){
this.moveLogContents(room.log.innerElem,innerElem);
innerElem=room.log.innerElem;
if(room.log.preemptElem&&preemptElem){
this.moveLogContents(room.log.preemptElem,preemptElem);

}
room.log.elem=elem;
room.log.className=elem.className;
elem.onscroll=room.log.onScroll;
elem.onclick=room.log.onClick;
}
if(!this.props.noSubscription){
room.log||(room.log=new BattleLog(elem,null,innerElem));
room.log.getHighlight=room.handleHighlight;
if(room.backlog){
var backlog=room.backlog;
room.backlog=null;for(var _i22=0;_i22<
backlog.length;_i22++){var args=backlog[_i22];
room.log.add(args,undefined,undefined,PS.prefs.timestamps[room.pmTarget?'pms':'chatrooms']);
}
}
this.subscription=room.subscribe(function(tokens){
if(!tokens)return;
_this13.props.room.log.add(tokens,undefined,undefined,PS.prefs.timestamps[room.pmTarget?'pms':'chatrooms']);
});
}
};_proto8.
componentWillUnmount=function componentWillUnmount(){var _this$subscription;
(_this$subscription=this.subscription)==null||_this$subscription.unsubscribe();
};_proto8.
componentDidUpdate=function componentDidUpdate(){
this.updateScroll();
};_proto8.
updateScroll=function updateScroll(){var _this$props$room$log;
(_this$props$room$log=this.props.room.log)==null||_this$props$room$log.updateScroll();
};_proto8.
render=function render(){var _this$props$bottom;
return preact.h("div",{
"class":this.props["class"],role:"log","aria-label":TL(["Chat log"]),
style:{left:this.props.left||0,top:this.props.top||0,bottom:(_this$props$bottom=this.props.bottom)!=null?_this$props$bottom:40}},

preact.h(ChatLogInner,{"class":"inner message-log"}),
this.props.hasPreempt&&preact.h(ChatLogInner,{"class":"inner-preempt message-log"}),
this.props.children&&preact.h("div",{"class":"controls"},this.props.children)
);
};return ChatLog;}(preact.Component);var


PSTextarea=function(_preact$Component7){function PSTextarea(){var _window$CSS;var _this14;for(var _len5=arguments.length,args=new Array(_len5),_key5=0;_key5<_len5;_key5++){args[_key5]=arguments[_key5];}_this14=_preact$Component7.call.apply(_preact$Component7,[this].concat(args))||this;_this14.











cssAutosize=!!((_window$CSS=window.CSS)!=null&&_window$CSS.supports!=null&&_window$CSS.supports('field-sizing','content'));_this14.
updateSize=function(){
var textbox=_this14.base.querySelector('textarea');
textbox.setAttribute('data-changed',textbox.value===(_this14.props.defaultValue||'')?'':'1');
if(_this14.cssAutosize)return;

var textboxTest=_this14.base.querySelector('textarea.heighttester');
textboxTest.style.width=textbox.offsetWidth+"px";
textboxTest.value=textbox.value;

textbox.style.height=textboxTest.scrollHeight+2+"px";
};_this14.
handleInput=function(e){
if(_this14.props.singleLine){
var textbox=e.currentTarget;
if(/[\r\n]/.test(textbox.value))textbox.value=textbox.value.replace(/[\r\n]+/g,'');
}
_this14.updateSize();
_this14.props.onInput==null||_this14.props.onInput(e);
};_this14.
handleKeyDown=function(e){
if(_this14.props.singleLine&&e.keyCode===13&&!e.shiftKey){var _closest;
e.preventDefault();
(_closest=e.currentTarget.closest('form'))==null||_closest.requestSubmit();
}
_this14.props.onKeyDown==null||_this14.props.onKeyDown(e);
};return _this14;}_inheritsLoose(PSTextarea,_preact$Component7);var _proto9=PSTextarea.prototype;_proto9.
componentDidMount=function componentDidMount(){
this.updateSize();
window.addEventListener('resize',this.updateSize);
};_proto9.
componentWillUnmount=function componentWillUnmount(){
window.removeEventListener('resize',this.updateSize);
};_proto9.
render=function render(){
var className=[
'textbox',this.props.subtle&&'textbox-subtle',
this.props.singleLine&&'textbox-singleline',this.props["class"]].
filter(Boolean).join(' ');
var style="min-height:"+(this.props.minHeight||(this.props.singleLine?'1em':'3em'));
var minWidth=this.props.minWidth||(this.props.singleLine?'5em':'');
if(minWidth)style+=";min-width:"+minWidth;
var wrapperStyle=this.props.singleLine?
'position:relative;display:inline-block;max-width:100%;vertical-align:middle;margin:-4px':'position:relative';
return preact.h("div",{style:wrapperStyle},
preact.h("textarea",{
name:this.props.name,"class":className,style:style,placeholder:this.props.placeholder,
defaultValue:this.props.defaultValue,
onInput:this.handleInput,onKeyUp:this.updateSize,onKeyDown:this.handleKeyDown}
),
!this.cssAutosize&&preact.h("div",null,preact.h("textarea",{
"class":className+" heighttester",
style:"visibility:hidden;position:absolute;left:-200px;height:10px;overflow-y:hidden"}
))
);
};return PSTextarea;}(preact.Component);


PS.addRoomType(ChatPanel);
//# sourceMappingURL=panel-chat.js.map