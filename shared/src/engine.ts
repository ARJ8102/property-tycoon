import {startAuction,auctionAction} from './auctions.js';
import { calculateRent, getProperty, isPurchasable, propertyStatus, groupProperties, mortgageValue, unmortgageCost, finances, ownedProperties, developmentRank, developmentValue } from './finance.js';
import {createDecks,drawCard,holdCard,returnHeldCard,freshUtilityDice,repairBill} from './decks.js';
import { randomInt } from './random.js';
import { validateTrade } from './trading.js';
import { emitEvent as log, announceCollections } from './events.js';
import { isOrderPhase, nextOrderRoller, recordOrderRoll } from './turn-order.js';
import { BOARD, INITIAL_CASH } from './data.js';
import { TOKENS, type GameAction, type GameSetup, type GameState, type Player, type EventCategory } from './types.js';
export function createGame(setup: GameSetup,seed:number|(()=>number)=()=>randomInt(0x100000000)): GameState {
 if (!Number.isInteger(setup.playerCount) || setup.playerCount < 2 || setup.playerCount > 4) throw new Error('Choose 2–4 players.');
 const name = setup.humanName.trim();
 if (!name || name.length > 24) throw new Error('Enter a name of 1–24 characters.');
 if (!TOKENS.some(token => token.id === setup.token)) throw new Error('Choose a valid token.');
 const available = TOKENS.filter(token => token.id !== setup.token);
 const strategies = ['conservative', 'aggressive', 'strategic'] as const;
 const players = Array.from({length: setup.playerCount}, (_, index): Player => ({ id: `player-${index+1}`, name: index === 0 ? name : ['Atlas', 'Nova', 'Remy'][index-1]!, isBot: index !== 0, strategy: index ? strategies[index-1] : undefined, token: index === 0 ? setup.token : available[index-1]!.id, position: 0, cash: INITIAL_CASH, bankrupt: false, troubleCards: 0, heldCards:[], detained: false, detentionAttempts: 0 }));
 return initializeGame(players,seed);
}
/** Both modes enter the same engine with validated seats and identical starting rules. */
export function createOnlineGame(seats: readonly {id:string;name:string;token:Player['token']}[],seed:number|(()=>number)=()=>randomInt(0x100000000)):GameState {
 requireRule(seats.length>=2&&seats.length<=8,'Choose 2–8 players.');
 requireRule(new Set(seats.map(s=>s.id)).size===seats.length&&new Set(seats.map(s=>s.token)).size===seats.length,'Seats and tokens must be unique.');
 requireRule(seats.every(s=>s.id&&s.name.trim().length>0&&s.name.length<=24&&TOKENS.some(t=>t.id===s.token)),'Invalid player.');
 return initializeGame(seats.map(s=>({id:s.id,token:s.token,name:s.name.trim(),isBot:false,position:0,cash:INITIAL_CASH,bankrupt:false,troubleCards:0,heldCards:[],detained:false,detentionAttempts:0})),seed);
}
function initializeGame(players:Player[],seed:number|(()=>number)):GameState {
 const name=players[0]!.name;
 return { inheritances:[],tradeReturnPhase:null,debtResumePhase:'actions',auction:null,auctionQueue:[],consecutiveDoubles:0,extraRoll:false,decks:createDecks(seed),players, spaces: BOARD, ownership: {}, properties: {}, turnOrder:[],turnSelection:{groups:[{playerIds:players.map(p=>p.id),round:1,rolls:{}}],history:[]},developedThisTurn:[], currentPlayerIndex: 0, phase: 'turn-order', dice: null, turn: 0, revision: 0, pendingPurchase: null, debt: null, paymentQueue:[], debtContinuation:null, trade: null, winnerId: null, log: [{id:0,turn:0,category:'system',actorId:players[0]!.id,actorName:name,message:`${name} opens the table. Everyone starts with $1,500.`}] };
}
export function activePlayer(state: GameState): Player { return state.players[state.currentPlayerIndex]!; }
export function actingPlayer(state: GameState): Player { return state.phase==='inheritance'&&state.inheritances[0]?state.players.find(p=>p.id===state.inheritances[0]!.playerId)!:state.phase==='trade'&&state.trade?state.players.find(p=>p.id===state.trade!.proposerId)!:state.phase==='auction'&&state.auction?state.players.find(p=>p.id===state.auction!.currentBidderId)!:state.phase==='debt'&&state.debt?state.players.find(p=>p.id===state.debt!.debtorId)!:activePlayer(state); }
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function move(state: GameState, steps: number) {
 const player = activePlayer(state);
 const from=player.position;
 const destination = player.position + steps;
 const bonus = steps>0?Math.floor(destination / 40) * 200:0;
 player.position = (destination % 40+40)%40;
 if (bonus) { player.cash += bonus; log(state, `${player.name} ${player.position===0?'landed on':'passed'} Launch Plaza and collects $${bonus}.`,'movement',{amount:bonus,cashTransfers:[{from:null,to:player.id,amount:bonus}]}); }
 log(state, `${player.name} moves to ${state.spaces[player.position]!.name}.`,'movement',{movement:{from,to:player.position,path:Array.from({length:Math.abs(steps)},(_,i)=>(from+Math.sign(steps)*(i+1)+40)%40),mode:steps<0?'backward':'forward'}});
}
function advanceTurn(next: GameState) {
  next.consecutiveDoubles=0;next.extraRoll=false;next.developedThisTurn=[];next.dice = null; next.turn++; next.phase = 'awaiting-roll';
  const currentId=next.players[next.currentPlayerIndex]!.id,slot=next.turnOrder.indexOf(currentId);
  for(let offset=1;offset<=next.turnOrder.length;offset++){
   const id=next.turnOrder[(slot+offset)%next.turnOrder.length]!;
   next.currentPlayerIndex=next.players.findIndex(p=>p.id===id);
   const player=activePlayer(next);if(player.bankrupt)continue;
   next.phase=player.detained?'detention':'awaiting-roll';
   log(next, `${player.name} starts their turn${player.detained?' in Lockup':''}.`,'turns');break;
  }
}
function charge(state: GameState, amount: number, creditorId: string | null, reason: string, category: EventCategory='penalties', debtorId=activePlayer(state).id) {
 const player=state.players.find(p=>p.id===debtorId)!;
 if (player.cash < amount) {
  state.debtResumePhase=state.phase==='detention'?'detention':state.phase==='awaiting-roll'?'awaiting-roll':'actions';
  state.debt={debtorId:player.id,creditorId,amount,reason,category};state.phase='debt';
  log(state,`${player.name} owes $${amount} for ${reason}. Raise funds or declare bankruptcy.`,'penalties',{actorId:player.id,amount,counterpartyId:creditorId});return;
 }
 player.cash-=amount;
 if(creditorId)state.players.find(p=>p.id===creditorId)!.cash+=amount;
 log(state,`${player.name} pays $${amount} ${creditorId?`to ${state.players.find(p=>p.id===creditorId)!.name}`:'to the bank'} for ${reason}.`,category,{actorId:player.id,amount,counterpartyId:creditorId,cashTransfers:[{from:player.id,to:creditorId,amount}]});
}
function settleQueuedPayments(state: GameState) {
 while(state.inheritances.length){
  const entry=state.inheritances[0]!,player=state.players.find(p=>p.id===entry.playerId)!;
  if(player.bankrupt){state.inheritances.shift();continue;}
  entry.propertyIds=entry.propertyIds.filter(id=>state.ownership[id]===player.id&&propertyStatus(state,id).mortgaged);
  if(!entry.interestPaid){entry.interestPaid=true;const interest=entry.propertyIds.reduce((sum,id)=>sum+Math.ceil(mortgageValue(getProperty(state,id))/10),0);if(interest)charge(state,interest,null,'immediate inherited-mortgage interest','mortgages',player.id);if(state.debt)return;}
  if(entry.propertyIds.length){state.phase='inheritance';return;}
  state.inheritances.shift();
 }

 while(state.paymentQueue.length) {
  const payment=state.paymentQueue.shift()!;
  if(state.players.find(p=>p.id===payment.debtorId)!.bankrupt||(payment.creditorId&&state.players.find(p=>p.id===payment.creditorId)!.bankrupt))continue;
  charge(state,payment.amount,payment.creditorId,payment.reason,payment.category,payment.debtorId);
  if(state.debt)return;
 }
 while(state.auctionQueue.length){const propertyId=state.auctionQueue.shift()!;startAuction(state,propertyId);if(state.auction)return;}
 resumeDebt(state);
}
function resumeDebt(state: GameState) {
 const solvent=state.players.filter(p=>!p.bankrupt);
 if(solvent.length<=1){state.winnerId=solvent[0]?.id??null;state.currentPlayerIndex=solvent[0]?state.players.findIndex(p=>p.id===solvent[0]!.id):0;state.phase='finished';state.extraRoll=false;state.debtContinuation=null;return;}

 const continuation=state.debtContinuation;state.debtContinuation=null;
 if(!continuation){if(activePlayer(state).bankrupt)advanceTurn(state);else state.phase=state.debtResumePhase;state.debtResumePhase='actions';return;}
 const player=activePlayer(state);player.detained=false;player.detentionAttempts=0;
 log(state, `${player.name} paid $50 and was released after the third attempt.`,'inspection');
 move(state,continuation.steps);resolveLanding(state,continuation.cardDraw,0,undefined,[...(continuation.entropy??[])]);
}
function sendToLockup(state:GameState){
 const player=activePlayer(state),from=player.position;player.position=10;player.detained=true;player.detentionAttempts=0;state.extraRoll=false;state.consecutiveDoubles=0;state.phase='actions';
 log(state,`${player.name} is sent directly to Lockup without a Launch Plaza bonus.`,'inspection',{movement:{from,to:10,path:[10],mode:'direct'}});
}
function resolveLanding(state:GameState,seed:number,depth=0,override?:{kind:'transit'|'utility';dice?:[number,number]},entropy:number[]=[]){
 requireRule(depth<=8,'Card movement chain exceeded its safe limit.');
 const player=activePlayer(state),space=state.spaces[player.position]!;state.phase='actions';
 if(isPurchasable(space)){
  const owner=state.ownership[space.id];
  if(!owner){state.pendingPurchase=space.id;state.phase='purchase';return;}
  if(owner!==player.id){
   let rent=calculateRent(state,space.id,state.dice?state.dice[0]+state.dice[1]:7);
   if(override?.kind==='transit'&&space.kind==='transit')rent*=2;
   if(override?.kind==='utility'&&space.kind==='utility'&&!propertyStatus(state,space.id).mortgaged){const dice=override.dice!;rent=10*(dice[0]+dice[1]);log(state,`${player.name} rolls fresh utility dice ${dice[0]} + ${dice[1]} and owes 10 × their total: $${rent}.`,'cards',{dice});}
   if(rent)charge(state,rent,owner,`rent at ${space.name}`,'rent');else log(state,`${space.name} is mortgaged; no rent is due.`,'rent',{propertyId:space.id});
  }
 }else if(space.kind==='tax')charge(state,space.amount??0,null,space.name,'taxes');
 else if(space.kind==='detour')sendToLockup(state);
 else if(space.kind==='event'){
  const deck=space.name==='Treasure'?'Treasure':'Luck',card=drawCard(state,deck,entropy.length>=32?()=>entropy.shift()!:seed+depth),effect=card.effect;
  log(state,`${player.name} drew a ${deck} card — ${card.title}: ${card.text}`,'cards',{card:{id:card.id,title:card.title,text:card.text,deck}});
  if(effect.kind==='money'){
   if(effect.amount<0)charge(state,-effect.amount,null,card.title,'cards');
   else{player.cash+=effect.amount;log(state,`${player.name} receives $${effect.amount} from the bank.`,'cards',{amount:effect.amount,cashTransfers:[{from:null,to:player.id,amount:effect.amount}]});}
  }else if(effect.kind==='trouble'){holdCard(player,deck,card.id);log(state,`${player.name} received a Get Out of Trouble card from ${deck}.`,'cards');}
  else if(effect.kind==='opponents'){
   state.paymentQueue=state.players.filter(p=>p.id!==player.id&&!p.bankrupt).map(p=>({debtorId:effect.direction==='collect'?p.id:player.id,creditorId:effect.direction==='collect'?player.id:p.id,amount:effect.amount,reason:card.title,category:'cards'}));settleQueuedPayments(state);
  }else if(effect.kind==='repairs')charge(state,repairBill(state,player.id,effect.development,effect.landmark),null,card.title,'cards');
  else if(effect.kind==='lockup')sendToLockup(state);
  else{
   let steps:number;
   if(effect.kind==='back')steps=-effect.spaces;
   else{const destination=effect.kind==='move'?effect.destination:state.spaces.filter(s=>s.kind===effect.kind).sort((a,b)=>((a.id-player.position+40)%40||40)-((b.id-player.position+40)%40||40))[0]!.id;steps=(destination-player.position+40)%40;}
   move(state,steps);resolveLanding(state,seed,depth+1,effect.kind==='transit'?{kind:'transit'}:effect.kind==='utility'?{kind:'utility',dice:freshUtilityDice(seed,entropy.length>=16?()=>entropy.shift()!:undefined)}:undefined,entropy);
  }
 }
}
/** Pure transition; a revision makes replayed/double-clicked commands invalid. */
export function applyAction(state: GameState, action: GameAction): GameState {
 requireRule(state.phase !== 'finished', 'The game has ended.');
 requireRule(action.expectedRevision === state.revision, 'This action is stale.');
 const actor=state.players.find(p=>p.id===action.actorId);
 requireRule(actor && !actor.bankrupt,'Eliminated or unknown players cannot act.');
 const responding=action.type==='ACCEPT_TRADE'||action.type==='REJECT_TRADE';
 const orderAction=action.type==='ROLL_ORDER'||action.type==='START_GAME';
 if(isOrderPhase(state)||orderAction){
  requireRule(isOrderPhase(state)&&orderAction,'Determine turn order and confirm Start Game before normal gameplay.');
  if(action.type==='ROLL_ORDER')requireRule(state.phase==='turn-order'&&nextOrderRoller(state)?.id===actor.id,'Wait for your turn-order roll.');
  else requireRule(state.phase==='order-ready'&&!actor.isBot,'Only the human may confirm Start Game after all ties are resolved.');
 } else if(responding) {
  requireRule(state.phase==='trade' && state.trade, 'No trade is awaiting approval.');
  requireRule(action.actorId===state.trade.partnerId || (action.type==='REJECT_TRADE'&&action.actorId===state.trade.proposerId), 'Only a trade participant can respond.');
 } else requireRule(action.actorId === actingPlayer(state).id, 'Only the current player or outstanding debtor can act.');
 const next: GameState = {...state,inheritances:structuredClone(state.inheritances),auction:state.auction?structuredClone(state.auction):null,auctionQueue:[...state.auctionQueue],decks:state.decks?structuredClone(state.decks):null,players:state.players.map(p=>({...p,heldCards:p.heldCards.map(c=>({...c}))})),ownership:{...state.ownership},properties:Object.fromEntries(Object.entries(state.properties).map(([id,status])=>[id,{...status}])),log:[...state.log],turnOrder:[...state.turnOrder],turnSelection:state.turnSelection?structuredClone(state.turnSelection):null,developedThisTurn:[...state.developedThisTurn],dice:state.dice?[...state.dice]:null,debt:state.debt?{...state.debt}:null,paymentQueue:state.paymentQueue.map(p=>({...p})),debtContinuation:state.debtContinuation?structuredClone(state.debtContinuation):null,trade:state.trade?structuredClone(state.trade):null};
 switch (action.type) {
 case 'ROLL_ORDER': {recordOrderRoll(next,action.actorId,action.dice);break;}
 case 'START_GAME': {
  requireRule(state.turnOrder.length===state.players.length&&new Set(state.turnOrder).size===state.players.length,'Turn order is incomplete.');
  next.currentPlayerIndex=next.players.findIndex(p=>p.id===next.turnOrder[0]);next.phase='awaiting-roll';next.turn=1;next.turnSelection=null;next.dice=null;next.developedThisTurn=[];
  log(next, `${activePlayer(next).name} starts the game. The finalized turn order is fixed.`,'turns');break;
 }
 case 'PAY_RELEASE': case 'USE_TROUBLE_CARD': {
  requireRule(state.phase==='detention'&&actor.detained,'Release options are available at the beginning of a detained turn.');
  const player=activePlayer(next);
  if(action.type==='PAY_RELEASE') {requireRule(player.cash>=50,'Not enough cash to pay $50.');player.cash-=50;log(next, `${player.name} paid $50 and was released from Lockup.`,'inspection',{amount:50,cashTransfers:[{from:player.id,to:null,amount:50}]});}
  else {requireRule(player.troubleCards>0,'No Get Out of Trouble card is available.');returnHeldCard(next,player);log(next, `${player.name} used a Get Out of Trouble card and was released.`,'inspection');}
  player.detained=false;player.detentionAttempts=0;next.phase='awaiting-roll';break;
 }
 case 'ROLL': case 'ROLL_DETENTION': {
  requireRule(action.type==='ROLL'?(state.phase==='awaiting-roll'||state.phase==='actions'&&state.extraRoll):state.phase==='detention'&&actor.detained, 'Roll only once per turn using the available roll action.');
  requireRule(action.dice.length === 2 && [action.dice[0],action.dice[1]].every(n => Number.isInteger(n) && n >= 1 && n <= 6), 'Invalid dice.');
  requireRule(Number.isInteger(action.cardDraw) && action.cardDraw >= 0 && action.cardDraw < 0x100000000, 'Invalid card draw.');
  next.dice = [...action.dice];
  if(action.type==='ROLL'){const doubles=action.dice[0]===action.dice[1];next.consecutiveDoubles=doubles?state.consecutiveDoubles+1:0;next.extraRoll=doubles;if(next.consecutiveDoubles===3){log(next,`${actor.name} rolled ${action.dice.join(' + ')}: three consecutive doubles send them directly to Lockup.`,'movement',{dice:[...action.dice]});sendToLockup(next);break;}}else{next.extraRoll=false;next.consecutiveDoubles=0;}
  log(next, `${actor.name} rolled ${action.dice[0]} + ${action.dice[1]} = ${action.dice[0]+action.dice[1]}${action.type==='ROLL_DETENTION'&&action.dice[0]!==action.dice[1]?' while attempting doubles':` and landed on ${state.spaces[(actor.position+action.dice[0]+action.dice[1])%40]!.name}`}.`,'movement',{dice:[...action.dice]});
  const player=activePlayer(next),steps=action.dice[0]+action.dice[1];
  if(action.type==='ROLL_DETENTION') {
   if(action.dice[0]===action.dice[1]) {player.detained=false;player.detentionAttempts=0;log(next, `${player.name} rolled doubles and escaped Lockup.`,'inspection');}
   else {
    player.detentionAttempts++;
    if(player.detentionAttempts<3) {log(next, `${player.name} failed doubles attempt ${player.detentionAttempts}; detention continues.`,'inspection');advanceTurn(next);break;}
    log(next, `${player.name} failed the third doubles attempt and must pay $50 before moving.`,'inspection');
    next.debtContinuation={kind:'detention-move',steps,cardDraw:action.cardDraw,entropy:[...(action.entropy??[])]};
    charge(next,50,null,'mandatory Lockup release','inspection');
    if(next.phase!=='debt')resumeDebt(next);
    break;
   }
  }
  move(next,steps); resolveLanding(next, action.cardDraw,0,undefined,[...(action.entropy??[])]); break;
 }
 case 'BANKRUPT': {
  requireRule(state.phase==='debt'&&state.debt,'Bankruptcy requires an outstanding debt.');
  const player=next.players.find(p=>p.id===action.actorId)!,debt=state.debt;
  requireRule(finances(state,player.id).liquidationCash<debt.amount,'Raise funds: your assets can still cover this debt.');
  const transferredMortgages:number[]=[];
  for(const property of ownedProperties(next,player.id)){
   const status={...propertyStatus(next,property.id)};
   const refund=developmentValue(property,status)/2;if(refund){player.cash+=refund;log(next,`${player.name} liquidates developments on ${property.name} for $${refund}.`,'developments',{actorId:player.id,propertyId:property.id,amount:refund,cashTransfers:[{from:null,to:player.id,amount:refund}]});}
   status.level=0;status.landmark=false;
   if(debt.creditorId){next.ownership[property.id]=debt.creditorId;next.properties[property.id]=status;if(status.mortgaged)transferredMortgages.push(property.id);}
   else{delete next.ownership[property.id];delete next.properties[property.id];next.auctionQueue.push(property.id);}
   log(next,`${property.name} transfers from ${player.name} to ${debt.creditorId?next.players.find(p=>p.id===debt.creditorId)!.name:'the bank'}.`,'bankruptcy',{actorId:player.id,propertyTransfers:[{propertyId:property.id,from:player.id,to:debt.creditorId}]});
  }
  const recipient=debt.creditorId?next.players.find(p=>p.id===debt.creditorId)!:null;
  if(recipient){recipient.cash+=player.cash;for(const card of player.heldCards)holdCard(recipient,card.deck,card.id);player.heldCards=[];player.troubleCards=0;if(transferredMortgages.length)next.inheritances.push({playerId:recipient.id,propertyIds:transferredMortgages,interestPaid:false});}
  else while(player.heldCards.length)returnHeldCard(next,player);
  log(next,`${player.name} transfers remaining cash $${player.cash} to ${recipient?.name??'the bank'}.`,'bankruptcy',{actorId:player.id,amount:player.cash,cashTransfers:[{from:player.id,to:debt.creditorId,amount:player.cash}]});
  if(player.id===activePlayer(next).id)next.debtContinuation=null;
  player.cash=0;player.bankrupt=true;player.detained=false;player.detentionAttempts=0;next.debt=null;next.pendingPurchase=null;next.trade=null;next.tradeReturnPhase=null;
  log(next,`${player.name} declares bankruptcy. ${recipient?'The creditor inherits remaining titles and release cards.':'The bank returns release cards and auctions each title.'}`,'bankruptcy',{actorId:player.id});
  settleQueuedPayments(next);break;
 }
 case 'KEEP_INHERITED':case 'REDEEM_INHERITED':{
  requireRule(state.phase==='inheritance'&&state.inheritances[0],'No inherited mortgage choice is pending.');
  const entry=next.inheritances[0]!;
  requireRule(entry.playerId===action.actorId&&entry.propertyIds.includes(action.propertyId),'Choose one of your inherited mortgages.');
  const property=getProperty(next,action.propertyId),player=next.players.find(p=>p.id===action.actorId)!;
  requireRule(next.ownership[property.id]===player.id&&propertyStatus(next,property.id).mortgaged,'This inherited mortgage is no longer available.');
  if(action.type==='REDEEM_INHERITED'){
   const principal=mortgageValue(property);requireRule(player.cash>=principal,'Insufficient cash for the inherited mortgage principal.');player.cash-=principal;next.properties[property.id]={...propertyStatus(next,property.id),mortgaged:false};
   log(next,`${player.name} immediately redeems inherited ${property.name} for its $${principal} principal; transfer interest was already paid.`,'mortgages',{actorId:player.id,propertyId:property.id,amount:principal,cashTransfers:[{from:player.id,to:null,amount:principal}]});
  }else log(next,`${player.name} keeps inherited ${property.name} mortgaged. Future redemption includes another 10% interest.`,'mortgages',{actorId:player.id,propertyId:property.id});
  entry.propertyIds=entry.propertyIds.filter(id=>id!==property.id);settleQueuedPayments(next);break;
 }
 case 'PROPOSE_TRADE': {
  requireRule(['actions','awaiting-roll','detention','debt'].includes(state.phase),'Trading is unavailable in this phase.');
  next.tradeReturnPhase=state.phase;
  validateTrade(state,action.actorId,action.offer);
  next.trade={...structuredClone(action.offer),id:`trade-${state.revision+1}`,proposerId:action.actorId};
  next.phase='trade';
  log(next, `${actor.name} offered ${state.players.find(p=>p.id===action.offer.partnerId)!.name} ${action.offer.offeredProperties.map(id=>getProperty(state,id).name).join(', ')||'no properties'} + $${action.offer.offeredCash} in exchange for ${action.offer.requestedProperties.map(id=>getProperty(state,id).name).join(', ')||'no properties'} + $${action.offer.requestedCash}.`,'trades');break;
 }
 case 'ACCEPT_TRADE': case 'REJECT_TRADE': {
  requireRule(state.trade && state.phase==='trade' && action.tradeId===state.trade.id,'This trade is no longer pending.');
  const trade=state.trade;
  if(action.type==='ACCEPT_TRADE') {
   requireRule(action.actorId===trade.partnerId,'The receiving player must approve.');
   validateTrade(state,trade.proposerId,trade);
   const from=next.players.find(p=>p.id===trade.proposerId)!,to=next.players.find(p=>p.id===trade.partnerId)!;
   from.cash+=trade.requestedCash-trade.offeredCash;to.cash+=trade.offeredCash-trade.requestedCash;
   trade.offeredProperties.forEach(id=>{next.ownership[id]=to.id;});
   trade.requestedProperties.forEach(id=>{next.ownership[id]=from.id;});
   const offered=trade.offeredProperties.map(id=>getProperty(next,id).name).join(', ')||'no properties';
   const requested=trade.requestedProperties.map(id=>getProperty(next,id).name).join(', ')||'no properties';
   log(next, `${to.name} accepts ${from.name}’s trade: ${offered} + $${trade.offeredCash} for ${requested} + $${trade.requestedCash}. Mortgage status carries with each property.`,'trades',{actorId:to.id,propertyTransfers:[...trade.offeredProperties.map(id=>({propertyId:id,from:from.id,to:to.id})),...trade.requestedProperties.map(id=>({propertyId:id,from:to.id,to:from.id}))],cashTransfers:[{from:from.id,to:to.id,amount:trade.offeredCash},{from:to.id,to:from.id,amount:trade.requestedCash}]});
  } else log(next, `${actor.name} ${actor.id===trade.proposerId?'cancels':'rejects'} the trade.`,'trades',{actorId:actor.id});
  next.trade=null;next.phase=state.tradeReturnPhase??'actions';next.tradeReturnPhase=null;break;
 }
 case 'MORTGAGE': case 'UNMORTGAGE': case 'UPGRADE': case 'SELL_UPGRADE': case 'BUILD_LANDMARK': case 'SELL_LANDMARK': {
  const raising=action.type==='MORTGAGE'||action.type==='SELL_UPGRADE'||action.type==='SELL_LANDMARK';
  requireRule(state.phase==='actions'||state.phase==='awaiting-roll'||state.phase==='detention'||(raising&&state.phase==='debt'), 'Property management is unavailable in this phase.');
  const property=getProperty(next,action.propertyId), player=next.players.find(p=>p.id===action.actorId)!;
  requireRule(state.ownership[property.id]===player.id, 'Only the owner may manage a property.');
  const status={...propertyStatus(state,property.id)};next.properties[property.id]=status;
  if(action.type==='MORTGAGE') {
   requireRule(!status.mortgaged, 'This property is already mortgaged.');
   requireRule(status.level===0&&!status.landmark, 'Sell all upgrades on this property before mortgaging.');
   if(property.kind==='property')requireRule(groupProperties(state,property).every(p=>developmentRank(propertyStatus(state,p.id))===0),'Sell all improvements in the color group before mortgaging.');
   status.mortgaged=true;player.cash+=mortgageValue(property);
   log(next, `${player.name} mortgages ${property.name} for $${mortgageValue(property)}.`,'mortgages',{actorId:player.id,propertyId:property.id,amount:mortgageValue(property),cashTransfers:[{from:null,to:player.id,amount:mortgageValue(property)}]});
  } else if(action.type==='UNMORTGAGE') {
   requireRule(status.mortgaged, 'This property is not mortgaged.');
   const cost=unmortgageCost(property);requireRule(player.cash>=cost,'Insufficient cash to unmortgage.');
   status.mortgaged=false;player.cash-=cost;log(next, `${player.name} unmortgages ${property.name} for $${cost}, including interest.`,'mortgages',{actorId:player.id,propertyId:property.id,amount:cost,cashTransfers:[{from:player.id,to:null,amount:cost}]});
  } else {
   requireRule(property.kind==='property','Only city properties can be upgraded.');
   const group=groupProperties(state,property);
   const building=action.type==='UPGRADE'||action.type==='BUILD_LANDMARK';
   if(building) {
    requireRule(!state.developedThisTurn.includes(property.id),'Only one development per property per turn. Wait until your next turn.');
    requireRule(group.every(p=>state.ownership[p.id]===player.id), 'Own the complete color group to develop.');
    requireRule(group.every(p=>!propertyStatus(state,p.id).mortgaged), 'Unmortgage the entire group before developing.');
    if(action.type==='UPGRADE')requireRule(!status.landmark&&status.level<4,'Maximum four development levels; build a Landmark next.');
    else requireRule(status.level===4&&!status.landmark,'A Landmark requires Development Level 4.');
    requireRule(developmentRank(status)===Math.min(...group.map(p=>developmentRank(propertyStatus(state,p.id)))), 'Develop evenly across the group.');
    const cost=action.type==='BUILD_LANDMARK'?property.landmarkCost:property.upgradeCost;
    requireRule(player.cash>=cost,'Insufficient cash to develop.');
    if(action.type==='BUILD_LANDMARK')status.landmark=true;else status.level++;
    next.developedThisTurn.push(property.id);
    player.cash-=cost;log(next, `${player.name} ${status.landmark?'constructed a Landmark':`built Development Level ${status.level}`} on ${property.name} for $${cost}.`,'developments',{actorId:player.id,propertyId:property.id,amount:cost,cashTransfers:[{from:player.id,to:null,amount:cost}]});
   } else {
    if(action.type==='SELL_LANDMARK')requireRule(status.landmark,'There is no Landmark to sell.');
    else requireRule(!status.landmark&&status.level>0,'Sell a Landmark before selling its developments; there must be a development to sell.');
    requireRule(developmentRank(status)===Math.max(...group.map(p=>developmentRank(propertyStatus(state,p.id)))), 'Sell developments evenly across the group.');
    const refund=(action.type==='SELL_LANDMARK'?property.landmarkCost:property.upgradeCost)/2;
    if(action.type==='SELL_LANDMARK')status.landmark=false;else status.level--;
    player.cash+=refund;log(next, `${player.name} sold ${action.type==='SELL_LANDMARK'?'a Landmark (restoring Development Level 4)':'a development'} on ${property.name} for $${refund}.`,'developments',{actorId:player.id,propertyId:property.id,amount:refund,cashTransfers:[{from:null,to:player.id,amount:refund}]});
   }
  }
  break;
 }
 case 'BUY': {
  requireRule(state.phase==='purchase' && state.pendingPurchase!==null, 'No purchase is pending.');
  const property=getProperty(next,state.pendingPurchase), player=activePlayer(next);
  requireRule(!state.ownership[property.id], 'This property is already owned.');
  requireRule(player.cash>=property.price, 'Insufficient cash to purchase.');
  player.cash-=property.price; next.ownership[property.id]=player.id; next.properties[property.id]={level:0,mortgaged:false};
  next.pendingPurchase=null; next.phase='actions'; log(next, `${player.name} buys ${property.name} for $${property.price}.`,'purchases',{propertyId:property.id,amount:property.price,propertyTransfers:[{propertyId:property.id,from:null,to:player.id}],cashTransfers:[{from:player.id,to:null,amount:property.price}]}); break;
 }
 case 'BID':case 'PASS_AUCTION':{if(auctionAction(next,action))settleQueuedPayments(next);break;}
 case 'DECLINE': {
  requireRule(state.phase==='purchase' && state.pendingPurchase!==null, 'No purchase is pending.');
  log(next, `${activePlayer(next).name} declines ${getProperty(next,state.pendingPurchase).name}.`,'purchases',{propertyId:state.pendingPurchase});
  next.pendingPurchase=null;startAuction(next,state.pendingPurchase);break;
 }
 case 'SETTLE_DEBT': {
  requireRule(state.phase==='debt' && state.debt, 'No debt is pending.');
  requireRule(actingPlayer(state).cash>=state.debt.amount, 'Raise enough cash to settle the debt.');
  next.debt=null;next.phase='actions'; charge(next,state.debt.amount,state.debt.creditorId,state.debt.reason,state.debt.category,state.debt.debtorId);settleQueuedPayments(next);break;
 }
 case 'END_TURN': {
  requireRule(state.phase === 'actions', 'Resolve the current action first.');
  requireRule(!state.extraRoll,'Doubles grant another roll before ending your turn.');
  advanceTurn(next);
  break;
 }
 default: throw new Error('Action is not available.');
 }
 if(Object.keys(state.ownership).some(id=>state.ownership[+id]!==next.ownership[+id])||Object.keys(next.ownership).length!==Object.keys(state.ownership).length)announceCollections(state,next);
 if(next.phase==='finished')log(next,next.winnerId?`${activePlayer(next).name} wins as the last solvent tycoon!`:'The table closes with no solvent players.','winner');
 next.revision++;
 return next;
}

/** UI and bots can ask the same engine for availability without duplicating rules. */
export function actionError(state: GameState, action: GameAction): string | null {
 try { applyAction(state,action); return null; } catch(error) { return error instanceof Error ? error.message : 'Invalid action.'; }
}

export function mayProposeTrade(state:GameState,playerId:string){return ['actions','awaiting-roll','detention','debt'].includes(state.phase)&&actingPlayer(state).id===playerId&&!state.players.find(p=>p.id===playerId)!.bankrupt;}
