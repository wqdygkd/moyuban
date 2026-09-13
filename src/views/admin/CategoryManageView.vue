<script setup lang="ts">
import type { Category, SubcategoryWithCategory } from '@/types'
import { ElMessage } from 'element-plus'
import { useCrudTable } from '@/composables/use-crud-table'
import { useDragOrder, useTableSortable } from '@/composables/use-drag-order'
import { usePagination } from '@/composables/use-pagination'
import { categoryApi, subcategoryApi } from '@/services/api'
import { countBy } from '@/utils/group'

const categories = ref<Category[]>([])
const subcategories = ref<SubcategoryWithCategory[]>([])
const { page, pageSize, paged } = usePagination(categories)
const { persistMoved, savingOrder } = useDragOrder({
  save: (id, sort_order) => categoryApi.update(String(id), { sort_order }),
  reload: loadData,
})
// 表格行拖拽（页内下标 + 分页偏移换算到全量位置）
const { wrap: tableWrap, init: initRowSortable } = useTableSortable({
  rows: categories,
  page,
  pageSize,
  persist: persistMoved,
})

// 子分类数：删除前的占用检查 + 表格列展示
const subsCount = computed(() => countBy(subcategories.value, s => s.category_id))

interface CategoryFormState {
  id: string | null
  name: string
  slug: string
  icon: string
  description: string
  sort_order: string
}

const {
  loading,
  saving,
  dialogVisible,
  formRef,
  form,
  rules,
  selected,
  onSelectionChange,
  openDialog,
  save,
  handleDelete,
  handleBatchDelete,
} = useCrudTable<CategoryFormState, Category>({
  entityName: '分类',
  usageName: '子分类',
  usageCounts: subsCount,
  rows: categories,
  defaultForm: () => ({ id: null, name: '', slug: '', icon: '', description: '', sort_order: '' }),
  rules: {
    name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
    slug: [{ required: true, message: '请输入标识', trigger: 'blur' }],
  },
  create: payload => categoryApi.create(payload),
  update: (id, payload) => categoryApi.update(id, payload),
  remove: id => categoryApi.remove(id),
  batchRemove: ids => categoryApi.batchRemove(ids),
  reload: loadData,
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [cats, subs] = await Promise.all([categoryApi.list(), subcategoryApi.list()])
    categories.value = cats
    subcategories.value = subs
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
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
            <el-button link type="primary" @click="openDialog(row as Category)">
              编辑
            </el-button>
            <el-button link type="danger" @click="handleDelete(row as Category)">
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
