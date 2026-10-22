import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Order } from "@virtual-ai-office/shared";
import { OrderDetail } from "./pages/OrdersPage";

vi.mock("./api", () => ({
  getOrder: vi.fn(),
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  transitionOrder: vi.fn(),
  markOrderPaid: vi.fn(),
}));

vi.mock("../useResource", async () => {
  const React = await import("react");
  return {
    useResource: (fetcher: () => Promise<unknown>) => {
      const [data, setData] = React.useState<unknown>(null);
      const [loading, setLoading] = React.useState(true);
      React.useEffect(() => {
        let cancelled = false;
        fetcher().then((d) => {
          if (!cancelled) {
            setData(d);
            setLoading(false);
          }
        });
        return () => {
          cancelled = true;
        };
      }, []);
      return { data, loading, error: null, refresh: () => {} };
    },
  };
});

import { getOrder, markOrderPaid, transitionOrder } from "./api";

const getOrderMock = vi.mocked(getOrder);
const transitionOrderMock = vi.mocked(transitionOrder);
const markOrderPaidMock = vi.mocked(markOrderPaid);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord-1",
    customerName: "Jane",
    customerContact: "jane@example.com",
    serviceId: "svc-1",
    brief: "Please research EV batteries.",
    attachments: [],
    status: "pending",
    workerId: null,
    paid: false,
    paymentRef: null,
    deliverables: [],
    reviewState: "none",
    reviewNote: "",
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

async function renderDetail(order: Order) {
  getOrderMock.mockResolvedValue({ order });
  render(
    <OrderDetail orderId={order.id} onBack={() => {}} onChanged={() => {}} />,
  );
  await waitFor(() =>
    expect(screen.getByText(`Order ${order.id}`)).toBeInTheDocument(),
  );
  // wait for the async order payload
  await waitFor(() => expect(getOrderMock).toHaveBeenCalled());
  await screen.findByText(order.customerName || "—");
}

describe("OrderDetail", () => {
  it("shows only the transitions allowed by ORDER_TRANSITIONS", async () => {
    await renderDetail(makeOrder({ status: "pending" }));
    expect(screen.getByTestId("transition-accepted")).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("transition-completed")).toBeNull();
    expect(screen.queryByTestId("transition-review")).toBeNull();
  });

  it("in_progress offers review, failed and cancelled — not completed", async () => {
    await renderDetail(makeOrder({ status: "in_progress" }));
    expect(screen.getByTestId("transition-review")).toBeInTheDocument();
    expect(screen.getByTestId("transition-failed")).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("transition-completed")).toBeNull();
  });

  it("terminal states show no transition buttons", async () => {
    await renderDetail(makeOrder({ status: "completed" }));
    expect(screen.getByText(/Terminal state/)).toBeInTheDocument();
    expect(screen.queryByTestId("transition-queued")).toBeNull();
  });

  it("calls the transition API with {to, note}", async () => {
    transitionOrderMock.mockResolvedValue({ order: makeOrder({ status: "accepted" }) });
    await renderDetail(makeOrder({ status: "pending" }));
    fireEvent.change(screen.getByPlaceholderText(/Why is this changing state/), {
      target: { value: "looks good" },
    });
    fireEvent.click(screen.getByTestId("transition-accepted"));
    await waitFor(() =>
      expect(transitionOrderMock).toHaveBeenCalledWith("ord-1", {
        to: "accepted",
        note: "looks good",
      }),
    );
  });

  it("renders the brief as plain text — HTML in it is escaped, never executed", async () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    await renderDetail(makeOrder({ brief: evil }));
    const briefEl = document.querySelector(".order-brief");
    expect(briefEl).not.toBeNull();
    expect(briefEl!.textContent).toContain(evil);
    // No HTML elements were created from the brief…
    expect(briefEl!.querySelector("img")).toBeNull();
    expect(briefEl!.querySelector("script")).toBeNull();
    // …and the component never uses dangerouslySetInnerHTML.
    expect(briefEl!.innerHTML).not.toContain("<img");
  });

  it("marks customer contact as admin-only", async () => {
    await renderDetail(makeOrder({ customerContact: "secret-phone" }));
    expect(screen.getByText("secret-phone")).toBeInTheDocument();
    expect(screen.getByText(/Admin only/)).toBeInTheDocument();
  });

  it("unpaid orders show a Mark paid button", async () => {
    await renderDetail(makeOrder({ paid: false }));
    expect(screen.getByText("Mark paid…")).toBeInTheDocument();
  });

  it("paid orders show the PAID pill and the provider reference", async () => {
    await renderDetail(
      makeOrder({ paid: true, paymentRef: "pi_123" }),
    );
    expect(screen.getByText("PAID")).toBeInTheDocument();
    expect(screen.getByText("pi_123")).toBeInTheDocument();
    expect(screen.queryByText("Mark paid…")).toBeNull();
  });

  it("the mark-paid form warns that payment must be provider-verified", async () => {
    await renderDetail(makeOrder({ paid: false }));
    fireEvent.click(screen.getByText("Mark paid…"));
    expect(
      screen.getByText(/verified payment provider confirms/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("stripe"), {
      target: { value: "stripe" },
    });
    fireEvent.change(screen.getByPlaceholderText("pi_…"), {
      target: { value: "pi_999" },
    });
    markOrderPaidMock.mockResolvedValue({ order: makeOrder({ paid: true }) });
    fireEvent.click(screen.getByText("Confirm payment"));
    await waitFor(() =>
      expect(markOrderPaidMock).toHaveBeenCalledWith("ord-1", {
        provider: "stripe",
        providerRef: "pi_999",
      }),
    );
  });
});
