import React from 'react';

export class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null, errorInfo: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Caught render error:', error);
        console.error('[ErrorBoundary] Component stack:', info?.componentStack);
        this.setState({ errorInfo: info });
    }

    handleResetAndRelogin = () => {
        try {
            localStorage.removeItem('cpm_token');
            localStorage.removeItem('cpm_user');
            sessionStorage.clear();
        } catch {}
        window.location.href = '/login';
    };

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
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <div style={{ fontSize: '40px' }}>⚠️</div>
                    <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>
                        Something went wrong
                    </h1>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', maxWidth: '400px', margin: 0, lineHeight: 1.5 }}>
                        An error occurred while loading this view. You can reload the page or return to the login screen.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 22px',
                                background: '#10b981',
                                borderRadius: '12px',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            🔄 Reload Page
                        </button>
                        <button
                            onClick={this.handleResetAndRelogin}
                            style={{
                                padding: '10px 22px',
                                background: '#27272a',
                                borderRadius: '12px',
                                border: '1px solid #3f3f46',
                                color: '#e4e4e7',
                                fontWeight: 600,
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            🚪 Back to Login
                        </button>
                    </div>

                    {this.state.error && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: '12px',
                            maxWidth: '560px',
                            width: '100%',
                            textAlign: 'left'
                        }}>
                            <p style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'monospace', margin: 0, wordBreak: 'break-word' }}>
                                {String(this.state.error)}
                            </p>
                            {this.state.errorInfo?.componentStack && (
                                <pre style={{ fontSize: '10px', color: '#71717a', margin: '8px 0 0 0', overflowX: 'auto', maxHeight: '120px' }}>
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
