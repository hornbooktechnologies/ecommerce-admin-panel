"use client";
import {useLocalization as useUiLocalization} from '@/localization/provider';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from './auth-provider';
import {tenantIdForUser} from '@/lib/auth-routing';
import {specificationsRequest} from '@/lib/api-client';
import {SizeGuideModal} from './size-guide-modal';
import styles from './size-guide-modal.module.css';

export function ProductSpecificationsDialog({product,onClose}){
 const {t: _uiText}=useUiLocalization();

 const {user,accessToken,activeTenantId}=useAuth(),tenantId=tenantIdForUser(user,'admin',activeTenantId);
 const [assignment,setAssignment]=useState(null),[values,setValues]=useState({}),[initial,setInitial]=useState({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 useEffect(()=>{const controller=new AbortController();specificationsRequest(`/products/${product.id}/specifications`,{accessToken,tenantId,signal:controller.signal}).then(data=>{const current=Object.fromEntries(data.definitions.map(d=>[d.id,d.value===null?'':String(d.value)]));setAssignment(data);setInitial(current);setValues(current);}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});return()=>controller.abort();},[accessToken,tenantId,product.id]);
 const dirty=JSON.stringify(values)!==JSON.stringify(initial);
 async function save(event,dismiss){event.preventDefault();if(!assignment||lock.current)return;lock.current=true;setBusy(true);setError('');
  const entries=assignment.definitions.filter(d=>values[d.id]!==''&&values[d.id]!==undefined).map(d=>({definitionId:d.id,value:d.dataType==='NUMBER'?Number(values[d.id]):d.dataType==='BOOLEAN'?values[d.id]==='true':values[d.id]}));
  try{await specificationsRequest(`/products/${product.id}/specifications`,{accessToken,tenantId,method:'PUT',body:{version:assignment.version,definitionRevision:assignment.definitionRevision,values:entries}});dismiss(true);}catch(cause){setError(cause.message);}finally{lock.current=false;setBusy(false);}
 }
 return <SizeGuideModal title={`Specifications · ${product.name}`} eyebrow="Accurate product details" entityLabel="specifications" discardMessage="Discard unsaved product specifications?" busy={busy} dirty={dirty} onClose={onClose}>{({dismiss})=><form onSubmit={event=>save(event,dismiss)}><div className={styles.body}>
  <p className={styles.note}>Fields are scoped to this product’s type and directly assigned categories. Empty values are omitted. Saving does not change price, stock or publication. Legacy custom fields remain separate and unchanged.</p>
  {!assignment&&!error&&<p role="status">Loading specifications…</p>}
  {assignment&&!assignment.definitions.length&&<p>No active fields apply. Add fields in <Link href="/admin/catalog/specifications">Catalog → Specifications</Link>, then reopen this form.</p>}
  <div className={styles.fields}>{assignment?.definitions.map(d=><label className="form-field" key={d.id}><span>{d.name}{d.unit?` (${d.unit})`:''}</span>
   {d.dataType==='SELECT'||d.dataType==='BOOLEAN'?<select disabled={busy} value={values[d.id]??''} onChange={event=>setValues(current=>({...current,[d.id]:event.target.value}))}><option value="">Not provided</option>{d.dataType==='BOOLEAN'?<><option value="true">Yes</option><option value="false">No</option></>:d.options.map(value=><option key={value} value={value}>{value}</option>)}</select>:<input disabled={busy} type={d.dataType==='NUMBER'?'number':d.dataType==='DATE'?'date':'text'} step={d.dataType==='NUMBER'?'any':undefined} min={d.dataType==='NUMBER'?-1e12:undefined} max={d.dataType==='NUMBER'?1e12:undefined} maxLength={d.dataType==='TEXT'?2000:undefined} value={values[d.id]??''} onChange={event=>setValues(current=>({...current,[d.id]:event.target.value}))}/>}
   <small>{d.group} · {d.customerVisible?'Customer-visible':'Internal only'}{d.helpText?` · ${d.helpText}`:''}</small>
  </label>)}</div>
  {error&&<p className="form-error" role="alert">{error}</p>}
 </div><footer className={styles.footer}><button type="button" className="button button-secondary" disabled={busy} onClick={()=>dismiss()}>{_uiText("Cancel")}</button><button type="submit" className="button button-primary" disabled={!assignment||busy||!dirty}>{busy?_uiText("Saving…"):'Save values'}</button></footer></form>}</SizeGuideModal>;
}
