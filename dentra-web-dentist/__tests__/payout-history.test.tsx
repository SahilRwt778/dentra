import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { dentraApi, type PayoutBatchDetail } from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { PayoutHistoryPage } from '../src/pages/payout-history-page';

vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
let batch: PayoutBatchDetail;
let requests: URL[];
let fail: boolean;
function makeStore() {
  return configureStore({
    enhancers: (defaults) => defaults({ autoBatch: false }),
    reducer: { auth: authReducer, [dentraApi.reducerPath]: dentraApi.reducer },
    middleware: (defaults) => defaults().concat(dentraApi.middleware),
  });
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          <PayoutHistoryPage />
        </MemoryRouter>
      </Provider>,
    );
    await flush();
  });
}
function button(label: string) {
  return tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label)!;
}
async function click(label: string) {
  await act(async () => {
    button(label).props.onClick();
    await flush();
  });
}
function text() {
  return JSON.stringify(tree.toJSON());
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  tree = undefined as never;
  store = makeStore();
  requests = [];
  fail = false;
  batch = {
    id: 'test-batch',
    dentistId: 'test-dentist',
    dentistName: 'Synthetic Dentist',
    status: 'paid',
    version: 3,
    feeBps: 1250,
    grossPaise: 10029,
    feePaise: 1254,
    netPaise: 8775,
    accountLast4: '9012',
    bankIfsc: 'TEST0001234',
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    bankReference: 'UTR-SYNTHETIC',
    paidOn: '2026-10-24',
    needsAttention: false,
    account: null,
    items: [
      {
        transactionId: 'test-transaction',
        appointmentId: 'test-visit',
        patientName: 'Synthetic Patient',
        amountPaise: 10029,
        feePaise: 1254,
        paymentStatus: 'paid',
        appointmentStatus: 'completed',
        released: false,
      },
    ],
    events: [
      {
        id: 'event-one',
        status: 'paid',
        note: 'Synthetic transfer recorded',
        createdAt: '2026-10-24T10:00:00Z',
      },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      expect(request.method).toBe('GET');
      const url = new URL(request.url);
      requests.push(url);
      if (fail)
        return Response.json(
          { message: 'Payout unavailable' },
          { status: 404 },
        );
      if (url.pathname.endsWith(batch.id)) return Response.json(batch);
      const empty = url.searchParams.get('status') === 'cancelled';
      return Response.json({
        items: empty ? [] : [batch],
        total: empty ? 0 : 21,
        reservedPaise: 0,
        paidPaise: empty ? 0 : 8775,
        nextPage: empty || url.searchParams.get('page') === '2' ? null : 2,
      });
    }),
  );
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    store.dispatch(dentraApi.util.resetApiState());
  });
  vi.unstubAllGlobals();
});

test('paginates and filters the owner history with net payout totals', async () => {
  await mount();
  expect(requests[0].pathname).toBe('/dentists/me/payout-batches');
  expect(text()).toContain('₹87.75');
  expect(text()).not.toContain('123456789012');
  await click('Next page');
  expect(requests.at(-1)!.searchParams.get('page')).toBe('2');
  await act(async () => {
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: 'cancelled' } });
    await flush();
  });
  expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
  expect(text()).toContain('No payouts yet for these filters');
});
test('opens fresh payout evidence and its appointment link, then removes receipt cache on close', async () => {
  await mount();
  await click('View payout');
  expect(requests.at(-1)!.pathname).toBe(
    '/dentists/me/payout-batches/test-batch',
  );
  expect(text()).toContain('UTR-SYNTHETIC');
  expect(text()).toContain('12.50');
  expect(tree.root.findByType('a').props.href).toBe('/consult/test-visit');
  await click('Close');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(
    dentraApi.endpoints.getDentistPayoutBatch.select({ batchId: batch.id })(
      store.getState(),
    ).data,
  ).toBeUndefined();
  expect(text()).not.toContain('UTR-SYNTHETIC');
});
test('retries errors and hides a cached receipt after a later denied read', async () => {
  fail = true;
  await mount();
  expect(text()).toContain('Payout unavailable');
  fail = false;
  await click('Try again');
  await click('View payout');
  expect(text()).toContain('UTR-SYNTHETIC');
  fail = true;
  await act(async () => {
    store.dispatch(dentraApi.util.invalidateTags(['Payout Batches']));
    await flush();
  });
  expect(text()).toContain('Payout unavailable');
  expect(text()).not.toContain('UTR-SYNTHETIC');
});
