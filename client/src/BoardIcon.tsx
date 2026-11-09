export type BoardIconName = 'chest' | 'solar' | 'tap' | 'question' | 'train' | 'civic-tax' | 'skyline-tax';

/** Shared stroke styling keeps the small board illustrations consistent. */
export function BoardIcon({ name }: { name: BoardIconName }) {
 return <svg className="board-icon" data-icon={name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name==='train'?2:1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {name === 'chest' && <><path d="M3 11V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3M3 11h18v9H3zM7 4v7m10-7v7M3 14h7m4 0h7"/><rect x="10" y="11" width="4" height="6" rx="1"/></>}
  {name === 'solar' && <><path d="M4 3h16l2 13H2L4 3Zm-.7 6.5h17.4M9 3 8 16m7-13 1 13M12 16v5m-5 0h10"/></>}
  {name === 'tap' && <><path d="M3 10h11a6 6 0 0 1 6 6v1h-5v-1a1 1 0 0 0-1-1H3m0-7v9m7-7V5M6 5h8"/><path d="M18 19s-1.5 1.5-1.5 2.3a1.5 1.5 0 0 0 3 0C19.5 20.5 18 19 18 19Z"/></>}
  {name === 'train' && <><rect x="5" y="2" width="14" height="16" rx="4"/><path d="M5 10h14M12 2v8M8 18l-3 4m11-4 3 4M7 21h10"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></>}
  {name==='civic-tax'&&<><path d="m2 8 10-6 10 6H2Zm2 13h16M5 10v8m5-8v8m4-8v8m5-8v8M3 18h18"/></>}
  {name==='skyline-tax'&&<><path d="M3 21V9h6V3h7v10h5v8H3Zm6-8v8m7-8v8M5 12h1m-1 4h1m6-10h1m-1 4h1m-1 4h1m5 2h1"/></>}
  {name === 'question'   && <><path d="M7.5 7a4.5 4.5 0 0 1 9 0c0 3-4.5 3.2-4.5 6.5V15"/><circle cx="12" cy="20" r=".8" fill="currentColor" stroke="none"/></>}
 </svg>;
}
