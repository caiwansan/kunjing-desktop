<template>
  <div>
    <slot />
    <!-- 智能客服 - 全局可见 -->
    <ClientOnly>
      <CustomerService />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import CustomerService from '~/components/customer/CustomerService.vue'
</script>
