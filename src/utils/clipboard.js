import { ElMessage } from 'element-plus'

// 复制文本：优先 Clipboard API，降级用 textarea + execCommand（非安全上下文）
export async function copyText(text) {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
    return true
  } catch {
    // Clipboard API 不可用，走降级
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.append(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (ok) ElMessage.success('已复制')
    else ElMessage.error('复制失败')
    return ok
  } catch {
    ElMessage.error('复制失败')
    return false
  }
}
