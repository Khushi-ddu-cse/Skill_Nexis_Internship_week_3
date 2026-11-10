import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isRegister && form.name.trim().length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      if (isRegister) {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        });
      } else {
        await login({
          email: form.email.trim(),
          password: form.password
        });
      }
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <Link to="/" className="brand auth-brand">
          <span className="brand-mark">T</span>
          Taskflow
        </Link>

        <p className="eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</p>
        <h1>{isRegister ? "Create your account" : "Sign in to Taskflow"}</h1>
        <p className="muted">
          {isRegister
            ? "Organise your work and make every day productive."
            : "Log in to continue managing your tasks."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <label>
              Full name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {error && <div className="notice error" role="alert">{error}</div>}

          <button className="button primary full" disabled={loading}>
            {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
