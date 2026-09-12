import { ElMessageBox } from 'element-plus'

// 确认删除弹窗：点取消会 reject，这里统一静默转 false，避免 unhandled rejection
export async function isDeleteConfirmed(message: string, title = '删除确认'): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    return true
  } catch {
    return false
  }
}
