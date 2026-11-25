import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Button,
  Card,
  Field,
  LoadingPanel,
  PageHeader,
  Spinner,
  TextInput,
} from '../components/ui';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [printHeading, setPrintHeading] = useState('Sales Memo');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.getSettings();
      setPrintHeading(result.settings.printHeading);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load your settings. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);
    if (!printHeading.trim()) {
      setFormError('Memo print heading is required.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.saveSettings(printHeading.trim());
      setPrintHeading(result.settings.printHeading);
      setSuccess('Print heading saved. New memos will use this heading.');
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save your settings.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" />
        <LoadingPanel message="Loading your settings…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" />
        <Alert tone="error" title="Could not load your settings">
          {loadError}
        </Alert>
        <Button onClick={() => void loadSettings()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Personal settings for your private workspace."
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="text-base font-semibold text-slate-900">Print heading</h2>
          <form
            onSubmit={(event) => void saveSettings(event)}
            className="mt-4 space-y-4"
          >
            {success ? (
              <Alert tone="success" onDismiss={() => setSuccess(null)}>
                {success}
              </Alert>
            ) : null}
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            <Field
              label="Memo Print Heading"
              htmlFor="print-heading"
              hint='Shown at the top of printed memos. The default is "Sales Memo". English and Bengali text are both supported.'
            >
              <TextInput
                id="print-heading"
                value={printHeading}
                onChange={(event) => setPrintHeading(event.target.value)}
                placeholder="Sales Memo"
                maxLength={120}
                disabled={saving}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? <Spinner /> : null}
                {saving ? 'Saving…' : 'Save Heading'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPrintHeading('Sales Memo');
                  setFormError(null);
                  setSuccess(null);
                }}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Use Default
              </Button>
            </div>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Preview</h2>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="break-words text-xl font-bold text-slate-900">
              {printHeading.trim() || 'Sales Memo'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Memo No. M-000001 · {new Date().toLocaleDateString('en-US')}
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The heading is saved with each new memo, so reprinting an earlier memo keeps its
            original title.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Account</h2>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Signed in as
            </dt>
            <dd className="mt-0.5 break-all font-medium text-slate-900">
              {profile?.email || profile?.displayName || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
            </dt>
            <dd className="mt-0.5 font-medium capitalize text-slate-900">
              {profile?.role ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workspace
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">Private to your account</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Administrator privileges allow account approval only. They do not grant access to
          another user's categories, items, orders, memos, summaries, or settings.
        </p>
      </Card>
    </div>
  );
}
