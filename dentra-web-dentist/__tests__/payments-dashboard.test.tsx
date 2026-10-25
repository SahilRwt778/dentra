import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import Renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  dentraApi,
  type DentistPayment,
  type DentistPaymentSummary,
} from "../src/api/generated-api";
import authReducer from "../src/store/auth-slice";
import { PaymentsPage } from "../src/pages/payments-page";

vi.mock("@/auth/refresh-token-storage", () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));

let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
let requests: URL[];
let clinic: DentistPayment;
let online: DentistPayment;
let summary: DentistPaymentSummary;
let fail: boolean;
let denyDetail: boolean;
let hold: Promise<void> | undefined;

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
          <PaymentsPage />
        </MemoryRouter>
      </Provider>
    );
    await flush();
  });
}
function text() {
  return JSON.stringify(tree.toJSON());
}
function button(label: string) {
  return tree.root
    .findAllByType("button")
    .find(
      (node) =>
        node.props["aria-label"] === label || node.children.join("") === label
    )!;
}
async function click(label: string) {
  await act(async () => {
    button(label).props.onClick();
    await flush();
  });
}
async function changeFields(values: {
  q?: string;
  source?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  await act(async () => {
    const form = tree.root.findByType("form");
    const inputs = form.findAllByType("input");
    const selects = form.findAllByType("select");
    if (values.q !== undefined)
      inputs[0].props.onChange({ target: { value: values.q } });
    if (values.source !== undefined)
      selects[0].props.onChange({ target: { value: values.source } });
    if (values.status !== undefined)
      selects[1].props.onChange({ target: { value: values.status } });
    if (values.from !== undefined)
      inputs[1].props.onChange({ target: { value: values.from } });
    if (values.to !== undefined)
      inputs[2].props.onChange({ target: { value: values.to } });
  });
}
async function apply() {
  await act(async () => {
    tree.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  tree = undefined as never;
  store = makeStore();
  requests = [];
  fail = false;
  denyDetail = false;
  hold = undefined;
  clinic = {
    id: "clinic-transaction",
    appointmentId: "clinic-visit",
    patientName: "Synthetic Clinic Patient",
    appointmentDate: "2026-10-24",
    appointmentTime: "10:00",
    appointmentType: "clinic",
    appointmentStatus: "completed",
    clinicName: "Test Clinic",
    source: "clinic",
    method: "pay_at_clinic",
    status: "paid",
    amountPaise: 50029,
    collection: {
      id: "clinic-receipt",
      amountPaise: 50029,
      method: "cash",
      collectedAt: "2026-10-24T10:00:00Z",
    },
    gatewayOrderId: null,
    gatewayPaymentId: null,
    gatewayRefundId: null,
    createdAt: "2026-10-20T12:00:00Z",
    updatedAt: "2026-10-24T10:00:00Z",
  };
  online = {
    ...clinic,
    id: "online-transaction",
    appointmentId: "online-visit",
    patientName: "Synthetic Online Patient",
    source: "online",
    method: "upi",
    collection: null,
    gatewayOrderId: "order_synthetic",
    gatewayPaymentId: "pay_synthetic",
  };
  summary = {
    totalTransactions: 22,
    onlinePaidAmountPaise: 123029,
    clinicCollectedAmountPaise: 50029,
    dueAtClinicAmountPaise: 10001,
    pendingOnlineAmountPaise: 25029,
    refundPendingAmountPaise: 30029,
    refundFailedAmountPaise: 40029,
    refundedAmountPaise: 60029,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      expect(request.method).toBe("GET");
      const url = new URL(request.url);
      requests.push(url);
      if (url.searchParams.get("source") === "clinic" && hold) await hold;
      if (fail)
        return Response.json(
          { message: "Synthetic network failure" },
          { status: 503 }
        );
      if (url.pathname !== "/dentists/me/payments") {
        if (denyDetail)
          return Response.json(
            { message: "Payment unavailable" },
            { status: 404 }
          );
        return Response.json(
          url.pathname.endsWith(clinic.id) ? clinic : online
        );
      }
      const page = Number(url.searchParams.get("page") || 1);
      const limit = Number(url.searchParams.get("limit") || 20);
      const empty = url.searchParams.get("status") === "refunded";
      const filtered = url.searchParams.has("source");
      return Response.json({
        summary: empty
          ? Object.fromEntries(Object.keys(summary).map((key) => [key, 0]))
          : summary,
        items: empty
          ? []
          : filtered
          ? [clinic]
          : page === 2
          ? [online]
          : [clinic, online],
        page,
        limit,
        nextPage: page === 1 && !filtered && !empty && limit === 20 ? 2 : null,
      });
    })
  );
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    store.dispatch(dentraApi.util.resetApiState());
  });
  vi.unstubAllGlobals();
});

test("loads collections and refund totals, paginates and adjusts page size", async () => {
  await mount();
  expect(requests[0].pathname).toBe("/dentists/me/payments");
  expect(requests[0].searchParams.get("limit")).toBe("20");
  expect(text()).toContain("₹500.29");
  expect(text()).toContain("Refund needs attention");
  expect(tree.root.findAllByType("tbody")[0].findAllByType("tr")).toHaveLength(
    2
  );
  await click("Next page");
  expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
  expect(tree.root.findAllByType("tbody")[0].findAllByType("tr")).toHaveLength(
    1
  );
  expect(button("Next page").props.disabled).toBe(true);
  await act(async () => {
    tree.root
      .findAllByType("select")
      .find((node) => node.props["aria-label"] === "Rows per page")!
      .props.onChange({ target: { value: "50" } });
    await flush();
  });
  expect(requests.at(-1)!.searchParams.get("limit")).toBe("50");
  expect(requests.at(-1)!.searchParams.get("page")).toBe("1");
});

test("applies all filters together, resets the page and clears the selection", async () => {
  await mount();
  await click("Next page");
  await changeFields({
    q: "  receipt_%  ",
    source: "clinic",
    status: "paid",
    from: "2026-10-01",
    to: "2026-10-24",
  });
  expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
  await apply();
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual({
    page: "1",
    limit: "20",
    q: "receipt_%",
    source: "clinic",
    status: "paid",
    from: "2026-10-01",
    to: "2026-10-24",
  });
  await click("Clear filters");
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual({
    page: "1",
    limit: "20",
  });
  expect(
    tree.root
      .findByType("form")
      .findAllByType("input")
      .every((node) => node.props.value === "")
  ).toBe(true);
});

test("rejects reversed dates without a request and shows empty results with zero totals", async () => {
  await mount();
  await changeFields({ from: "2026-10-24", to: "2026-10-01" });
  const count = requests.length;
  await apply();
  expect(requests).toHaveLength(count);
  expect(text()).toContain("start date must be");
  await click("Clear filters");
  await changeFields({ status: "refunded" });
  await apply();
  expect(text()).toContain("No matching payments");
  expect(tree.root.findAllByType("table")).toHaveLength(0);
  expect(button("Next page").props.disabled).toBe(true);
  expect(text()).not.toContain("₹500.29");
});

test("retries errors and hides the previous report while changed filters load", async () => {
  fail = true;
  await mount();
  expect(text()).toContain("Could not load payments");
  fail = false;
  await click("Try again");
  let release!: () => void;
  hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await changeFields({ source: "clinic" });
  await apply();
  expect(text()).toContain("Loading payments");
  expect(tree.root.findAllByType("table")).toHaveLength(0);
  await act(async () => {
    release();
    await flush();
  });
  expect(text()).toContain("Synthetic Clinic Patient");
  expect(text()).not.toContain("Synthetic Online Patient");
});

test("loads a fresh receipt by ID, links to its appointment and removes it after closing", async () => {
  await mount();
  await click("View payment for Synthetic Clinic Patient");
  expect(requests.at(-1)!.pathname).toBe(
    "/dentists/me/payments/clinic-transaction"
  );
  expect(text()).toContain("clinic-receipt");
  expect(tree.root.findByType("a").props.href).toBe("/consult/clinic-visit");
  const receiptQuery = () =>
    dentraApi.endpoints.getDentistsMePaymentsByTransactionId.select({
      transactionId: clinic.id,
    })(store.getState());
  expect(receiptQuery().data?.id).toBe(clinic.id);
  await click("Close payment details");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(receiptQuery().data).toBeUndefined();
  expect(tree.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  await click("View payment for Synthetic Online Patient");
  expect(text()).toContain("pay_synthetic");
  expect(text()).toContain("order_synthetic");
});

test("refreshes reports after collections change and hides receipt data on denied refresh", async () => {
  await mount();
  await click("View payment for Synthetic Clinic Patient");
  const count = requests.length;
  denyDetail = true;
  await act(async () => {
    store.dispatch(dentraApi.util.invalidateTags(["Appointments"]));
    await flush();
  });
  expect(requests.length).toBe(count + 2);
  expect(text()).toContain("Payment unavailable");
  expect(text()).not.toContain("clinic-receipt");
  await act(async () => {
    tree.unmount();
    store.dispatch(dentraApi.util.resetApiState());
    await flush();
  });
  expect(
    Object.keys(store.getState().api.queries).every(
      (key) => !store.getState().api.queries[key]?.data
    )
  ).toBe(true);
});
