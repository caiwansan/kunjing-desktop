<template>
  <div class="fixed bottom-6 right-6 z-50">
    <!-- 悬浮按钮 -->
    <button
      v-if="!showChat"
      @click="openChat"
      class="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300 group"
    >
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
      </svg>
      <span class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0B1020]"></span>
    </button>

    <!-- 聊天窗口 -->
    <div
      v-if="showChat"
      class="w-80 sm:w-96 bg-[#141829] border border-[#1e2a4a] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
    >
      <!-- 头部 -->
      <div class="bg-gradient-to-r from-blue-600 to-cyan-500 p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
            🐲
          </div>
          <div>
            <div class="text-white font-semibold text-sm">小麒</div>
            <div class="text-white/60 text-xs flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>在线</span>
            </div>
          </div>
        </div>
        <button @click="closeChat" class="text-white/60 hover:text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 消息列表 -->
      <div ref="msgContainer" class="h-96 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        <!-- 欢迎消息 -->
        <div class="flex gap-2">
          <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm shrink-0">
            🐲
          </div>
          <div class="bg-[#1a2040] text-gray-200 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] text-sm leading-relaxed">
            嗨！我是小麒~ 🐲 有什么需要帮忙的尽管说！
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-for="(msg, i) in messages" :key="i" class="flex gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
            :class="msg.role === 'user' ? 'bg-purple-500/20' : 'bg-blue-500/20'"
          >
            {{ msg.role === 'user' ? '👤' : '🐲' }}
          </div>
          <div
            class="rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed"
            :class="msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-[#1a2040] text-gray-200 rounded-tl-sm'"
          >
            <div class="whitespace-pre-wrap">{{ msg.content }}</div>
            <div v-if="msg.thinking" class="text-gray-500 text-xs mt-1">思考中...</div>
          </div>
        </div>

        <!-- 正在输入 -->
        <div v-if="isThinking" class="flex gap-2">
          <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm shrink-0">
            🐲
          </div>
          <div class="bg-[#1a2040] rounded-xl rounded-tl-sm px-3 py-2">
            <div class="flex gap-1">
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="border-t border-[#1e2a4a] p-3">
        <div class="flex gap-2">
          <input
            ref="inputRef"
            v-model="inputText"
            @keydown.enter="sendMessage"
            placeholder="说点什么..."
            :disabled="isThinking"
            class="flex-1 bg-[#0B1020] border border-[#1e2a4a] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
          />
          <button
            @click="sendMessage"
            :disabled="isThinking || !inputText.trim()"
            class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-xl px-3 py-2 transition disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5m0 0l-7 7m7-7l7 7"/>
            </svg>
          </button>
        </div>
        <div class="text-gray-600 text-xs mt-1.5 text-center">
          一问一答 · 回复约3-5秒
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

const showChat = ref(false)
const inputText = ref('')
const isThinking = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant', content: string, thinking?: boolean }>>([])
const msgContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

function openChat() {
  showChat.value = true
  nextTick(() => inputRef.value?.focus())
}

function closeChat() {
  showChat.value = false
}

async function scrollToBottom() {
  await nextTick()
  if (msgContainer.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isThinking.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  await scrollToBottom()

  // 开始思考
  isThinking.value = true
  await scrollToBottom()

  try {
    const res = await fetch('/api/v1/customer-service/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    const data = await res.json()

    if (data.reply) {
      messages.value.push({ role: 'assistant', content: data.reply })
    } else {
      messages.value.push({ role: 'assistant', content: data.error || '哎呀，我卡住了，再问一遍试试？' })
    }
  } catch {
    messages.value.push({ role: 'assistant', content: '网络开小差了，等下再试试吧~' })
  } finally {
    isThinking.value = false
    await scrollToBottom()
  }
}

watch(messages, scrollToBottom)
</script>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #1e2a4a;
  border-radius: 2px;
}
</style>
