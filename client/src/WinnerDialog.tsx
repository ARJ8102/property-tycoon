import { finances, ownedProperties, type GameState } from '@property-tycoon/shared';
import { Modal } from './Modal';
import { Token } from './Token';
import { money } from './format';
export function WinnerDialog({game,onNewGame,onSetup}: {game:GameState;onNewGame:()=>void;onSetup:()=>void}) {
 const winner=game.players.find(p=>p.id===game.winnerId);
 if(!winner)return <Modal title="Table closed"><p>No solvent players remain.</p><button className="secondary" onClick={onSetup}>Return to Setup</button></Modal>;
 const financial=finances(game,winner.id), owned=ownedProperties(game,winner.id);
 return <Modal title={`${winner.name} wins!`}><div className="winner-token"><Token id={winner.token} size={48}/></div><p>The last solvent tycoon. A world of cities, one winning portfolio.</p><dl className="detail-grid"><dt>Final cash</dt><dd>{money(winner.cash)}</dd><dt>Properties owned</dt><dd>{owned.length}</dd><dt>Final net worth</dt><dd>{money(financial.netWorth)}</dd></dl><p className="winner-properties">{owned.map(p=>p.name).join(' · ')||'No properties owned'}</p><div className="action-row"><button className="primary" onClick={onNewGame}>New Game</button><button className="secondary" onClick={onSetup}>Return to Setup</button></div></Modal>;
}
