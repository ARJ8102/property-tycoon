import {useCallback,useEffect,useRef,useState} from 'react';
import {io,type Socket} from 'socket.io-client';
import {isCommandReply,isServerIdentity,ONLINE_EVENTS} from '@property-tycoon/shared';
import type {GameAction,GameIntent,OnlineCommand,PublicRoom,RoomSession,SeatDirectory} from '@property-tycoon/shared';
const KEY='property-tycoon-room';
export function savedSession():RoomSession|null{
 try{const value:unknown=JSON.parse(sessionStorage.getItem(KEY)??'null');
  if(value&&typeof value==='object'&&'code'in value&&'playerId'in value&&'secret'in value&&typeof value.code==='string'&&/^[A-Z2-9]{6}$/.test(value.code)&&typeof value.playerId==='string'&&value.playerId.length>0&&typeof value.secret==='string'&&/^[a-f0-9]{64}$/.test(value.secret))return {code:value.code,playerId:value.playerId,secret:value.secret};
  sessionStorage.removeItem(KEY);
 }catch{try{sessionStorage.removeItem(KEY);}catch{}}return null;
}
export function useOnline(){
 const [closed,setClosed]=useState(false);
 const [directory,setDirectory]=useState<SeatDirectory|null>(null);
 const verified=useRef<string|null>(null),inFlight=useRef<null|(()=>void)>(null);
 const socket=useRef<Socket|null>(null),sessionRef=useRef(savedSession());
 const [session,setSession]=useState(sessionRef.current),[room,setRoom]=useState<PublicRoom|null>(null),[connected,setConnected]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState<string|null>(null),[pending,setPending]=useState(false),[animationBlocked,setAnimationBlocked]=useState(false);
 const receive=useCallback((next:PublicRoom|null)=>setRoom(old=>next?{...next,game:old?.code===next.code&&old.game?.revision===next.game?.revision?old.game:next.game}:null),[]);
 const send=useCallback(async(command:OnlineCommand):Promise<boolean>=>{
  const client=socket.current;
  if(inFlight.current){setError('A request is already pending. Wait for synchronization.');return false;}
  if(!client?.connected){setError('Socket disconnected. Reconnecting to the game server; no command was sent.');return false;}
  if(verified.current!==client.id){setError('The game server has not been verified yet. Wait for the connection check.');return false;}
  const connectionId=client.id;setPending(true);setError(null);
  return new Promise(resolve=>{
   let settled=false;
   const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);inFlight.current=null;setPending(false);resolve(ok);};
   const timer=window.setTimeout(()=>{
    if(settled)return;
    setError('Command acknowledgment timed out after 8 seconds. Its outcome is unknown; reconnecting to synchronize. The action will not be retried.');
    finish(false);
    // Recover authoritative state, never replay a possibly committed financial action.
    client.disconnect().connect();
   },8000);
   inFlight.current=()=>finish(false);
   try{
    // Emit only on the verified live connection; never automatically retry commands.
    client.emit(ONLINE_EVENTS.command,{id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'),command},(result:unknown)=>{
     if(settled||client.id!==connectionId)return;
     if(!isCommandReply(result)){setError('The server returned an invalid room reply. Check that the frontend and backend versions match.');finish(false);return;}
     if(!result.ok){setError(result.error);if(command.type==='resume'){receive(null);sessionRef.current=null;setSession(null);try{sessionStorage.removeItem(KEY);}catch{}}finish(false);return;}
     if(result.session){
      sessionRef.current=result.session;setSession(result.session);
      try{sessionStorage.setItem(KEY,JSON.stringify(result.session));}catch{setError('Joined the room, but this browser could not save your reconnect session.');}
     }
     if(result.directory)setDirectory(result.directory);else receive(result.room);finish(true);
    });
   }catch(error){setError(error instanceof Error?error.message:'Could not send the room request.');finish(false);}
  });
 },[receive]);
 useEffect(()=>{
  const serverUrl=import.meta.env.VITE_SERVER_URL?.trim()||undefined;
  if(import.meta.env.PROD&&!serverUrl){setChecking(false);setError('Online mode requires VITE_SERVER_URL to be configured when building the frontend.');return;}
  const client=io(serverUrl,{autoConnect:false});socket.current=client;
  const released=()=>{sessionRef.current=null;setSession(null);receive(null);try{sessionStorage.removeItem(KEY);}catch{}const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);};
  client.on('seat-released',()=>{released();setError('Your seat was released by the host. Return using the room code.');});
  client.on('room-closed',()=>{setClosed(true);sessionRef.current=null;setSession(null);receive(null);try{sessionStorage.removeItem(KEY);}catch{}const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);setError('The host closed this room.');});
  client.on(ONLINE_EVENTS.room,(room:PublicRoom)=>{if(verified.current===client.id)receive(room);});
  client.on(ONLINE_EVENTS.error,(reply:unknown)=>{if(isCommandReply(reply)&&!reply.ok)setError(reply.error);});
  client.on('connect',()=>{
   const connectionId=client.id;verified.current=null;setConnected(false);setChecking(true);
   client.timeout(3000).emit(ONLINE_EVENTS.identify,(timeout:Error|null,identity:unknown)=>{
    if(socket.current!==client||!client.connected||client.id!==connectionId)return;
    setChecking(false);
    if(timeout||!isServerIdentity(identity)){
     setError('Connected to a Socket.IO server, but it is not a compatible Property Tycoon backend. Start the game backend and check DEV_SERVER_URL or VITE_SERVER_URL.');
     return;
    }
    verified.current=connectionId??null;setConnected(true);
    const saved=sessionRef.current;if(saved)void send({type:'resume',code:saved.code,secret:saved.secret,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
   });
  });
  client.on('disconnect',reason=>{if(reason==='io server disconnect')client.connect();console.info('[Property Tycoon] Disconnected',{reason});client.sendBuffer=[];inFlight.current?.();verified.current=null;setConnected(false);setChecking(false);setPending(false);});
  client.on('connect_error',()=>{verified.current=null;setConnected(false);setChecking(false);setError('Cannot reach the game server. Check the server address and connection.');});
  client.connect();return()=>{inFlight.current?.();verified.current=null;client.disconnect();socket.current=null;};
 },[receive,send]);
 useEffect(()=>{setAnimationBlocked(!!room&&room.animationRemainingMs>0);if(!room?.animationRemainingMs)return;const timer=window.setTimeout(()=>setAnimationBlocked(false),room.animationRemainingMs+30);return()=>clearTimeout(timer);},[room]);
 const dispatch=useCallback((action:GameAction)=>{
  const {actorId:_actor,dice:_dice,cardDraw:_card,entropy:_entropy,...intent}=action as GameAction&{dice?:unknown;cardDraw?:unknown;entropy?:unknown};
  void send({type:'action',action:intent as GameIntent});
 },[send]);
 const forget=useCallback(()=>{
  inFlight.current?.();
  try{sessionStorage.removeItem(KEY);}catch{}
  sessionRef.current=null;setSession(null);receive(null);setError(null);
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  // Disconnect the old seat even when its last request has not acknowledged.
  socket.current?.disconnect().connect();
 },[receive]);
 const reconnect=useCallback(()=>{socket.current?.disconnect().connect();},[]);
 const quit=useCallback(async()=>{const ok=await send({type:'quit'});if(ok)forget();return ok;},[send,forget]);
 useEffect(()=>{if(room&&session&&room.players.find(p=>p.id===session.playerId)?.retired)forget();},[room,session,forget]);
 const leave=useCallback(async()=>{
  const client=socket.current;
  try{
   if(client?.connected&&verified.current===client.id)client.emit(ONLINE_EVENTS.command,{id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'),command:{type:'leave'}},()=>{});
  }catch{/* Local exit must remain available even if transport submission fails. */}
  finally{forget();}
 },[forget]);
 return {closed,directory,room,session,connected,checking,error,pending,blocked:!connected||pending||!!session&&!room||!!room?.paused||animationBlocked,send,dispatch,leave,quit,forget,reconnect};
}
