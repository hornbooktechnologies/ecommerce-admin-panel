"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from './auth-provider';
import {tenantIdForUser} from '@/lib/auth-routing';
import {sizeGuidesRequest} from '@/lib/api-client';
import {SizeGuideModal} from './size-guide-modal';
import styles from './size-guide-modal.module.css';

export function ProductSizeGuideDialog({product,onClose}) {
 const {user,accessToken,activeTenantId}=useAuth(),tenantId=tenantIdForUser(user,'admin',activeTenantId);
 const [assignment,setAssignment]=useState(null),[guideId,setGuideId]=useState(''),[selectedName,setSelectedName]=useState(''),[search,setSearch]=useState(''),[choices,setChoices]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[optionsError,setOptionsError]=useState(''),lock=useRef(false);
 useEffect(()=>{const controller=new AbortController();sizeGuidesRequest(`/products/${product.id}/size-guide`,{accessToken,tenantId,signal:controller.signal}).then(data=>{setAssignment(data);setGuideId(data.guideId||'');setSelectedName(data.guide?.name||'');}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});return()=>controller.abort();},[accessToken,tenantId,product.id]);
 useEffect(()=>{const controller=new AbortController();setChoices(null);setOptionsError('');const timer=setTimeout(()=>{sizeGuidesRequest(`/size-guides?${new URLSearchParams({status:'ACTIVE',search:search.trim(),page:'1',pageSize:'100'})}`,{accessToken,tenantId,signal:controller.signal}).then(setChoices).catch(cause=>{if(!controller.signal.aborted)setOptionsError(cause.message);});},200);return()=>{clearTimeout(timer);controller.abort();};},[accessToken,tenantId,search]);
 async function save(event,dismiss){event.preventDefault();if(!assignment||lock.current)return;lock.current=true;setBusy(true);setError('');try{await sizeGuidesRequest(`/products/${product.id}/size-guide`,{accessToken,tenantId,method:'PUT',body:{guideId:guideId||null,previousGuideId:assignment.guideId}});dismiss(true);}catch(cause){setError(cause.message);}finally{lock.current=false;setBusy(false);}}
 const dirty=Boolean(assignment)&&(assignment.guideId||'')!==guideId;
 return <SizeGuideModal title={`Size guide · ${product.name}`} busy={busy} dirty={dirty} onClose={onClose}>{({dismiss})=><form onSubmit={event=>save(event,dismiss)}><div className={styles.body}>
  {!assignment&&!error&&<p role="status">Loading current assignment...</p>}
  <p className={styles.note}>Assign one verified chart to this clothing product. All colours and sizes share this guide. Assigning a guide does not change product approval, price or inventory.</p>
  {assignment?.guide?.status==='INACTIVE'&&<p role="status">The assigned guide is inactive and hidden from customers. Choose an active guide or remove the assignment.</p>}
  <label className="form-field"><span>Find an active guide</span><input type="search" maxLength={190} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search the size-guide library" disabled={busy}/></label>
  {!choices&&!optionsError&&<p role="status">Loading guide options...</p>}
  <label className="form-field"><span>Size guide</span><select disabled={!assignment||busy} value={guideId} onChange={event=>{setGuideId(event.target.value);setSelectedName(choices?.items.find(item=>item.id===event.target.value)?.name||'');}}><option value="">No size guide</option>{guideId&&!choices?.items.some(item=>item.id===guideId)&&<option value={guideId}>{selectedName||'Currently selected guide'}</option>}{choices?.items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.unit==='CM'?'cm':'in'} · {item.basis==='BODY'?'body':'garment'}</option>)}</select></label>
  {choices?.total>100&&<p className={styles.note}>Showing the first 100 matches. Refine the search to find another guide.</p>}
  {optionsError&&<p role="alert" className="form-error">{optionsError}</p>}
  <p className={styles.note}>Create or edit measurements under <Link href="/admin/catalog/size-guides">Catalog → Size guides</Link>. Inactive guides never appear on the storefront.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}
 </div><footer className={styles.footer}><button type="button" className="button button-secondary" disabled={busy} onClick={()=>dismiss()}>Cancel</button><button type="submit" className="button button-primary" disabled={!assignment||busy||!dirty}>{busy?'Saving...':guideId?'Assign guide':'Remove assignment'}</button></footer></form>}</SizeGuideModal>;
}
