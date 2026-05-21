<script setup lang="ts">
const model = defineModel<string>()

defineProps<{
  type?: string
  placeholder?: string
  required?: boolean
  autocomplete?: string
  id?: string
}>()
</script>

<template>
  <div class="input-group">
    <input
      :id="id"
      v-model="model"
      :type="type || 'text'"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :required="required"
    />
  </div>
</template>

<style scoped>
.input-group {
  width: 100%;
}

.input-group input {
  width: 100%;
  padding: 14px 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 300;
  color: var(--color-text);
  outline: none;
  box-sizing: border-box;
  transition: all var(--transition-normal);
}

.input-group input::placeholder {
  color: var(--color-text-muted);
  font-weight: 200;
}

.input-group input:focus {
  border-color: rgba(26, 115, 232, 0.5);
  background: var(--glass-bg-strong);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.08);
}
</style>
