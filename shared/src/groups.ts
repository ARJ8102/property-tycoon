import { GROUP_COLORS, type GameState, type PurchasableSpace } from './types.js';
import { getProperty } from './finance.js';
export function collectionKey(property: PurchasableSpace): string { return property.kind==='property'?property.group:property.kind; }
export function collectionProperties(state: GameState, property: PurchasableSpace): PurchasableSpace[] {
 return state.spaces.filter((p): p is PurchasableSpace=>'price' in p&&collectionKey(p)===collectionKey(property));
}
export function collectionInfo(state: GameState, propertyId: number, ownerId=state.ownership[propertyId]) {
 const property=getProperty(state,propertyId), members=collectionProperties(state,property);
 const count=ownerId?members.filter(p=>state.ownership[p.id]===ownerId).length:0;
 return {key:collectionKey(property),members,count,total:members.length,complete:count===members.length&&!!ownerId};
}
export function collectionColor(property: PurchasableSpace): string { return property.kind==='property'?GROUP_COLORS[property.group]:property.kind==='transit'?'#7890a7':'#629b9b'; }
/** Ownership alone determines tint; mortgages retain ownership and its visualization. */
export function ownershipTint(state: GameState, id: number): string | undefined {
 const owner=state.ownership[id];if(!owner)return undefined;
 const property=getProperty(state,id), info=collectionInfo(state,id);
 if(property.kind==='property')return info.complete?`${GROUP_COLORS[property.group]}24`:undefined;
 if(property.kind==='utility')return info.complete?'#dceff0':undefined;
 if(info.count<2)return undefined;
 const palettes=['#e4edf6','#eee5f2','#e4eee7','#f3e8db'];
 return palettes[state.players.findIndex(p=>p.id===owner)%palettes.length];
}
