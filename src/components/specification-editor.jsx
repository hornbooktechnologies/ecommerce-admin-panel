"use client";
import {useRef,useState} from 'react';
import {specificationsRequest} from '@/lib/api-client';
import {SizeGuideModal} from './size-guide-modal';
import styles from './size-guide-modal.module.css';

export function SpecificationEditor({definition,lookups,context,canSave,onClose}){
 const initial=definition?{code:definition.code,name:definition.name,vertical:definition.vertical,categoryId:definition.categoryId||'',dataType:definition.dataType,unit:definition.unit,group:definition.group,helpText:definition.helpText,options:definition.options.join('\n'),customerVisible:definition.customerVisible,sortOrder:definition.sortOrder,status:definition.status}:{code:'',name:'',vertical:lookups.productTypes[0]?.vertical||'',categoryId:'',dataType:'TEXT',unit:'',group:'Details',helpText:'',options:'',customerVisible:false,sortOrder:0,status:'ACTIVE'};
 const [form,setForm]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const set=(key,value)=>setForm(current=>({...current,[key]:value}));
 const dirty=JSON.stringify(form)!==JSON.stringify(initial);
 async function save(event,dismiss){event.preventDefault();if(lock.current||!canSave)return;lock.current=true;setBusy(true);setError('');
  const body={...form,categoryId:form.categoryId||null,options:form.dataType==='SELECT'?form.options.split('\n').map(value=>value.trim()).filter(Boolean):[],unit:form.dataType==='NUMBER'?form.unit:'',sortOrder:Number(form.sortOrder),...(definition?{version:definition.version}:{})};
  try{await specificationsRequest(`/specifications${definition?`/${definition.id}`:''}`,{...context,method:definition?'PUT':'POST',body});dismiss(true);}catch(cause){setError(cause.message);}finally{lock.current=false;setBusy(false);}
 }
 return <SizeGuideModal title={definition?'Edit specification':'New specification'} eyebrow="Reusable product facts" entityLabel="specification" discardMessage="Discard unsaved specification changes?" busy={busy} dirty={dirty} onClose={onClose}>{({dismiss})=><form onSubmit={event=>save(event,dismiss)}><div className={styles.body}>
  <p className={styles.note}>Define a field once, then fill its value from a product’s Specifications action. Scope and data type cannot change after creation. Changes to labels, visibility and status affect every product using this field.</p>
  <fieldset disabled={busy||!canSave} className={styles.fields}>
   <label className="form-field"><span>Field name</span><input required maxLength={120} value={form.name} onChange={event=>set('name',event.target.value)}/></label>
   <label className="form-field"><span>Stable code</span><input required pattern="[A-Z][A-Z0-9_]{1,59}" maxLength={60} disabled={Boolean(definition)} value={form.code} onChange={event=>set('code',event.target.value.toUpperCase())} placeholder="FABRIC or STORAGE_GB"/><small>Unique within this tenant; used to align comparison rows.</small></label>
   <label className="form-field"><span>Product type</span><select required disabled={Boolean(definition)} value={form.vertical} onChange={event=>set('vertical',event.target.value)}>{lookups.productTypes.map(item=><option value={item.vertical} key={item.id||item.vertical}>{item.name}</option>)}</select></label>
   <label className="form-field"><span>Category scope</span><select disabled={Boolean(definition)} value={form.categoryId} onChange={event=>set('categoryId',event.target.value)}><option value="">All categories in this type</option>{lookups.categories.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><small>A selected category matches directly assigned products, not subcategories automatically.</small></label>
   <label className="form-field"><span>Value type</span><select disabled={Boolean(definition)} value={form.dataType} onChange={event=>set('dataType',event.target.value)}>{['TEXT','NUMBER','BOOLEAN','DATE','SELECT'].map(type=><option value={type} key={type}>{{TEXT:'Text',NUMBER:'Number',BOOLEAN:'Yes / No',DATE:'Date',SELECT:'Choice'}[type]}</option>)}</select></label>
   <label className="form-field"><span>Group heading</span><input required maxLength={80} value={form.group} onChange={event=>set('group',event.target.value)}/></label>
   {form.dataType==='NUMBER'&&<label className="form-field"><span>Unit (optional)</span><input maxLength={30} value={form.unit} onChange={event=>set('unit',event.target.value)} placeholder="GB, cm, kg"/><small>Enter values in this unit. No automatic conversion.</small></label>}
   {form.dataType==='SELECT'&&<label className={`form-field ${styles.wide}`}><span>Allowed choices · one per line</span><textarea required rows={5} value={form.options} onChange={event=>set('options',event.target.value)}/><small>Up to 50 unique choices. Used choices cannot be removed.</small></label>}
   <label className={`form-field ${styles.wide}`}><span>Entry instructions (optional)</span><textarea maxLength={500} rows={2} value={form.helpText} onChange={event=>set('helpText',event.target.value)}/></label>
   <label className="form-field"><span>Display order</span><input type="number" min={0} max={9999} required value={form.sortOrder} onChange={event=>set('sortOrder',event.target.value)}/></label>
   <label className="form-field"><span>Status</span><select value={form.status} onChange={event=>set('status',event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive · hidden from products and customers</option></select></label>
   <label className={styles.wide}><input type="checkbox" checked={form.customerVisible} onChange={event=>set('customerVisible',event.target.checked)}/> Visible to customers on product pages and comparison</label>
  </fieldset>
  {error&&<p className="form-error" role="alert">{error}</p>}
 </div><footer className={styles.footer}><button className="button button-secondary" type="button" disabled={busy} onClick={()=>dismiss()}>Cancel</button>{canSave&&<button className="button button-primary" disabled={busy||!dirty} type="submit">{busy?'Saving…':'Save specification'}</button>}</footer></form>}</SizeGuideModal>;
}
