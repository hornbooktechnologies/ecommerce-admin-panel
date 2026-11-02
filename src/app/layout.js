import "@fontsource-variable/manrope";
import "./globals.css";
import './appearance.css';
import "./inbox.css";
import { AuthProvider } from "@/components/auth-provider";
import {AdminAppearance} from '@/components/admin-appearance';
import {getAdminAppearance} from '@/lib/admin-appearance';
import { ModalMotionObserver } from "@/components/modal-motion-observer";

export const metadata = {
  title: {
    default: "Commerce OS",
    template: "%s · Commerce OS"
  },
  description: "Multi-tenant commerce operations platform"
};

export default async function RootLayout({ children }) {
  const appearance=await getAdminAppearance();
  return (
    <html lang="en-IN" data-config-appearance="admin" data-theme={appearance.mode} data-appearance-revision={appearance.revision} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning><AuthProvider><AdminAppearance initialTheme={appearance}>{children}</AdminAppearance></AuthProvider><ModalMotionObserver /></body>
    </html>
  );
}
