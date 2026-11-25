import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { RequireAdmin, RequireApproved } from '../components/guards';
import type { UserProfile } from '../types';

const originalConsoleError = console.error;

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('useLayoutEffect does nothing on the server')
    ) {
      return;
    }
    originalConsoleError(...args);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

const authState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.current,
}));

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'test-uid',
    email: 'owner@example.com',
    displayName: null,
    photoURL: null,
    status: 'pending',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    approvedAt: null,
    rejectedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function setAuth(options: {
  profile?: UserProfile | null;
  emailVerified?: boolean;
  verificationRequired?: boolean;
}): void {
  const emailVerified = options.emailVerified ?? true;
  const user = {
    uid: 'test-uid',
    email: 'owner@example.com',
    emailVerified,
  } as User;

  authState.current = {
    firebaseUser: user,
    profile: options.profile ?? null,
    loading: false,
    profileLoading: false,
    profileError: null,
    emailVerificationRequired:
      options.verificationRequired ?? (options.profile ? false : !emailVerified),
    refreshProfile: vi.fn(async () => undefined),
    refreshEmailVerification: vi.fn(async () => true),
    signOutUser: vi.fn(async () => undefined),
  };
}

function approvedRoutes(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<RequireApproved />}>
          <Route index element={<div>Billing workspace ready</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('email verification and approval screens', () => {
  it('keeps an unverified approved user on the verification screen', () => {
    setAuth({
      profile: makeProfile({ status: 'approved', approvedAt: '2026-01-02T00:00:00.000Z' }),
      emailVerified: false,
      verificationRequired: true,
    });

    const html = approvedRoutes();

    expect(html).toContain('Verify your email');
    expect(html).toContain('owner@example.com');
    expect(html).toContain('Resend verification email');
    expect(html).toMatch(/I(?:&#x27;|')ve verified my email/);
    expect(html).not.toContain('Billing workspace ready');
  });

  it('shows Awaiting admin approval for a verified pending user', () => {
    setAuth({ profile: makeProfile({ status: 'pending' }) });

    const html = approvedRoutes();

    expect(html).toContain('Awaiting admin approval');
    expect(html).not.toContain('Billing workspace ready');
  });

  it('opens the app for a verified approved user', () => {
    setAuth({
      profile: makeProfile({ status: 'approved', approvedAt: '2026-01-02T00:00:00.000Z' }),
    });

    const html = approvedRoutes();

    expect(html).toContain('Billing workspace ready');
    expect(html).not.toContain('Awaiting admin approval');
  });

  it('opens User Approvals for the verified owner admin', () => {
    setAuth({
      profile: makeProfile({
        status: 'approved',
        role: 'admin',
        approvedAt: '2026-01-02T00:00:00.000Z',
      }),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RequireApproved />}>
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<div>User Approvals</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(html).toContain('User Approvals');
  });
});
