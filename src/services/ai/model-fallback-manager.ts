/**
 * Model Fallback Manager for DentalAI Reader
 * Pure TypeScript logic module, independent of UI components.
 * 
 * Implements:
 * - Error classification (429 RPM vs RPD, 400/401/403 fail-fast, 500/503/504 fallback, 404 silent skip)
 * - Request counting with midnight Pacific Time (America/Los_Angeles) reset
 * - Cooldown tracking for per-minute rate limits
 * - Model filtering (>= gemini-3.5-flash-lite, text-only)
 * - Permanent lock of gemini-3.5-flash-lite at the bottom of the priority chain
 * - Admin fallback exhaustion card with Zalo contact (0868899853)
 */

export interface GeminiModelInfo {
  id: string
  name: string
  version: number // e.g., 3.8, 3.5
  isLite: boolean
  rpd: number | null // null means "(?)"
  isPinnedBottom?: boolean
}

export interface ModelRuntimeState {
  modelId: string
  retryUntil: number | null // Timestamp in ms for RPM cooldown
  exhaustedUntilPacificMidnight: boolean // Blocked for remainder of day (RPD or 0 quota)
  requestCountToday: number
  lastError?: {
    code: number
    message: string
    timestamp: number
  }
}

export interface AdminErrorReport {
  adminPhone: string
  zaloUrl: string
  timestamp: string
  lastModel: string
  modelsAttempted: string[]
  errorCode: number
  errorMessage: string
  formattedCopyText: string
}

export type ErrorClassification =
  | { type: "RPM_QUOTA_EXCEEDED"; retryAfterSeconds: number; message: string }
  | { type: "RPD_QUOTA_EXCEEDED"; message: string }
  | { type: "ZERO_QUOTA"; message: string }
  | { type: "AUTH_OR_BAD_REQUEST"; code: number; message: string } // 400, 401, 403 -> fail-fast
  | { type: "MODEL_NOT_FOUND"; modelId: string } // 404 -> silent skip
  | { type: "SERVER_OVERLOAD"; code: number; message: string } // 500, 503, 504 -> try next model
  | { type: "SAFETY_BLOCKED"; message: string }
  | { type: "EMPTY_OR_TRUNCATED"; reason: string }
  | { type: "UNKNOWN"; code: number; message: string }

export const ADMIN_PHONE = "0868899853"
export const ADMIN_ZALO_URL = "https://zalo.me/0868899853"
export const PINNED_MODEL_ID = "gemini-3.5-flash-lite"

// Default supported models (prioritized by version descending, with 3.5 Flash Lite pinned bottom)
export const DEFAULT_MODEL_LIST: GeminiModelInfo[] = [
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", version: 3.8, isLite: false, rpd: 20 },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", version: 3.7, isLite: false, rpd: 20 },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", version: 3.5, isLite: false, rpd: null },
  {
    id: PINNED_MODEL_ID,
    name: "Gemini 3.5 Flash Lite",
    version: 3.5,
    isLite: true,
    rpd: 1500,
    isPinnedBottom: true,
  },
]

/**
 * Returns today's date string in Pacific Time ("YYYY-MM-DD").
 * Used to handle midnight Pacific Time quota resets.
 */
export function getPacificDateString(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
  } catch {
    // Fallback if timezone not supported in environment
    const offsetMs = -8 * 60 * 60 * 1000 // UTC-8 approximation
    const ptDate = new Date(now.getTime() + offsetMs)
    return ptDate.toISOString().slice(0, 10)
  }
}

export class ModelFallbackManager {
  private models: GeminiModelInfo[] = []
  private states: Map<string, ModelRuntimeState> = new Map()
  private currentPacificDate: string = ""
  private totalDailyRequests: number = 0

  constructor(initialModels: GeminiModelInfo[] = DEFAULT_MODEL_LIST) {
    this.currentPacificDate = getPacificDateString()
    this.setModelList(initialModels)
  }

  /**
   * Enforces rules for model order:
   * 1. gemini-3.5-flash-lite must always be at the very bottom.
   * 2. Cannot have duplicates.
   */
  public setModelList(models: GeminiModelInfo[]): void {
    const listWithoutPinned = models.filter((m) => m.id !== PINNED_MODEL_ID)
    const pinned = models.find((m) => m.id === PINNED_MODEL_ID) || {
      id: PINNED_MODEL_ID,
      name: "Gemini 3.5 Flash Lite",
      version: 3.5,
      isLite: true,
      rpd: 1500,
      isPinnedBottom: true,
    }

    this.models = [...listWithoutPinned, { ...pinned, isPinnedBottom: true }]

    // Ensure state entries exist
    for (const m of this.models) {
      if (!this.states.has(m.id)) {
        this.states.set(m.id, {
          modelId: m.id,
          retryUntil: null,
          exhaustedUntilPacificMidnight: false,
          requestCountToday: 0,
        })
      }
    }
  }

  public getModels(): readonly GeminiModelInfo[] {
    return this.models
  }

  /**
   * Reorders models. Guarantees that PINNED_MODEL_ID stays at the very end.
   */
  public reorderModels(newOrderIds: string[]): void {
    const modelMap = new Map(this.models.map((m) => [m.id, m]))
    const newModels: GeminiModelInfo[] = []

    for (const id of newOrderIds) {
      if (id !== PINNED_MODEL_ID && modelMap.has(id)) {
        newModels.push(modelMap.get(id)!)
      }
    }

    // Add any existing models that might have been missing from newOrderIds (except pinned)
    for (const m of this.models) {
      if (m.id !== PINNED_MODEL_ID && !newModels.some((item) => item.id === m.id)) {
        newModels.push(m)
      }
    }

    // Always push pinned model to the end
    const pinned = modelMap.get(PINNED_MODEL_ID) || {
      id: PINNED_MODEL_ID,
      name: "Gemini 3.5 Flash Lite",
      version: 3.5,
      isLite: true,
      rpd: 1500,
      isPinnedBottom: true,
    }
    newModels.push({ ...pinned, isPinnedBottom: true })

    this.models = newModels
  }

  /**
   * Resets daily counters and RPD flags if midnight Pacific Time has passed.
   */
  public checkAndResetPacificMidnight(): void {
    const todayPT = getPacificDateString()
    if (todayPT !== this.currentPacificDate) {
      this.currentPacificDate = todayPT
      this.totalDailyRequests = 0
      for (const state of this.states.values()) {
        state.exhaustedUntilPacificMidnight = false
        state.requestCountToday = 0
      }
    }
  }

  /**
   * Returns candidates for invocation in priority order.
   * Skips models that are:
   * 1. Exhausted until midnight PT (RPD exceeded or 0 quota)
   * 2. In RPM cooldown (retryUntil > now)
   */
  public getEligibleModels(nowMs: number = Date.now()): GeminiModelInfo[] {
    this.checkAndResetPacificMidnight()

    return this.models.filter((m) => {
      const st = this.states.get(m.id)
      if (!st) return true
      if (st.exhaustedUntilPacificMidnight) return false
      if (st.retryUntil && st.retryUntil > nowMs) return false
      return true
    })
  }

  /**
   * Increments internal estimated request counter.
   */
  public recordRequest(modelId: string): void {
    this.checkAndResetPacificMidnight()
    this.totalDailyRequests++
    const st = this.states.get(modelId)
    if (st) {
      st.requestCountToday++
    }
  }

  public getTotalDailyRequests(): number {
    this.checkAndResetPacificMidnight()
    return this.totalDailyRequests
  }

  public getModelState(modelId: string): ModelRuntimeState | undefined {
    return this.states.get(modelId)
  }

  /**
   * Classifies an HTTP error response from Gemini API according to the senior engineer's guidelines.
   */
  public classifyError(
    status: number,
    errorBody: any,
    modelId: string,
  ): ErrorClassification {
    // 400, 401, 403: Key or bad request -> fail-fast immediately
    if (status === 400 || status === 401 || status === 403) {
      const msg = errorBody?.error?.message || `HTTP ${status} Authentication or request error`
      return { type: "AUTH_OR_BAD_REQUEST", code: status, message: msg }
    }

    // 404: Model does not exist -> silent skip
    if (status === 404) {
      return { type: "MODEL_NOT_FOUND", modelId }
    }

    // 500, 503, 504: Overload/server error -> fallback to next model
    if (status === 500 || status === 503 || status === 504) {
      const msg = errorBody?.error?.message || `Google Gemini server unavailable (HTTP ${status})`
      return { type: "SERVER_OVERLOAD", code: status, message: msg }
    }

    // 429: Rate limit or Quota exceeded
    if (status === 429) {
      return this.classify429Error(errorBody)
    }

    const genericMsg = errorBody?.error?.message || `HTTP ${status}`
    return { type: "UNKNOWN", code: status, message: genericMsg }
  }

  /**
   * Deeply inspects 429 error details (QuotaFailure & RetryInfo)
   */
  private classify429Error(errorBody: any): ErrorClassification {
    const errorDetails = errorBody?.error?.details || []
    const message = errorBody?.error?.message || "Rate limit or quota reached"

    let quotaViolations: any[] = []
    let retryDelaySeconds = 60 // Default cooldown if not specified

    for (const item of errorDetails) {
      if (item["@type"]?.includes("QuotaFailure")) {
        quotaViolations = item.violations || []
      }
      if (item["@type"]?.includes("RetryInfo")) {
        const delayStr = item.retryDelay || ""
        const matched = delayStr.match(/([\d.]+)s/)
        if (matched) {
          retryDelaySeconds = Math.max(5, Math.ceil(parseFloat(matched[1])))
        }
      }
    }

    // Check if violations mention daily/day limits or zero quota
    const violationDescriptions = quotaViolations
      .map((v) => `${v.description || ""} ${v.quotaMetric || ""} ${v.subject || ""}`)
      .join(" ")
      .toLowerCase()

    const fullText = `${message} ${violationDescriptions}`.toLowerCase()

    if (fullText.includes("zero") || fullText.includes("quota of 0") || fullText.includes("limit '0'")) {
      return { type: "ZERO_QUOTA", message: "Model này có quota = 0 hoặc chưa được kích hoạt cho tài khoản" }
    }

    if (
      fullText.includes("perday") ||
      fullText.includes("per_day") ||
      fullText.includes("day") ||
      fullText.includes("rpd") ||
      fullText.includes("daily")
    ) {
      return { type: "RPD_QUOTA_EXCEEDED", message }
    }

    // If retry delay is present or mentions minute/rpm/tpm, treat as RPM
    return {
      type: "RPM_QUOTA_EXCEEDED",
      retryAfterSeconds: retryDelaySeconds,
      message,
    }
  }

  /**
   * Applies the classified error state to the specified model.
   */
  public handleClassifiedError(
    modelId: string,
    classification: ErrorClassification,
    nowMs: number = Date.now(),
  ): void {
    const st = this.states.get(modelId)
    if (!st) return

    if (classification.type === "RPM_QUOTA_EXCEEDED") {
      // Cooldown for the duration, next call will retry strongest model after cooldown
      st.retryUntil = nowMs + classification.retryAfterSeconds * 1000
    } else if (
      classification.type === "RPD_QUOTA_EXCEEDED" ||
      classification.type === "ZERO_QUOTA"
    ) {
      // Disable for remainder of day until Pacific midnight
      st.exhaustedUntilPacificMidnight = true
      st.retryUntil = null
    }
  }

  /**
   * Creates an Admin Error Report when all fallback options are exhausted.
   */
  public generateAdminReport(
    attemptedModels: string[],
    lastModelId: string,
    lastErrorCode: number,
    lastErrorMessage: string,
  ): AdminErrorReport {
    const nowIso = new Date().toISOString()
    const formattedCopyText = `[DentalAI Reader - Báo lỗi AI]
Thời gian: ${nowIso}
Model đang dùng: ${lastModelId}
Các model đã thử: ${attemptedModels.join(" -> ")}
Mã lỗi: ${lastErrorCode}
Chi tiết lỗi: ${lastErrorMessage}
Số request hôm nay (ước lượng): ${this.totalDailyRequests}
Liên hệ Admin Zalo: ${ADMIN_PHONE} (${ADMIN_ZALO_URL})`

    return {
      adminPhone: ADMIN_PHONE,
      zaloUrl: ADMIN_ZALO_URL,
      timestamp: nowIso,
      lastModel: lastModelId,
      modelsAttempted: attemptedModels,
      errorCode: lastErrorCode,
      errorMessage: lastErrorMessage,
      formattedCopyText,
    }
  }

  /**
   * Helper to parse and filter models fetched from Gemini's v1beta/models endpoint.
   * Rule:
   * - Only text-based models (skip image, TTS, audio, embedding, live, gemma)
   * - Only models >= gemini-3.5-flash-lite
   * - Pinned gemini-3.5-flash-lite at bottom
   * - Sorted descending by version number
   */
  public static filterAndSortRemoteModels(rawModels: any[]): GeminiModelInfo[] {
    const results: GeminiModelInfo[] = []

    for (const item of rawModels) {
      const name: string = (item.name || "").replace("models/", "")
      const displayName: string = item.displayName || name
      const supportedMethods: string[] = item.supportedGenerationMethods || []

      // Must support generateContent
      if (!supportedMethods.includes("generateContent")) {
        continue
      }

      // Skip non-text models
      const lower = name.toLowerCase()
      if (
        lower.includes("embed") ||
        lower.includes("imagen") ||
        lower.includes("image") ||
        lower.includes("tts") ||
        lower.includes("audio") ||
        lower.includes("live") ||
        lower.includes("gemma")
      ) {
        continue
      }

      // Parse version
      const versionMatch = name.match(/gemini-(\d+\.?\d*)/)
      const version = versionMatch ? parseFloat(versionMatch[1]) : 0
      const isLite = lower.includes("lite")

      // Only models >= 3.5
      if (version < 3.5) {
        continue
      }

      results.push({
        id: name,
        name: displayName,
        version,
        isLite,
        rpd: name === PINNED_MODEL_ID ? 1500 : null,
      })
    }

    // Sort: highest version first; if same version, standard before lite
    results.sort((a, b) => {
      if (a.version !== b.version) return b.version - a.version
      if (a.isLite !== b.isLite) return a.isLite ? 1 : -1
      return a.name.localeCompare(b.name)
    })

    // Ensure PINNED_MODEL_ID is present and locked at the very bottom
    const withoutPinned = results.filter((m) => m.id !== PINNED_MODEL_ID)
    const pinnedModel: GeminiModelInfo = {
      id: PINNED_MODEL_ID,
      name: "Gemini 3.5 Flash Lite",
      version: 3.5,
      isLite: true,
      rpd: 1500,
      isPinnedBottom: true,
    }

    return [...withoutPinned, pinnedModel]
  }
}
