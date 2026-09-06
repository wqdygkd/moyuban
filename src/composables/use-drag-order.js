import { ElMessage } from 'element-plus'
import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'
import { ref } from 'vue'

// fractional indexing：拖拽落定后只 update 被移动的一条（前后邻居键之间生成新键）
export function useDragOrder({ rows, save, reload }) {
  const dragIndex = ref(-1)
  const dragId = ref(undefined)
  const overId = ref(undefined)
  const savingOrder = ref(false)

  function rowClassName({ row }) {
    return row.id === overId.value ? 'drag-over' : ''
  }

  function onDragStart(row) {
    dragIndex.value = rows.value.indexOf(row)
    if (dragIndex.value >= 0) dragId.value = row.id
  }

  function onDragEnter(row) {
    if (dragIndex.value < 0) return
    overId.value = row.id
    const list = rows.value
    const to = list.indexOf(row)
    if (to === -1 || to === dragIndex.value) return
    const [moved] = list.splice(dragIndex.value, 1)
    list.splice(to, 0, moved)
    dragIndex.value = to
  }

  async function persistOrder() {
    overId.value = null
    const id = dragId.value
    dragIndex.value = -1
    dragId.value = null
    if (!id) return
    const list = rows.value
    const newIndex = list.findIndex(item => item.id === id)
    if (newIndex === -1) return
    const previous = newIndex > 0 ? list[newIndex - 1].sort_order || undefined : undefined
    const next = newIndex < list.length - 1 ? list[newIndex + 1].sort_order || undefined : undefined
    savingOrder.value = true
    try {
      let newKey
      try {
        newKey = generateKeyBetween(previous, next, BASE_62_DIGITS)
      } catch {
        // 邻居键非法：退化为追加到末尾
        let last
        for (const key of list.map(item => item.sort_order).filter(Boolean).map(String)) {
          if (last === undefined || last < key) last = key
        }
        newKey = generateKeyBetween(last, undefined, BASE_62_DIGITS)
      }
      if (list[newIndex].sort_order === newKey) return
      await save(id, newKey)
      list[newIndex].sort_order = newKey
      ElMessage.success('排序已保存')
    } catch (error) {
      ElMessage.error(error.message || '排序保存失败')
      await reload()
    } finally {
      savingOrder.value = false
    }
  }

  return { rowClassName, onDragStart, onDragEnter, persistOrder, savingOrder }
}
