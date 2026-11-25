import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRateInput, formatTaka, parseMoneyToPoisha } from '../lib/money';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  Spinner,
  TextInput,
  buttonClass,
  inputClass,
} from '../components/ui';
import type { Catalog, CatalogItem, Category } from '../types';

interface Notice {
  tone: 'success' | 'error';
  message: string;
}

type ConfirmTarget =
  | { kind: 'category'; id: string; name: string; activeItemCount: number }
  | { kind: 'item'; id: string; name: string };

function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function CategoryCard({
  category,
  items,
  onChanged,
  onRequestRemoveCategory,
  onRequestRemoveItem,
}: {
  category: Category;
  items: CatalogItem[];
  onChanged: (message: string) => Promise<void>;
  onRequestRemoveCategory: () => void;
  onRequestRemoveItem: (item: CatalogItem) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(category.name);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function saveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRenameError(null);
    if (!renameValue.trim()) {
      setRenameError('Category name is required.');
      return;
    }
    setRenameBusy(true);
    try {
      await api.renameCategory(category.id, renameValue.trim());
      setRenaming(false);
      await onChanged('Category renamed.');
    } catch (error) {
      setRenameError(errorText(error, 'Could not rename the category.'));
    } finally {
      setRenameBusy(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);
    if (!newName.trim()) {
      setAddError('Item name is required.');
      return;
    }
    const rate = parseMoneyToPoisha(newRate);
    if (rate === null) {
      setAddError('Enter a default unit rate with up to 2 decimal places.');
      return;
    }
    setAddBusy(true);
    try {
      await api.createItem({
        categoryId: category.id,
        name: newName.trim(),
        defaultRate: rate,
      });
      setNewName('');
      setNewRate('');
      await onChanged('Item added.');
    } catch (error) {
      setAddError(errorText(error, 'Could not add the item.'));
    } finally {
      setAddBusy(false);
    }
  }

  function startEditing(item: CatalogItem) {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditRate(formatRateInput(item.defaultRate));
    setEditError(null);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItemId) return;
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Item name is required.');
      return;
    }
    const rate = parseMoneyToPoisha(editRate);
    if (rate === null) {
      setEditError('Enter a default unit rate with up to 2 decimal places.');
      return;
    }
    setEditBusy(true);
    try {
      await api.updateItem(editingItemId, {
        name: editName.trim(),
        defaultRate: rate,
      });
      setEditingItemId(null);
      await onChanged('Item updated.');
    } catch (error) {
      setEditError(errorText(error, 'Could not update the item.'));
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {renaming ? (
          <form
            onSubmit={(event) => void saveRename(event)}
            className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`rename-${category.id}`}>
                Category name
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`rename-${category.id}`}
                  className={inputClass}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  maxLength={80}
                  disabled={renameBusy}
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={renameBusy}>
                  {renameBusy ? <Spinner /> : null}
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRenaming(false);
                    setRenameValue(category.name);
                    setRenameError(null);
                  }}
                  disabled={renameBusy}
                >
                  Cancel
                </Button>
              </div>
              {renameError ? (
                <p className="mt-1 text-xs font-medium text-red-600">{renameError}</p>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-base font-semibold text-slate-900">
                {category.name}
              </h2>
              <Badge>{itemCountLabel(items.length)}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Category ID stays fixed when renamed, so past memos keep their names and totals.
            </p>
          </div>
        )}

        {!renaming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRenaming(true);
                setRenameValue(category.name);
                setRenameError(null);
              }}
            >
              Rename
            </Button>
            <Button variant="danger" size="sm" onClick={onRequestRemoveCategory}>
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            No active items in this category yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) =>
              editingItemId === item.id ? (
                <li key={item.id} className="py-3">
                  <form
                    onSubmit={(event) => void saveItem(event)}
                    className="space-y-2"
                  >
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Item name
                        </label>
                        <input
                          className={inputClass}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          maxLength={120}
                          disabled={editBusy}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Default Unit Rate (৳)
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                            ৳
                          </span>
                          <input
                            className={`${inputClass} pl-6`}
                            inputMode="decimal"
                            value={editRate}
                            onChange={(event) => setEditRate(event.target.value)}
                            disabled={editBusy}
                          />
                        </div>
                      </div>
                    </div>
                    {editError ? (
                      <p className="text-xs font-medium text-red-600">{editError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={editBusy}>
                        {editBusy ? <Spinner /> : null}
                        Save Item
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingItemId(null);
                          setEditError(null);
                        }}
                        disabled={editBusy}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-slate-900">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Default unit rate: {formatTaka(item.defaultRate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onRequestRemoveItem(item)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <form
        onSubmit={(event) => void addItem(event)}
        className="mt-4 rounded-lg bg-slate-50 p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add an item
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Item name
            </label>
            <input
              className={inputClass}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="For example, Juice (Btl) 100"
              maxLength={120}
              disabled={addBusy}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Default Unit Rate (৳)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                ৳
              </span>
              <input
                className={`${inputClass} pl-6`}
                inputMode="decimal"
                value={newRate}
                onChange={(event) => setNewRate(event.target.value)}
                placeholder="0.00"
                disabled={addBusy}
              />
            </div>
          </div>
          <Button type="submit" disabled={addBusy} className="w-full sm:mb-0.5 sm:w-auto">
            {addBusy ? <Spinner /> : null}
            Add Item
          </Button>
        </div>
        {addError ? (
          <p className="mt-2 text-xs font-medium text-red-600">{addError}</p>
        ) : null}
      </form>
    </Card>
  );
}

export default function ItemsPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.getCatalog();
      setCatalog(result);
    } catch (error) {
      setLoadError(errorText(error, 'Could not load your catalog. Please try again.'));
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

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalog?.items ?? []) {
      if (item.archivedAt !== null) continue;
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [catalog]);

  async function handleCatalogChanged(message: string) {
    setNotice({ tone: 'success', message });
    await loadCatalog();
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError(null);
    if (!newCategoryName.trim()) {
      setCategoryError('Category name is required.');
      return;
    }
    setCreatingCategory(true);
    try {
      await api.createCategory(newCategoryName.trim());
      setNewCategoryName('');
      await handleCatalogChanged('Category added.');
    } catch (error) {
      setCategoryError(errorText(error, 'Could not add the category.'));
    } finally {
      setCreatingCategory(false);
    }
  }

  function requestRemoveCategory(category: Category) {
    setConfirmError(null);
    setConfirmTarget({
      kind: 'category',
      id: category.id,
      name: category.name,
      activeItemCount: itemsByCategory.get(category.id)?.length ?? 0,
    });
  }

  function requestRemoveItem(item: CatalogItem) {
    setConfirmError(null);
    setConfirmTarget({ kind: 'item', id: item.id, name: item.name });
  }

  async function confirmRemoval() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (confirmTarget.kind === 'category') {
        const result = await api.deleteCategory(confirmTarget.id);
        setConfirmTarget(null);
        await handleCatalogChanged(
          result.archivedItemCount > 0
            ? `Category removed. ${itemCountLabel(result.archivedItemCount)} archived.`
            : 'Category removed.'
        );
      } else {
        await api.deleteItem(confirmTarget.id);
        setConfirmTarget(null);
        await handleCatalogChanged('Item removed.');
      }
    } catch (error) {
      setConfirmError(errorText(error, 'The removal could not be completed. Please try again.'));
    } finally {
      setConfirmBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Items" />
        <LoadingPanel message="Loading your catalog…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Items" />
        <Alert tone="error" title="Could not load your catalog">
          {loadError}
        </Alert>
        <Button onClick={() => void loadCatalog()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description="Manage your private category and item catalog. Archived entries disappear from new orders but stay in past memos."
        actions={
          <Link to="/order" className={buttonClass('secondary')}>
            Go to Order
          </Link>
        }
      />

      {notice ? (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.message}
        </Alert>
      ) : null}

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Add a category</h2>
        <form
          onSubmit={(event) => void createCategory(event)}
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field
            label="Category name"
            htmlFor="new-category"
            className="flex-1"
            error={categoryError}
          >
            <TextInput
              id="new-category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="For example, Juice"
              maxLength={80}
              disabled={creatingCategory}
            />
          </Field>
          <Button type="submit" disabled={creatingCategory} className="w-full sm:mb-0.5 sm:w-auto">
            {creatingCategory ? <Spinner /> : null}
            Add Category
          </Button>
        </form>
      </Card>

      {activeCategories.length === 0 ? (
        <EmptyState
          title="Your catalog is empty"
          description="Add your first category above, then add sellable items with their default unit rates."
        />
      ) : (
        <div className="space-y-4">
          {activeCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              items={itemsByCategory.get(category.id) ?? []}
              onChanged={handleCatalogChanged}
              onRequestRemoveCategory={() => requestRemoveCategory(category)}
              onRequestRemoveItem={requestRemoveItem}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget?.kind === 'category' ? 'Remove this category?' : 'Remove this item?'
        }
        confirmLabel={
          confirmTarget?.kind === 'category' ? 'Remove Category' : 'Remove Item'
        }
        tone="danger"
        busy={confirmBusy}
        error={confirmError}
        onConfirm={() => void confirmRemoval()}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmTarget(null);
            setConfirmError(null);
          }
        }}
      >
        {confirmTarget?.kind === 'category' ? (
          <>
            <p>
              Remove the category <strong>{confirmTarget.name}</strong>?
            </p>
            <p>
              {confirmTarget.activeItemCount > 0
                ? `${itemCountLabel(confirmTarget.activeItemCount)} in this category will also be archived and hidden from new orders.`
                : 'This category has no active items.'}
            </p>
            <p>Past memos and sales totals are kept.</p>
          </>
        ) : confirmTarget?.kind === 'item' ? (
          <>
            <p>
              Remove the item <strong>{confirmTarget.name}</strong>?
            </p>
            <p>It will be archived and hidden from new orders. Past memos and sales totals are kept.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
