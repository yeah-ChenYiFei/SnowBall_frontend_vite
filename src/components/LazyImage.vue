<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  fallback?: string
}>(), {
  alt: '',
  fallback: '',
})

const isLoaded = ref(false)
const isError = ref(false)
const isInView = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          isInView.value = true
          observer?.disconnect()
          break
        }
      }
    },
    {
      rootMargin: '200px',
      threshold: 0.01,
    },
  )
  if (containerRef.value) observer.observe(containerRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
})

function onLoad() {
  isLoaded.value = true
}

function onError() {
  isError.value = true
  isLoaded.value = true
  if (props.fallback && imgRef.value) {
    imgRef.value.src = props.fallback
  }
}
</script>

<template>
  <div ref="containerRef" class="lazy-img-container">
    <!-- Skeleton placeholder -->
    <div v-if="!isLoaded" class="lazy-skeleton"></div>

    <!-- Actual image loaded when visible -->
    <img
      v-if="isInView"
      ref="imgRef"
      :src="isError && fallback ? fallback : src"
      :alt="alt"
      :class="['lazy-img', { loaded: isLoaded, error: isError }]"
      loading="lazy"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.lazy-img-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f0f0f0;
}

.lazy-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.lazy-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.lazy-img.loaded {
  opacity: 1;
}

.lazy-img.error {
  object-fit: contain;
  background: #f5f5f5;
  padding: 16px;
  box-sizing: border-box;
}
</style>
