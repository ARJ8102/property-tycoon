import {createContext,useContext} from 'react';
import type {GameState} from '@property-tycoon/shared';
export const ViewerContext=createContext<{playerId?:string;online?:boolean;hostId?:string;blocked?:boolean;onExit?:()=>void;onVacate?:()=>void;onQuit?:()=>void;onPlayers?:()=>void;continueCard?:(revision:number,eventId:number)=>Promise<boolean>}>({});
export function useViewer(game:GameState){
 const viewer=useContext(ViewerContext);const human=game.players.find(p=>p.id===viewer.playerId)??game.players.find(p=>!p.isBot)!;
 return {...viewer,human,canControl:(id:string)=>!viewer.blocked&&(viewer.online?id===human.id:!game.players.find(p=>p.id===id)?.isBot)};
}
