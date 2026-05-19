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
  viewCount?: number
  currentUserReaction?: 'LIKE' | 'DISLIKE' | null
}

// 4. 评论模块（支持两级嵌套）
export interface Comment {
  id: number
  postId: number
  userId: number
  parentId: number | null
  body: string
  likeCount: number
  dislikeCount: number
  currentUserReaction: string | null
  createdAt: string
  authorName?: string
  children?: Comment[]
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
  username?: string
  body: string
  prevSegmentId: number | null
  depth: number
  createdAt: string
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

// ===== 群组扩展类型 =====

export interface GroupDetail {
  id: number
  name: string
  description: string
  creatorId: number
  creatorName: string
  isPrivate: boolean
  memberCount: number
  members: GroupMemberInfo[]
  createdAt: string
}

export interface GroupMemberInfo {
  userId: number
  username: string
  role: string // 'admin' | 'member'
}

export interface GroupMessage {
  id: number
  groupId: number
  senderId: number
  senderName: string
  body: string
  type: string // 'CHAT' | 'CHAIN_START' | 'CHAIN_SEGMENT' | 'BATTLE_START' | 'BATTLE_ENTRY' | 'SYSTEM'
  refId?: number
  refType?: string // 'CHAIN' | 'BATTLE'
  createdAt: string
}

export interface WritingBattle {
  id: number
  groupId: number
  creatorId: number
  creatorName: string
  topic: string
  description: string
  deadline: string
  status: string // 'OPEN' | 'VOTING' | 'CLOSED'
  entries?: BattleEntry[]
  createdAt: string
}

export interface BattleEntry {
  id: number
  battleId: number
  userId: number
  username: string
  title: string
  body: string
  avgScore: number
  voteCount: number
  reviews?: BattleReview[]
  createdAt: string
}

export interface BattleReview {
  id: number
  entryId: number
  reviewerId: number
  reviewerName: string
  score: number
  comment: string
  createdAt: string
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
  isPublic: boolean
  createdAt: string
  updatedAt: string
  collaborators?: Collaborator[]
  isOwner?: boolean
  isCollaborator?: boolean
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

// 灵感记录
export interface Inspiration {
  id: number
  userId: number
  content: string
  createdAt: string
  updatedAt: string
}

// ===== 通知 =====
export interface Notification {
  id: number
  userId: number
  type: string
  sourceId: number
  sourceType: string
  actorId: number
  actorName: string
  body: string
  isRead: boolean
  createdAt: string
}

// ===== 写作中心相关类型 =====
export type ArticleType = 'ESSAY' | 'DIARY' | 'NOVEL'

export const ArticleTypeLabel: Record<ArticleType, string> = {
  ESSAY: '散文',
  DIARY: '日记',
  NOVEL: '小说',
}

export interface Article {
  id: number
  userId: number
  type: ArticleType
  title: string
  body: string
  status?: string
  version?: number
  chapter?: string
  wordCount?: number
  createdAt: string
  updatedAt?: string
  authorName?: string
}

// ===== 好友 =====
export interface Friend {
  id?: number
  userId: number
  username: string
  avatarUrl?: string
  since: string
}

export interface FriendshipStatus {
  status: 'FRIEND' | 'PENDING_TO_THEM' | 'PENDING_FROM_THEM' | 'NONE' | 'SELF'
  friendshipId?: number
}

// ===== 私聊 =====
export interface PrivateMessage {
  id: number
  senderId: number
  receiverId: number
  senderName: string
  body: string
  isRead: boolean
  createdAt: string
}

// ===== 共创 =====
export interface Collaborator {
  userId: number
  username: string
  avatarUrl?: string
  role: string
  since: string
}

export interface WorldChange {
  id: number
  worldId: number
  userId: number
  username: string
  entryId: number | null
  entryName: string
  entryType: string
  entryContent: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectReason?: string
  createdAt: string
  reviewedAt?: string
}

// ===== 个人主页新类型 =====
export interface ContributionDay {
  date: string
  count: number
  items: { id: number; type: string; title: string }[]
}

export interface RecentProject {
  id: number
  type: string
  title: string
  content: string
  createdAt: string
}

export interface BrowsingHistory {
  postId: number
  postTitle: string
  postType: string
  authorName?: string
  viewedAt: string
}

export interface Activity {
  id: number
  type: string // 'CHAIN' | 'BATTLE'
  title: string
  groupId: number
  groupName: string
  createdAt: string
}

export interface UserProfileFull {
  user: UserVO & { signature?: string }
  recentProjects: RecentProject[]
  contributions: ContributionDay[]
  browsingHistory: BrowsingHistory[]
  activities: Activity[]
  stats: { posts: number; worlds: number; articles: number; inspirations: number }
}

