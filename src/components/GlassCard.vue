<script setup lang="ts">
defineProps<{
  elevated?: boolean
}>()
</script>

<template>
  <div class="glass-card" :class="{ elevated }">
    <slot />
  </div>
</template>

<style scoped>
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--glass-shadow);
  transition: box-shadow var(--transition-normal);
}

.glass-card.elevated {
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur-heavy);
  box-shadow: var(--glass-shadow-hover);
}
</style>
