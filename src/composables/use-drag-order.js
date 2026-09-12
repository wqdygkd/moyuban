import { ElMessage } from 'element-plus'
import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'
import Sortable from 'sortablejs'
import { onBeforeUnmount, ref } from 'vue'

// 前后邻居键之间生成新 fractional 键；邻居键非法时退化为追加到末尾
export function nextOrderKey(list, index) {
  const previous = index > 0 ? list[index - 1].sort_order || undefined : undefined
  const next = index < list.length - 1 ? list[index + 1].sort_order || undefined : undefined
  try {
    return generateKeyBetween(previous, next, BASE_62_DIGITS)
  } catch {
    const keys = list.map(item => item.sort_order).filter(Boolean).map(String)
    let last
    for (const key of keys) {
      if (last === undefined || last < key) last = key
    }
    return generateKeyBetween(last, undefined, BASE_62_DIGITS)
  }
}

// Sortable 落定后调用：list 已是拖拽后的新顺序，只 update 被移动的一条
export function useDragOrder({ save, reload }) {
  const savingOrder = ref(false)
  async function persistMoved(list, id) {
    const newIndex = list.findIndex(item => String(item.id) === String(id))
    if (newIndex === -1) return
    const newKey = nextOrderKey(list, newIndex)
    if (list[newIndex].sort_order === newKey) return
    savingOrder.value = true
    try {
      await save(id, newKey)
      list[newIndex].sort_order = newKey
      ElMessage.success('排序已保存')
    } catch (error) {
      ElMessage.error(error.message || '排序保存失败')
      await reload?.()
    } finally {
      savingOrder.value = false
    }
  }
  return { persistMoved, savingOrder }
}

// 表格行拖拽：Sortable 挂 el-table 的 tbody；页内下标 + 分页偏移换算到全量位置
export function useTableSortable({ rows, page, pageSize, persist }) {
  const wrap = ref()
  let sortable
  function init() {
    const tbody = wrap.value?.querySelector(':scope .el-table__body-wrapper tbody')
    if (!tbody || sortable) return
    sortable = Sortable.create(tbody, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd: async ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
        const base = (page.value - 1) * pageSize.value
        const list = rows.value
        const [moved] = list.splice(base + oldIndex, 1)
        if (!moved) return
        list.splice(base + newIndex, 0, moved)
        await persist(list, moved.id)
      },
    })
  }
  onBeforeUnmount(() => sortable?.destroy())
  return { wrap, init }
}
