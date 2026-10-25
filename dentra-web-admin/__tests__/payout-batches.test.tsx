import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  dentraApi,
  type PayoutBatchDetail,
  type CreatePayoutBatch,
  type ChangePayoutBatch,
} from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { PayoutBatchBuilder } from '../src/components/payouts/payout-batch-builder';
import { PayoutBatchAction } from '../src/components/payouts/payout-batch-action';
import { PayoutBatchesPage } from '../src/pages/payout-batches-page';
import { feeBasisPoints, payoutItemFee } from '../src/utils/payout-batches';

vi.mock('@/auth/session-refresh', () => ({ refreshSession: vi.fn() }));
vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
let batch: PayoutBatchDetail;
let writes: (CreatePayoutBatch | ChangePayoutBatch)[];
let requests: URL[];
let loseResponse: boolean;
let conflict: boolean;
const refresh = vi.fn();
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
function Location() {
  return <output>{useLocation().pathname}</output>;
}
async function mount(mode: 'builder' | 'action' | 'history' = 'builder') {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          {mode === 'builder' ? (
            <PayoutBatchBuilder dentistId="synthetic-dentist" />
          ) : mode === 'action' ? (
            <PayoutBatchAction batch={batch} refresh={refresh} />
          ) : (
            <PayoutBatchesPage />
          )}
          <Location />
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
async function form() {
  await act(async () => {
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
}
async function check(index = 0) {
  await act(async () => {
    tree.root
      .findAllByType('input')
      .filter((node) => node.props.type === 'checkbox')
      [index].props.onChange({ target: { checked: true } });
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
  writes = [];
  requests = [];
  loseResponse = false;
  conflict = false;
  refresh.mockClear();
  batch = {
    id: 'synthetic-batch',
    dentistId: 'synthetic-dentist',
    dentistName: 'Test Dentist',
    status: 'pending',
    version: 1,
    feeBps: 5000,
    grossPaise: 101,
    feePaise: 51,
    netPaise: 50,
    accountLast4: '9012',
    bankIfsc: 'TEST0001234',
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    bankReference: null,
    paidOn: null,
    needsAttention: false,
    account: {
      holder: 'Synthetic Holder',
      accountNo: '123456789012',
      ifsc: 'TEST0001234',
    },
    items: [],
    events: [],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      requests.push(url);
      if (request.method === 'POST') {
        const body = await request.json();
        writes.push(body);
        if (conflict)
          return Response.json(
            { message: 'This batch changed. Refresh first.' },
            { status: 409 },
          );
        if (loseResponse) {
          loseResponse = false;
          throw new Error('Synthetic lost response');
        }
        return Response.json(batch);
      }
      if (url.pathname.endsWith('/eligible'))
        return Response.json({
          items: [
            {
              id: 'synthetic-transaction',
              appointmentId: 'synthetic-visit',
              appointmentDate: '2026-10-24',
              appointmentTime: '10:00',
              patientName: 'Synthetic Patient',
              amountPaise: 101,
            },
          ],
          total: 1,
          grossPaise: 101,
          account: {
            approvalId: 'approved-test',
            last4: '9012',
            ifsc: 'TEST0001234',
          },
          nextPage: null,
        });
      return Response.json({
        items: [batch],
        total: 21,
        reservedPaise: 50,
        paidPaise: 0,
        nextPage: url.searchParams.get('page') === '2' ? null : 2,
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

test('requires an explicit valid fee and confirmation before reserving exact selected payments', async () => {
  await mount();
  await check();
  expect(writes).toHaveLength(0);
  expect(button('Create payout batch').props.disabled).toBe(true);
  await act(async () =>
    tree.root
      .findAllByType('input')
      .find((node) => node.props.inputMode === 'decimal')!
      .props.onChange({ target: { value: '50' } }),
  );
  expect(text()).toContain('₹0.50');
  expect(button('Create payout batch').props.disabled).toBe(true);
  await check(1);
  await form();
  expect(writes[0]).toMatchObject({
    dentistId: 'synthetic-dentist',
    accountApprovalId: 'approved-test',
    transactionIds: ['synthetic-transaction'],
    feeBps: 5000,
  });
  expect((writes[0] as CreatePayoutBatch).requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(tree.root.findByType('output').children.join('')).toBe(
    '/payout-batches/synthetic-batch',
  );
});
test('reuses a batch request after a lost response and freezes its fee and selection', async () => {
  loseResponse = true;
  await mount();
  await check();
  await act(async () =>
    tree.root
      .findAllByType('input')
      .find((node) => node.props.inputMode === 'decimal')!
      .props.onChange({ target: { value: '0' } }),
  );
  await check(1);
  await form();
  expect(button('Retry same request')).toBeDefined();
  expect(
    tree.root.findAllByType('input').every((node) => node.props.disabled),
  ).toBe(true);
  await form();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});
test('requires bank evidence and discrepancy acknowledgement before recording an actual transfer', async () => {
  batch = { ...batch, status: 'processing', version: 2, needsAttention: true };
  await mount('action');
  await check(1);
  await form();
  expect(writes).toHaveLength(0);
  expect(text()).toContain('Enter the bank reference');
  await act(async () =>
    tree.root
      .findAllByType('input')
      .find((node) => !node.props.type)!
      .props.onChange({ target: { value: ' utr-test ' } }),
  );
  await form();
  expect(writes).toHaveLength(0);
  await check();
  await form();
  expect(writes[0]).toMatchObject({
    version: 2,
    action: 'paid',
    reference: 'UTR-TEST',
    acknowledgeChanges: true,
  });
  expect(refresh).toHaveBeenCalled();
});
test('processing actions reuse the same request after an uncertain result and refresh stale conflicts', async () => {
  loseResponse = true;
  await mount('action');
  await check();
  await form();
  await form();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({ action: 'processing', version: 1 });
  conflict = true;
  await form();
  expect(text()).toContain('batch changed');
  expect(refresh).toHaveBeenCalled();
});
test('requires a reason before releasing reserved collections and exposes no actions for a paid batch', async () => {
  await mount('action');
  await act(async () =>
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: 'cancelled' } }),
  );
  await check();
  await form();
  expect(writes).toHaveLength(0);
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onChange({ target: { value: 'Confirmed no transfer occurred' } }),
  );
  await form();
  expect(writes[0]).toMatchObject({
    action: 'cancelled',
    note: 'Confirmed no transfer occurred',
  });
  await act(async () =>
    tree.update(
      <Provider store={store}>
        <PayoutBatchAction
          batch={{ ...batch, status: 'paid' }}
          refresh={refresh}
        />
      </Provider>,
    ),
  );
  expect(tree.root.findAllByType('form')).toHaveLength(0);
});
test('paginates filtered admin history and keeps bank account numbers out of the list', async () => {
  await mount('history');
  expect(text()).toContain('₹0.50');
  expect(text()).not.toContain('123456789012');
  await act(async () => {
    button('Next page').props.onClick();
    await flush();
  });
  expect(requests.at(-1)!.searchParams.get('page')).toBe('2');
  await act(async () => {
    tree.root
      .findAllByType('select')[0]
      .props.onChange({ target: { value: 'paid' } });
    await flush();
  });
  expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
  expect(requests.at(-1)!.searchParams.get('status')).toBe('paid');
});
test('fee entry handles decimal percentages without rounding the entered rate', () => {
  expect(feeBasisPoints('12.50')).toBe(1250);
  expect(feeBasisPoints('0')).toBe(0);
  expect(feeBasisPoints('1.001')).toBeNull();
  expect(feeBasisPoints('')).toBeNull();
  expect(feeBasisPoints('101')).toBeNull();
  expect(payoutItemFee(101, 5000)).toBe(51);
});
