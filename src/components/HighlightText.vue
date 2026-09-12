<script setup lang="ts">
// 命中词高亮：把 text 按不区分大小写的 token 切成片段，命中片段包 <mark>。
// 纯元素切分渲染，不用 v-html，避免把库里的内容当 HTML 执行。
const props = defineProps<{
  text?: string | null
  tokens?: string[]
}>()

interface Segment {
  text: string
  hit: boolean
}

const segments = computed<Segment[]>(() => {
  const source = props.text || ''
  const tokens = (props.tokens ?? []).filter(Boolean)
  if (!source || !tokens.length) return source ? [{ text: source, hit: false }] : []

  const hit = new Array<boolean>(source.length).fill(false)
  const lowerSource = source.toLowerCase()
  for (const token of tokens) {
    const needle = token.toLowerCase()
    let idx = lowerSource.indexOf(needle)
    while (idx !== -1) {
      hit.fill(true, idx, idx + needle.length)
      idx = lowerSource.indexOf(needle, idx + needle.length)
    }
  }

  const out: Segment[] = []
  let start = 0
  for (let i = 1; i <= source.length; i++) {
    if (i === source.length || hit[i] !== hit[start]) {
      out.push({ text: source.slice(start, i), hit: hit[start] })
      start = i
    }
  }
  return out
})
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i">
    <mark v-if="seg.hit">{{ seg.text }}</mark>
    <template v-else>
      {{ seg.text }}
    </template>
  </template>
</template>

<style scoped lang="scss">
mark {
  padding: 0;
  background: transparent;
  color: rgb(var(--color-primary));
  font-weight: 700;
}
</style>
