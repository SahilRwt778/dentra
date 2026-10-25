import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { store } from '@/store/store';
import { useSessionRestore } from '@/auth/auth-context';
import { ProtectedRoute } from '@/auth/protected-route';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/pages/login-page';
import { OverviewPage } from '@/pages/overview-page';
import { AppointmentsPage } from '@/pages/appointments-page';
import { DentistReviewPage } from '@/pages/dentist-review-page';
import { DentistsPage } from '@/pages/dentists-page';
import { DentistDetailPage } from '@/pages/dentist-detail-page';
import { PayoutReviewPage } from '@/pages/payout-review-page';
import { PayoutBatchesPage } from '@/pages/payout-batches-page';
import { WithdrawalsPage } from '@/pages/withdrawals-page';
import { WithdrawalDetailPage } from '@/pages/withdrawal-detail-page';
import { PayoutBatchDetailPage } from '@/pages/payout-batch-detail-page';
import { PaymentsPage } from '@/pages/payments-page';
import { SettingsPage } from '@/pages/settings-page';

function AppRoutes() {
  const session = useSessionRestore();
  if (session.isRestoring) {
    return (
      <main
        className="card stack"
        aria-busy={!session.error}
        style={{ maxWidth: 420, margin: '15vh auto', padding: 24 }}
      >
        <h2>Restore your session</h2>
        <p role={session.error ? 'alert' : 'status'}>
          {session.error ?? 'Connecting to Dentra…'}
        </p>
        {session.error && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={session.retry}
          >
            Try again
          </button>
        )}
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/dentists/review" element={<DentistReviewPage />} />
          <Route path="/dentists" element={<DentistsPage />} />
          <Route path="/dentists/:dentistId" element={<DentistDetailPage />} />
          <Route path="/payouts" element={<PayoutReviewPage />} />
          <Route path="/withdrawals" element={<WithdrawalsPage />} />
          <Route path="/withdrawals/:withdrawalId" element={<WithdrawalDetailPage />} />
          <Route path="/payout-batches" element={<PayoutBatchesPage />} />
          <Route path="/payout-batches/new" element={<Navigate to="/withdrawals" replace />} />
          <Route path="/payout-batches/:batchId" element={<PayoutBatchDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
