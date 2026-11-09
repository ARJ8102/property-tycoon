import { activePlayer, nextTurnPlayer, type GameState } from '@property-tycoon/shared';
import { Token } from './Token';
export function TurnOrderPanel({game}:{game:GameState}){
 const current=activePlayer(game),next=nextTurnPlayer(game);
 return <section className="turn-order-panel" aria-label="Fixed turn order"><h3>TURN ORDER</h3>{!game.turnOrder.length?<p>Determining order before play.</p>:<ol>{game.turnOrder.map((id,index)=>{const player=game.players.find(p=>p.id===id)!;return <li key={id} data-turn-player={id} className={`${id===current.id&&game.phase!=='finished'?'current':''} ${player.bankrupt?'eliminated':''}`} aria-current={id===current.id&&game.phase!=='finished'?'step':undefined}><span>{index+1}.</span><Token id={player.token} size={17}/><span className="turn-order-name">{player.name}</span><small>{player.bankrupt?'Bankrupt':game.phase==='finished'?'':id===current.id?'Now':id===next?.id?'Next':''}</small></li>;})}</ol>}</section>;
}
