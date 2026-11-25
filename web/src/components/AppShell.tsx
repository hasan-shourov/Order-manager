import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Spinner, cx } from './ui';

const TABS = [
  { to: '/order', label: 'Order' },
  { to: '/items', label: 'Items' },
  { to: '/memos', label: 'Memos' },
  { to: '/summary', label: 'Summary' },
];

export function AppShell() {
  const { profile, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const tabs = [
    ...TABS,
    { to: '/settings', label: 'Settings' },
    ...(profile?.role === 'admin' ? [{ to: '/admin', label: 'Approvals' }] : []),
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4',
      isActive
        ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
        : 'text-slate-600 hover:bg-slate-100'
    );

  const headerLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(navLinkClass({ isActive }), 'hidden sm:flex');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2">
            <Link to="/order" className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
                ৳
              </span>
              <span className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                Order &amp; Billing
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="hidden max-w-[15rem] text-right lg:block">
                <p className="truncate text-xs font-medium text-slate-700">
                  {profile?.displayName || profile?.email || 'Signed in'}
                </p>
                <div className="mt-0.5 flex justify-end">
                  {profile?.role === 'admin' ? (
                    <Badge tone="blue">Administrator</Badge>
                  ) : (
                    <Badge tone="green">Approved</Badge>
                  )}
                </div>
              </div>
              {profile?.role === 'admin' ? (
                <NavLink to="/admin" className={headerLinkClass}>
                  User Approvals
                </NavLink>
              ) : null}
              <NavLink to="/settings" className={headerLinkClass}>
                Settings
              </NavLink>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="min-w-[5.5rem]"
              >
                {signingOut ? <Spinner /> : null}
                Sign Out
              </Button>
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} className={navLinkClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
