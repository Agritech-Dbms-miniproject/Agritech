"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL = "http://localhost:5000/api";

type Produce = {
  Listing_ID: number;
  Produce_ID: number;
  Crop_Name: string;
  Available_Quantity: number;
  Unit: string;
  Grade: string | null;
  Price: number;
  Location: string;
  Farmer_ID: number;
  Farmer_Name: string;
  Farmer_Phone: string | null;
  Status: string;
  Image_Path?: string | null;
  image_path?: string | null;
  Image_URL?: string | null;
  image_url?: string | null;
};

type CartItem = {
  listing: Produce;
  quantity: number;
};

type LoggedInUser = {
  id?: number;
  name: string;
  email: string;
  role: string;
};

type ApiMessage = {
  success?: boolean;
  message?: string;
  user?: Record<string, unknown>;
  order_id?: number;
  total_amount?: number | string;
  status?: string;
};

export default function MarketplacePage() {
  const [produce, setProduce] = useState<Produce[]>([]);
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [grade, setGrade] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("default");

  const showMessage = useCallback(
    (text: string, type: "success" | "error") => {
      setMessage(text);
      setMessageType(type);
    },
    []
  );

  const fetchCurrentUser = useCallback(async () => {
    setUserLoading(true);

    try {
      const response = await fetch(`${API_URL}/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data: ApiMessage = await response.json();
      const rawUser = data.user;

      if (!rawUser) {
        setUser(null);
        return;
      }

      const name = String(rawUser.Name ?? rawUser.name ?? "");
      const email = String(rawUser.Email ?? rawUser.email ?? "");
      const role = String(
        rawUser.Account_Type ??
          rawUser.account_type ??
          rawUser.role ??
          ""
      ).toLowerCase();

      if (!name || !role) {
        console.warn("User response is missing name or role:", rawUser);
        setUser(null);
        return;
      }

      setUser({
        id: Number(rawUser.Farmer_ID ?? rawUser.id ?? 0) || undefined,
        name,
        email,
        role,
      });
    } catch (err) {
      console.error("Could not fetch current user:", err);
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const fetchProduce = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/listings`, {
        method: "GET",
        cache: "no-store",
      });

      const data: unknown = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error("Could not load available listings.");
      }

      const listings = data as Produce[];
      setProduce(listings);

      setCart((previousCart) => {
        const updated: Record<number, CartItem> = {};

        for (const [key, cartItem] of Object.entries(previousCart)) {
          const latest = listings.find(
            (item) => item.Listing_ID === Number(key)
          );

          if (
            latest &&
            latest.Status === "Available" &&
            Number(latest.Available_Quantity) > 0
          ) {
            updated[latest.Listing_ID] = {
              listing: latest,
              quantity: Math.min(
                cartItem.quantity,
                Number(latest.Available_Quantity)
              ),
            };
          }
        }

        return updated;
      });
    } catch (err) {
      console.error("Could not load listings:", err);
      setError(
        "Unable to load produce. Check whether the Flask backend is running and /api/listings is working."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProduce();
    void fetchCurrentUser();
  }, [fetchProduce, fetchCurrentUser]);

  const locations = useMemo(
    () =>
      [...new Set(produce.map((item) => item.Location).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [produce]
  );

  const grades = useMemo(
    () =>
      [
        ...new Set(
          produce
            .map((item) => item.Grade)
            .filter((value): value is string => Boolean(value))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [produce]
  );

  const filteredProduce = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = produce.filter((item) => {
      const matchesSearch =
        !query ||
        item.Crop_Name?.toLowerCase().includes(query) ||
        item.Location?.toLowerCase().includes(query) ||
        item.Farmer_Name?.toLowerCase().includes(query);

      const matchesLocation =
        location === "all" || item.Location === location;

      const matchesGrade =
        grade === "all" ||
        (grade === "__unspecified"
          ? !item.Grade
          : item.Grade === grade);

      const price = Number(item.Price);
      const matchesPrice =
        maxPrice.trim() === "" ||
        (Number.isFinite(Number(maxPrice)) &&
          Number(maxPrice) >= 0 &&
          price <= Number(maxPrice));

      return (
        matchesSearch &&
        matchesLocation &&
        matchesGrade &&
        matchesPrice
      );
    });

    if (sortOrder === "low-high") {
      results.sort((a, b) => Number(a.Price) - Number(b.Price));
    } else if (sortOrder === "high-low") {
      results.sort((a, b) => Number(b.Price) - Number(a.Price));
    } else if (sortOrder === "quantity") {
      results.sort(
        (a, b) =>
          Number(b.Available_Quantity) - Number(a.Available_Quantity)
      );
    }

    return results;
  }, [produce, search, location, grade, maxPrice, sortOrder]);

  const cartItems = Object.values(cart);

  const cartTotal = cartItems.reduce(
    (total, item) => total + Number(item.listing.Price) * item.quantity,
    0
  );

  const cartQuantity = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  function clearFilters() {
    setSearch("");
    setLocation("all");
    setGrade("all");
    setMaxPrice("");
    setSortOrder("default");
  }

  function addToCart(item: Produce) {
    setMessage("");

    const requested = Number(quantities[item.Listing_ID] ?? "1");

    if (!Number.isFinite(requested) || requested <= 0) {
      showMessage("Enter a valid quantity greater than zero.", "error");
      return;
    }

    const existing = cart[item.Listing_ID]?.quantity ?? 0;
    const combined = existing + requested;

    if (combined > Number(item.Available_Quantity)) {
      showMessage(
        `Only ${item.Available_Quantity} ${item.Unit} of ${item.Crop_Name} are available.`,
        "error"
      );
      return;
    }

    setCart((previous) => ({
      ...previous,
      [item.Listing_ID]: {
        listing: item,
        quantity: (previous[item.Listing_ID]?.quantity ?? 0) + requested,
      },
    }));

    setQuantities((previous) => ({
      ...previous,
      [item.Listing_ID]: "1",
    }));

    showMessage(`${item.Crop_Name} added to your cart.`, "success");
  }

  function updateCartQuantity(listingId: number, value: string) {
    const current = cart[listingId];
    if (!current) return;

    const quantity = Number(value);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > Number(current.listing.Available_Quantity)
    ) {
      showMessage(
        `Enter a quantity greater than zero and no more than ${current.listing.Available_Quantity}.`,
        "error"
      );
      return;
    }

    setCart((previous) => ({
      ...previous,
      [listingId]: {
        ...previous[listingId],
        quantity,
      },
    }));

    setMessage("");
  }

  function removeFromCart(listingId: number) {
    setCart((previous) => {
      const updated = { ...previous };
      delete updated[listingId];
      return updated;
    });

    showMessage("Item removed from your cart.", "success");
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setUser(null);
      setCart({});
      window.location.href = "/login";
    }
  }

  async function placeOrder() {
    let currentUser = user;

    if (!currentUser) {
      await fetchCurrentUser();
      showMessage(
        "Your login session was not detected. If you just logged in, refresh this page. If the message remains, check the /api/me response.",
        "error"
      );
      return;
    }

    if (currentUser.role.toLowerCase() !== "buyer") {
      showMessage(
        "Please log in with a Buyer account to place an order.",
        "error"
      );
      return;
    }

    if (cartItems.length === 0) {
      showMessage("Your cart is empty.", "error");
      return;
    }

    for (const item of cartItems) {
      if (
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > Number(item.listing.Available_Quantity)
      ) {
        showMessage(
          `Please check the quantity for ${item.listing.Crop_Name}.`,
          "error"
        );
        return;
      }
    }

    setCheckoutLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            listing_id: item.listing.Listing_ID,
            quantity: item.quantity,
          })),
        }),
      });

      const data: ApiMessage = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            `Checkout failed with HTTP status ${response.status}.`
        );
      }

      const orderId = data.order_id;
      const total = Number(data.total_amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      setCart({});
      setQuantities({});

      showMessage(
        `Thank you for placing your order, ${currentUser.name}! Your order #${orderId} has been placed successfully. Total: ₹${total}. Status: ${data.status ?? "Pending"}.`,
        "success"
      );

      await fetchProduce();
    } catch (err) {
      console.error("Checkout failed:", err);
      showMessage(
        err instanceof Error
          ? err.message
          : "Could not place your order. Please try again.",
        "error"
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen text-slate-900"
      style={{
        backgroundColor: "#e8f1e5",
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.30), rgba(255,255,255,0.30)), url("/agritrace-bg.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-white/50 bg-white/80 p-6 backdrop-blur-sm md:block">
          <Link
            href="/marketplace"
            className="text-2xl font-bold text-green-700"
          >
            AgriTrace
          </Link>

          <div className="mt-8 rounded-xl bg-green-50/90 p-4">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="mt-1 break-words font-semibold">
              {userLoading ? "Loading..." : user?.name ?? "Guest"}
            </p>

            {user && (
              <>
                <p className="mt-1 break-words text-xs text-slate-500">
                  {user.email}
                </p>
                <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">
                  {user.role}
                </span>
              </>
            )}
          </div>

          <nav className="mt-8 space-y-2">
            <Link
              href="/marketplace"
              className="block rounded-lg bg-green-100 px-4 py-3 font-medium text-green-800"
            >
              Marketplace
            </Link>

            <a
              href="#shopping-cart"
              className="block rounded-lg px-4 py-3 hover:bg-slate-100/80"
            >
              My Cart ({cartItems.length})
            </a>

            {user?.role.toLowerCase() === "buyer" && (
              <Link
                href="/my-orders"
                className="block rounded-lg px-4 py-3 hover:bg-slate-100/80"
              >
                My Orders
              </Link>
            )}

            {user?.role.toLowerCase() === "farmer" && (
              <Link
                href="/farmer-dashboard"
                className="block rounded-lg px-4 py-3 hover:bg-slate-100/80"
              >
                Farmer Dashboard
              </Link>
            )}

            {user ? (
              <button
                onClick={() => void logout()}
                className="w-full rounded-lg px-4 py-3 text-left text-red-700 hover:bg-red-50"
              >
                Logout
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block rounded-lg px-4 py-3 hover:bg-slate-100/80"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="block rounded-lg px-4 py-3 hover:bg-slate-100/80"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 px-5 py-8 sm:px-8">
          {/* Mobile navigation */}
          <div className="mb-6 flex items-center justify-between md:hidden">
            <Link
              href="/marketplace"
              className="text-xl font-bold text-green-700"
            >
              AgriTrace
            </Link>

            {user ? (
              <button
                onClick={() => void logout()}
                className="rounded-lg border border-slate-300 bg-white/80 px-3 py-2"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-green-700 px-4 py-2 text-white"
              >
                Login
              </Link>
            )}
          </div>

          {/* Welcome banner */}
          <header className="mb-8 rounded-2xl bg-green-700/95 p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-semibold tracking-widest text-green-100">
              SMART FARMING • TRACEABILITY • PROCUREMENT
            </p>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              {userLoading
                ? "Welcome to AgriTrace!"
                : user
                  ? `Welcome back, ${user.name}!`
                  : "Welcome to AgriTrace!"}
            </h1>

            <p className="mt-3 text-green-50">
              Discover fresh produce directly from farmers.
            </p>

            {!user && !userLoading && (
              <Link
                href="/login"
                className="mt-5 inline-block rounded-lg bg-white px-5 py-2 font-semibold text-green-800 hover:bg-green-50"
              >
                Log in to place an order
              </Link>
            )}
          </header>

          {/* Messages */}
          {message && (
            <div
              role="status"
              aria-live="polite"
              className={`mb-6 rounded-xl border p-4 ${
                messageType === "success"
                  ? "border-green-200 bg-green-50/95 text-green-800"
                  : "border-red-200 bg-red-50/95 text-red-800"
              }`}
            >
              <p className="font-medium">{message}</p>

              {messageType === "success" &&
                message.startsWith("Thank you for placing your order") && (
                  <p className="mt-2 text-sm">
                    We appreciate your purchase. Keep your order ID for
                    reference and check My Orders for updates.
                  </p>
                )}
            </div>
          )}

          {/* Produce heading */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-xl bg-white/70 p-3">
              <h2 className="text-xl font-semibold">Available Produce</h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse, compare, and find the produce you need.
              </p>
            </div>

            <button
              onClick={() => void fetchProduce()}
              disabled={loading}
              className="rounded-lg bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Search and filters */}
          <section className="mb-8 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-semibold">Search and Filter</h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  htmlFor="crop-search"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Search crop, location, or farmer
                </label>
                <input
                  id="crop-search"
                  type="search"
                  placeholder="e.g. Tomato, Mandya..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label
                  htmlFor="location-filter"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Filter by location
                </label>
                <select
                  id="location-filter"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="all">All locations</option>
                  {locations.map((place) => (
                    <option key={place} value={place}>
                      {place}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="grade-filter"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Filter by quality grade
                </label>
                <select
                  id="grade-filter"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="all">All grades</option>
                  {grades.map((value) => (
                    <option key={value} value={value}>
                      Grade {value}
                    </option>
                  ))}
                  <option value="__unspecified">Not specified</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="max-price"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Maximum price (₹ per unit)
                </label>
                <input
                  id="max-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 30"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </div>

              <div>
                <label
                  htmlFor="sort-order"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Sort results
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="default">Default order</option>
                  <option value="low-high">Price: low to high</option>
                  <option value="high-low">Price: high to low</option>
                  <option value="quantity">Quantity: highest first</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-slate-300 bg-white/80 px-4 py-2 font-medium hover:bg-slate-100"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          {loading && (
            <p className="rounded-lg bg-white/80 px-4 py-3 text-slate-600">
              Loading available produce...
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-100/95 p-4 text-red-700">
              <p>{error}</p>
              <button
                onClick={() => void fetchProduce()}
                className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-white"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && produce.length === 0 && (
            <div className="rounded-xl bg-white/90 p-8 text-center shadow-sm backdrop-blur-sm">
              <h3 className="text-lg font-semibold">
                No produce available yet
              </h3>
              <p className="mt-2 text-slate-600">
                Produce added by farmers will appear here.
              </p>
            </div>
          )}

          {!loading && !error && produce.length > 0 && (
            <>
              <p className="mb-4 inline-block rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">
                Showing <strong>{filteredProduce.length}</strong> of{" "}
                {produce.length} available listings
              </p>

              {filteredProduce.length === 0 ? (
                <div className="rounded-xl border border-white/60 bg-white/90 p-8 text-center backdrop-blur-sm">
                  <h3 className="text-lg font-semibold">
                    No matching produce found
                  </h3>
                  <p className="mt-2 text-slate-600">
                    Try changing your search or filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-white"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProduce.map((item) => (
                    <article
                      key={item.Listing_ID}
                      className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {/* Uploaded crop image */}
                      {(() => {
                        const savedImage =
                          item.Image_Path ||
                          item.image_path ||
                          item.Image_URL ||
                          item.image_url;

                        if (!savedImage) {
                          return (
                            <div
                              className="flex h-48 w-full items-center justify-center bg-green-50 text-6xl"
                              aria-label="No crop image uploaded"
                            >
                              🌱
                            </div>
                          );
                        }

                        const imageSrc = /^https?:\/\//i.test(savedImage)
                          ? savedImage
                          : `${API_URL.replace(/\/api$/, "")}/${savedImage.replace(/^\/+/, "")}`;

                        return (
                          <img
                            src={imageSrc}
                            alt={`${item.Crop_Name} crop`}
                            className="h-48 w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        );
                      })()}

                      <div className="p-6">
                        <h3 className="text-xl font-bold">{item.Crop_Name}</h3>

                        <p className="mt-3 text-2xl font-bold text-green-700">
                          ₹
                          {Number(item.Price).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          <span className="text-sm font-normal text-slate-500">
                            {" "}per {item.Unit || "unit"}
                          </span>
                        </p>

                        <div className="mt-5 space-y-2 text-sm text-slate-600">
                          <p>
                            <strong>Available:</strong>{" "}
                            {Number(item.Available_Quantity).toLocaleString(
                              "en-IN"
                            )}{" "}
                            {item.Unit || "kg"}
                          </p>
                          <p>
                            <strong>Grade:</strong>{" "}
                            {item.Grade || "Not specified"}
                          </p>
                          <p>
                            <strong>Location:</strong>{" "}
                            {item.Location || "Not specified"}
                          </p>
                          <p>
                            <strong>Farmer:</strong>{" "}
                            {item.Farmer_Name || "Farmer"}
                          </p>
                          {item.Farmer_Phone && (
                            <p>
                              <strong>Contact:</strong> {item.Farmer_Phone}
                            </p>
                          )}
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <label
                            htmlFor={`quantity-${item.Listing_ID}`}
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            Quantity ({item.Unit || "kg"})
                          </label>

                          <input
                            id={`quantity-${item.Listing_ID}`}
                            type="number"
                            min="0.01"
                            max={item.Available_Quantity}
                            step="0.01"
                            value={quantities[item.Listing_ID] ?? "1"}
                            onChange={(event) =>
                              setQuantities((previous) => ({
                                ...previous,
                                [item.Listing_ID]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />

                          <p className="mt-2 text-sm text-slate-500">
                            Subtotal: ₹
                            {(
                              Number(item.Price) *
                              Math.max(
                                0,
                                Number(quantities[item.Listing_ID] ?? "1") || 0
                              )
                            ).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          <button
                            onClick={() => addToCart(item)}
                            className="mt-3 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Shopping cart */}
          <section
            id="shopping-cart"
            className="mt-10 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Your Cart</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {cartItems.length} item type(s) · {cartQuantity} total units
                </p>
              </div>

              <p className="text-xl font-bold text-green-700">
                ₹
                {cartTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {cartItems.length === 0 ? (
              <p className="mt-5 rounded-lg bg-slate-50/90 p-5 text-slate-600">
                Your cart is empty. Add produce from the marketplace above.
              </p>
            ) : (
              <>
                <div className="mt-5 divide-y divide-slate-100">
                  {cartItems.map(({ listing, quantity }) => (
                    <div
                      key={listing.Listing_ID}
                      className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {listing.Crop_Name} — Grade{" "}
                          {listing.Grade || "Not specified"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {listing.Location} · ₹
                          {Number(listing.Price).toFixed(2)} per{" "}
                          {listing.Unit}
                        </p>
                        <p className="mt-1 font-semibold">
                          Subtotal: ₹
                          {(Number(listing.Price) * quantity).toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label
                          htmlFor={`cart-quantity-${listing.Listing_ID}`}
                          className="text-sm text-slate-600"
                        >
                          Qty:
                        </label>
                        <input
                          id={`cart-quantity-${listing.Listing_ID}`}
                          type="number"
                          min="0.01"
                          max={listing.Available_Quantity}
                          step="0.01"
                          value={quantity}
                          onChange={(event) =>
                            updateCartQuantity(
                              listing.Listing_ID,
                              event.target.value
                            )
                          }
                          className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                        <button
                          onClick={() => removeFromCart(listing.Listing_ID)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      The server recalculates your final total at checkout.
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      Total: ₹
                      {cartTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  <button
                    onClick={() => void placeOrder()}
                    disabled={checkoutLoading || cartItems.length === 0}
                    className="rounded-xl bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkoutLoading ? "Placing Order..." : "Place Order"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
