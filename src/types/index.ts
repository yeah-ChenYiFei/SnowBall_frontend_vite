// src/types/index.ts

// 1. 统一后端响应结构
export interface Result<T = any> {
  code: number
  message: string
  data: T
  timestamp: string
}

// 2. 用户模块
export interface User {
  id: number
  username: string
  role: string
  avatarUrl?: string
  createdAt?: string
}

// 3. 帖子模块
export interface Post {
  id: number
  userId: number
  type: string // 'OC' | 'SETTING' | 'FRAGMENT' | 'BOOK_INFO'
  title: string
  body: string
  status?: string
  version?: number
  tags?: string[] // 简化处理，直接传字符串数组
  createdAt: string
  updatedAt?: string
  // 以下为联表查询时的扩展字段（后端 VO 会提供）
  authorName?: string
  commentCount?: number
  likeCount?: number
  dislikeCount?: number
  currentUserReaction?: 'LIKE' | 'DISLIKE' | null
}

// 4. 评论模块（支持两级嵌套）
export interface Comment {
  id: number
  postId: number
  userId: number
  parentId: number | null
  body: string
  createdAt: string
  // 扩展字段
  authorName?: string
  children?: Comment[] // 存放子评论
}

// 5. 接龙模块
export interface StoryChain {
  id: number
  creatorId: number
  title: string
  status: string
  createdAt: string
  creatorName?: string
  firstSegmentBody?: string // 首段预览
}
// --- 第三阶段新增类型 ---

// 接龙详情 VO（后端查出来的完整接龙，包含段落列表）
export interface ChainDetailVO extends StoryChain {
  segments?: ChainSegment[]
}

// 接龙段落
export interface ChainSegment {
  id: number
  chainId: number
  userId: number
  body: string
  prevSegmentId: number | null
  depth: number
  createdAt: string
  authorName?: string
}

// 图书实体（为下半场准备）
export interface Book {
  id: number
  userId: number
  title: string
  author: string
  price: number
  purchaseDate: string
  coverUrl?: string
}
export interface Group {
  id: number
  creatorId: number
  name: string
  description: string
  createdAt: string
  creatorName?: string
  memberCount?: number
}
// --- 个人主页聚合 VO（对应后端 UserProfileVO） ---
export interface UserProfileVO {
  user: UserVO
  posts: Post[]
  books: Book[]
}

export interface UserVO {
  id: number
  username: string
  avatarUrl?: string
}

// 7. 世界观 / 设定
export interface World {
  id: number
  userId: number
  name: string
  description: string
  type: string
  createdAt: string
  updatedAt: string
}

export interface WorldEntry {
  id: number
  worldId: number
  userId: number
  name: string
  type: string
  content: string
  contentPreview: string
  createdAt: string
  updatedAt: string
}

export interface WorldRelation {
  id: number
  worldId: number
  fromEntryId: number
  fromEntryName: string
  toEntryId: number
  toEntryName: string
  direction: 'LEFT_ARROW' | 'RIGHT_ARROW' | 'BIDIRECTIONAL'
  description: string
  createdAt: string
}

// 图谱节点
export interface GraphNode {
  id: number
  name: string
  x: number
  y: number
}

// 图谱连线
export interface GraphEdge {
  id: number
  fromId: number
  toId: number
  direction: string
  description: string
}

