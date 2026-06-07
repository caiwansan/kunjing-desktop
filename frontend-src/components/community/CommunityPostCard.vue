<template>
  <NuxtLink :to="`/community/post/${post.id}`" class="post-card">
    <div class="card-header">
      <span v-if="post.isPinned" class="pin-badge">📌 置顶</span>
      <span v-if="post.isEssence" class="essence-badge">⭐ 精华</span>
      <span class="category-tag">{{ post.category }}</span>
    </div>
    <h3 class="card-title">{{ post.title }}</h3>
    <p class="card-excerpt">{{ excerpt }}</p>
    <div v-if="tagList.length > 0" class="card-tags">
      <span v-for="tag in tagList" :key="tag" class="tag">{{ tag }}</span>
    </div>
    <div class="card-meta">
      <span class="meta-author">👤 {{ post.user?.username || '匿名' }}</span>
      <span class="meta-stat">👁️ {{ post.viewCount }}</span>
      <span class="meta-stat">👍 {{ post.likeCount }}</span>
      <span class="meta-stat">💬 {{ post.commentCount }}</span>
      <span class="meta-time">{{ timeAgo }}</span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  post: {
    id: string
    title: string
    content: string
    tags?: string
    category: string
    viewCount: number
    likeCount: number
    commentCount: number
    isPinned?: boolean
    isEssence?: boolean
    createdAt: string
    user?: {
      id: string
      username: string
    }
  }
}>()

const excerpt = computed(() => {
  const text = props.post.content?.replace(/<[^>]*>/g, '') || ''
  return text.length > 150 ? text.substring(0, 150) + '...' : text
})

const tagList = computed(() => {
  const tags = props.post.tags || ''
  return tags.split(',').map(t => t.trim()).filter(Boolean)
})

const timeAgo = computed(() => {
  const now = Date.now()
  const created = new Date(props.post.createdAt).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  return `${months}个月前`
})
</script>

<style scoped>
.post-card {
  display: block;
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  padding: 20px 24px;
  text-decoration: none;
  color: inherit;
  transition: all 0.25s;
}
.post-card:hover {
  border-color: rgba(249,115,22,0.25);
  background: rgba(249,115,22,0.02);
  transform: translateY(-2px);
}
.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.pin-badge, .essence-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.pin-badge {
  background: rgba(249,115,22,0.1);
  color: #f97316;
}
.essence-badge {
  background: rgba(250,204,21,0.1);
  color: #eab308;
}
.category-tag {
  font-size: 0.65rem;
  padding: 2px 10px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.4);
}
.card-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
  line-height: 1.4;
}
.card-excerpt {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.35);
  line-height: 1.6;
  margin-bottom: 12px;
}
.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tag {
  font-size: 0.65rem;
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.3);
}
.card-meta {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.25);
  flex-wrap: wrap;
}
.meta-author {
  color: rgba(249,115,22,0.6);
}
.meta-time {
  margin-left: auto;
}
</style>
