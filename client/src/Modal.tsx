import { useEffect, useId, useRef, type ReactNode } from 'react';
export function Modal({title, children, onClose}: {title:string;children:ReactNode;onClose?:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null), headingId=useId();
 useEffect(()=>{
  const dialog=ref.current!;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;
  dialog.showModal(); document.body.style.overflow='hidden';
  const focus=dialog.querySelector<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]');focus?.focus();
  return ()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();else document.querySelector<HTMLElement>('[data-modal-return]')?.focus();};
 },[]);
 return <dialog ref={ref} className="rules-modal game-modal" aria-modal="true" aria-labelledby={headingId} onCancel={e=>{e.preventDefault();onClose?.();}} onClick={e=>{
  if(e.target!==e.currentTarget||!onClose) return;
  const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();
 }} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const targets=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
  const first=targets[0],last=targets[targets.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}><header className="rules-header"><h2 id={headingId}>{title}</h2>{onClose&&<button type="button" className="rules-close" aria-label={`Close ${title}`} onClick={onClose}>×</button>}</header><div className="rules-content" tabIndex={0}>{children}</div></dialog>;
}
