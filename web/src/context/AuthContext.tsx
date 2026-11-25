import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { ApiError, api, setAccountBlockedHandler } from '../lib/api';
import { auth } from '../lib/firebase';
import { clearPrivateBrowserState } from '../lib/storage';
import type { UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  emailVerificationRequired: boolean;
  refreshProfile: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not load your account.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      setFirebaseUser(user);

      if (!user) {
        if (lastUidRef.current) clearPrivateBrowserState();
        lastUidRef.current = null;
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        setEmailVerificationRequired(false);
        setLoading(false);
        return;
      }

      if (lastUidRef.current && lastUidRef.current !== user.uid) {
        clearPrivateBrowserState();
      }
      lastUidRef.current = user.uid;

      if (!user.emailVerified) {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        setEmailVerificationRequired(true);
        setLoading(false);
        return;
      }

      setEmailVerificationRequired(false);
      setProfileLoading(true);
      setProfileError(null);

      api
        .me()
        .then(({ user: nextProfile }) => {
          if (active) {
            setProfile(nextProfile);
            setEmailVerificationRequired(false);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
              setProfile(null);
              setProfileError(null);
              setEmailVerificationRequired(true);
            } else {
              setProfile(null);
              setProfileError(errorMessage(error));
            }
          }
        })
        .finally(() => {
          if (active) {
            setProfileLoading(false);
            setLoading(false);
          }
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setAccountBlockedHandler((status) => {
      setProfile((current) => (current ? { ...current, status } : current));
    });
    return () => setAccountBlockedHandler(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { user } = await api.me();
      setProfile(user);
      setEmailVerificationRequired(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        setProfile(null);
        setProfileError(null);
        setEmailVerificationRequired(true);
      } else {
        setProfileError(errorMessage(error));
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshEmailVerification = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    await currentUser.reload();
    const refreshedUser = auth?.currentUser;
    if (!refreshedUser?.emailVerified) {
      setEmailVerificationRequired(true);
      return false;
    }
    await refreshedUser.getIdToken(true);
    setEmailVerificationRequired(false);
    await refreshProfile();
    return true;
  }, [refreshProfile]);

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
    } finally {
      clearPrivateBrowserState();
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      setEmailVerificationRequired(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      profileLoading,
      profileError,
      emailVerificationRequired,
      refreshProfile,
      refreshEmailVerification,
      signOutUser,
    }),
    [
      firebaseUser,
      profile,
      loading,
      profileLoading,
      profileError,
      emailVerificationRequired,
      refreshProfile,
      refreshEmailVerification,
      signOutUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
