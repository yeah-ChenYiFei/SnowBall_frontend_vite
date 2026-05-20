<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(defineProps<{
  username: string
  avatarUrl?: string | null
  size?: number
}>(), {
  size: 36,
})

const imgError = ref(false)

watch(() => props.avatarUrl, () => {
  imgError.value = false
})

function onImgError() {
  imgError.value = true
}

const initial = computed(() => {
  const name = props.username || ''
  return name.charAt(0)?.toUpperCase() || '?'
})

const showImg = computed(() => !!props.avatarUrl && !imgError.value)
</script>

<template>
  <div
    class="user-avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: (size * 0.42) + 'px' }"
  >
    <img
      v-if="showImg"
      :src="avatarUrl!"
      :alt="username"
      class="avatar-img"
      @error="onImgError"
    />
    <span v-else class="avatar-letter">{{ initial }}</span>
  </div>
</template>


<style scoped>
.user-avatar {
  border-radius: 50%;
  background: linear-gradient(135deg, #1a73e8, #4285f4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  line-height: 1;
}
</style>
