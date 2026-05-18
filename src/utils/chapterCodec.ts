// ===== Chapter field codec =====
// Encodes structured metadata into the backend's free-text `chapter` field.
//
// Format for novel config (registration) post:
//   "$$cfg:hasVolumes=1"  or  "$$cfg:hasVolumes=0"
//
// Format for chapter posts:
//   "{section}:{volume}:{chapter}||{humanTitle}"
//   e.g. "main:1:3||第三章 雪落无声"
//        "preface:2:0||序章"
//        "extra:0:0||番外：那段时光"
//
// volume=0 means no-volume mode; chapter increments within the same (section,volume) scope.

export type SectionType = 'main' | 'preface' | 'extra' | 'postscript'

export const SectionTypeLabel: Record<SectionType, string> = {
  main: '正文',
  preface: '前言',
  extra: '番外',
  postscript: '后记',
}

export const SectionTypeOrder: SectionType[] = ['main', 'preface', 'extra', 'postscript']

export interface ChapterInfo {
  section: SectionType
  volume: number   // 0 = no-volume mode; >= 1 = volume number
  chapter: number  // chapter number within this (section, volume) scope, 1-based
  title: string    // human-readable chapter title (editable)
}

export interface NovelConfig {
  hasVolumes: boolean
}

const CONFIG_PREFIX = '$$cfg:'

// ---- Chinese number conversion (1-999) ----

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const CHINESE_TENS = ['', '十', '百', '千']

export function toChineseNum(n: number): string {
  if (n <= 0) return '零'
  if (n < 10) return CHINESE_DIGITS[n]
  if (n < 20) return '十' + (n % 10 === 0 ? '' : CHINESE_DIGITS[n % 10])
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return CHINESE_DIGITS[tens] + '十' + (ones === 0 ? '' : CHINESE_DIGITS[ones])
  }
  // 100-999 (should not be needed for chapters/volumes, but handle it)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  let result = CHINESE_DIGITS[hundreds] + '百'
  if (rest === 0) return result
  if (rest < 10) result += '零' + CHINESE_DIGITS[rest]
  else if (rest < 20) result += '一十' + (rest % 10 === 0 ? '' : CHINESE_DIGITS[rest % 10])
  else {
    const tens = Math.floor(rest / 10)
    const ones = rest % 10
    result += CHINESE_DIGITS[tens] + '十' + (ones === 0 ? '' : CHINESE_DIGITS[ones])
  }
  return result
}

// ---- Config post detection ----

export function isConfigPost(chapterField: string): boolean {
  return chapterField.startsWith(CONFIG_PREFIX)
}

// ---- Novel config encode/decode ----

export function encodeNovelConfig(config: NovelConfig): string {
  return `${CONFIG_PREFIX}hasVolumes=${config.hasVolumes ? '1' : '0'}`
}

export function decodeNovelConfig(chapterField: string): NovelConfig | null {
  if (!chapterField.startsWith(CONFIG_PREFIX)) return null
  const body = chapterField.slice(CONFIG_PREFIX.length)
  const pairs = body.split('&')
  let hasVolumes = false
  for (const pair of pairs) {
    const [key, val] = pair.split('=')
    if (key === 'hasVolumes') {
      hasVolumes = val === '1'
    }
  }
  return { hasVolumes }
}

// ---- Chapter info encode/decode ----

export function encodeChapter(info: ChapterInfo): string {
  const meta = `${info.section}:${info.volume}:${info.chapter}`
  return `${meta}||${info.title}`
}

export function decodeChapter(chapterField: string): ChapterInfo {
  const sepIdx = chapterField.indexOf('||')
  const metaPart = sepIdx >= 0 ? chapterField.slice(0, sepIdx) : chapterField
  const titlePart = sepIdx >= 0 ? chapterField.slice(sepIdx + 2) : ''

  const parts = metaPart.split(':')
  const section = (parts[0] || 'main') as SectionType
  const volume = parseInt(parts[1] || '0', 10) || 0
  const chapter = parseInt(parts[2] || '1', 10) || 1

  return { section, volume, chapter, title: titlePart }
}

// ---- Auto-generate chapter title ----

export function generateChapterTitle(
  section: SectionType,
  volume: number,
  chapter: number,
  hasVolumes: boolean,
): string {
  const sectionLabel = SectionTypeLabel[section]
  if (section === 'main') {
    if (hasVolumes && volume > 0) {
      return `${sectionLabel} 第${toChineseNum(volume)}卷 第${toChineseNum(chapter)}章`
    }
    return `${sectionLabel} 第${toChineseNum(chapter)}章`
  }
  // preface, extra, postscript
  if (hasVolumes && volume > 0) {
    return `${sectionLabel} 第${toChineseNum(volume)}卷`
  }
  return sectionLabel
}
