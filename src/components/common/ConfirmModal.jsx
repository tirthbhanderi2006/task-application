import React from 'react';

export default function ConfirmModal({ isOpen, title, message, taskName, onConfirm, onCancel, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="modal-icon-danger">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="modal-title">{title || 'Confirm Deletion'}</h3>
            <p className="modal-subtitle">This action cannot be undone.</p>
          </div>
        </div>

        <div className="modal-body">
          <p>{message || 'Are you sure you want to delete this task from the MongoDB database?'}</p>
          {taskName && (
            <div className="modal-highlight-box">
              <span className="modal-task-tag">Task:</span>
              <strong className="modal-task-title">{taskName}</strong>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="task-btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="task-btn-danger modal-confirm-btn"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="btn-spinner-content">
                <span className="spinner-inline"></span> Deleting...
              </span>
            ) : (
              'Yes, Delete Task'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
