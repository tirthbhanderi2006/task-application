import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TaskManager({ setAuth }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // State for updating a task
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const handleUnauthorized = (status) => {
    if (status === 401) {
      localStorage.removeItem('token');
      if (setAuth) setAuth(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, { headers: getHeaders() });
      handleUnauthorized(res.status);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
      setTasks(list);
      setServerStatus('online');
    } catch (err) {
      setServerStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Create Task (POST /api/tasks)
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title, description })
      });
      handleUnauthorized(res.status);
      if (res.ok) {
        setTitle('');
        setDescription('');
        fetchTasks();
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  // Start Editing
  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
  };

  // Cancel Editing
  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
  };

  // Save Updated Task (PUT /api/tasks/:id)
  const handleUpdateTask = async (id, e) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          title: editTitle,
          description: editDescription
        })
      });
      handleUnauthorized(res.status);
      if (res.ok) {
        cancelEditing();
        fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // Toggle Completion (PUT /api/tasks/:id)
  const handleToggleComplete = async (id, currentCompleted) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ completed: !currentCompleted })
      });
      handleUnauthorized(res.status);
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling completion:', err);
    }
  };

  // Delete Task (DELETE /api/tasks/:id)
  const handleDeleteTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      handleUnauthorized(res.status);
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  return (
    <section className="task-manager-section">
      <div className="section-header">
        <h2>Task Management System</h2>
        <p className="subtitle">
          Manage your tasks with Node/Express REST API backend
        </p>
      </div>

      <div className="task-manager-header">
        <div></div>
        <div className="task-status-badge">
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: serverStatus === 'online' ? 'var(--primary)' : serverStatus === 'offline' ? '#ef4444' : '#f59e0b'
          }}></span>
          <span>Backend: {serverStatus === 'online' ? 'Online (Port 5000)' : serverStatus === 'offline' ? 'Offline (Run `npm run server`)' : 'Checking...'}</span>
        </div>
      </div>

      <div className="task-grid">
        {/* Left Column: Create Task Form */}
        <div className="task-card">
          <h3>Create Task</h3>
          <form onSubmit={handleCreateTask}>
            <div className="task-form-group">
              <label>Task Title *</label>
              <input
                type="text"
                className="task-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                required
              />
            </div>

            <div className="task-form-group">
              <label>Description</label>
              <textarea
                className="task-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task details..."
                rows={4}
              />
            </div>

            <button type="submit" className="task-btn-primary">
              + Create Task
            </button>
          </form>
        </div>

        {/* Right Column: Tasks List */}
        <div className="task-card">
          <h3>Tasks ({tasks.length})</h3>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No tasks found. Create one using the form.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tasks.map(t => (
                <div key={t.id} className="task-item-card">
                  {editingTaskId === t.id ? (
                    /* Edit Form Mode */
                    <form onSubmit={(e) => handleUpdateTask(t.id, e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }} title={`ID: ${t.id}`}>#{t.id.slice(-5)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>EDIT TASK</span>
                      </div>
                      <input
                        type="text"
                        className="task-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Task title..."
                        required
                      />
                      <textarea
                        className="task-textarea"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Task description..."
                        rows={2}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <button type="submit" className="task-btn-success">
                          Save Changes
                        </button>
                        <button type="button" onClick={cancelEditing} className="task-btn-secondary">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Normal Display Mode */
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)' }} title={`ID: ${t.id}`}>#{t.id.slice(-5)}</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{t.title}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: t.completed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: t.completed ? '#10b981' : '#f59e0b',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}>
                            {t.completed ? 'COMPLETED' : 'PENDING'}
                          </span>
                        </div>
                        {t.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t.description}</p>}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button onClick={() => startEditing(t)} className="task-btn-secondary">
                          Edit
                        </button>
                        <button onClick={() => handleToggleComplete(t.id, t.completed)} className="task-btn-secondary">
                          {t.completed ? 'Mark Pending' : 'Mark Done'}
                        </button>
                        <button onClick={() => handleDeleteTask(t.id)} className="task-btn-danger">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
