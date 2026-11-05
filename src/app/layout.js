import "@fontsource-variable/manrope";
import "./globals.css";
import './appearance.css';
import '@/localization/presentation.css';
import "./inbox.css";
import { AuthProvider } from "@/components/auth-provider";
import {AdminAppearance} from '@/components/admin-appearance';
import {getAdminAppearance} from '@/lib/admin-appearance';
import { ModalMotionObserver } from "@/components/modal-motion-observer";
import {cookies} from 'next/headers';
import {LocalizationProvider} from '@/localization/provider';
import {languages,preferenceKey,parsePreference} from '@/localization/core';

export const metadata = {
  title: {
    default: "Commerce OS",
    template: "%s · Commerce OS"
  },
  description: "Multi-tenant commerce operations platform"
};

export default async function RootLayout({ children }) {
  const appearance=await getAdminAppearance();
  const preference=(await cookies()).get(preferenceKey('admin'))?.value||'en:INR';
  const {language}=parsePreference(preference);
  return (
    <html lang={languages[language].locale} data-ui-language={language} data-config-appearance="admin" data-theme={appearance.mode} data-appearance-revision={appearance.revision} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning><LocalizationProvider initialLanguage={language} initialTime={Date.now()}><AuthProvider><AdminAppearance initialTheme={appearance}>{children}</AdminAppearance></AuthProvider><ModalMotionObserver /></LocalizationProvider></body>
    </html>
  );
}
