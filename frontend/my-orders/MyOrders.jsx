import "./MyOrders.css";
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const stages = [
  "Placed",
  "Accepted",
  "Preparing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

function normalizeStatus(status = "") {
  const s = status.toLowerCase().replaceAll("_", " ");

  if (s.includes("deliver")) return s.includes("out for") ? "Out for Delivery" : "Delivered";
  if (s.includes("ship") || s.includes("dispatch")) return "Shipped";
  if (s.includes("prepar") || s.includes("process")) return "Preparing";
  if (s.includes("accept") || s.includes("confirm")) return "Accepted";
  if (s.includes("cancel") || s.includes("reject")) return "Cancelled";

  return "Placed";
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch(`${API}/my-orders`, {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Unable to load orders.");
        }

        setOrders(data.orders || data.Orders || []);
      } catch (err) {
        setError(err.message || "Could not load orders.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  if (loading) return <p>Loading your orders...</p>;

  if (error) {
    return (
      <div>
        <h2>My Orders</h2>
        <p>{error}</p>
        <p>Please log in again and refresh this page.</p>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div>
        <h2>My Orders</h2>
        <p>You have not placed any orders yet.</p>
      </div>
    );
  }

  return (
    <main className="my-orders">
      <h1>My Orders</h1>
      <p>Track your agricultural produce from order to delivery.</p>

      {orders.map((order, index) => {
        const status = normalizeStatus(
          order.Status || order.status || "Placed"
        );

        const currentStage = stages.indexOf(status);
        const cancelled = status === "Cancelled";

        const items =
          order.Items || order.items || order.Order_Items || [];

        return (
          <article className="order-card" key={order.Order_ID || order.order_id || index}>
            <div className="order-heading">
              <div>
                <h2>Order #{order.Order_ID || order.order_id || "—"}</h2>
                <p>
                  Placed on: {order.Order_Date
                    ? new Date(order.Order_Date).toLocaleDateString()
                    : "Date unavailable"}
                </p>
              </div>
              <strong className={`status ${cancelled ? "cancelled" : ""}`}>
                {status}
              </strong>
            </div>

            {items.length > 0 ? (
              items.map((item, i) => (
                <div className="order-item" key={item.Listing_ID || i}>
                  <div>
                    <h3>{item.Crop_Name || item.crop_name || "Produce"}</h3>
                    <p>Quantity: {item.Quantity ?? item.quantity ?? "—"} {item.Unit || item.unit || "units"}</p>
                    <p>Grade: {item.Grade || item.grade || "Not specified"}</p>
                    <p>Farmer: {item.Farmer_Name || item.farmer_name || "—"}</p>
                    <p>Location: {item.Location || item.location || "—"}</p>
                  </div>
                  <p>
                    ₹{Number(
                      item.Subtotal ?? item.subtotal ??
                      item.Total_Price ?? item.total_price ?? 0
                    ).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            ) : (
              <p>Order details are not available.</p>
            )}

            <h3>
              Total: ₹{Number(
                order.Total_Amount ?? order.total_amount ?? 0
              ).toLocaleString("en-IN")}
            </h3>

            <h3>Delivery progress</h3>

            {cancelled ? (
              <p>This order was cancelled or rejected. Contact the farmer for details.</p>
            ) : (
              <ol className="tracking">
                {stages.map((stage, i) => (
                  <li
                    key={stage}
                    className={i <= currentStage ? "completed" : ""}
                  >
                    <span className="tracking-dot">
                      {i < currentStage ? "✓" : i + 1}
                    </span>
                    <span>{stage}</span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        );
      })}
    </main>
  );
}
