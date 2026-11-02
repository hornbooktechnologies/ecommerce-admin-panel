"use client";
import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useAuth} from './auth-provider';
import {tenantIdForUser} from '@/lib/auth-routing';

const AppearanceContext=createContext(null);
const modeValue=value=>['light','dark','system'].includes(value)?value:null;
function savedMode(key){try{return modeValue(localStorage.getItem(key))||modeValue(localStorage.getItem('commerce-theme'));}catch{return null;}}

export function AdminAppearance({initialTheme,children}) {
 const {user,activeTenantId}=useAuth(),pathname=usePathname()||'/';
 const area=pathname.startsWith('/admin')?'admin':pathname.startsWith('/vendor')?'vendor':'platform';
 // Only maps returned for authenticated memberships may select an override.
 const resolvedTenantId=area==='platform'?null:tenantIdForUser(user,area,activeTenantId);
 const theme=(area==='platform'?user?.ui?.appearance?.platform:user?.ui?.appearance?.[area]?.[resolvedTenantId])||initialTheme;
 const scopeKey=area==='platform'?'platform':theme.scope?.tenantId||'platform';
 const storageKey=`commerce-theme:${scopeKey}`;
 const [preference,setPreference]=useState(null),[systemDark,setSystemDark]=useState(false);
 const preferred=preference?.key===storageKey?preference.value:theme.mode;
 const mode=preferred==='system'?(systemDark?'dark':'light'):preferred;
 useLayoutEffect(()=>{setPreference({key:storageKey,value:savedMode(storageKey)||theme.mode});},[storageKey,theme.mode]);
 useLayoutEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)'),sync=()=>setSystemDark(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 useLayoutEffect(()=>{const root=document.documentElement;root.dataset.theme=mode;root.dataset.appearanceScope=scopeKey;root.dataset.appearanceRevision=theme.revision;},[mode,scopeKey,theme.revision]);
 const toggle=useCallback(()=>{const next=mode==='dark'?'light':'dark';const apply=()=>{document.documentElement.dataset.theme=next;try{localStorage.setItem(storageKey,next);}catch{}setPreference({key:storageKey,value:next});};if(document.startViewTransition&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(apply);else apply();},[mode,storageKey]);
 const value=useMemo(()=>({mode,toggle}),[mode,toggle]);
 return <AppearanceContext.Provider value={value}><style data-workspace-appearance dangerouslySetInnerHTML={{__html:theme.cssText}} />{children}</AppearanceContext.Provider>;
}
export function useAdminAppearance(){const value=useContext(AppearanceContext);if(!value)throw Error('AdminAppearance provider is missing');return value;}
