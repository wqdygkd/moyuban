import { computed, ref } from 'vue'

export function usePagination(source, defaultSize = 10) {
  const page = ref(1)
  const pageSize = ref(defaultSize)
  const selected = ref([])
  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })
  function onSelectionChange(rows) {
    selected.value = rows
  }
  return { page, pageSize, paged, selected, onSelectionChange }
}
