import { useViewer } from './Viewer';
import { useEffect, useRef } from 'react';
import { activePlayer, calculateRent, getProperty, type GameAction, type GameState } from '@property-tycoon/shared';

export function PurchaseDialog({game, dispatch}: {game:GameState;dispatch:(a:GameAction)=>void}) {
 const {canControl}=useViewer(game);
 if(!canControl(activePlayer(game).id)||game.phase!=='purchase'||game.pendingPurchase===null||activePlayer(game).isBot)return null;
 return <PurchaseOffer game={game} dispatch={dispatch}/>;
}
function PurchaseOffer({game,dispatch}:{game:GameState;dispatch:(a:GameAction)=>void}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{
  ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  return()=>{document.querySelector<HTMLButtonElement>('[data-end-turn]')?.focus();};
 },[]);
 const property=getProperty(game,game.pendingPurchase!), player=activePlayer(game);
 const context={actorId:player.id,expectedRevision:game.revision};
 const decline=()=>dispatch({...context,type:'DECLINE'});
 return <section ref={ref} className="announcement-card interactive" aria-label={`Buy ${property.name}?`} onKeyDown={e=>{if(e.key==='Escape')decline();}}><h3>Buy {property.name}?</h3><p>Buy this address, or decline to let all active players bid at auction.</p><dl className="detail-grid"><dt>Price</dt><dd>${property.price}</dd><dt>Base rent</dt><dd>${property.baseRent}{property.kind==='utility'?' × dice total':''}</dd><dt>Rent on this landing</dt><dd>${calculateRent(game,property.id,game.dice ? game.dice[0]+game.dice[1] : 7)}</dd><dt>Group</dt><dd>{property.kind==='property'?property.group:property.kind}</dd><dt>Your cash</dt><dd>${player.cash}</dd></dl>{player.cash<property.price&&<p>Not enough cash. Decline to continue.</p>}<div className="action-row"><button className="primary" disabled={player.cash<property.price} onClick={()=>dispatch({...context,type:'BUY'})}>Buy for ${property.price}</button><button className="secondary" onClick={decline}>Decline</button></div></section>;
}
