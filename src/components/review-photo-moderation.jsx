'use client';
import {useCallback,useEffect,useId,useState} from 'react';
import {reviewPhotosRequest,reviewPhotoFileRequest,moderateReviewPhotoRequest} from '@/lib/api-client';
import styles from './review-photo-moderation.module.css';
function PrivatePhoto({photo,ratingId,accessToken,tenantId}){
 const [url,setUrl]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true,objectUrl;setFailed(false);if(photo.storageState!=='READY')return;reviewPhotoFileRequest(ratingId,photo.id,accessToken,tenantId).then(result=>{if(!active)return;objectUrl=URL.createObjectURL(result.blob);setUrl(objectUrl);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[accessToken,tenantId,ratingId,photo.id,photo.storageState]);
 return url?<img src={url} alt={photo.alt} width={photo.width} height={photo.height}/>:<p>{failed?'Preview unavailable. Refresh photos to retry.':photo.storageState==='READY'?'Loading private preview…':'Incomplete upload; not available for approval.'}</p>;
}
function PhotoCard({photo,ratingId,accessToken,tenantId,canModerate,onSaved}){
 const [note,setNote]=useState(photo.moderationNote||''),[busy,setBusy]=useState(false),[error,setError]=useState('');const uid=useId();
 async function decide(status){if(busy)return;if(status!=='APPROVED'&&note.trim().length<3){setError('Add a reason of at least three characters.');return;}setBusy(true);setError('');try{await moderateReviewPhotoRequest(ratingId,photo.id,{version:photo.version,status,note:note.trim()},accessToken,tenantId);await onSaved();}catch(failure){setError(failure.message||'Unable to save. Refresh photos and try again.');}finally{setBusy(false);}}
 return <article className={styles.card}><PrivatePhoto {...{photo,ratingId,accessToken,tenantId}}/><strong>{photo.alt}</strong><span className={styles.status}>{photo.status.toLowerCase()} · {photo.storageState==='READY'?'Upload complete':'Incomplete'}</span>{error&&<p role="alert" className={styles.error}>{error}</p>}{canModerate&&photo.storageState==='READY'&&<><label htmlFor={uid}>Internal photo decision note</label><textarea id={uid} maxLength={1000} rows={2} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/><div className={styles.actions}>{[['APPROVED','Approve','button-success'],['HIDDEN','Hide','button-warning'],['REJECTED','Reject','button-danger']].map(([status,label,tone])=><button className={`button ${tone}`} key={status} type="button" disabled={busy||photo.status===status} onClick={()=>decide(status)}>{busy?'Saving…':label}</button>)}</div></>}</article>;
}
export default function ReviewPhotoModeration({ratingId,accessToken,tenantId,canModerate,onUpdated}){
 const [photos,setPhotos]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setPhotos((await reviewPhotosRequest(ratingId,accessToken,tenantId)).items);}catch(failure){setError(failure.message);}finally{setLoading(false);}},[ratingId,accessToken,tenantId]);
 useEffect(()=>{load();},[load]);
 return <section className={styles.panel} aria-label="Review photo moderation"><div className={styles.heading}><h3>Customer photos</h3><button type="button" className="button button-secondary" onClick={load} disabled={loading}>Refresh photos</button></div><p>Approve photos individually. They are public only while the parent review is published. Republishing a review also restores its approved photos.</p>{error&&<p role="alert" className={styles.error}>{error}</p>}{loading?<p role="status">Loading review photos…</p>:photos.length?<div className={styles.grid}>{photos.map(photo=><PhotoCard key={`${photo.id}-${photo.version}`} {...{photo,ratingId,accessToken,tenantId,canModerate}} onSaved={async()=>{await load();await onUpdated();}}/>)}</div>:<p>No customer photos uploaded.</p>}</section>;
}
