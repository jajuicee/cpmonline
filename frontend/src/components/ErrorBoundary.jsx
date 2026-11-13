import React from 'react';

export class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Caught render error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0d0f12',
                    color: '#fff',
                    gap: '16px',
                    padding: '24px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '36px' }}>⚠️</div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>
                        Something went wrong
                    </h1>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', maxWidth: '360px', margin: 0 }}>
                        Please refresh the page. If the problem persists, the server may still be starting up — wait a moment and try again.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 24px',
                            background: '#10b981',
                            borderRadius: '12px',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        🔄 Reload Page
                    </button>
                    {this.state.error && (
                        <p style={{ fontSize: '11px', color: '#52525b', maxWidth: '480px', wordBreak: 'break-word' }}>
                            {String(this.state.error)}
                        </p>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
