import { useState } from 'react';
import { actingPlayer, ownedProperties, propertyStatus, validateTrade, type GameAction, type GameState, type PurchasableSpace, type TradeOffer } from '@property-tycoon/shared';
import { Modal } from './Modal';
import { money } from './format';
export function TradeDialog({game,dispatch,onClose}: {game:GameState;dispatch:(a:GameAction)=>void;onClose:()=>void}) {
 const proposer=actingPlayer(game), partners=game.players.filter(p=>!p.bankrupt&&p.id!==proposer.id);
 const [offer,setOffer]=useState<TradeOffer>({partnerId:partners[0]!.id,offeredProperties:[],requestedProperties:[],offeredCash:0,requestedCash:0});
 const [review,setReview]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const partner=partners.find(p=>p.id===offer.partnerId)!;
 const update=(change:Partial<TradeOffer>)=>{setOffer({...offer,...change});setReview(false);setError(null);};
 const list=(ownerId:string,key:'offeredProperties'|'requestedProperties')=><fieldset className="trade-properties"><legend>{ownerId===proposer.id?'You offer':'You request'}</legend>{ownedProperties(game,ownerId).length===0&&<p>No properties owned.</p>}{ownedProperties(game,ownerId).map(p=>{
  const status=propertyStatus(game,p.id);
  return <label key={p.id}><input type="checkbox" disabled={status.level>0} checked={offer[key].includes(p.id)} onChange={e=>update({[key]:e.target.checked?[...offer[key],p.id]:offer[key].filter(id=>id!==p.id)})}/><span>{p.name} <small>{money(p.price)}{status.mortgaged?' · MORTGAGED':''}{status.level?' · Sell upgrades first':''}</small></span></label>;
 })}</fieldset>;
 const describe=(ids:number[])=>ids.map(id=>{const p=game.spaces[id] as PurchasableSpace;return `${p.name}${propertyStatus(game,id).mortgaged?' (mortgaged)':''}`;}).join(', ')||'No properties';
 return <Modal title="Propose a trade" onClose={onClose}><form onSubmit={e=>{
  e.preventDefault();
  try{validateTrade(game,proposer.id,offer);if(!review){setReview(true);return;}dispatch({type:'PROPOSE_TRADE',actorId:proposer.id,expectedRevision:game.revision,offer});onClose();}
  catch(e){setError(e instanceof Error?e.message:'Invalid trade.');}
 }}><label className="field-label" htmlFor="trade-partner">Trading partner</label><select id="trade-partner" value={offer.partnerId} onChange={e=>update({partnerId:e.target.value,requestedProperties:[],requestedCash:0})}>{partners.map(p=><option key={p.id} value={p.id}>{p.name} · {p.strategy} · {money(p.cash)}</option>)}</select>
 {list(proposer.id,'offeredProperties')}{list(partner.id,'requestedProperties')}<div className="trade-cash"><label>Cash you offer<input type="number" min="0" max={proposer.cash} step="1" required value={offer.offeredCash} onChange={e=>update({offeredCash:e.target.valueAsNumber})}/></label><label>Cash you request<input type="number" min="0" max={partner.cash} step="1" required value={offer.requestedCash} onChange={e=>update({requestedCash:e.target.valueAsNumber})}/></label></div>
 <p className="empty-note">Mortgaged properties keep their debt and cannot collect rent. The receiving owner pays principal + 10% when unmortgaging. Upgraded groups must be sold down before trading.</p>
 {error&&<p role="alert" className="error-note">{error}</p>}{review&&<div className="trade-review"><strong>Review your approval</strong><p>You give: {describe(offer.offeredProperties)} + {money(offer.offeredCash)}.</p><p>You receive: {describe(offer.requestedProperties)} + {money(offer.requestedCash)}.</p><p>{partner.name} will review this proposal and may reject it.</p></div>}
 <div className="action-row"><button type="submit" className="primary">{review?'Approve & send':'Review trade'}</button><button type="button" className="secondary" onClick={onClose}>Cancel</button></div></form></Modal>;
}
