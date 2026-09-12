<script setup>
import { copyText } from '@/utils/clipboard'
import { getFaviconSource } from '@/utils/favicon'

defineOptions({ name: 'FaviconField' })
defineProps({
  candidates: { type: Array, default: () => [] },
  placeholder: { type: String, default: '留空自动按多源解析' },
})
const model = defineModel({ type: String, default: '' })
function onImgError(e) {
  e.target.classList.add('is-broken')
}
</script>

<template>
  <div class="url-row">
    <el-select
      v-model="model"
      filterable
      allow-create
      default-first-option
      clearable
      :placeholder="placeholder"
    >
      <el-option label="自动（按顺序容灾）" value="" />
      <el-option v-for="u in candidates" :key="u" :label="u" :value="u" />
    </el-select>
    <el-button :disabled="!model" title="复制 URL" @click="copyText(model)">
      <el-icon><DocumentCopy /></el-icon>
    </el-button>
  </div>
  <div class="favicon-preview">
    <div class="favicon-preview__head">
      候选预览 — 点击选用，悬停查看来源
    </div>
    <div v-if="candidates.length" class="candidate-grid">
      <el-tooltip
        v-for="u in candidates"
        :key="u"
        placement="top"
        effect="light"
        :show-after="180"
        :hide-after="0"
        popper-class="favicon-hover-popper"
      >
        <template #content>
          <div class="favicon-hover-content">
            <img :src="u" alt="原图预览" class="favicon-hover-img" loading="lazy" @error="onImgError">
            <div class="favicon-hover-meta">
              <span class="favicon-hover-src">{{ getFaviconSource(u) }}</span>
              <span class="favicon-hover-url">{{ u }}</span>
            </div>
          </div>
        </template>
        <button
          type="button"
          class="candidate"
          :class="{ 'is-selected': model === u }"
          :title="`${getFaviconSource(u)} — ${u}`"
          @click="model = u"
        >
          <img :src="u" class="candidate__img" loading="lazy" @error="onImgError">
          <span class="candidate__src">{{ getFaviconSource(u) }}</span>
          <span class="candidate__url" :title="u">{{ u }}</span>
          <span class="candidate__copy" title="复制 URL" @click.stop="copyText(u)">
            <el-icon><DocumentCopy /></el-icon>
          </span>
        </button>
      </el-tooltip>
    </div>
    <span v-else class="favicon-empty">请输入网址以生成候选</span>
    <div v-if="model && !candidates.includes(model)" class="candidate-note">
      当前手动：{{ model }}
      <span class="candidate__copy" title="复制 URL" @click="copyText(model)">
        <el-icon><DocumentCopy /></el-icon>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.favicon-preview {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.favicon-preview__head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}
.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition:
    border-color 0.2s,
    background 0.2s;
  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
  &.is-selected {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}
.candidate__img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  object-fit: contain;
  flex-shrink: 0;
  &.is-broken {
    opacity: 0.25;
  }
}
.candidate__src {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  white-space: nowrap;
}
.candidate__url {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.candidate__copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  &:hover {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}
.candidate-note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.favicon-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.url-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}
.url-row .el-select {
  flex: 1;
  min-width: 0;
}
</style>

<style lang="scss">
/* tooltip 内容 teleport 到 body，选择器不能 scoped */
.favicon-hover-popper {
  max-width: 240px;
}
.favicon-hover-content {
  text-align: center;
}
.favicon-hover-img {
  max-width: 500px;
  max-height: 500px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  &.is-broken {
    opacity: 0.3;
  }
}
.favicon-hover-meta {
  margin-top: 8px;
}
.favicon-hover-src {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.favicon-hover-url {
  display: block;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  margin-top: 2px;
}
</style>
