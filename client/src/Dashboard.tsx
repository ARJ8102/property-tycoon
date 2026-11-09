import { useViewer } from './Viewer';
import { useId, useState } from 'react';
import { mayProposeTrade, actionError, activePlayer, actingPlayer, calculateRent, finances, mortgageValue, ownedProperties, propertyStatus, unmortgageCost, collectionColor, collectionInfo, collectionKey, type GameAction, type GameState, type PurchasableSpace } from '@property-tycoon/shared';
import { Token } from './Token';
import { money } from './format';
export function Dashboard({game, dispatch, onTrade, onPropertySelect,initialPlayerId}: {game:GameState;dispatch:(a:GameAction)=>void;onTrade:()=>void;onPropertySelect?:(id:number)=>void;initialPlayerId?:string}) {
 const {human,canControl}=useViewer(game);
 const [selected,setSelected]=useState(initialPlayerId??human.id);
 const id=useId(), player=game.players.find(p=>p.id===selected) ?? human;
 const financial=finances(game,player.id), owned=ownedProperties(game,player.id);
 const groups=[...new Set(owned.map(collectionKey))].map(key=>({key,properties:owned.filter(p=>collectionKey(p)===key)}));
 return <section className="portfolio" aria-label="Player portfolios">
  <div className="portfolio-tabs" role="tablist" aria-label="Players">{game.players.map((p,index)=><button key={p.id} id={`${id}-${p.id}`} role="tab" aria-selected={p.id===player.id} tabIndex={p.id===player.id?0:-1} aria-controls={`${id}-panel`} onClick={()=>setSelected(p.id)} onKeyDown={event=>{
   const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
   if(offset||event.key==='Home'||event.key==='End') {event.preventDefault();const next=game.players[event.key==='Home'?0:event.key==='End'?game.players.length-1:(index+offset+game.players.length)%game.players.length]!;setSelected(next.id);document.getElementById(`${id}-${next.id}`)?.focus();}
  }}><Token id={p.token} size={22}/><span>{p.name}</span>{p.id===activePlayer(game).id&&game.phase!=='finished'&&<small>TURN</small>}</button>)}</div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${player.id}`} className="portfolio-details"><h3>{player.name}’s portfolio</h3><p className="position-label">{player.isBot?`Bot · ${player.strategy}`:'Human'} · {game.spaces[player.position]!.name} · {player.bankrupt?'Bankrupt':'Solvent'}</p>
   <p className="position-label">{player.detained?`Detained · ${3-player.detentionAttempts} doubles attempts remaining`:'Not detained'} · Get Out of Trouble cards: <strong>{player.troubleCards}</strong></p>
   {player.detained&&<div className="portfolio-detention"><strong>Release options</strong><p>At the start of your detained turn: pay $50 or use a held Get Out of Trouble card, then roll normally; or attempt doubles. A third failed attempt requires $50 before moving that roll.</p></div>}
   <dl className="detail-grid financial-summary"><dt>Cash</dt><dd>{money(financial.cash)}</dd><dt>Property value</dt><dd>{money(financial.basePropertyValue)}</dd><dt>Development value</dt><dd>{money(financial.developmentValue)}</dd><dt>Mortgage principal</dt><dd>{money(financial.mortgageDebt)}</dd>{financial.obligation>0&&<><dt>Outstanding payment</dt><dd>{money(financial.obligation)}</dd></>}<dt>Net worth</dt><dd>{money(financial.netWorth)}</dd></dl>
   <div className="portfolio-heading"><h4>Properties ({owned.length})</h4><button className="text-button" disabled={!canControl(human.id)||!mayProposeTrade(game,human.id)} onClick={onTrade}>Propose trade</button></div>
   {!owned.length&&<p className="empty-note">No properties yet. Land on an unowned space to buy it.</p>}
   {groups.map(({key,properties})=>{const info=collectionInfo(game,properties[0]!.id,player.id);return <section className="portfolio-group" key={key}><h4 style={{borderColor:collectionColor(properties[0]!)}}><span>{key} {properties[0]!.kind==='property'?'group':''}</span><b>{info.count} / {info.total}{info.complete?' · Complete':''}</b></h4>{properties.map(property=>onPropertySelect?<button key={property.id} className="property-row" onClick={()=>onPropertySelect(property.id)}><strong>{property.name}</strong><span>{propertyStatus(game,property.id).mortgaged?'Mortgaged':`Rent ${money(calculateRent(game,property.id))}`} · {propertyStatus(game,property.id).landmark?'Landmark':`Development Level ${propertyStatus(game,property.id).level}`}</span><small>Mortgage value {money(mortgageValue(property))}</small></button>:<PropertyDetails key={property.id} property={property} game={game} dispatch={dispatch} interactive={player.id===human.id&&!human.bankrupt&&actingPlayer(game).id===human.id}/>)}</section>;})}
  </div>
 </section>;
}
function PropertyDetails({property,game,dispatch,interactive}: {property:PurchasableSpace;game:GameState;dispatch:(a:GameAction)=>void;interactive:boolean}) {
 const status=propertyStatus(game,property.id), player=activePlayer(game);
 const context={actorId:player.id,expectedRevision:game.revision};
 const control=(type:'MORTGAGE'|'UNMORTGAGE'|'UPGRADE'|'SELL_UPGRADE',label:string)=>{
  const action={...context,type,propertyId:property.id};
  const error=interactive?actionError(game,action):'Manage your properties on your turn.';
  return <button type="button" className="small-button" key={type} disabled={!!error} title={error ?? label} onClick={()=>dispatch(action)}>{label}</button>;
 };
 return <details className="property-details"><summary><strong>{property.name}</strong><span>{status.mortgaged?'Mortgaged':`Rent ${money(calculateRent(game,property.id))}`}{status.level?` · L${status.level}`:''}</span></summary><dl className="detail-grid"><dt>Group</dt><dd>{property.kind==='property'?property.group:property.kind}</dd><dt>Purchase price</dt><dd>{money(property.price)}</dd><dt>Current rent{property.kind==='utility'?' (roll of 7)':''}</dt><dd>{money(calculateRent(game,property.id))}</dd><dt>Base rent</dt><dd>{money(property.baseRent)}{property.kind==='utility'?' × dice':''}</dd><dt>Upgrade level</dt><dd>{status.level} / 4{property.kind!=='property'?' (not eligible)':''}</dd><dt>Mortgage value</dt><dd>{money(mortgageValue(property))}</dd><dt>Mortgage status</dt><dd>{status.mortgaged?'Mortgaged':'Clear'}</dd>{property.kind==='property'&&<><dt>Upgrade / sell back</dt><dd>{money(property.upgradeCost)} / {money(property.upgradeCost/2)}</dd></>}</dl>
 {interactive&&<div className="property-actions">{status.mortgaged?control('UNMORTGAGE',`Unmortgage ${money(unmortgageCost(property))}`):control('MORTGAGE',`Mortgage +${money(mortgageValue(property))}`)}{property.kind==='property'&&<>{control('UPGRADE',`Upgrade ${money(property.upgradeCost)}`)}{control('SELL_UPGRADE',`Sell upgrade +${money(property.upgradeCost/2)}`)}</>}</div>}</details>;
}
