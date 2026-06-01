import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackLabel?: string },
  State
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-red-50 border border-red-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl font-bold">!</div>
              <div>
                <h2 className="text-lg font-bold text-red-800">
                  {this.props.fallbackLabel || 'Erreur dans cette page'}
                </h2>
                <p className="text-sm text-red-600">
                  {this.state.error?.message || "Une erreur inattendue s'est produite."}
                </p>
              </div>
            </div>
            {this.state.error?.stack && (
              <details className="text-xs text-red-700 bg-red-100 rounded p-3 overflow-auto max-h-48">
                <summary className="cursor-pointer font-medium mb-1">Details techniques</summary>
                <pre className="whitespace-pre-wrap mt-2">{this.state.error.stack}</pre>
                {this.state.errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap mt-2 border-t border-red-200 pt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Reessayer
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
