import Link from "next/link";
import styles from './catalog-tabs.module.css';

const tabs = [
  { href: "/admin/catalog/products", label: "Products" },
  { href: "/admin/catalog/masters", label: "Masters" },
  { href: "/admin/catalog/size-guides", label: "Size guides" },
  { href: "/admin/catalog/specifications", label: "Specifications" },
  { href: "/admin/catalog/media", label: "Media" },
  { href: "/admin/catalog/substitutions", label: "Substitutions" },
  { href: "/admin/catalog/bundles", label: "Bundles" }
];

export function CatalogTabs({ currentPath }) {
  return (
    <nav aria-label="Catalog sections" className={`catalog-tabs ${styles.tabs}`}>
      {tabs.map((tab) => (
        <Link aria-current={currentPath === tab.href ? "page" : undefined}
          data-active={currentPath === tab.href || undefined} href={tab.href} key={tab.href}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
