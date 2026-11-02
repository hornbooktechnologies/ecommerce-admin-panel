"use client";
import {Moon,Sun} from 'lucide-react';
import {useAdminAppearance} from './admin-appearance';
export function ThemeToggle({inverse=false}) {
 const {mode,toggle}=useAdminAppearance(),Icon=mode==='dark'?Sun:Moon;
 return <button aria-label={`Switch to ${mode==='dark'?'light':'dark'} theme`} className={`icon-button${inverse?' icon-button-inverse':''}`} onClick={toggle} type="button"><Icon aria-hidden="true" size={17}/></button>;
}
