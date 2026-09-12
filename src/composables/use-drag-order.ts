import type { SortableEvent } from 'sortablejs'
import type { Ref } from 'vue'
import type { Orderable } from '@/types'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import { appendOrderKey, nextKey } from '@/utils/order'

// 前后邻居键之间生成新 fractional 键；邻居键非法时退化为追加到末尾
export function nextOrderKey<T extends Orderable>(list: T[], index: number): string {
  const previous = index > 0 ? list[index - 1].sort_order || undefined : undefined
  const next = index < list.length - 1 ? list[index + 1].sort_order || undefined : undefined
  try {
    return nextKey(previous ? String(previous) : undefined, next ? String(next) : undefined)
  } catch {
    return appendOrderKey(list)
  }
}

export interface DragOrderOptions {
  save: (id: string | number, sortOrder: string) => Promise<unknown>
  reload?: () => Promise<unknown> | unknown
}

// Sortable 落定后调用：list 已是拖拽后的新顺序，只 update 被移动的一条
export function useDragOrder({ save, reload }: DragOrderOptions) {
  const savingOrder = ref(false)
  async function persistMoved<T extends Orderable>(list: T[], id: T['id']): Promise<void> {
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
      ElMessage.error(error instanceof Error ? error.message : '排序保存失败')
      await reload?.()
    } finally {
      savingOrder.value = false
    }
  }
  return { persistMoved, savingOrder }
}

export interface TableSortableOptions<T extends Orderable> {
  rows: Ref<T[]>
  page: Ref<number>
  pageSize: Ref<number>
  persist: (list: T[], id: T['id']) => Promise<void>
}

// 表格行拖拽：Sortable 挂 el-table 的 tbody；页内下标 + 分页偏移换算到全量位置
export function useTableSortable<T extends Orderable>({ rows, page, pageSize, persist }: TableSortableOptions<T>) {
  const wrap = ref<HTMLElement>()
  let sortable: Sortable | undefined
  function init(): void {
    const tbody = wrap.value?.querySelector(':scope .el-table__body-wrapper tbody')
    if (!tbody || sortable) return
    sortable = Sortable.create(tbody as HTMLElement, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd: async ({ oldIndex, newIndex }: SortableEvent) => {
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
