<script setup lang="ts">
import { ref, computed } from 'vue'
import ImageLightbox from './ImageLightbox.vue'

const props = defineProps<{
  images: string[]
  alt?: string
}>()

const currentIndex = ref(0)
const showLightbox = ref(false)
const hoverPrev = ref(false)
const hoverNext = ref(false)

function prev() {
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
}

function next() {
  currentIndex.value = (currentIndex.value + 1) % props.images.length
}

function goTo(idx: number) {
  currentIndex.value = idx
}

const hasMultiple = computed(() => props.images.length >= 2)
</script>

<template>
  <div class="gallery">
    <div class="gallery-main" @mouseenter="hoverPrev = true; hoverNext = true" @mouseleave="hoverPrev = false; hoverNext = false">
      <img
        :src="images[currentIndex]"
        :alt="alt || ''"
        class="gallery-img"
        @click="showLightbox = true"
      />
      <button
        v-if="hasMultiple"
        class="gallery-arrow gallery-prev"
        :class="{ visible: hoverPrev }"
        @click.stop="prev"
      >&#8249;</button>
      <button
        v-if="hasMultiple"
        class="gallery-arrow gallery-next"
        :class="{ visible: hoverNext }"
        @click.stop="next"
      >&#8250;</button>
    </div>
    <div v-if="hasMultiple" class="gallery-dots">
      <button
        v-for="(img, idx) in images"
        :key="idx"
        class="gallery-dot"
        :class="{ active: idx === currentIndex }"
        @click="goTo(idx)"
      />
    </div>
    <ImageLightbox :visible="showLightbox" :image-url="images[currentIndex]" @close="showLightbox = false" />
  </div>
</template>

<style scoped>
.gallery { display: flex; flex-direction: column; }
.gallery-main {
  position: relative; width: 100%; background: #f5f5f5;
  border-radius: 12px; overflow: hidden; cursor: pointer;
}
.gallery-img {
  width: 100%; max-height: 65vh; object-fit: contain; display: block;
}
.gallery-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(0,0,0,0.35); color: #fff;
  border: none; cursor: pointer; font-size: 28px;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.25s ease;
  line-height: 1;
}
.gallery-arrow.visible, .gallery-arrow:hover { opacity: 1; }
.gallery-arrow:hover { background: rgba(0,0,0,0.55); }
.gallery-prev { left: 12px; }
.gallery-next { right: 12px; }
.gallery-dots {
  display: flex; justify-content: center; gap: 8px; margin-top: 12px;
}
.gallery-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid #1a73e8; background: transparent;
  cursor: pointer; padding: 0; transition: background 0.2s;
}
.gallery-dot.active { background: #1a73e8; }
</style>
