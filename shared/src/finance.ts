import { collectionInfo } from './groups.js';
import type { GameState, PropertyStatus, PurchasableSpace, PropertySpace } from './types.js';
export const DEFAULT_PROPERTY_STATUS: Readonly<PropertyStatus> = { mortgaged:false, level:0 };
export function isPurchasable(space: GameState['spaces'][number]): space is PurchasableSpace { return 'price' in space; }
export function getProperty(state: GameState, id: number): PurchasableSpace {
 const space=state.spaces[id];
 if (!space || !isPurchasable(space)) throw new Error('Choose a purchasable property.');
 return space;
}
export function propertyStatus(state: GameState, id: number): Readonly<PropertyStatus> { return state.properties[id] ?? DEFAULT_PROPERTY_STATUS; }
export function ownedProperties(state: GameState, ownerId: string): PurchasableSpace[] { return state.spaces.filter((s): s is PurchasableSpace=>isPurchasable(s)&&state.ownership[s.id]===ownerId); }
export function groupProperties(state: GameState, property: PropertySpace): PropertySpace[] { return state.spaces.filter((s): s is PropertySpace=>s.kind==='property'&&s.group===property.group); }
export function mortgageValue(space: PurchasableSpace): number { return Math.floor(space.price/2); }
export function unmortgageCost(space: PurchasableSpace): number { return Math.ceil(mortgageValue(space)*110/100); }
export function calculateRent(state: GameState, id: number, diceTotal=7): number {
 const space=getProperty(state,id), status=propertyStatus(state,id), owner=state.ownership[id];
 if (status.mortgaged) return 0;
 if(space.kind==='property'&&status.landmark)return space.landmarkRent;
 if (space.kind==='property') return space.rents[status.level]! * (status.level===0&&collectionInfo(state,id).complete?2:1);
 const count=owner ? ownedProperties(state,owner).filter(s=>s.kind===space.kind).length : 1;
 if (space.kind==='transit') return space.baseRent * 2 ** Math.max(0,count-1);
 return diceTotal * (count >= 2 ? 10 : space.baseRent);
}
export function finances(state: GameState, ownerId: string) {
 const owned=ownedProperties(state,ownerId);
 const player=state.players.find(p=>p.id===ownerId);
 if (!player) throw new Error('Unknown player.');
 const propertyValue=owned.reduce((sum,p)=>sum+p.price+(p.kind==='property'?(propertyStatus(state,p.id).level*p.upgradeCost+(propertyStatus(state,p.id).landmark?p.landmarkCost:0)):0),0);
 const basePropertyValue=owned.reduce((sum,p)=>sum+p.price,0);
 const developmentValue=propertyValue-basePropertyValue;
 const mortgageDebt=owned.reduce((sum,p)=>sum+(propertyStatus(state,p.id).mortgaged?mortgageValue(p):0),0);
 const obligation=state.debt?.debtorId===ownerId?state.debt.amount:0;
 const liquidationCash=player.cash+owned.reduce((sum,p)=>sum+(!propertyStatus(state,p.id).mortgaged?mortgageValue(p):0)+(p.kind==='property'?(propertyStatus(state,p.id).level*p.upgradeCost+(propertyStatus(state,p.id).landmark?p.landmarkCost:0))/2:0),0);
 return {cash:player.cash,propertyValue,basePropertyValue,developmentValue,mortgageDebt,obligation,netWorth:player.cash+propertyValue-mortgageDebt-obligation,liquidationCash};
}

export function rentSchedule(state: GameState, id: number): {label:string;rent:number}[] {
 const property=getProperty(state,id);
 if(property.kind==='property')return [0,1,2,3,4].map(level=>({label:level?`Development Level ${level}`:'Unimproved',rent:property.rents[level]!*(level===0&&collectionInfo(state,id).complete?2:1)})).concat([{label:'Landmark',rent:property.landmarkRent}]);
 if(property.kind==='transit')return [1,2,3,4].map(count=>({label:`${count} transit line${count===1?'':'s'}`,rent:property.baseRent*2**(count-1)}));
 return [{label:'One network (dice total 7)',rent:property.baseRent*7},{label:'Both networks (dice total 7)',rent:70}];
}

export function developmentRank(status: Readonly<PropertyStatus>): number { return status.landmark?5:status.level; }
export function developmentValue(property: PurchasableSpace, status: Readonly<PropertyStatus>): number { return property.kind==='property'?status.level*property.upgradeCost+(status.landmark?property.landmarkCost:0):0; }

export function mortgagedProperties(state: GameState) {
 return state.spaces.filter(isPurchasable).filter(p=>state.ownership[p.id]&&propertyStatus(state,p.id).mortgaged).map(property=>({property,owner:state.players.find(p=>p.id===state.ownership[property.id])!}));
}

export type RentQuote = {kind:'amount';amount:number;mortgaged:boolean}|{kind:'dice';multiplier:number;mortgaged:false};
/** Board labels use the same rent rules as actual payments, never a utility estimate. */
export function rentQuote(state:GameState,id:number):RentQuote {
 const property=getProperty(state,id);
 if(propertyStatus(state,id).mortgaged)return {kind:'amount',amount:0,mortgaged:true};
 if(property.kind==='utility')return {kind:'dice',multiplier:calculateRent(state,id,1),mortgaged:false};
 return {kind:'amount',amount:calculateRent(state,id),mortgaged:false};
}
