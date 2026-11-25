import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
} from 'firebase/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Field, Spinner, TextInput } from '../components/ui';
import { auth, googleProvider } from '../lib/firebase';
import { friendlyAuthError, friendlyVerificationError } from '../lib/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      let verificationEmailSent = false;
      let verificationSendError: string | null = null;
      try {
        await sendEmailVerification(credential.user);
        verificationEmailSent = true;
      } catch (sendError) {
        verificationSendError = friendlyVerificationError(sendError);
      }
      navigate('/', {
        replace: true,
        state: { verificationEmailSent, verificationSendError },
      });
    } catch (registerError) {
      setError(
        friendlyAuthError(registerError, 'Could not create your account. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (!auth) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/', { replace: true });
    } catch (googleError) {
      setError(friendlyAuthError(googleError, 'Google sign-in failed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }

  const busy = submitting || googleLoading;

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Verify your email, then wait for an administrator to approve the account."
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Email address" htmlFor="register-email">
          <TextInput
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="register-password"
          hint="At least 6 characters."
        >
          <TextInput
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            disabled={busy}
            required
          />
        </Field>

        <Field label="Confirm password" htmlFor="register-confirm">
          <TextInput
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
            disabled={busy}
            required
          />
        </Field>

        <Button type="submit" className="w-full" disabled={busy}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => void handleGoogle()}
        disabled={busy}
      >
        {googleLoading ? <Spinner /> : null}
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
