"use strict";


var KEEPALIVE_INTERVAL=25000;
var KEEPALIVE_RANGE=20000;
var RECONNECT_CAP=60000;
var PING_RESPONSE='|queryresponse|ping|';

var socket=null;
var serverInfo;
var reconnectTimeout=null;
var reconnectDelay=1000;
var shouldReconnect=true;
var lastReceiveTime=Date.now();
var queue=[];

self.onmessage=function(event){
var _event$data=event.data,type=_event$data.type,server=_event$data.server,data=_event$data.data;
if(type==='connect'){
serverInfo=server;
shouldReconnect=true;
reconnectDelay=1000;
connectToServer();
}else if(type==='send'){var _socket;
if(((_socket=socket)==null?void 0:_socket.readyState)===WebSocket.OPEN){
socket.send(data);
}else{
queue.push(data);
}
}else if(type==='disconnect'){
shouldReconnect=false;
if(reconnectTimeout)clearTimeout(reconnectTimeout);
reconnectTimeout=null;
if(socket)socket.close();
socket=null;
}
};














setInterval(function(){var _socket2;
if(((_socket2=socket)==null?void 0:_socket2.readyState)!==WebSocket.OPEN)return;
if(Date.now()-lastReceiveTime>3*KEEPALIVE_INTERVAL){
socket.close();
return;
}
if(Date.now()-lastReceiveTime>=KEEPALIVE_RANGE){
socket.send('|/cmd ping');
}
},KEEPALIVE_INTERVAL);

function connectToServer(){
if(!serverInfo)return;
if(socket)return;

var port=serverInfo.protocol==='https'?'':":"+serverInfo.port;
var url=serverInfo.protocol+"://"+serverInfo.host+port+serverInfo.prefix;

try{
socket=new WebSocket(url.replace('http','ws')+'/websocket');
}catch(_unused){
socket=new SockJS(url,[],{timeout:5*60*1000});
}
if(socket){
socket.onopen=function(){
reconnectDelay=1000;
lastReceiveTime=Date.now();
postMessage({type:'connected'});for(var _i2=0,_queue2=
queue;_i2<_queue2.length;_i2++){var _socket3;var msg=_queue2[_i2];(_socket3=socket)==null||_socket3.send(msg);}
queue=[];
};

socket.onmessage=function(e){
lastReceiveTime=Date.now();
if(e.data.startsWith(PING_RESPONSE))return;
postMessage({type:'message',data:e.data});
};

socket.onclose=function(){
socket=null;
postMessage({type:'disconnected'});
scheduleReconnect();
};

socket.onerror=function(){var _socket4;

(_socket4=socket)==null||_socket4.close();
};
return;
}
return postMessage({type:'error'});
}

function scheduleReconnect(){
if(!shouldReconnect||reconnectTimeout)return;
postMessage({type:'retrying',data:Date.now()+reconnectDelay});
reconnectTimeout=setTimeout(function(){
reconnectTimeout=null;
reconnectDelay=Math.min(reconnectDelay*2,RECONNECT_CAP);
if(shouldReconnect)connectToServer();
},reconnectDelay);
}
//# sourceMappingURL=client-connection-worker.js.map