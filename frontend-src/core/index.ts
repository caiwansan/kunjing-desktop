// core/index.ts — Public API (no Phase/stage/gov vocabulary)
export { projectKernel } from './identity/projectKernel'
export { timerRegistry, sseRegistry, abortRegistry } from './execution/lifecycle'
export { apiKernel, circuitBreaker } from './control'
export { apiPolicyEngine, runtimeGuard, autoHeal, requestPolicy } from './control/policy'
export { telemetry } from './control/telemetry'

export { runtimeHealthCheck } from './runtime'
