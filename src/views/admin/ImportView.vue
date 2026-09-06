<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import { assertSupabase, clearTables } from '@/lib/supabase'
import { categoryApi } from '@/services/api'
import { exportDump, importDump, summarizeDump } from '@/services/import-api'

const sourceMode = ref('file')
const fileData = ref(null)
const urlInput = ref('')
const parsing = ref(false)
const importing = ref(false)
const exporting = ref(false)
const clearing = ref(false)
const clearFirst = ref(false)
const summary = ref({ categoryCount: 0, subcategoryCount: 0, siteCount: 0 })
const logs = ref([])
const treeVisible = ref(false)
const treeData = ref([])

function onFileChange(uploadFile) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result)
      fileData.value = json
      summary.value = summarizeDump(json)
      buildTree(json)
      ElMessage.success(`已解析文件：分类 ${summary.value.categoryCount}，网址 ${summary.value.siteCount}`)
    } catch (err) {
      ElMessage.error(`JSON 解析失败：${err.message}`)
    }
  }
  reader.readAsText(uploadFile.raw)
}

async function parseByUrl() {
  const v = urlInput.value.trim()
  if (!v) return ElMessage.warning('请粘贴 JSON 内容或 URL')
  parsing.value = true
  try {
    let json
    if (/^https?:\/\//i.test(v)) {
      const res = await fetch(v)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      json = await res.json()
    } else {
      json = JSON.parse(v)
    }
    fileData.value = json
    summary.value = summarizeDump(json)
    buildTree(json)
    ElMessage.success(`解析成功：分类 ${summary.value.categoryCount}，网址 ${summary.value.siteCount}`)
  } catch (err) {
    ElMessage.error(`解析失败：${err.message}`)
  } finally {
    parsing.value = false
  }
}

function buildTree(json) {
  const cats = json?.categoryTree?.categories || []
  treeData.value = cats.map((c, i) => ({
    key: i,
    name: c.name,
    subs: (c.children || []).map(s => s.name),
  }))
}
function previewTree() {
  treeVisible.value = true
}

function reset() {
  fileData.value = null
  urlInput.value = ''
  clearFirst.value = false
  logs.value = []
  summary.value = { categoryCount: 0, subcategoryCount: 0, siteCount: 0 }
}

async function confirmImport() {
  await ElMessageBox.confirm(
    `确定导入 ${summary.value.categoryCount} 个分类、${summary.value.subcategoryCount} 个子分类、${summary.value.siteCount} 个网址吗？`,
    '确认导入',
    { confirmButtonText: '开始导入', cancelButtonText: '取消', type: 'warning' },
  )
  importing.value = true
  logs.value = []
  try {
    const result = await importDump(fileData.value, {
      clearFirst: clearFirst.value,
      onProgress: (stage, cur, total, msg) => {
        logs.value.push({ type: 'info', msg })
      },
    })
    logs.value.push({
      type: 'success',
      msg: `✅ 导入成功：分类 ${result.categories}，子分类 ${result.subcategories}，网址 ${result.sites}，跳过 ${result.skipped}`,
    })
    ElMessage.success('导入完成')
  } catch (e) {
    logs.value.push({ type: 'error', msg: `导入失败：${e.message}` })
    ElMessage.error(`导入失败：${e.message}`)
  } finally {
    importing.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const categories = await categoryApi.list()
    const dump = await exportDump(categories)
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${categories.length} 个分类`)
  } catch (e) {
    ElMessage.error(`导出失败：${e.message}`)
  } finally {
    exporting.value = false
  }
}

async function handleClearAll() {
  assertSupabase()
  await ElMessageBox.confirm('确定清空数据库中的所有网址、子分类和分类吗？此操作不可恢复！', '数据清理', {
    confirmButtonText: '全部清空',
    cancelButtonText: '取消',
    type: 'error',
  })
  clearing.value = true
  try {
    await clearTables(['sites', 'subcategories', 'categories'])
    ElMessage.success('已清空全部数据')
  } catch (e) {
    ElMessage.error(`清理失败：${e.message}`)
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div class="import-view ui-page">
    <el-alert
      type="info"
      :closable="false"
      title="数据导入"
      description="将下载的原始网站数据导入到 Supabase。你可以上传本地 JSON 文件，或填入数据源的 URL 进行拉取。导入会一次性写入分类、子分类和网址。"
      show-icon
      class="intro"
    />

    <el-card class="panel">
      <template #header>
        <b>1. 选择数据源</b>
      </template>
      <el-radio-group v-model="sourceMode">
        <el-radio value="file">
          上传 JSON 文件
        </el-radio>
        <el-radio value="url">
          从 URL 拉取（或粘贴 JSON）
        </el-radio>
      </el-radio-group>

      <div v-if="sourceMode === 'file'" class="file-zone">
        <el-upload
          drag
          accept=".json,application/json"
          :auto-upload="false"
          :limit="1"
          :on-change="onFileChange"
          :on-remove="() => (fileData = null)"
          style="width: 100%"
        >
          <el-icon class="el-icon--upload">
            <UploadFilled />
          </el-icon>
          <div class="el-upload__text">
            将 JSON 文件拖到此处，或
            <em>点击选择</em>
          </div>
        </el-upload>
        <p class="hint">
          支持字段格式：{ categoryTree: { categories: [...] }, sites: [...] } 或 { categories: [...] }
        </p>
      </div>

      <div v-else>
        <el-input v-model="urlInput" type="textarea" :rows="8" placeholder="粘贴 JSON 内容，然后点击「解析预览」" />
        <el-button class="mt" :loading="parsing" @click="parseByUrl">
          解析预览
        </el-button>
      </div>

      <template v-if="fileData">
        <div class="preview">
          <h4 class="preview-title">
            数据预览
          </h4>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="分类">
              {{ summary.categoryCount }}
            </el-descriptions-item>
            <el-descriptions-item label="子分类">
              {{ summary.subcategoryCount }}
            </el-descriptions-item>
            <el-descriptions-item label="网址">
              {{ summary.siteCount }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <el-alert type="warning" :closable="false" class="warn">
          <template #title>
            导入将产生以下数据。若要
            <a href="javascript:void(0)" style="color: inherit; text-decoration: underline" @click="previewTree">查看分类树</a>
            ，请确认无误。
          </template>
        </el-alert>

        <el-checkbox v-model="clearFirst" class="clear-opt">
          先清空现有数据再导入（覆盖式导入）
        </el-checkbox>

        <div class="actions">
          <el-button type="primary" :loading="importing" @click="confirmImport">
            开始导入
          </el-button>
          <el-button @click="reset">
            重置
          </el-button>
        </div>
      </template>
    </el-card>

    <el-card class="panel">
      <template #header>
        <b>数据导出</b>
      </template>
      <p class="hint">
        将当前数据库中的分类、子分类与网址导出为可再次导入的 JSON 备份文件。
      </p>
      <el-button type="success" :loading="exporting" @click="handleExport">
        <el-icon style="margin-right: 4px">
          <Download />
        </el-icon>
        导出数据
      </el-button>
    </el-card>

    <el-card class="panel">
      <template #header>
        <b>数据清理</b>
      </template>
      <p class="hint">
        清空数据库中的所有网址、子分类与分类。此操作不可恢复，请谨慎操作。
      </p>
      <el-button type="danger" plain :loading="clearing" @click="handleClearAll">
        <el-icon style="margin-right: 4px">
          <Delete />
        </el-icon>
        清空全部数据
      </el-button>
    </el-card>

    <el-card v-if="logs.length" class="panel">
      <template #header>
        <b>导入日志</b>
      </template>
      <div class="log-box">
        <p v-for="(l, i) in logs" :key="i" class="log-line" :class="l.type">
          {{ l.msg }}
        </p>
      </div>
    </el-card>

    <!-- 分类树对话框 -->
    <el-dialog v-model="treeVisible" title="分类树预览" width="560px">
      <div class="tree-preview">
        <div v-for="c in treeData" :key="c.key" class="tree-cat">
          <b>{{ c.name }}</b>
          <span class="tree-subs">{{ c.subs.join(' / ') }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.intro {
  margin-bottom: 16px;
}

.panel {
  margin-bottom: 16px;
}

.file-zone {
  margin-top: 12px;
}

.hint {
  font-size: var(--text-xxs);
  color: var(--text-sub);
  margin-top: var(--space-2);
}

.mt {
  margin-top: var(--space-2);
}

.preview {
  margin-top: var(--space-4);

  &-title {
    margin: 0 0 10px;
  }
}

.warn {
  margin-top: var(--space-3);
}

.clear-opt {
  margin-top: var(--space-3);
}

.actions {
  margin-top: var(--space-4);
}

.log-box {
  max-height: 300px;
  overflow: auto;
  background: rgb(var(--color-bg-card-hover));
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  font-size: var(--text-foot);
}

.log-line {
  margin: 0 0 4px;
  line-height: 1.6;

  &.info {
    color: var(--text-sub);
  }

  &.success {
    color: var(--el-color-success);
  }

  &.error {
    color: var(--el-color-danger);
  }
}

.tree-preview {
  max-height: 400px;
  overflow: auto;
}

.tree-cat {
  margin-bottom: 10px;
}

.tree-subs {
  margin-left: 8px;
  color: var(--text-sub);
  font-size: 12px;
}
</style>
