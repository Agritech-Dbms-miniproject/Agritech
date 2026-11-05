"use client";

import { useEffect, useState, type FormEvent } from "react";

const API_URL = "http://localhost:5000/api";

type Produce = {
  Produce_ID: number;
  Crop_Name: string;
  Quantity: number;
  Unit: string;
  Grade: string | null;
  Price: number;
  Harvest_Date: string | null;
  Available_From: string | null;
  Location: string | null;
  Farmer_Name?: string;
};

type Farmer = {
  id: number;
  name: string;
  email: string;
  role?: string;
  account_type?: string;
  Account_Type?: string;
};

export default function DashboardPage() {
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [produce, setProduce] = useState<Produce[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [cropName, setCropName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [grade, setGrade] = useState("A");
  const [location, setLocation] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [cropImage, setCropImage] = useState<File | null>(null);

  const [cropFilter, setCropFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  useEffect(() => {
    void checkLoginAndLoadProduce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkLoginAndLoadProduce() {
    try {
      const response = await fetch(`${API_URL}/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        setError("Your login session is not active. Please log in again.");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not verify your login.");
      }

      const account: Farmer | undefined = result.user || result.farmer;

      if (!account) {
        setError("The server did not return your account details.");
        return;
      }

      const role = String(
        account.role ??
          account.account_type ??
          account.Account_Type ??
          result.role ??
          result.account_type ??
          ""
      )
        .trim()
        .toLowerCase();

      if (role && role !== "farmer") {
        if (role === "buyer") {
          window.location.replace("/marketplace");
          return;
        }

        setError("Your account role could not be verified.");
        return;
      }

      setFarmer(account);
      await loadProduce();
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Cannot connect to the Flask server on port 5000."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadProduce() {
    const response = await fetch(`${API_URL}/my-produce`, {
      credentials: "include",
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
          (response.status === 401
            ? "Your session is not active. Please log in again."
            : "Could not load your produce.")
      );
    }

    const items = Array.isArray(result)
      ? result
      : result.produce ?? result.listings;

    if (!Array.isArray(items)) {
      throw new Error("The server returned an unexpected produce response.");
    }

    setProduce(items);
  }

  async function handleAddProduce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!cropName.trim() || !location.trim()) {
      setError("Enter the crop name and location.");
      return;
    }

    if (
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) <= 0 ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      setError("Enter a valid positive quantity and a non-negative price.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("crop_name", cropName.trim());
      formData.append("quantity", String(Number(quantity)));
      formData.append("price", String(Number(price)));
      formData.append("grade", grade);
      formData.append("location", location.trim());
      formData.append("unit", "kg");

      if (harvestDate) {
        formData.append("harvest_date", harvestDate);
      }

      if (availableFrom) {
        formData.append("available_from", availableFrom);
      }

      if (cropImage) {
        formData.append("image", cropImage);
      }

      const response = await fetch(`${API_URL}/produce`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || "Could not add produce.");
        return;
      }

      setMessage("Produce added successfully!");

      setCropName("");
      setQuantity("");
      setPrice("");
      setGrade("A");
      setLocation("");
      setHarvestDate("");
      setAvailableFrom("");
      setCropImage(null);

      const imageInput = document.getElementById(
        "cropImage"
      ) as HTMLInputElement | null;

      if (imageInput) {
        imageInput.value = "";
      }

      await loadProduce();
    } catch (err) {
      console.error("Add produce error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save produce. Check your Flask backend."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      window.location.replace("/login");
    }
  }

  async function refreshProduce() {
    setError("");
    setMessage("");

    try {
      await loadProduce();
      setMessage("Produce listings refreshed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not refresh your produce listings."
      );
    }
  }

  const filteredProduce = produce.filter((item) => {
    const matchesCrop = (item.Crop_Name || "")
      .toLowerCase()
      .includes(cropFilter.toLowerCase());

    const matchesLocation = (item.Location || "")
      .toLowerCase()
      .includes(locationFilter.toLowerCase());

    const matchesGrade =
      gradeFilter === "" || item.Grade === gradeFilter;

    return matchesCrop && matchesLocation && matchesGrade;
  });

  const totalListings = produce.length;

  const totalQuantity = produce.reduce(
    (total, item) => total + Number(item.Quantity || 0),
    0
  );

  const cropTypes = new Set(produce.map((item) => item.Crop_Name)).size;

  if (loading) {
    return (
      <main className="center-page">
        <div className="loading-card">
          <span className="loading-icon">🌱</span>
          <p>Checking your account and loading your dashboard...</p>
        </div>

        <style jsx>{`
          .center-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            box-sizing: border-box;
            background-color: #e8f1e5;
            background-image:
              linear-gradient(
                rgba(255, 255, 255, 0.25),
                rgba(255, 255, 255, 0.25)
              ),
              url("/agritrace-bg.png");
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            background-attachment: fixed;
            font-family: Arial, sans-serif;
            color: #245b32;
          }

          .loading-card {
            max-width: 440px;
            padding: 30px;
            border-radius: 16px;
            text-align: center;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 8px 30px #174d2115;
          }

          .loading-icon {
            font-size: 32px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">🌱 AgriTrace</div>
          <p className="brand-subtitle">
            Agriculture Supply Chain Traceability
          </p>
        </div>

        <div className="user-area">
          <span>Welcome, {farmer?.name || "Farmer"}</span>
          <button className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="welcome">
        <p className="eyebrow">FARMER DASHBOARD</p>
        <h1>Manage your produce</h1>
        <p className="welcome-text">
          Add your crops and manage your agricultural produce listings.
        </p>
      </section>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}

      <section className="stats">
        <article className="stat-card">
          <span className="stat-icon">📦</span>
          <p>My listings</p>
          <h2>{totalListings}</h2>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🌾</span>
          <p>Total quantity</p>
          <h2>{totalQuantity.toLocaleString()} kg</h2>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🌿</span>
          <p>Different crops</p>
          <h2>{cropTypes}</h2>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Add produce</h2>
            <p>Enter the details of your available produce.</p>
          </div>
        </div>

        <form onSubmit={handleAddProduce} className="produce-form">
          <div className="field">
            <label htmlFor="cropName">Crop name</label>
            <input
              id="cropName"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder="Example: Tomato"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="quantity">Quantity (kg)</label>
            <input
              id="quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Example: 100"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="price">Price per kg (₹)</label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Example: 25"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="grade">Quality grade</label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="location">Village / location</label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Example: Mandya"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="harvestDate">Harvest date</label>
            <input
              id="harvestDate"
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="availableFrom">Available from</label>
            <input
              id="availableFrom"
              type="date"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="cropImage">Crop image (optional)</label>
            <input
              id="cropImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;

                if (file && file.size > 5 * 1024 * 1024) {
                  setError("Please choose an image smaller than 5 MB.");
                  event.target.value = "";
                  setCropImage(null);
                  return;
                }

                setError("");
                setCropImage(file);
              }}
            />
            <p className="help-text">
              Choose a JPG, PNG, or WebP photo up to 5 MB.
            </p>
          </div>

          <div className="form-action">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "+ Add produce"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>My produce listings</h2>
            <p>Listings created by your farmer account.</p>
          </div>

          <button className="refresh-button" onClick={refreshProduce}>
            ↻ Refresh
          </button>
        </div>

        <div className="filters">
          <input
            aria-label="Filter by crop"
            placeholder="Search crop..."
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
          />

          <input
            aria-label="Filter by location"
            placeholder="Search location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />

          <select
            aria-label="Filter by grade"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="">All grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>

          <button
            className="refresh-button"
            onClick={() => {
              setCropFilter("");
              setLocationFilter("");
              setGradeFilter("");
            }}
          >
            Clear filters
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Crop</th>
                <th>Quantity</th>
                <th>Grade</th>
                <th>Price/kg</th>
                <th>Location</th>
                <th>Harvest date</th>
                <th>Available from</th>
              </tr>
            </thead>

            <tbody>
              {filteredProduce.map((item) => (
                <tr key={item.Produce_ID}>
                  <td className="crop-cell">{item.Crop_Name}</td>
                  <td>
                    {Number(item.Quantity).toLocaleString()} {item.Unit}
                  </td>
                  <td>
                    <span className="grade">
                      {item.Grade || "Not specified"}
                    </span>
                  </td>
                  <td>₹{Number(item.Price).toFixed(2)}</td>
                  <td>{item.Location || "—"}</td>
                  <td>{item.Harvest_Date || "—"}</td>
                  <td>{item.Available_From || "—"}</td>
                </tr>
              ))}

              {filteredProduce.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No produce found. Add produce or change your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        AgriTrace · Agriculture Supply Chain Traceability Platform
      </footer>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          color: #243729;
          font-family: Arial, sans-serif;
          background-color: #e8f1e5;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.30),
              rgba(255, 255, 255, 0.30)
            ),
            url("/agritrace-bg.png");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 6%;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid #e4ebe1;
        }

        .brand {
          color: #287a3e;
          font-size: 23px;
          font-weight: 800;
        }

        .brand-subtitle {
          margin: 5px 0 0;
          color: #748075;
          font-size: 12px;
        }

        .user-area {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 14px;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 11px 16px;
          cursor: pointer;
          font-weight: 700;
        }

        .logout-button,
        .refresh-button {
          color: #287a3e;
          background: #eaf4e9;
        }

        .welcome {
          padding: 38px 6% 24px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #34814a;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        h1 {
          margin: 0;
          font-size: clamp(27px, 4vw, 36px);
          color: #183b24;
        }

        .welcome-text {
          max-width: 650px;
          color: #526354;
          line-height: 1.6;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin: 0 6% 24px;
        }

        .stat-card,
        .panel {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e5ebe2;
          border-radius: 14px;
          box-shadow: 0 3px 12px #24372912;
        }

        .stat-card {
          padding: 22px;
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-card p {
          margin: 12px 0 6px;
          color: #657367;
          font-size: 14px;
        }

        .stat-card h2 {
          margin: 0;
          color: #245b32;
          font-size: 27px;
        }

        .panel {
          margin: 0 6% 24px;
          padding: 26px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .section-heading h2 {
          margin: 0 0 7px;
          color: #203b27;
          font-size: 21px;
        }

        .section-heading p {
          margin: 0;
          color: #657367;
          font-size: 14px;
          line-height: 1.5;
        }

        .produce-form {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        select {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #dbe4d9;
          border-radius: 8px;
          background: white;
          color: #243729;
          font-size: 14px;
        }

        input:focus,
        select:focus {
          outline: 2px solid #b4d9b8;
          border-color: #34814a;
        }

        .help-text {
          font-size: 12px;
          color: #657367;
          margin-top: 6px;
          line-height: 1.5;
        }

        .form-action {
          display: flex;
          align-items: end;
        }

        .form-action button {
          width: 100%;
          padding: 13px;
          background: #287a3e;
          color: white;
        }

        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .filters {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
          font-size: 13px;
        }

        th,
        td {
          padding: 15px 12px;
          text-align: left;
          border-bottom: 1px solid #edf0eb;
        }

        th {
          background: #f5f8f3;
          color: #526354;
          font-size: 12px;
        }

        .crop-cell {
          color: #287a3e;
          font-weight: 700;
        }

        .grade {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          background: #eaf4e9;
          color: #287a3e;
          font-weight: 700;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #657367;
        }

        .alert {
          margin: 0 6% 20px;
          padding: 13px 16px;
          border-radius: 8px;
          font-size: 14px;
          overflow-wrap: anywhere;
          background: rgba(255, 255, 255, 0.95);
        }

        .error {
          background: #fff0ef;
          color: #b42318;
        }

        .success {
          background: #eaf7ec;
          color: #246b35;
        }

        footer {
          padding: 18px;
          text-align: center;
          color: #344d38;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.75);
        }

        @media (max-width: 900px) {
          .produce-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .produce-form,
          .filters {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 18px;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}