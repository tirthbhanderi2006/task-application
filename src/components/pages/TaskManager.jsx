import React, { useState, useEffect, useCallback } from 'react';
import ToastContainer from '../common/Toast';
import ConfirmModal from '../common/ConfirmModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TaskManager({ setAuth }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [lastSynced, setLastSynced] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date().toLocaleString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date().toLocaleString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtering & Search
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Toggling status state
  const [togglingTaskId, setTogglingTaskId] = useState(null);

  // Deletion modal state
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    taskId: null,
    taskTitle: '',
    isDeleting: false
  });

  const getHeaders = (extraHeaders = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...extraHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleUnauthorized = (status) => {
    if (status === 401) {
      localStorage.removeItem('token');
      if (setAuth) setAuth(false);
    }
  };

  // Toasts state
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', title = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    const newToast = { id, message, type, title };
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after 3.8s
    setTimeout(() => {
      removeToast(id);
    }, 3800);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  // Fetch all tasks from MongoDB backend
  const fetchTasks = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setFetchError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        headers: { Accept: 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : [];

      setTasks(list);
      setServerStatus('online');
      setLastSynced(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Fetch error:', err);
      setServerStatus('offline');
      setFetchError(err.message || 'Unable to connect to Node + MongoDB backend');
      if (isInitial) {
        addToast('Failed to connect to backend on port 5000', 'error', 'Connection Error');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // Create Task with Optimistic UI Update
  const handleCreateTask = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      addToast('Please enter a task title', 'warning', 'Validation');
      return;
    }

    // 1. Prepare optimistic task
    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      id: tempId,
      title: trimmedTitle,
      description: description.trim(),
      priority: priority,
      completed: false,
      createdAt: new Date().toISOString(),
      _isOptimistic: true // Optimistic flag
    };

    // 2. Optimistic UI update: immediately show task in state
    setTasks((prev) => [optimisticTask, ...prev]);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setIsSubmitting(true);

    addToast('Adding task...', 'info', 'Optimistic UI');

    try {
      // 3. Send API call to MongoDB
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: optimisticTask.title,
          description: optimisticTask.description,
          priority: optimisticTask.priority
        })
      });
      handleUnauthorized(res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to create task (HTTP ${res.status})`);
      }

      const createdTask = await res.json();
      const confirmedTask = createdTask.data || createdTask;

      // 4. Server confirmed: Replace temporary item with persisted MongoDB task
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId || t._id === tempId ? { ...confirmedTask, _isOptimistic: false } : t))
      );

      setServerStatus('online');
      setLastSynced(new Date().toLocaleTimeString());
      addToast(`Task "${confirmedTask.title}" saved to MongoDB!`, 'success', 'Task Created');
    } catch (err) {
      console.error('Create task error:', err);
      // 5. Rollback optimistic task on failure
      setTasks((prev) => prev.filter((t) => t.id !== tempId && t._id !== tempId));
      setTitle(optimisticTask.title);
      setDescription(optimisticTask.description);
      setPriority(optimisticTask.priority);
      addToast(err.message || 'Could not save task to database', 'error', 'Creation Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start inline editing
  const startEditing = (task) => {
    setEditingTaskId(task.id || task._id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority || 'medium');
  };

  // Cancel inline editing
  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditPriority('medium');
  };

  // Save updated task
  const handleUpdateTask = async (id, e) => {
    if (e) e.preventDefault();
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      addToast('Task title cannot be empty', 'warning', 'Validation');
      return;
    }

    setUpdatingTaskId(id);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          title: trimmedTitle,
          description: editDescription.trim(),
          priority: editPriority
        })
      });
      handleUnauthorized(res.status);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
      }

      const updatedData = await res.json();
      const updatedTask = updatedData.data || updatedData;

      setTasks((prev) =>
        prev.map((t) => ((t.id === id || t._id === id) ? { ...t, ...updatedTask } : t))
      );

      cancelEditing();
      setLastSynced(new Date().toLocaleTimeString());
      addToast('Task updated in MongoDB database!', 'success', 'Task Updated');
    } catch (err) {
      console.error('Update error:', err);
      addToast(`Update failed: ${err.message}`, 'error', 'Update Error');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Toggle completion status with loading state & rollback
  const handleToggleComplete = async (task) => {
    const taskId = task.id || task._id;
    const targetStatus = !task.completed;

    setTogglingTaskId(taskId);

    // Optimistic toggle
    setTasks((prev) =>
      prev.map((t) => ((t.id === taskId || t._id === taskId) ? { ...t, completed: targetStatus } : t))
    );

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        headers: getHeaders(),
        body: JSON.stringify({ completed: targetStatus })
      });
      handleUnauthorized(res.status);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      addToast(
        `Task marked as ${targetStatus ? 'Completed' : 'Pending'}!`,
        'success',
        'Status Updated'
      );
    } catch (err) {
      console.error('Toggle error:', err);
      // Rollback on error
      setTasks((prev) =>
        prev.map((t) => ((t.id === taskId || t._id === taskId) ? { ...t, completed: !targetStatus } : t))
      );
      addToast('Failed to update task status on server', 'error', 'Error');
    } finally {
      setTogglingTaskId(null);
    }
  };

  // Open confirmation modal for deletion
  const openDeleteModal = (task) => {
    setDeleteModalState({
      isOpen: true,
      taskId: task.id || task._id,
      taskTitle: task.title,
      isDeleting: false
    });
  };

  // Confirm delete handler
  const confirmDeleteTask = async () => {
    const { taskId, taskTitle } = deleteModalState;
    if (!taskId) return;

    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      handleUnauthorized(res.status);

      if (!res.ok) {
        throw new Error(`Failed to delete task (HTTP ${res.status})`);
      }

      // Remove from state
      setTasks((prev) => prev.filter((t) => t.id !== taskId && t._id !== taskId));
      setDeleteModalState({ isOpen: false, taskId: null, taskTitle: '', isDeleting: false });
      setLastSynced(new Date().toLocaleTimeString());
      addToast(`Task "${taskTitle}" deleted from MongoDB!`, 'success', 'Deleted');
    } catch (err) {
      console.error('Delete error:', err);
      addToast(`Delete failed: ${err.message}`, 'error', 'Delete Error');
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Filter and search tasks
  const filteredTasks = tasks.filter((t) => {
    // Status filter
    if (filter === 'pending' && t.completed) return false;
    if (filter === 'completed' && !t.completed) return false;

    // Priority filter
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = t.title?.toLowerCase().includes(q);
      const matchesDesc = t.description?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc) return false;
    }

    return true;
  });

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = totalCount - completedCount;

  return (
    <section className="task-manager-section" aria-label="Task Management System">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalState.isOpen}
        title="Delete Task from MongoDB"
        message="Are you sure you want to permanently remove this task? This change will be persisted in MongoDB."
        taskName={deleteModalState.taskTitle}
        isLoading={deleteModalState.isDeleting}
        onConfirm={confirmDeleteTask}
        onCancel={() =>
          !deleteModalState.isDeleting &&
          setDeleteModalState({ isOpen: false, taskId: null, taskTitle: '', isDeleting: false })
        }
      />

      {/* Page Header */}
      <div className="section-header">
        <div className="task-title-group">
          <h2>Task Management System</h2>
          <span className="task-practical-badge">Connected Node + MongoDB Backend</span>
        </div>
        <p className="subtitle">
          Full CRUD operations with Optimistic UI updates, MongoDB persistence, granular loading states, and live REST API integration.
        </p>
      </div>

      {/* Backend Status Bar */}
      <div className="task-status-bar">
        <div className="task-status-left">
          <div className={`status-indicator status-${serverStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              Backend: {serverStatus === 'online' ? 'Connected (Node + MongoDB : 5000)' : serverStatus === 'offline' ? 'Disconnected / Offline' : 'Connecting...'}
            </span>
          </div>
          <div className="system-live-clock">
            📅 🕒 <strong>{currentDateTime}</strong>
          </div>
          {lastSynced && (
            <span className="last-synced-time">
              Last synced: {lastSynced}
            </span>
          )}
        </div>

        <div className="task-status-actions">
          <button
            type="button"
            className="task-btn-secondary btn-sm"
            onClick={() => fetchTasks(true)}
            title="Refresh tasks from MongoDB"
            disabled={loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spinner-icon' : ''}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="task-stats-grid">
        <div className="task-stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{totalCount}</div>
          <div className="stat-sub">Persisted in MongoDB</div>
        </div>
        <div className="task-stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value stat-value-pending">{pendingCount}</div>
          <div className="stat-sub">In progress</div>
        </div>
        <div className="task-stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value stat-value-completed">{completedCount}</div>
          <div className="stat-sub">{totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% done` : '0% done'}</div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="task-grid">
        {/* Left Column: Create Task Card */}
        <div className="task-card task-card-create">
          <div className="card-header-flex">
            <h3>Create New Task</h3>
            <span className="card-subtitle-badge">Optimistic UI Enabled</span>
          </div>
          <p className="card-hint">
            Tasks appear instantly in the list before the server response confirms persistence.
          </p>

          <form onSubmit={handleCreateTask} className="task-form">
            <div className="task-form-group">
              <label htmlFor="task-title">
                Task Title <span className="required-star">*</span>
              </label>
              <input
                id="task-title"
                type="text"
                className="task-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement Optimistic UI"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-group">
              <label htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="task-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add optional task details, steps, or notes..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-group">
              <label htmlFor="task-priority">Priority Level</label>
              <select
                id="task-priority"
                className="task-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="high">🔴 High Priority</option>
              </select>
            </div>

            <button
              type="submit"
              className="task-btn-primary btn-block"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? (
                <span className="btn-spinner-content">
                  <span className="spinner-inline"></span> Creating Task...
                </span>
              ) : (
                '+ Create Task'
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Task List & Filtering */}
        <div className="task-card task-card-list">
          <div className="card-header-flex">
            <h3>Tasks from Database</h3>
            <span className="task-count-pill">{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</span>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="task-toolbar">
            <div className="task-search-wrapper">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="task-search-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  &times;
                </button>
              )}
            </div>

            <div className="task-filter-tabs">
              <button
                type="button"
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                onClick={() => setFilter('completed')}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>

          {/* List Content States */}
          {loading ? (
            <div className="task-loading-state">
              <div className="custom-spinner"></div>
              <p>Fetching tasks from MongoDB...</p>
            </div>
          ) : fetchError && tasks.length === 0 ? (
            <div className="task-error-state">
              <div className="error-icon-box">⚠️</div>
              <h4>Connection Error</h4>
              <p>{fetchError}</p>
              <p className="error-tip">Ensure backend is running: <code>npm run server</code> or <code>node backend/app.js</code></p>
              <button
                type="button"
                className="task-btn-primary"
                onClick={() => fetchTasks(true)}
              >
                Retry Connection
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="task-empty-state">
              <div className="empty-icon-box">📋</div>
              <h4>No tasks found</h4>
              <p>
                {searchQuery || filter !== 'all' || priorityFilter !== 'all'
                  ? 'No tasks match your active filter criteria.'
                  : 'Your task list is empty. Create your first task using the form on the left!'}
              </p>
            </div>
          ) : (
            <div className="task-items-container">
              {filteredTasks.map((t) => {
                const taskId = t.id || t._id;
                const isOptimistic = t._isOptimistic;
                const isEditing = editingTaskId === taskId;
                const isUpdating = updatingTaskId === taskId;
                const isToggling = togglingTaskId === taskId;

                return (
                  <div
                    key={taskId}
                    className={`task-item-card ${t.completed ? 'task-item-completed' : ''} ${isOptimistic ? 'task-item-optimistic' : ''}`}
                  >
                    {isEditing ? (
                      /* Inline Edit Mode */
                      <form onSubmit={(e) => handleUpdateTask(taskId, e)} className="task-edit-form">
                        <div className="edit-form-header">
                          <span className="task-mongo-id">ID: {taskId}</span>
                          <span className="editing-badge">Editing Task</span>
                        </div>

                        <div className="task-form-group">
                          <label>Title *</label>
                          <input
                            type="text"
                            className="task-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                            disabled={isUpdating}
                          />
                        </div>

                        <div className="task-form-group">
                          <label>Description</label>
                          <textarea
                            className="task-textarea"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            disabled={isUpdating}
                          />
                        </div>

                        <div className="task-form-group">
                          <label>Priority</label>
                          <select
                            className="task-select"
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            disabled={isUpdating}
                          >
                            <option value="low">🟢 Low</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="high">🔴 High</option>
                          </select>
                        </div>

                        <div className="edit-actions-row">
                          <button
                            type="submit"
                            className="task-btn-success"
                            disabled={isUpdating || !editTitle.trim()}
                          >
                            {isUpdating ? (
                              <span className="btn-spinner-content">
                                <span className="spinner-inline"></span> Saving...
                              </span>
                            ) : (
                              'Save Changes'
                            )}
                          </button>
                          <button
                            type="button"
                            className="task-btn-secondary"
                            onClick={cancelEditing}
                            disabled={isUpdating}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Display Mode */
                      <div className="task-item-layout">
                        <div className="task-item-left">
                          {/* Checkbox toggle */}
                          <button
                            type="button"
                            className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                            onClick={() => !isOptimistic && handleToggleComplete(t)}
                            disabled={isOptimistic || isToggling}
                            title={t.completed ? 'Mark as pending' : 'Mark as completed'}
                            aria-label={t.completed ? 'Mark as pending' : 'Mark as completed'}
                          >
                            {isToggling ? (
                              <span className="spinner-tiny"></span>
                            ) : t.completed ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : null}
                          </button>

                          <div className="task-item-details">
                            <div className="task-item-title-row">
                              <h4 className={`task-item-title ${t.completed ? 'strikethrough' : ''}`}>
                                {t.title}
                              </h4>
                              {isOptimistic && (
                                <span className="badge-optimistic">
                                  <span className="optimistic-pulse"></span> Syncing...
                                </span>
                              )}
                              <span className={`badge-status ${t.completed ? 'badge-completed' : 'badge-pending'}`}>
                                {t.completed ? 'Completed' : 'Pending'}
                              </span>
                              <span className={`badge-priority badge-priority-${t.priority || 'medium'}`}>
                                {t.priority ? t.priority.toUpperCase() : 'MEDIUM'}
                              </span>
                            </div>

                            {t.description && (
                              <p className="task-item-description">{t.description}</p>
                            )}

                            <div className="task-item-footer">
                              <span className="task-id-tag">
                                Mongo ID: <code>{isOptimistic ? 'syncing...' : taskId}</code>
                              </span>
                              {t.createdAt && (
                                <span className="task-date-tag">
                                  {new Date(t.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="task-item-actions">
                          <button
                            type="button"
                            onClick={() => startEditing(t)}
                            className="task-btn-secondary btn-sm"
                            disabled={isOptimistic}
                            title="Edit task"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(t)}
                            className="task-btn-danger btn-sm"
                            disabled={isOptimistic}
                            title="Delete task"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
