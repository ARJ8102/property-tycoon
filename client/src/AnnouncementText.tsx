import type { GameState } from '@property-tycoon/shared';
function escapeExpression(text:string){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
/** Add semantic emphasis without rewriting the engine's event text or inserting HTML. */
export function AnnouncementText({text,game}:{text:string;game:GameState}){
 const names=game.players.map(p=>p.name).sort((a,b)=>b.length-a.length);
 const playerPattern=names.map(escapeExpression).join('|');
 const pattern=new RegExp(`(\\$\\d[\\d,]*(?:\\.\\d+)?|(?<![\\p{L}\\p{N}_])(?:${playerPattern})(?![\\p{L}\\p{N}_]))`,'gu');
 return <>{text.split(pattern).map((part,index)=>/^\$\d/.test(part)?<strong className="announcement-amount" key={index}>{part}</strong>:names.includes(part)?<strong className="announcement-player" key={index}>{part}</strong>:part)}</>;
}
