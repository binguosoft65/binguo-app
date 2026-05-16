// Lightweight client-side error capture.
//
// This is the minimal viable error-monitoring layer. It logs uncaught
// errors and promise rejections to the console so they are visible in
// the browser and in any session-replay/console-capture tool. When a
// hosted error monitor is provisioned (Sentry free tier — see
// TOOLS.md > Code & Build > Error monitoring), forward these events to
// it from the single place below instead of scattering SDK calls.

export function initErrorReporter(): void {
  window.addEventListener('error', (event) => {
    report('error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    report('unhandledrejection', { reason: String(event.reason) })
  })
}

function report(kind: string, detail: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(`[binguo:${kind}]`, detail)
}
