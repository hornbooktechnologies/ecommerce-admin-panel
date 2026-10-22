import "@fontsource-variable/manrope";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ModalMotionObserver } from "@/components/modal-motion-observer";

export const metadata = {
  title: {
    default: "Commerce OS",
    template: "%s · Commerce OS"
  },
  description: "Multi-tenant commerce operations platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body suppressHydrationWarning><AuthProvider>{children}</AuthProvider><ModalMotionObserver /></body>
    </html>
  );
}
