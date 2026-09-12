import type { FormInstance, FormRules } from 'element-plus'
import type { Ref } from 'vue'
import type { Orderable } from '@/types'
import { ElMessage } from 'element-plus'
import { useSelection } from '@/composables/use-pagination'
import { isDeleteConfirmed } from '@/utils/confirm'
import { appendOrderKey } from '@/utils/order'

export interface CrudTableOptions<TForm extends { id: string | null, sort_order: string }, TList extends Orderable & { name: string }> {
  /**
  实体名（分类 / 子分类），用于消息文案
   */
  entityName: string
  /**
  子级占用名（子分类 / 网址）；提供 usageCounts 后删除前会做占用检查
   */
  usageName?: string
  usageCounts?: Ref<Map<string, number>>
  rows: Ref<TList[]>
  defaultForm: () => TForm
  rules: FormRules<TForm>
  create: (payload: Omit<TForm, 'id'>) => Promise<unknown>
  update: (id: string, payload: Partial<Omit<TForm, 'id'>>) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  batchRemove: (ids: string[]) => Promise<unknown>
  reload: () => Promise<void>
}

// 分类/子分类管理页共享的 CRUD 表格状态：弹窗表单、保存（排序键留空自动兜底）、
// 删除/批量删除（占用检查 + confirm 取消静默）。SiteManageView 因服务端分页流程
// 不同（删空回退上一页、换组重排）走自己的实现，不强塞进这里。
export function useCrudTable<TForm extends { id: string | null, sort_order: string }, TList extends Orderable & { name: string }>(options: CrudTableOptions<TForm, TList>) {
  const { entityName, usageName, usageCounts, rows } = options
  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const formReference = ref<FormInstance>()
  const form = reactive<TForm>(options.defaultForm())
  const { selected, onSelectionChange } = useSelection<TList>()

  function openDialog(row?: TList): void {
    Object.assign(form, options.defaultForm())
    if (row) Object.assign(form, row)
    dialogVisible.value = true
  }

  async function save(): Promise<void> {
    try {
      await formReference.value?.validate()
    } catch {
      return
    }
    saving.value = true
    try {
      // 拍平成普通对象再解构：reactive 代理的泛型展开类型不友好，且保存只需要快照
      const { id, ...payload } = { ...form } as TForm
      if (id) {
        // 编辑：排序键留空表示"不改"，不能把空串写进库
        const body: Partial<Omit<TForm, 'id'>> = { ...payload }
        if (!body.sort_order) delete body.sort_order
        await options.update(id, body)
      } else {
        // 新增：排序键留空自动排到末尾
        if (!payload.sort_order) payload.sort_order = appendOrderKey(rows.value)
        await options.create(payload)
      }
      ElMessage.success(id ? '更新成功' : '新增成功')
      dialogVisible.value = false
      await options.reload()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      saving.value = false
    }
  }

  function usageOf(id: string): number {
    return usageCounts?.value.get(id) ?? 0
  }

  async function handleDelete(row: TList): Promise<void> {
    if (usageOf(String(row.id))) {
      ElMessage.warning(`该${entityName}下存在${usageName}，请先处理其${usageName}`)
      return
    }
    if (!await isDeleteConfirmed(`确定删除${entityName}「${row.name}」吗？`)) return
    try {
      await options.remove(String(row.id))
      ElMessage.success('已删除')
      await options.reload()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  async function handleBatchDelete(): Promise<void> {
    if (selected.value.length === 0) return
    if (selected.value.some(r => usageOf(String(r.id)))) {
      ElMessage.warning(`选中的${entityName}中存在含有${usageName}的${entityName}，请先处理其${usageName}`)
      return
    }
    if (!await isDeleteConfirmed(`确定删除选中的 ${selected.value.length} 个${entityName}吗？`, '批量删除')) return
    try {
      await options.batchRemove(selected.value.map(r => String(r.id)))
      ElMessage.success('已批量删除')
      await options.reload()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  return { loading, saving, dialogVisible, formRef: formReference, form, rules: options.rules, selected, onSelectionChange, openDialog, save, handleDelete, handleBatchDelete }
}
