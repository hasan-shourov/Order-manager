import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDhakaDateTime } from '../lib/date';
import { formatTaka } from '../lib/money';
import {
  Alert,
  Button,
  EmptyState,
  LoadingPanel,
  PageHeader,
  buttonClass,
} from '../components/ui';
import type { MemoSummary } from '../types';

export default function MemosPage() {
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const flash = useMemo(() => {
    const state = location.state as { success?: string } | null;
    return state?.success ?? null;
  }, [location.state]);

  const loadMemos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listMemos();
      setMemos(result.memos);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your memos. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemos();
  }, [loadMemos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memos"
        description="Your saved sales memos, newest first."
        actions={
          <Link to="/order" className={buttonClass('secondary')}>
            New Order
          </Link>
        }
      />

      {flash ? (
        <Alert tone="success" title="Memo deleted successfully">
          {flash}
        </Alert>
      ) : null}

      {loading ? <LoadingPanel message="Loading your memos…" /> : null}

      {!loading && error ? (
        <div className="space-y-3">
          <Alert tone="error" title="Could not load your memos">
            {error}
          </Alert>
          <Button onClick={() => void loadMemos()}>Try Again</Button>
        </div>
      ) : null}

      {!loading && !error && memos.length === 0 ? (
        <EmptyState
          title="No memos yet"
          description="Save your first order from the Order tab to create a memo."
          action={
            <Link to="/order" className={buttonClass()}>
              Go to Order
            </Link>
          }
        />
      ) : null}

      {!loading && !error && memos.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[9rem_1fr_1fr_9rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Memo No.</span>
            <span>Date</span>
            <span>Shop</span>
            <span className="text-right">Total Payable</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {memos.map((memo) => (
              <li key={memo.id}>
                <Link
                  to={`/memos/${memo.id}`}
                  className="flex flex-col gap-1 px-3 py-3 transition hover:bg-slate-50 sm:grid sm:grid-cols-[9rem_1fr_1fr_9rem] sm:items-center sm:gap-4 sm:px-4"
                >
                  <div className="flex items-center justify-between gap-2 sm:contents">
                    <span className="font-mono text-sm font-semibold text-brand-700">
                      {memo.memoNumber}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 sm:hidden">
                      {formatTaka(memo.totalPayable)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 sm:text-sm">
                    {formatDhakaDateTime(memo.createdAt)}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">
                    {memo.shopName}
                  </span>
                  <span className="hidden text-right text-sm font-semibold text-slate-900 sm:block">
                    {formatTaka(memo.totalPayable)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
