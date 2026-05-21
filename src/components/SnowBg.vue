<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const blobs = [
  { size: 180, left: 8,  delay: 0,   dur: 22, color: 'rgba(200,220,245,0.65)' },
  { size: 120, left: 22, delay: -5,  dur: 28, color: 'rgba(235,240,250,0.55)' },
  { size: 260, left: 38, delay: -8,  dur: 32, color: 'rgba(180,210,240,0.5)' },
  { size: 90,  left: 55, delay: -3,  dur: 20, color: 'rgba(220,230,248,0.6)' },
  { size: 200, left: 70, delay: -12, dur: 26, color: 'rgba(190,215,242,0.55)' },
  { size: 140, left: 85, delay: -6,  dur: 24, color: 'rgba(240,243,252,0.5)' },
  { size: 100, left: 15, delay: -14, dur: 18, color: 'rgba(210,225,246,0.6)' },
  { size: 230, left: 48, delay: -9,  dur: 30, color: 'rgba(175,205,238,0.45)' },
  { size: 160, left: 75, delay: -2,  dur: 21, color: 'rgba(225,235,250,0.55)' },
  { size: 110, left: 32, delay: -10, dur: 19, color: 'rgba(200,222,247,0.6)' },
  { size: 280, left: 62, delay: -16, dur: 34, color: 'rgba(185,212,242,0.4)' },
  { size: 70,  left: 92, delay: -4,  dur: 16, color: 'rgba(245,248,253,0.55)' },
  { size: 150, left: 42, delay: -7,  dur: 25, color: 'rgba(195,218,244,0.5)' },
  { size: 190, left: 80, delay: -15, dur: 27, color: 'rgba(230,238,251,0.5)' },
]

// ── Mouse interaction physics ──
const mouseX = ref(-9999)
const mouseY = ref(-9999)
const wrapperRefs = ref<(HTMLElement | null)[]>([])
const innerRefs = ref<(HTMLElement | null)[]>([])
const offsets: { x: number; y: number }[] = blobs.map(() => ({ x: 0, y: 0 }))

function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

let rafId = 0

function animate() {
  const mx = mouseX.value
  const my = mouseY.value

  for (let i = 0; i < blobs.length; i++) {
    const wrapper = wrapperRefs.value[i]
    const inner = innerRefs.value[i]
    if (!wrapper || !inner) continue

    const rect = wrapper.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const dx = cx - mx
    const dy = cy - my
    const dist = Math.sqrt(dx * dx + dy * dy)

    const radius = 140
    let targetX = 0
    let targetY = 0

    if (dist < radius && dist > 0.1) {
      // Repulsion strength: stronger when closer, with a gentle falloff curve
      const t = dist / radius
      const strength = (1 - t) * (1 - t) * 90 // quadratic falloff, max 90px
      targetX = (dx / dist) * strength
      targetY = (dy / dist) * strength
    }

    // Slow lerp toward target for leisurely drifting feel
    offsets[i].x += (targetX - offsets[i].x) * 0.035
    offsets[i].y += (targetY - offsets[i].y) * 0.035

    // Direct DOM write for 60fps — bypass Vue reactivity
    inner.style.transform = `translate(${offsets[i].x}px, ${offsets[i].y}px)`
  }

  rafId = requestAnimationFrame(animate)
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove, { passive: true })
  rafId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  cancelAnimationFrame(rafId)
})

function setWrapperRef(el: Element | null, i: number) {
  wrapperRefs.value[i] = el as HTMLElement | null
}

function setInnerRef(el: Element | null, i: number) {
  innerRefs.value[i] = el as HTMLElement | null
}
</script>

<template>
  <div class="snow-bg">
    <svg class="texture-svg">
      <defs>
        <filter id="crayon-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feComposite in="displaced" in2="SourceGraphic" operator="over" />
        </filter>
        <filter id="crayon-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="textured" />
        </filter>
      </defs>
    </svg>

    <div class="blobs-layer">
      <div
        v-for="(b, i) in blobs"
        :key="i"
        :ref="(el: any) => setWrapperRef(el as Element, i)"
        class="blob-wrapper"
        :style="{
          left: b.left + '%',
          animationDelay: b.delay + 's',
          animationDuration: b.dur + 's',
        }"
      >
        <div
          :ref="(el: any) => setInnerRef(el as Element, i)"
          class="blob"
          :style="{
            width: b.size + 'px',
            height: b.size + 'px',
            background: `radial-gradient(circle at 35% 35%, ${b.color} 0%, ${b.color} 30%, ${b.color.replace(/[\d.]+\)$/, '0.25)')} 55%, transparent 75%)`,
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.snow-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.texture-svg {
  position: absolute;
  width: 0;
  height: 0;
}

.blobs-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 80%, transparent 100%);
}

.blob-wrapper {
  position: absolute;
  top: -300px;
  animation: blob-fall linear infinite;
  /* wrapper handles CSS falling + swaying; inner handles mouse offset */
}

.blob {
  border-radius: 42% 56% 48% 52% / 44% 38% 54% 46%;
  filter: url(#crayon-filter) blur(2px);
  opacity: 0.8;
  will-change: transform;
}

.blob-wrapper:nth-child(odd) .blob {
  border-radius: 48% 40% 55% 45% / 50% 46% 42% 52%;
}

.blob-wrapper:nth-child(3n) .blob {
  border-radius: 52% 48% 40% 56% / 40% 54% 48% 44%;
}

.blob-wrapper:nth-child(3n+1) .blob {
  border-radius: 45% 52% 44% 50% / 52% 40% 50% 43%;
}

.blob-wrapper:nth-child(4n) .blob {
  border-radius: 50% 44% 52% 46% / 42% 50% 43% 54%;
}

@keyframes blob-fall {
  0% {
    transform: translateY(-300px) translateX(0) scale(1);
  }
  25% {
    transform: translateY(25vh) translateX(-15px) scale(1.02);
  }
  50% {
    transform: translateY(55vh) translateX(10px) scale(0.97);
  }
  75% {
    transform: translateY(80vh) translateX(-8px) scale(1.01);
  }
  100% {
    transform: translateY(120vh) translateX(5px) scale(0.96);
  }
}
</style>
