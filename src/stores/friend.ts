import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'
import type { Friend, FriendshipStatus } from '@/types'

export const useFriendStore = defineStore('friend', () => {
  const friends = ref<Friend[]>([])
  const pendingRequests = ref<Friend[]>([])
  const statusCache = ref<Map<number, FriendshipStatus>>(new Map())
  const loaded = ref(false)

  async function loadFriends() {
    try {
      const res = await http.get<Friend[]>('/friends')
      friends.value = res.data || []
    } catch { /* silent */ }
  }

  async function loadPendingRequests() {
    try {
      const res = await http.get<Friend[]>('/friends/pending')
      pendingRequests.value = res.data || []
    } catch { /* silent */ }
  }

  async function checkStatus(userId: number): Promise<FriendshipStatus> {
    try {
      const res = await http.get<FriendshipStatus>(`/friends/status/${userId}`)
      statusCache.value.set(userId, res.data)
      return res.data
    } catch {
      return { status: 'NONE' }
    }
  }

  async function sendRequest(friendId: number, source: string, sourceId?: number) {
    await http.post('/friends/request', { friendId, source, sourceId })
    statusCache.value.delete(friendId)
  }

  async function acceptRequest(friendshipId: number) {
    // Clear the requester's cached status before reloading
    const req = pendingRequests.value.find(r => r.id === friendshipId)
    if (req) statusCache.value.delete(req.userId)
    await http.put(`/friends/${friendshipId}/accept`)
    await Promise.all([loadFriends(), loadPendingRequests()])
  }

  async function rejectRequest(friendshipId: number) {
    const req = pendingRequests.value.find(r => r.id === friendshipId)
    if (req) statusCache.value.delete(req.userId)
    await http.put(`/friends/${friendshipId}/reject`)
    await loadPendingRequests()
  }

  async function unfriend(friendshipId: number) {
    // Clear the unfriended user's cached status
    const f = friends.value.find(fr => fr.id === friendshipId)
    if (f) statusCache.value.delete(f.userId)
    await http.delete(`/friends/${friendshipId}`)
    await loadFriends()
  }

  async function init() {
    if (!loaded.value) {
      loaded.value = true
      await Promise.all([loadFriends(), loadPendingRequests()])
    }
  }

  return {
    friends, pendingRequests, statusCache, loaded,
    loadFriends, loadPendingRequests, checkStatus, sendRequest,
    acceptRequest, rejectRequest, unfriend, init,
  }
})
