"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import styles from './size-guide-modal.module.css';

export function SizeGuideModal({title,busy=false,dirty=false,onClose,children,eyebrow='Product fit & measurements',entityLabel='size guide',discardMessage='Discard unsaved size-guide changes?'}) {
 const dialog=useRef(null),timer=useRef(null),id=useId(),[closing,setClosing]=useState(false);
 useEffect(()=>{const element=dialog.current,previous=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{clearTimeout(timer.current);element.close();document.body.style.overflow=previous;};},[]);
 function dismiss(saved=false){
  if(closing||busy&&!saved)return;
  if(dirty&&!saved&&!window.confirm(discardMessage))return;
  setClosing(true);
  timer.current=setTimeout(()=>{dialog.current?.close();onClose(saved);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);
 }
 return <dialog ref={dialog} className={styles.dialog} data-closing={closing||undefined} aria-labelledby={id}
  onCancel={event=>{event.preventDefault();dismiss();}}
  onClick={event=>{if(event.target===dialog.current){const b=dialog.current.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dismiss();}}}>
  <header className={styles.header}><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><button className="icon-button" type="button" aria-label={`Close ${entityLabel}`} disabled={busy||closing} onClick={()=>dismiss()}><X aria-hidden="true" size={20}/></button></header>
  {children({dismiss})}
 </dialog>;
}
