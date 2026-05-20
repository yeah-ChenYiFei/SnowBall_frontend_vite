<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  visible: boolean
  imageUrl: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.visible, (val) => {
  if (val) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="lightbox-overlay" @click.self="emit('close')">
      <button class="lightbox-close" @click="emit('close')">&times;</button>
      <img :src="imageUrl" class="lightbox-img" />
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.9);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.lightbox-close {
  position: absolute; top: 20px; right: 30px;
  background: none; border: none; color: #fff; font-size: 40px;
  cursor: pointer; z-index: 1; line-height: 1;
}
.lightbox-img {
  max-width: 90vw; max-height: 90vh;
  object-fit: contain; border-radius: 4px;
}
</style>
