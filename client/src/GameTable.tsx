import {CardDialog} from './CardDialog';
import {useCardPlayback} from './useCardPlayback';
import { InheritanceDialog } from './InheritanceDialog';
import { AuctionDialog } from './AuctionDialog';
import { useViewer } from './Viewer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mayProposeTrade, actingPlayer, activePlayer, isOrderPhase, type CardPresentation, type GameAction, type GameState } from '@property-tycoon/shared';
import { Board } from './Board';
import { WinnerDialog } from './WinnerDialog';
import { AnnouncementCenter } from './AnnouncementCenter';
import { useAnnouncements } from './useAnnouncements';
import { usePresentation } from './usePresentation';
import { useBotTurn } from './useGame';
import { TradeDialog } from './TradeDialog';
import { TurnOrderDialog } from './TurnOrderDialog';
import { TurnOrderPanel } from './TurnOrderPanel';
import { PlayerLeaderboard } from './PlayerLeaderboard';
import { Dashboard } from './Dashboard';
import { EventLog } from './EventLog';
import { TurnControls } from './TurnControls';
import { PropertyDialog } from './PropertyDialog';
import { BankPanel } from './BankPanel';
import { Modal } from './Modal';
import { RulesModal } from './RulesModal';
interface Props {game:GameState;generation:number;dispatch:(a:GameAction)=>void;error?:string|null;onNewGame:()=>void;onSetup:()=>void;botsEnabled?:boolean;cardPresentation?:CardPresentation|null}
export function GameTable({game,generation,dispatch,error,onNewGame,onSetup,botsEnabled=true,cardPresentation}:Props){
 const viewer=useViewer(game);
 const tableRef=useRef<HTMLDivElement>(null);
 const [rulesOpen,setRulesOpen]=useState(false);
 const [propertyId,setPropertyId]=useState<number|null>(null);
 const [portfolioPlayerId,setPortfolioPlayerId]=useState(viewer.human.id);
 const [panel,setPanel]=useState<'portfolios'|'history'|'bank'|null>(null);
 const [tradeOpen,setTradeOpen]=useState(false);
 const cards=useCardPlayback(cardPresentation,generation,viewer.online?viewer.continueCard:undefined);
 const movement=usePresentation(game,generation,cards.active);
 const staged=cards.active?(cards.view??{snapshot:cardPresentation!.before,positions:Object.fromEntries(cardPresentation!.before.players.map(p=>[p.id,p.position])),dice:cardPresentation!.before.dice,rolling:false,event:null,landing:null}):null;
 const presentation={...movement,...(staged?{game:staged.snapshot,positions:staged.positions,dice:staged.dice,rolling:staged.rolling,busy:true}:{} )};
 const [landing,setLanding]=useState<number|null>(null);
 const landingTimer=useRef<number|undefined>(undefined);
 const wasBusy=useRef(false);
 const seenLanding=useRef({generation,id:game.log[0]?.id??0});
 useEffect(()=>{
  const freshMovement=seenLanding.current.generation===generation?game.log.find(e=>e.id>seenLanding.current.id&&e.movement):undefined;
  seenLanding.current={generation,id:game.log[0]?.id??0};
  const destination=cards.active?cards.view?.landing:movement.reduced?freshMovement?.movement?.to:wasBusy.current&&!presentation.busy?activePlayer(game).position:null;
  wasBusy.current=presentation.busy;
  if(destination==null)return;
  clearTimeout(landingTimer.current);setLanding(destination);landingTimer.current=window.setTimeout(()=>setLanding(null),1000);
 },[cards.view?.landing,cards.active,presentation.busy,game,generation,movement.reduced]);
 useEffect(()=>()=>clearTimeout(landingTimer.current),[]);
 useEffect(()=>{
  const event=cards.view?.event;if(!cards.active||!event?.card||viewer.online||!game.players.find(p=>p.id===event.actorId)?.isBot)return;
  const timer=window.setTimeout(()=>void cards.continueCard(),850);return()=>clearTimeout(timer);
 },[cards.view?.event?.id,cards.active,viewer.online]);
 const viewGame=presentation.game??game;
 const act=useCallback((action:GameAction)=>{if(!presentation.busy&&!viewer.blocked&&(!viewer.online||action.actorId===viewer.human.id))dispatch(action);},[dispatch,presentation.busy,viewer.blocked,viewer.online,viewer.human.id]);
 const paused=rulesOpen||tradeOpen||panel!==null||propertyId!==null;
 const notices=useAnnouncements(game,generation,paused||presentation.busy,cardPresentation?.steps.map(s=>s.event.id));
 useBotTurn(game,act,!botsEnabled||paused||notices.pending>0||notices.catchingUp||presentation.busy);
 const visibleNotice=!paused&&!presentation.busy&&!notices.catchingUp?(notices.current?.id??(['purchase','debt'].includes(game.phase)?game.phase:null)):null;
 useEffect(()=>{
  if(visibleNotice===null)return;
  const shell=tableRef.current?.querySelector<HTMLElement>('.board-shell');
  if(shell&&shell.scrollWidth>shell.clientWidth)shell.scrollLeft=(shell.scrollWidth-shell.clientWidth)/2;
 },[visibleNotice]);
 const selectProperty=(id:number)=>{setPanel(null);setPropertyId(id);};
 return <div ref={tableRef} className="app playing" data-busy={presentation.busy} data-revision={game.revision}>
  {cards.active&&cards.view?.event?.card&&<CardDialog event={cards.view.event} game={viewGame} canContinue={!viewer.online||cards.view.event.actorId===viewer.human.id} disabled={cards.submitted||!!viewer.blocked} onContinue={()=>void cards.continueCard()}/>}
  {game.phase==='inheritance'&&game.inheritances[0]&&!presentation.busy&&!paused&&<InheritanceDialog game={game} dispatch={act}/>}
  {game.phase==='auction'&&game.auction&&!presentation.busy&&!paused&&<AuctionDialog game={game} dispatch={act}/>}
  {isOrderPhase(game)&&<TurnOrderDialog game={game} dispatch={act}/>}
  {propertyId!==null&&<PropertyDialog game={viewGame} propertyId={propertyId} dispatch={act} onClose={()=>setPropertyId(null)}/>}
  {game.phase==='finished'&&!notices.pending&&!notices.catchingUp&&!presentation.busy&&<WinnerDialog game={game} onNewGame={onNewGame} onSetup={onSetup}/>}
  {panel&&<Modal title={panel==='portfolios'?'Player Portfolios':panel==='history'?'Table History':'Bank'} onClose={()=>setPanel(null)}>
   {panel==='portfolios'?<Dashboard key={portfolioPlayerId} initialPlayerId={portfolioPlayerId} game={viewGame} dispatch={act} onPropertySelect={selectProperty} onTrade={()=>{setPanel(null);setTradeOpen(true);}}/>:panel==='history'?<EventLog game={viewGame}/>:<BankPanel game={viewGame} dispatch={act} onPropertySelect={selectProperty}/>}
  </Modal>}
  {tradeOpen&&<TradeDialog game={game} dispatch={act} onClose={()=>setTradeOpen(false)}/>}
  {viewer.online&&game.phase==='trade'&&game.trade?.partnerId===viewer.human.id&&!presentation.busy&&!paused&&<Modal title="Review trade" onClose={()=>act({type:'REJECT_TRADE',actorId:viewer.human.id,expectedRevision:game.revision,tradeId:game.trade!.id})}>
   <p>{game.players.find(p=>p.id===game.trade!.proposerId)?.name} offers {game.trade.offeredProperties.map(id=>game.spaces[id]!.name).join(', ')||'no properties'} and ${game.trade.offeredCash}.</p>
   <p>In return: {game.trade.requestedProperties.map(id=>game.spaces[id]!.name).join(', ')||'no properties'} and ${game.trade.requestedCash}. Mortgages remain attached.</p>
   <div className="action-row">{(['ACCEPT_TRADE','REJECT_TRADE'] as const).map(type=><button key={type} className="secondary" disabled={viewer.blocked} onClick={()=>act({type,actorId:viewer.human.id,expectedRevision:game.revision,tradeId:game.trade!.id})}>{type==='ACCEPT_TRADE'?'Accept trade':'Reject trade'}</button>)}</div>
  </Modal>}
  {rulesOpen&&<RulesModal onClose={()=>setRulesOpen(false)}/>}
  <main><div className="game-layout">
   <section className="table-area" aria-label="Game board"><div className="table-heading"><span><span className="status-dot"/> WORLD CITY BOARD</span><div className="table-heading-actions"><span>01 — 40</span><button type="button" className="rules-button" onClick={()=>setRulesOpen(true)}>Rules</button></div></div>
    <Board game={viewGame} positions={presentation.positions} busy={presentation.busy} inspection={presentation.inspection} landing={landing} onPropertySelect={selectProperty}>
     <AnnouncementCenter game={viewGame} event={staged?.event?.card?null:staged?.event??notices.current} dismissible={!cards.active} dismiss={notices.dismiss} dispatch={act} onPortfolios={()=>setPanel('portfolios')} hidden={paused||(!cards.active&&(presentation.busy||notices.catchingUp))||!!staged?.event?.card}/>
    </Board><p className="board-scroll-hint">Scroll the board sideways to explore all 40 spaces.</p>
   </section>
   <aside><section className="panel dashboard"><span className="eyebrow">{viewer.online?'ONLINE':'OFFLINE'} · {game.players.filter(p=>!p.bankrupt).length} ACTIVE</span>
    <TurnControls game={viewGame} dispatch={act} busy={presentation.busy||viewer.blocked} dice={presentation.dice} rolling={presentation.rolling}/>
    {error&&<p role="alert" className="error-note">{error}</p>}
    <PlayerLeaderboard game={viewGame} event={staged?.event} disabled={presentation.busy} onSelect={id=>{setPortfolioPlayerId(id);setPanel('portfolios');}}/>
    <TurnOrderPanel game={viewGame}/>
    <nav className="control-navigation" aria-label="Table controls">
     <button className="secondary" disabled={presentation.busy||!mayProposeTrade(game,viewer.human.id)||!viewer.canControl(actingPlayer(game).id)} onClick={()=>setTradeOpen(true)}>Trade</button>
     <button className="secondary" disabled={presentation.busy} onClick={()=>setPanel('history')}>Table History</button>
     <button className="secondary" disabled={presentation.busy} onClick={()=>setPanel('bank')}>Bank</button>
    </nav><button className="text-button" onClick={onSetup}>Return to Setup</button>
   </section></aside>
  </div></main>
 </div>;
}
