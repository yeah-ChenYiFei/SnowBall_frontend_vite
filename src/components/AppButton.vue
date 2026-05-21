<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'default' | 'small'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    :type="type || 'submit'"
    class="app-btn"
    :class="[`btn-${variant || 'primary'}`, `btn-${size || 'default'}`]"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-serif);
  font-weight: 400;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all var(--transition-normal);
}

/* Sizes */
.btn-default {
  padding: 14px 24px;
  font-size: 16px;
}
.btn-small {
  padding: 8px 18px;
  font-size: 14px;
}

/* Primary */
.btn-primary {
  background: var(--color-primary-gradient);
  color: #fff;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

/* Secondary */
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg);
  border-color: var(--color-text-muted);
}

/* Danger */
.btn-danger {
  background: var(--color-surface);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}
.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-bg);
}

/* Disabled */
.app-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
