import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { isFirebaseConfigured, missingFirebaseConfigKeys } from './lib/firebase';
import { AppShell } from './components/AppShell';
import { PublicOnly, RequireAdmin, RequireApproved } from './components/guards';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OrderPage from './pages/OrderPage';
import ItemsPage from './pages/ItemsPage';
import MemosPage from './pages/MemosPage';
import MemoDetailPage from './pages/MemoDetailPage';
import MemoPrintPage from './pages/MemoPrintPage';
import SummaryPage from './pages/SummaryPage';
import SettingsPage from './pages/SettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';

function ConfigurationError({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            ৳
          </div>
          <h1 className="text-lg font-bold text-slate-900">Firebase configuration required</h1>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          The web app is missing Firebase configuration values. Copy{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">web/.env.example</code>{' '}
          to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">web/.env</code>, fill
          in the values from your Firebase web app, and restart the dev server.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {missing.map((key) => (
            <li key={key}>
              <code className="text-xs">{key}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <ConfigurationError missing={missingFirebaseConfigKeys} />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<RequireApproved />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/order" replace />} />
              <Route path="order" element={<OrderPage />} />
              <Route path="items" element={<ItemsPage />} />
              <Route path="memos" element={<MemosPage />} />
              <Route path="memos/:id" element={<MemoDetailPage />} />
              <Route path="summary" element={<SummaryPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<AdminUsersPage />} />
              </Route>
            </Route>
            <Route path="memos/:id/print" element={<MemoPrintPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
