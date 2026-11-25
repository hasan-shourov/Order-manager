import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  firstDayOfMonthInDhaka,
  formatDateOnly,
  todayInDhaka,
} from '../lib/date';
import { formatTaka } from '../lib/money';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Spinner,
  buttonClass,
  inputClass,
} from '../components/ui';
import type { SummaryResult } from '../types';

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? 'min-w-0 rounded-xl border border-brand-200 bg-brand-50 p-3 sm:p-4'
          : 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          emphasis
            ? 'mt-1 break-words text-base font-bold text-brand-800 sm:text-xl'
            : 'mt-1 break-words text-base font-bold text-slate-900 sm:text-xl'
        }
      >
        {value}
      </p>
    </div>
  );
}

export default function SummaryPage() {
  const [mode, setMode] = useState<'all' | 'custom'>('all');
  const [from, setFrom] = useState(firstDayOfMonthInDhaka());
  const [to, setTo] = useState(todayInDhaka());
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (range: { from: string; to: string } | null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSummary(range);
      setSummary(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the summary. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary(null);
  }, [fetchSummary]);

  function selectAllTime() {
    setMode('all');
    setRangeError(null);
    void fetchSummary(null);
  }

  function applyCustomRange() {
    setRangeError(null);
    if (!from || !to) {
      setRangeError('Choose both a start date and an end date.');
      return;
    }
    if (from > to) {
      setRangeError('The start date must be on or before the end date.');
      return;
    }
    setMode('custom');
    void fetchSummary({ from, to });
  }

  const rangeLabel = summary?.range
    ? `${formatDateOnly(summary.range.from)} – ${formatDateOnly(summary.range.to)}`
    : 'All Time';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Summary"
        description="Sales totals from your non-deleted memos. Archived items appear only when they have sales in the selected period."
        actions={
          <Button
            variant="secondary"
            onClick={() => void fetchSummary(summary?.range ?? null)}
            disabled={loading}
          >
            {loading ? <Spinner /> : null}
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1.5 block text-sm font-medium text-slate-700">Period</p>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={selectAllTime}
                aria-pressed={mode === 'all'}
                className={
                  mode === 'all'
                    ? 'min-h-11 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                    : 'min-h-11 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900'
                }
                disabled={loading}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                aria-pressed={mode === 'custom'}
                className={
                  mode === 'custom'
                    ? 'min-h-11 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                    : 'min-h-11 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900'
                }
                disabled={loading}
              >
                Custom Range
              </button>
            </div>
          </div>

          {mode === 'custom' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <label
                  htmlFor="summary-from"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Start date
                </label>
                <input
                  id="summary-from"
                  type="date"
                  className={inputClass}
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label
                  htmlFor="summary-to"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  End date
                </label>
                <input
                  id="summary-to"
                  type="date"
                  className={inputClass}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  disabled={loading}
                />
              </div>
              <Button onClick={applyCustomRange} disabled={loading} className="w-full sm:w-auto">
                Apply
              </Button>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Dates are interpreted in the Asia/Dhaka time zone (UTC+6) and include the full end
          date. Showing: <strong>{rangeLabel}</strong>
        </p>
        {rangeError ? (
          <p className="mt-2 text-xs font-medium text-red-600">{rangeError}</p>
        ) : null}
      </Card>

      {loading && !summary ? <LoadingPanel message="Loading the summary…" /> : null}

      {!loading && error ? (
        <div className="space-y-3">
          <Alert tone="error" title="Could not load the summary">
            {error}
          </Alert>
          <Button onClick={() => void fetchSummary(summary?.range ?? null)}>
            Try Again
          </Button>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Memo Count" value={String(summary.memoCount)} />
            <Stat label="Total Pieces" value={String(summary.totalPieces)} />
            <Stat label="Gross Sales" value={formatTaka(summary.grossSales)} />
            <Stat label="Total Discounts" value={formatTaka(summary.totalDiscounts)} />
            <Stat label="Net Sales" value={formatTaka(summary.netSales)} emphasis />
          </div>

          {error ? (
            <Alert tone="error">
              The last refresh failed, so the figures above may be out of date.
            </Alert>
          ) : null}

          {summary.categories.length === 0 ? (
            <EmptyState
              title="No catalog items to report"
              description="Add categories and items in the Items tab. Active items appear here even before their first sale."
              action={
                <Link to="/items" className={buttonClass('secondary')}>
                  Go to Items
                </Link>
              }
            />
          ) : (
            <Card className="p-0">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">Sales by item</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sales are grouped by stable item ID, so renaming an item does not split or
                  merge its totals.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5 text-right">Pieces Sold</th>
                      <th className="px-4 py-2.5 text-right">Gross Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categories.map((category) => (
                      <Fragment key={category.categoryId}>
                        <tr className="border-t border-slate-200 bg-slate-50">
                          <td className="px-4 py-2 text-sm font-semibold text-slate-800">
                            {category.categoryName}
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-slate-600">
                            {category.piecesSold}
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-slate-600">
                            {formatTaka(category.grossSales)}
                          </td>
                        </tr>
                        {category.items.map((item) => (
                          <tr key={item.itemId} className="border-t border-slate-100">
                            <td className="break-words px-4 py-2.5 pl-8 text-slate-900">
                              {item.itemName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">
                              {item.piecesSold}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-slate-900">
                              {formatTaka(item.grossSales)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm">
                <span className="text-slate-600">
                  {summary.memoCount} {summary.memoCount === 1 ? 'memo' : 'memos'} ·{' '}
                  {summary.totalPieces} pieces
                </span>
                <span className="font-bold text-slate-900">
                  Net Sales: <span className="text-brand-700">{formatTaka(summary.netSales)}</span>
                </span>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
