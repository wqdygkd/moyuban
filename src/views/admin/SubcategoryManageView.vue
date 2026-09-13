<script setup lang="ts">
import type { Category, Site, SubcategoryWithCategory } from '@/types'
import { ElMessage } from 'element-plus'
import { useCrudTable } from '@/composables/use-crud-table'
import { useDragOrder, useTableSortable } from '@/composables/use-drag-order'
import { usePagination } from '@/composables/use-pagination'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { countBy } from '@/utils/group'

const categories = ref<Category[]>([])
const subcategories = ref<SubcategoryWithCategory[]>([])
const sites = ref<Site[]>([])
const { page, pageSize, paged } = usePagination(subcategories)
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

const catMap = computed(() => new Map(categories.value.map(c => [c.id, c.name])))
// 网址数：删除前的占用检查 + 表格列展示
const siteCount = computed(() => countBy(sites.value, s => s.subcategory_id))

interface SubcategoryFormState {
  id: string | null
  category_id: string
  name: string
  slug: string
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
} = useCrudTable<SubcategoryFormState, SubcategoryWithCategory>({
  entityName: '子分类',
  usageName: '网址',
  usageCounts: siteCount,
  rows: subcategories,
  defaultForm: () => ({ id: null, category_id: '', name: '', slug: '', sort_order: '' }),
  rules: {
    category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
    name: [{ required: true, message: '请输入子分类名称', trigger: 'blur' }],
  },
  create: payload => subcategoryApi.create(payload),
  update: (id, payload) => subcategoryApi.update(id, payload),
  remove: id => subcategoryApi.remove(id),
  batchRemove: ids => subcategoryApi.batchRemove(ids),
  reload: loadData,
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [cats, subs, siteData] = await Promise.all([categoryApi.list(), subcategoryApi.list(), siteApi.list()])
    categories.value = cats
    subcategories.value = subs
    sites.value = siteData
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
            <el-button link type="primary" @click="openDialog(row as SubcategoryWithCategory)">
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
