<script setup lang="ts">
import type { SiteHome } from '@/types'
import FaviconImg from '@/components/FaviconImg.vue'
import { siteApi } from '@/services/api'
import { getFaviconCandidates } from '@/utils/favicon'

defineOptions({ name: 'SiteCard' })
const props = withDefaults(defineProps<{
  site: SiteHome
  editMode?: boolean
}>(), {
  editMode: false,
})
const emit = defineEmits<{
  edit: []
}>()
const faviconCandidates = computed(() =>
  // 前台图标优先级：favicon_url（手动）> image_url > 自动嗅探，失败逐个降级
  getFaviconCandidates({ url: props.site.url }, [props.site.image_url]),
)
let clicked = false
function handleClick() {
  // 单次点击防抖，避免重复写
  if (clicked || !props.site.id) return
  if (!navigator.onLine) return
  clicked = true
  siteApi.incrementClick(props.site.id).catch(() => {
    clicked = false
  })
}
function onCardClick(e: MouseEvent): void {
  // 编辑模式下点击卡片不再跳转，交给外层打开编辑弹窗
  if (props.editMode) {
    e.preventDefault()
    emit('edit')
    return
  }
  handleClick()
}
</script>

<template>
  <a class="site-card" :class="{ 'is-editable': editMode }" :href="site.url" :data-site-id="site.id" target="_blank" rel="noopener" :draggable="editMode" @click="onCardClick">
    <div class="card-main">
      <span class="card-icon">
        <FaviconImg v-if="faviconCandidates.length" :candidates="faviconCandidates" :alt="site.name" :size="32" img-class="card-favicon">
          <span class="card-letter">{{ site.name[0] }}</span>
        </FaviconImg>
        <span v-else class="card-letter">{{ site.name[0] }}</span>
      </span>
      <div class="card-body">
        <div class="card-title-row">
          <span class="card-title ellipsis">{{ site.name }}</span>
        </div>
        <p class="card-desc ellipsis" :title="site.description ?? ''">{{ site.description || '—' }}</p>
      </div>
    </div>
    <span v-if="site.is_hot || site.is_featured" class="card-flags">
      <span v-if="site.is_hot" class="flag flag-hot">火</span>
      <span v-if="site.is_featured" class="flag flag-rec">荐</span>
    </span>
    <button v-if="editMode" type="button" class="card-edit-btn" title="编辑网址" @click.stop.prevent="emit('edit')">
      <el-icon><EditPen /></el-icon>
    </button>
  </a>
</template>

<style scoped lang="scss">
.site-card {
  display: block;
  position: relative;
  background: rgb(var(--color-bg-card));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-card);
  transition:
    transform 0.2s,
    border-color 0.2s,
    box-shadow 0.25s;
  cursor: pointer;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(240px 90px at 50% 0%, rgb(var(--color-primary) / 0.12), transparent 65%);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  &:hover {
    border-color: rgb(var(--color-border-active));
    box-shadow: var(--shadow-brand-hover);
    transform: translateY(-2px);
    &::after {
      opacity: 1;
    }
    .card-title {
      color: rgb(var(--color-primary));
    }
  }
  &:active {
    transform: translateY(0) scale(0.99);
  }
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
}
.card-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  cursor: pointer;
}
.card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: linear-gradient(145deg, rgb(var(--color-bg-card-hover)), rgb(var(--color-bg-card)));
  box-shadow:
    inset 0 0 0 1px rgb(var(--color-border) / 0.6),
    0 4px 10px rgb(var(--color-primary) / 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  img,
  .card-favicon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: inherit;
    display: block;
  }
}
.site-card:hover .card-icon {
  transform: scale(1.08) rotate(-3deg);
}
.card-letter {
  font-size: 17px;
  font-weight: 700;
  color: rgb(var(--color-primary));
  line-height: 1;
}
.card-body {
  flex: 1;
  min-width: 0;
}
.card-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.card-title {
  color: rgb(var(--color-text));
  font-size: var(--text-md);
  font-weight: 600;
  line-height: 1.3;
  transition: color 0.2s;
}
.card-desc {
  color: rgb(var(--color-text-secondary));
  font-size: var(--text-foot);
  line-height: 1.4;
  margin: 0.3rem 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-flags {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}
.flag {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  color: var(--text-on-primary);
  font-weight: 700;
  &.flag-hot {
    background: rgb(var(--color-hot));
  }
  &.flag-rec {
    background: rgb(var(--color-primary));
  }
}

.site-card.is-editable {
  cursor: grab;
  border-style: dashed;
  &:active {
    cursor: grabbing;
  }
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgb(var(--color-primary) / 0.04);
    pointer-events: none;
  }
}
.is-dragging.site-card {
  opacity: 0.45;
  transform: scale(0.97);
  cursor: grabbing;
}
.card-edit-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
  border: 1px solid rgb(var(--color-border-active));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-bg-card));
  color: rgb(var(--color-primary));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
  .site-card.is-editable:hover & {
    opacity: 1;
    &:hover {
      transform: scale(1.1);
      box-shadow: var(--shadow-brand-sm);
    }
  }
}
</style>
