"use client";

import Link from "next/link";
import { ArrowRight, Boxes, ClipboardCheck, PackageCheck, ShoppingBag, Store, Tags } from "lucide-react";
import { dashboardAge, dashboardCanOpen, dashboardWork } from "@/lib/dashboard-work";
import "./dashboard-work.css";

const icons = { INVENTORY: Boxes, ORDER: ShoppingBag, RETURN: ClipboardCheck, VENDOR: Store };

export function DashboardWork({ data, user, tenantId }) {
  const { groups, records, attentionAreas, allClear } = dashboardWork(data, user, tenantId);
  const products = dashboardCanOpen(user, tenantId, "/admin/catalog/products", "catalog.product.read");
  const stock = dashboardCanOpen(user, tenantId, "/admin/inventory", "inventory.stock.read");
  return <div className="dashboard-priority-layout">
    <section className="dashboard-priority-panel" aria-labelledby="priority-title">
      <header className="dashboard-priority-heading"><div><p className="eyebrow">Start here</p><h2 id="priority-title">Needs your attention</h2><p>Work stays here until it is resolved. Reading a notification does not clear it.</p></div>
        {attentionAreas > 0 && <span className="status" data-tone="warning">{attentionAreas} {attentionAreas === 1 ? "area" : "areas"} to review</span>}
      </header>
      {allClear && <p className="dashboard-priority-clear"><PackageCheck size={20} aria-hidden="true" />No pending work in the queues you can access.</p>}
      {!groups.length && <p className="dashboard-priority-empty">No operational queues are available for your role. Use your permitted modules or ask your administrator for access.</p>}
      <ul className="dashboard-task-list">{groups.map(group => {
        const Icon = icons[group.type];
        return <li key={group.type} data-tone={group.tone}>
          <span className="dashboard-task-icon"><Icon size={22} aria-hidden="true" /></span>
          <div className="dashboard-task-copy"><h3>{group.title} <span className="dashboard-task-count">{group.count === null ? "Unavailable" : group.count.toLocaleString("en-IN")}</span></h3><p>{group.description}</p>{group.count === 0 && <small>Queue clear</small>}</div>
          <Link className="button button-secondary dashboard-task-action" href={group.href}>{group.action}<ArrowRight size={16} aria-hidden="true" /></Link>
        </li>;
      })}</ul>
      {records.length > 0 && <details className="dashboard-record-preview"><summary>Priority record preview <span>{records.length} shown</span></summary>
        <p>The API returns up to six priority records across all queues. This preview is filtered to your access; use the links for the full lists.</p>
        <ol>{records.map(record => <li key={record.key}><div><strong>{record.reference}</strong><p>{record.work}</p><small>{record.owner} · {dashboardAge(record.createdAt)}</small></div><Link className="dashboard-record-link" href={record.destination.href} aria-label={`${record.destination.action} for ${record.reference}`}>{record.destination.action}<ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ol>
      </details>}
    </section>
    <aside className="dashboard-next-steps" aria-labelledby="next-steps-title"><p className="eyebrow">Helpful shortcuts</p><h2 id="next-steps-title">Product to sellable stock</h2><p>Publishing a product and making it available are separate steps.</p>
      <ol><li><span>1</span><div><strong>Prepare the product</strong><p>Add its details, variant prices and images. New products are saved as drafts.</p></div></li><li><span>2</span><div><strong>Make stock available</strong><p>Receive the exact variant into the correct seller and warehouse. Bundles use component stock.</p></div></li><li><span>3</span><div><strong>Review publication</strong><p>Check the product and seller offer before publishing. A published item can still be out of stock.</p></div></li></ol>
      {products && <Link className="button button-secondary" href="/admin/catalog/products"><Tags size={16} aria-hidden="true" />Manage products<ArrowRight size={16} aria-hidden="true" /></Link>}
      {stock && <Link className="button button-secondary" href="/admin/inventory"><Boxes size={16} aria-hidden="true" />Open inventory<ArrowRight size={16} aria-hidden="true" /></Link>}
      <small>This is workflow guidance, not a live store-readiness check.</small>
    </aside>
  </div>;
}
