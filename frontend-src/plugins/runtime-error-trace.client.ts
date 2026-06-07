export default defineNuxtPlugin(() => {
  console.log('[PHASE2] runtime-error-trace plugin loaded')
  
  window.addEventListener('error', (e) => {
    console.error('[RUNTIME ERROR]', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[PROMISE REJECTION]', {
      message: e.reason?.message || String(e.reason),
      stack: e.reason?.stack
    })
  })
})
