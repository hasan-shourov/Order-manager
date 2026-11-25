import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Button,
  EmptyState,
  FullPageLoader,
  buttonClass,
} from './ui';
import { AccountStatusScreen } from '../pages/AccountStatusScreen';
import { VerifyEmailScreen } from '../pages/VerifyEmailScreen';

export function PublicOnly() {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader message="Checking your session…" />;
  if (firebaseUser) {
    const state = location.state as { from?: string } | null;
    if (!firebaseUser.emailVerified && location.pathname === '/register') {
      return <Outlet />;
    }
    return <Navigate to={state?.from ?? '/'} replace />;
  }
  return <Outlet />;
}

export function RequireApproved() {
  const {
    firebaseUser,
    profile,
    loading,
    profileLoading,
    profileError,
    emailVerificationRequired,
    refreshProfile,
    signOutUser,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <FullPageLoader message="Checking your session…" />;
  if (!firebaseUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (emailVerificationRequired || !firebaseUser.emailVerified) {
    return <VerifyEmailScreen />;
  }
  if (!profile && profileLoading) {
    return <FullPageLoader message="Loading your workspace…" />;
  }
  if (!profile && profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Could not load your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">{profileError}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => void refreshProfile()} disabled={profileLoading}>
              {profileLoading ? 'Trying again…' : 'Try Again'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void signOutUser().then(() => navigate('/login', { replace: true }));
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <FullPageLoader message="Loading your workspace…" />;
  if (profile.status !== 'approved') return <AccountStatusScreen profile={profile} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { profile } = useAuth();

  if (!profile || profile.role !== 'admin') {
    return (
      <EmptyState
        title="Administrator access is required"
        description="This screen is only available to the administrator account."
        action={
          <Link to="/order" className={buttonClass('secondary')}>
            Back to Order
          </Link>
        }
      />
    );
  }
  return <Outlet />;
}
