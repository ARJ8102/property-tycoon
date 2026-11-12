import { OnlineApp } from './OnlineApp';
import { savedSession } from './useOnline';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TOKENS, type TokenId } from '@property-tycoon/shared';
import { Token } from './Token';
import { Board } from './Board';
import { GameTable } from './GameTable';
import { AppHeader } from './AppHeader';
import { useGame } from './useGame';
import { RulesModal } from './RulesModal';
import './styles.css';
function App(){
 const [online,setOnline]=useState(()=>!!savedSession()||new URLSearchParams(location.search).has('room'));
 const [name,setName]=useState(''),[count,setCount]=useState(3),[token,setToken]=useState<TokenId>('circle'),[rulesOpen,setRulesOpen]=useState(false);
 const {game,presentation,error,generation,dispatch,start,reset}=useGame();
 if(online)return <OnlineApp onOffline={()=>{setOnline(false);const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);}}/>;
 if(game)return <GameTable key={generation} game={game} cardPresentation={presentation} error={error} generation={generation} dispatch={dispatch} onNewGame={()=>start({humanName:name,token,playerCount:count})} onSetup={reset}/>;
 return <div className="app">{rulesOpen&&<RulesModal onClose={()=>setRulesOpen(false)}/>}<AppHeader/>
 <main><div className="intro"><div><div className="eyebrow"><span/> THE WORLD IS YOUR BOARD</div><h1>Build your next big thing.</h1><p>Pick your piece, bring your ambition, and make yourself at home.</p></div><span className="edition-badge">40 spaces.<br/><b>Endless possibility.</b></span></div>
 <div className="game-layout"><section className="table-area" aria-label="Game board"><div className="table-heading"><span>WORLD CITY BOARD</span><button className="rules-button" onClick={()=>setRulesOpen(true)}>Rules</button></div><Board game={null}/><p className="board-scroll-hint">Scroll the board sideways to explore all 40 spaces.</p></section><aside><section className="panel"><div className="panel-top"><span className="eyebrow">LET’S GET YOU SETTLED</span><h2>Set up your table</h2><p>A good empire starts with good company.</p></div><div className="mode-picker"><span className="active-mode"><span className="status-dot"/> Offline</span><button type="button" className="online-mode" onClick={()=>setOnline(true)}>Online <small>PRIVATE ROOMS</small></button>{savedSession()&&<button type="button" className="text-button" onClick={()=>setOnline(true)}>Rejoin Previous Game</button>}</div><form onSubmit={e => {e.preventDefault(); start({humanName:name,token,playerCount:count});}}><label className="field-label" htmlFor="player-name">Your name <span>THE FUTURE TYCOON</span></label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} maxLength={24} required pattern=".*\S.*" placeholder="Enter your name" autoComplete="nickname"/><div className="field-label">Players at the table <span>YOU + BOTS</span></div><div className="player-options">{[2,3,4].map(n=><button type="button" key={n} aria-pressed={count===n} className={count===n?'selected':''} onClick={()=>setCount(n)}><b>{n}</b><span>{n-1} {n===2?'bot':'bots'}</span></button>)}</div><div className="field-label">Choose your token <span>{TOKENS.find(t=>t.id===token)!.name.toUpperCase()}</span></div><div className="token-options">{TOKENS.map(t=><button type="button" key={t.id} title={t.name} aria-label={`${t.name} token`} aria-pressed={token===t.id} onClick={()=>setToken(t.id)} className={token===t.id?'selected':''}><Token id={t.id}/></button>)}</div><p className="hint">A little shape. A lot of personality.<br/>Bots get their own unique tokens automatically.</p><button className="primary" type="submit">Create game <span>↗</span></button><p className="setup-note">No account needed. Just a seat at the table.</p></form></section></aside></div></main><footer><span>PROPERTY TYCOON © 2026</span><span>MADE FOR GAME NIGHT ↗</span></footer></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
