import { activePlayer, cashLeaderboard, type GameState } from '@property-tycoon/shared';
import { Token } from './Token';
import { money } from './format';
export function PlayerLeaderboard({game,onSelect,disabled=false}:{game:GameState;onSelect:(id:string)=>void;disabled?:boolean}){
 const current=activePlayer(game);
 return <section className="player-leaderboard" aria-label="Players ranked by cash"><h3>PLAYERS <small>BY CASH</small></h3><ol>{cashLeaderboard(game).map((player,index)=><li key={player.id}><button type="button" data-modal-return data-leaderboard-player={player.id} className={`${current.id===player.id&&game.phase!=='finished'?'current':''} ${player.bankrupt?'eliminated':''}`} aria-current={current.id===player.id&&game.phase!=='finished'?'step':undefined} aria-label={`View ${player.name} portfolio · Cash ${money(player.cash)}${player.bankrupt?' · Bankrupt':''}`} disabled={disabled} onClick={()=>onSelect(player.id)}><span className="cash-rank">{index+1}.</span><Token id={player.token} size={20}/><span className="leaderboard-name" title={player.name}>{player.name}{player.bankrupt&&<small>Bankrupt</small>}</span><b>{money(player.cash)}</b></button></li>)}</ol></section>;
}
