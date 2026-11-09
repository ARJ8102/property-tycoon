import { useViewer } from './Viewer';
import { actionError, mortgageValue, unmortgageCost, type GameAction, type GameState } from '@property-tycoon/shared';
import { mortgagedProperties } from '@property-tycoon/shared';
import { Token } from './Token';
import { money } from './format';
export function BankPanel({game,dispatch,onPropertySelect}: {game:GameState;dispatch:(a:GameAction)=>void;onPropertySelect:(id:number)=>void}) {
 const rows=mortgagedProperties(game),{human,canControl}=useViewer(game);
 const total=rows.reduce((sum,p)=>sum+mortgageValue(p.property),0);
 return <section aria-label="Bank mortgages"><p className="empty-note">The bank is not a player. Mortgage principal is an encumbrance, not a recurring bill. Net worth deducts it once.</p><dl className="detail-grid financial-summary"><dt>Mortgaged properties</dt><dd>{rows.length}</dd><dt>Outstanding principal</dt><dd>{money(total)}</dd></dl>{!rows.length&&<p>No properties are currently mortgaged.</p>}{rows.map(({property,owner})=>{
  const action:GameAction={type:'UNMORTGAGE',actorId:human.id,expectedRevision:game.revision,propertyId:property.id};
  const error=actionError(game,action);
  return <article className="bank-property" key={property.id}><button className="text-button" onClick={()=>onPropertySelect(property.id)}>{property.name}</button><div className="property-owner"><Token id={owner.token} size={20}/><strong>{owner.name}</strong></div><dl className="detail-grid"><dt>Group</dt><dd>{property.kind==='property'?property.group:property.kind}</dd><dt>Mortgage status</dt><dd>Mortgaged</dd><dt>Principal</dt><dd>{money(mortgageValue(property))}</dd><dt>Redemption incl. interest</dt><dd>{money(unmortgageCost(property))}</dd></dl><button className="small-button" disabled={!canControl(human.id)||!!error||owner.id!==human.id} title={error??'Redeem this mortgage'} onClick={()=>dispatch(action)}>Unmortgage {money(unmortgageCost(property))}</button></article>;
 })}</section>;
}
