import React from 'react';

/**
 * ErrorBoundary — catches render-time errors (WebGL context loss,
 * malformed data, unsupported browser) and shows a fallback UI
 * instead of white-screening the entire app.
 *
 * Usage:
 *   <ErrorBoundary fallback={<ComparePanel ... />}>
 *     <Compare3DPanel ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render the fallback (e.g. 2D compare) if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // Default fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          color: '#8a8a90',
          textAlign: 'center',
          padding: 40,
          gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h3 style={{ color: '#d8d8db', margin: 0 }}>3D view unavailable</h3>
          <p style={{ maxWidth: 400, lineHeight: 1.5, margin: 0 }}>
            Your browser may not support WebGL, or the 3D renderer encountered an error.
            Try switching to <strong>2D Compare</strong> mode instead.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#1a1a1e',
              border: '1px solid #2a2a2e',
              color: '#d8d8db',
              padding: '8px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Try 3D again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
