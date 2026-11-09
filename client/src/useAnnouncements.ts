import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameState } from '@property-tycoon/shared';
/** Only presentation state lives here. Engine event IDs keep the queue ordered. */
export function useAnnouncements(game:GameState|null, generation:number, paused:boolean) {
 const seen=useRef({generation,id:game?.log[0]?.id??0});
 const [queue,setQueue]=useState<GameEvent[]>([]);
 useEffect(()=>{
  if(seen.current.generation!==generation||!game){seen.current={generation,id:0};setQueue([]);}
  if(!game)return;
  const incoming=game.log.filter(e=>e.id>seen.current.id).sort((a,b)=>a.id-b.id);
  seen.current.id=game.log[0]?.id??0;
  // Dice already describe their destination; the separate movement record drives animation.
  const announcements=incoming.filter(e=>(e.category!=='auctions'||/wins|remains unowned/.test(e.message))&&!['turns','system'].includes(e.category)&&!(e.category==='movement'&&e.movement));
  if(announcements.length)setQueue(current=>[...current,...announcements]);
 },[game?.log,generation,game]);
 const current=queue[0]??null;
 useEffect(()=>{
  if(!current||paused)return;
  const timer=window.setTimeout(()=>setQueue(items=>items.slice(1)),3000);
  return ()=>window.clearTimeout(timer);
 },[current?.id,paused]);
 return {current,pending:queue.length,catchingUp:!!game&&seen.current.id<(game.log[0]?.id??0),dismiss:()=>setQueue(items=>items.slice(1))};
}
