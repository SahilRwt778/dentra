import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { publicHttp } from '../src/api/http';
import { session } from '../src/features/auth/session';
import { createAppStore, type AppStore } from '../src/store/store';
import { StoreProvider } from '../src/store/StoreProvider';
import { dentraApi } from '../src/store/dentraApi';
import { sessionChanged } from '../src/store/authSlice';
import { callOpened, callMinimized } from '../src/store/videoSlice';

let appStore: AppStore;
let tree: ReactTestRenderer | undefined;
const tokens = {
  accessToken: 'synthetic-access',
  refreshToken: 'synthetic-refresh',
  expiresInSeconds: 900,
};
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function syncSession() {
  appStore.dispatch(
    sessionChanged({
      signedIn: session.isSignedIn(),
      sessionVersion: session.getVersion(),
    }),
  );
}
beforeEach(async () => {
  await session.signIn(tokens);
  appStore = createAppStore();
  tree = undefined;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  appStore.dispatch(dentraApi.util.resetApiState());
  await session.clear();
});

test('two consumers of the same appointment share one Axios request and Redux cache entry', async () => {
  let count = 0;
  api.defaults.adapter = async config => {
    count++;
    return reply(config, { id: 'visit-one', patientName: 'Synthetic patient' });
  };
  const first = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  const second = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  await Promise.all([first, second]);
  expect(count).toBe(1);
  expect(
    dentraApi.endpoints.getAppointment.select('visit-one')(appStore.getState())
      .data?.id,
  ).toBe('visit-one');
  first.unsubscribe();
  second.unsubscribe();
});

test('logout clears cached patient data and call state; an old response cannot overwrite the next account', async () => {
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => {
    started = resolve;
  });
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  api.defaults.adapter = async config => {
    if (
      config.headers.get('Authorization') === `Bearer ${tokens.accessToken}`
    ) {
      started();
      await pending;
      return reply(config, {
        id: 'visit-one',
        patientName: 'Previous account patient',
      });
    }
    return reply(config, {
      id: 'visit-one',
      patientName: 'Current account patient',
    });
  };
  appStore.dispatch(
    callOpened({
      appointmentId: 'visit-one',
      patientName: 'Previous account patient',
    }),
  );
  const old = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  await waiting;
  await session.clear();
  syncSession();
  expect(appStore.getState().video.call).toBeNull();
  expect(appStore.getState().dentraApi.queries).toEqual({});
  await session.signIn({
    ...tokens,
    accessToken: 'next-access',
    refreshToken: 'next-refresh',
  });
  syncSession();
  const current = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  await current;
  release();
  await old;
  expect(
    dentraApi.endpoints.getAppointment.select('visit-one')(appStore.getState())
      .data?.patientName,
  ).toBe('Current account patient');
  expect(JSON.stringify(appStore.getState())).not.toContain(
    'Previous account patient',
  );
  old.unsubscribe();
  current.unsubscribe();
});

test('normal refresh preserves the call and shared cache, without storing either session token in Redux', async () => {
  api.defaults.adapter = async config => reply(config, { id: 'visit-one' });
  publicHttp.defaults.adapter = async config =>
    reply(config, {
      ...tokens,
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
    });
  await act(async () => {
    tree = Renderer.create(
      <StoreProvider appStore={appStore}>
        <></>
      </StoreProvider>,
    );
  });
  const query = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  await query;
  appStore.dispatch(
    callOpened({
      appointmentId: 'visit-one',
      patientName: 'Synthetic patient',
    }),
  );
  appStore.dispatch(callMinimized());
  const before = appStore.getState();
  await act(async () => session.refresh());
  expect(appStore.getState().video).toBe(before.video);
  expect(appStore.getState().dentraApi).toBe(before.dentraApi);
  const serialized = JSON.stringify(appStore.getState());
  for (const secret of [
    'synthetic-access',
    'synthetic-refresh',
    'rotated-access',
    'rotated-refresh',
  ])
    expect(serialized).not.toContain(secret);
  query.unsubscribe();
});

test('Axios failures store a readable message without request headers or the raw Axios error', async () => {
  api.defaults.adapter = async config => {
    throw new AxiosError('Failed', 'ERR_BAD_RESPONSE', config, undefined, {
      ...reply(config, { message: 'Appointment unavailable.' }),
      status: 403,
    });
  };
  const query = appStore.dispatch(
    dentraApi.endpoints.getAppointment.initiate('visit-one'),
  );
  await query;
  expect(
    dentraApi.endpoints.getAppointment.select('visit-one')(appStore.getState())
      .error,
  ).toEqual({ message: 'Appointment unavailable.', status: 403 });
  expect(JSON.stringify(appStore.getState())).not.toContain(tokens.accessToken);
  query.unsubscribe();
});
