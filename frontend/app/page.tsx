
"use client";

import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:5000/api/produce";

type Produce = {
  Produce_ID: number;
  Crop_ID: number;
  Crop_Name: string;
  Location: string;
  Grade: string;
  Price: string;
  Quantity: string;
  Unit: string;
  Harvest_Date: string;
  Available_From: string;
};

export default function Home() {
  const [produce, setProduce] = useState<Produce[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formMessage, setFormMessage] = useState("");

  // Farmer and produce form fields
  const [farmerName, setFarmerName] = useState("");
  const [phone, setPhone] = useState("");
  const [newCrop, setNewCrop] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [price, setPrice] = useState("25");
  const [newGrade, setNewGrade] = useState("A");

  // Set dates after the component mounts to avoid the Next.js prerendering error.
  const [today, setToday] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");

  // Filter fields
  const [crop, setCrop] = useState("");
  const [location, setLocation] = useState("");
  const [grade, setGrade] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;

    setToday(formattedDate);
    setHarvestDate(formattedDate);
    setAvailableFrom(formattedDate);
  }, []);

  async function loadProduce() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);
      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "Could not load produce.");
      }

      setProduce(result.data || []);
    } catch {
      setError(
        "Could not connect to the backend. Make sure Flask is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProduce();
  }, []);

  async function handleAddProduce(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaving(true);
    setFormMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farmer_name: farmerName.trim(),
          phone: phone.trim(),
          crop_name: newCrop.trim(),
          location: newLocation.trim(),
          quantity,
          price,
          grade: newGrade,
          unit: "kg",
          harvest_date: harvestDate,
          available_from: availableFrom,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "Could not save produce.");
      }

      setFormMessage(
        `Produce saved successfully! Listing ID: ${result.produce_id}`
      );

      // Clear the form after successful submission.
      setFarmerName("");
      setPhone("");
      setNewCrop("");
      setNewLocation("");
      setQuantity("100");
      setPrice("25");
      setNewGrade("A");
      setHarvestDate(today);
      setAvailableFrom(today);

      // Refresh the table with data from MySQL.
      await loadProduce();
    } catch (err) {
      setFormMessage(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setCrop("");
    setLocation("");
    setGrade("");
    setMinPrice("");
    setMaxPrice("");
  }

  const filteredProduce = produce.filter((item) => {
    const matchesCrop =
      !crop ||
      item.Crop_Name.toLowerCase().includes(crop.toLowerCase());

    const matchesLocation =
      !location ||
      item.Location.toLowerCase().includes(location.toLowerCase());

    const matchesGrade = !grade || item.Grade === grade;

    const matchesMinPrice =
      minPrice === "" || Number(item.Price) >= Number(minPrice);

    const matchesMaxPrice =
      maxPrice === "" || Number(item.Price) <= Number(maxPrice);

    return (
      matchesCrop &&
      matchesLocation &&
      matchesGrade &&
      matchesMinPrice &&
      matchesMaxPrice
    );
  });

  const totalQuantity = filteredProduce.reduce(
    (total, item) => total + Number(item.Quantity),
    0
  );

  const averagePrice = filteredProduce.length
    ? filteredProduce.reduce(
        (total, item) => total + Number(item.Price),
        0
      ) / filteredProduce.length
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-green-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Agriculture Supply Chain
            </h1>
            <p className="mt-1 text-sm text-green-100">
              Smart Farmer Procurement Platform
            </p>
          </div>

          <span className="w-fit rounded-full bg-green-800 px-4 py-2 text-sm">
            Farmer &amp; Buyer Portal
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-6 py-8">
        {/* Dashboard */}
        <section>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage available agricultural produce and listings.
          </p>
        </section>

        {/* Dashboard statistics */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Available Listings</p>
            <p className="mt-2 text-3xl font-bold">
              {filteredProduce.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Quantity (kg)
            </p>
            <p className="mt-2 text-3xl font-bold">
              {totalQuantity.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Average Price per kg
            </p>
            <p className="mt-2 text-3xl font-bold">
              ₹
              {averagePrice.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </section>

        {/* Farmer registration and add produce form */}
        <section className="rounded-xl border border-green-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold">
            Farmer Registration &amp; Add Produce
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter farmer and crop details to save a produce listing
            in the database.
          </p>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={handleAddProduce}
          >
            <label className="text-sm font-medium">
              Farmer name
              <input
                required
                maxLength={100}
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Phone number (optional)
              <input
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Farmer phone number"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Crop name
              <input
                required
                maxLength={100}
                value={newCrop}
                onChange={(e) => setNewCrop(e.target.value)}
                placeholder="e.g. Tomato"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Location / village
              <input
                required
                maxLength={150}
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Mandya"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Quantity (kg)
              <input
                required
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Price per kg (₹)
              <input
                required
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Quality grade
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Harvest date
              <input
                required
                type="date"
                max={today || undefined}
                value={harvestDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setHarvestDate(newDate);

                  if (availableFrom && availableFrom < newDate) {
                    setAvailableFrom(newDate);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Available from
              <input
                required
                type="date"
                min={harvestDate || undefined}
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !today}
                className="w-full rounded-lg bg-green-800 px-5 py-2.5 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Produce"}
              </button>
            </div>
          </form>

          {formMessage && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"
            >
              {formMessage}
            </p>
          )}
        </section>

        {/* Search and filters */}
        <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Search &amp; Filter Produce
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Find produce by crop, location, grade or price.
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Clear Filters
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">
              Crop name
              <input
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="Search crop"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Search village"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              Grade
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">All grades</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-medium">
                Min price
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="₹ Min"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium">
                Max price
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="₹ Max"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Produce table */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Available Produce</h2>
              <p className="mt-1 text-sm text-slate-500">
                Listings retrieved from the MySQL database.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadProduce()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="p-8 text-center text-slate-500">
              Loading produce...
            </p>
          ) : filteredProduce.length === 0 ? (
            <p className="p-8 text-center text-slate-500">
              No produce found. Add a listing above or change your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-4 font-semibold">ID</th>
                    <th className="px-5 py-4 font-semibold">Crop</th>
                    <th className="px-5 py-4 font-semibold">Location</th>
                    <th className="px-5 py-4 font-semibold">Grade</th>
                    <th className="px-5 py-4 font-semibold">Quantity</th>
                    <th className="px-5 py-4 font-semibold">Price/kg</th>
                    <th className="px-5 py-4 font-semibold">Harvest date</th>
                    <th className="px-5 py-4 font-semibold">Available from</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProduce.map((item) => (
                    <tr
                      key={item.Produce_ID}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        {item.Produce_ID}
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {item.Crop_Name}
                      </td>
                      <td className="px-5 py-4">
                        {item.Location}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Grade {item.Grade}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {Number(item.Quantity).toLocaleString("en-IN")}{" "}
                        {item.Unit}
                      </td>
                      <td className="px-5 py-4">
                        ₹
                        {Number(item.Price).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        {item.Harvest_Date}
                      </td>
                      <td className="px-5 py-4">
                        {item.Available_From}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="py-4 text-center text-sm text-slate-500">
          Agriculture Supply Chain &amp; Smart Farmer Procurement Platform
        </footer>
      </div>
    </main>
  );
}
