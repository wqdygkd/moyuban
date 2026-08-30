<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { usePagination } from '@/composables/use-admin-table'
import { categoryApi, subcategoryApi } from '@/services/api'

const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const subcategories = ref([])
const { page, pageSize, paged, selected, onSelectionChange } = usePagination(categories)
const dialogVisible = ref(false)
const formRef = ref()
const defaultForm = () => ({ id: null, name: '', slug: '', icon: '', description: '', sort_order: 0 })
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
    if (id) await categoryApi.update(id, payload)
    else await categoryApi.create(payload)
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
onMounted(loadData)
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
    <div class="table-card">
      <el-table v-loading="loading" :data="paged" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="name" label="分类名称" width="160" />
        <el-table-column prop="slug" label="标识 (slug)" width="160" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="90" />
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
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
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
</style>
