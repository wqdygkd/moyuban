<script setup>
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import FaviconImg from '@/components/FaviconImg.vue'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { getFaviconCandidates, getFaviconSource } from '@/utils/favicon'

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const filterCategory = ref('')
const categories = ref([])
const subcategories = ref([])
const sites = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selected = ref([])
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const dialogVisible = ref(false)
const formRef = ref()
const onSelectionChange = rows => (selected.value = rows)
function defaultForm() {
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
function faviconCandidates(row) {
  if (row.image_url) return []
  return getFaviconCandidates({ url: row.url, favicon_url: row.favicon_url })
}
function onImgError(e) {
  e.target.classList.add('is-broken')
}
function onPreviewError(e) {
  e.target.style.display = 'none'
}
const hostCandidates = computed(() => getFaviconCandidates({ url: form.url }))

async function loadMeta() {
  const [cats, subs] = await Promise.all([categoryApi.list(), subcategoryApi.list()])
  categories.value = cats
  subcategories.value = subs
}

async function fetchPaged() {
  loading.value = true
  try {
    let subcategoryIds
    if (filterCategory.value) {
      subcategoryIds = subcategories.value.filter(s => s.category_id === filterCategory.value).map(s => s.id)
      if (!subcategoryIds.length) {
        sites.value = []
        total.value = 0
        return
      }
    }
    const { data, total: t } = await siteApi.listPaged({ page: page.value, pageSize: pageSize.value, keyword: keyword.value.trim(), subcategoryIds })
    sites.value = data
    total.value = t
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadData() {
  try {
    await loadMeta()
    page.value = 1
    await fetchPaged()
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  }
}

// 搜索/筛选防抖，避免每键一次请求；page/pageSize 变更直接拉取
let searchTimer = null
watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (page.value === 1) fetchPaged()
    else page.value = 1
  }, 300)
})
watch(filterCategory, () => {
  if (page.value === 1) fetchPaged()
  else page.value = 1
})
watch(pageSize, () => {
  if (page.value === 1) fetchPaged()
  else page.value = 1
})
watch(page, fetchPaged)
onBeforeUnmount(() => clearTimeout(searchTimer))
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
    const isCreate = !id
    delete payload.category_id
    if (isCreate && !payload.sort_order) payload.sort_order = await siteApi.endKeyForSub(payload.subcategory_id)
    else if (!payload.sort_order) delete payload.sort_order
    if (id) await siteApi.update(id, payload)
    else await siteApi.create(payload)
    ElMessage.success(id ? '更新成功' : '新增成功')
    dialogVisible.value = false
    if (isCreate) {
      page.value = 1
      if (page.value === 1) await fetchPaged()
    } else {
      await fetchPaged()
    }
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
    await fetchPaged()
    if (!sites.value.length && page.value > 1) page.value--
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
    selected.value = []
    await fetchPaged()
    if (!sites.value.length && page.value > 1) page.value--
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
onMounted(loadData)
</script>

<template>
  <div class="site-manage ui-page ui-page--wide">
    <div class="tb-toolbar">
      <el-input v-model="keyword" placeholder="搜索网站名称/网址/描述" clearable class="tb-search" :prefix-icon="Search" />
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
      <el-table v-loading="loading" :data="sites" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column label="图标" width="70">
          <template #default="{ row }">
            <img v-if="row.image_url" :src="row.image_url" class="table-img">
            <FaviconImg v-else :candidates="faviconCandidates(row)" :alt="row.name" :size="26" img-class="table-ico">
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
          <el-select
            v-model="form.favicon_url"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="选择或手动输入图标地址，留空自动按多源解析"
            style="width: 100%"
          >
            <el-option label="自动（按顺序容灾）" value="" />
            <el-option v-for="u in hostCandidates" :key="u" :label="u" :value="u" />
          </el-select>
          <div class="favicon-preview">
            <div class="favicon-preview__head">
              候选预览 — 点击选用，悬停查看来源
            </div>
            <div v-if="hostCandidates.length" class="candidate-grid">
              <el-tooltip
                v-for="u in hostCandidates"
                :key="u"
                placement="top"
                effect="light"
                :show-after="180"
                :hide-after="0"
                popper-class="favicon-hover-popper"
              >
                <template #content>
                  <div class="favicon-hover-content">
                    <img :src="u" alt="原图预览" class="favicon-hover-img" loading="lazy" @error="onImgError">
                    <div class="favicon-hover-meta">
                      <span class="favicon-hover-src">{{ getFaviconSource(u) }}</span>
                      <span class="favicon-hover-url">{{ u }}</span>
                    </div>
                  </div>
                </template>
                <button
                  type="button"
                  class="candidate"
                  :class="{ 'is-selected': form.favicon_url === u }"
                  :title="`${getFaviconSource(u)} — ${u}`"
                  @click="form.favicon_url = u"
                >
                  <img :src="u" class="candidate__img" loading="lazy" @error="onImgError">
                  <span class="candidate__src">{{ getFaviconSource(u) }}</span>
                  <span class="candidate__url" :title="u">{{ u }}</span>
                </button>
              </el-tooltip>
            </div>
            <span v-else class="favicon-empty">请输入网址以生成候选</span>
            <div v-if="form.favicon_url && !hostCandidates.includes(form.favicon_url)" class="candidate-note">
              当前手动：{{ form.favicon_url }}
            </div>
          </div>
        </el-form-item>
        <el-form-item label="展示大图">
          <el-input v-model="form.image_url" placeholder="卡片大图 URL（可选）" clearable />
          <div v-if="form.image_url" class="favicon-preview__body" style="margin-top: 8px">
            <el-tooltip placement="top" effect="light" :show-after="180" popper-class="favicon-hover-popper">
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
.tb-pagination {
  margin-top: var(--space-4);
  justify-content: flex-end;
}
.tag-gap {
  margin-right: var(--space-1);
}
.favicon-preview {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.favicon-preview__head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}
.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.candidate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition:
    border-color 0.2s,
    background 0.2s;
  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
  &.is-selected {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}
.candidate__img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  object-fit: contain;
  flex-shrink: 0;
  &.is-broken {
    opacity: 0.25;
  }
}
.candidate__src {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  white-space: nowrap;
}
.candidate__url {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.candidate-note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.favicon-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.table-img--hoverable {
  transition: transform 0.15s;
  &:hover {
    transform: scale(1.03);
  }
}
</style>

<style lang="scss">
.favicon-hover-popper {
  max-width: 240px;
}
.favicon-hover-content {
  text-align: center;
}
.favicon-hover-img {
  max-width: 500px;
  max-height: 500px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  &.is-broken {
    opacity: 0.3;
  }
}
.favicon-hover-meta {
  margin-top: 8px;
}
.favicon-hover-src {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.favicon-hover-url {
  display: block;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  margin-top: 2px;
}
</style>
