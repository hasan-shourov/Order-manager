import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { friendlyVerificationError } from '../lib/authErrors';

interface VerificationLocationState {
  verificationEmailSent?: boolean;
  verificationSendError?: string | null;
}

export function VerifyEmailScreen() {
  const { firebaseUser, refreshEmailVerification, signOutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as VerificationLocationState | null;

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(
    locationState?.verificationSendError ?? null
  );
  const [notice, setNotice] = useState<string | null>(
    locationState?.verificationEmailSent
      ? 'Verification email sent. Open the link in your inbox to continue.'
      : null
  );

  const user = firebaseUser;
  if (!user) return null;

  const busy = checking || resending || signingOut;

  async function handleCheckVerification() {
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setError(
          'Your email is still unverified. Open the verification link from your inbox, then try again.'
        );
      }
    } catch {
      setError('Could not check your verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (!firebaseUser) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await sendEmailVerification(firebaseUser);
      setNotice('Verification email sent. Check your inbox and spam folder.');
    } catch (sendError) {
      setError(friendlyVerificationError(sendError));
    } finally {
      setResending(false);
    }
  }

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
    <AuthLayout
      title="Verify your email"
      subtitle="Confirm that this email address belongs to you before continuing."
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Verification email sent to
          </p>
          <p className="mt-0.5 break-all font-medium text-slate-800">
            {user.email || 'your email address'}
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <p className="text-sm leading-6 text-slate-600">
          Open the verification link from your inbox, then select{' '}
          <span className="font-medium text-slate-800">I&apos;ve verified my email</span>. If you
          do not see the message, check your spam or junk folder. Delivery can take a few minutes.
        </p>

        <div className="flex flex-col gap-2">
          <Button onClick={() => void handleCheckVerification()} disabled={busy}>
            {checking ? <Spinner /> : null}
            {checking ? 'Checking verification...' : "I've verified my email"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleResend()}
            disabled={busy}
          >
            {resending ? <Spinner /> : null}
            {resending ? 'Sending...' : 'Resend verification email'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleSignOut()}
            disabled={busy}
          >
            {signingOut ? <Spinner /> : null}
            Sign out
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          After your email is verified, this account may still need administrator approval before
          your workspace opens.
        </p>
      </div>
    </AuthLayout>
  );
}
