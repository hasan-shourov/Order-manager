import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDhakaDate } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Spinner,
} from '../components/ui';
import type { UserProfile, UserStatus } from '../types';

const STATUS_BADGE: Record<UserStatus, { tone: 'green' | 'amber' | 'red' | 'slate'; label: string }> = {
  pending: { tone: 'amber', label: 'Pending' },
  approved: { tone: 'green', label: 'Approved' },
  rejected: { tone: 'red', label: 'Rejected' },
  revoked: { tone: 'red', label: 'Revoked' },
};

function displayName(user: UserProfile): string {
  return user.displayName || user.email || user.uid;
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type ConfirmAction = { kind: 'reject' | 'revoke'; user: UserProfile };

function UserActions({
  user,
  isSelf,
  busy,
  onApprove,
  onReject,
  onRevoke,
}: {
  user: UserProfile;
  isSelf: boolean;
  busy: boolean;
  onApprove: (user: UserProfile) => void;
  onReject: (user: UserProfile) => void;
  onRevoke: (user: UserProfile) => void;
}) {
  const isAdmin = user.role === 'admin';

  if (isSelf || isAdmin) {
    return <p className="text-xs text-slate-400 sm:text-right">No actions</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {user.status === 'pending' ? (
        <>
          <Button
            size="sm"
            onClick={() => onApprove(user)}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy ? <Spinner /> : null}
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onReject(user)}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            Reject
          </Button>
        </>
      ) : null}
      {user.status === 'approved' ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => onRevoke(user)}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          Revoke
        </Button>
      ) : null}
      {user.status === 'rejected' || user.status === 'revoked' ? (
        <Button
          size="sm"
          onClick={() => onApprove(user)}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? <Spinner /> : null}
          Approve
        </Button>
      ) : null}
    </div>
  );
}


export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.adminListUsers();
      setUsers(result.users);
    } catch (error) {
      setLoadError(describeError(error, 'Could not load user accounts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function approve(user: UserProfile) {
    setBusyUid(user.uid);
    setActionError(null);
    setNotice(null);
    try {
      const result = await api.adminApprove(user.uid);
      setUsers((current) =>
        current.map((entry) => (entry.uid === user.uid ? result.user : entry))
      );
      setNotice(`Access approved for ${displayName(user)}.`);
    } catch (error) {
      setActionError(describeError(error, 'Could not approve the account.'));
    } finally {
      setBusyUid(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    const { kind, user } = confirmAction;
    setConfirmBusy(true);
    setConfirmError(null);
    setActionError(null);
    setNotice(null);
    try {
      const result =
        kind === 'reject'
          ? await api.adminReject(user.uid)
          : await api.adminRevoke(user.uid);
      setUsers((current) =>
        current.map((entry) => (entry.uid === user.uid ? result.user : entry))
      );
      setConfirmAction(null);
      setNotice(
        kind === 'reject'
          ? `Account request rejected for ${displayName(user)}.`
          : `Access revoked for ${displayName(user)}.`
      );
    } catch (error) {
      setConfirmError(describeError(error, 'Could not update the account.'));
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Approvals"
        description="Approve or reject account access. Approval controls sign-in access only; each user's business data stays private."
        actions={
          <Button variant="secondary" onClick={() => void loadUsers()} disabled={loading}>
            {loading ? <Spinner /> : null}
            Refresh
          </Button>
        }
      />

      {notice ? (
        <Alert tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {loading ? <LoadingPanel message="Loading user accounts…" /> : null}

      {!loading && loadError ? (
        <div className="space-y-3">
          <Alert tone="error" title="Could not load user accounts">
            {loadError}
          </Alert>
          <Button onClick={() => void loadUsers()}>Try Again</Button>
        </div>
      ) : null}

      {!loading && !loadError && users.length === 0 ? (
        <EmptyState
          title="No accounts found"
          description="New sign-ups will appear here for approval."
        />
      ) : null}

      {!loading && !loadError && users.length > 0 ? (
        <Card className="p-0">
          <div className="space-y-3 p-3 sm:hidden">
            {users.map((user) => {
              const isSelf = user.uid === profile?.uid;
              const isAdmin = user.role === 'admin';
              const statusInfo = STATUS_BADGE[user.status];
              const busy = busyUid === user.uid;
              return (
                <div
                  key={user.uid}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="break-all font-medium text-slate-900">
                          {displayName(user)}
                        </span>
                        {isSelf ? <Badge tone="blue">You</Badge> : null}
                        {isAdmin ? <Badge tone="blue">Administrator</Badge> : null}
                      </div>
                      {user.displayName && user.email ? (
                        <p className="mt-0.5 break-all text-xs text-slate-500">
                          {user.email}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Registered {formatDhakaDate(user.createdAt)}
                  </p>
                  <div className="mt-3">
                    <UserActions
                      user={user}
                      isSelf={isSelf}
                      busy={busy}
                      onApprove={(target) => void approve(target)}
                      onReject={(target) => {
                        setConfirmError(null);
                        setConfirmAction({ kind: 'reject', user: target });
                      }}
                      onRevoke={(target) => {
                        setConfirmError(null);
                        setConfirmAction({ kind: 'revoke', user: target });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Account</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Registered</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isSelf = user.uid === profile?.uid;
                  const isAdmin = user.role === 'admin';
                  const statusInfo = STATUS_BADGE[user.status];
                  const busy = busyUid === user.uid;
                  return (
                    <tr key={user.uid} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="break-all font-medium text-slate-900">
                            {displayName(user)}
                          </span>
                          {isSelf ? <Badge tone="blue">You</Badge> : null}
                          {isAdmin ? <Badge tone="blue">Administrator</Badge> : null}
                        </div>
                        {user.displayName && user.email ? (
                          <p className="mt-0.5 break-all text-xs text-slate-500">
                            {user.email}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDhakaDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <UserActions
                          user={user}
                          isSelf={isSelf}
                          busy={busy}
                          onApprove={(target) => void approve(target)}
                          onReject={(target) => {
                            setConfirmError(null);
                            setConfirmAction({ kind: 'reject', user: target });
                          }}
                          onRevoke={(target) => {
                            setConfirmError(null);
                            setConfirmAction({ kind: 'revoke', user: target });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.kind === 'revoke' ? 'Revoke access?' : 'Reject account?'}
        confirmLabel={confirmAction?.kind === 'revoke' ? 'Revoke Access' : 'Reject Account'}
        tone="danger"
        busy={confirmBusy}
        error={confirmError}
        onConfirm={() => void runConfirmedAction()}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmAction(null);
            setConfirmError(null);
          }
        }}
      >
        {confirmAction ? (
          <>
            <p>
              {confirmAction.kind === 'revoke'
                ? 'Revoke access for '
                : 'Reject the account request from '}
              <strong>{displayName(confirmAction.user)}</strong>?
            </p>
            <p>
              {confirmAction.kind === 'revoke'
                ? 'They will lose access on their next protected request, even if they are already signed in. Their data is preserved.'
                : 'They will see the not-approved screen and cannot access business data.'}
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}



