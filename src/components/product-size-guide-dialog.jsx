"use client";
import {useLocalization as useUiLocalization} from '@/localization/provider';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from './auth-provider';
import {tenantIdForUser} from '@/lib/auth-routing';
import {sizeGuidesRequest} from '@/lib/api-client';
import {SizeGuideModal} from './size-guide-modal';
import styles from './size-guide-modal.module.css';

export function ProductSizeGuideDialog({product,onClose}) {
 const {t: _uiText}=useUiLocalization();

 const {user,accessToken,activeTenantId}=useAuth(),tenantId=tenantIdForUser(user,'admin',activeTenantId);
 const [assignment,setAssignment]=useState(null),[guideId,setGuideId]=useState(''),[selectedName,setSelectedName]=useState(''),[search,setSearch]=useState(''),[choices,setChoices]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[optionsError,setOptionsError]=useState(''),lock=useRef(false);
 useEffect(()=>{const controller=new AbortController();setAssignment(null);sizeGuidesRequest(`/products/${product.id}/size-guide`,{accessToken,tenantId,signal:controller.signal}).then(data=>{if(controller.signal.aborted)return;setAssignment(data);setGuideId(data.mode==='NONE'?'__none__':data.guideId||'');setSelectedName(data.guide?.name||'');}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});return()=>controller.abort();},[accessToken,tenantId,product.id]);
 useEffect(()=>{const controller=new AbortController();setChoices(null);setOptionsError('');const timer=setTimeout(()=>{sizeGuidesRequest(`/size-guides?${new URLSearchParams({status:'ACTIVE',search:search.trim(),page:'1',pageSize:'100'})}`,{accessToken,tenantId,signal:controller.signal}).then(setChoices).catch(cause=>{if(!controller.signal.aborted)setOptionsError(cause.message);});},200);return()=>{clearTimeout(timer);controller.abort();};},[accessToken,tenantId,search]);
 const mode=guideId==='__none__'?'NONE':guideId?'GUIDE':'INHERIT';
 async function save(event,dismiss){event.preventDefault();if(!assignment||lock.current)return;lock.current=true;setBusy(true);setError('');try{await sizeGuidesRequest(`/products/${product.id}/size-guide`,{accessToken,tenantId,method:'PUT',body:{mode,guideId:mode==='GUIDE'?guideId:null,previousGuideId:assignment.guideId,previousMode:assignment.mode}});dismiss(true);}catch(cause){setError(cause.message);}finally{lock.current=false;setBusy(false);}}
 const dirty=Boolean(assignment)&&(assignment.mode!==mode||(mode==='GUIDE'&&assignment.guideId!==guideId));
 return <SizeGuideModal title={`Size guide · ${product.name}`} busy={busy} dirty={dirty} onClose={onClose}>{({dismiss})=><form onSubmit={event=>save(event,dismiss)}><div className={styles.body}>
  {!assignment&&!error&&<p role="status">Loading current assignment...</p>}
  <p className={styles.note}>Use brand/category defaults, choose a product-specific chart, or hide size guides for this product. All colours and sizes share the same chart. This does not change approval, price or inventory.</p>
  {assignment&&<p className={styles.note} role="status">Current chart: {assignment.resolved?.blocked?'Hidden because the selected guide is inactive or unavailable. No lower-priority chart is substituted.':assignment.resolved?.guide?`${assignment.resolved.guide.name} (${({PRODUCT:'product override',BRAND_CATEGORY:'brand + primary category',BRAND:'brand default',CATEGORY:'primary-category default'})[assignment.resolved.source]||'default'})`:assignment.resolved?.reason||'No matching size guide'}</p>}
  {assignment?.guide?.status==='INACTIVE'&&<p role="status">The assigned guide is inactive and hidden from customers. Choose an active guide or remove the assignment.</p>}
  <label className="form-field"><span>Find an active guide</span><input type="search" maxLength={190} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search the size-guide library" disabled={busy}/></label>
  {!choices&&!optionsError&&<p role="status">Loading guide options...</p>}
  <label className="form-field"><span>{_uiText("Size guide")}</span><select aria-label="Product size-guide setting" disabled={!assignment||busy} value={guideId} onChange={event=>{setGuideId(event.target.value);setSelectedName(choices?.items.find(item=>item.id===event.target.value)?.name||'');}}><option value="">Use brand/category defaults</option><option value="__none__">No size guide for this product</option>{guideId&&guideId!=='__none__'&&!choices?.items.some(item=>item.id===guideId)&&<option value={guideId}>{selectedName||'Currently selected guide'}</option>}{choices?.items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.unit==='CM'?'cm':'in'} · {item.basis==='BODY'?'body':'garment'}</option>)}</select></label>
  {choices?.total>100&&<p className={styles.note}>Showing the first 100 matches. Refine the search to find another guide.</p>}
  {optionsError&&<p role="alert" className="form-error">{optionsError}</p>}
  <p className={styles.note}>Create or edit measurements under <Link href="/admin/catalog/size-guides">Catalog → Size guides</Link>. Inactive guides never appear on the storefront.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}
 </div><footer className={styles.footer}><button type="button" className="button button-secondary" disabled={busy} onClick={()=>dismiss()}>{_uiText("Cancel")}</button><button type="submit" className="button button-primary" disabled={!assignment||busy||!dirty}>{busy?_uiText("Saving..."):'Save size-guide setting'}</button></footer></form>}</SizeGuideModal>;
}
