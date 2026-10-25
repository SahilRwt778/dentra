import { PaymentsPage } from '@/pages/payments-page';
import { WalletPage } from '@/pages/wallet-page';
import { WithdrawalPage } from '@/pages/withdrawal-page';
import { PayoutHistoryPage } from '@/pages/payout-history-page';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { store } from '@/store/store';
import { useSessionRestore } from '@/auth/auth-context';
import { ProtectedRoute } from '@/auth/protected-route';
import { DentistGate } from '@/auth/dentist-gate';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/pages/login-page';
import { TodayPage } from '@/pages/today-page';
import { SchedulePage } from '@/pages/schedule-page';
import { PatientsPage } from '@/pages/patients-page';
import { PatientRecordPage } from '@/pages/patient-record-page';
import { ConsultPage } from '@/pages/consult-page';
import { SettingsPage } from '@/pages/settings-page';

function AppRoutes() {
  useSessionRestore();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DentistGate />}>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:patientId" element={<PatientRecordPage />} />
            <Route path="/consult/:appointmentId" element={<ConsultPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/wallet/withdrawals/:withdrawalId" element={<WithdrawalPage />} />
            <Route path="/payouts" element={<PayoutHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
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
