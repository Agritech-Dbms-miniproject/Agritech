
"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = "http://localhost:5000/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.message ||
            "Login failed. Check your email and password."
        );
        return;
      }

      console.log("Login response:", result);

      const role = (
        result.user?.role ??
        result.user?.account_type ??
        result.user?.Account_Type ??
        result.role ??
        result.account_type ??
        result.farmer?.role ??
        result.farmer?.account_type ??
        result.farmer?.Account_Type ??
        "farmer"
      )
        .toString()
        .trim()
        .toLowerCase();

      if (role === "buyer") {
        window.location.assign("/marketplace");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);

      setMessage(
        "Cannot connect to the server. Check that Flask is running at localhost:5000."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">🌱 AgriTrace</div>

        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Log in to manage your agricultural produce.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email address</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {message && (
            <p className="auth-message" role="alert">
              {message}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link href="/register">Register here</Link>
        </p>
      </section>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;

          background-color: #e8f1e5;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.12),
              rgba(255, 255, 255, 0.12)
            ),
            url("/agritrace-bg.png");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;

          font-family: Arial, sans-serif;
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 36px;
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.94);
          border-radius: 18px;
          box-shadow: 0 8px 30px rgba(23, 77, 33, 0.2);
          backdrop-filter: blur(4px);
        }

        .auth-brand {
          color: #24733b;
          font-weight: bold;
          font-size: 22px;
          margin-bottom: 24px;
        }

        h1 {
          margin: 0 0 8px;
          color: #183b24;
        }

        .auth-subtitle {
          color: #68766b;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        label {
          display: block;
          margin: 18px 0 8px;
          color: #293b2d;
          font-weight: 600;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 13px;
          border: 1px solid #d6e1d7;
          border-radius: 8px;
          font-size: 15px;
          background: #fff;
          color: #183b24;
        }

        input:focus {
          outline: 2px solid #a6d6b0;
          border-color: #31864a;
        }

        button {
          width: 100%;
          padding: 14px;
          margin-top: 22px;
          border: 0;
          border-radius: 8px;
          background: #287a3e;
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        }

        button:hover:not(:disabled) {
          background: #206532;
        }

        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .auth-message {
          color: #b42318;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          color: #657268;
          font-size: 14px;
        }

        .auth-footer a {
          color: #287a3e;
          font-weight: bold;
        }

        @media (max-width: 480px) {
          .auth-page {
            padding: 16px;
            background-attachment: scroll;
          }

          .auth-card {
            padding: 26px 22px;
          }
        }
      `}</style>
    </main>
  );
}
