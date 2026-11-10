import { useEffect, useMemo, useState } from "react";
import { api, useAuth } from "../context/AuthContext";

const emptyForm = {
  title: "", description: "", priority: "medium",
  category: "personal", dueDate: ""
};

const categoryLabels = {
  academic: "Academic", work: "Work", personal: "Personal", other: "Other"
};

function formatDate(value) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  return (
    <article className={`task-card ${task.completed ? "is-complete" : ""}`}>
      <button
        className={`complete-toggle ${task.completed ? "checked" : ""}`}
        onClick={() => onToggle(task)}
        type="button"
        aria-label={task.completed ? "Mark as pending" : "Mark as completed"}
      >
        {task.completed ? "✓" : ""}
      </button>
      <div className="task-content">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`priority ${task.priority}`}>{task.priority}</span>
        </div>
        {task.description && <p>{task.description}</p>}
        <div className="task-meta">
          <span className={`category ${task.category || "personal"}`}>
            {categoryLabels[task.category || "personal"]}
          </span>
          <span className="due-date">Due: {formatDate(task.dueDate)}</span>
        </div>
        <details className="task-details">
          <summary>Task details</summary>
          <p>Created: {formatDate(task.createdAt)}</p>
          <p>Last updated: {formatDate(task.updatedAt)}</p>
          <p>Status: {task.completed ? "Completed" : "Pending"}</p>
        </details>
        <div className="task-actions">
          <button type="button" onClick={() => onEdit(task)}>Edit</button>
          <button type="button" className="danger-link" onClick={() => onDelete(task._id)}>Delete</button>
        </div>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [view, setView] = useState("board");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get("/tasks");
      setTasks(response.data.tasks || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length
  };
  const progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  const filteredTasks = useMemo(() => {
    const result = tasks.filter((task) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !task.completed) ||
        (filter === "completed" && task.completed);
      const searchable = `${task.title} ${task.description || ""}`.toLowerCase();
      return matchesFilter && searchable.includes(search.toLowerCase());
    });

    return result.sort((a, b) => {
      if (sortBy === "priority") {
        const rank = { high: 3, medium: 2, low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      if (sortBy === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [tasks, filter, search, sortBy]);

  const boardColumns = [
    { id: "pending", title: "To Do", items: filteredTasks.filter((task) => !task.completed) },
    { id: "completed", title: "Completed", items: filteredTasks.filter((task) => task.completed) }
  ];

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        title: form.title.trim(),
        dueDate: form.dueDate || null
      };

      if (editingId) {
        const response = await api.put(`/tasks/${editingId}`, payload);
        setTasks((current) => current.map((task) =>
          task._id === editingId ? response.data.task : task
        ));
        setNotice("Task updated successfully.");
      } else {
        const response = await api.post("/tasks", payload);
        setTasks((current) => [response.data.task, ...current]);
        setNotice("Task created successfully.");
      }
      resetForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save task.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      category: task.category || "personal",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleComplete = async (task) => {
    try {
      const response = await api.put(`/tasks/${task._id}`, { completed: !task.completed });
      setTasks((current) => current.map((item) =>
        item._id === task._id ? response.data.task : item
      ));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update task status.");
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((current) => current.filter((task) => task._id !== taskId));
      if (editingId === taskId) resetForm();
      setNotice("Task deleted successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete task.");
    }
  };

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const calendarDays = Array.from({ length: monthEnd.getDate() }, (_, index) => index + 1);
  const firstWeekday = monthStart.getDay();
  const tasksForDay = (day) => tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due.getFullYear() === calendarMonth.getFullYear() &&
      due.getMonth() === calendarMonth.getMonth() &&
      due.getDate() === day;
  });

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/dashboard">
          <span className="brand-mark">T</span> Taskflow Pro
        </a>
        <div className="user-area">
          <span className="user-greeting">Hi, {user?.name || "there"}</span>
          <button className="button outline small" onClick={logout}>Log out</button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Plan clearly. Make progress.</h1>
          <p className="muted">Organise tasks by status, category, priority, and due date.</p>
        </div>
        <div className="date-chip">{new Date().toLocaleDateString(undefined, {
          weekday: "long", day: "numeric", month: "long"
        })}</div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span className="stat-label">Total tasks</span><strong>{stats.total}</strong></article>
        <article className="stat-card"><span className="stat-label">Pending</span><strong>{stats.pending}</strong></article>
        <article className="stat-card"><span className="stat-label">Completed</span><strong>{stats.completed}</strong></article>
      </section>

      <section className="panel progress-panel">
        <div className="progress-heading">
          <div><p className="eyebrow">OVERVIEW</p><h2>Completion progress</h2></div>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <p className="muted">{stats.completed} of {stats.total} tasks completed</p>
      </section>

      <section className="main-grid">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">{editingId ? "UPDATE TASK" : "TASK DETAILS"}</p><h2>{editingId ? "Edit your task" : "Create a task"}</h2></div>
            <span className="panel-number">01</span>
          </div>
          <form className="task-form" onSubmit={handleSubmit}>
            <label>Task title
              <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Complete assignment" maxLength={120} required />
            </label>
            <label>Description
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Add a few details (optional)" rows={3} maxLength={1000} />
            </label>
            <div className="form-row">
              <label>Priority
                <select name="priority" value={form.priority} onChange={handleChange}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </label>
              <label>Category
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="academic">Academic</option><option value="work">Work</option><option value="personal">Personal</option><option value="other">Other</option>
                </select>
              </label>
            </div>
            <label>Due date
              <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
            </label>
            {error && <div className="notice error" role="alert">{error}</div>}
            {notice && <div className="notice success" role="status">{notice}</div>}
            <div className="form-actions">
              <button className="button primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add task"}</button>
              {editingId && <button className="button outline" type="button" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="panel tasks-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">TASK MANAGEMENT</p><h2>Workspace</h2></div>
            <span className="task-count">{filteredTasks.length} shown</span>
          </div>
          <input className="search-input" type="search" placeholder="Search title or description..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="toolbar">
            <div className="filter-tabs">
              {["all", "pending", "completed"].map((item) => (
                <button key={item} className={`filter-tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)} type="button">
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <select className="sort-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort tasks">
              <option value="newest">Newest</option><option value="priority">Priority</option><option value="dueDate">Due date</option>
            </select>
          </div>
          <div className="view-tabs">
            <button className={view === "board" ? "selected" : ""} onClick={() => setView("board")} type="button">Kanban Board</button>
            <button className={view === "list" ? "selected" : ""} onClick={() => setView("list")} type="button">List View</button>
            <button className={view === "calendar" ? "selected" : ""} onClick={() => setView("calendar")} type="button">Calendar</button>
          </div>

          {loading ? <div className="empty-state">Loading your tasks...</div> : (
            <>
              {view === "board" && (
                <div className="kanban-grid">
                  {boardColumns.map((column) => (
                    <section className="kanban-column" key={column.id}>
                      <div className="kanban-title"><h3>{column.title}</h3><span>{column.items.length}</span></div>
                      {column.items.length === 0 ? <p className="column-empty">No tasks here yet.</p> :
                        column.items.map((task) => <TaskCard key={task._id} task={task} onToggle={toggleComplete} onEdit={startEditing} onDelete={deleteTask} />)}
                    </section>
                  ))}
                </div>
              )}
              {view === "list" && (
                <div className="task-list">
                  {filteredTasks.length === 0 ? <div className="empty-state">No tasks found.</div> :
                    filteredTasks.map((task) => <TaskCard key={task._id} task={task} onToggle={toggleComplete} onEdit={startEditing} onDelete={deleteTask} />)}
                </div>
              )}
              {view === "calendar" && (
                <div className="calendar">
                  <div className="calendar-heading">
                    <button className="button outline small" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>←</button>
                    <strong>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
                    <button className="button outline small" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>→</button>
                  </div>
                  <div className="calendar-grid">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
                    {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}
                    {calendarDays.map((day) => (
                      <div className="calendar-day" key={day}>
                        <strong>{day}</strong>
                        {tasksForDay(day).slice(0, 2).map((task) => <span className="calendar-task" title={task.title} key={task._id}>{task.title}</span>)}
                        {tasksForDay(day).length > 2 && <small>+{tasksForDay(day).length - 2} more</small>}
                      </div>
                    ))}
                  </div>
                  <p className="muted calendar-note">Only tasks with a due date appear on the calendar.</p>
                </div>
              )}
            </>
          )}
        </section>
      </section>
      <footer className="footer"><span>Taskflow Pro · Skill Nexis Week 3</span><span>React · Express · MongoDB</span></footer>
    </main>
  );
}
