import { useState } from 'react';
import { EVENT_LABELS, formatGameEvent, type GameState, type EventCategory } from '@property-tycoon/shared';
import { money } from './format';
export function EventLog({game}: {game:GameState}) {
 const [category,setCategory]=useState<EventCategory|'all'>('all');
 const events=game.log.filter(e=>category==='all'||e.category===category);
 const name=(id:string|null)=>id?game.players.find(p=>p.id===id)?.name??id:'Bank';
 return <section className="event-log" aria-label="Game history"><label className="field-label" htmlFor="history-category">Event category</label><select id="history-category" value={category} onChange={e=>setCategory(e.target.value as EventCategory|'all')}><option value="all">All events · {game.log.length}</option>{Object.entries(EVENT_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><p className="empty-note">Complete history · newest first</p><ol tabIndex={0}>{events.map(event=><li key={event.id} data-event-id={event.id} data-category={event.category}><span className={`event-category category-${event.category}`}>#{event.id} · TURN {event.turn} · {event.actorName} · {EVENT_LABELS[event.category]}</span><p>{formatGameEvent(event)}</p>{event.cashTransfers?.map((transfer,i)=><small key={`cash-${i}`}>{name(transfer.from)} → {name(transfer.to)}: <b>{money(transfer.amount)}</b></small>)}{event.propertyTransfers?.map((transfer,i)=><small key={`property-${i}`}>{game.spaces[transfer.propertyId]!.name}: {name(transfer.from)} → {name(transfer.to)}</small>)}</li>)}</ol>{!events.length&&<p>No events in this category yet.</p>}</section>;
}
