<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useDragOrder, useTableSortable } from '@/composables/use-drag-order'
import { usePagination, useSelection } from '@/composables/use-pagination'
import { categoryApi, subcategoryApi } from '@/services/api'

const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const subcategories = ref([])
const { page, pageSize, paged } = usePagination(categories)
const { selected, onSelectionChange } = useSelection()
const { persistMoved, savingOrder } = useDragOrder({
  save: (id, sort_order) => categoryApi.update(id, { sort_order }),
  reload: loadData,
})
// 表格行拖拽（页内下标 + 分页偏移换算到全量位置）
const { wrap: tableWrap, init: initRowSortable } = useTableSortable({
  rows: categories,
  page,
  pageSize,
  persist: persistMoved,
})
const dialogVisible = ref(false)
const formRef = ref()
const defaultForm = () => ({ id: null, name: '', slug: '', icon: '', description: '', sort_order: '' })
const form = reactive(defaultForm())
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入标识', trigger: 'blur' }],
}

const subsCount = computed(() => {
  const m = new Map()
  for (const s of subcategories.value) m.set(s.category_id, (m.get(s.category_id) || 0) + 1)
  return m
})

async function loadData() {
  loading.value = true
  try {
    const [cats, subs] = await Promise.all([categoryApi.list(), subcategoryApi.list()])
    categories.value = cats
    subcategories.value = subs
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}
function openDialog(row) {
  Object.assign(form, defaultForm())
  if (row) Object.assign(form, row)
  dialogVisible.value = true
}
async function save() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const { id, ...payload } = form
    if (id) {
      if (!payload.sort_order) delete payload.sort_order
      await categoryApi.update(id, payload)
    } else {
      if (!payload.sort_order) {
        const keys = categories.value.map(c => c.sort_order).filter(Boolean).map(String)
        let last
        for (const key of keys) {
          if (last === undefined || last < key) last = key
        }
        payload.sort_order = generateKeyBetween(last, undefined, BASE_62_DIGITS)
      }
      await categoryApi.create(payload)
    }
    ElMessage.success(id ? '更新成功' : '新增成功')
    dialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}
async function handleDelete(row) {
  if (subsCount.value.get(row.id)) return ElMessage.warning('该分类下存在子分类，请先删除子分类')
  await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
  try {
    await categoryApi.remove(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
async function handleBatchDelete() {
  if (selected.value.some(r => subsCount.value.get(r.id))) return ElMessage.warning('选中的分类中存在含有子分类的分类，请先处理其子分类')
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个分类吗？`, '批量删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await categoryApi.batchRemove(selected.value.map(r => r.id))
    ElMessage.success('已批量删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
onMounted(() => {
  loadData().finally(() => nextTick(initRowSortable))
})
</script>

<template>
  <div class="cat-manage ui-page ui-page--wide">
    <div class="tb-toolbar tb-toolbar--between">
      <h3 class="tb-title">
        主分类管理
      </h3>
      <div class="tb-right">
        <el-button v-if="selected.length" type="danger" @click="handleBatchDelete">
          批量删除 ({{ selected.length }})
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增分类
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
        <el-table-column prop="name" label="分类名称" width="160" />
        <el-table-column prop="slug" label="标识 (slug)" width="160" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序键" width="110" />
        <el-table-column label="子分类数" width="100">
          <template #default="{ row }">
            <el-tag size="small">
              {{ subsCount.get(row.id) || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">
              编辑
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="categories.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        class="tb-pagination"
      />
    </div>
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑分类' : '新增分类'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：生活服务" />
        </el-form-item>
        <el-form-item label="标识 slug" prop="slug">
          <el-input v-model="form.slug" placeholder="例如：life" />
        </el-form-item>
        <el-form-item label="分类图标">
          <el-input v-model="form.icon" placeholder="图标文本（可选）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
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
.cat-manage .tb-toolbar {
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
.cat-manage .tb-right {
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
