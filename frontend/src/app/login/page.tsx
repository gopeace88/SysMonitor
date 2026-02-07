"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        router.push("/dashboard");
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-sm-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sm-link tracking-wide">
            SysMonitor
          </h1>
          <p className="text-xs text-sm-text-dim mt-1">
            System Monitoring Dashboard
          </p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-6"
        >
          <h2 className="text-sm font-semibold text-sm-text mb-4">Sign In</h2>

          {error && (
            <div className="bg-sm-error/10 border border-sm-error/30 text-sm-error text-xs rounded px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-xs text-sm-text-dim mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-sm-bg border border-[#2d3a4f] rounded px-3 py-2 text-sm text-sm-text outline-none focus:border-sm-link transition-colors"
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-xs text-sm-text-dim mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-sm-bg border border-[#2d3a4f] rounded px-3 py-2 text-sm text-sm-text outline-none focus:border-sm-link transition-colors"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sm-link hover:bg-sm-link/80 text-white text-sm font-medium rounded py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-[10px] text-sm-text-dim mt-4">
          SysMonitor v1.0 &middot; Secure Connection
        </p>
      </div>
    </div>
  );
}
