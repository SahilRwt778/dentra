import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StoreProvider } from './src/store/StoreProvider';
import type { AppStore } from './src/store/store';

export default function App({ appStore }: { appStore?: AppStore } = {}) {
  return (
    <StoreProvider appStore={appStore}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </StoreProvider>
  );
}
