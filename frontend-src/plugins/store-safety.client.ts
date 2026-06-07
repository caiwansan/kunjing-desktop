export default defineNuxtPlugin(() => {
  try {
    console.log('[store safety] plugin init ok')
  } catch (e) {
    console.error('[STORE CRASH]', e)
  }
})
