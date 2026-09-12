<script setup lang="ts">
import type { CascaderProps, FormInstance, FormRules } from 'element-plus'
import type { Category, Site, SubcategoryWithCategory } from '@/types'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FaviconField from '@/components/FaviconField.vue'
import FaviconImg from '@/components/FaviconImg.vue'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { getFaviconCandidates } from '@/utils/favicon'

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const filterPath = ref<Array<string | number>>([])
const categories = ref<Category[]>([])
const subcategories = ref<SubcategoryWithCategory[]>([])
const sites = ref<Site[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selected = ref<Site[]>([])
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const onSelectionChange = (rows: Site[]): Site[] => (selected.value = rows)

interface SiteFormState {
  id: string | null
  category_id: string
  subcategory_id: string
  name: string
  url: string
  description: string
  keywords: string
  favicon_url: string
  image_url: string
  is_featured: boolean
  is_hot: boolean
  is_new: boolean
  is_active: boolean
  sort_order: string
}

function defaultForm(): SiteFormState {
  return {
    id: null,
    category_id: '',
    subcategory_id: '',
    name: '',
    url: '',
    description: '',
    keywords: '',
    favicon_url: '',
    image_url: '',
    is_featured: false,
    is_hot: false,
    is_new: false,
    is_active: true,
    sort_order: '',
  }
}
const form = reactive<SiteFormState>(defaultForm())
const rules: FormRules<SiteFormState> = {
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
const cascaderOptions = computed(() =>
  categories.value.map(c => ({
    value: c.id,
    label: c.name,
    children: subcategories.value.filter(s => s.category_id === c.id).map(s => ({ value: s.id, label: s.name })),
  })),
)
const cascaderProps: CascaderProps = { checkStrictly: true, emitPath: true, expandTrigger: 'hover' }
function catOf(subId: string | null): string {
  const sub = subId ? subMap.value.get(subId) : undefined
  return sub ? catMap.value.get(sub.category_id) || '-' : '-'
}
function subOf(subId: string | null): string {
  return (subId && subMap.value.get(subId)?.name) || '-'
}
function faviconCandidates(row: Site): string[] {
  if (row.image_url) return []
  return getFaviconCandidates({ url: row.url, favicon_url: row.favicon_url })
}
function onPreviewError(e: Event): void {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
const hostCandidates = computed(() => getFaviconCandidates({ url: form.url }))

async function loadMeta(): Promise<void> {
  const [cats, subs] = await Promise.all([categoryApi.list(), subcategoryApi.list()])
  categories.value = cats
  subcategories.value = subs
}

async function fetchPaged(): Promise<void> {
  loading.value = true
  try {
    let subcategoryIds: string[] | undefined
    const path = Array.isArray(filterPath.value) ? filterPath.value : []
    if (path.length === 1) {
      const catId = path[0]
      subcategoryIds = subcategories.value.filter(s => s.category_id === catId).map(s => s.id)
      if (!subcategoryIds.length) {
        sites.value = []
        total.value = 0
        return
      }
    } else if (path.length === 2) {
      subcategoryIds = [String(path[1])]
    }
    const { data, total: t } = await siteApi.listPaged({ page: page.value, pageSize: pageSize.value, keyword: keyword.value.trim(), subcategoryIds })
    sites.value = data
    total.value = t
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadData(): Promise<void> {
  try {
    await loadMeta()
    page.value = 1
    await fetchPaged()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  }
}

// 搜索/筛选防抖，避免每键一次请求；page/pageSize 变更直接拉取
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (page.value === 1) fetchPaged()
    else page.value = 1
  }, 200)
})
watch(filterPath, () => {
  if (page.value === 1) fetchPaged()
  else page.value = 1
})
watch(pageSize, () => {
  if (page.value === 1) fetchPaged()
  else page.value = 1
})
watch(page, fetchPaged)
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
function openDialog(row?: Site): void {
  Object.assign(form, defaultForm())
  if (row) Object.assign(form, { ...row, category_id: (row.subcategory_id && subMap.value.get(row.subcategory_id)?.category_id) || '' })
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
    const isCreate = !form.id
    const payload: Omit<SiteFormState, 'id' | 'category_id' | 'sort_order'> & { sort_order?: string } = {
      subcategory_id: form.subcategory_id,
      name: form.name,
      url: form.url,
      description: form.description,
      keywords: form.keywords,
      favicon_url: form.favicon_url,
      image_url: form.image_url,
      is_featured: form.is_featured,
      is_hot: form.is_hot,
      is_new: form.is_new,
      is_active: form.is_active,
      sort_order: form.sort_order,
    }
    if (isCreate && !payload.sort_order) payload.sort_order = await siteApi.endKeyForSub(payload.subcategory_id)
    else if (!payload.sort_order) delete payload.sort_order
    if (form.id) await siteApi.update(form.id, payload)
    else await siteApi.create(payload)
    ElMessage.success(form.id ? '更新成功' : '新增成功')
    dialogVisible.value = false
    if (!isCreate) {
      await fetchPaged() // 更新：留在本页刷新
    } else if (page.value === 1) {
      await fetchPaged()
    } else {
      page.value = 1 // watcher 自动拉取第一页；不能再手动调一次，否则一次保存发两次请求
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
async function handleDelete(row: Site): Promise<void> {
  await ElMessageBox.confirm(`确定删除「${row.name}」吗？`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
  try {
    await siteApi.remove(row.id)
    ElMessage.success('已删除')
    // 本页删空且不在第一页：回上一页（watcher 拉取），否则直接刷新本页
    // （先判断再请求，避免“拉取一次 + 翻页又拉取一次”）
    if (sites.value.length <= 1 && page.value > 1) page.value--
    else await fetchPaged()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
async function handleBatchDelete(): Promise<void> {
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个网址吗？`, '批量删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  try {
    await siteApi.batchRemove(selected.value.map(r => r.id))
    ElMessage.success('已批量删除')
    const emptied = selected.value.length >= sites.value.length
    selected.value = []
    if (emptied && page.value > 1) page.value-- // 本页删空，回上一页（watcher 拉取）
    else await fetchPaged()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
onMounted(loadData)
</script>

<template>
  <div class="site-manage ui-page ui-page--wide">
    <div class="tb-toolbar">
      <el-input v-model="keyword" placeholder="搜索名称/网址" clearable class="tb-search" :prefix-icon="Search" />
      <el-cascader
        v-model="filterPath"
        :options="cascaderOptions"
        :props="cascaderProps"
        placeholder="按分类 / 子分类筛选"
        clearable
        collapse-tags
        collapse-tags-tooltip
        class="tb-select tb-cascader"
        :show-all-levels="false"
      />
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
      <el-table v-loading="loading" :data="sites" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column label="图标" width="70">
          <template #default="{ row }">
            <img v-if="row.image_url" :src="row.image_url" class="table-img">
            <FaviconImg v-else :candidates="faviconCandidates(row as Site)" :alt="row.name" :size="26" img-class="table-ico">
              <span class="table-letter">{{ row.name[0] }}</span>
            </FaviconImg>
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
            <el-button link type="primary" @click="openDialog(row as Site)">
              编辑
            </el-button>
            <el-button link type="danger" @click="handleDelete(row as Site)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
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
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="一句话介绍该网站" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="form.keywords" type="textarea" :rows="3" placeholder="多个关键词用逗号分隔" />
        </el-form-item>
        <el-form-item label="图标地址">
          <FaviconField v-model="form.favicon_url" :candidates="hostCandidates" placeholder="选择或手动输入图标地址，留空自动按多源解析" />
        </el-form-item>
        <el-form-item label="展示大图">
          <el-input v-model="form.image_url" placeholder="卡片大图 URL（可选）" clearable />
          <div v-if="form.image_url" class="favicon-preview__body" style="margin-top: 8px">
            <el-tooltip placement="top" effect="light" :show-after="180">
              <template #content>
                <img :src="form.image_url" alt="原图预览" style="width: 220px; height: 220px; object-fit: contain; display: block; border-radius: 8px; background: #fff" @error="onPreviewError">
              </template>
              <img :src="form.image_url" alt="大图预览" class="table-img table-img--hoverable" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--el-border-color-lighter); cursor: zoom-in" @error="onPreviewError">
            </el-tooltip>
          </div>
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
        <el-form-item label="排序键">
          <el-input v-model="form.sort_order" placeholder="留空自动排到同组末尾" />
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
.site-manage .tb-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--card-bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  box-shadow: var(--shadow-card);
  margin-bottom: var(--space-4);
}
.site-manage .tb-toolbar::-webkit-scrollbar {
  display: none;
}
.site-manage .tb-search {
  width: 200px;
  flex: 0 1 200px;
  min-width: 160px;
}
.site-manage .tb-cascader {
  width: 220px;
  flex: 0 1 220px;
  min-width: 180px;
}
.site-manage .tb-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-left: 12px;
  border-left: 1px solid var(--border-soft);
}
:deep(.tb-search .el-input__wrapper),
:deep(.tb-cascader .el-input__wrapper) {
  border-radius: var(--radius-md);
  background: rgb(var(--color-bg-card-hover));
  box-shadow: none;
  border: 1px solid transparent;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s;
  padding: 1px 10px;
}
:deep(.tb-search .el-input__wrapper.is-focus),
:deep(.tb-cascader .el-input__wrapper.is-focus) {
  background: var(--card-bg);
  border-color: rgb(var(--color-primary) / 0.35);
  box-shadow: var(--ring-focus);
}
:deep(.tb-search .el-input__inner),
:deep(.tb-cascader .el-input__inner) {
  font-size: var(--text-sm);
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
.tag-gap {
  margin-right: var(--space-1);
}
.table-img--hoverable {
  transition: transform 0.15s;
  &:hover {
    transform: scale(1.03);
  }
}
</style>
