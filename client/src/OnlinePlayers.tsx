import {useEffect,useState} from 'react';
import type {PublicRoom} from '@property-tycoon/shared';
import {Modal} from './Modal';
/** Durations are based on the server's elapsed time, so client clock skew is harmless. */
export function OnlinePlayers({room,playerId,pending,onRemove,open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void;room:PublicRoom;playerId?:string;pending:boolean;onRemove:(id:string)=>Promise<boolean>}){
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{setElapsed(0);const start=Date.now(),timer=window.setInterval(()=>setElapsed(Date.now()-start),1000);return()=>clearInterval(timer);},[room]);
 return <><button className="text-button" onClick={()=>onOpenChange(true)}>Players & Host</button>{open&&<Modal title="Players & Host" onClose={()=>onOpenChange(false)}><ul className="online-players">{room.players.map(p=>{
  const offline=(p.offlineForMs??0)+elapsed,seconds=Math.floor(offline/1000);
  return <li key={p.id}><strong>{p.name}{p.id===room.hostId?' · Host':''}</strong><span>{p.retired?'Retired':p.connected?'Online':`Offline · ${Math.floor(seconds/60)}m ${seconds%60}s`}</span>
   {room.hostId===playerId&&!p.connected&&!p.retired&&<button className="secondary" disabled={pending||offline<120000} onClick={async()=>{if(window.confirm(`Remove ${p.name} permanently? Their retirement will return assets to the bank, or settle their outstanding debt under the bankruptcy rules.`)&&await onRemove(p.id))onOpenChange(false);}}>Remove {p.name}</button>}
  </li>;
 })}</ul></Modal>}</>;
}
