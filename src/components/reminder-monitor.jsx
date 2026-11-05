'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import {useEffect,useState} from 'react';
import {reminderMonitorRequest} from '@/lib/api-client';
import {TablePagination} from './table-pagination';
import {ListingExcelExport} from './listing-excel-export';
import {Status} from './dashboard-primitives';
const when=value=>{if(!value)return 'Not yet';const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(date):'Unavailable';};
const columns=[{key:'customerName',label:'Customer'},{key:'storeName',label:'Store'},{key:'kind',label:'Reminder'},{key:'status',label:'Consent status'},...['consentedAt','expiresAt','checkedAt','lastSentAt'].map(key=>({key,label:({consentedAt:'Consented at',expiresAt:'Expires at',checkedAt:'Last checked',lastSentAt:'Last queued'})[key]+' (UTC)',type:'date'})),{key:'deliveryStatus',label:'Delivery status'}];
export function ReminderMonitor({accessToken,tenantId}){
 const {t: _uiText}=useUiLocalization();

 const [filters,setFilters]=useState({status:'ALL',page:1,pageSize:10}),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!tenantId||!accessToken)return;const controller=new AbortController();setLoading(true);setError('');reminderMonitorRequest(filters,{accessToken,tenantId,signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setSnapshot({tenantId,data});}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[accessToken,tenantId,filters,attempt]);
 const data=snapshot?.tenantId===tenantId?snapshot.data:null;
 return <section className="tenant-directory"><header className="section-heading"><div><p className="eyebrow">Consent monitoring</p><h2>Cart & wishlist reminders</h2><p>Read-only. Only customers can opt in. In-app delivery, 24-hour bag / 7-day wishlist delay, 7-day per-type cooldown and 90-day consent.</p></div><label>{_uiText("Status")}<select aria-label="Reminder consent status" value={filters.status} onChange={event=>setFilters(value=>({...value,status:event.target.value,page:1}))}>{['ALL','ACTIVE','OFF','EXPIRED'].map(status=><option key={status} value={status}>{status}</option>)}</select></label><button type="button" className="button button-secondary" disabled={loading} onClick={()=>setAttempt(value=>value+1)}>Refresh reminders</button></header>
  {error?<p role="alert" className="form-error">{error}</p>:loading?<p role="status">Loading reminder consent…</p>:data?<><ListingExcelExport data={data} title="reminder consent" columns={columns}/><div className="table-wrap"><table><thead><tr><th>Customer / store</th><th>Reminder</th><th>Consent</th><th>Last checked</th><th>Last queued</th><th>{_uiText("Delivery")}</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td>{item.customerName}<small>{item.storeName}</small></td><td>{item.kind==='CART'?'Saved bag':_uiText("Wishlist")}</td><td><Status tone={item.status==='ACTIVE'?'positive':'neutral'}>{item.status}</Status><small>Expires {when(item.expiresAt)}</small></td><td>{when(item.checkedAt)}</td><td>{when(item.lastSentAt)}</td><td>{item.deliveryStatus||'Not queued'}</td></tr>)}</tbody></table></div>{!data.items.length&&<p>No reminder consent in this view.</p>}<TablePagination {...{page:data.page,pageSize:data.pageSize,total:data.total,totalPages:data.totalPages}} itemLabel="reminder preferences" onPageChange={page=>setFilters(value=>({...value,page}))} onPageSizeChange={pageSize=>setFilters(value=>({...value,pageSize,page:1}))}/></>:null}
 </section>;
}
