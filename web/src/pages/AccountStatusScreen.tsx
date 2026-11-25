import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Badge, Button, Spinner } from '../components/ui';
import type { UserProfile } from '../types';

const STATUS_CONTENT = {
  pending: {
    badge: 'Pending approval',
    tone: 'amber' as const,
    title: 'Awaiting admin approval',
    message:
      'Your email is verified. An administrator must approve this account before you can open your workspace. After approval, use Check Status or sign in again.',
  },
  rejected: {
    badge: 'Not approved',
    tone: 'red' as const,
    title: 'Your account was not approved',
    message:
      'An administrator declined access for this account. If you believe this is a mistake, contact the administrator and ask them to review it.',
  },
  revoked: {
    badge: 'Access revoked',
    tone: 'red' as const,
    title: 'Your access has been revoked',
    message:
      'An administrator has revoked access for this account. Your workspace is no longer available. Contact the administrator if you need access restored.',
  },
};

export function AccountStatusScreen({ profile }: { profile: UserProfile }) {
  const { refreshProfile, profileLoading, profileError, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const content =
    profile.status === 'pending' || profile.status === 'rejected' || profile.status === 'revoked'
      ? STATUS_CONTENT[profile.status]
      : null;

  if (!content) return null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            ৳
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">Order &amp; Billing</p>
            <Badge tone={content.tone}>{content.badge}</Badge>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900">
          {content.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{content.message}</p>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signed in as
          </p>
          <p className="mt-0.5 break-all font-medium text-slate-800">
            {profile.email || profile.displayName || profile.uid}
          </p>
        </div>

        {profileError ? (
          <Alert tone="error" className="mt-4">
            {profileError}
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => void refreshProfile()}
            disabled={profileLoading || signingOut}
          >
            {profileLoading ? <Spinner /> : null}
            Check Status
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleSignOut()}
            disabled={signingOut || profileLoading}
          >
            {signingOut ? <Spinner /> : null}
            Sign Out
          </Button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Revoked accounts lose access on their next protected request.
        </p>
      </div>
    </div>
  );
}
