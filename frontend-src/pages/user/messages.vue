<template>
  <div class="space-y-4">
    <h2 class="text-sm text-white/70 font-medium">我的消息</h2>

    <div v-if="loading" class="text-center py-10 text-gray-500 text-sm">加载中...</div>

    <!-- 会话列表 -->
    <div v-else-if="!activeConv" class="space-y-2">
      <div v-if="conversations.length === 0" class="text-center py-10 text-gray-600 text-sm">
        <p class="text-2xl mb-2">📭</p>
        <p>暂无消息</p>
      </div>
      <div
        v-for="conv in conversations" :key="conv.userId"
        class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 cursor-pointer hover:bg-[#0D1328] transition"
        @click="openConversation(conv)"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold shrink-0">
            {{ (conv.username || '?')[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/70 font-medium">{{ conv.username }}</span>
              <span v-if="conv.unread > 0" class="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px]">{{ conv.unread }}</span>
            </div>
            <p class="text-[11px] text-gray-500 truncate mt-0.5">{{ conv.lastMessage }}</p>
          </div>
          <span class="text-[10px] text-gray-600 shrink-0">{{ formatTime(conv.lastTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 聊天详情 -->
    <div v-else class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl flex flex-col h-[500px]">
      <!-- 聊天头部 -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[#1A2240]">
        <button @click="activeConv = null" class="text-xs text-gray-500 hover:text-white cursor-pointer bg-transparent border-none">← 返回</button>
        <div class="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
          {{ (activeConv.username || '?')[0] }}
        </div>
        <span class="text-xs text-white/70">{{ activeConv.username }}</span>
      </div>

      <!-- 消息列表 -->
      <div ref="msgContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-for="msg in chatMessages" :key="msg.id" class="flex" :class="msg.fromUser.id === myId ? 'justify-end' : 'justify-start'">
          <div class="max-w-[70%]" :class="msg.fromUser.id === myId ? 'order-1' : 'order-1'">
            <div class="px-3 py-2 rounded-xl text-xs leading-relaxed"
              :class="msg.fromUser.id === myId
                ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm'
                : 'bg-[#1A2240]/60 text-white/70 rounded-bl-sm'">
              {{ msg.content }}
              <!-- 图片附件 -->
              <div v-if="msg.media" class="mt-2 space-y-1">
                <img v-for="(m, i) in parseMedia(msg.media)" :key="i" :src="m.url"
                  class="max-w-full rounded-lg cursor-pointer" @click="previewImg(m.url)" />
              </div>
            </div>
            <p class="text-[9px] text-gray-600 mt-1 px-1">{{ formatTime(msg.createdAt) }}</p>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="border-t border-[#1A2240] p-3">
        <div v-if="replyImages.length > 0" class="flex gap-1 mb-2">
          <div v-for="(url, i) in replyImages" :key="i" class="relative">
            <img :src="url" class="w-12 h-12 rounded object-cover border border-[#1A2240]" />
            <button @click="replyImages.splice(i, 1)" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/60 text-white text-[8px] flex items-center justify-center cursor-pointer border-none">✕</button>
          </div>
        </div>
        <div class="flex gap-2">
          <textarea v-model="replyText" placeholder="输入回复..."
            rows="1" class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/60 outline-none focus:border-blue-500/50 resize-none"
            @keydown.enter.ctrl="doReply" />
          <button @click="$refs.replyImgInput.click()"
            class="px-2 rounded-lg bg-[#0B1020] border border-[#1A2240] text-gray-400 hover:text-white cursor-pointer text-xs">📷</button>
          <button @click="doReply" :disabled="!replyText.trim() && replyImages.length === 0"
            class="px-4 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-medium disabled:opacity-30 cursor-pointer border-none">发送</button>
          <input ref="replyImgInput" type="file" accept="image/*" style="display:none" @change="uploadReplyImage" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const loading = ref(true)
const conversations = ref<any[]>([])
const activeConv = ref<any>(null)
const chatMessages = ref<any[]>([])
const replyText = ref('')
const replyImages = ref<string[]>([])
const myId = ref('')
const msgContainer = ref<HTMLElement | null>(null)

function authHeader() {
  const _gt = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }; const token = _gt()
  return { Authorization: `Bearer ${token}` }
}

async function fetchConversations() {
  try {
    const res = await fetch('/api/messages/conversations', { headers: authHeader() })
    const data = await res.json()
    conversations.value = data.conversations || []
    // 存 myId
    const u = localStorage.getItem('auth_user')
    if (u) myId.value = JSON.parse(u).id || ''
  } catch {}
  finally { loading.value = false }
}

async function openConversation(conv: any) {
  activeConv.value = conv
  try {
    const res = await fetch(`/api/messages/${conv.userId}?pageSize=50`, { headers: authHeader() })
    const data = await res.json()
    chatMessages.value = data.messages || []
    await nextTick()
    scrollToBottom()
  } catch {}
}

async function doReply() {
  if (!replyText.value.trim() && replyImages.value.length === 0) return
  const media = replyImages.value.length > 0
    ? JSON.stringify(replyImages.value.map(u => ({ type: 'image', url: u }))) : null

  try {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toId: activeConv.value.userId,
        content: replyText.value.trim(),
        media,
      }),
    })
    const data = await res.json()
    if (data.message) {
      chatMessages.value.push(data.message)
      replyText.value = ''
      replyImages.value = []
      await nextTick()
      scrollToBottom()
    }
  } catch {}
}

function parseMedia(media: string) {
  try { return JSON.parse(media) } catch { return [] }
}

function scrollToBottom() {
  if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight
}

function formatTime(t: string) {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function uploadReplyImage(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return
  const fd = new FormData()
  fd.append('file', input.files[0])
  try {
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    })
    const data = await res.json()
    if (data.url) replyImages.value.push(data.url)
  } catch {}
  input.value = ''
}

function previewImg(url: string) {
  if (typeof window !== 'undefined') window.open(url, '_blank')
}

onMounted(() => {
  fetchConversations()
})
</script>
