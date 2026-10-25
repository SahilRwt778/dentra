import React from 'react';
import { StoreProvider } from '../src/store/StoreProvider';
import { createAppStore, type AppStore } from '../src/store/store';
import { dentraApi } from '../src/store/dentraApi';

/** Create after the test has signed in; reuse the same store across renderer updates. */
export function createStoreHarness() {
  let current: AppStore | undefined;
  function getStore() {
    return (current ??= createAppStore());
  }
  return {
    get store() {
      return getStore();
    },
    wrap(children: React.ReactNode) {
      return <StoreProvider appStore={getStore()}>{children}</StoreProvider>;
    },
    cleanup() {
      current?.dispatch(dentraApi.util.resetApiState());
    },
  };
}
