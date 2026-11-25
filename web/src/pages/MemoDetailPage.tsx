import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatDhakaDateTime } from '../lib/date';
import { formatTaka } from '../lib/money';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  LoadingPanel,
  PageHeader,
  buttonClass,
} from '../components/ui';
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

export default function MemoDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; notFound: boolean } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadMemo = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.getMemo(id);
      setMemo(result.memo);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MEMO_NOT_FOUND') {
        setLoadError({ message: 'That memo could not be found or has been deleted.', notFound: true });
      } else {
        setLoadError({
          message:
            error instanceof Error
              ? error.message
              : 'Could not load the memo. Please try again.',
          notFound: false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void loadMemo();
  }, [id, loadMemo]);

  async function handleDelete() {
    if (!memo) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMemo(memo.id);
      navigate('/memos', {
        replace: true,
        state: { success: 'Memo deleted successfully.' },
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Could not delete the memo. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          to="/memos"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Back to Memos
        </Link>
        <LoadingPanel message="Loading memo…" />
      </div>
    );
  }

  if (loadError || !memo) {
    return (
      <div className="space-y-4">
        <Link
          to="/memos"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Back to Memos
        </Link>
        <Alert tone="error" title={loadError?.notFound ? 'Memo not found' : 'Could not load the memo'}>
          {loadError?.message ?? 'That memo could not be found.'}
        </Alert>
        {!loadError?.notFound ? (
          <Button onClick={() => void loadMemo()}>Try Again</Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/memos"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Back to Memos
        </Link>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link
            to={`/memos/${memo.id}/print`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'md', 'w-full sm:w-auto')}
          >
            Print Memo
          </Link>
          <Button
            variant="danger"
            onClick={() => setConfirmDelete(true)}
            className="w-full sm:w-auto"
          >
            Delete Memo
          </Button>
        </div>
      </div>

      <PageHeader
        title={memo.printHeading}
        description={
          <span>
            Memo No. <strong className="font-mono">{memo.memoNumber}</strong> ·{' '}
            {formatDhakaDateTime(memo.createdAt)}
          </span>
        }
      />

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Customer details</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shop name
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">
              {memo.shopName}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Address
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">
              {memo.address || '—'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Unit Rate</th>
                <th className="px-4 py-2.5 text-right">Quantity</th>
                <th className="px-4 py-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memo.lines.map((line) => (
                <tr key={line.itemId} className="align-top">
                  <td className="px-4 py-3">
                    <p className="break-words font-medium text-slate-900">{line.itemName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{line.categoryName}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {formatTaka(line.unitRate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {line.quantity}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                    {formatTaka(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <dl className="ml-auto w-full max-w-sm space-y-2 text-sm">
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
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-bold text-slate-900">Total Payable</dt>
              <dd className="font-bold text-brand-700">{formatTaka(memo.totalPayable)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Note</h2>
        {memo.note ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
            {memo.note}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No note was added to this memo.</p>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Memo?"
        confirmLabel="Delete Memo"
        tone="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) {
            setConfirmDelete(false);
            setDeleteError(null);
          }
        }}
      >
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p>
            Memo No. <strong className="font-mono">{memo.memoNumber}</strong>
          </p>
          <p className="mt-0.5 break-words">{memo.shopName}</p>
          <p className="mt-0.5 font-semibold">{formatTaka(memo.totalPayable)}</p>
        </div>
        <p>
          Deleting this memo removes it from memo history and subtracts its sales from the
          summary. Catalog items and their default rates are not affected.
        </p>
        <p className="text-xs text-slate-500">
          Repeated delete requests will not deduct the sale more than once.
        </p>
      </ConfirmDialog>
    </div>
  );
}
