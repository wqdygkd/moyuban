import type { FormInstance, FormRules } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'
import type { LoadDataOptions } from '@/composables/use-home-data'
import type { CategoryHome, SiteHome, SubcategoryHome } from '@/types'
import { ElMessage } from 'element-plus'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { isDeleteConfirmed } from '@/utils/confirm'
import { getFaviconCandidates } from '@/utils/favicon'
import { appendOrderKey } from '@/utils/order'

export interface HomeEditOptions {
  categories: Ref<CategoryHome[]>
  subcategories: Ref<SubcategoryHome[]>
  sites: Ref<SiteHome[]>
  // 派生索引：删除确认文案的连带数量、新增时的"同组末尾"排序键都依赖它们
  subsByCat: ComputedRef<Map<string, SubcategoryHome[]>>
  sitesBySub: ComputedRef<Map<string, SiteHome[]>>
  sitesByCat: ComputedRef<Map<string, SiteHome[]>>
  // 分类 -> 激活中的子分类：新增网址预选落组、删除后清理
  activeSub: Record<string, string | null>
  // 左侧菜单激活索引：删除后清理，避免指向已不存在的条目
  leftActive: Ref<string>
  // el-menu 实例：新增分类成功后自动展开其子菜单
  menuRef: Ref<{ open?: (index: string) => void } | undefined>
  syncHomeCache: () => void
  // 网址换组保存后需要整体静默重拉
  loadData: (options?: LoadDataOptions) => Promise<void>
  // 视图收尾回调：新增成功后重挂 Sortable / 补入场观察（DOM 编排留在 HomeView）
  onSubCreated: () => void
  onSiteCreated: () => void
}

/**
 * 首页编辑域：编辑模式开关 + 分类/子分类/网址三个弹窗的表单与增删改。
 * 只负责状态与写库；Sortable 重挂、入场观察等 DOM 编排经回调交还 HomeView。
 * 弹窗按表单 id 区分新增/编辑：无 id 走 create（返回行回填本地），有 id 走 update 原地合并。
 */
export function useHomeEdit(options: HomeEditOptions) {
  const { categories, subcategories, sites, subsByCat, sitesBySub, sitesByCat, activeSub, leftActive, menuRef, syncHomeCache, loadData, onSubCreated, onSiteCreated } = options
  const auth = useAuthStore()

  // ---------- 编辑模式开关 ----------
  const editMode = ref(false)
  watch(() => auth.isLoggedIn, (v) => {
    if (!v) editMode.value = false
  })

  function subsOf(id: string | number): SubcategoryHome[] {
    return subsByCat.value.get(String(id)) || []
  }

  // ---------- 分类弹窗 ----------
  const catDialogVisible = ref(false)
  const catSaving = ref(false)
  const catFormReference = ref<FormInstance>()

  interface CatFormState {
    id: string | undefined
    name: string
    slug: string
    icon: string
    description: string
  }

  const catForm = reactive<CatFormState>({ id: undefined, name: '', slug: '', icon: '', description: '' })
  const catRules: FormRules<CatFormState> = {
    name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
    slug: [{ required: true, message: '请输入标识', trigger: 'blur' }],
  }
  function openCatDialog(cat?: CategoryHome): void {
    // 无参 = 新增：表单清空
    Object.assign(catForm, cat
      ? { id: cat.id, name: cat.name, slug: cat.slug || '', icon: cat.icon || '', description: cat.description || '' }
      : { id: undefined, name: '', slug: '', icon: '', description: '' })
    catDialogVisible.value = true
  }
  // 分类 / 子分类弹窗共用保存流程：校验 → 写库 → 同步本地行 → 同步缓存 → 关窗
  // （表单 id 用 undefined 表示"新增"：本文件是 .ts，unicorn/no-null 禁止 null 值）
  async function saveMenuRow<TForm extends { id: string | number | undefined }, TRow extends { id: string | number }>(arguments_: {
    formRef: Ref<FormInstance | undefined>
    saving: Ref<boolean>
    form: TForm
    create?: (payload: Omit<TForm, 'id'>) => Promise<TRow>
    update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
    rows: Ref<TRow[]>
    close: () => void
  }): Promise<TRow | undefined> {
    const { formRef, saving, form, update, rows, close } = arguments_
    try {
      await formRef.value?.validate()
    } catch {
      return undefined
    }
    saving.value = true
    try {
      const { id, ...payload } = form
      let created: TRow | undefined
      if (id === undefined) {
        if (!arguments_.create) return undefined
        created = await arguments_.create(payload)
        rows.value.push(created)
      } else {
        await update(String(id), payload)
        const index = rows.value.findIndex(r => String(r.id) === String(id))
        if (index !== -1) Object.assign(rows.value[index], payload)
      }
      syncHomeCache()
      close()
      ElMessage.success(created ? '已新增' : '已保存')
      return created
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败')
      return undefined
    } finally {
      saving.value = false
    }
  }
  async function saveCat(): Promise<void> {
    const created = await saveMenuRow({
      formRef: catFormReference,
      saving: catSaving,
      form: catForm,
      create: (payload): Promise<CategoryHome> =>
        // 新分类固定排到末尾
        categoryApi.create({ ...payload, sort_order: appendOrderKey(categories.value) }),
      update: (id, payload) => categoryApi.update(id, payload as Partial<{ name: string, slug: string, icon: string, description: string }>),
      rows: categories,
      close: () => (catDialogVisible.value = false),
    })
    // 新分类默认折叠且 unique-opened，自动展开让「新增子分类」入口可见
    if (created) menuRef.value?.open?.(String(created.id))
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
    const detail = subs.length > 0
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
      if (ci !== -1) categories.value.splice(ci, 1)
      delete activeSub[key]
      if (leftActive.value.startsWith(`${key}::`)) leftActive.value = ''
      syncHomeCache()
      catDialogVisible.value = false
      ElMessage.success('已删除')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      catDeleting.value = false
    }
  }

  // ---------- 子分类弹窗 ----------
  const subDialogVisible = ref(false)
  const subSaving = ref(false)
  const subFormReference = ref<FormInstance>()

  interface SubFormState {
    id: string | undefined
    category_id: string
    name: string
    slug: string
  }

  const subForm = reactive<SubFormState>({ id: undefined, category_id: '', name: '', slug: '' })
  const subRules: FormRules<SubFormState> = {
    category_id: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
    name: [{ required: true, message: '请输入子分类名称', trigger: 'blur' }],
  }
  function openSubDialog(sub: SubcategoryHome): void {
    Object.assign(subForm, { id: sub.id, category_id: sub.category_id, name: sub.name, slug: sub.slug || '' })
    subDialogVisible.value = true
  }
  function openSubCreate(catId: string): void {
    Object.assign(subForm, { id: undefined, category_id: catId, name: '', slug: '' })
    subDialogVisible.value = true
  }
  async function saveSub(): Promise<void> {
    const created = await saveMenuRow({
      formRef: subFormReference,
      saving: subSaving,
      form: subForm,
      create: (payload): Promise<SubcategoryHome> =>
        // 新子分类排到同分类末尾
        subcategoryApi.create({ ...payload, sort_order: appendOrderKey(subsOf(payload.category_id)) }),
      update: (id, payload) => subcategoryApi.update(id, payload as Partial<SubcategoryHome>),
      rows: subcategories,
      close: () => (subDialogVisible.value = false),
    })
    // 新增成功才重挂：新分类的子菜单 ul 或新条目是后渲染 DOM，拖拽实例需重建
    if (created) nextTick(onSubCreated)
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
      if (si !== -1) subcategories.value.splice(si, 1)
      const catKey = String(subForm.category_id)
      // 仅当删的是激活项才清理（语义 = 恢复默认"全部"筛选）；与 handleCatDelete 一致用 delete
      if (activeSub[catKey] === key) delete activeSub[catKey]
      if (leftActive.value === `${catKey}::${key}`) leftActive.value = ''
      syncHomeCache()
      subDialogVisible.value = false
      ElMessage.success('已删除')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      subDeleting.value = false
    }
  }

  // ---------- 网址弹窗 ----------
  const editDialogVisible = ref(false)
  const editSaving = ref(false)
  const editFormReference = ref<FormInstance>()
  const originalSubId = ref('')

  interface EditFormState {
    id: string | undefined
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
    id: undefined,
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
        validator: (_r, v, callback) => {
          if (v && !/^https?:\/\//i.test(v)) callback(new Error('链接需以 http:// 或 https:// 开头'))
          else callback()
        },
        trigger: 'blur',
      },
    ],
  }
  const editFaviconCandidates = computed(() =>
    editForm.url ? getFaviconCandidates({ url: editForm.url }) : [],
  )
  // 新增网址入口（网格尾部 + 号）：预选当前分类与激活中的子分类
  function openSiteCreate(catId: string): void {
    const subs = subsOf(catId)
    if (subs.length === 0) {
      ElMessage.warning('该分类下还没有子分类，请先在左侧菜单添加子分类')
      return
    }
    const active = activeSub[catId]
    const subId = active && subs.some(s => String(s.id) === active) ? active : String(subs[0].id)
    Object.assign(editForm, {
      id: undefined,
      category_id: catId,
      subcategory_id: subId,
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
    originalSubId.value = ''
    editDialogVisible.value = true
  }
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
      await editFormReference.value?.validate()
    } catch {
      return
    }
    if (!editForm.subcategory_id) {
      ElMessage.warning('请选择所属子分类')
      return
    }
    // 弹窗复用：表单无 id = 新增
    if (!editForm.id) return saveSiteCreate()
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
      const isSubChanged = editForm.subcategory_id !== originalSubId.value
      if (isSubChanged) {
        // 换组：排到新组末尾
        payload.subcategory_id = editForm.subcategory_id
        payload.sort_order = await siteApi.endKeyForSub(editForm.subcategory_id)
      }
      await siteApi.update(editForm.id, payload)
      editDialogVisible.value = false
      ElMessage.success('已保存')
      if (isSubChanged) {
        // 跨组移动涉及分组展示，整体静默重拉最稳
        await loadData({ silent: true, force: true })
        return
      }
      const index = sites.value.findIndex(s => s.id === editForm.id)
      // 直接元素替换（splice 的"删 1 插 1"形态被 no-confusing-array-splice 禁用）
      if (index !== -1) sites.value[index] = { ...sites.value[index], ...payload }
      syncHomeCache()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      editSaving.value = false
    }
  }

  // 新增网址：固定排到所选子分类末尾（endKeyForSub 生成末尾排序键）
  async function saveSiteCreate(): Promise<void> {
    editSaving.value = true
    try {
      const payload = {
        subcategory_id: editForm.subcategory_id,
        name: editForm.name,
        url: editForm.url,
        description: editForm.description,
        keywords: editForm.keywords,
        favicon_url: editForm.favicon_url,
        is_featured: editForm.is_featured,
        is_hot: editForm.is_hot,
        is_new: editForm.is_new,
        is_active: editForm.is_active,
        sort_order: await siteApi.endKeyForSub(editForm.subcategory_id),
      }
      const created = await siteApi.create(payload)
      // 停用行前台不展示（fetchSites 过滤 is_active），本地不入列，避免与刷新后的展示不一致
      if (created.is_active !== false) {
        // 主数组全局按 sort_order 字典序：按键找位插入而非尾插，
        // 保证「智能推荐」等派生视图的相对顺序与刷新后一致
        const key = created.sort_order ?? ''
        let at = sites.value.length
        for (let index = 0; index < sites.value.length; index++) {
          if ((sites.value[index]?.sort_order ?? '') > key) {
            at = index
            break
          }
        }
        sites.value.splice(at, 0, created)
      }
      syncHomeCache()
      editDialogVisible.value = false
      ElMessage.success(created.is_active === false ? '已新增（已停用，前台不展示）' : '已新增')
      // 等 DOM 更新后再收尾，否则新格子还不存在、重挂不到
      nextTick(onSiteCreated)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败')
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
      const index = sites.value.findIndex(s => s.id === editForm.id)
      if (index !== -1) sites.value.splice(index, 1)
      syncHomeCache()
      editDialogVisible.value = false
      ElMessage.success('已删除')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      editDeleting.value = false
    }
  }

  return {
    editMode,
    // 分类弹窗
    catDialogVisible,
    catSaving,
    catFormRef: catFormReference,
    catForm,
    catRules,
    openCatDialog,
    saveCat,
    catDeleting,
    handleCatDelete,
    // 子分类弹窗
    subDialogVisible,
    subSaving,
    subFormRef: subFormReference,
    subForm,
    subRules,
    openSubDialog,
    openSubCreate,
    saveSub,
    subDeleting,
    handleSubDelete,
    // 网址弹窗
    editDialogVisible,
    editSaving,
    editFormRef: editFormReference,
    editForm,
    editRules,
    editFaviconCandidates,
    openSiteCreate,
    openEditDialog,
    saveEdit,
    editDeleting,
    handleEditDelete,
  }
}
