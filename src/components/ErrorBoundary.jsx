import React from 'react';

/**
 * Detect WebGL support. Returns true if a WebGL context can be created.
 */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/**
 * ErrorBoundary — catches render-time errors (malformed data, runtime exceptions)
 * and detects WebGL support upfront. Falls back to a 2D view instead of
 * white-screening the entire app.
 *
 * Features:
 * - WebGL detection on mount: skips straight to fallback if unsupported (no retry)
 * - webglcontextlost handling: child components can call forceFallback()
 *   via the onContextLost prop to trigger fallback mid-session
 * - Retry button: only shown for recoverable errors (not WebGL absence)
 *
 * Usage:
 *   <ErrorBoundary fallback={<ComparePanel ... />} onContextLost={fn}>
 *     <Compare3DPanel ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      webglSupported: hasWebGL(),
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  /**
   * Called by child components when webglcontextlost fires.
   * Exposed via the onContextLost prop.
   */
  forceFallback = () => {
    this.setState({ hasError: true, error: new Error('WebGL context lost') });
  }

  retry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  }

  render() {
    const { hasError, webglSupported, retryCount } = this.state;
    const maxRetries = 2;

    // No WebGL: skip straight to fallback, no retry
    if (!webglSupported) {
      if (this.props.fallback) return this.props.fallback;
      return this._renderNoWebGL();
    }

    // Error during render
    if (hasError) {
      if (this.props.fallback) return this.props.fallback;
      // Only show retry for recoverable errors (not context loss or max retries hit)
      const canRetry = retryCount < maxRetries && !this.state.error?.message?.includes('context lost');
      return this._renderError(canRetry);
    }

    // Pass forceFallback to children so they can trigger it on webglcontextlost
    return React.Children.map(this.props.children, child => {
      if (React.isValidElement(child) && this.props.onContextLost) {
        return React.cloneElement(child, { onContextLost: this.forceFallback });
      }
      return child;
    });
  }

  _renderNoWebGL() {
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
        <div style={{ fontSize: 32 }}>🖥️</div>
        <h3 style={{ color: '#d8d8db', margin: 0 }}>WebGL not available</h3>
        <p style={{ maxWidth: 400, lineHeight: 1.5, margin: 0 }}>
          Your browser doesn't support WebGL, which is required for 3D views.
          Switch to <strong>2D Compare</strong> or <strong>Map</strong> mode instead.
        </p>
      </div>
    );
  }

  _renderError(canRetry) {
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
          The 3D renderer encountered an error. Try switching to <strong>2D Compare</strong> mode.
        </p>
        {canRetry && (
          <button
            onClick={this.retry}
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
        )}
      </div>
    );
  }
}
