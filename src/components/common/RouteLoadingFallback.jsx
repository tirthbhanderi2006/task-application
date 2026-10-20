import React from 'react';

/**
 * RouteLoadingFallback Component
 * Displayed as a Suspense fallback UI while lazy-loaded route chunks are fetched.
 * Provides a spinner, loading indicator, and skeleton preview to avoid layout shifts.
 */
export default function RouteLoadingFallback({ message = 'Loading page component...' }) {
  return (
    <div className="route-fallback-container" role="status" aria-live="polite" aria-busy="true">
      <div className="route-fallback-top-bar" />
      <div className="route-fallback-content">
        <div className="route-fallback-spinner">
          <div className="spinner-ring">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
        <div className="route-fallback-text-group">
          <h3 className="route-fallback-title">Loading Page</h3>
          <p className="route-fallback-subtitle">{message}</p>
        </div>

        {/* Skeleton content preview to minimize cumulative layout shift (CLS) */}
        <div className="route-fallback-skeleton" aria-hidden="true">
          <div className="skeleton-line skeleton-title-bar"></div>
          <div className="skeleton-line skeleton-subtitle-bar"></div>
          <div className="skeleton-grid">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
