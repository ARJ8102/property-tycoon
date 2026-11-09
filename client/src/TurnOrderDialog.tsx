import { useViewer } from './Viewer';
import { nextOrderRoller, rollDice, type GameAction, type GameState } from '@property-tycoon/shared';
import { Modal } from './Modal';
import { Token } from './Token';
import { Die } from './Dice';
export function TurnOrderDialog({game,dispatch}:{game:GameState;dispatch:(a:GameAction)=>void}){
 const selection=game.turnSelection;
 if(!selection)return null;
 const roller=nextOrderRoller(game),{human,online,hostId,blocked}=useViewer(game);
 const context={actorId:human.id,expectedRevision:game.revision};
 const ready=game.phase==='order-ready';
 const order=ready?game.turnOrder:selection.groups.flatMap(g=>g.playerIds);
 const ties=selection.groups.filter(g=>g.playerIds.length>1&&g.round>1);
 return <Modal title="Determine Turn Order"><p>Highest initial total plays first. Tied players reroll only within their original tied position; settled places stay fixed.</p>
  {!!ties.length&&<div className="order-ties" role="status">{ties.map(group=><p key={group.playerIds.join('-')}>Reroll round {group.round}: {group.playerIds.map(id=>game.players.find(p=>p.id===id)!.name).join(', ')}</p>)}</div>}
  <ol className="order-roll-list" aria-label={ready?'Final turn order':'Turn-order rolls'}>{order.map((id,index)=>{
   const player=game.players.find(p=>p.id===id)!,rolls=selection.history.filter(r=>r.playerId===id),first=rolls[0],last=rolls.at(-1);
   return <li key={id} className={roller?.id===id?'rolling-next':''} data-order-player={id}><span>{ready?`${index+1}.`:'·'}</span><Token id={player.token} size={25}/><div className="order-player-name"><strong>{player.name}</strong><small>{last?`Initial total ${first!.total}${rolls.length>1?` · Reroll total ${last.total} (round ${last.round})`:''}`:player.isBot?'Bot · waiting to roll':player.id===human.id?'You · waiting to roll':'Waiting to roll'}</small></div><div className="order-dice"><Die value={last?.dice[0]??null}/><Die value={last?.dice[1]??null}/><b>{last?.total??'—'}</b></div></li>;
  })}</ol>
  {ready?<><p className="order-confirmation"><strong>Final order confirmed above.</strong> No one has moved or received a starting bonus. Start Game begins turn 1.</p><button className="primary" disabled={blocked||(online&&hostId!==human.id)} onClick={()=>dispatch({...context,type:'START_GAME'})}>Start Game</button></>:<><p role="status">{roller?.id!==human.id?`Waiting for ${roller?.name} to roll.`:`${human.name}, it’s your turn to roll.`}</p><button className="primary" disabled={blocked||roller?.id!==human.id} onClick={()=>dispatch({...context,type:'ROLL_ORDER',dice:online?[1,1]:rollDice()})}>Roll for Turn Order</button></>}
 </Modal>;
}
