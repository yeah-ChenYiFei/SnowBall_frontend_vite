import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'
import type { Inspiration } from '@/types'

export const useInspirationStore = defineStore('inspiration', () => {
  const inspirations = ref<Inspiration[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const res = await http.get<Inspiration[]>('/inspirations')
      inspirations.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function add(content: string): Promise<Inspiration> {
    const res = await http.post<Inspiration>('/inspirations', { content })
    inspirations.value.unshift(res.data)
    return res.data
  }

  async function update(id: number, content: string) {
    const res = await http.put<Inspiration>(`/inspirations/${id}`, { content })
    const idx = inspirations.value.findIndex((i) => i.id === id)
    if (idx !== -1) inspirations.value[idx] = res.data
  }

  async function remove(id: number) {
    await http.delete(`/inspirations/${id}`)
    inspirations.value = inspirations.value.filter((i) => i.id !== id)
  }

  load()

  return { inspirations, loading, load, add, update, remove }
})
