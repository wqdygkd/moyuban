<script setup lang="ts">
defineOptions({ name: 'FaviconImg' })
const props = withDefaults(defineProps<{
  candidates?: string[]
  alt?: string
  size?: number
  imgClass?: string
}>(), {
  candidates: () => [],
  alt: '',
  size: 32,
  imgClass: '',
})

const idx = ref(0)
const src = computed(() => props.candidates[idx.value] || '')

watch(() => props.candidates, () => {
  idx.value = 0
})

function onError() {
  if (idx.value < props.candidates.length - 1) idx.value += 1
  else idx.value = props.candidates.length
}
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="alt"
    :class="imgClass"
    :width="size"
    :height="size"
    loading="lazy"
    decoding="async"
    fetchpriority="low"
    @error="onError"
  >
  <slot v-else />
</template>
