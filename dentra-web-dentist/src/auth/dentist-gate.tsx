import { Outlet } from 'react-router-dom';
import { dentraApi, useGetDentistsMeQuery } from '@/api/generated-api';
import { OnboardingPage } from '@/pages/onboarding-page';
import { AccountStatusPage } from '@/pages/account-status-page';
import { useAuth } from '@/auth/auth-context';

/**
 * Sits between ProtectedRoute and AppShell: a verified access token
 * alone doesn't mean there's a usable dentist profile behind it — the
 * same OTP login serves a brand-new applicant, someone mid-review, and
 * a fully verified dentist. This decides which of those three the
 * token belongs to and renders accordingly, the way the prototype's own
 * shell() does implicitly by checking dentist status before showing the
 * nav at all.
 */
export function DentistGate() {
  const { logout } = useAuth();
  const { data: cached } = dentraApi.endpoints.getDentistsMe.useQueryState(undefined);
  const hasSubmitted = !!cached?.status && cached.status !== 'draft';
  const {
    data: me,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetDentistsMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: hasSubmitted,
    refetchOnReconnect: hasSubmitted,
    pollingInterval: hasSubmitted ? 10000 : 0,
    skipPollingIfUnfocused: true,
  });

  if (isLoading)
    return (
      <div className="login-wrap" role="status">
        Checking your application…
      </div>
    );

  if (error && 'status' in error && error.status === 404) {
    return (
      <OnboardingPage
        onSubmitted={() => {
          refetch();
        }}
      />
    );
  }

  if (error || !me) {
    return (
      <div className="login-wrap">
        <div className="login-card stack" role="alert">
          <h1>Unable to check your application</h1>
          <p className="muted small">Please try again to check your access to the clinic portal.</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Try again
          </button>
          <button type="button" className="btn btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (me.status === 'draft')
    return (
      <OnboardingPage
        dentist={me}
        onSubmitted={() => {
          refetch();
        }}
      />
    );

  if (me && me.status !== 'verified') {
    return (
      <AccountStatusPage
        dentist={me}
        onRefresh={() => {
          refetch();
        }}
        refreshing={isFetching}
      />
    );
  }

  return <Outlet />;
}
