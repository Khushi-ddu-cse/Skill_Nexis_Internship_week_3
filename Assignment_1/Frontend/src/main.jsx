
import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import ReactDOM from "react-dom/client";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate
} from "react-router-dom";

import axios from "axios";
import "./style.css";

// ==========================================
// 1. API CONFIGURATION
// ==========================================

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
});

// Automatically attach JWT token to API requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("w3token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ==========================================
// 2. AUTHENTICATION CONTEXT
// ==========================================

const Auth = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("w3user") || "null")
  );

  const [loading, setLoading] = useState(
    Boolean(localStorage.getItem("w3token"))
  );

  // Verify the user's existing login session
  useEffect(() => {
    if (!localStorage.getItem("w3token")) return;

    API.get("/auth/me")
      .then((response) => {
        setUser(response.data.user);

        localStorage.setItem(
          "w3user",
          JSON.stringify(response.data.user)
        );
      })
      .catch(() => {
        localStorage.removeItem("w3token");
        localStorage.removeItem("w3user");

        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Handle login and registration
  async function authenticate(endpoint, payload) {
    const { data } = await API.post(
      `/auth/${endpoint}`,
      payload
    );

    localStorage.setItem("w3token", data.token);

    localStorage.setItem(
      "w3user",
      JSON.stringify(data.user)
    );

    setUser(data.user);
  }

  // Logout the current user
  function logout() {
    localStorage.removeItem("w3token");
    localStorage.removeItem("w3user");

    setUser(null);
  }

  return (
    <Auth.Provider
      value={{
        user,
        loading,
        login: (payload) =>
          authenticate("login", payload),
        register: (payload) =>
          authenticate("register", payload),
        logout
      }}
    >
      {children}
    </Auth.Provider>
  );
}

// Custom hook to access authentication context
const useAuth = () => useContext(Auth);

// ==========================================
// 3. PROTECTED ROUTE
// ==========================================

function Guard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="center">Loading session…</p>;
  }

  return user ? children : <Navigate to="/login" />;
}

// ==========================================
// 4. LOGIN AND REGISTRATION PAGE
// ==========================================

function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: ""
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");

    // Validate password confirmation
    if (
      mode === "register" &&
      form.password !== form.confirm
    ) {
      return setError("Passwords do not match.");
    }

    if (form.password.length < 6) {
      return setError(
        "Password must be at least 6 characters."
      );
    }

    try {
      setBusy(true);

      if (mode === "login") {
        await login({
          email: form.email,
          password: form.password
        });
      } else {
        await register({
          name: form.name,
          email: form.email,
          password: form.password
        });
      }

      navigate("/");
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "Request failed. Is the backend running?"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="authbox" onSubmit={submit}>
        <div className="logo">✓ TaskFlow</div>

        <small>ASSIGNMENT 1 · TO-DO APPLICATION</small>

        <h1>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h1>

        <p className="muted">
          {mode === "login"
            ? "Sign in to manage your tasks."
            : "Register to start organizing your work."}
        </p>

        {mode === "register" && (
          <label>
            Name

            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value
                })
              }
            />
          </label>
        )}

        <label>
          Email

          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({
                ...form,
                email: event.target.value
              })
            }
          />
        </label>

        <label>
          Password

          <input
            required
            type="password"
            minLength="6"
            value={form.password}
            onChange={(event) =>
              setForm({
                ...form,
                password: event.target.value
              })
            }
          />
        </label>

        {mode === "register" && (
          <label>
            Confirm password

            <input
              required
              type="password"
              value={form.confirm}
              onChange={(event) =>
                setForm({
                  ...form,
                  confirm: event.target.value
                })
              }
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <p className="switch">
          {mode === "login"
            ? "New here? "
            : "Already registered? "}

          <Link
            to={
              mode === "login"
                ? "/register"
                : "/login"
            }
          >
            {mode === "login"
              ? "Create an account"
              : "Sign in"}
          </Link>
        </p>
      </form>
    </div>
  );
}

// ==========================================
// 5. MAIN DASHBOARD / TO-DO APPLICATION
// ==========================================

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  const [edit, setEdit] = useState(null);

  const [status, setStatus] = useState("all");
  const [filterPriority, setFilterPriority] =
    useState("all");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Fetch tasks from the backend
  async function load() {
    try {
      const response = await API.get("/tasks");

      setTasks(response.data.tasks);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "Unable to load tasks."
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Apply search and filters
  const shown = tasks.filter((task) => {
    const matchesStatus =
      status === "all" || task.status === status;

    const matchesPriority =
      filterPriority === "all" ||
      task.priority === filterPriority;

    const matchesSearch =
      `${task.title} ${task.description}`
        .toLowerCase()
        .includes(search.toLowerCase());

    return (
      matchesStatus &&
      matchesPriority &&
      matchesSearch
    );
  });

  // Add a new task or update an existing task
  async function save(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        title,
        description,
        priority,
        dueDate: dueDate || null
      };

      if (edit) {
        await API.put(`/tasks/${edit}`, payload);
      } else {
        await API.post("/tasks", payload);
      }

      reset();
      load();
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "Could not save task."
      );
    }
  }

  // Reset task form
  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setEdit(null);
  }

  // Load selected task into the form
  function startEdit(task) {
    setEdit(task._id);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);

    setDueDate(
      task.dueDate
        ? task.dueDate.slice(0, 10)
        : ""
    );

    window.scrollTo(0, 0);
  }

  // Mark task as completed or pending
  async function toggle(task) {
    try {
      await API.put(`/tasks/${task._id}`, {
        status:
          task.status === "completed"
            ? "pending"
            : "completed"
      });

      load();
    } catch (error) {
      setError(error.message);
    }
  }

  // Delete a task
  async function remove(id) {
    if (window.confirm("Delete this task?")) {
      try {
        await API.delete(`/tasks/${id}`);
        load();
      } catch (error) {
        setError(
          error.response?.data?.message ||
          "Could not delete task."
        );
      }
    }
  }

  return (
    <div className="shell">

      {/* Header */}
      <header>
        <Link className="logo" to="/">
          ✓ TaskFlow
        </Link>

        <nav>
          <Link to="/">My Tasks</Link>
        </nav>

        <span>{user?.name}</span>

        <button
          className="light"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Log out
        </button>
      </header>

      <main>

        {/* Dashboard Introduction */}
        <section className="intro">
          <div>
            <small>YOUR WORKSPACE</small>

            <h1>
              Good to see you,{" "}
              {user?.name?.split(" ")[0]}.
            </h1>

            <p className="muted">
              Plan your work. Make steady progress.
            </p>
          </div>

          <div className="stat">
            <small>COMPLETED</small>

            <b>
              {
                tasks.filter(
                  (task) => task.status === "completed"
                ).length
              } / {tasks.length}
            </b>
          </div>
        </section>

        {/* Add or Edit Task */}
        <section className="panel">
          <small>
            {edit ? "EDIT TASK" : "QUICK CAPTURE"}
          </small>

          <h2>
            {edit ? "Update task" : "Add a new task"}
          </h2>

          <form className="taskform" onSubmit={save}>
            <label>
              Task title

              <input
                required
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="What needs to get done?"
              />
            </label>

            <label>
              Description

              <input
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Optional details"
              />
            </label>

            <label>
              Priority

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              Due date

              <input
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
              />
            </label>

            <div className="actions">
              <button>
                {edit ? "Save changes" : "Add task"}
              </button>

              {edit && (
                <button
                  type="button"
                  className="light"
                  onClick={reset}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {error && <p className="error">{error}</p>}
        </section>

        {/* Task List Heading */}
        <section className="listhead">
          <div>
            <small>STAY ON TRACK</small>

            <h2>Your tasks ({shown.length})</h2>
          </div>
        </section>

        {/* Search and Filters */}
        <div className="filters">
          <input
            placeholder="Search tasks…"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filterPriority}
            onChange={(event) =>
              setFilterPriority(event.target.value)
            }
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Display Tasks */}
        {shown.length === 0 ? (
          <div className="empty">
            No tasks found. Add a task above or adjust
            your filters.
          </div>
        ) : (
          shown.map((task) => (
            <article className="task" key={task._id}>
              <button
                className="check"
                onClick={() => toggle(task)}
              >
                {task.status === "completed" ? "✓" : ""}
              </button>

              <div className="tasktext">
                <b
                  className={
                    task.status === "completed"
                      ? "strike"
                      : ""
                  }
                >
                  {task.title}
                </b>

                <p>{task.description}</p>

                <small>
                  {task.status} · {task.priority} priority

                  {task.dueDate
                    ? ` · Due ${new Date(
                        task.dueDate
                      ).toLocaleDateString()}`
                    : ""}
                </small>
              </div>

              <button
                className="light"
                onClick={() => startEdit(task)}
              >
                Edit
              </button>

              <button
                className="light"
                onClick={() => remove(task._id)}
              >
                Delete
              </button>
            </article>
          ))
        )}

      </main>

      <footer>
        Assignment 1 · To-Do Application
      </footer>
    </div>
  );
}

// ==========================================
// 6. MAIN APPLICATION ROUTES
// ==========================================

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<AuthPage mode="login" />}
          />

          <Route
            path="/register"
            element={<AuthPage mode="register" />}
          />

          <Route
            path="/"
            element={
              <Guard>
                <Dashboard />
              </Guard>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ==========================================
// 7. RENDER APPLICATION
// ==========================================

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

