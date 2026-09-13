import { ElMessageBox } from 'element-plus'

// 确认弹窗：点取消会 reject，这里统一静默转 false，避免 unhandled rejection
export async function isConfirmed(message: string, title = '确认操作', confirmButtonText = '确定'): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, { confirmButtonText, cancelButtonText: '取消', type: 'warning' })
    return true
  } catch {
    return false
  }
}

// 删除确认的固定口径：标题「删除确认」+ 按钮「删除」
export async function isDeleteConfirmed(message: string, title = '删除确认'): Promise<boolean> {
  return isConfirmed(message, title, '删除')
}
