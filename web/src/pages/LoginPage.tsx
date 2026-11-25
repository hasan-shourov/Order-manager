import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Field, Spinner, TextInput } from '../components/ui';
import { auth, googleProvider } from '../lib/firebase';
import { friendlyAuthError } from '../lib/authErrors';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const target = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(target, { replace: true });
    } catch (signInError) {
      setError(friendlyAuthError(signInError, 'Could not sign in. Please try again.'));
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
      navigate(target, { replace: true });
    } catch (googleError) {
      setError(friendlyAuthError(googleError, 'Google sign-in failed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }

  const busy = submitting || googleLoading;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Open your private ordering workspace."
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Email address" htmlFor="login-email">
          <TextInput
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
          />
        </Field>

        <Field label="Password" htmlFor="login-password">
          <TextInput
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            disabled={busy}
            required
          />
        </Field>

        <div className="flex justify-end">
          <Link
            to="/reset"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Signing in…' : 'Sign in'}
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
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
