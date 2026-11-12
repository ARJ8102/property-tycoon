import { randomBytes, randomInt as cryptoInt } from 'node:crypto';
import { publicGame, actingPlayer, activePlayer, presentAction, nextPresentationCard, presentationSegmentDuration, createOnlineGame, playbackFrames, TOKENS, type CardPresentation, type GameAction, type GameIntent, type GameState, type OnlineCommand, type PublicRoom, type RoomPlayer, type RoomSession } from '../../shared/src/index.js';
interface Member extends RoomPlayer {secret:string;socketId:string|null;reducedMotion:boolean;seen:Set<string>}
interface Room {code:string;hostId:string;capacity:number;members:Member[];game:GameState|null;busyUntil:number;touched:number;presentation?:CardPresentation|null}
export interface Connection {id:string;roomCode?:string;playerId?:string}
function ensure(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fields(value:unknown,allowed:string[]):asserts value is Record<string,unknown>{ensure(record(value)&&Object.keys(value).every(k=>allowed.includes(k)),'Malformed command.');}
function name(value:unknown):string{ensure(typeof value==='string'&&value.trim().length>0&&value.trim().length<=24,'Enter a name of 1–24 characters.');return value.trim();}
function token(value:unknown):RoomPlayer['token']{ensure(TOKENS.some(t=>t.id===value),'Choose a valid token.');return value as RoomPlayer['token'];}
function capacity(value:unknown):number{ensure(Number.isInteger(value)&&Number(value)>=2&&Number(value)<=8,'Capacity must be 2–8.');return Number(value);}
function code(value:unknown):string{ensure(typeof value==='string'&&/^[A-Z2-9]{6}$/.test(value.toUpperCase().trim()),'Enter a valid six-character room code.');return value.toUpperCase().trim();}
/** This allowlist is the complete trust boundary for actions from the wire. */
function die(entropy:()=>number):number{let n:number;do{n=entropy();}while(n>=0xfffffffc);return n%6+1;}
export function serverAction(raw:unknown,actorId:string,entropy:()=>number):GameAction {
 ensure(record(raw)&&typeof raw.type==='string','Invalid game action.');
 const property=['MORTGAGE','UNMORTGAGE','UPGRADE','SELL_UPGRADE','BUILD_LANDMARK','SELL_LANDMARK','KEEP_INHERITED','REDEEM_INHERITED'];
 const plain=['ROLL_ORDER','START_GAME','ROLL','ROLL_DETENTION','END_TURN','PAY_RELEASE','USE_TROUBLE_CARD','BUY','DECLINE','SETTLE_DEBT','BANKRUPT','PASS_AUCTION','BID'];
 const trade=['PROPOSE_TRADE','ACCEPT_TRADE','REJECT_TRADE'];
 ensure([...plain,...property,...trade].includes(raw.type),'Unknown game action.');
 fields(raw,['type','expectedRevision',...(property.includes(raw.type)?['propertyId']:raw.type==='BID'?['amount']:raw.type==='PROPOSE_TRADE'?['offer']:['ACCEPT_TRADE','REJECT_TRADE'].includes(raw.type)?['tradeId']:[])]);
 ensure(Number.isSafeInteger(raw.expectedRevision)&&Number(raw.expectedRevision)>=0,'Invalid game revision.');
 if(raw.type==='BID'){ensure(Number.isSafeInteger(raw.amount)&&Number(raw.amount)>0,'Invalid bid.');return {type:'BID',amount:Number(raw.amount),actorId,expectedRevision:Number(raw.expectedRevision)};}
 const base={type:raw.type,actorId,expectedRevision:Number(raw.expectedRevision)};
 if(property.includes(raw.type)){ensure(Number.isInteger(raw.propertyId)&&Number(raw.propertyId)>=0&&Number(raw.propertyId)<40,'Invalid property.');return {...base,propertyId:Number(raw.propertyId)} as GameAction;}
 if(raw.type==='PROPOSE_TRADE'){
  fields(raw.offer,['partnerId','offeredProperties','requestedProperties','offeredCash','requestedCash']);const o=raw.offer;
  ensure(typeof o.partnerId==='string'&&o.partnerId.length<=64,'Invalid trading partner.');
  for(const k of ['offeredCash','requestedCash'])ensure(Number.isSafeInteger(o[k])&&Number(o[k])>=0,'Trade cash must be a nonnegative integer.');
  for(const k of ['offeredProperties','requestedProperties'])ensure(Array.isArray(o[k])&&o[k].length<=28&&o[k].every(id=>Number.isInteger(id)&&id>=0&&id<40),'Invalid trade properties.');
  return {...base,offer:structuredClone(o)} as GameAction;
 }
 if(raw.type==='ACCEPT_TRADE'||raw.type==='REJECT_TRADE'){ensure(typeof raw.tradeId==='string'&&raw.tradeId.length<=64,'Invalid trade ID.');return {...base,tradeId:raw.tradeId} as GameAction;}
 if(raw.type==='ROLL'||raw.type==='ROLL_DETENTION')return {...base,dice:[die(entropy),die(entropy)],cardDraw:entropy(),entropy:Array.from({length:64},entropy)} as GameAction;
 if(raw.type==='ROLL_ORDER')return {...base,dice:[die(entropy),die(entropy)]} as GameAction;
 return base as GameAction;
}
export class RoomManager {
 private rooms=new Map<string,Room>();
 constructor(private now=()=>Date.now(),private entropy=()=>cryptoInt(0x100000000)){}
 private seat(conn:Connection){const room=this.rooms.get(conn.roomCode??'');const member=room?.members.find(m=>m.id===conn.playerId&&m.socketId===conn.id);ensure(room&&member,'Join a room first.');return {room,member};}
 private host(room:Room,member:Member){ensure(room.hostId===member.id,'Only the host can do that.');}
 private lobby(room:Room){ensure(!room.game,'The match has already started.');}
 private member(conn:Connection,n:unknown,t:unknown,reduced:unknown):Member{return {id:randomBytes(12).toString('hex'),secret:randomBytes(32).toString('hex'),name:name(n),token:token(t),ready:false,connected:true,socketId:conn.id,reducedMotion:reduced===true,seen:new Set()};}
 private join(conn:Connection,room:Room,m:Member){conn.roomCode=room.code;conn.playerId=m.id;room.touched=this.now();return {room:this.public(room),session:{code:room.code,playerId:m.id,secret:m.secret} satisfies RoomSession};}
 private public(room:Room):PublicRoom {
  const game=room.game;
  const required=game?new Set([activePlayer(game).id,actingPlayer(game).id,...(game.phase==='trade'&&game.trade?[game.trade.partnerId]:[])]):new Set<string>();
  if(game?.phase==='order-ready')required.add(room.hostId);
  const card=room.presentation&&nextPresentationCard(room.presentation);if(card?.actorId)required.add(card.actorId);
  for(const id of required)if(game?.players.find(p=>p.id===id)?.bankrupt)required.delete(id);
  const missing=room.members.filter(m=>required.has(m.id)&&!m.connected);
  return {code:room.code,hostId:room.hostId,capacity:room.capacity,players:room.members.map(({id,name,token,ready,connected})=>({id,name,token,ready,connected})),game:game?publicGame(game):null,paused:game&&game.phase!=='finished'&&missing.length?`Waiting for ${missing.map(m=>m.name).join(', ')} to reconnect.`:null,animationRemainingMs:Math.max(0,room.busyUntil-this.now()),presentation:room.presentation??null,cardReadyInMs:card?Math.max(0,room.busyUntil-this.now()):0};
 }
 snapshot(conn:Connection){return this.public(this.seat(conn).room);}
 command(conn:Connection,id:unknown,raw:unknown):{room:PublicRoom|null;session?:RoomSession;replacedSocket?:string} {
  ensure(typeof id==='string'&&/^[\w-]{8,80}$/.test(id),'Invalid request ID.');
  ensure(record(raw)&&typeof raw.type==='string','Malformed command.');
  const cmd=raw as unknown as OnlineCommand;
  if(cmd.type==='create'||cmd.type==='join'){
   ensure(!conn.roomCode,'Leave your current room first.');fields(raw,cmd.type==='create'?['type','name','token','capacity','reducedMotion']:['type','name','token','code','reducedMotion']);
   const m=this.member(conn,cmd.name,cmd.token,cmd.reducedMotion);m.seen.add(id);
   if(cmd.type==='create'){
    this.sweep();ensure(this.rooms.size<1000,'Server is full. Try again later.');let roomCode:string;do{roomCode=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[cryptoInt(32)]).join('');}while(this.rooms.has(roomCode));
    const room:Room={code:roomCode,hostId:m.id,capacity:capacity(cmd.capacity),members:[m],game:null,busyUntil:0,touched:this.now()};this.rooms.set(room.code,room);return this.join(conn,room,m);
   }
   const room=this.rooms.get(code(cmd.code));ensure(room,'Room not found.');this.lobby(room);ensure(room.members.length<room.capacity,'This room is full.');ensure(!room.members.some(p=>p.token===m.token),'That token is already taken.');room.members.push(m);return this.join(conn,room,m);
  }
  if(cmd.type==='resume'){
   fields(raw,['type','code','secret','reducedMotion']);ensure(!conn.roomCode,'Already in a room.');const room=this.rooms.get(code(cmd.code));ensure(room,'Room expired or server restarted.');ensure(typeof cmd.secret==='string'&&/^[a-f0-9]{64}$/.test(cmd.secret),'Invalid session.');const m=room.members.find(m=>m.secret===cmd.secret);ensure(m,'Session not found.');const replacedSocket=m.socketId??undefined;m.socketId=conn.id;m.connected=true;m.reducedMotion=cmd.reducedMotion===true;return {...this.join(conn,room,m),replacedSocket};
  }
  const {room,member}=this.seat(conn);ensure(!member.seen.has(id),'Duplicate request.');member.seen.add(id);if(member.seen.size>512)member.seen.delete(member.seen.values().next().value!);room.touched=this.now();
  if(cmd.type==='leave'){
   fields(raw,['type']);if(room.game){member.connected=false;member.socketId=null;}else{room.members=room.members.filter(m=>m.id!==member.id);if(room.hostId===member.id)room.hostId=room.members.find(m=>m.connected)?.id??room.members[0]?.id??'';}
   delete conn.roomCode;delete conn.playerId;if(!room.members.length)this.rooms.delete(room.code);return {room:null};
  }
  if(cmd.type==='continue-card'){
   fields(raw,['type','revision','eventId']);const p=room.presentation,card=p&&nextPresentationCard(p);
   ensure(p&&card&&Number.isSafeInteger(cmd.revision)&&cmd.revision===p.revision&&Number.isSafeInteger(cmd.eventId)&&cmd.eventId===card.id,'This card has already continued or is no longer pending.');
   ensure(card.actorId===member.id,'Only the drawing player may continue this card.');
   ensure(this.now()>=room.busyUntil,'Wait for the token to reach the card space.');
   p.acknowledged.push(card.id);
   room.busyUntil=this.now()+(room.members.every(m=>m.reducedMotion)?0:presentationSegmentDuration(p,card.id));
   return {room:this.public(room)};
  }
  if(cmd.type==='action'){
   fields(raw,['type','action']);ensure(room.game,'Start the match first.');ensure(!this.public(room).paused,this.public(room).paused??'Match paused.');ensure(this.now()>=room.busyUntil,'Wait for movement to finish.');
   const intent=cmd.action as GameIntent;if(intent?.type==='START_GAME')this.host(room,member);
   const action=serverAction(intent,member.id,this.entropy);
   ensure(!room.presentation||!nextPresentationCard(room.presentation),'Wait for the drawing player to continue the card.');
   const previous=room.game,result=presentAction(previous,action);room.game=result.game;room.presentation=result.presentation;
   const frames=playbackFrames(room.game.log.filter(e=>e.id>(previous.log[0]?.id??0)));
   room.busyUntil=this.now()+(room.members.every(m=>m.reducedMotion)?0:room.presentation?presentationSegmentDuration(room.presentation):frames.reduce((n,f)=>n+f.duration,0));
   return {room:this.public(room)};
  }
  this.lobby(room);
  switch(cmd.type){
   case 'ready':fields(raw,['type','ready']);ensure(typeof cmd.ready==='boolean','Invalid ready status.');member.ready=cmd.ready;break;
   case 'token':fields(raw,['type','token']);ensure(!member.ready,'Unready before changing your token.');ensure(!room.members.some(m=>m.id!==member.id&&m.token===token(cmd.token)),'That token is already taken.');member.token=token(cmd.token);break;
   case 'capacity':fields(raw,['type','capacity']);this.host(room,member);ensure(capacity(cmd.capacity)>=room.members.length,'Capacity is below the current player count.');room.capacity=cmd.capacity;break;
   case 'remove':fields(raw,['type','playerId']);this.host(room,member);ensure(room.members.some(m=>m.id===cmd.playerId&&!m.connected),'Only disconnected lobby players can be removed.');room.members=room.members.filter(m=>m.id!==cmd.playerId);break;
   case 'start':fields(raw,['type']);this.host(room,member);ensure(room.members.length>=2&&room.members.every(m=>m.connected&&m.ready),'At least two players must be connected and everyone must be ready.');room.game=createOnlineGame(room.members);break;
   default:throw new Error('Unknown room command.');
  }
  return {room:this.public(room)};
 }
 disconnect(conn:Connection):PublicRoom|null {
  if(!conn.roomCode)return null;
  try{const {room,member}=this.seat(conn);member.connected=false;member.socketId=null;room.touched=this.now();if(!room.game&&room.hostId===member.id)room.hostId=room.members.find(m=>m.connected)?.id??member.id;return this.public(room);}catch{return null;}
 }
 roomSnapshot(roomCode:string):PublicRoom|null{const room=this.rooms.get(roomCode);return room?this.public(room):null;}
 sweep(){for(const [code,room]of this.rooms)if(room.members.every(m=>!m.connected)&&this.now()-room.touched>6*60*60*1000)this.rooms.delete(code);}
}
