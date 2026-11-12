import { useCallback, useEffect, useReducer } from 'react';
import { presentAction, recordRejectedAction, chooseBotAction, createGame, actionEntropy, randomInt, rollDice, type CardPresentation, type GameAction, type GameSetup, type GameState } from '@property-tycoon/shared';
interface Session { game:GameState|null; presentation:CardPresentation|null; error:string|null; generation:number }
type SessionAction = {type:'START';setup:GameSetup}|{type:'RESET'}|{type:'COMMAND';action:GameAction};
function reducer(session:Session, command:SessionAction):Session {
 if(command.type==='START')return {game:createGame(command.setup),presentation:null,error:null,generation:session.generation+1};
 if(command.type==='RESET')return {game:null,presentation:null,error:null,generation:session.generation};
 if(!session.game)return session;
 try{return {...session,...presentAction(session.game,command.action),error:null};}
 catch(error){const message=error instanceof Error?error.message:'This action is unavailable.';return {...session,game:recordRejectedAction(session.game,command.action.actorId,message),error:message};}
}
export function useGame() {
 const [session,send]=useReducer(reducer,{game:null,presentation:null,error:null,generation:0});
 const dispatch=useCallback((action:GameAction)=>send({type:'COMMAND',action}),[]);
 return {...session,dispatch,start:(setup:GameSetup)=>send({type:'START',setup}),reset:()=>send({type:'RESET'})};
}

export function useBotTurn(game:GameState|null,dispatch:(action:GameAction)=>void,paused:boolean) {
 useEffect(()=>{
  if(!game||paused)return;
  const candidate=chooseBotAction(game,{dice:[1,1],cardDraw:0});
  if(!candidate)return;
  const timer=window.setTimeout(()=>{
   const action=candidate.type==='ROLL_ORDER'?{...candidate,dice:rollDice()}:(candidate.type==='ROLL'||candidate.type==='ROLL_DETENTION')?{...candidate,dice:rollDice(),cardDraw:randomInt(0x100000000),entropy:actionEntropy()}:candidate;
   dispatch(action);
  },850);
  return ()=>window.clearTimeout(timer);
 },[game,dispatch,paused]);
}
