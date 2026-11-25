import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, Button, Field, Spinner, TextInput } from '../components/ui';
import { auth } from '../lib/firebase';
import { friendlyAuthError } from '../lib/authErrors';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess('Password reset email sent. Check your inbox for the reset link.');
    } catch (resetError) {
      setError(
        friendlyAuthError(resetError, 'Could not send the reset email. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We will email you a link to choose a new password."
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <Field label="Email address" htmlFor="reset-email">
          <TextInput
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={submitting}
            required
          />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Sending…' : 'Send reset email'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered your password?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
