"use client";
import {useId,useRef,useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {SizeGuideModal} from './size-guide-modal';
import {sizeGuidesRequest} from '@/lib/api-client';
import styles from './size-guide-modal.module.css';

export function SizeGuideEditor({guide,context,canSave,onClose}) {
 const [form,setForm]=useState(()=>guide?{name:guide.name,unit:guide.unit,basis:guide.basis,description:guide.description,instructions:guide.instructions,status:guide.status,columns:guide.columns,rows:guide.rows}:{name:'',unit:'CM',basis:'BODY',description:'',instructions:'',status:'ACTIVE',columns:['Chest'],rows:[{size:'',values:['']}]}),baseline=useRef(JSON.stringify(form));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),id=useId();
 const set=(key,value)=>setForm(current=>({...current,[key]:value}));
 const dirty=JSON.stringify(form)!==baseline.current;
 async function save(event,dismiss){
  event.preventDefault();if(lock.current)return;
  const normal=values=>values.map(value=>value.trim().toLocaleLowerCase('en-IN'));
  if(new Set(normal(form.columns)).size!==form.columns.length||new Set(normal(form.rows.map(row=>row.size))).size!==form.rows.length){setError('Measurement headings and size labels must be unique.');return;}
  lock.current=true;setBusy(true);setError('');
  try{await sizeGuidesRequest(`/size-guides${guide?`/${guide.id}`:''}`,{...context,method:guide?'PUT':'POST',body:{...form,...(guide?{version:guide.version}:{})}});dismiss(true);}
  catch(cause){setError(cause.message||'The size guide could not be saved.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <SizeGuideModal title={canSave?(guide?'Edit size guide':'New size guide'):'View size guide'} busy={busy} dirty={canSave&&dirty} onClose={onClose}>{({dismiss})=><form onSubmit={event=>save(event,dismiss)}>
  <div className={styles.body}>
   <p className={styles.note}>Enter measurements verified for your products. Saving an active guide updates every assigned product. Changing the unit does not convert values: enter measurements in the selected unit. This is guidance, not an automatic fit recommendation.</p>
   <fieldset disabled={!canSave||busy} className={styles.fields} style={{border:0,padding:0,margin:0}}>
    <label className="form-field"><span>Guide name *</span><input autoFocus required minLength={2} maxLength={190} value={form.name} onChange={event=>set('name',event.target.value)} placeholder="e.g. Men's regular-fit trousers" /></label>
    <label className="form-field"><span>Status</span><select value={form.status} onChange={event=>set('status',event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive (hidden from customers)</option></select></label>
    <label className="form-field"><span>Unit</span><select value={form.unit} onChange={event=>set('unit',event.target.value)}><option value="CM">Centimetres (cm)</option><option value="IN">Inches (in)</option></select></label>
    <label className="form-field"><span>Measurement basis</span><select value={form.basis} onChange={event=>set('basis',event.target.value)}><option value="BODY">Body measurements</option><option value="GARMENT">Garment measurements</option></select></label>
    <label className={`form-field ${styles.wide}`}><span>Description</span><input maxLength={1000} value={form.description} onChange={event=>set('description',event.target.value)} placeholder="Explain fit or which collection this guide covers" /></label>
   </fieldset>
   <div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Size measurements in {form.unit==='CM'?'centimetres':'inches'}</caption><thead><tr><th scope="col">Size label</th>{form.columns.map((column,index)=><th scope="col" key={index}><label className="sr-only" htmlFor={`${id}-column-${index}`}>Measurement {index+1} name</label><input id={`${id}-column-${index}`} required maxLength={50} disabled={!canSave||busy} value={column} onChange={event=>set('columns',form.columns.map((value,i)=>i===index?event.target.value:value))} />{canSave&&form.columns.length>1&&<button type="button" className="icon-button" disabled={busy} aria-label={`Remove measurement ${column||index+1}`} onClick={()=>{setForm(current=>({...current,columns:current.columns.filter((_,i)=>i!==index),rows:current.rows.map(row=>({...row,values:row.values.filter((_,i)=>i!==index)}))}));}}><Trash2 aria-hidden="true" size={14}/></button>}</th>)}{canSave&&<th scope="col">Actions</th>}</tr></thead>
    <tbody>{form.rows.map((row,rowIndex)=><tr key={rowIndex}><th scope="row"><input aria-label={`Size label row ${rowIndex+1}`} required maxLength={50} disabled={!canSave||busy} value={row.size} onChange={event=>set('rows',form.rows.map((value,i)=>i===rowIndex?{...value,size:event.target.value}:value))} /></th>{row.values.map((value,columnIndex)=><td key={columnIndex}><input aria-label={`${row.size||`Row ${rowIndex+1}`} ${form.columns[columnIndex]||`measurement ${columnIndex+1}`}`} required maxLength={50} disabled={!canSave||busy} value={value} placeholder="e.g. 92–96" onChange={event=>set('rows',form.rows.map((item,i)=>i===rowIndex?{...item,values:item.values.map((cell,j)=>j===columnIndex?event.target.value:cell)}:item))} /></td>)}{canSave&&<td><button type="button" className="icon-button" disabled={busy||form.rows.length===1} aria-label={`Remove size row ${rowIndex+1}`} onClick={()=>set('rows',form.rows.filter((_,i)=>i!==rowIndex))}><Trash2 aria-hidden="true" size={16}/></button></td>}</tr>)}</tbody>
   </table></div>
   {canSave&&<div className={styles.tools}><button type="button" className="button button-secondary" disabled={busy||form.rows.length>=50} onClick={()=>set('rows',[...form.rows,{size:'',values:form.columns.map(()=>'')}])}><Plus aria-hidden="true" size={15}/>Add size row</button><button type="button" className="button button-secondary" disabled={busy||form.columns.length>=8} onClick={()=>setForm(current=>({...current,columns:[...current.columns,''],rows:current.rows.map(row=>({...row,values:[...row.values,'']}))}))}><Plus aria-hidden="true" size={15}/>Add measurement</button></div>}
   <label className="form-field"><span>How to measure / fit notes</span><textarea disabled={!canSave||busy} rows={4} maxLength={4000} value={form.instructions} onChange={event=>set('instructions',event.target.value)} placeholder="Describe where and how to measure. Explain any fit tolerance or range." /></label>
   {error&&<p className="form-error" role="alert">{error}</p>}
  </div><footer className={styles.footer}><button className="button button-secondary" disabled={busy} type="button" onClick={()=>dismiss()}>{canSave?'Cancel':'Close'}</button>{canSave&&<button className="button button-primary" disabled={busy||Boolean(guide)&&!dirty} type="submit">{busy?'Saving...':'Save size guide'}</button>}</footer>
 </form>}</SizeGuideModal>;
}
