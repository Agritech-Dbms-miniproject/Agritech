"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:5000/api";

type AccountRole = "farmer" | "buyer";

interface RegisterResponse {
  message?: string;
  status?: string;
  error?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("farmer");

  // UI states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  function validateForm(): string | null {
    if (!name.trim()) {
      return "Please enter your full name.";
    }

    if (!email.trim()) {
      return "Please enter your email address.";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      return "Please enter a valid email address.";
    }

    const cleanPhone = phone.replace(/[\s-]/g, "");

    if (cleanPhone && !/^\+?\d{10,15}$/.test(cleanPhone)) {
      return "Enter a valid phone number with 10 to 15 digits.";
    }

    if (!password) {
      return "Please create a password.";
    }

    if (password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    if (role !== "farmer" && role !== "buyer") {
      return "Please select a valid account type.";
    }

    return null;
  }

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setMessage("");
    setMessageType("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          role,
        }),
      });

      const result: RegisterResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setMessage(
          result.message ||
            result.error ||
            `Registration failed. Server returned ${response.status}.`
        );
        setMessageType("error");
        return;
      }

      setMessage(
        result.message ||
          "Registration successful! Redirecting to login..."
      );
      setMessageType("success");

      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (error) {
      console.error("Registration error:", error);

      setMessage(
        "Unable to connect to the server. Make sure the Flask backend is running."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        backgroundColor: "#e8f1e5",
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), url("/agritrace-bg.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm md:grid-cols-2">

        {/* Left information panel */}
        <section className="flex flex-col justify-center bg-gradient-to-br from-green-800 to-emerald-600 p-8 text-white md:p-10">
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-green-100">
              Agriculture Supply Chain
            </p>

            <h1 className="mt-5 text-4xl font-bold leading-tight">
              Grow better.
              <br />
              Trade smarter.
            </h1>

            <p className="mt-5 leading-7 text-green-50">
              Join a platform that connects farmers directly with
              buyers and makes agricultural procurement easier.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🌱</span>
              <div>
                <h2 className="font-semibold">For Farmers</h2>
                <p className="mt-1 text-sm text-green-50">
                  Manage your produce and list available crops.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🛒</span>
              <div>
                <h2 className="font-semibold">For Buyers</h2>
                <p className="mt-1 text-sm text-green-50">
                  Explore available crops and compare listings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <h2 className="font-semibold">Direct Connection</h2>
                <p className="mt-1 text-sm text-green-50">
                  Connect agricultural producers with potential buyers.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-10 text-sm text-green-100">
            Create your account and get started today.
          </p>
        </section>

        {/* Registration form */}
        <section className="p-6 sm:p-9 md:p-10">
          <div className="mb-7">
            <h2 className="text-3xl font-bold text-gray-900">
              Create Account
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Enter your details to register.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">

            {/* Full name */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Full Name *
              </label>

              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                maxLength={100}
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Email Address *
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                maxLength={254}
                required
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Phone Number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
                maxLength={20}
                disabled={loading}
              />

              <p className="mt-1 text-xs text-gray-500">
                Optional field.
              </p>
            </div>

            {/* Account role */}
            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Register As *
              </label>

              <select
                id="role"
                name="role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as AccountRole)
                }
                className={inputClass}
                required
                disabled={loading}
              >
                <option value="farmer">
                  Farmer — Sell agricultural produce
                </option>

                <option value="buyer">
                  Buyer — Browse available crops
                </option>
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Choose the account type you want to use.
              </p>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Password *
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className={`${inputClass} pr-20`}
                  minLength={8}
                  required
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-700 hover:text-green-900"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Use at least 8 characters.
              </p>
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Confirm Password *
              </label>

              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  className={`${inputClass} pr-20`}
                  required
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-700 hover:text-green-900"
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Success and error messages */}
            {message && (
              <div
                role={messageType === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`rounded-lg border p-3 text-sm ${
                  messageType === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-7 border-t border-gray-200 pt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-green-700 hover:text-green-900 hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">
            Agriculture Supply Chain Management Platform
          </p>
        </section>
      </div>
    </main>
  );
}