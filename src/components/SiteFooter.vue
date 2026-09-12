<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-info">
          <div class="footer-brand">
            <span class="footer-logo">摸</span>
            <span class="footer-name">摸鱼办</span>
          </div>
          <p class="footer-desc">
            摸鱼办，上班摸鱼第一入口，集生活服务、实用工具、资源发现、AI领域、影音娱乐、设计灵感、站长工具、开发资源、探索发现于一体的高效摸鱼集合地。摸鱼不犯法，快乐每一天。
          </p>
          <p class="footer-disclaimer">
            本网站为网址导航平台，所展示的资源及链接均收集自互联网或用户投稿，仅供学习参考，不代表本站立场，亦不对其真实性、合法性、准确性作任何保证。
          </p>
          <p class="footer-copyright">
            Copyright © {{ year }} 摸鱼办
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.site-footer {
  background: var(--card-bg);
  border-top: 1px solid var(--border-soft);
  margin-top: var(--space-9);
}

.footer-main {
  display: flex;
  justify-content: space-between;
  gap: var(--space-9);
  padding: var(--space-7) 0 var(--space-8);
}

.footer-info {
  flex: 1;
  min-width: 0;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.footer-logo {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--grad-brand);
  color: var(--text-on-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-md);
  font-weight: 700;
}

.footer-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.footer-desc {
  margin: 0 0 var(--space-3);
  font-size: var(--text-foot);
  line-height: 1.8;
  color: var(--text-sub);
}

.footer-disclaimer {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xxs);
  line-height: 1.7;
  color: rgb(var(--color-text-muted));
}

.footer-copyright {
  margin: 0;
  font-size: var(--text-xxs);
  color: rgb(var(--color-text-muted));
}

@media (max-width: 720px) {
  .footer-main {
    flex-direction: column;
  }
}
</style>
