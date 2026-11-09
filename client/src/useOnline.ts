import {useCallback,useEffect,useRef,useState} from 'react';
import {io,type Socket} from 'socket.io-client';
import {isCommandReply,isServerIdentity,ONLINE_EVENTS} from '@property-tycoon/shared';
import type {GameAction,GameIntent,OnlineCommand,PublicRoom,RoomSession} from '@property-tycoon/shared';
const KEY='property-tycoon-room';
export function savedSession():RoomSession|null{try{return JSON.parse(sessionStorage.getItem(KEY)??'null');}catch{return null;}}
export function useOnline(){
 const verified=useRef<string|null>(null);
 const socket=useRef<Socket|null>(null),sessionRef=useRef(savedSession());
 const [session,setSession]=useState(sessionRef.current),[room,setRoom]=useState<PublicRoom|null>(null),[connected,setConnected]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState<string|null>(null),[pending,setPending]=useState(false),[animationBlocked,setAnimationBlocked]=useState(false);
 const receive=useCallback((next:PublicRoom|null)=>setRoom(old=>next?{...next,game:old?.code===next.code&&old.game?.revision===next.game?.revision?old.game:next.game}:null),[]);
 const send=useCallback(async(command:OnlineCommand):Promise<boolean>=>{
  const client=socket.current;
  if(!client?.connected||verified.current!==client.id){setError('The Property Tycoon server is unavailable or has not been verified. Check the backend address.');return false;}
  const connectionId=client.id;setPending(true);setError(null);
  return new Promise(resolve=>{
   try{
    client.timeout(8000).emit(ONLINE_EVENTS.command,{id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'),command},(timeout:Error|null,result:unknown)=>{
     setPending(false);
     if(client.id!==connectionId){setError('Connection changed before the reply arrived. Reconnect to recover your seat.');resolve(false);return;}
     if(timeout){setError('The game server did not acknowledge the request within 8 seconds. Check the backend address, then reconnect.');resolve(false);return;}
     if(!isCommandReply(result)){setError('The server returned an invalid room reply. Check that the frontend and backend versions match.');resolve(false);return;}
     if(!result.ok){setError(result.error);resolve(false);return;}
     if(result.session){
      sessionRef.current=result.session;setSession(result.session);
      try{sessionStorage.setItem(KEY,JSON.stringify(result.session));}catch{setError('Joined the room, but this browser could not save your reconnect session.');}
     }
     receive(result.room);resolve(true);
    });
   }catch(error){setPending(false);setError(error instanceof Error?error.message:'Could not send the room request.');resolve(false);}
  });
 },[receive]);
 useEffect(()=>{
  const serverUrl=import.meta.env.VITE_SERVER_URL?.trim()||undefined;
  if(import.meta.env.PROD&&!serverUrl){setChecking(false);setError('Online mode requires VITE_SERVER_URL to be configured when building the frontend.');return;}
  const client=io(serverUrl,{autoConnect:false});socket.current=client;
  client.on(ONLINE_EVENTS.room,(room:PublicRoom)=>{if(verified.current===client.id)receive(room);});
  client.on(ONLINE_EVENTS.error,(reply:unknown)=>{if(isCommandReply(reply)&&!reply.ok){setPending(false);setError(reply.error);}});
  client.on('connect',()=>{
   const connectionId=client.id;verified.current=null;setConnected(false);setChecking(true);setError(null);
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
  client.on('disconnect',()=>{verified.current=null;setConnected(false);setChecking(false);setPending(false);});
  client.on('connect_error',()=>{verified.current=null;setConnected(false);setChecking(false);setError('Cannot reach the game server. Check the server address and connection.');});
  client.connect();return()=>{verified.current=null;client.disconnect();socket.current=null;};
 },[receive,send]);
 useEffect(()=>{setAnimationBlocked(!!room&&room.animationRemainingMs>0);if(!room?.animationRemainingMs)return;const timer=window.setTimeout(()=>setAnimationBlocked(false),room.animationRemainingMs+30);return()=>clearTimeout(timer);},[room]);
 const dispatch=useCallback((action:GameAction)=>{
  const {actorId:_actor,dice:_dice,cardDraw:_card,entropy:_entropy,...intent}=action as GameAction&{dice?:unknown;cardDraw?:unknown;entropy?:unknown};
  void send({type:'action',action:intent as GameIntent});
 },[send]);
 const leave=useCallback(async()=>{if(room)await send({type:'leave'});if(!room?.game||room.game.phase==='finished'){sessionStorage.removeItem(KEY);sessionRef.current=null;setSession(null);}receive(null);},[room,send,receive]);
 const forget=()=>{sessionStorage.removeItem(KEY);sessionRef.current=null;setSession(null);receive(null);setError(null);};
 return {room,session,connected,checking,error,pending,blocked:!connected||pending||!!room?.paused||animationBlocked,send,dispatch,leave,forget};
}
