<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { PublicChain } from '@/types'
import CreateChainModal from '@/components/CreateChainModal.vue'

const router = useRouter()
const userStore = useUserStore()

const chains = ref<PublicChain[]>([])
const isLoading = ref(false)
const showCreateModal = ref(false)

const loadChains = async () => {
  isLoading.value = true
  try {
    const res = await http.get<PublicChain[]>('/chains/public')
    chains.value = res.data || []
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

// Last 5 chains as "recent"
const recentChains = computed(() => {
  return [...chains.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
})

const goToChain = (id: number) => {
  router.push(`/wild/chains/${id}`)
}

const onChainCreated = (chain: PublicChain) => {
  chains.value.unshift(chain)
}

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString('zh-CN')
}

const statusLabel: Record<string, string> = {
  ONGOING: '进行中',
  FINISHED: '已完结',
}

onMounted(loadChains)
</script>

<template>
  <div class="chains-page">
    <!-- ===== LEFT: Chain List (2/3) ===== -->
    <div class="chains-left">
      <div class="section-header">
        <h2 class="section-title">接龙</h2>
        <span class="section-subtitle">公共故事接龙，人人皆可续写</span>
      </div>

      <div v-if="isLoading" class="loading-state">加载中...</div>

      <div v-else-if="chains.length === 0" class="empty-state">
        <div class="empty-icon">📖</div>
        <div class="empty-text">还没有公共接龙，点击右侧按钮发起第一个吧</div>
      </div>

      <div v-else class="chain-feed">
        <article
          v-for="chain in chains"
          :key="chain.id"
          class="chain-card"
          @click="goToChain(chain.id)"
        >
          <div class="chain-card-header">
            <span class="chain-badge">{{ statusLabel[chain.status] || chain.status }}</span>
            <span class="chain-segments">{{ chain.segmentCount }} 段</span>
          </div>
          <h3 class="chain-card-title">{{ chain.title }}</h3>
          <p v-if="chain.description" class="chain-card-desc">{{ chain.description }}</p>
          <p v-if="chain.firstSegmentBody" class="chain-card-preview">{{ chain.firstSegmentBody }}</p>
          <div class="chain-card-footer">
            <span class="chain-author">👤 {{ chain.creatorName || '匿名' }}</span>
            <div class="chain-meta">
              <span v-if="chain.deadline" class="chain-deadline">
                ⏰ {{ formatDate(chain.deadline) }} 截止
              </span>
              <span class="chain-date">{{ formatDate(chain.createdAt) }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <!-- ===== RIGHT: Sidebar (1/3) ===== -->
    <aside class="chains-right">
      <div class="sidebar-card">
        <h3 class="sidebar-title">最近接龙</h3>
        <div v-if="recentChains.length === 0" class="sidebar-empty">暂无接龙</div>
        <ul v-else class="recent-list">
          <li
            v-for="chain in recentChains"
            :key="'recent-' + chain.id"
            class="recent-item"
            @click="goToChain(chain.id)"
          >
            <span class="recent-title">{{ chain.title }}</span>
            <span class="recent-meta">{{ chain.segmentCount }}段 · {{ chain.creatorName }}</span>
          </li>
        </ul>

        <button
          v-if="userStore.isLogin()"
          class="btn-create-chain"
          @click="showCreateModal = true"
        >
          ✍️ 发布接龙
        </button>
        <div v-else class="login-hint">
          <router-link to="/login">登录</router-link> 后发布接龙
        </div>
      </div>
    </aside>

    <CreateChainModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onChainCreated"
    />
  </div>
</template>

<style scoped>
.chains-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 28px;
  align-items: start;
}

/* Left */
.chains-left { min-width: 0; }

.section-header {
  margin-bottom: 20px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #202124;
  margin: 0;
}
.section-subtitle {
  font-size: 13px;
  color: #999;
}

.loading-state { text-align: center; padding: 60px; color: #999; }
.empty-state {
  text-align: center; padding: 60px 20px; color: #999;
  background: #fff; border-radius: 12px;
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

/* Chain Cards */
.chain-feed { display: flex; flex-direction: column; gap: 16px; }

.chain-card {
  background: #fff; padding: 20px 24px; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #f1f3f4;
}
.chain-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08); border-color: #e8eaed;
}

.chain-card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.chain-badge {
  font-size: 12px; padding: 3px 10px; border-radius: 4px;
  background: #e6f4ea; color: #137333; font-weight: 500;
}
.chain-segments { font-size: 13px; color: #999; }

.chain-card-title {
  font-size: 17px; font-weight: 600; color: #202124;
  margin: 0 0 6px 0; line-height: 1.4;
}
.chain-card-desc {
  font-size: 13px; color: #5f6368; margin: 0 0 8px 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.chain-card-preview {
  font-size: 13px; color: #999; margin: 0 0 12px 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; font-style: italic;
}

.chain-card-footer {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px;
}
.chain-author { color: #5f6368; }
.chain-meta { display: flex; gap: 12px; }
.chain-deadline { color: #e37400; }
.chain-date { color: #999; }

/* Right */
.chains-right { position: sticky; top: 20px; }

.sidebar-card {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f1f3f4;
}
.sidebar-title { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 16px 0; }
.sidebar-empty { text-align: center; padding: 20px 0; color: #999; font-size: 13px; }

.recent-list { list-style: none; padding: 0; margin: 0 0 20px 0; }
.recent-item {
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
  border-bottom: 1px solid #f8f9fa; transition: background 0.15s;
}
.recent-item:hover { background: #f8f9fa; }
.recent-title { font-size: 14px; color: #202124; font-weight: 500; display: block; }
.recent-meta { font-size: 12px; color: #999; margin-top: 2px; display: block; }

.btn-create-chain {
  width: 100%; padding: 12px 0; background: #1a73e8; color: #fff;
  border: none; border-radius: 8px; font-size: 15px; font-weight: 500;
  cursor: pointer; transition: all 0.2s;
}
.btn-create-chain:hover {
  background: #1557b0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(26,115,232,0.3);
}
.login-hint { text-align: center; font-size: 13px; color: #999; padding: 12px 0 0; }
.login-hint a { color: #1a73e8; }

@media (max-width: 860px) {
  .chains-page { grid-template-columns: 1fr; padding: 16px; }
  .chains-right { position: static; }
}
</style>
