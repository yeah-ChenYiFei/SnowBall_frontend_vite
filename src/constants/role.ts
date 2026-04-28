// src/constants/role.ts
export const ROLES = {
  USER: 'USER',
  GROUP_ADMIN: 'GROUP_ADMIN',
  SYS_ADMIN: 'SYS_ADMIN'
} as const

// 可选：中文映射，用于页面展示
export const ROLE_LABEL_MAP: Record<string, string> = {
  [ROLES.USER]: '普通用户',
  [ROLES.GROUP_ADMIN]: '群组管理员',
  [ROLES.SYS_ADMIN]: '超级管理员'
}
