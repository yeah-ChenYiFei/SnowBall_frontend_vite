<!-- src/comments/TagInput.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: string[] // v-model 绑定的标签数组
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const inputVal = ref('')

const handleAdd = () => {
  const tag = inputVal.value.trim()
  if (tag && !props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag])
  }
  inputVal.value = ''
}

const handleRemove = (index: number) => {
  const newTags = [...props.modelValue]
  newTags.splice(index, 1)
  emit('update:modelValue', newTags)
}
</script>

<template>
  <div class="tag-input-container">
    <div class="tags-display">
      <span v-for="(tag, index) in modelValue" :key="tag" class="tag-item">
        {{ tag }}
        <button class="tag-remove" @click="handleRemove(index)">×</button>
      </span>
      <input
        v-model="inputVal"
        type="text"
        placeholder="输入标签后按回车添加"
        class="tag-input-field"
        @keyup.enter="handleAdd"
      />
    </div>
  </div>
</template>

<style scoped>
.tag-input-container {
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff;
  transition: border-color 0.2s;
}
.tag-input-container:focus-within {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}
.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  align-items: center;
}
.tag-item {
  background: #e8f0fe;
  color: #1a73e8;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tag-remove {
  background: none;
  border: none;
  color: #1a73e8;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  margin-left: 2px;
}
.tag-remove:hover {
  color: #d93025;
}
.tag-input-field {
  border: none;
  outline: none;
  flex: 1;
  min-width: 120px;
  font-size: 14px;
  padding: 4px 0;
}
</style>
