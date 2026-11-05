'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import {ReminderMonitor} from '@/components/reminder-monitor';
import { ListingExcelExport } from "@/components/listing-excel-export";
import {useCallback,useEffect,useState} from 'react';
import {AppShell} from '@/components/app-shell';
import {useAuth} from '@/components/auth-provider';
import {tenantIdForUser} from '@/lib/auth-routing';
import {shoppingAlertsRequest} from '@/lib/api-client';
import {TablePagination} from '@/components/table-pagination';
import {Status} from '@/components/dashboard-primitives';
import styles from './shopping-alerts.module.css';
const date=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});
const when=value=>{if(!value)return 'Not checked yet';const parsed=new Date(value);return Number.isFinite(parsed.getTime())?date.format(parsed):'Not available';};
export default function ShoppingAlertsPage(){
 const {t: _uiText}=useUiLocalization();
const {accessToken,activeTenantId,user}=useAuth(),tenantId=tenantIdForUser(user,'admin',activeTenantId);const [filters,setFilters]=useState({status:'ALL',page:1,pageSize:10}),[result,setResult]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{if(!accessToken||!tenantId)return;setLoading(true);setError('');try{setResult(await shoppingAlertsRequest(filters,accessToken,tenantId));}catch(failure){setError(failure.message);}finally{setLoading(false);}},[accessToken,tenantId,filters]);useEffect(()=>{load();},[load]);
 return <AppShell area="admin" currentPath="/admin/shopping-alerts" eyebrow="Customer retention" title={_uiText("Shopping alerts")} description="Monitor customer-consented, one-time in-app stock and price alerts. No emails, price promises or inventory reservations.">
  <section className={styles.panel}><header className={styles.heading}><div><h2>Alert subscriptions</h2><p>Stock and prices use the storefront’s current eligibility rules. A scan queues an update; the inbox worker delivers it. Customers manage consent from their account.</p></div><div className={styles.filters}><label>{_uiText("Status")}<select value={filters.status} onChange={event=>setFilters(f=>({...f,status:event.target.value,page:1}))}>{['ALL','ACTIVE','TRIGGERED','CANCELLED','EXPIRED'].map(status=><option key={status} value={status}>{status==='ALL'?_uiText("All statuses"):status.toLowerCase()}</option>)}</select></label><button className="button button-secondary" disabled={loading} type="button" onClick={load}>{_uiText("Refresh")}</button></div></header>
  {error&&<div className="inline-state inline-state-error" role="alert">{error}</div>}{loading?<div className={styles.skeleton} role="status">Loading shopping alerts…</div>:!result?.items.length?<div className={styles.empty}><h3>No subscriptions in this view</h3><p>Customer opt-ins appear here after they subscribe on a product page.</p></div>:<><ListingExcelExport data={result} title="subscriptions" disabled={loading}/><div className={styles.wrap}><table className={styles.table}><thead><tr><th>Product & seller</th><th>Customer / store</th><th>Alert</th><th>{_uiText("Status")}</th><th>Last checked</th><th>{_uiText("Delivery")}</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><td data-label="Product & seller"><strong>{item.productName}</strong><small>{item.variantName} · {item.sellerName}</small></td><td data-label="Customer / store"><strong>{item.customerName}</strong><small>{item.storeName}</small></td><td data-label="Alert"><strong>{item.kind==='BACK_IN_STOCK'?'Back in stock':'Price drop'}</strong><small>{item.kind==='PRICE_DROP'?`Below ${new Intl.NumberFormat('en-IN',{style:'currency',currency:item.currency}).format(item.baselinePrice)}`:'Exact selected offer'} · Expires {when(item.expiresAt)}</small></td><td data-label="Status"><Status tone={item.status==='ACTIVE'?'positive':item.status==='TRIGGERED'?'warning':'neutral'}>{item.status.toLowerCase()}</Status></td><td data-label="Last checked">{when(item.checkedAt)}</td><td data-label="Delivery">{item.deliveryStatus?item.deliveryStatus.toLowerCase():'Not queued'}</td></tr>)}</tbody></table></div><TablePagination  {...{page:result.page,pageSize:result.pageSize,total:result.total,totalPages:result.totalPages}} pageSizeOptions={[10,20,50]} itemLabel="subscriptions" onPageChange={page=>setFilters(f=>({...f,page}))} onPageSizeChange={pageSize=>setFilters(f=>({...f,pageSize,page:1}))}/></>}
  <p className={styles.note}>“Triggered” means a one-time notification was queued, not that an order was placed or a customer read it. No last-checked time means the shopping-alert monitor has not checked that subscription yet.</p>
  </section>
  <ReminderMonitor accessToken={accessToken} tenantId={tenantId}/>
 </AppShell>;
}
