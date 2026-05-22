<script setup lang="ts">
const links = [
  { path: '/admin', label: '概览' },
  { path: '/admin/users', label: '用户' },
  { path: '/admin/articles', label: '文章' },
  { path: '/admin/worlds', label: '世界' },
]
</script>

<template>
  <nav class="admin-nav">
    <router-link
      v-for="l in links"
      :key="l.path"
      :to="l.path"
      class="admin-nav-link"
      exact-active-class="active"
    >{{ l.label }}</router-link>
  </nav>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8eaed;
}
.admin-nav-link {
  padding: 8px 18px;
  font-size: 14px;
  color: #5f6368;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.15s;
}
.admin-nav-link:hover {
  color: #1a73e8;
  background: #e8f0fe;
}
.admin-nav-link.active {
  color: #1a73e8;
  background: #e8f0fe;
  font-weight: 500;
}
</style>
