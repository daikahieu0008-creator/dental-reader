import React, { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { ArrowLeftCuteReIcon } from "../icons/arrow_left_cute_re"
import { CheckFilledIcon } from "../icons/check_filled"
import { Eye2CuteReIcon } from "../icons/eye_2_cute_re"
import { EyeCloseCuteReIcon } from "../icons/eye_close_cute_re"
import { Refresh2CuteReIcon } from "../icons/refresh_2_cute_re"
import {
  batchDownloadCategoryPosts,
  type DownloadProgress,
  loadCategoryPostsInitial,
} from "../services/site-scraper/category-downloader"
import type { SiteMetadata, SitePost } from "../services/site-scraper/types"
import {
  getCategoryState,
  getHiddenPostIds,
  toggleHidePost,
} from "../storage/database"
import { colors } from "../theme/colors"

interface CategoryPostsScreenProps {
  siteUrl: string
  siteId: string
  site?: SiteMetadata | null
  categoryId: string
  categoryName: string
  categoryCount?: number
  onBack: () => void
  onSelectPost: (post: SitePost) => void
  onOpenPromptSettings?: (site: SiteMetadata) => void
}

export function CategoryPostsScreen({
  siteUrl,
  siteId,
  site,
  categoryId,
  categoryName,
  onBack,
  onSelectPost,
  onOpenPromptSettings,
}: CategoryPostsScreenProps) {
  const theme = colors.dark

  const [posts, setPosts] = useState<SitePost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([])
  const [showHiddenOnly, setShowHiddenOnly] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)

  useEffect(() => {
    loadData()
    loadHiddenIds()
  }, [siteId, categoryId])

  const loadHiddenIds = async () => {
    const ids = await getHiddenPostIds()
    setHiddenPostIds(ids)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const items = await loadCategoryPostsInitial({
        siteUrl,
        siteId,
        categoryId,
        onDeltaUpdated: (updated) => setPosts(updated),
      })
      setPosts(items)

      const state = await getCategoryState(siteId, categoryId)
      setIsCompleted(state.isCompleted)
    } catch (err) {
      console.error("Error loading posts:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing || isBatchDownloading) return
    setRefreshing(true)
    try {
      const items = await loadCategoryPostsInitial({
        siteUrl,
        siteId,
        categoryId,
        onDeltaUpdated: (updated) => setPosts(updated),
      })
      setPosts(items)
      const state = await getCategoryState(siteId, categoryId)
      setIsCompleted(state.isCompleted)
    } catch (err) {
      console.error("Refresh error:", err)
    } finally {
      setRefreshing(false)
    }
  }

  // Senior Engineer's batch download (+10, +50, or all) with 200ms throttle
  const handleBatchDownload = async (size: number) => {
    if (isBatchDownloading || isCompleted) return
    setIsBatchDownloading(true)
    setDownloadProgress({
      currentLoaded: 0,
      totalInBatch: size === Infinity ? 100 : size,
      isComplete: false,
      statusText: "Bắt đầu tải...",
    })

    try {
      const newItems = await batchDownloadCategoryPosts({
        siteUrl,
        siteId,
        categoryId,
        batchSize: size,
        onProgress: (prog) => {
          setDownloadProgress(prog)
        },
      })

      if (newItems.length > 0) {
        setPosts((prev) => {
          const map = new Map(prev.map((p) => [String(p.id), p]))
          for (const item of newItems) {
            map.set(String(item.id), { ...item, isDownloaded: true })
          }
          return Array.from(map.values())
        })
      }

      const state = await getCategoryState(siteId, categoryId)
      setIsCompleted(state.isCompleted)
    } catch (err) {
      console.error("Batch download error:", err)
    } finally {
      setIsBatchDownloading(false)
    }
  }

  const handleToggleHide = async (postId: string | number) => {
    const isNowHidden = await toggleHidePost(postId)
    const idStr = String(postId)
    setHiddenPostIds((prev) =>
      isNowHidden ? [...prev, idStr] : prev.filter((id) => id !== idStr),
    )
  }

  const visiblePosts = useMemo(() => {
    return posts.filter((p) => {
      const isHidden = hiddenPostIds.includes(String(p.id))
      return showHiddenOnly ? isHidden : !isHidden
    })
  }, [posts, hiddenPostIds, showHiddenOnly])

  const hiddenCount = useMemo(() => {
    return posts.filter((p) => hiddenPostIds.includes(String(p.id))).length
  }, [posts, hiddenPostIds])

  // Footer: 3 load buttons (+10, +50, all) with 200ms throttle
  const renderFooter = () => {
    if (loading) return null

    return (
      <View style={styles.footerContainer}>
        {/* Progress Card when downloading */}
        {downloadProgress && (
          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, { color: theme.text }]}>
                {downloadProgress.statusText}
              </Text>
              <Text style={[styles.progressNumbers, { color: theme.accent }]}>
                {downloadProgress.currentLoaded} / {downloadProgress.totalInBatch}
              </Text>
            </View>
            <View style={[styles.progressBarTrack, { backgroundColor: theme.secondaryCard }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${Math.min(
                      100,
                      (downloadProgress.currentLoaded /
                        Math.max(1, downloadProgress.totalInBatch)) *
                        100,
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {isCompleted ? (
          <View style={[styles.completedBanner, { backgroundColor: theme.card }]}>
            <CheckFilledIcon width={16} height={16} color="#22C55E" />
            <Text style={[styles.completedText, { color: theme.success }]}>
              Đã tải về toàn bộ bài viết trong chuyên mục ({posts.length} bài)
            </Text>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <Text style={[styles.footerHint, { color: theme.textMuted }]}>
              Tải thêm bài viết để đọc ngoại tuyến:
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.loadBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => handleBatchDownload(10)}
                disabled={isBatchDownloading}
              >
                <Text style={[styles.loadBtnText, { color: theme.text }]}>+ 10 bài</Text>
              </Pressable>

              <Pressable
                style={[styles.loadBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => handleBatchDownload(50)}
                disabled={isBatchDownloading}
              >
                <Text style={[styles.loadBtnText, { color: theme.text }]}>+ 50 bài</Text>
              </Pressable>

              <Pressable
                style={[styles.loadBtn, { backgroundColor: theme.accent }]}
                onPress={() => handleBatchDownload(Infinity)}
                disabled={isBatchDownloading}
              >
                {isBatchDownloading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.loadBtnText, { color: "#FFF", fontWeight: "700" }]}>
                    Tải tất cả
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Navigation Header View (Folo Style) */}
      <View style={[styles.navHeader, { borderBottomColor: theme.cardBorder }]}>
        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeftCuteReIcon width={20} height={20} color={theme.text} />
        </Pressable>

        <Text style={[styles.navTitle, { color: theme.text }]} numberOfLines={1}>
          {categoryName}
        </Text>

        <View style={styles.headerRightRow}>
          {site && onOpenPromptSettings ? (
            <Pressable
              onPress={() => onOpenPromptSettings(site)}
              style={styles.headerBtn}
              hitSlop={10}
            >
              <Text style={{ fontSize: 13, color: theme.aiPurpleLight, fontWeight: "700" }}>
                ⚙ AI
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleRefresh}
            disabled={refreshing || isBatchDownloading}
            style={styles.headerBtn}
            hitSlop={10}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Refresh2CuteReIcon width={19} height={19} color={theme.text} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Hidden Posts Filter Bar (Only shown when there are hidden posts) */}
      {hiddenCount > 0 && (
        <View style={[styles.actionBar, { borderBottomColor: theme.cardBorder }]}>
          <Pressable
            onPress={() => setShowHiddenOnly((prev) => !prev)}
            style={[
              styles.hiddenPillBtn,
              showHiddenOnly
                ? { backgroundColor: theme.accentBg, borderColor: theme.accent }
                : { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            {showHiddenOnly ? (
              <Eye2CuteReIcon width={15} height={15} color={theme.accent} />
            ) : (
              <EyeCloseCuteReIcon width={15} height={15} color={theme.textSecondary} />
            )}
            <Text
              style={[
                styles.hiddenPillText,
                { color: showHiddenOnly ? theme.accent : theme.textSecondary },
              ]}
            >
              {showHiddenOnly ? "Hiện tất cả" : `Bài ẩn (${hiddenCount})`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Main Posts List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang nạp bài viết từ "{categoryName}"...
          </Text>
        </View>
      ) : visiblePosts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {showHiddenOnly
              ? "Không có bài viết nào bị ẩn."
              : "Không có bài viết nào trong danh mục này."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => {
            const isHidden = hiddenPostIds.includes(String(item.id))
            const thumbUri = item.thumbnail || item.featuredMedia

            return (
              <Pressable
                onPress={() => onSelectPost(item)}
                style={[
                  styles.postCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                {/* Full-width banner thumbnail (Folo style: h-44 cover) */}
                {thumbUri ? (
                  <Image
                    source={{ uri: thumbUri }}
                    style={styles.bannerThumbnail}
                    resizeMode="cover"
                  />
                ) : null}

                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.postTitle, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    {/* Nút Ẩn / Bỏ ẩn bài viết cho từng bài (Folo Style) */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.()
                        handleToggleHide(item.id)
                      }}
                      style={[
                        styles.eyeBtn,
                        { backgroundColor: "rgba(255, 255, 255, 0.08)" },
                      ]}
                      hitSlop={8}
                    >
                      {isHidden ? (
                        <Eye2CuteReIcon width={16} height={16} color={theme.accent} />
                      ) : (
                        <EyeCloseCuteReIcon
                          width={16}
                          height={16}
                          color={theme.textSecondary}
                        />
                      )}
                    </Pressable>
                  </View>

                  {/* Excerpt */}
                  {item.excerpt ? (
                    <Text
                      style={[styles.postExcerpt, { color: theme.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.excerpt}
                    </Text>
                  ) : null}

                    {/* Bottom info row: Date & Status Badges */}
                    <View
                      style={[
                        styles.bottomMetaRow,
                        { borderTopColor: "rgba(255, 255, 255, 0.06)" },
                      ]}
                    >
                      <Text style={[styles.dateText, { color: theme.textMuted }]}>
                        {item.publishedAt
                          ? item.publishedAt.slice(0, 10)
                          : item.date
                          ? item.date.slice(0, 10)
                          : ""}
                      </Text>

                      <View style={styles.rightBadgesRow}>
                        {item.geminiSummary ? (
                          <View style={styles.summaryBadge}>
                            <Text style={styles.summaryBadgeText}>✦ Đã tóm tắt</Text>
                          </View>
                        ) : null}

                        {item.isDownloaded ? (
                          <View style={styles.offlineBadge}>
                            <CheckFilledIcon width={11} height={11} color="#22C55E" />
                            <Text style={styles.offlineText}>Offline</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    padding: 6,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
    marginHorizontal: 8,
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  hiddenPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hiddenPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  bannerThumbnail: {
    width: "100%",
    height: 180,
    backgroundColor: "#27272A",
  },
  cardBody: {
    padding: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  postTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  postExcerpt: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  bottomMetaRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 12,
  },
  rightBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryBadge: {
    backgroundColor: "rgba(255, 92, 0, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FF5C00",
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
  },
  footerContainer: {
    marginTop: 16,
    marginBottom: 32,
    gap: 12,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressNumbers: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 13,
    fontWeight: "600",
  },
  buttonsContainer: {
    gap: 10,
  },
  footerHint: {
    fontSize: 12,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  loadBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
})
