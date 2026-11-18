import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { dentraApi, type AdminPatientDetail } from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { AppShell } from '../src/components/app-shell';
import { PatientsPage } from '../src/pages/patients-page';
import { PatientDetailPage } from '../src/pages/patient-detail-page';

vi.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));
vi.mock('../src/auth/session-refresh', () => ({ refreshSession: vi.fn() }));
vi.mock('../src/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
vi.mock('../src/components/notification-bell', () => ({
  NotificationBell: () => null,
}));
vi.mock('../src/components/portal-layout', () => ({
  PortalLayout: ({ children }: { children: ReactNode }) => children,
}));

const patients: AdminPatientDetail[] = Array.from(
  { length: 22 },
  (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    fullName: index === 21 ? 'Farah Test Patient' : `Patient ${index + 1}`,
    mobile: `+91986${String(index + 1).padStart(7, '0')}`,
    email: `patient-${index + 1}@dentra.test`,
    city: 'Delhi',
    dateOfBirth: '1990-05-12',
    age: 36,
    gender: 'female',
    status: 'active',
    profilePhotoUrl: '/profile-photos/patient/synthetic',
    registeredAt: '2026-11-01T10:00:00Z',
    appointmentCount: 26,
    completedCount: 13,
    lastVisitDate: '2026-11-01',
    preferredLanguage: 'English',
    emergencyContact: null,
    guardian: {
      name: 'Guardian One',
      relationship: 'Parent',
      mobile: '+919000000001',
    },
  }),
);
let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
let requests: URL[];
let failure: 'directory' | 'detail' | 'history' | 'not-found' | null;
function makeStore() {
  return configureStore({
    enhancers: (defaults) => defaults({ autoBatch: false }),
    reducer: { auth: authReducer, [dentraApi.reducerPath]: dentraApi.reducer },
    middleware: (defaults) => defaults().concat(dentraApi.middleware),
  });
}
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
async function flush() {
  for (let i = 0; i < 10; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
function Location() {
  return <output>{useLocation().pathname}</output>;
}
async function mount(path = '/patients') {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/patients" element={<PatientsPage />} />
              <Route
                path="/patients/:patientId"
                element={<PatientDetailPage />}
              />
            </Route>
          </Routes>
          <Location />
        </MemoryRouter>
      </Provider>,
    );
    await flush();
  });
}
function text() {
  return JSON.stringify(tree.toJSON());
}
function button(label: string) {
  return tree.root.findAllByType('button').find(
    (node) =>
      node.children
        .filter((child) => typeof child === 'string')
        .join('')
        .trim() === label,
  )!;
}
async function click(label: string) {
  await act(async () => {
    button(label).props.onClick();
    await flush();
  });
}
async function select(label: string, value: string) {
  const field = tree.root
    .findAllByType('label')
    .find((node) =>
      node.findAllByType('span').some((span) => span.children.includes(label)),
    )!;
  await act(async () => {
    field.findByType('select').props.onChange({ target: { value } });
    await flush();
  });
}
const directoryRequests = () =>
  requests.filter((url) => url.pathname === '/admin/patients');
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  tree = undefined as never;
  requests = [];
  failure = null;
  store = makeStore();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      requests.push(url);
      if (url.pathname === '/admin/me')
        return response({ name: 'Admin', email: 'admin@dentra.test' });
      if (url.pathname === '/admin/settings')
        return response({ name: 'Dentra' });
      if (url.pathname === '/admin/dentists')
        return response({ items: [], nextPage: null });
      if (url.pathname === '/admin/patients') {
        if (failure === 'directory')
          return response({ message: 'Synthetic error' }, 503);
        const page = Number(url.searchParams.get('page') || 1),
          limit = Number(url.searchParams.get('limit') || 20);
        const search = (url.searchParams.get('search') || '').toLowerCase();
        const status = url.searchParams.get('status');
        const matching = patients.filter(
          (p) =>
            (!search ||
              `${p.fullName} ${p.mobile} ${p.email}`
                .toLowerCase()
                .includes(search)) &&
            (!status || p.status === status),
        );
        return response({
          items: matching.slice((page - 1) * limit, page * limit),
          total: matching.length,
          page,
          limit,
          nextPage: page * limit < matching.length ? page + 1 : null,
        });
      }
      if (url.pathname.startsWith('/admin/patients/')) {
        if (failure === 'detail' || failure === 'not-found')
          return response(
            { message: 'Synthetic error' },
            failure === 'not-found' ? 404 : 503,
          );
        return response(
          patients.find((p) => p.id === url.pathname.split('/').at(-1)),
        );
      }
      if (url.pathname === '/admin/appointments') {
        if (failure === 'history')
          return response({ message: 'Synthetic error' }, 503);
        const page = Number(url.searchParams.get('page') || 1),
          limit = Number(url.searchParams.get('limit') || 20);
        const owner = patients.find(
          (p) => p.id === url.searchParams.get('patientId'),
        )!;
        const items = Array.from({ length: 26 }, (_, i) => ({
          id: `visit-${i}`,
          patientName: owner.fullName,
          dentistName: 'Dentist One',
          date: '2026-11-01',
          time: '10:00',
          type: 'video',
          status: 'completed',
          concern: 'Follow-up',
        }));
        return response({
          items: items.slice((page - 1) * limit, page * limit),
          total: 26,
          page,
          limit,
          nextPage: page * limit < 26 ? page + 1 : null,
          summary: {
            notCancelled: 26,
            completed: 26,
            cancelled: 0,
            paidAmountPaise: 0,
          },
        });
      }
      throw new Error(`Unexpected API path: ${url.pathname}`);
    }),
  );
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  store.dispatch(dentraApi.util.resetApiState());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('adds the Patients navigation link, defaults to 20 rows and searches beyond page one on the server', async () => {
  await mount();
  expect(
    tree.root
      .findAllByType('a')
      .some((link) => link.props.href === '/patients'),
  ).toBe(true);
  expect(tree.root.findAllByType('tr')).toHaveLength(21);
  expect(directoryRequests()[0].searchParams.get('limit')).toBe('20');
  await click('Next');
  expect(directoryRequests().at(-1)!.searchParams.get('page')).toBe('2');
  const before = directoryRequests().length;
  await act(async () =>
    tree.root
      .findByType('input')
      .props.onChange({ target: { value: 'Farah' } }),
  );
  expect(directoryRequests()).toHaveLength(before);
  await act(async () => {
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
  expect(directoryRequests().at(-1)!.searchParams.get('search')).toBe('Farah');
  expect(directoryRequests().at(-1)!.searchParams.get('page')).toBe('1');
  expect(tree.root.findAllByType('tr')).toHaveLength(2);
  expect(text()).toContain('Farah Test Patient');
  await act(async () => {
    tree.root
      .findAllByType('tr')[1]
      .props.onClick({ target: { closest: () => null } });
    await flush();
  });
  expect(tree.root.findByType('output').children).toEqual([
    `/patients/${patients[21].id}`,
  ]);
  expect(
    tree.root.findByProps({ 'aria-label': 'Patient profile' }).findByType('img')
      .props.src,
  ).toContain(patients[21].profilePhotoUrl);
  expect(
    requests
      .find((url) => url.pathname === '/admin/appointments')!
      .searchParams.get('patientId'),
  ).toBe(patients[21].id);
});

test('resets pagination when account filters or page size change and shows empty results honestly', async () => {
  await mount();
  await click('Next');
  await select('Patients per page', '10');
  expect(directoryRequests().at(-1)!.searchParams.get('page')).toBe('1');
  expect(directoryRequests().at(-1)!.searchParams.get('limit')).toBe('10');
  await select('Account status', 'locked');
  expect(directoryRequests().at(-1)!.searchParams.get('status')).toBe('locked');
  expect(text()).toContain('No patients match these filters.');
  expect(button('Next').props.disabled).toBe(true);
  await click('Clear filters');
  expect(directoryRequests().at(-1)!.searchParams.has('status')).toBe(false);
  expect(directoryRequests().at(-1)!.searchParams.get('limit')).toBe('10');
});

test('shows patient details and paginates only their history, keeping profile visible if history fails', async () => {
  await mount(`/patients/${patients[21].id}`);
  expect(text()).toContain('12 May 1990');
  expect(text()).toContain('Guardian One');
  expect(text()).toContain(patients[21].email);
  await click('Next');
  const last = requests
    .filter((url) => url.pathname === '/admin/appointments')
    .at(-1)!;
  expect(last.searchParams.get('patientId')).toBe(patients[21].id);
  expect(last.searchParams.get('page')).toBe('2');
  expect(tree.root.findAllByType('tr')).toHaveLength(7);
  failure = 'history';
  await click('Refresh appointments');
  expect(text()).toContain('Could not load appointment history');
  expect(text()).toContain('Guardian One');
  failure = null;
  await click('Try again');
  expect(text()).not.toContain('Could not load appointment history');
});

test('supports directory retry and reports a missing patient without requesting history', async () => {
  failure = 'directory';
  await mount();
  expect(text()).toContain('Could not load patients');
  failure = null;
  await click('Try again');
  expect(text()).toContain('Patient 1');
  await act(async () => tree.unmount());
  store.dispatch(dentraApi.util.resetApiState());
  requests = [];
  failure = 'not-found';
  await mount(`/patients/${patients[0].id}`);
  expect(text()).toContain('Patient not found');
  expect(requests.some((url) => url.pathname === '/admin/appointments')).toBe(
    false,
  );
});
