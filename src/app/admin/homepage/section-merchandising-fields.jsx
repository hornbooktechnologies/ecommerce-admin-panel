'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import {useEffect,useState} from 'react';
import {homepageSectionScopesRequest} from '@/lib/api-client';
import styles from './page.module.css';
const local=value=>{const time=value?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time+330*60000).toISOString().slice(0,16):'';};
const utc=value=>{if(!value)return null;const time=Date.parse(`${value}:00+05:30`);return Number.isFinite(time)?new Date(time).toISOString():value;};
export function SectionMerchandisingFields({section,onChange,context,storeId}){
 const {t: _uiText}=useUiLocalization();

 const [search,setSearch]=useState(''),[choices,setChoices]=useState(null),[error,setError]=useState('');
 const query=new URLSearchParams({search,...(section.brandId?{brandId:section.brandId}:{}),...(section.categoryId?{categoryId:section.categoryId}:{})}).toString();
 useEffect(()=>{if(section.key==='BANNER')return;const controller=new AbortController();setError('');const timer=setTimeout(()=>{homepageSectionScopesRequest(storeId,query,{...context,signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setChoices({tenantId:context.tenantId,storeId,data});}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});},200);return()=>{controller.abort();clearTimeout(timer);};},[section.key,context.accessToken,context.tenantId,storeId,query]);
 const data=choices?.tenantId===context.tenantId&&choices.storeId===storeId?choices.data:null;
 return <div className={styles.fields}>
  <h3>Visibility schedule</h3><small>India Standard Time (UTC+05:30). Start is inclusive; end is exclusive. Blank means no limit. Changes go live only after publishing. Preview ignores the date window.</small>
  <div className={styles.twoColumns}><label className="form-field"><span>Starts at (IST)</span><input aria-label="Section starts at IST" type="datetime-local" value={local(section.startsAt)} onChange={event=>onChange('startsAt',utc(event.target.value))}/></label><label className="form-field"><span>Ends at (IST)</span><input aria-label="Section ends at IST" type="datetime-local" value={local(section.endsAt)} onChange={event=>onChange('endsAt',utc(event.target.value))}/></label></div>
  {section.startsAt&&section.endsAt&&Date.parse(section.startsAt)>=Date.parse(section.endsAt)&&<p role="alert" className="form-error">End must be later than start.</p>}
  {section.key!=='BANNER'&&<><h3>Collection scope</h3><small>Leave both selections blank for the full store catalog. Brand + category combine with AND. Category follows the product's storefront category, not descendants automatically.</small><label className="form-field"><span>Find brand or category</span><input type="search" maxLength={190} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Refine the choices below"/></label>
   <div className={styles.twoColumns}>{[['brandId','brands','Brand'],['categoryId','categories','Category']].map(([key,list,label])=><label key={key} className="form-field"><span>{label}</span><select aria-label={`Collection ${label.toLowerCase()}`} value={section[key]||''} onChange={event=>onChange(key,event.target.value||null)}><option value="">{_uiText("All")} {list}</option>{section[key]&&!data?.[list].some(item=>item.id===section[key])&&<option value={section[key]}>Selected {label.toLowerCase()}</option>}{data?.[list].map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}</div>
   {(data?.brandsHasMore||data?.categoriesHasMore)&&<small>Showing the first 100 matches per list. Refine your search for more.</small>}{error&&<p role="alert" className="form-error">{error}</p>}
   <label className={styles.check}><input type="checkbox" checked={Boolean(section.inStockOnly)} onChange={event=>onChange('inStockOnly',event.target.checked)}/>Only show purchasable, in-stock offers</label>
   {section.key!=='LIBRARY'&&(section.brandId||section.categoryId)&&<small>Use Show filtered collection link below to open the matching product listing automatically. No manual destination is needed for a scoped collection.</small>}
  </>}
 </div>;
}
