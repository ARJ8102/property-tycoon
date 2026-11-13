import {OnlinePlayers} from './OnlinePlayers';
import {useEffect,useRef,useState} from 'react';
import {TOKENS,type TokenId} from '@property-tycoon/shared';
import {GameTable} from './GameTable';
import {Token} from './Token';
import {ViewerContext} from './Viewer';
import {useOnline} from './useOnline';
import {AppHeader} from './AppHeader';
export function OnlineApp({onOffline}:{onOffline:(notice?:string)=>void}){
 const online=useOnline();const {room,session,connected,checking,pending,error,send}=online;
 useEffect(()=>{if(online.closed)onOffline('The host closed this room.');},[online.closed,onOffline]);
 const invite=room?new URL(`?room=${room.code}`,location.href).href:'';
 const copyInvite=async()=>{try{if(navigator.clipboard)await navigator.clipboard.writeText(invite);else{const input=document.querySelector<HTMLInputElement>('#invite-link');input?.select();if(!document.execCommand('copy'))throw new Error('Copy unavailable');}setCopied(true);}catch{setCopied(false);document.querySelector<HTMLInputElement>('#invite-link')?.select();}};
 const [name,setName]=useState(''),[token,setToken]=useState<TokenId>('circle'),[capacity,setCapacity]=useState(4),[code,setCode]=useState((new URLSearchParams(location.search).get('room')??'').trim().toUpperCase()),[joining,setJoining]=useState(!!code),[copied,setCopied]=useState(false);
 const discovered=useRef('');
 const [playersOpen,setPlayersOpen]=useState(false);
 useEffect(()=>{if(!joining||room||session||pending||discovered.current===code||online.directory?.code===code||!connected||!/^[A-Z2-9]{6}$/.test(code))return;const timer=window.setTimeout(()=>{discovered.current=code;void send({type:'lookup',code});},200);return()=>clearTimeout(timer);},[joining,code,room,session,pending,online.directory?.code,connected,send]);
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const leave=async()=>{if(room&&!window.confirm('Leave Room? Your seat becomes Away. Your player and all assets stay in the game; return using the room code.'))return;await online.leave();onOffline();};
 const vacate=async()=>{if(window.confirm('Vacate Seat? Another person with the room code can take control of your player and assets.')){if(await send({type:'vacate'})){online.forget();onOffline();}}};
 const quit=async()=>{if(!window.confirm('Retire From Game permanently? Your seat cannot be rejoined. Assets return to the bank for auction; outstanding debts follow bankruptcy rules.'))return;if(await online.quit())onOffline();};
 const me=room?.players.find(p=>p.id===session?.playerId),host=room?.hostId===me?.id;
 const tokens=<div className="token-options">{TOKENS.map(t=><button type="button" key={t.id} aria-label={`${t.name} token`} disabled={pending||me?.ready||!!room?.players.some(p=>p.id!==me?.id&&p.token===t.id)} aria-pressed={(me?.token??token)===t.id} className={(me?.token??token)===t.id?'selected':''} onClick={()=>{setToken(t.id);if(room)void send({type:'token',token:t.id});}}><Token id={t.id}/></button>)}</div>;
 const connection=<div className="online-status" role="status"><span className={`status-dot ${connected?'':'disconnected'}`}/>{connected?room?.paused??`Connected${room?` · Room ${room.code}`:''}`:checking?'Checking game server…':'Disconnected · reconnecting…'}{error&&<span role="alert">{error}</span>}{session&&!connected&&<button className="text-button" onClick={online.reconnect}>Rejoin Previous Game</button>}{room&&<OnlinePlayers open={playersOpen} onOpenChange={setPlayersOpen} room={room} playerId={me?.id} pending={pending} onRemove={playerId=>send({type:'retire',playerId})} onCommand={send}/>} {room?.game&&<><button className="text-button" onClick={leave}>Leave Room</button><button className="text-button" onClick={()=>void vacate()}>Vacate Seat</button>{room.game.phase!=='finished'&&<button className="text-button" disabled={!connected||pending} onClick={()=>void quit()}>Retire From Game</button>}</>}</div>;
 if(room?.ended&&me)return <div className="app"><AppHeader/><main className="online-setup"><section className="panel online-panel">{connection}<h1>The host ended this game.</h1>{host&&<button onClick={()=>void send({type:'lobby'})}>Return to room lobby</button>}<button onClick={leave}>Leave Room</button></section></main></div>;
 if(room?.game&&me)return <ViewerContext.Provider value={{online:true,playerId:me.id,hostId:room.hostId,blocked:online.blocked,onExit:leave,onVacate:()=>void vacate(),onPlayers:()=>setPlayersOpen(true),onQuit:room.game.phase!=='finished'?()=>void quit():undefined,continueCard:(revision,eventId)=>send({type:'continue-card',revision,eventId})}}><div className="online-table">{connection}<div className="seat-status" aria-label="Seat status">{room.players.map(p=><span key={p.id}>Seat {p.seat} · {p.name} · {p.retired?'Retired':p.connected?'Playing':'Away'} </span>)}</div><GameTable key={room.code} game={room.game} cardPresentation={room.presentation} generation={1} error={error} dispatch={online.dispatch} onSetup={leave} onNewGame={leave} botsEnabled={false}/></div></ViewerContext.Provider>;
 return <div className="app"><AppHeader/><main className="online-setup"><section className="panel online-panel">{connection}<h1>{room?'Your private table':'Play online'}</h1>
 {error&&<p className="error-note" role="alert">{error}</p>}
 {room?<>
  <div className="room-heading"><h2>Room <strong>{room.code}</strong></h2><button className="secondary" onClick={()=>void copyInvite()}>Copy invite link</button>{copied&&<small>Invite copied</small>}</div>
  <label className="field-label" htmlFor="invite-link">Invite link</label><input id="invite-link" readOnly value={invite} onFocus={e=>e.target.select()}/><ul className="lobby-players">{room.players.map(p=><li key={p.id}><Token id={p.token} size={25}/><strong>Seat {p.seat} · {p.name}{p.id===me?.id?' (you)':''}</strong><span>{p.id===room.hostId?'Host · ':''}{p.connected?p.ready?'Ready':'Not ready':'Disconnected'}</span><small>{p.connected?'Online':'Offline'}</small></li>)}</ul>
  {host&&<label className="field-label">Room capacity<select aria-label="Room capacity" value={room.capacity} disabled={pending} onChange={e=>void send({type:'capacity',capacity:Number(e.target.value)})}>{[2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>}
  <p>Choose an available token, then ready up.</p>{tokens}
  <div className="action-row"><button className="secondary" disabled={!connected||pending} onClick={()=>void send({type:'ready',ready:!me?.ready})}>{me?.ready?'Not ready':'Ready'}</button>{host&&<button className="primary" disabled={pending||room.players.length<2||!room.players.every(p=>p.ready&&p.connected)} onClick={()=>void send({type:'start'})}>Start match</button>}</div>
 </>:<>
  {session&&<p>Your saved seat is in room {session.code}. <button className="secondary" disabled={!connected||pending} onClick={()=>void send({type:'resume',code:session.code,secret:session.secret,reducedMotion})}>Rejoin Previous Game</button><button className="text-button" onClick={()=>{void online.leave();setJoining(false);setCode('');}}>Start a new online game</button></p>}
  <div className="action-row"><button className="secondary" aria-pressed={!joining} onClick={()=>setJoining(false)}>Create room</button><button className="secondary" aria-pressed={joining} onClick={()=>setJoining(true)}>Join room</button></div>
  <form onSubmit={e=>{e.preventDefault();if(joining)discovered.current=code;void send(joining?{type:'lookup',code}:{type:'create',name,token,capacity,reducedMotion});}}>
   {joining&&<><label className="field-label" htmlFor="room-code">Room code</label><input id="room-code" value={code} maxLength={6} required onChange={e=>setCode(e.target.value.toUpperCase())}/></>}
   <label className="field-label" htmlFor="online-name">Your name</label><input id="online-name" value={name} required={!joining} maxLength={24} pattern=".*\S.*" autoComplete="nickname" onChange={e=>setName(e.target.value)}/>
   {!joining&&<label className="field-label">Maximum players<select aria-label="Maximum players" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>}
   <div className="field-label">Your token</div>{tokens}<button className="primary" disabled={!connected||pending||!!session} type="submit">{joining?'Find seats':'Create table'}</button>
  </form>
  {joining&&online.directory?.code===code&&<ul className="lobby-players">{online.directory.seats.map(s=><li key={s.seat}>{s.player&&<Token id={s.player.token} size={25}/>}<strong>Seat {s.seat} · {s.player?.name??'Empty'}</strong><span>{s.locked?'Locked':s.player?.retired?'Retired':s.player?.connected?'Playing':s.player?'Away':'Empty'}{s.player?.id===online.directory?.hostId?' · Host':''}</span>{!s.locked&&!s.player?.retired&&!s.player?.connected&&(!!s.player||online.directory!.joining)&&<button className="secondary" disabled={pending||!connected} onClick={()=>void send({type:'claim',code:online.directory!.code,seat:s.seat,name,token,reducedMotion})}>Take Seat {s.seat}</button>}</li>)}</ul>}

 </>}
 {room&&<button className="text-button" disabled={pending} onClick={()=>void vacate()}>Vacate Seat</button>}<button className="text-button" onClick={leave}>{room?'Leave room':'Return to offline setup'}</button>
 </section></main></div>;
}
