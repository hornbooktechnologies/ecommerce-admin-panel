"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

function visiblePages(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
  const result = [];

  ordered.forEach((page, index) => {
    const previous = ordered[index - 1];
    if (previous && page - previous > 1) result.push(`ellipsis-${previous}`);
    result.push(page);
  });

  return result;
}

export function TablePagination({
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
  page = 1,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  total = 0,
  totalPages = 1
}) {
  if (!total) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const firstItem = (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, total);
  const pages = visiblePages(safePage, safeTotalPages);

  return (
    <nav className="table-pagination" aria-label={`${itemLabel} pagination`}>
      <p className="table-pagination-summary" aria-live="polite">
        Showing <strong>{firstItem.toLocaleString("en-IN")}–{lastItem.toLocaleString("en-IN")}</strong> of <strong>{total.toLocaleString("en-IN")}</strong> {itemLabel}
      </p>

      <div className="table-pagination-controls">
        {onPageSizeChange ? (
          <label className="table-page-size">
            <span>Rows</span>
            <select
              aria-label={`Rows per page for ${itemLabel}`}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        ) : null}

        <div className="table-page-buttons">
          <button
            aria-label={`Previous ${itemLabel} page`}
            className="table-page-direction"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
            <span>Previous</span>
          </button>

          <div className="table-page-numbers" aria-label={`Page ${safePage} of ${safeTotalPages}`}>
            {pages.map((entry) => typeof entry === "number" ? (
              <button
                aria-current={entry === safePage ? "page" : undefined}
                aria-label={`Page ${entry}`}
                data-active={entry === safePage || undefined}
                key={entry}
                onClick={() => onPageChange(entry)}
                type="button"
              >
                {entry}
              </button>
            ) : <span aria-hidden="true" key={entry}>…</span>)}
          </div>

          <button
            aria-label={`Next ${itemLabel} page`}
            className="table-page-direction"
            disabled={safePage >= safeTotalPages}
            onClick={() => onPageChange(safePage + 1)}
            type="button"
          >
            <span>Next</span>
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
