<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { SortableEvent } from 'sortablejs'
import type { CategoryHome, SiteHome, SubcategoryHome } from '@/types'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import FaviconField from '@/components/FaviconField.vue'
import SiteCard from '@/components/SiteCard.vue'
import SiteSearch from '@/components/SiteSearch.vue'
import { useDragOrder } from '@/composables/use-drag-order'
import { useHomeData } from '@/composables/use-home-data'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { isDeleteConfirmed } from '@/utils/confirm'
import { getFaviconCandidates } from '@/utils/favicon'
import { groupBy } from '@/utils/group'

const auth = useAuthStore()
const router = useRouter()
const {
  loading,
  error,
  categories,
  subcategories,
  sites,
  hasCache,
  loadData,
  syncHomeCache,
} = useHomeData({
  onSettled: async () => {
    await setupReveal()
    setupActiveObserver()
    initGridSortables()
    initMenuSortables()
    refreshSortableDisabled()
  },
})
// 推荐是 is_featured 的派生视图（见 featuredSites），不另存一份状态，
// 避免拖拽/编辑后两处数据互相过期（曾用 featured ref 手工同步）。
type RecMode = 'hot' | 'new'
const recMode = ref<RecMode>('hot')
const activeSub = reactive<Record<string, string | null>>({})
const activeCat = ref<string | null>(null)
const sideOpen = ref(false)
const menuRef = ref<{ open?: (index: string) => void }>()

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，摸鱼人也该睡了'
  if (h < 11) return '早上好，摸鱼人'
  if (h < 14) return '中午好，吃饱了才好摸鱼'
  if (h < 18) return '下午好，摸鱼人'
  return '晚上好，今天的班辛苦啦'
}

// ---------- 编辑模式开关（前置声明：左侧菜单点击改道要用到） ----------
const editMode = ref(false)
watch(() => auth.isLoggedIn, (v) => {
  if (!v) editMode.value = false
})

const leftActive = ref('')
const leftOpeneds = computed(() => {
  if (!leftActive.value) return []
  const sep = leftActive.value.indexOf('::')
  if (sep > 0) return [leftActive.value.slice(0, sep)]
  if (leftActive.value.startsWith('feature')) return ['feature']
  return []
})
function onMenuSelect(index: string): void {
  // 编辑模式下点二级菜单直接进编辑，不做导航筛选
  if (editMode.value && !index.startsWith('feature')) {
    const sep = index.indexOf('::')
    if (sep > 0) {
      const sub = subcategories.value.find(s => String(s.id) === index.slice(sep + 2))
      if (sub) return openSubDialog(sub)
    }
    return
  }
  if (index.startsWith('feature-')) {
    leftActive.value = index
    return setRecMode(index === 'feature-new' ? 'new' : 'hot')
  }
  const sep = index.indexOf('::')
  if (sep > 0) {
    const catId = index.slice(0, sep)
    const subId = index.slice(sep + 2)
    activeSub[catId] = subId
    leftActive.value = index
    scrollToId(catId)
  }
}
watch(leftOpeneds, (ids) => {
  nextTick(() => ids.forEach(id => menuRef.value?.open?.(id)))
})

// ---------- 派生数据（Map 索引避免每行 filter；键统一用 String(id)，
// 调用方不再需要数字/字符串双写、双查） ----------
const subsByCat = computed(() => groupBy(subcategories.value, s => s.category_id))
const sitesBySub = computed(() => groupBy(sites.value, s => s.subcategory_id))
const sitesByCat = computed(() => {
  const m = new Map<string, SiteHome[]>()
  for (const cat of categories.value) {
    const subs = subsByCat.value.get(String(cat.id)) || []
    const list: SiteHome[] = []
    for (const sub of subs) {
      const arr = sitesBySub.value.get(String(sub.id))
      if (arr) list.push(...arr)
    }
    m.set(String(cat.id), list)
  }
  return m
})
// 推荐列表从主数组派生（保持与拖拽排序同步），热门/最新只是过滤视角
const featuredSites = computed(() => sites.value.filter(s => s.is_featured))
const featuredList = computed(() => {
  // “最新”按创建时间倒序：时间戳只解析一次（decorate-sort-undecorate），
  // 不在 comparator 里反复 new Date（原写法每次比较都解析两次）。
  if (recMode.value === 'new') {
    return featuredSites.value
      .map(s => ({ s, t: Date.parse(s.created_at || '') || 0 }))
      .sort((a, b) => b.t - a.t)
      .map(({ s }) => s)
  }
  const hot = featuredSites.value.filter(s => s.is_hot)
  return hot.length ? hot : featuredSites.value
})
function subsOf(id: string | number): SubcategoryHome[] {
  return subsByCat.value.get(String(id)) || []
}
function sitesOf(id: string | number): SiteHome[] {
  const key = String(id)
  const fid = activeSub[key]
  return fid ? (sitesBySub.value.get(fid) || []) : (sitesByCat.value.get(key) || [])
}
function activeSubOf(id: string | number): string | null {
  return activeSub[String(id)] ?? null
}
function initDefaultSubs(): void {
  for (const cat of categories.value) {
    const key = String(cat.id)
    if (activeSub[key] == null) {
      const subs = subsOf(cat.id)
      if (subs.length) activeSub[key] = String(subs[0].id)
    }
  }
}
watch([categories, subcategories], () => {
  if (categories.value.length && subcategories.value.length) initDefaultSubs()
}, { immediate: true })

let scrollLockTimer: ReturnType<typeof setTimeout> | null = null
let scrollLocked = false
function lockScroll(ms = 700): void {
  scrollLocked = true
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
  scrollLockTimer = setTimeout(() => {
    scrollLocked = false
    updateActive()
  }, ms)
}
function scrollTo(el: Element | null | undefined, opts: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }): void {
  if (!el) return
  lockScroll()
  el.scrollIntoView(opts)
}
function scrollToId(catId: string | number): void {
  scrollTo(document.getElementById(`cat-${catId}`))
}
function goCategory(catId: string | number): void {
  router.push({ name: 'category', params: { id: catId } })
}
function scrollToFeature(): void {
  scrollTo(document.querySelector('.category-anchor[data-scroll="feature"]'))
}
function toggleSub(cat: CategoryHome, sub: SubcategoryHome): void {
  const key = String(cat.id)
  const sid = String(sub.id)
  activeSub[key] = activeSub[key] === sid ? null : sid
  // 右侧点击只切筛选，不碰 leftActive，避免左侧菜单自动展开
}
function setRecMode(mode: RecMode): void {
  recMode.value = mode
  scrollToFeature()
}

// ---------- 卡片入场（精简：首屏直接 inview，其余 IO） ----------
let revealIo: IntersectionObserver | null = null
async function setupReveal(): Promise<void> {
  await nextTick()
  revealIo?.disconnect()
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('inview')
        io.unobserve(e.target)
      }
    }
  }, { rootMargin: '0px 0px 500px 0px', threshold: 0 })
  revealIo = io
  for (const el of document.querySelectorAll('.category-section')) {
    if (el.getBoundingClientRect().top < window.innerHeight + 500) el.classList.add('inview')
    else io.observe(el)
  }
}

// 左侧菜单拖拽排序：一级挂根 ul（读 DOM 顺序重排全量），二级各挂各的 inline ul（天然不出父级）
// persist 与实例状态声明前置，供下方函数使用
const { persistMoved: persistSiteMoved } = useDragOrder({
  save: async (id, sort_order) => {
    await siteApi.update(String(id), { sort_order })
    syncHomeCache()
  },
  reload: () => loadData({ silent: true, force: true }),
})
const { persistMoved: persistCatMoved } = useDragOrder({
  save: (id, sort_order) => categoryApi.update(String(id), { sort_order }),
  reload: () => loadData({ silent: true, force: true }),
})
const { persistMoved: persistSubMoved } = useDragOrder({
  save: (id, sort_order) => subcategoryApi.update(String(id), { sort_order }),
  reload: () => loadData({ silent: true, force: true }),
})
const menuSortables: Sortable[] = []

// --- 网格拖拽排序（SortableJS）：网格内自由拖拽，按落点前后邻居生成 fractional 键 ---
// 容器级实例；onEnd 重排主数组并持久化（只 update 被移动的一条）
//
// 已知取舍（2026-09-12）：全站共用一套 sort_order。智能推荐是 is_featured 的虚拟聚合视图，
// 没有独立顺序——推荐区拖拽改键会连带改变该站在其原子分类 tab 中的相对位置，反之亦然。
// 若未来要“推荐区顺序”与“分类内顺序”相互独立，需加第二套键（如 featured_order 列 +
// 推荐区按它排序+拖拽只写它），并给现有推荐回填初始键。当前保持单键耦合，改一处、处处一致。
const gridSortables: Sortable[] = []
function destroyGridSortables(): void {
  for (const s of gridSortables.splice(0)) s.destroy()
}
function gridListOf(catId: string): SiteHome[] {
  if (catId === 'featured') return featuredList.value
  return sitesByCat.value.get(String(catId)) ?? []
}
function gridDragDisabled(cid: string | undefined): boolean {
  // “最新”视角按创建时间排序，拖拽无意义，直接禁用该网格
  return !editMode.value || (cid === 'featured' && recMode.value === 'new')
}
function refreshSortableDisabled(): void {
  for (const s of gridSortables) {
    const cid = s.el.dataset.grid === 'featured' ? 'featured' : s.el.dataset.catId
    s.option('disabled', gridDragDisabled(cid))
  }
  for (const s of menuSortables) s.option('disabled', !editMode.value)
}
function onGridEnd(catId: string, evt: SortableEvent): void {
  const { oldIndex, newIndex } = evt
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
  // 主数组尚未动：getter 仍是拖拽前顺序
  const before = [...gridListOf(catId)]
  const [moved] = before.splice(oldIndex, 1)
  if (!moved) return
  before.splice(newIndex, 0, moved)
  // 合并回主数组（非本网格条目保持原位）
  const inGrid = new Set(before.map(s => String(s.id)))
  const queue = [...before]
  sites.value.splice(0, sites.value.length, ...sites.value.map(s => (inGrid.has(String(s.id)) ? queue.shift() ?? s : s)))
  void persistSiteMoved(before, moved.id)
}
function initGridSortables(): void {
  destroyGridSortables()
  for (const el of document.querySelectorAll('.page-home .card-grid')) {
    const cid = (el as HTMLElement).dataset.grid === 'featured' ? 'featured' : (el as HTMLElement).dataset.catId ?? ''
    gridSortables.push(Sortable.create(el as HTMLElement, {
      animation: 150,
      draggable: '.site-card',
      ghostClass: 'sort-ghost',
      chosenClass: 'is-dragging',
      disabled: true,
      onEnd: evt => onGridEnd(cid, evt),
    }))
  }
}
watch(editMode, refreshSortableDisabled)
watch(recMode, refreshSortableDisabled)

function destroyMenuSortables(): void {
  for (const s of menuSortables.splice(0)) s.destroy()
}
function onMenuCatEnd(evt: SortableEvent): void {
  // 根 ul 里还有固定的推荐菜单：按 data-cat-id 读一级顺序，不受其下标干扰
  const movedId = String(evt.item?.dataset?.catId || '')
  if (!movedId) return
  const from = evt.from as HTMLElement
  const ids = [...from.querySelectorAll(':scope > .el-sub-menu[data-cat-id]')].map(li => String((li as HTMLElement).dataset.catId))
  const byId = new Map(categories.value.map(c => [String(c.id), c]))
  const ordered = ids.map(id => byId.get(id)).filter((c): c is CategoryHome => !!c)
  categories.value.splice(0, categories.value.length, ...ordered)
  void persistCatMoved(categories.value, movedId)
}
function onMenuSubEnd(catId: string | undefined, evt: SortableEvent): void {
  const { oldIndex, newIndex } = evt
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
  const list = subcategories.value.filter(s => String(s.category_id) === String(catId))
  const [moved] = list.splice(oldIndex, 1)
  if (!moved) return
  list.splice(newIndex, 0, moved)
  const inCat = new Set(list.map(s => String(s.id)))
  const queue = [...list]
  subcategories.value.splice(0, subcategories.value.length, ...subcategories.value.map(s => (inCat.has(String(s.id)) ? queue.shift() ?? s : s)))
  void persistSubMoved(subcategories.value, moved.id)
}
function initMenuSortables(): void {
  destroyMenuSortables()
  const root = document.querySelector('.page-home .main-menu')
  if (!root) return
  menuSortables.push(Sortable.create(root as HTMLElement, {
    animation: 150,
    draggable: '.el-sub-menu[data-cat-id]',
    handle: '.menu-drag',
    ghostClass: 'menu-ghost',
    disabled: true,
    onEnd: onMenuCatEnd,
  }))
  for (const li of root.querySelectorAll(':scope > .el-sub-menu[data-cat-id]')) {
    const ul = li.querySelector(':scope > ul')
    if (!ul) continue
    const cid = (li as HTMLElement).dataset.catId
    menuSortables.push(Sortable.create(ul as HTMLElement, {
      animation: 150,
      draggable: '.el-menu-item',
      handle: '.menu-drag',
      ghostClass: 'menu-ghost',
      disabled: true,
      onEnd: evt => onMenuSubEnd(cid, evt),
    }))
  }
}

const catDialogVisible = ref(false)
const catSaving = ref(false)
const catFormRef = ref<FormInstance>()

interface CatFormState {
  id: string | null
  name: string
  slug: string
  icon: string
  description: string
}

const catForm = reactive<CatFormState>({ id: null, name: '', slug: '', icon: '', description: '' })
const catRules: FormRules<CatFormState> = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入标识', trigger: 'blur' }],
}
function openCatDialog(cat: CategoryHome): void {
  Object.assign(catForm, { id: cat.id, name: cat.name, slug: cat.slug || '', icon: cat.icon || '', description: cat.description || '' })
  catDialogVisible.value = true
}
// 分类 / 子分类弹窗共用保存流程：校验 → 写库 → 同步本地行 → 同步缓存 → 关窗
async function saveMenuRow<TForm extends { id: string | number | null }, TRow extends { id: string | number | null }>(args: {
  formRef: Ref<FormInstance | undefined>
  saving: Ref<boolean>
  form: TForm
  update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
  rows: Ref<TRow[]>
  close: () => void
}): Promise<void> {
  const { formRef, saving, form, update, rows, close } = args
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const { id, ...payload } = form
    if (id == null) return
    await update(String(id), payload)
    const i = rows.value.findIndex(r => String(r.id) === String(id))
    if (i >= 0) Object.assign(rows.value[i], payload)
    syncHomeCache()
    close()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
async function saveCat(): Promise<void> {
  await saveMenuRow({
    formRef: catFormRef,
    saving: catSaving,
    form: catForm,
    update: (id, payload) => categoryApi.update(id, payload as Partial<{ name: string, slug: string, icon: string, description: string }>),
    rows: categories,
    close: () => (catDialogVisible.value = false),
  })
}

const catDeleting = ref(false)
async function handleCatDelete(): Promise<void> {
  if (!catForm.id) return
  const key = String(catForm.id)
  const cat = categories.value.find(c => String(c.id) === key)
  const subs = subsByCat.value.get(key) || []
  const siteCount = sitesByCat.value.get(key)?.length ?? 0
  // 库里 subcategories/sites 对上级是 on delete cascade，删除分类会连子级一起没了，
  // 确认文案必须把连带数量说清楚，避免误删整个板块
  const detail = subs.length
    ? `其下 ${subs.length} 个子分类、${siteCount} 个网址将一并删除，且不可恢复`
    : '删除后不可恢复'
  if (!await isDeleteConfirmed(`确定删除分类「${cat?.name || catForm.name}」吗？${detail}。`))
    return
  catDeleting.value = true
  try {
    await categoryApi.remove(key)
    // 服务端已级联删除子分类和网址，本地同步清掉，否则缓存和站点计数会残留幽灵数据
    const subIds = new Set(subs.map(s => String(s.id)))
    sites.value.splice(0, sites.value.length, ...sites.value.filter(s => !s.subcategory_id || !subIds.has(String(s.subcategory_id))))
    subcategories.value.splice(0, subcategories.value.length, ...subcategories.value.filter(s => !subIds.has(String(s.id))))
    const ci = categories.value.findIndex(c => String(c.id) === key)
    if (ci >= 0) categories.value.splice(ci, 1)
    delete activeSub[key]
    if (leftActive.value.startsWith(`${key}::`)) leftActive.value = ''
    syncHomeCache()
    catDialogVisible.value = false
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  } finally {
    catDeleting.value = false
  }
}
const subDialogVisible = ref(false)
const subSaving = ref(false)
const subFormRef = ref<FormInstance>()

interface SubFormState {
  id: string | null
  category_id: string
  name: string
  slug: string
}

const subForm = reactive<SubFormState>({ id: null, category_id: '', name: '', slug: '' })
const subRules: FormRules<SubFormState> = {
  category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入子分类名称', trigger: 'blur' }],
}
function openSubDialog(sub: SubcategoryHome): void {
  Object.assign(subForm, { id: sub.id, category_id: sub.category_id, name: sub.name, slug: sub.slug || '' })
  subDialogVisible.value = true
}
async function saveSub(): Promise<void> {
  await saveMenuRow({
    formRef: subFormRef,
    saving: subSaving,
    form: subForm,
    update: (id, payload) => subcategoryApi.update(id, payload as Partial<SubcategoryHome>),
    rows: subcategories,
    close: () => (subDialogVisible.value = false),
  })
}

const subDeleting = ref(false)
async function handleSubDelete(): Promise<void> {
  if (!subForm.id) return
  const key = String(subForm.id)
  const sub = subcategories.value.find(s => String(s.id) === key)
  const siteCount = sitesBySub.value.get(key)?.length ?? 0
  const detail = siteCount ? `其下 ${siteCount} 个网址将一并删除，且不可恢复` : '删除后不可恢复'
  if (!await isDeleteConfirmed(`确定删除子分类「${sub?.name || subForm.name}」吗？${detail}。`))
    return
  subDeleting.value = true
  try {
    await subcategoryApi.remove(key)
    // 网址随外键级联删除，本地同步清掉再写缓存
    sites.value.splice(0, sites.value.length, ...sites.value.filter(s => String(s.subcategory_id) !== key))
    const si = subcategories.value.findIndex(s => String(s.id) === key)
    if (si >= 0) subcategories.value.splice(si, 1)
    const catKey = String(subForm.category_id)
    if (activeSub[catKey] === key) activeSub[catKey] = null
    if (leftActive.value === `${catKey}::${key}`) leftActive.value = ''
    syncHomeCache()
    subDialogVisible.value = false
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  } finally {
    subDeleting.value = false
  }
}

const editDialogVisible = ref(false)
const editSaving = ref(false)
const editFormRef = ref<FormInstance>()
const originalSubId = ref('')

interface EditFormState {
  id: string | null
  category_id: string
  subcategory_id: string
  name: string
  url: string
  description: string
  keywords: string
  favicon_url: string
  is_featured: boolean
  is_hot: boolean
  is_new: boolean
  is_active: boolean
}

const editForm = reactive<EditFormState>({
  id: null,
  category_id: '',
  subcategory_id: '',
  name: '',
  url: '',
  description: '',
  keywords: '',
  favicon_url: '',
  is_featured: false,
  is_hot: false,
  is_new: false,
  is_active: true,
})
const editRules: FormRules<EditFormState> = {
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
const editFaviconCandidates = computed(() =>
  editForm.url ? getFaviconCandidates({ url: editForm.url }) : [],
)
function openEditDialog(site: SiteHome): void {
  const sub = subcategories.value.find(s => String(s.id) === String(site.subcategory_id))
  Object.assign(editForm, {
    id: site.id,
    category_id: sub ? sub.category_id : '',
    subcategory_id: site.subcategory_id ?? '',
    name: site.name,
    url: site.url,
    description: site.description || '',
    keywords: site.keywords || '',
    favicon_url: site.favicon_url || '',
    is_featured: !!site.is_featured,
    is_hot: !!site.is_hot,
    is_new: !!site.is_new,
    is_active: site.is_active !== false,
  })
  originalSubId.value = site.subcategory_id ?? ''
  editDialogVisible.value = true
}
async function saveEdit(): Promise<void> {
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  if (!editForm.subcategory_id) {
    ElMessage.warning('请选择所属子分类')
    return
  }
  if (!editForm.id) return
  editSaving.value = true
  try {
    const payload: {
      name: string
      url: string
      description: string
      keywords: string
      favicon_url: string
      is_featured: boolean
      is_hot: boolean
      is_new: boolean
      is_active: boolean
      subcategory_id?: string
      sort_order?: string
    } = {
      name: editForm.name,
      url: editForm.url,
      description: editForm.description,
      keywords: editForm.keywords,
      favicon_url: editForm.favicon_url,
      is_featured: editForm.is_featured,
      is_hot: editForm.is_hot,
      is_new: editForm.is_new,
      is_active: editForm.is_active,
    }
    const subChanged = editForm.subcategory_id !== originalSubId.value
    if (subChanged) {
      // 换组：排到新组末尾
      payload.subcategory_id = editForm.subcategory_id
      payload.sort_order = await siteApi.endKeyForSub(editForm.subcategory_id)
    }
    await siteApi.update(editForm.id, payload)
    editDialogVisible.value = false
    ElMessage.success('已保存')
    if (subChanged) {
      // 跨组移动涉及分组展示，整体静默重拉最稳
      await loadData({ silent: true, force: true })
      return
    }
    const idx = sites.value.findIndex(s => s.id === editForm.id)
    if (idx >= 0) sites.value.splice(idx, 1, { ...sites.value[idx], ...payload })
    syncHomeCache()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    editSaving.value = false
  }
}

const editDeleting = ref(false)
async function handleEditDelete(): Promise<void> {
  if (!editForm.id) return
  const target = sites.value.find(s => s.id === editForm.id)
  if (!await isDeleteConfirmed(`确定删除「${target?.name || editForm.name || ''}」吗？删除后不可恢复。`))
    return
  editDeleting.value = true
  try {
    await siteApi.remove(editForm.id)
    const i = sites.value.findIndex(s => s.id === editForm.id)
    if (i >= 0) sites.value.splice(i, 1)
    syncHomeCache()
    editDialogVisible.value = false
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  } finally {
    editDeleting.value = false
  }
}

// ---------- 滚动高亮：scroll 扫描替代 IO（修复大区块误判） ----------
let activeIo: IntersectionObserver | null = null
let activeRaf: number | null = null
let onScroll: (() => void) | null = null
// 滚动吸附偏移：与 scroll-margin-top 保持一致，
// --ui-header-height(64) + --space-4(16) + 8 容差
const HEADER_OFFSET_PX = 88
function updateActive(): void {
  if (scrollLocked) return
  const anchors = document.querySelectorAll('.category-anchor')
  if (!anchors.length) return
  const offset = HEADER_OFFSET_PX
  let best: Element | null = null
  let bestTop = -Infinity
  for (const el of anchors) {
    const top = el.getBoundingClientRect().top
    if (top <= offset) {
      if (top > bestTop) {
        bestTop = top
        best = el
      }
    }
  }
  // 顶部未越过 offset 时保持首个（feature）
  if (!best) best = anchors[0]
  if (!best) return
  if ((best as HTMLElement).dataset.scroll === 'feature') {
    activeCat.value = null
  } else {
    const sec = best.querySelector('[id^="cat-"]')
    const bestId = (best as HTMLElement).id
    const raw = bestId?.startsWith('cat-') ? bestId.slice(4) : sec?.id?.slice(4) ?? null
    activeCat.value = raw ? String(raw) : null
  }
}
function setupActiveObserver(): void {
  activeIo?.disconnect()
  if (onScroll) window.removeEventListener('scroll', onScroll)
  if (activeRaf != null) cancelAnimationFrame(activeRaf)
  const anchors = document.querySelectorAll('.category-anchor')
  if (!anchors.length) return
  // rAF 节流的 scroll 扫描：对大区块也精准在 header 线切换
  onScroll = () => {
    if (scrollLocked) return
    if (activeRaf != null) return
    activeRaf = requestAnimationFrame(() => {
      activeRaf = null
      updateActive()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  // IO 仅作补充触发（containment / 懒加载后重算），不依赖 entries
  activeIo = new IntersectionObserver(() => updateActive(), { rootMargin: `-${HEADER_OFFSET_PX}px 0px -55% 0px`, threshold: 0 })
  for (const el of anchors) activeIo.observe(el)
  updateActive()
}

// ---------- 右下角悬浮操作（编辑开关 + 回到顶部） ----------
const showTop = ref(false)
function updateShowTop(): void {
  showTop.value = window.scrollY > 300
}
function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  updateShowTop()
  window.addEventListener('scroll', updateShowTop, { passive: true })
  // 有缓存：先完成首屏渲染（入场/高亮），再静默校验版本
  if (hasCache) {
    await setupReveal()
    setupActiveObserver()
    loadData({ silent: true })
    return
  }
  await loadData()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateShowTop)
  destroyGridSortables()
  destroyMenuSortables()
  revealIo?.disconnect()
  activeIo?.disconnect()
  if (onScroll) {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  }
  if (activeRaf != null) cancelAnimationFrame(activeRaf)
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
})
</script>

<template>
  <div class="page-container page-home">
    <div class="page-home-top">
      <div class="layout-search">
        <div v-if="!loading" class="hero-intro">
          <h1 class="hero-title">
            {{ greeting() }}
          </h1>
          <p class="hero-sub">
            已收录 <b>{{ sites.length }}</b> 个摸鱼入口 <i>·</i> 覆盖 <b>{{ categories.length }}</b> 个分类
          </p>
        </div>
        <SiteSearch show-engines />
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated class="skeleton" />
    <el-empty v-else-if="error" :description="error">
      <el-button type="primary" @click="loadData({ force: true })">
        重新加载
      </el-button>
    </el-empty>

    <template v-else>
      <div class="wrapper page-home-content">
        <transition name="el-fade-in-linear">
          <div v-if="editMode" class="edit-banner">
            <el-icon><InfoFilled /></el-icon>
            <span>编辑模式：拖拽调整顺序，点击卡片或菜单进行编辑</span>
          </div>
        </transition>
        <div class="page-main">
          <aside class="aside" :class="{ 'menu-open': sideOpen }">
            <div class="aside-sticky">
              <div class="aside-head">
                <span class="aside-kicker">INDEX / 目录</span>
                <span class="aside-count">{{ categories.length }} 分类 · {{ sites.length }} 站点</span>
              </div>
              <el-menu ref="menuRef" class="main-menu" unique-opened :default-active="leftActive" :default-openeds="leftOpeneds" @select="onMenuSelect">
                <el-sub-menu index="feature" :class="{ 'is-nav-active': !activeCat }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="scrollToFeature">
                      <span class="sub-icon-box"><el-icon><Trophy /></el-icon></span>
                      <span>智能推荐</span>
                      <span class="sub-count">{{ featuredSites.length }}</span>
                    </div>
                  </template>
                  <el-menu-item index="feature-hot">
                    热门
                  </el-menu-item>
                  <el-menu-item index="feature-new">
                    最新
                  </el-menu-item>
                </el-sub-menu>
                <el-sub-menu v-for="cat in categories" :key="cat.id" :index="String(cat.id)" :data-cat-id="cat.id" :class="{ 'is-nav-active': String(activeCat) === String(cat.id) }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="editMode ? openCatDialog(cat) : scrollToId(cat.id)">
                      <span v-if="editMode" class="menu-drag" title="拖拽排序">⠿</span>
                      <span class="sub-icon-box"><el-icon><component :is="cat.icon || 'Folder'" /></el-icon></span>
                      <span class="sub-name">{{ cat.name }}</span>
                      <span class="sub-count">{{ subsOf(cat.id).length }}</span>
                    </div>
                  </template>
                  <el-menu-item v-for="sub in subsOf(cat.id)" :key="sub.id" :index="`${cat.id}::${sub.id}`" :class="{ 'is-active': activeSub[String(cat.id)] === String(sub.id) }">
                    {{ sub.name }}
                    <span v-if="editMode" class="menu-drag" title="拖拽排序">⠿</span>
                  </el-menu-item>
                </el-sub-menu>
              </el-menu>
            </div>
            <div v-if="sideOpen" class="menu-backdrop menu-open" @click="sideOpen = false" />
            <el-button class="menu-toggle" circle @click="sideOpen = !sideOpen">
              <el-icon><Menu /></el-icon>
            </el-button>
          </aside>

          <div class="content">
            <div class="category-anchor" data-scroll="feature">
              <section class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-icon"><el-icon><Trophy /></el-icon></span>
                    <h2 class="section-title">
                      智能推荐
                    </h2>
                  </div>
                </div>
                <div class="child-tabs">
                  <el-check-tag :checked="recMode === 'hot'" @change="setRecMode('hot')">
                    热门
                  </el-check-tag>
                  <el-check-tag :checked="recMode === 'new'" @change="setRecMode('new')">
                    最新
                  </el-check-tag>
                </div>
                <div class="section-content">
                  <div
                    v-if="featuredList.length"
                    class="card-grid"
                    :class="{ 'is-edit': editMode }"
                    data-grid="featured"
                  >
                    <SiteCard
                      v-for="(site, idx) in featuredList"
                      :key="site.id"
                      :site="site"
                      :edit-mode="editMode"
                      :style="{ '--i': idx }"
                      @edit="openEditDialog(site)"
                    />
                  </div>
                  <el-empty v-else :image-size="60" description="暂无推荐内容" />
                </div>
              </section>
            </div>

            <div v-for="cat in categories" :key="cat.id" class="category-anchor">
              <section :id="`cat-${cat.id}`" class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-icon"><el-icon><component :is="cat.icon || 'Folder'" /></el-icon></span>
                    <h2 class="section-title">
                      {{ cat.name }}
                    </h2>
                  </div>
                  <el-button link type="primary" class="section-more" @click="goCategory(cat.id)">
                    <el-icon><ArrowRight /></el-icon>
                  </el-button>
                </div>
                <div class="child-tabs">
                  <el-check-tag v-for="sub in subsOf(cat.id)" :key="sub.id" :checked="activeSubOf(cat.id) === String(sub.id)" @change="toggleSub(cat, sub)">
                    {{ sub.name }}
                  </el-check-tag>
                </div>
                <div class="section-content">
                  <div
                    v-if="sitesOf(cat.id).length"
                    class="card-grid"
                    :class="{ 'is-edit': editMode }"
                    data-grid="cat"
                    :data-cat-id="cat.id"
                  >
                    <SiteCard
                      v-for="(site, idx) in sitesOf(cat.id)"
                      :key="site.id"
                      :site="site"
                      :edit-mode="editMode"
                      :style="{ '--i': idx }"
                      @edit="openEditDialog(site)"
                    />
                  </div>
                  <el-empty v-else :image-size="60" description="该分类暂无网址" />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 右下角悬浮操作：编辑开关（登录后可见）+ 回到顶部（滚过阈值后出现） -->
    <div class="fab-stack">
      <el-tooltip v-if="auth.isLoggedIn && !loading" :content="editMode ? '完成编辑' : '编辑模式'" placement="left">
        <el-button
          class="fab-btn"
          :type="editMode ? 'primary' : 'default'"
          circle
          @click="editMode = !editMode"
        >
          <el-icon>
            <EditPen v-if="!editMode" />
            <Check v-else />
          </el-icon>
        </el-button>
      </el-tooltip>
      <transition name="el-fade-in-linear">
        <el-tooltip v-if="showTop" content="回到顶部" placement="left">
          <el-button class="fab-btn" circle @click="scrollToTop">
            <el-icon><Top /></el-icon>
          </el-button>
        </el-tooltip>
      </transition>
    </div>

    <el-dialog v-model="editDialogVisible" title="编辑网址" width="520px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="90px">
        <el-form-item label="所属分类">
          <el-select v-model="editForm.category_id" placeholder="选择主分类" style="width: 100%" @change="editForm.subcategory_id = ''">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属子分类">
          <el-select v-model="editForm.subcategory_id" placeholder="选择子分类" style="width: 100%">
            <el-option v-for="s in subsOf(editForm.category_id)" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="网站名称" prop="name">
          <el-input v-model="editForm.name" placeholder="网站名称" />
        </el-form-item>
        <el-form-item label="网站链接" prop="url">
          <el-input v-model="editForm.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.description" type="textarea" :rows="2" placeholder="一句话介绍该网站" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="editForm.keywords" type="textarea" :rows="2" placeholder="多个关键词用逗号分隔" />
        </el-form-item>
        <el-form-item label="图标地址">
          <FaviconField v-model="editForm.favicon_url" :candidates="editFaviconCandidates" />
        </el-form-item>
        <el-form-item label="标记">
          <el-checkbox v-model="editForm.is_featured">
            首页推荐
          </el-checkbox>
          <el-checkbox v-model="editForm.is_hot">
            热门
          </el-checkbox>
          <el-checkbox v-model="editForm.is_new">
            最新
          </el-checkbox>
          <el-checkbox v-model="editForm.is_active">
            启用
          </el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <el-button type="danger" plain :loading="editDeleting" @click="handleEditDelete">
            删除
          </el-button>
          <div>
            <el-button @click="editDialogVisible = false">
              取消
            </el-button>
            <el-button type="primary" :loading="editSaving" @click="saveEdit">
              保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="catDialogVisible" title="编辑分类" width="480px" destroy-on-close>
      <el-form ref="catFormRef" :model="catForm" :rules="catRules" label-width="90px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="catForm.name" placeholder="例如：生活服务" />
        </el-form-item>
        <el-form-item label="标识 slug" prop="slug">
          <el-input v-model="catForm.slug" placeholder="例如：life" />
        </el-form-item>
        <el-form-item label="分类图标">
          <el-input v-model="catForm.icon" placeholder="图标文本（可选）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="catForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <el-button type="danger" plain :loading="catDeleting" @click="handleCatDelete">
            删除
          </el-button>
          <div>
            <el-button @click="catDialogVisible = false">
              取消
            </el-button>
            <el-button type="primary" :loading="catSaving" @click="saveCat">
              保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="subDialogVisible" title="编辑子分类" width="480px" destroy-on-close>
      <el-form ref="subFormRef" :model="subForm" :rules="subRules" label-width="100px">
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="subForm.category_id" placeholder="选择主分类" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="子分类名称" prop="name">
          <el-input v-model="subForm.name" placeholder="例如：即时资讯" />
        </el-form-item>
        <el-form-item label="标识 slug">
          <el-input v-model="subForm.slug" placeholder="例如：news" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <el-button type="danger" plain :loading="subDeleting" @click="handleSubDelete">
            删除
          </el-button>
          <div>
            <el-button @click="subDialogVisible = false">
              取消
            </el-button>
            <el-button type="primary" :loading="subSaving" @click="saveSub">
              保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" src="./styles/home.scss"></style>
