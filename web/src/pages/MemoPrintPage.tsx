import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDhakaDateTime } from '../lib/date';
import { formatTaka } from '../lib/money';
import { Alert, Button, LoadingPanel, buttonClass } from '../components/ui';
import type { Memo } from '../types';

function discountLabel(memo: Memo): string {
  if (memo.discountType === 'percentage') {
    return `Discount (${memo.discountValue}%)`;
  }
  if (memo.discountType === 'fixed') {
    return 'Discount (fixed)';
  }
  return 'Discount';
}

export default function MemoPrintPage() {
  const { id = '' } = useParams();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getMemo(id);
      setMemo(result.memo);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the memo for printing.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void loadMemo();
  }, [id, loadMemo]);

  useEffect(() => {
    if (!memo) return;
    const previousTitle = document.title;
    document.title = `${memo.memoNumber} - ${memo.printHeading}`;
    return () => {
      document.title = previousTitle;
    };
  }, [memo]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LoadingPanel message="Preparing memo…" />
      </div>
    );
  }

  if (error || !memo) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Alert tone="error" title="Could not load the memo">
          {error ?? 'That memo could not be found.'}
        </Alert>
        <Link to="/memos" className={buttonClass('secondary')}>
          Back to Memos
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-col gap-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={`/memos/${memo.id}`}
            className={buttonClass('secondary', 'md', 'w-full sm:w-auto')}
          >
            ← Back to Memo
          </Link>
          <Button onClick={() => window.print()} className="w-full sm:w-auto">
            Print
          </Button>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-8 print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b-2 border-slate-800 pb-4 text-center">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {memo.printHeading}
            </h1>
            <div className="mt-3 flex flex-col items-center justify-center gap-1 text-sm text-slate-700 sm:flex-row sm:gap-6">
              <p>
                Memo No. <span className="font-mono font-semibold">{memo.memoNumber}</span>
              </p>
              <p>{formatDhakaDateTime(memo.createdAt)}</p>
            </div>
          </header>

          <section className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer shop
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words font-semibold text-slate-900">
                {memo.shopName}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800">
                {memo.address || '—'}
              </p>
            </div>
          </section>

          <div className="mt-6 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pl-2 text-right">Unit Rate</th>
                <th className="py-2 pl-2 text-right">Qty</th>
                <th className="py-2 pl-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {memo.lines.map((line) => (
                <tr
                  key={line.itemId}
                  className="break-inside-avoid border-b border-slate-100 align-top print:break-inside-avoid"
                >
                  <td className="py-2 pr-2">
                    <p className="break-words font-medium text-slate-900">{line.itemName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{line.categoryName}</p>
                  </td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right text-slate-800">
                    {formatTaka(line.unitRate)}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right text-slate-800">
                    {line.quantity}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right font-semibold text-slate-900">
                    {formatTaka(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Total pieces</dt>
                <dd className="font-semibold text-slate-900">{memo.totalPieces}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="font-semibold text-slate-900">{formatTaka(memo.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">{discountLabel(memo)}</dt>
                <dd className="font-semibold text-slate-900">
                  {formatTaka(memo.discountAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t-2 border-slate-800 pt-2 text-base">
                <dt className="font-bold text-slate-900">Total Payable</dt>
                <dd className="font-bold text-slate-900">{formatTaka(memo.totalPayable)}</dd>
              </div>
            </dl>
          </div>

          {memo.note ? (
            <section className="mt-6 break-inside-avoid border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Note
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                {memo.note}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
