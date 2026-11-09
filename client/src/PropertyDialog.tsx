import { useViewer } from './Viewer';
import { actionError, activePlayer, actingPlayer, calculateRent, collectionInfo, getProperty, mortgageValue, propertyStatus, rentSchedule, unmortgageCost, type GameAction, type GameState } from '@property-tycoon/shared';
import { Modal } from './Modal';
import { Token } from './Token';
import { money } from './format';
export function PropertyDialog({game,propertyId,dispatch,onClose}: {game:GameState;propertyId:number;dispatch:(a:GameAction)=>void;onClose:()=>void}) {
 const property=getProperty(game,propertyId), status=propertyStatus(game,propertyId);
 const owner=game.players.find(p=>p.id===game.ownership[propertyId]), info=collectionInfo(game,propertyId);
 const {human,canControl}=useViewer(game);
 const interactive=canControl(human.id)&&owner?.id===human.id&&!human.bankrupt&&actingPlayer(game).id===human.id;
 const control=(type:'MORTGAGE'|'UNMORTGAGE'|'UPGRADE'|'SELL_UPGRADE'|'BUILD_LANDMARK'|'SELL_LANDMARK',label:string)=>{
  const action:GameAction={actorId:human.id,expectedRevision:game.revision,type,propertyId};
  const error=interactive?actionError(game,action):'Only the active human owner may manage this property.';
  return <button type="button" className="small-button" key={type} disabled={!!error} title={error??label} onClick={()=>dispatch(action)}>{label}</button>;
 };
 return <Modal title={property.name} onClose={onClose}>
  <div className="property-owner">{owner?<><Token id={owner.token}/><strong>{owner.name}</strong></>:<strong>Unowned · Available from the bank on landing</strong>}</div>
  <dl className="detail-grid"><dt>Property type</dt><dd>{property.kind==='property'?'City':property.kind}</dd><dt>Group</dt><dd>{info.key}</dd><dt>Price</dt><dd>{money(property.price)}</dd><dt>Owner’s collection</dt><dd>{info.count} / {info.total}{info.complete?' · Complete':''}</dd><dt>Base rent</dt><dd>{money(property.baseRent)}{property.kind==='utility'?' × dice':''}</dd><dt>Current rent{property.kind==='utility'?' (roll of 7)':''}</dt><dd>{money(calculateRent(game,propertyId))}</dd><dt>Mortgage value</dt><dd>{money(mortgageValue(property))}</dd><dt>Mortgage status</dt><dd>{status.mortgaged?'Mortgaged':'Clear'}</dd><dt>Unmortgage cost</dt><dd>{money(unmortgageCost(property))}</dd><dt>Development level</dt><dd>{property.kind==='property'?`Development Level ${status.level}`:'Not eligible'}</dd><dt>Landmark status</dt><dd>{status.landmark?'Constructed':'None'}</dd>{property.kind==='property'&&<><dt>Development cost</dt><dd>{money(property.upgradeCost)}</dd><dt>Landmark cost / rent</dt><dd>{money(property.landmarkCost)} / {money(property.landmarkRent)}</dd></>}</dl>
  <h3 className="section-title">Rent schedule</h3><dl className="detail-grid rent-schedule">{rentSchedule(game,propertyId).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{money(row.rent)}</dd></div>)}</dl><p className="empty-note">Mortgaged properties collect no rent. Current rent reflects ownership; the schedule shows development rents.</p>
  {game.developedThisTurn.includes(propertyId)&&<p className="development-limit-note" role="status">One development has already been built here this turn. Wait until the owner’s next turn to build again; selling does not reset this limit.</p>}
  <div className="property-actions">{status.mortgaged?control('UNMORTGAGE',`Unmortgage ${money(unmortgageCost(property))}`):control('MORTGAGE',`Mortgage +${money(mortgageValue(property))}`)}{property.kind==='property'&&<>{control('UPGRADE',`Build Development Level ${Math.min(4,status.level+1)} · ${money(property.upgradeCost)}`)}{control('SELL_UPGRADE',`Sell development +${money(property.upgradeCost/2)}`)}{control('BUILD_LANDMARK',`Build Landmark · ${money(property.landmarkCost)}`)}{control('SELL_LANDMARK',`Sell Landmark +${money(property.landmarkCost/2)}`)}</>}</div>
 </Modal>;
}
