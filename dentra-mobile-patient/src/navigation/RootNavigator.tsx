import { patientNavigationRef, flushReadyNavigation } from './navigation-ref';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionRestore, useAuth } from '@/auth/auth-context';
import { usePatientGate, GateLoading } from '@/auth/patient-gate';
import { LoginScreen } from '@/screens/LoginScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { PatientNavigator } from './PatientNavigator';
import { ErrorState, Screen, TextLink } from '@/components/ui';

const Stack = createNativeStackNavigator();

function AuthenticatedApp() {
  const gate = usePatientGate();

  if (gate.status === 'loading') return <GateLoading />;
  if (gate.status === 'error') return <GateError retry={gate.retry} />;

  if (gate.status === 'ready') return <PatientNavigator />;

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function GateError({ retry }: { retry: () => void }) {
  const { logout } = useAuth();
  return (
    <Screen title="Your account">
      <ErrorState retry={retry} />
      <TextLink title="Log out" onPress={() => void logout()} />
    </Screen>
  );
}

export function RootNavigator() {
  useSessionRestore();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <GateLoading />;

  return (
    <NavigationContainer
      ref={patientNavigationRef}
      onReady={flushReadyNavigation}
    >
      {isAuthenticated ? (
        <AuthenticatedApp />
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
