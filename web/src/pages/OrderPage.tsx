import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { newRequestId } from '../lib/id';
import {
  formatRateInput,
  formatTaka,
  parseMoneyToPoisha,
  parsePercentToHundredths,
  parsePositiveQuantity,
  percentageDiscountFromHundredths,
} from '../lib/money';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  Spinner,
  TextArea,
  TextInput,
  buttonClass,
  inputClass,
} from '../components/ui';
import type { Catalog, CatalogItem, DiscountType } from '../types';

interface DraftEntry {
  rate?: string;
  qty?: string;
}

interface LineView {
  item: CatalogItem;
  rateString: string;
  qtyString: string;
  rate: number | null;
  quantity: number | null;
  lineTotal: number | null;
  error: string | null;
}

const DISCOUNT_OPTIONS: Array<{ type: DiscountType; label: string }> = [
  { type: 'none', label: 'No Discount' },
  { type: 'fixed', label: 'Fixed Amount' },
  { type: 'percentage', label: 'Percentage' },
];

export default function OrderPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [printHeading, setPrintHeading] = useState('Sales Memo');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({});
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [clientRequestId, setClientRequestId] = useState(newRequestId);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; memoId: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalogResult, settingsResult] = await Promise.all([
        api.getCatalog(),
        api.getSettings(),
      ]);
      setCatalog(catalogResult);
      setPrintHeading(settingsResult.settings.printHeading);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load your catalog. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const activeCategories = useMemo(
    () => (catalog?.categories ?? []).filter((category) => category.archivedAt === null),
    [catalog]
  );

  const activeCategoryIds = useMemo(
    () => new Set(activeCategories.map((category) => category.id)),
    [activeCategories]
  );

  const activeItems = useMemo(
    () =>
      (catalog?.items ?? []).filter(
        (item) => item.archivedAt === null && activeCategoryIds.has(item.categoryId)
      ),
    [catalog, activeCategoryIds]
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of activeItems) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [activeItems]);

  useEffect(() => {
    if (!catalog) return;
    setSelectedCategoryId((current) =>
      current && activeCategoryIds.has(current) ? current : activeCategories[0]?.id ?? null
    );
  }, [catalog, activeCategories, activeCategoryIds]);

  const selectedCategory =
    activeCategories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedCategoryItems = selectedCategory
    ? itemsByCategory.get(selectedCategory.id) ?? []
    : [];

  const lineViews = useMemo<LineView[]>(() => {
    const views: LineView[] = [];
    for (const item of activeItems) {
      const entry = draft[item.id];
      const qtyString = entry?.qty ?? '';
      if (!qtyString.trim()) continue;
      const rateString = entry?.rate ?? formatRateInput(item.defaultRate);
      const quantity = parsePositiveQuantity(qtyString);
      const rate = parseMoneyToPoisha(rateString);
      let error: string | null = null;
      if (rate === null) {
        error = 'Enter a unit rate with up to 2 decimal places.';
      } else if (quantity === null) {
        error = 'Enter a whole quantity greater than 0.';
      }
      views.push({
        item,
        rateString,
        qtyString,
        rate,
        quantity,
        lineTotal: rate !== null && quantity !== null ? rate * quantity : null,
        error,
      });
    }
    return views;
  }, [activeItems, draft]);

  const invalidLines = lineViews.filter((line) => line.error !== null);
  const hasInvalidLines = invalidLines.length > 0;
  const subtotal = lineViews.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const totalPieces = lineViews.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  const discount = useMemo(() => {
    let amount = 0;
    let serverValue = 0;
    let error: string | null = null;

    if (discountType === 'fixed') {
      if (discountValue.trim()) {
        const poisha = parseMoneyToPoisha(discountValue);
        if (poisha === null) {
          error = 'Enter a discount amount with up to 2 decimal places.';
        } else if (poisha > subtotal) {
          error = 'Fixed discount cannot exceed the subtotal.';
        } else {
          amount = poisha;
          serverValue = poisha;
        }
      }
    } else if (discountType === 'percentage') {
      if (discountValue.trim()) {
        const hundredths = parsePercentToHundredths(discountValue);
        if (hundredths === null) {
          error = 'Enter a percentage between 0 and 100.';
        } else {
          amount = percentageDiscountFromHundredths(subtotal, hundredths);
          serverValue = hundredths / 100;
        }
      }
    }

    return { amount, serverValue, error };
  }, [discountType, discountValue, subtotal]);

  const totalPayable = subtotal - discount.amount;

  const hasContent =
    shopName.trim() !== '' ||
    address.trim() !== '' ||
    note.trim() !== '' ||
    discountType !== 'none' ||
    discountValue.trim() !== '' ||
    Object.values(draft).some(
      (entry) => (entry.rate ?? '').trim() !== '' || (entry.qty ?? '').trim() !== ''
    );

  function updateDraft(itemId: string, field: 'rate' | 'qty', value: string) {
    setDraft((current) => {
      const existing = current[itemId] ?? {};
      return { ...current, [itemId]: { ...existing, [field]: value } };
    });
  }

  function resetFields() {
    setDraft({});
    setShopName('');
    setAddress('');
    setNote('');
    setDiscountType('none');
    setDiscountValue('');
    setClientRequestId(newRequestId());
    setFormError(null);
    setSelectedCategoryId(activeCategories[0]?.id ?? null);
  }

  function handleClearRequest() {
    if (!hasContent) {
      resetFields();
      setSuccess(null);
      return;
    }
    setConfirmClear(true);
  }

  function handleConfirmClear() {
    resetFields();
    setSuccess(null);
    setConfirmClear(false);
  }

  async function handleSave() {
    setFormError(null);
    setSuccess(null);

    if (!shopName.trim()) {
      setFormError('Customer shop name is required.');
      return;
    }
    if (lineViews.length === 0) {
      setFormError('Add at least one item to the order.');
      return;
    }
    if (hasInvalidLines) {
      setFormError('Fix the invalid unit rates or quantities before saving.');
      return;
    }
    if (discount.error) {
      setFormError(discount.error);
      return;
    }

    const payloadLines = lineViews.map((line) => ({
      itemId: line.item.id,
      rate: line.rate as number,
      quantity: line.quantity as number,
    }));

    setSaving(true);
    try {
      const result = await api.createMemo({
        clientRequestId,
        shopName: shopName.trim(),
        address: address.trim(),
        note: note.trim(),
        discount: { type: discountType, value: discount.serverValue },
        lines: payloadLines,
      });
      resetFields();
      setSuccess({
        message: `Memo ${result.memo.memoNumber} saved successfully.`,
        memoId: result.memo.id,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not save the memo. Your draft has been kept.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Order" />
        <LoadingPanel message="Loading your catalog…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Order" />
        <Alert tone="error" title="Could not load the order screen">
          {loadError}
        </Alert>
        <Button onClick={() => void loadCatalog()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order"
        description={
          <span>
            Create a sales memo. Print heading: <strong>{printHeading}</strong>{' '}
            <Link
              to="/settings"
              className="inline-block py-2 font-medium text-brand-700 hover:text-brand-800 sm:py-0"
            >
              Change in Settings
            </Link>
          </span>
        }
      />

      {formError ? (
        <Alert tone="error" title="Could not save the memo" onDismiss={() => setFormError(null)}>
          {formError} Your draft is still here, so you can retry.
        </Alert>
      ) : null}

      {success ? (
        <Alert
          tone="success"
          title="Memo saved"
          onDismiss={() => setSuccess(null)}
        >
          {success.message}{' '}
          <Link
            to={`/memos/${success.memoId}`}
            className="font-semibold underline underline-offset-2"
          >
            View memo
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <div className="space-y-4 sm:space-y-6 lg:col-span-3">
          <Card>
            <h2 className="text-base font-semibold text-slate-900">Customer</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Customer shop name" htmlFor="shop-name" required>
                <TextInput
                  id="shop-name"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="For example, Rahman Store"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
              <Field label="Address" htmlFor="shop-address">
                <TextInput
                  id="shop-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Optional delivery address"
                  maxLength={300}
                  disabled={saving}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Catalog</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Choose a category, then enter quantities. A blank quantity leaves the item out.
                </p>
              </div>
            </div>

            {activeCategories.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No categories yet"
                  description="Add a category and its items in the Items tab before taking an order."
                  action={
                    <Link to="/items" className={buttonClass('secondary')}>
                      Go to Items
                    </Link>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeCategories.map((category) => {
                    const isSelected = category.id === selectedCategoryId;
                    const count = itemsByCategory.get(category.id)?.length ?? 0;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        aria-pressed={isSelected}
                        className={
                          isSelected
                            ? 'min-h-11 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm'
                            : 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
                        }
                      >
                        <span className="break-words">{category.name}</span>
                        <span
                          className={
                            isSelected
                              ? 'ml-1.5 text-xs font-medium text-brand-100'
                              : 'ml-1.5 text-xs font-medium text-slate-400'
                          }
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  {selectedCategory && selectedCategoryItems.length > 0 ? (
                    <>
                      <div className="hidden border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:gap-3">
                        <span>Item</span>
                        <span>Unit Rate (৳)</span>
                        <span>Quantity</span>
                      </div>
                      {selectedCategoryItems.map((item) => {
                        const entry = draft[item.id] ?? {};
                        const rateValue =
                          entry.rate !== undefined
                            ? entry.rate
                            : formatRateInput(item.defaultRate);
                        const qtyValue = entry.qty ?? '';
                        return (
                          <div
                            key={item.id}
                            className="border-t border-slate-100 py-3 first:border-t-0"
                          >
                            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:items-center sm:gap-3">
                              <p className="min-w-0 break-words text-sm font-medium text-slate-900">
                                {item.name}
                              </p>
                              <div className="flex items-end gap-2 sm:contents">
                                  <div className="min-w-0 flex-1 sm:w-auto sm:flex-none">
                                  <label className="mb-1 block text-xs text-slate-500 sm:hidden">
                                    Unit Rate (৳)
                                  </label>
                                  <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                                      ৳
                                    </span>
                                    <input
                                      className={`${inputClass} pl-6`}
                                      inputMode="decimal"
                                      value={rateValue}
                                      onChange={(event) =>
                                        updateDraft(item.id, 'rate', event.target.value)
                                      }
                                      aria-label={`Unit rate for ${item.name}`}
                                      disabled={saving}
                                    />
                                  </div>
                                </div>
                                  <div className="w-24 min-w-0 sm:w-auto">
                                  <label className="mb-1 block text-xs text-slate-500 sm:hidden">
                                    Quantity
                                  </label>
                                  <input
                                    className={inputClass}
                                    inputMode="numeric"
                                    value={qtyValue}
                                    onChange={(event) =>
                                      updateDraft(item.id, 'qty', event.target.value)
                                    }
                                    aria-label={`Quantity for ${item.name}`}
                                    placeholder="0"
                                    disabled={saving}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <EmptyState
                      title="No active items in this category"
                      description="Add items to this category in the Items tab."
                      action={
                        <Link to="/items" className={buttonClass('secondary')}>
                          Go to Items
                        </Link>
                      }
                    />
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Selected Items</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {lineViews.length} {lineViews.length === 1 ? 'line' : 'lines'}
              </span>
            </div>

            {lineViews.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                No items selected yet. Enter a quantity in the catalog to add a line.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {lineViews.map((line) => (
                  <div
                    key={line.item.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">
                        {line.item.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => updateDraft(line.item.id, 'qty', '')}
                        className="min-h-11 shrink-0 rounded px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${line.item.name} from the order`}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          Unit Rate (৳)
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                            ৳
                          </span>
                          <input
                            className={`${inputClass} pl-6`}
                            inputMode="decimal"
                            value={line.rateString}
                            onChange={(event) =>
                              updateDraft(line.item.id, 'rate', event.target.value)
                            }
                            aria-label={`Selected unit rate for ${line.item.name}`}
                            disabled={saving}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          Quantity
                        </label>
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          value={line.qtyString}
                          onChange={(event) =>
                            updateDraft(line.item.id, 'qty', event.target.value)
                          }
                          aria-label={`Selected quantity for ${line.item.name}`}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    {line.error ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{line.error}</p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">Line total</span>
                      <span className="font-semibold text-slate-900">
                        {line.lineTotal === null ? '—' : formatTaka(line.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-sm font-medium text-slate-700">
              <span>Total pieces</span>
              <span>{totalPieces}</span>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900">Billing</h2>

            <div className="mt-4">
              <Field label="Note" htmlFor="order-note" hint="Optional. Preserved exactly as entered.">
                <TextArea
                  id="order-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Delivery note, reference, or instructions"
                  maxLength={2000}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 block text-sm font-medium text-slate-700">Discount</p>
              <div className="grid grid-cols-1 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-3">
                {DISCOUNT_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setDiscountType(option.type)}
                    aria-pressed={discountType === option.type}
                    className={
                      discountType === option.type
                        ? 'min-h-11 rounded-md bg-white px-2 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                        : 'min-h-11 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:text-slate-900'
                    }
                    disabled={saving}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {discountType !== 'none' ? (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {discountType === 'fixed' ? 'Discount amount' : 'Discount percentage'}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                      {discountType === 'fixed' ? '৳' : '%'}
                    </span>
                    <input
                      className={`${inputClass} pl-7`}
                      inputMode="decimal"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      placeholder="0.00"
                      disabled={saving}
                      aria-label={
                        discountType === 'fixed'
                          ? 'Fixed discount amount'
                          : 'Discount percentage'
                      }
                    />
                  </div>
                  {discount.error ? (
                    <p className="mt-1 text-xs font-medium text-red-600">{discount.error}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="break-words font-semibold text-slate-900">{formatTaka(subtotal)}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-slate-600">
                  Discount
                  {discountType === 'percentage' && discountValue.trim() && !discount.error
                    ? ` (${discountValue.trim()}%)`
                    : discountType === 'fixed' && discountValue.trim() && !discount.error
                      ? ' (fixed)'
                      : ''}
                </dt>
                <dd className="font-semibold text-slate-900">{formatTaka(discount.amount)}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2 text-base">
                <dt className="font-bold text-slate-900">Total Payable</dt>
                <dd className="break-words font-bold text-brand-700">{formatTaka(totalPayable)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-slate-500">
              The form clears only after the server confirms the memo was saved.
            </p>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={handleClearRequest}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Clear Order
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || lineViews.length === 0 || hasInvalidLines || Boolean(discount.error)}
                className="w-full sm:w-auto"
              >
                {saving ? <Spinner /> : null}
                {saving ? 'Saving…' : 'Save Memo'}
              </Button>
            </div>
            {lineViews.length === 0 ? (
              <p className="mt-2 text-right text-xs text-slate-500">
                Add at least one item to save a memo.
              </p>
            ) : null}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this order?"
        confirmLabel="Clear Order"
        tone="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      >
        <p>
          The customer details, selected items, quantities, rates, note, and discount will be
          removed from this draft. Saved memos are not affected.
        </p>
      </ConfirmDialog>
    </div>
  );
}
