import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { presentAction, type CardPresentation, actingPlayer, applyAction, createGame, createOnlineGame, TOKENS, type GameAction, type GameState } from '@property-tycoon/shared';
import { GameTable } from '../src/GameTable';
import '../src/styles.css';
const setup={humanName:'Taylor',token:'circle',playerCount:4} as const;
function initial():GameState {
 const s=new URLSearchParams(location.search).get('players')==='8'?createOnlineGame(TOKENS.map((t,i)=>({id:`player-${i+1}`,name:`Seat ${i+1}`,token:t.id})),1234):createGame(setup,1234);if(location.hash==='#order')return s;
 s.phase='awaiting-roll';s.turn=1;s.turnOrder=s.players.map(p=>p.id);s.turnSelection=null;
 const scenario=location.hash.slice(1);
 const params=new URLSearchParams(location.search),card=params.get('card');
 if(card){
  const deck=card.startsWith('luck-')?'Luck':'Treasure';s.decks![deck].draw=[card,...s.decks![deck].draw.filter(id=>id!==card)];s.players[0]!.position=deck==='Luck'?4:14;
  if(params.has('chain')){s.players[0]!.position=33;s.decks!.Treasure.draw=['treasure-07',...s.decks!.Treasure.draw.filter(id=>id!=='treasure-07')];}
  if(params.has('owned')){s.ownership[12]='player-2';s.ownership[15]='player-2';}
  if(params.has('debt')){s.players[0]!.cash=0;s.ownership[1]='player-1';}
  if(params.has('repairs')){s.ownership[1]='player-1';s.properties[1]={level:2,mortgaged:false};}
  return s;
 }
 if(scenario==='treasure-release'||scenario==='treasure-collect'){const id=scenario==='treasure-release'?'treasure-05':'treasure-09';s.decks!.Treasure.draw=[id,...s.decks!.Treasure.draw.filter(c=>c!==id)];s.players[0]!.position=14;return s;}
 if(scenario==='auction'){s.phase='purchase';s.pendingPurchase=1;return applyAction(s,{type:'DECLINE',actorId:'player-1',expectedRevision:0});}
 if(scenario==='extra-roll'){s.ownership[23]='player-1';s.players[0]!.position=18;return applyAction(s,{type:'ROLL',actorId:'player-1',expectedRevision:0,dice:[1,1],cardDraw:0});}
 if(scenario==='inheritance'){s.currentPlayerIndex=1;s.phase='debt';s.debt={debtorId:'player-2',creditorId:'player-1',amount:1000,reason:'Rent'};s.players[1]!.cash=0;s.ownership[1]='player-2';s.properties[1]={level:0,mortgaged:true};return applyAction(s,{type:'BANKRUPT',actorId:'player-2',expectedRevision:0});}
 if(scenario==='debt-trade'){s.currentPlayerIndex=1;s.phase='debt';s.debt={debtorId:'player-1',creditorId:'player-2',amount:10,reason:'Neighborhood supper'};s.players[0]!.cash=0;s.ownership[1]='player-1';return s;}
 if(scenario==='liquidation'){s.players[0]!.cash=160;s.ownership={1:'player-1',3:'player-1'};return applyAction(s,{type:'ROLL',actorId:'player-1',expectedRevision:0,dice:[2,2],cardDraw:0});}
 if(scenario==='bankruptcy'){s.players[0]!.cash=0;s.players[2]!.bankrupt=true;s.players[3]!.bankrupt=true;return applyAction(s,{type:'ROLL',actorId:'player-1',expectedRevision:0,dice:[2,2],cardDraw:0});}
 if(scenario==='detention'||scenario==='third-attempt'){s.players[0]!.position=10;s.players[0]!.detained=true;s.players[0]!.detentionAttempts=scenario==='third-attempt'?2:0;s.players[0]!.troubleCards=1;s.players[0]!.heldCards=[{id:'treasure-05',deck:'Treasure'}];s.decks!.Treasure.draw=s.decks!.Treasure.draw.filter(id=>id!=='treasure-05');s.phase='detention';return s;}
 if(scenario==='leaderboard'){s.players[0]!.cash=1490;s.players[1]!.cash=1500;s.players[2]!.cash=1400;s.players[3]!.cash=9000;s.players[3]!.bankrupt=true;s.ownership={1:'player-1',3:'player-1'};s.phase='actions';return s;}
 if(scenario==='development'){s.ownership={1:'player-1',3:'player-1'};s.phase='actions';return s;}
 if(scenario==='crowded'){
  const development=new URLSearchParams(location.search).get('development');s.spaces.filter(p=>'price' in p).forEach(p=>{s.ownership[p.id]='player-1';if(p.kind==='property'&&(development==='4'||development==='landmark'))s.properties[p.id]={level:4,landmark:development==='landmark',mortgaged:false};});const requested=Number(new URLSearchParams(location.search).get('space')??9);const position=Number.isInteger(requested)&&requested>=0&&requested<40?requested:9;s.players.forEach(p=>{p.position=position;});s.phase='actions';return s;
 }
 if(scenario==='landmark'||scenario==='ownership'){
  s.ownership={1:'player-1',3:'player-1',5:'player-1',15:'player-1',25:'player-2',35:'player-2',12:'player-2',28:'player-2',37:'player-3'};
  if(scenario==='landmark'){s.properties={1:{level:4,mortgaged:false},3:{level:4,mortgaged:false}};s.players[0]!.cash=3000;}
  s.phase='actions';return s;
 }
 if(scenario==='crossing'){s.players[0]!.position=38;return s;}
 if(scenario==='detour'){s.players[0]!.position=28;return s;}
 return s;
}
function Fixtures(){
 const [presentation,setPresentation]=useState<CardPresentation|null>(null);
 const [game,setGame]=useState<GameState|null>(initial),[generation,setGeneration]=useState(1);
 const dispatch=useCallback((action:GameAction)=>setGame(s=>{if(!s)return s;const result=presentAction(s,action);setPresentation(result.presentation);return result.game;}),[]);
 if(!game)return <p>Returned to setup</p>;
 return <><GameTable key={generation} game={game} cardPresentation={presentation} generation={generation} dispatch={dispatch} botsEnabled={['#ownership','#order','#auction','#debt-trade'].includes(location.hash)} onNewGame={()=>{setGeneration(n=>n+1);setGame(createGame(setup));}} onSetup={()=>setGame(null)}/><output hidden data-fixture-state>{JSON.stringify({phase:game.phase,players:game.players,ownership:game.ownership,properties:game.properties,revision:game.revision,turn:game.turn,turnOrder:game.turnOrder,turnSelection:game.turnSelection,developedThisTurn:game.developedThisTurn,acting:actingPlayer(game).id,dice:game.dice})}</output></>;
}
createRoot(document.getElementById('root')!).render(<Fixtures/>);
