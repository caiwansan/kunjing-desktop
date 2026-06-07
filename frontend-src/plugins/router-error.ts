import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const router = nuxtApp.$router
  router.onError((err) => {
    console.error('[Router Error]', err)
  })
})
