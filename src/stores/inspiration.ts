import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Inspiration } from '@/types'

const STORAGE_KEY = 'snowball_inspirations'

export const useInspirationStore = defineStore('inspiration', () => {
  const inspirations = ref<Inspiration[]>([])

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) inspirations.value = JSON.parse(raw)
    } catch { /* corrupted data, ignore */ }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inspirations.value))
  }

  function add(content: string): Inspiration {
    const now = new Date().toISOString()
    const insp: Inspiration = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      content,
      createdAt: now,
      updatedAt: now,
    }
    inspirations.value.unshift(insp)
    persist()
    return insp
  }

  function update(id: string, content: string) {
    const item = inspirations.value.find((i) => i.id === id)
    if (item) {
      item.content = content
      item.updatedAt = new Date().toISOString()
      persist()
    }
  }

  function remove(id: string) {
    inspirations.value = inspirations.value.filter((i) => i.id !== id)
    persist()
  }

  load()

  return { inspirations, load, add, update, remove }
})
