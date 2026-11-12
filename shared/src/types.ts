import type {Auction} from './auctions.js';
import type {DeckName} from './cards.js';
import type {DeckState,HeldCard} from './decks.js';
export const TOKENS = [
  { id: 'circle', name: 'Circle', color: '#dc4b48' },
  { id: 'triangle', name: 'Triangle', color: '#3679ce' },
  { id: 'square', name: 'Square', color: '#39845b' },
  { id: 'diamond', name: 'Diamond', color: '#8c58b7' },
  { id: 'star', name: 'Star', color: '#e68733' },
  { id: 'hexagon', name: 'Hexagon', color: '#248e91' },
  { id: 'heart', name: 'Heart', color: '#d9578c' },
  { id: 'cross', name: 'Cross', color: '#d6ab20' },
] as const;
export type TokenId = typeof TOKENS[number]['id'];
export type PropertyGroup = 'clay' | 'sky' | 'rose' | 'amber' | 'coral' | 'gold' | 'jade' | 'indigo';
export const GROUP_COLORS: Record<PropertyGroup, string> = { clay: '#a77356', sky: '#72b8ca', rose: '#c77da3', amber: '#dc9a4c', coral: '#d66859', gold: '#d6bd57', jade: '#5a9a82', indigo: '#647fb1' };
interface BaseSpace { id: number; name: string }
export interface PropertySpace extends BaseSpace { kind: 'property'; group: PropertyGroup; price: number; baseRent: number; rents: readonly number[]; upgradeCost: number; landmarkCost: number; landmarkRent: number }
export interface TransitSpace extends BaseSpace { kind: 'transit'; price: number; baseRent: number }
export interface UtilitySpace extends BaseSpace { kind: 'utility'; price: number; baseRent: number }
export interface SpecialSpace extends BaseSpace { kind: 'start' | 'event' | 'tax' | 'rest' | 'inspection' | 'detour'; amount?: number }
export type Space = PropertySpace | TransitSpace | UtilitySpace | SpecialSpace;
export type PurchasableSpace = PropertySpace | TransitSpace | UtilitySpace;
export type BotStrategy = 'conservative' | 'aggressive' | 'strategic';
export interface Player { id: string; name: string; isBot: boolean; strategy?: BotStrategy; token: TokenId; position: number; cash: number; bankrupt: boolean; retired?: boolean; troubleCards: number; heldCards: HeldCard[]; detained: boolean; detentionAttempts: number }
export type GamePhase = 'turn-order' | 'order-ready' | 'awaiting-roll' | 'detention' | 'purchase' | 'actions' | 'debt' | 'trade' | 'auction' | 'inheritance' | 'finished';
export interface PropertyStatus { mortgaged: boolean; level: number; landmark?: boolean }
export interface Debt { debtorId: string; creditorId: string | null; amount: number; reason: string; category?: EventCategory }
export interface TradeOffer { partnerId: string; offeredProperties: number[]; requestedProperties: number[]; offeredCash: number; requestedCash: number }
export interface Trade extends TradeOffer { id: string; proposerId: string }
export type EventCategory = 'auctions'|'movement'|'purchases'|'rent'|'trades'|'mortgages'|'developments'|'taxes'|'cards'|'inspection'|'bankruptcy'|'turns'|'groups'|'winner'|'penalties'|'system';
export interface EventDetails {
 actorId?: string; propertyId?: number; amount?: number; counterpartyId?: string|null;
 dice?: [number,number]; movement?: {from:number;to:number;path:number[];mode:'forward'|'backward'|'direct'};
 card?: {id?:string;title:string;text:string;deck:string};
 propertyTransfers?: {propertyId:number;from:string|null;to:string|null}[];
 cashTransfers?: {from:string|null;to:string|null;amount:number}[];
 rents?: {propertyId:number;amount:number}[];
}
export interface GameEvent extends EventDetails { id: number; turn: number; category: EventCategory; actorName: string; message: string }

export interface OrderRoll {playerId:string;dice:[number,number];total:number;round:number}
export interface OrderGroup {playerIds:string[];round:number;rolls:Record<string,[number,number]>}
export interface TurnSelection {groups:OrderGroup[];history:OrderRoll[]}
export interface GameState {
 inheritances:{playerId:string;propertyIds:number[];interestPaid:boolean}[];
 tradeReturnPhase:GamePhase|null;debtResumePhase:'actions'|'detention'|'awaiting-roll';
 auction:Auction|null;auctionQueue:number[];
 retirementResumePhase?:GamePhase;
 consecutiveDoubles:number;extraRoll:boolean;
 decks:Record<DeckName,DeckState>|null;
 players: Player[]; spaces: readonly Space[]; ownership: Record<number, string>; properties: Record<number, PropertyStatus>;
 turnOrder:string[];turnSelection:TurnSelection|null;developedThisTurn: number[]; currentPlayerIndex: number; phase: GamePhase; dice: [number, number] | null; turn: number; revision: number;
 pendingPurchase: number | null; debt: Debt | null; paymentQueue: Debt[]; debtContinuation: {kind:'detention-move';steps:number;cardDraw:number;entropy?:number[]}|null; trade: Trade | null; winnerId: string | null; log: GameEvent[];
}
export interface GameSetup { humanName: string; token: TokenId; playerCount: number }
export interface ActionContext { actorId: string; expectedRevision: number }
export type GameAction = ActionContext & (
 {type:'ROLL_ORDER';dice:[number,number]} | {type:'START_GAME'} |
 { type: 'ROLL' | 'ROLL_DETENTION'; dice: [number, number]; cardDraw: number; entropy?:number[] } |
 {type:'KEEP_INHERITED'|'REDEEM_INHERITED';propertyId:number} |
 {type:'BID';amount:number} | {type:'PASS_AUCTION'} |
 { type: 'END_TURN' } | {type:'PAY_RELEASE'|'USE_TROUBLE_CARD'} | { type: 'BUY' } | { type: 'DECLINE' } |
 { type: 'MORTGAGE' | 'UNMORTGAGE' | 'UPGRADE' | 'SELL_UPGRADE' | 'BUILD_LANDMARK' | 'SELL_LANDMARK'; propertyId: number } |
 { type: 'SETTLE_DEBT' } | { type: 'BANKRUPT' } | {type:'RETIRE'} |
 { type: 'PROPOSE_TRADE'; offer: TradeOffer } | { type: 'ACCEPT_TRADE' | 'REJECT_TRADE'; tradeId: string }
);
