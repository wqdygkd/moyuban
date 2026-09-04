<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  alt: { type: String, default: '' },
  size: { type: Number, default: 32 },
  imgClass: { type: String, default: '' },
})

const idx = ref(0)
const src = computed(() => props.candidates[idx.value] || '')

watch(() => props.candidates, () => {
  idx.value = 0
})

function onError() {
  if (idx.value < props.candidates.length - 1) idx.value += 1
  else idx.value = props.candidates.length // 耗尽
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
    @error="onError"
  >
  <slot v-else />
</template>
