<script setup>
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { usePagination } from '@/composables/use-admin-table'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const filterCategory = ref('')
const categories = ref([])
const subcategories = ref([])
const sites = ref([])
const dialogVisible = ref(false)
const formRef = ref()
function defaultForm() {
  return {
    id: null,
    category_id: '',
    subcategory_id: '',
    name: '',
    url: '',
    description: '',
    favicon_url: '',
    image_url: '',
    is_featured: false,
    is_hot: false,
    is_new: false,
    is_active: true,
    sort_order: 0,
  }
}
const form = reactive(defaultForm())
const rules = {
  category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
  subcategory_id: [{ required: true, message: '请选择所属子分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入网站名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入网站链接', trigger: 'blur' },
    {
      validator: (_r, v, cb) => {
        if (v && !/^https?:\/\//i.test(v)) cb(new Error('链接需以 http:// 或 https:// 开头'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

// Map 索引：子分类 id -> 分类/名称；分类 id -> 子分类 id 集合
const subMap = computed(() => new Map(subcategories.value.map(s => [s.id, s])))
const catMap = computed(() => new Map(categories.value.map(c => [c.id, c.name])))
const subsForCat = computed(() => subcategories.value.filter(s => s.category_id === form.category_id))
function catOf(subId) {
  const sub = subMap.value.get(subId)
  return sub ? catMap.value.get(sub.category_id) || '-' : '-'
}
function subOf(subId) {
  return subMap.value.get(subId)?.name || '-'
}
function faviconOf(row) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(row.favicon_url || row.url).hostname}&sz=64`
  } catch {
    return ''
  }
}

const filteredSites = computed(() => {
  let list = sites.value
  if (filterCategory.value) {
    const ids = new Set(subcategories.value.filter(s => s.category_id === filterCategory.value).map(s => s.id))
    list = list.filter(s => ids.has(s.subcategory_id))
  }
  if (keyword.value) {
    const k = keyword.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(k) || (s.description || '').toLowerCase().includes(k))
  }
  return list
})
const { page, pageSize, paged, selected, onSelectionChange } = usePagination(filteredSites)
watch([keyword, filterCategory], () => {
  page.value = 1
})

async function loadData() {
  loading.value = true
  try {
    const [cats, subs, data] = await Promise.all([categoryApi.list(), subcategoryApi.list(), siteApi.list()])
    categories.value = cats
    subcategories.value = subs
    sites.value = data
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}
function openDialog(row) {
  Object.assign(form, defaultForm())
  if (row) Object.assign(form, { ...row, category_id: subMap.value.get(row.subcategory_id)?.category_id || '' })
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
    delete payload.category_id
    if (id) await siteApi.update(id, payload)
    else await siteApi.create(payload)
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
  await ElMessageBox.confirm(`确定删除「${row.name}」吗？`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
  try {
    await siteApi.remove(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
async function handleBatchDelete() {
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个网址吗？`, '批量删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await siteApi.batchRemove(selected.value.map(r => r.id))
    ElMessage.success('已批量删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
onMounted(loadData)
</script>

<template>
  <div class="site-manage ui-page ui-page--wide">
    <div class="tb-toolbar">
      <el-input v-model="keyword" placeholder="搜索网站名称/描述" clearable class="tb-search" :prefix-icon="Search" />
      <el-select v-model="filterCategory" placeholder="按分类筛选" clearable class="tb-select">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <div class="tb-right">
        <el-button v-if="selected.length" type="danger" @click="handleBatchDelete">
          批量删除 ({{ selected.length }})
        </el-button>
        <el-button @click="loadData">
          刷新
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增网址
        </el-button>
      </div>
    </div>
    <div class="table-card">
      <el-table v-loading="loading" :data="paged" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column label="图标" width="70">
          <template #default="{ row }">
            <img v-if="row.image_url" :src="row.image_url" class="table-img">
            <img v-else-if="row.favicon_url || row.url" :src="faviconOf(row)" class="table-ico">
            <span v-else class="table-letter">{{ row.name[0] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column prop="url" label="链接" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <a :href="row.url" target="_blank" rel="noopener" class="url-cell">{{ row.url }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类/子分类" width="150">
          <template #default="{ row }">
            <span class="chip chip--primary">{{ catOf(row.subcategory_id) }}</span>
            <span class="chip">{{ subOf(row.subcategory_id) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标记" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.is_featured" size="small" type="warning" class="tag-gap">
              推荐
            </el-tag>
            <el-tag v-if="row.is_hot" size="small" type="danger" class="tag-gap">
              热门
            </el-tag>
            <el-tag v-if="row.is_new" size="small" type="success" class="tag-gap">
              最新
            </el-tag>
            <el-tag v-if="!row.is_active" size="small" type="info">
              停用
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="click_count" label="点击" width="80" />
        <el-table-column label="操作" width="150" fixed="right">
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
        :total="filteredSites.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        class="tb-pagination"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑网址' : '新增网址'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="选择主分类" style="width: 100%" @change="form.subcategory_id = ''">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属子分类" prop="subcategory_id">
          <el-select v-model="form.subcategory_id" placeholder="选择子分类" style="width: 100%">
            <el-option v-for="s in subsForCat" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="网站名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：今日头条" />
        </el-form-item>
        <el-form-item label="网站链接" prop="url">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="一句话介绍该网站" />
        </el-form-item>
        <el-form-item label="图标地址">
          <el-input v-model="form.favicon_url" placeholder="favicon URL（可选，留空自动获取）" />
        </el-form-item>
        <el-form-item label="展示大图">
          <el-input v-model="form.image_url" placeholder="卡片大图 URL（可选）" />
        </el-form-item>
        <el-form-item label="标记">
          <el-checkbox v-model="form.is_featured">
            首页推荐
          </el-checkbox>
          <el-checkbox v-model="form.is_hot">
            热门
          </el-checkbox>
          <el-checkbox v-model="form.is_new">
            最新
          </el-checkbox>
          <el-checkbox v-model="form.is_active">
            启用
          </el-checkbox>
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
.table-img {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}
.table-ico {
  width: 26px;
  height: 26px;
}
.table-letter {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.url-cell {
  color: var(--el-color-primary);
}
.tb-pagination {
  margin-top: var(--space-4);
  justify-content: flex-end;
}
.tag-gap {
  margin-right: var(--space-1);
}
</style>
