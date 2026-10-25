import React from 'react';
import { useGetDentistQuery } from '../../store/dentraApi';
import { errorMessage } from '../../common/utils/api-error';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { FormScreen } from '../../components/ui/Screen';
import { Empty, Loading } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { AccountStatusScreen } from '../onboarding/AccountStatusScreen';
import { useAuth } from './AuthProvider';
export function useDentist() {
  const { currentData: dentist } = useGetDentistQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });
  if (!dentist || dentist.status !== 'verified')
    throw new Error('A verified dentist profile is required.');
  return dentist;
}
export function DentistGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const {
    currentData: dentist,
    error: requestError,
    isFetching: loading,
    refetch: reload,
  } = useGetDentistQuery();
  const error = requestError ? errorMessage(requestError) : null;
  // Drafts stay on the form; submitted applications and verified access are rechecked.
  useForegroundRefresh(reload, !!dentist && dentist.status !== 'draft', 30000);
  if (dentist === undefined && loading)
    return (
      <FormScreen>
        <Loading text="Checking your dentist account…" />
      </FormScreen>
    );
  if (dentist === undefined || (error && dentist?.status === 'verified'))
    return (
      <FormScreen>
        <Empty
          title="Could not check your account"
          text={error ?? undefined}
          retry={reload}
        />
        <Button
          title="Log out"
          variant="secondary"
          onPress={() => {
            signOut().catch(() => {});
          }}
        />
      </FormScreen>
    );
  if (!dentist || dentist.status === 'draft')
    return (
      <OnboardingScreen
        key={dentist?.id ?? 'new'}
        dentist={dentist}
        onSubmitted={reload}
      />
    );
  if (dentist.status !== 'verified')
    return (
      <AccountStatusScreen
        dentist={dentist}
        refreshing={loading}
        refresh={reload}
        error={error}
      />
    );
  return <>{children}</>;
}
