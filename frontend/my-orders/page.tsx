
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL = "http://localhost:5000/api";

type OrderItem = {
  OrderItem_ID?: number;
  Order_Item_ID?: number;
  Crop_Name?: string;
  Quantity?: number | string;
  Unit_Price?: number | string;
  Amount?: number | string;
  Unit?: string;
  Grade?: string | null;
  Location?: string | null;
  Farmer_Name?: string | null;
};

type Order = {
  Order_ID: number;
  Order_Date: string | null;
  Total_Amount: number | string;
  Status: string;
  Expected_Date?: string | null;
  Items?: OrderItem[];
  items?: OrderItem[];
};

type User = {
  name: string;
  email: string;
  role: string;
};

const trackingStages = [
  { label: "Order placed", detail: "Your order has been submitted." },
  { label: "Accepted", detail: "The farmer has confirmed your order." },
  { label: "Preparing", detail: "Your produce is being prepared." },
  { label: "Shipped", detail: "Your order has been dispatched." },
  { label: "Out for delivery", detail: "Your produce is on its way." },
  { label: "Delivered", detail: "Your order has been delivered." },
];

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeStatus(value?: string | null) {
  const s = (value || "Pending")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

  if (s.includes("cancel")) return "Cancelled";
  if (s.includes("reject") || s.includes("declin")) return "Rejected";
  if (s.includes("out for delivery")) return "Out for Delivery";
  if (s.includes("deliver")) return "Delivered";
  if (s.includes("ship") || s.includes("dispatch")) return "Shipped";
  if (s.includes("prepar") || s.includes("process")) return "Preparing";
  if (s.includes("accept")) return "Accepted";
  if (s.includes("confirm")) return "Confirmed";
  if (s.includes("pending")) return "Pending";
  if (s.includes("place")) return "Placed";

  return value || "Pending";
}

function statusClasses(status: string) {
  switch (status) {
    case "Delivered":
      return "bg-green-100 text-green-800";
    case "Cancelled":
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Shipped":
    case "Out for Delivery":
      return "bg-blue-100 text-blue-800";
    case "Accepted":
    case "Confirmed":
      return "bg-indigo-100 text-indigo-800";
    case "Preparing":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function stageIndex(status: string) {
  switch (status) {
    case "Placed":
    case "Pending":
      return 0;
    case "Accepted":
    case "Confirmed":
      return 1;
    case "Preparing":
      return 2;
    case "Shipped":
      return 3;
    case "Out for Delivery":
      return 4;
    case "Delivered":
      return 5;
    default:
      return -1;
  }
}

async function readResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

export default function MyOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const meResponse = await fetch(`${API_URL}/me`, {
        credentials: "include",
        cache: "no-store",
      });

      const meData = await readResponse(meResponse);

      if (!meResponse.ok || !meData.user) {
        throw new Error("Please log in again to view your orders.");
      }

      const rawUser = meData.user;

      const currentUser: User = {
        name: String(rawUser.Name ?? rawUser.name ?? "Buyer"),
        email: String(rawUser.Email ?? rawUser.email ?? ""),
        role: String(
          rawUser.Account_Type ??
            rawUser.account_type ??
            rawUser.role ??
            ""
        ).toLowerCase(),
      };

      setUser(currentUser);

      if (currentUser.role !== "buyer") {
        throw new Error("Please log in with a buyer account.");
      }

      const response = await fetch(`${API_URL}/my-orders`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await readResponse(response);

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not load your orders.");
      }

      const rawOrders = data.orders ?? data.Orders ?? data.data ?? [];

      if (!Array.isArray(rawOrders)) {
        throw new Error("Unexpected orders format returned by the server.");
      }

      const normalizedOrders: Order[] = rawOrders.map(
        (order: Record<string, unknown>) => ({
          Order_ID: Number(order.Order_ID ?? order.order_id ?? 0),
          Order_Date: (order.Order_Date ??
            order.order_date ??
            null) as string | null,
          Total_Amount: (order.Total_Amount ??
            order.total_amount ??
            0) as number | string,
          Status: normalizeStatus(
            String(order.Status ?? order.status ?? "Pending")
          ),
          Expected_Date: (order.Expected_Date ??
            order.expected_date ??
            null) as string | null,
          Items: (order.Items ?? order.items ?? []) as OrderItem[],
        })
      );

      setOrders(normalizedOrders);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function logout() {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const status = normalizeStatus(order.Status);
      const matchesStatus =
        statusFilter === "All" || status === statusFilter;

      const itemText = (order.Items ?? [])
        .map((item) =>
          [
            item.Crop_Name,
            item.Farmer_Name,
            item.Location,
            item.Grade,
          ].join(" ")
        )
        .join(" ");

      const matchesSearch =
        !query ||
        String(order.Order_ID).includes(query) ||
        status.toLowerCase().includes(query) ||
        itemText.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.Total_Amount || 0),
    0
  );

  const pendingCount = orders.filter((order) =>
    ["Pending", "Placed"].includes(normalizeStatus(order.Status))
  ).length;

  const activeCount = orders.filter((order) =>
    [
      "Accepted",
      "Confirmed",
      "Preparing",
      "Shipped",
      "Out for Delivery",
    ].includes(normalizeStatus(order.Status))
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-6 md:block">
          <Link
            href="/marketplace"
            className="text-2xl font-bold text-green-700"
          >
            AgriTrace
          </Link>

          <div className="mt-8 rounded-xl bg-green-50 p-4">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="mt-1 font-semibold">
              {user?.name || "Loading..."}
            </p>

            {user?.email && (
              <p className="mt-1 break-words text-xs text-slate-500">
                {user.email}
              </p>
            )}

            {user?.role && (
              <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">
                {user.role}
              </span>
            )}
          </div>

          <nav className="mt-8 space-y-2">
            <Link
              href="/marketplace"
              className="block rounded-lg px-4 py-3 hover:bg-slate-100"
            >
              Marketplace
            </Link>

            <Link
              href="/marketplace#shopping-cart"
              className="block rounded-lg px-4 py-3 hover:bg-slate-100"
            >
              My Cart
            </Link>

            <Link
              href="/my-orders"
              className="block rounded-lg bg-green-100 px-4 py-3 font-medium text-green-800"
            >
              My Orders
            </Link>

            <button
              onClick={() => void logout()}
              className="w-full rounded-lg px-4 py-3 text-left text-red-700 hover:bg-red-50"
            >
              Logout
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-widest text-green-700">
                AGRITRACE • ORDER HISTORY
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {user ? `Your Orders, ${user.name}` : "My Orders"}
              </h1>

              <p className="mt-2 text-slate-600">
                Track your produce orders from placement to delivery.
              </p>
            </div>

            <button
              onClick={() => void loadOrders()}
              disabled={loading}
              className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh orders"}
            </button>
          </div>

          {loading && (
            <div className="rounded-xl bg-white p-8 text-slate-600 shadow-sm">
              Loading your orders...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
              <p className="font-semibold">Unable to load orders</p>
              <p className="mt-2">{error}</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => void loadOrders()}
                  className="rounded-lg bg-red-700 px-4 py-2 text-white"
                >
                  Try again
                </button>

                <Link
                  href="/login"
                  className="rounded-lg border border-red-300 px-4 py-2"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-white p-5">
                  <p className="text-sm text-slate-500">Total orders</p>
                  <p className="mt-2 text-2xl font-bold">{orders.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-5">
                  <p className="text-sm text-slate-500">
                    Awaiting confirmation
                  </p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">
                    {pendingCount}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5">
                  <p className="text-sm text-slate-500">In progress</p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">
                    {activeCount}
                  </p>
                </div>

                <div className="rounded-xl border bg-white p-5">
                  <p className="text-sm text-slate-500">Total order value</p>
                  <p className="mt-2 text-xl font-bold text-green-700">
                    {money(totalValue)}
                  </p>
                </div>
              </div>

              <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order ID, crop, farmer, location..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-green-600"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-4 py-3"
                >
                  <option value="All">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Placed">Placed</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {orders.length === 0 ? (
                <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
                  <div className="text-5xl">🧺</div>
                  <h2 className="mt-4 text-xl font-bold">No orders yet</h2>
                  <p className="mt-2 text-slate-600">
                    Your purchases will appear here after you place an order.
                  </p>

                  <Link
                    href="/marketplace"
                    className="mt-5 inline-block rounded-lg bg-green-700 px-5 py-3 font-semibold text-white"
                  >
                    Browse Marketplace
                  </Link>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
                  No orders match your search or selected status.

                  <button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("All");
                    }}
                    className="ml-2 font-semibold text-green-700"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredOrders.map((order) => {
                    const status = normalizeStatus(order.Status);
                    const currentStage = stageIndex(status);
                    const cancelled = ["Cancelled", "Rejected"].includes(status);
                    const items = order.Items ?? [];

                    return (
                      <article
                        key={order.Order_ID}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-slate-50 p-5">
                          <div>
                            <h2 className="text-lg font-bold">
                              Order #{order.Order_ID}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                              Placed on {formatDate(order.Order_Date)}
                            </p>

                            {order.Expected_Date && (
                              <p className="mt-1 text-sm text-slate-500">
                                Expected date: {formatDate(order.Expected_Date)}
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses(status)}`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="space-y-4 p-5">
                          {items.length === 0 ? (
                            <p className="text-slate-500">
                              No item details are available for this order.
                            </p>
                          ) : (
                            items.map((item, index) => (
                              <div
                                key={
                                  item.OrderItem_ID ??
                                  item.Order_Item_ID ??
                                  index
                                }
                                className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 last:border-0 sm:flex-row sm:items-start"
                              >
                                <div>
                                  <h3 className="font-semibold">
                                    {item.Crop_Name || "Produce"}
                                    {item.Grade ? ` — Grade ${item.Grade}` : ""}
                                  </h3>

                                  <p className="mt-1 text-sm text-slate-500">
                                    Quantity: {item.Quantity ?? "—"}{" "}
                                    {item.Unit || ""}
                                  </p>

                                  <p className="mt-1 text-sm text-slate-500">
                                    Unit price: {money(item.Unit_Price)}
                                  </p>

                                  {item.Farmer_Name && (
                                    <p className="mt-1 text-sm text-slate-500">
                                      Farmer: {item.Farmer_Name}
                                    </p>
                                  )}

                                  {item.Location && (
                                    <p className="mt-1 text-sm text-slate-500">
                                      Location: {item.Location}
                                    </p>
                                  )}
                                </div>

                                <p className="font-semibold">
                                  {money(item.Amount)}
                                </p>
                              </div>
                            ))
                          )}

                          <div className="flex justify-between gap-3 border-t pt-4">
                            <span className="text-slate-600">Order total</span>
                            <span className="text-xl font-bold text-green-700">
                              {money(order.Total_Amount)}
                            </span>
                          </div>
                        </div>

                        <div className="border-t bg-slate-50 p-5">
                          <h3 className="font-bold">Order tracking</h3>

                          {cancelled ? (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                              This order is {status.toLowerCase()}. The delivery
                              timeline is no longer active.
                            </div>
                          ) : (
                            <>
                              {currentStage === -1 && (
                                <p className="mt-3 text-sm text-slate-600">
                                  Tracking will appear when the order status is
                                  updated by the server.
                                </p>
                              )}

                              <ol className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {trackingStages.map((stage, index) => {
                                  const completed = currentStage >= index;
                                  const current = currentStage === index;

                                  return (
                                    <li
                                      key={stage.label}
                                      className={`rounded-xl border p-4 ${
                                        completed
                                          ? "border-green-200 bg-green-50"
                                          : "border-slate-200 bg-white"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                            completed
                                              ? "bg-green-700 text-white"
                                              : "bg-slate-200 text-slate-600"
                                          }`}
                                        >
                                          {completed && !current
                                            ? "✓"
                                            : index + 1}
                                        </span>

                                        <div>
                                          <p
                                            className={`font-semibold ${
                                              completed
                                                ? "text-green-800"
                                                : "text-slate-500"
                                            }`}
                                          >
                                            {stage.label}
                                          </p>

                                          {current && (
                                            <p className="text-xs font-medium text-green-700">
                                              Current status
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <p className="mt-2 text-sm text-slate-500">
                                        {stage.detail}
                                      </p>
                                    </li>
                                  );
                                })}
                              </ol>
                            </>
                          )}

                          <p className="mt-4 text-xs text-slate-500">
                            Delivery progress reflects the latest order status
                            saved by the backend. The timeline does not update
                            the order status by itself.
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
