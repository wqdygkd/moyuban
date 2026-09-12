<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { Category, Site, Subcategory, SubcategoryWithCategory } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDragOrder, useTableSortable } from '@/composables/use-drag-order'
import { usePagination, useSelection } from '@/composables/use-pagination'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { appendOrderKey } from '@/utils/order'

const loading = ref(false)
const saving = ref(false)
const categories = ref<Category[]>([])
const subcategories = ref<SubcategoryWithCategory[]>([])
const sites = ref<Site[]>([])
const { page, pageSize, paged } = usePagination(subcategories)
const { selected, onSelectionChange } = useSelection<SubcategoryWithCategory>()
const { persistMoved, savingOrder } = useDragOrder({
  save: (id, sort_order) => subcategoryApi.update(String(id), { sort_order }),
  reload: loadData,
})
// 表格行拖拽（页内下标 + 分页偏移换算到全量位置）
const { wrap: tableWrap, init: initRowSortable } = useTableSortable({
  rows: subcategories,
  page,
  pageSize,
  persist: persistMoved,
})
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

interface SubcategoryFormState {
  id: string | null
  category_id: string
  name: string
  slug: string
  sort_order: string
}

const defaultForm = (): SubcategoryFormState => ({ id: null, category_id: '', name: '', slug: '', sort_order: '' })
const form = reactive<SubcategoryFormState>(defaultForm())
const rules: FormRules<SubcategoryFormState> = {
  category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入子分类名称', trigger: 'blur' }],
}

const catMap = computed(() => new Map(categories.value.map(c => [c.id, c.name])))
const siteCount = computed(() => {
  const m = new Map<string, number>()
  for (const s of sites.value) m.set(s.subcategory_id ?? '', (m.get(s.subcategory_id ?? '') || 0) + 1)
  return m
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [cats, subs, siteData] = await Promise.all([categoryApi.list(), subcategoryApi.list(), siteApi.list()])
    categories.value = cats
    subcategories.value = subs
    sites.value = siteData
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}
function openDialog(row?: Subcategory): void {
  Object.assign(form, defaultForm())
  if (row) Object.assign(form, row)
  dialogVisible.value = true
}
async function save(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const { id, ...payload } = form
    if (id) {
      const body: Partial<Subcategory> = { ...payload }
      if (!body.sort_order) delete body.sort_order
      await subcategoryApi.update(id, body)
    } else {
      if (!payload.sort_order) payload.sort_order = appendOrderKey(subcategories.value)
      await subcategoryApi.create(payload)
    }
    ElMessage.success(id ? '更新成功' : '新增成功')
    dialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
async function handleDelete(row: SubcategoryWithCategory): Promise<void> {
  if (siteCount.value.get(row.id)) {
    ElMessage.warning('该子分类下存在网址，请先删除或移动网址')
    return
  }
  await ElMessageBox.confirm(`确定删除子分类「${row.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await subcategoryApi.remove(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
async function handleBatchDelete(): Promise<void> {
  if (selected.value.some(r => siteCount.value.get(r.id))) {
    ElMessage.warning('选中的子分类中存在含有网址的子分类，请先处理其网址')
    return
  }
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个子分类吗？`, '批量删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await subcategoryApi.batchRemove(selected.value.map(r => r.id))
    ElMessage.success('已批量删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
onMounted(() => {
  loadData().finally(() => nextTick(initRowSortable))
})
</script>

<template>
  <div class="sub-manage ui-page ui-page--wide">
    <div class="tb-toolbar tb-toolbar--between">
      <h3 class="tb-title">
        子分类管理
      </h3>
      <div class="tb-right">
        <el-button v-if="selected.length" type="danger" @click="handleBatchDelete">
          批量删除 ({{ selected.length }})
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增子分类
        </el-button>
      </div>
    </div>
    <div ref="tableWrap" class="table-card">
      <el-table v-loading="loading || savingOrder" :data="paged" stripe row-key="id" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column label="" width="44">
          <template #default>
            <span
              class="drag-handle"
              title="拖拽排序"
            >⠿</span>
          </template>
        </el-table-column>
        <el-table-column label="所属分类" min-width="160">
          <template #default="{ row }">
            <el-tag type="info">
              {{ catMap.get(row.category_id) || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="子分类名称" min-width="180" />
        <el-table-column prop="sort_order" label="排序键" width="110" />
        <el-table-column label="网址数" width="100">
          <template #default="{ row }">
            <el-tag size="small">
              {{ siteCount.get(row.id) || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row as Subcategory)">
              编辑
            </el-button>
            <el-button link type="danger" @click="handleDelete(row as SubcategoryWithCategory)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="subcategories.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        class="tb-pagination"
      />
    </div>
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑子分类' : '新增子分类'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="选择主分类" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="子分类名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：即时资讯" />
        </el-form-item>
        <el-form-item label="标识 slug">
          <el-input v-model="form.slug" placeholder="例如：news" />
        </el-form-item>
        <el-form-item label="排序键">
          <el-input v-model="form.sort_order" placeholder="留空自动排到末尾" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.sub-manage .tb-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  box-shadow: var(--shadow-card);
  margin-bottom: var(--space-4);
}
.sub-manage .tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-left: 12px;
  border-left: 1px solid var(--border-soft);
}
.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  padding: 0;
}
.table-card :deep(.el-table) {
  --el-table-header-bg-color: rgb(var(--color-bg-card-hover));
  --el-table-tr-bg-color: transparent;
  --el-table-row-hover-bg-color: rgb(var(--color-bg-card-hover) / 0.7);
}
.table-card :deep(.el-table th.el-table__cell) {
  background: rgb(var(--color-bg-card-hover));
  color: var(--text-sub);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-soft) !important;
  padding: 10px 0;
}
.table-card :deep(.el-table td.el-table__cell) {
  padding: 11px 0;
  border-bottom: 1px solid rgb(var(--color-border) / 0.5);
  font-size: var(--text-sm);
}
.table-card :deep(.el-table .el-table__row:last-child td) {
  border-bottom: none;
}
.table-card :deep(.el-table .el-table__row:hover td) {
  background: rgb(var(--color-bg-card-hover) / 0.55) !important;
}
.tb-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: 12px 14px;
  border-top: 1px solid var(--border-soft);
  background: rgb(var(--color-bg-card-hover) / 0.35);
  margin-top: 0;
}
.drag-handle {
  cursor: move;
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  user-select: none;
  padding: 4px 8px;
  &:hover {
    color: var(--el-color-primary);
  }
}
:deep(.sortable-ghost td) {
  background: var(--el-color-primary-light-9);
}
</style>
