import type {GameEvent,GameState} from '@property-tycoon/shared';
import {Modal} from './Modal';
import {AnnouncementText} from './AnnouncementText';
export function CardDialog({event,game,canContinue,disabled,onContinue}:{event:GameEvent;game:GameState;canContinue:boolean;disabled:boolean;onContinue:()=>void}){
 const card=event.card!;
 return <Modal title={`${card.deck} · ${card.title}`}><div className="drawn-card" data-card-event={event.id}>
  <span className={`card-deck ${card.deck.toLowerCase()}`}>{card.deck}</span>
  <p><AnnouncementText text={card.text} game={game}/></p>
  <small>Drawn by {event.actorName} · Turn {event.turn}</small>
  {canContinue?<button className="primary" disabled={disabled} onClick={onContinue}>Continue</button>:<p role="status">Waiting for {event.actorName} to continue…</p>}
 </div></Modal>;
}
