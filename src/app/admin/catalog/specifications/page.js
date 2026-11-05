"use client";
import {useLocalization as useUiLocalization} from '@/localization/provider';
import { ListingExcelExport } from "@/components/listing-excel-export";
import {useCallback,useEffect,useState} from 'react';
import {Plus,Pencil,Eye,ListChecks} from 'lucide-react';
import {AppShell} from '@/components/app-shell';
import {CatalogTabs} from '@/components/catalog-tabs';
import {TablePagination} from '@/components/table-pagination';
import {Status} from '@/components/dashboard-primitives';
import {GlobalLoader} from '@/components/global-loader';
import {SpecificationEditor} from '@/components/specification-editor';
import {useAuth} from '@/components/auth-provider';
import {canUser,tenantIdForUser} from '@/lib/auth-routing';
import {catalogLookupsRequest,specificationsRequest} from '@/lib/api-client';

export default function SpecificationsPage(){
 const {t: _uiText}=useUiLocalization();

 const {user,accessToken,activeTenantId}=useAuth(),tenantId=tenantIdForUser(user,'admin',activeTenantId);
 const canRead=canUser(user,'admin','catalog.product.read',tenantId),canCreate=canUser(user,'admin','catalog.product.create',tenantId),canUpdate=canUser(user,'admin','catalog.product.update',tenantId);
 const [filters,setFilters]=useState({search:'',status:'ALL',vertical:'ALL',page:1,pageSize:10}),[search,setSearch]=useState(''),[result,setResult]=useState(null),[lookups,setLookups]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[editor,setEditor]=useState(null),[notice,setNotice]=useState('');
 const load=useCallback(()=>{if(!accessToken||!tenantId||!canRead)return;const controller=new AbortController();setLoading(true);setError('');
  Promise.all([specificationsRequest(`/specifications?${new URLSearchParams(filters)}`,{accessToken,tenantId,signal:controller.signal}),catalogLookupsRequest(accessToken,tenantId)]).then(([data,choices])=>{if(!controller.signal.aborted){setResult({tenantId,data});setLookups({tenantId,data:choices});}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[accessToken,tenantId,canRead,filters]);
 useEffect(load,[load]);const data=result?.tenantId===tenantId?result.data:null,choices=lookups?.tenantId===tenantId?lookups.data:null;
 return <AppShell area="admin" currentPath="/admin/catalog/specifications" eyebrow="Product confidence" title={_uiText("Specifications")} description="Consistent facts for better product decisions. Define fields, then enter each product’s values."
  action={canCreate&&choices?.productTypes.length?<button type="button" className="button button-primary" onClick={()=>setEditor({tenantId,definition:null})}><Plus size={16} aria-hidden="true"/>New specification</button>:null}>
  <CatalogTabs currentPath="/admin/catalog/specifications"/>
  {notice&&<p className="inline-state" role="status">{notice}</p>}
  <section className="tenant-directory"><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Field library</p><h2>Reusable definitions</h2></div><form className="directory-filters" role="search" onSubmit={event=>{event.preventDefault();setFilters(current=>({...current,search:search.trim(),page:1}));}}><input aria-label="Search specifications" placeholder="Field name or code" maxLength={190} value={search} onChange={event=>setSearch(event.target.value)}/><select aria-label="Specification product type" value={filters.vertical} onChange={event=>setFilters(current=>({...current,vertical:event.target.value,page:1}))}><option value="ALL">All product types</option>{choices?.productTypes.map(item=><option key={item.vertical} value={item.vertical}>{item.name}</option>)}</select><select aria-label="Specification status" value={filters.status} onChange={event=>setFilters(current=>({...current,status:event.target.value,page:1}))}><option value="ALL">{_uiText("All statuses")}</option><option value="ACTIVE">{_uiText("Active")}</option><option value="INACTIVE">{_uiText("Inactive")}</option></select><button type="submit" className="button button-secondary">{_uiText("Search")}</button></form></div>
   {!canRead?<p role="alert">You do not have permission to view specifications.</p>:error?<div className="inline-state inline-state-error" role="alert">{error}<button type="button" onClick={load}>{_uiText("Retry")}</button></div>:loading?<GlobalLoader inline label="Loading specifications"/>:!data?.items.length?<div className="empty-workspace"><ListChecks size={28} aria-hidden="true"/><h3>No specifications in this view</h3><p>Create a field such as Fabric for clothing or RAM for electronics. Fields start internal-only unless you explicitly make them visible to customers.</p></div>:<><ListingExcelExport data={data} title="specifications" disabled={loading}/><div className="table-wrap"><table className="tenant-table"><thead><tr><th>Field</th><th>Scope</th><th>Value type</th><th>Visibility</th><th>{_uiText("Status")}</th><th>Action</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td data-label="Field"><strong>{item.name}</strong><small>{item.code} · {item.group}</small></td><td data-label="Scope">{item.vertical.toLowerCase()}<small>{item.categoryName||'All categories'}</small></td><td data-label="Value type">{item.dataType.toLowerCase()}{item.unit?` · ${item.unit}`:''}</td><td data-label="Visibility">{item.customerVisible?'Customer-visible':'Internal only'}{item.filterable&&<small>Storefront filter enabled</small>}</td><td data-label="Status"><Status tone={item.status==='ACTIVE'?'positive':'neutral'}>{item.status==='ACTIVE'?_uiText("Active"):_uiText("Inactive")}</Status></td><td data-label="Action"><button type="button" className="row-text-action" onClick={()=>setEditor({tenantId,definition:item})}>{canUpdate?<Pencil size={14} aria-hidden="true"/>:<Eye size={14} aria-hidden="true"/>}{canUpdate?_uiText("Edit"):_uiText("View")}</button></td></tr>)}</tbody></table></div><TablePagination  itemLabel="specifications" page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPageChange={page=>setFilters(current=>({...current,page}))} onPageSizeChange={pageSize=>setFilters(current=>({...current,page:1,pageSize}))}/></>}
  </section>
  {editor?.tenantId===tenantId&&choices&&<SpecificationEditor key={`${tenantId}:${editor.definition?.id||'new'}`} definition={editor.definition} lookups={choices} context={{accessToken,tenantId}} canSave={editor.definition?canUpdate:canCreate} onClose={saved=>{setEditor(null);if(saved){setNotice('Specification saved. Use a product’s Specifications action to enter values.');load();}}}/>}
 </AppShell>;
}
