import {useState} from 'react';
import {TOKENS,type TokenId} from '@property-tycoon/shared';
import {GameTable} from './GameTable';
import {Token} from './Token';
import {ViewerContext} from './Viewer';
import {useOnline} from './useOnline';
import {AppHeader} from './AppHeader';
export function OnlineApp({onOffline}:{onOffline:()=>void}){
 const online=useOnline();const {room,session,connected,checking,pending,error,send}=online;
 const invite=room?new URL(`?room=${room.code}`,location.href).href:'';
 const copyInvite=async()=>{try{if(navigator.clipboard)await navigator.clipboard.writeText(invite);else{const input=document.querySelector<HTMLInputElement>('#invite-link');input?.select();if(!document.execCommand('copy'))throw new Error('Copy unavailable');}setCopied(true);}catch{setCopied(false);document.querySelector<HTMLInputElement>('#invite-link')?.select();}};
 const [name,setName]=useState(''),[token,setToken]=useState<TokenId>('circle'),[capacity,setCapacity]=useState(4),[code,setCode]=useState(new URLSearchParams(location.search).get('room')??''),[joining,setJoining]=useState(!!code),[copied,setCopied]=useState(false);
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const leave=()=>{void online.leave().then(onOffline);};
 const me=room?.players.find(p=>p.id===session?.playerId),host=room?.hostId===me?.id;
 const tokens=<div className="token-options">{TOKENS.map(t=><button type="button" key={t.id} aria-label={`${t.name} token`} disabled={pending||me?.ready||!!room?.players.some(p=>p.id!==me?.id&&p.token===t.id)} aria-pressed={(me?.token??token)===t.id} className={(me?.token??token)===t.id?'selected':''} onClick={()=>{setToken(t.id);if(room)void send({type:'token',token:t.id});}}><Token id={t.id}/></button>)}</div>;
 const connection=<div className="online-status" role="status"><span className={`status-dot ${connected?'':'disconnected'}`}/>{connected?room?.paused??`Connected${room?` · Room ${room.code}`:''}`:checking?'Checking game server…':'Disconnected · reconnecting…'}{error&&<span role="alert">{error}</span>}</div>;
 if(room?.game&&me)return <ViewerContext.Provider value={{online:true,playerId:me.id,hostId:room.hostId,blocked:online.blocked}}><div className="online-table">{connection}<GameTable key={room.code} game={room.game} generation={1} error={error} dispatch={online.dispatch} onSetup={leave} onNewGame={leave} botsEnabled={false}/></div></ViewerContext.Provider>;
 return <div className="app"><AppHeader/><main className="online-setup"><section className="panel online-panel">{connection}<h1>{room?'Your private table':'Play online'}</h1>
 {error&&<p className="error-note" role="alert">{error}</p>}
 {room?<>
  <div className="room-heading"><h2>Room <strong>{room.code}</strong></h2><button className="secondary" onClick={()=>void copyInvite()}>Copy invite link</button>{copied&&<small>Invite copied</small>}</div>
  <label className="field-label" htmlFor="invite-link">Invite link</label><input id="invite-link" readOnly value={invite} onFocus={e=>e.target.select()}/><ul className="lobby-players">{room.players.map(p=><li key={p.id}><Token id={p.token} size={25}/><strong>{p.name}{p.id===me?.id?' (you)':''}</strong><span>{p.id===room.hostId?'Host · ':''}{p.connected?p.ready?'Ready':'Not ready':'Disconnected'}</span>{host&&!p.connected&&<button className="secondary" disabled={pending} onClick={()=>void send({type:'remove',playerId:p.id})}>Remove</button>}</li>)}</ul>
  {host&&<label className="field-label">Room capacity<select aria-label="Room capacity" value={room.capacity} disabled={pending} onChange={e=>void send({type:'capacity',capacity:Number(e.target.value)})}>{[2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>}
  <p>Choose an available token, then ready up.</p>{tokens}
  <div className="action-row"><button className="secondary" disabled={!connected||pending} onClick={()=>void send({type:'ready',ready:!me?.ready})}>{me?.ready?'Not ready':'Ready'}</button>{host&&<button className="primary" disabled={pending||room.players.length<2||!room.players.every(p=>p.ready&&p.connected)} onClick={()=>void send({type:'start'})}>Start match</button>}</div>
 </>:<>
  {session&&<p>Your saved seat is in room {session.code}. <button className="secondary" disabled={!connected||pending} onClick={()=>void send({type:'resume',code:session.code,secret:session.secret,reducedMotion})}>Reconnect to table</button><button className="text-button" onClick={online.forget}>Forget saved seat</button></p>}
  <div className="action-row"><button className="secondary" aria-pressed={!joining} onClick={()=>setJoining(false)}>Create room</button><button className="secondary" aria-pressed={joining} onClick={()=>setJoining(true)}>Join room</button></div>
  <form onSubmit={e=>{e.preventDefault();void send(joining?{type:'join',code,name,token,reducedMotion}:{type:'create',name,token,capacity,reducedMotion});}}>
   {joining&&<><label className="field-label" htmlFor="room-code">Room code</label><input id="room-code" value={code} maxLength={6} required onChange={e=>setCode(e.target.value.toUpperCase())}/></>}
   <label className="field-label" htmlFor="online-name">Your name</label><input id="online-name" value={name} required maxLength={24} pattern=".*\S.*" autoComplete="nickname" onChange={e=>setName(e.target.value)}/>
   {!joining&&<label className="field-label">Maximum players<select aria-label="Maximum players" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>}
   <div className="field-label">Your token</div>{tokens}<button className="primary" disabled={!connected||pending||!!session} type="submit">{joining?'Join table':'Create table'}</button>
  </form>
 </>}
 <button className="text-button" onClick={room?leave:onOffline}>{room?'Leave room':'Return to offline setup'}</button>
 </section></main></div>;
}
