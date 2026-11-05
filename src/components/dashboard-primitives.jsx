"use client";
import {useLocalization} from '@/localization/provider';
import { ArrowUpRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { ListingExcelExport } from "./listing-excel-export";

export function MetricStrip({ metrics }) {
  const {t}=useLocalization();
  return (
    <section className="metric-strip" aria-label="Operational summary">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <span>{t(metric.label)}</span>
          <strong>{metric.value}</strong>
          <small data-tone={metric.tone}>{metric.context}</small>
        </div>
      ))}
    </section>
  );
}

export function SectionHeading({ eyebrow, title, actionLabel, actionHref }) {
  const {t}=useLocalization();
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h2>{t(title)}</h2>
      </div>
      {actionLabel && actionHref ? (
        <Link className="text-action" href={actionHref}>
          {t(actionLabel)}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      ) : actionLabel ? (
        <button className="text-action" type="button">
          {t(actionLabel)}
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function Status({ tone = "neutral", children }) {
  const {t}=useLocalization();
  return <span className="status" data-tone={tone}>{t(children)}</span>;
}

export function QueueTable({ columns, rows }) {
  const {t}=useLocalization();
  return (
    <>
    <ListingExcelExport data={rows} title="dashboard records" columns={columns.map(column => ({ key: column.key, label: column.label }))} />
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{t(column.label)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function ActivityRail({ events }) {
  return (
    <ol className="activity-list">
      {events.map((event, index) => (
        <li key={event.id || `${event.time}-${event.title}-${event.detail}-${index}`}>
          <span className="activity-marker" aria-hidden="true" />
          <div>
            <strong>{event.title}</strong>
            <p>{event.detail}</p>
          </div>
          <time>{event.time}</time>
        </li>
      ))}
    </ol>
  );
}

export function AttentionNote({ children }) {
  return (
    <p className="attention-note">
      <CircleAlert size={16} aria-hidden="true" />
      {children}
    </p>
  );
}
