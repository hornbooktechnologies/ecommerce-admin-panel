"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArchiveRestore,
  BarChart3,
  BadgeCheck,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ContactRound,
  ClipboardList,
  CreditCard,
  FileClock,
  FileSpreadsheet,
  LayoutDashboard,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  PackageCheck,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  TicketPercent,
  Truck,
  UsersRound,
  X
} from "lucide-react";
import { AuthGuard, useAuth } from "@/components/auth-provider";
import { AccountPasswordDialog } from "@/components/account-password-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { navigationForUser } from "@/lib/auth-routing";

const icons = {
  overview: LayoutDashboard,
  tenants: Building2,
  users: UsersRound,
  jobs: FileClock,
  audit: ShieldCheck,
  orders: ShoppingBag,
  customers: ContactRound,
  promotions: TicketPercent,
  catalog: Tags,
  inventory: Boxes,
  stores: Store,
  vendors: BriefcaseBusiness,
  returns: ArchiveRestore,
  warranties: BadgeCheck,
  taxes: ReceiptIndianRupee,
  finance: CircleDollarSign,
  reports: BarChart3,
  settings: Settings,
  offers: PackageCheck,
  procurement: PackageSearch,
  bulk: FileSpreadsheet,
  access: ShieldCheck
};

const areaNames = {
  platform: "Platform operations",
  admin: "Northstar Retail",
  vendor: "Aria Electronics"
};

const areaLabels = {
  platform: "Platform workspace",
  admin: "Retail workspace",
  vendor: "Seller workspace"
};

export function AppShell({ area, currentPath, eyebrow, title, description, action, loadingFallback, children }) {
  return (
    <AuthGuard area={area} loadingFallback={loadingFallback ? <AppShellLoading area={area}>{loadingFallback}</AppShellLoading> : null}>
      <AppShellContent
        action={action}
        area={area}
        currentPath={currentPath}
        description={description}
        eyebrow={eyebrow}
        title={title}
      >
        {children}
      </AppShellContent>
    </AuthGuard>
  );
}

function AmbientScene() {
  return (
    <div className="ambient-scene" aria-hidden="true">
      <span className="ambient-grid" />
      <span className="commerce-workflow">
        <svg className="commerce-route" viewBox="0 0 560 330" preserveAspectRatio="none">
          <defs>
            <linearGradient id="commerce-route-signal" x1="0" x2="1">
              <stop offset="0" stopColor="var(--icon-teal)" />
              <stop offset="0.52" stopColor="var(--action)" />
              <stop offset="1" stopColor="var(--icon-warm)" />
            </linearGradient>
          </defs>
          <path className="commerce-route-base" d="M45 246 H145 Q170 246 170 221 V119 Q170 94 195 94 H338 Q363 94 363 119 V207 Q363 232 388 232 H520" />
          <path className="commerce-route-signal" d="M45 246 H145 Q170 246 170 221 V119 Q170 94 195 94 H338 Q363 94 363 119 V207 Q363 232 388 232 H520" pathLength="100" />
          <g className="commerce-route-packet">
            <rect className="commerce-route-packet-halo" x="-16" y="-16" width="32" height="32" />
            <rect x="-11" y="-11" width="22" height="22" />
            <path d="M-5 -3 L0 -6 L5 -3 V4 L0 7 L-5 4 Z M0 -6 V7 M-5 -3 L0 0 L5 -3" />
            <animateMotion dur="10s" path="M45 246 H145 Q170 246 170 221 V119 Q170 94 195 94 H338 Q363 94 363 119 V207 Q363 232 388 232 H520" repeatCount="indefinite" />
          </g>
        </svg>
        <span className="commerce-stage commerce-stage-checkout">
          <CreditCard size={23} strokeWidth={1.7} />
          <i>Checkout</i>
        </span>
        <span className="commerce-parcel">
          <span className="commerce-parcel-top" />
          <span className="commerce-parcel-front">
            <PackageCheck size={38} strokeWidth={1.45} />
            <i className="commerce-parcel-tape" />
            <i className="commerce-barcode" />
          </span>
          <span className="commerce-parcel-side" />
          <span className="commerce-parcel-status"><i>Packing order</i><i>Ready to dispatch</i></span>
        </span>
        <span className="commerce-stage commerce-stage-delivery">
          <Truck size={25} strokeWidth={1.65} />
          <span className="commerce-dispatch-check"><Check size={10} strokeWidth={2.4} /></span>
          <i>Dispatch</i>
        </span>
        <span className="commerce-order-ticket">
          <span><ShoppingBag size={15} strokeWidth={1.8} /><b>ORDER</b></span>
          <i /><i /><strong>₹</strong>
        </span>
      </span>
    </div>
  );
}

function AppShellLoading({ area, children }) {
  return (
    <div className="app-frame app-frame-loading" aria-busy="true">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <AmbientScene />
      <aside className="sidebar shell-loading-sidebar" aria-label={`${areaNames[area]} navigation`}>
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><ShoppingBag size={19} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Commerce OS</strong><small>Operations cloud</small></span>
        </div>
        <div className="context-switcher shell-loading-context">
          <span className="context-switcher-icon" aria-hidden="true"><Store size={17} /></span>
          <span className="context-switcher-copy">
            <small>Workspace</small>
            <strong>{areaNames[area]}</strong>
          </span>
        </div>
        <div className="nav-section-label"><span>Workspace</span><i>1</i></div>
        <nav className="primary-nav" aria-label="Current workspace">
          <span className="nav-link shell-loading-nav-item" data-active data-icon="overview">
            <span className="nav-link-icon"><LayoutDashboard size={17} aria-hidden="true" /></span>
            <span className="nav-link-label">Overview</span>
          </span>
        </nav>
        <div className="sidebar-foot">
          <span className="environment-symbol" aria-hidden="true"><span className="environment-dot" /></span>
          <span className="sidebar-foot-copy">
            <small>System environment</small>
            <strong>Development <em>Online</em></strong>
          </span>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-leading">
            <span className="mobile-topbar-brand">Commerce OS</span>
            <span className="topbar-location">
              <span className="topbar-location-icon"><LayoutDashboard size={17} /></span>
              <span><small>{areaLabels[area]}</small><strong>Opening workspace</strong></span>
            </span>
          </div>
          <span className="shell-loading-status">Opening secure workspace</span>
        </header>
        {children}
      </div>
    </div>
  );
}

function AppShellContent({ area, currentPath, eyebrow, title, description, action, children }) {
  const router = useRouter();
  const { user, logout, activeTenantId, selectTenant } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const activeLinkRef = useRef(null);
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const level = { admin: "TENANT", vendor: "VENDOR" }[area];
  const contexts = [...new Map((user.assignments || [])
    .filter((assignment) => assignment.roleLevel === level && assignment.tenantId)
    .map((assignment) => [assignment.tenantId, {
      id: assignment.tenantId,
      name: (area === "vendor" ? assignment.scopeName : assignment.tenantName)
        || assignment.tenantName || `Tenant ${assignment.tenantId.slice(0, 8)}`,
      roleName: assignment.roleName
    }])).values()];
  const activeContext = contexts.find((context) => context.id === activeTenantId) || contexts[0];
  const contextTenantId = activeContext?.id || null;
  const items = navigationForUser(user, area, contextTenantId);
  const currentItem = [...items]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => item.href === currentPath || (item.matchPrefix && currentPath.startsWith(`${item.matchPrefix}/`))
      || (item.href !== `/${area}` && currentPath.startsWith(`${item.href}/`)));
  const roleName = activeContext?.roleName || user.assignments?.[0]?.roleName || (area === "vendor" ? "Vendor user" : "Administrator");
  const CurrentIcon = icons[currentItem?.icon] || ClipboardList;

  useEffect(() => {
    setNavigationOpen(false);
    const frame = window.requestAnimationFrame(() => {
      activeLinkRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentPath]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const updateViewport = () => setCompactViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);

    try {
      setSidebarCollapsed(window.localStorage.getItem("commerce-sidebar-collapsed") === "true");
    } catch {
      setSidebarCollapsed(false);
    }

    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!navigationOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setNavigationOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigationOpen]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function toggleSidebar() {
    if (compactViewport) {
      setNavigationOpen(true);
      return;
    }

    setSwitcherOpen(false);
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("commerce-sidebar-collapsed", String(next));
      } catch {
        // The layout still works when browser storage is unavailable.
      }
      return next;
    });
  }

  if (!currentItem) {
    return (
      <main className="access-denied" id="workspace">
        <span><LockKeyhole size={22} aria-hidden="true" /></span>
        <p className="eyebrow">Permission required</p>
        <h1>Access is restricted</h1>
        <p>This workspace is not included in your current UI capabilities. Ask a tenant administrator to update your role.</p>
        <button className="button button-primary" onClick={() => router.replace(items[0]?.href || "/login")} type="button">Open an allowed workspace</button>
      </main>
    );
  }

  return (
    <div className="app-frame" data-sidebar-collapsed={sidebarCollapsed || undefined}>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <AmbientScene />
      <aside className="sidebar" data-open={navigationOpen || undefined} id="workspace-navigation" aria-label={`${areaNames[area]} navigation`}>
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><ShoppingBag size={19} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Commerce OS</strong><small>Operations cloud</small></span>
          <button aria-label="Close navigation" className="icon-button sidebar-close" onClick={() => setNavigationOpen(false)} type="button">
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="context-switcher-wrap">
          <button aria-expanded={switcherOpen} className="context-switcher" disabled={(!compactViewport && sidebarCollapsed) || contexts.length < 2} onClick={() => setSwitcherOpen((current) => !current)} title={!compactViewport && sidebarCollapsed ? "Expand navigation to change workspace" : undefined} type="button" aria-label="Change active workspace">
            <span className="context-switcher-icon" aria-hidden="true"><Store size={17} /></span>
            <span className="context-switcher-copy">
              <small>Active workspace</small>
              <strong>{activeContext?.name || areaNames[area]}</strong>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {switcherOpen ? (
            <div className="context-menu" role="menu">
              {contexts.map((context) => (
                <button key={context.id} onClick={() => { selectTenant(context.id); setSwitcherOpen(false); }} role="menuitem" type="button">
                  <span><strong>{context.name}</strong><small>{context.roleName}</small></span>
                  {context.id === activeContext?.id ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="nav-section-label"><span>Workspace</span><i>{items.length}</i></div>
        <nav className="primary-nav" aria-label="Workspace pages">
          {items.map((item) => {
            const Icon = icons[item.icon] || ClipboardList;
            const active = item.href === currentPath
              || (item.matchPrefix && currentPath.startsWith(`${item.matchPrefix}/`))
              || (item.href !== `/${area}` && currentPath.startsWith(`${item.href}/`));

            return (
              <Link aria-current={active ? "page" : undefined} className="nav-link" data-active={active || undefined} data-icon={item.icon} href={item.href} key={item.href} onClick={() => setNavigationOpen(false)} ref={active ? activeLinkRef : undefined} title={!compactViewport && sidebarCollapsed ? item.label : undefined}>
                <span className="nav-link-icon"><Icon size={17} aria-hidden="true" /></span>
                <span className="nav-link-label">{item.label}</span>
                <ChevronRight className="nav-link-arrow" size={14} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <span className="environment-symbol" aria-hidden="true"><span className="environment-dot" /></span>
          <span className="sidebar-foot-copy">
            <small>System environment</small>
            <strong>Development <em>Online</em></strong>
          </span>
        </div>
      </aside>

      <button
        aria-label="Close navigation"
        className="sidebar-backdrop"
        data-open={navigationOpen || undefined}
        onClick={() => setNavigationOpen(false)}
        tabIndex={navigationOpen ? 0 : -1}
        type="button"
      />

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              aria-controls="workspace-navigation"
              aria-expanded={compactViewport ? navigationOpen : !sidebarCollapsed}
              aria-label={compactViewport ? "Open navigation" : sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="icon-button sidebar-toggle"
              data-collapsed={(!compactViewport && sidebarCollapsed) || undefined}
              onClick={toggleSidebar}
              title={compactViewport ? "Open navigation" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {compactViewport ? <Menu size={20} aria-hidden="true" /> : <span className="sidebar-toggle-glyph" aria-hidden="true"><PanelLeftClose className="sidebar-toggle-collapse" size={19} /><PanelLeftOpen className="sidebar-toggle-expand" size={19} /></span>}
            </button>
            <span className="mobile-topbar-brand">Commerce OS</span>
            <span className="topbar-location">
              <span className="topbar-location-icon" data-icon={currentItem.icon}><CurrentIcon size={17} aria-hidden="true" /></span>
              <span><small>{areaLabels[area]}</small><strong>{currentItem.label}</strong></span>
            </span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <div className="user-summary">
              <span className="user-copy">
                <strong>{user.displayName}</strong>
                <small>{roleName}</small>
              </span>
              <span className="avatar" aria-hidden="true">{initials}</span>
            </div>
            <button aria-label="Change password" className="icon-button" onClick={() => setPasswordDialogOpen(true)} title="Change password" type="button">
              <KeyRound size={17} aria-hidden="true" />
            </button>
            <button aria-label="Sign out" className="icon-button" onClick={handleLogout} type="button">
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="workspace" id="workspace">
          <header className="page-heading">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p className="page-description">{description}</p>
            </div>
            {action}
          </header>
          {children}
        </main>
      </div>

      {passwordDialogOpen ? <AccountPasswordDialog onClose={() => setPasswordDialogOpen(false)} /> : null}

    </div>
  );
}
