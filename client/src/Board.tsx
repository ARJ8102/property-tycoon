import type { CSSProperties, ReactNode } from 'react';
import { BOARD, GROUP_COLORS, ownershipTint, propertyStatus, rentQuote, activePlayer, isOrderPhase, type GameState, type Space } from '@property-tycoon/shared';
import { Token } from './Token';
import { BoardIcon, type BoardIconName } from './BoardIcon';
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
function coordinates(id: number) {
 if (id <= 10) return {gridRow: 11, gridColumn: 11-id};
 if (id <= 20) return {gridRow: 21-id, gridColumn: 1};
 if (id <= 30) return {gridRow: 1, gridColumn: id-19};
 return {gridRow: id-29, gridColumn: 11};
}
const symbols = {start: '↗', event: '✦', tax: '≋', transit: '⇄', utility: '⌁', rest: '❋', inspection: '⊞', detour: '↪'};
export function Board({game,onPropertySelect,children,positions,busy=false,inspection=false}: {game: GameState | null; onPropertySelect?:(id:number)=>void;children?:ReactNode;positions?:Record<string,number>;busy?:boolean;inspection?:boolean}) {
 return <div className="board-shell" tabIndex={0} role="region" aria-label="World city board; scroll sideways on smaller screens"><div className="board" aria-label="40-space Property Tycoon board">{BOARD.map(space => <BoardSpace key={space.id} space={space} game={game} onPropertySelect={onPropertySelect} positions={positions} busy={busy} inspection={inspection}/>)}
 <div className="board-center"><span className="center-kicker">A WORLD OF OPPORTUNITY</span><div className="city-art" aria-hidden="true">{[32,55,43,82,62,103,75,47,67].map((h,i) => <i key={i} style={{height:h}}/>)}</div><h2>PROPERTY<br/><em>TYCOON</em></h2><p>Your city. Your next move.</p><div className="center-rule"/><span className="edition">THE WORLD CITY EDITION</span><div className="board-status"><span className="status-dot"/>{game ? isOrderPhase(game)?'Determining turn order':game.phase==='finished' ? game.winnerId?`${activePlayer(game).name} wins`:'Table closed' : `${activePlayer(game).name} · Turn ${game.turn}` : 'Your table is waiting'}</div>{children}</div>
 </div></div>;
}
function BoardSpace({space, game, onPropertySelect,positions,busy,inspection}: {space: Space; game: GameState | null; onPropertySelect?:(id:number)=>void;positions?:Record<string,number>;busy:boolean;inspection:boolean}) {
 const position = coordinates(space.id);
 const edge = position.gridRow === 11 ? 'bottom' : position.gridRow === 1 ? 'top' : position.gridColumn === 1 ? 'left' : 'right';
 const icon: BoardIconName | undefined = space.kind === 'event' ? (space.name === 'Treasure' ? 'chest' : 'question') : space.kind === 'utility' ? (space.name === 'Power' ? 'solar' : 'tap') : space.kind==='transit'?'train':space.kind==='tax'?(space.id===4?'civic-tax':'skyline-tax'):undefined;
 const players = game?.players.filter(p => !p.bankrupt && (positions?.[p.id]??p.position) === space.id) ?? [];
 const owner = game?.players.find(p=>p.id===game.ownership[space.id]);
 const nameLength=space.id%10!==0?space.name.length:Math.max(...space.name.split(/\s+/).map(word=>word.length));
 const quote=game&&'price' in space?rentQuote(game,space.id):null;
 const status = game ? propertyStatus(game,space.id) : {level:0,mortgaged:false};
 return <div className={`space ${space.name==='Luck'?'luck':space.name==='Treasure'?'treasure':''} ${space.kind} edge-${edge} ${inspection&&space.id===10?'inspection-highlight':''} ${players.length?'occupied':''} ${players.length>4?'many-occupants':''} ${owner?'owned':''} ${status.level>0||status.landmark?'developed':''} ${space.id % 10 === 0 ? 'corner' : ''}`} style={{...position,'--name-length':nameLength,background:game&&'price' in space?ownershipTint(game,space.id):undefined} as CSSProperties} data-space-id={space.id}>
 {'price' in space&&onPropertySelect&&<button className="space-hit-target" type="button" disabled={busy} aria-label={`View ${space.name} property details`} onClick={()=>onPropertySelect(space.id)}/>}
 {owner && <span className={`ownership-marker ${status.mortgaged?'mortgaged':''}`} title={`${owner.name} owns ${space.name}${status.mortgaged?' · Mortgaged':''} · Development Level ${status.level}`} aria-label={`${owner.name} owns ${space.name}${status.mortgaged?' · Mortgaged':''} · Development Level ${status.level}`}><Token id={owner.token} size={12}/></span>}
 {space.kind==='property'&&(status.level>0||status.landmark)&&<span className={`development-markers ${status.landmark?'landmark':''}`} aria-label={status.landmark?'Landmark':`Development Level ${status.level}`}>{status.landmark?<span/>:Array.from({length:status.level},(_,i)=><i key={i}/>)}</span>}
 {space.kind === 'property' ? <span className="property-color" style={{background:GROUP_COLORS[space.group]}}/> : space.kind !== 'start' && <span className="space-symbol" aria-hidden="true">{icon ? <BoardIcon name={icon}/> : symbols[space.kind]}</span>}
 <span className="space-name" aria-label={space.name==='Luck'?'Luck':undefined}>{space.name==='Luck'?null:space.kind === 'start' ? space.name.toUpperCase() : space.name}</span>{space.kind === 'start' && <span className="start-instruction">Collect $200 when you pass</span>}{'price' in space && <span className="space-price">{money(space.price)}</span>}{quote&&<span className={`space-rent ${quote.kind==='amount'&&quote.mortgaged?'rent-mortgaged':''}`} aria-label={quote.kind==='amount'&&quote.mortgaged?'Rent $0 · Mortgaged':undefined}>Rent {quote.kind==='dice'?`${quote.multiplier}× dice`:money(quote.amount)}{quote.kind==='amount'&&quote.mortgaged&&<> <abbr title="Mortgaged">M</abbr></>}</span>}{space.kind === 'tax' && <span className="space-price">{money(space.amount ?? 0)}</span>}
 {players.length > 0 && <div className="occupants" aria-label={`Players at ${space.name}`}>{players.map(p => <span key={`${p.id}-${space.id}`} className={busy?'moving-token':''} data-player-id={p.id} title={p.name}><Token id={p.token} size={15}/></span>)}</div>}
 </div>;
}
