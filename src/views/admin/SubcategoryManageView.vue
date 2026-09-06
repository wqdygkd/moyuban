<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'
import { computed, onMounted, reactive, ref } from 'vue'
import { usePagination, useSelection } from '@/composables/use-pagination'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'

const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const subcategories = ref([])
const sites = ref([])
const { page, pageSize, paged } = usePagination(subcategories)
const { selected, onSelectionChange } = useSelection()
const dialogVisible = ref(false)
const dragIndex = ref(-1)
const dragId = ref(null)
const overId = ref(null)
const savingOrder = ref(false)
const formRef = ref()
const defaultForm = () => ({ id: null, category_id: '', name: '', slug: '', sort_order: '' })
const form = reactive(defaultForm())
const rules = {
  category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入子分类名称', trigger: 'blur' }],
}

const catMap = computed(() => new Map(categories.value.map(c => [c.id, c.name])))
const siteCount = computed(() => {
  const m = new Map()
  for (const s of sites.value) m.set(s.subcategory_id, (m.get(s.subcategory_id) || 0) + 1)
  return m
})

async function loadData() {
  loading.value = true
  try {
    const [cats, subs, siteData] = await Promise.all([categoryApi.list(), subcategoryApi.list(), siteApi.list()])
    categories.value = cats
    subcategories.value = subs
    sites.value = siteData
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}
// fractional indexing：拖拽落定后只 update 被移动的一条（前后邻居键之间生成新键）
function rowClassName({ row }) {
  return row.id === overId.value ? 'drag-over' : ''
}
function onDragStart(row, i) {
  dragIndex.value = i
  dragId.value = row.id
}
function onDragEnter(row, i) {
  overId.value = row.id
  if (i === dragIndex.value || dragIndex.value < 0) return
  const base = (page.value - 1) * pageSize.value
  const from = base + dragIndex.value
  const to = base + i
  const list = subcategories.value
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  dragIndex.value = i
}
async function persistOrder() {
  overId.value = null
  const id = dragId.value
  dragIndex.value = -1
  dragId.value = null
  if (!id) return
  const list = subcategories.value
  const newIndex = list.findIndex(s => s.id === id)
  if (newIndex < 0) return
  const previous = newIndex > 0 ? list[newIndex - 1].sort_order || undefined : undefined
  const next = newIndex < list.length - 1 ? list[newIndex + 1].sort_order || undefined : undefined
  savingOrder.value = true
  try {
    let newKey
    try {
      newKey = generateKeyBetween(previous, next, BASE_62_DIGITS)
    } catch {
      // 邻居键非法：退化为追加到末尾
      const keys = list.map(s => s.sort_order).filter(Boolean).map(String)
      let last
      for (const key of keys) {
        if (last === undefined || last < key) last = key
      }
      newKey = generateKeyBetween(last, undefined, BASE_62_DIGITS)
    }
    if (list[newIndex].sort_order === newKey) return
    await subcategoryApi.update(id, { sort_order: newKey })
    list[newIndex].sort_order = newKey
    ElMessage.success('排序已保存')
  } catch (e) {
    ElMessage.error(e.message || '排序保存失败')
    await loadData()
  } finally {
    savingOrder.value = false
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
      await subcategoryApi.update(id, payload)
    } else {
      if (!payload.sort_order) {
        const keys = subcategories.value.map(s => s.sort_order).filter(Boolean).map(String)
        let last
        for (const key of keys) {
          if (last === undefined || last < key) last = key
        }
        payload.sort_order = generateKeyBetween(last, undefined, BASE_62_DIGITS)
      }
      await subcategoryApi.create(payload)
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
  if (siteCount.value.get(row.id)) return ElMessage.warning('该子分类下存在网址，请先删除或移动网址')
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
    ElMessage.error(e.message || '删除失败')
  }
}
async function handleBatchDelete() {
  if (selected.value.some(r => siteCount.value.get(r.id))) return ElMessage.warning('选中的子分类中存在含有网址的子分类，请先处理其网址')
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
    ElMessage.error(e.message || '删除失败')
  }
}
onMounted(loadData)
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
    <div class="table-card">
      <el-table v-loading="loading || savingOrder" :data="paged" stripe row-key="id" :row-class-name="rowClassName" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column label="" width="44">
          <template #default="{ row, $index }">
            <span
              class="drag-handle"
              title="拖拽排序"
              draggable="true"
              @dragstart="onDragStart(row, $index)"
              @dragenter="onDragEnter(row, $index)"
              @dragover.prevent
              @drop="persistOrder"
              @dragend="persistOrder"
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
.tb-pagination {
  margin-top: var(--space-4);
  justify-content: flex-end;
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
:deep(.drag-over td) {
  border-top: 2px solid var(--el-color-primary);
}
</style>
