import type { Ref } from 'vue'

export function usePagination<T>(source: Ref<T[]>, defaultSize = 10) {
  const page = ref(1)
  const pageSize = ref(defaultSize)
  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })
  // 数据收缩（删除/筛选）或页大小变化导致当前页越界时自动回落，
  // 否则表格会停留在空页。监听 length 而非数组身份，原地 splice 也能捕获。
  watch([page, pageSize, () => source.value.length], () => {
    const max = Math.max(1, Math.ceil(source.value.length / pageSize.value))
    if (page.value > max) page.value = max
  })
  return { page, pageSize, paged }
}

export function useSelection<T>() {
  const selected = ref<T[]>([])
  function onSelectionChange(rows: T[]): void {
    selected.value = rows
  }
  return { selected, onSelectionChange }
}
