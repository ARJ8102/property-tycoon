import { actingPlayer, EVENT_LABELS, formatGameEvent, type GameEvent, type GameAction, type GameState } from '@property-tycoon/shared';
import { AnnouncementText } from './AnnouncementText';
import { PurchaseDialog } from './PurchaseDialog';
export function AnnouncementCenter({game,event,dismiss,dispatch,onPortfolios,hidden=false,dismissible=true}: {game:GameState;event:GameEvent|null;dismiss:()=>void;dispatch:(a:GameAction)=>void;onPortfolios:()=>void;hidden?:boolean;dismissible?:boolean}) {
 if(hidden)return null;
 const debtor=actingPlayer(game);
 return <div className="announcement-layer" aria-live="polite" aria-atomic="true">
 {event?<article className={`announcement-card ${event.card?'event-card':''}`} key={event.id} data-event-id={event.id}>
  <div className="announcement-heading"><span>{event.card?.deck??EVENT_LABELS[event.category]}</span>{dismissible&&<button type="button" aria-label="Dismiss announcement" onClick={dismiss}>×</button>}</div>
  {event.card&&<><h3>{event.card.title}</h3><p><AnnouncementText text={event.card.text} game={game}/></p></>}
  {event.card?<small><strong>{event.actorName}</strong> · Turn {event.turn}</small>:<p><AnnouncementText text={formatGameEvent(event)} game={game}/></p>}
  {event.cashTransfers&&<div className="transaction-transfers">{event.cashTransfers.map((t,i)=><div key={i} className="transaction-transfer">{t.from&&<span className="cash-out">{game.players.find(p=>p.id===t.from)?.name} −${t.amount}</span>}{t.to&&<span className="cash-in">{game.players.find(p=>p.id===t.to)?.name} +${t.amount}</span>}</div>)}</div>}
 </article>:game.phase==='purchase'?<PurchaseDialog game={game} dispatch={dispatch}/>:game.phase==='debt'?<article className="announcement-card interactive"><h3>Payment outstanding</h3><p><AnnouncementText text={game.log.find(e=>e.category==='penalties')?.message??''} game={game}/></p>{!debtor.isBot&&<button className="secondary" onClick={onPortfolios}>Open Player Portfolios</button>}</article>:null}
 </div>;
}
