<template>
  <div class="community-hero">
    <div class="hero-bg" />
    <div class="hero-content">
      <div class="hero-badge">💬 社区</div>
      <h1 class="hero-title">昆仑镜创作者社区</h1>
      <p class="hero-desc">
        分享你的 AI 短剧作品，交流创作经验，获取灵感与反馈
      </p>
      <div class="hero-actions">
        <NuxtLink to="/community/new" class="btn btn-primary">
          ✏️ 发布帖子
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.community-hero {
  position: relative;
  padding: 60px 24px;
  text-align: center;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(249,115,22,0.08), rgba(99,102,241,0.08));
  border-bottom: 1px solid rgba(255,255,255,0.04);
  pointer-events: none;
}
.hero-content {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0 auto;
}
.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  background: rgba(249,115,22,0.1);
  color: #f97316;
  border: 1px solid rgba(249,115,22,0.2);
  margin-bottom: 16px;
}
.hero-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px;
  line-height: 1.3;
}
.hero-desc {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.45);
  line-height: 1.6;
  margin-bottom: 24px;
}
.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}
.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(249,115,22,0.3);
}
</style>
