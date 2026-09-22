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
import { Download2CuteFiIcon } from "../icons/download_2_cute_fi"
import { Eye2CuteReIcon } from "../icons/eye_2_cute_re"
import { EyeCloseCuteReIcon } from "../icons/eye_close_cute_re"
import { Refresh2CuteReIcon } from "../icons/refresh_2_cute_re"
import {
  batchDownloadCategoryPosts,
  loadCategoryPostsInitial,
} from "../services/site-scraper/category-downloader"
import type { SitePost } from "../services/site-scraper/types"
import { colors } from "../theme/colors"

interface CategoryPostsScreenProps {
  siteUrl: string
  siteId: string
  categoryId: string
  categoryName: string
  categoryCount?: number
  onBack: () => void
  onSelectPost: (post: SitePost) => void
}

export function CategoryPostsScreen({
  siteUrl,
  siteId,
  categoryId,
  categoryName,
  categoryCount,
  onBack,
  onSelectPost,
}: CategoryPostsScreenProps) {
  const theme = colors.dark

  const [posts, setPosts] = useState<SitePost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([])
  const [showHiddenOnly, setShowHiddenOnly] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{
    isDownloading: boolean
    current: number
    total: number
  }>({
    isDownloading: false,
    current: 0,
    total: 0,
  })

  useEffect(() => {
    loadData()
  }, [siteId, categoryId])

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
    } catch (err) {
      console.error("Error loading posts:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing || downloadProgress.isDownloading) return
    setRefreshing(true)
    try {
      const items = await loadCategoryPostsInitial({
        siteUrl,
        siteId,
        categoryId,
        onDeltaUpdated: (updated) => setPosts(updated),
      })
      setPosts(items)
    } catch (err) {
      console.error("Refresh error:", err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleDownloadAll = async () => {
    if (downloadProgress.isDownloading) return

    setDownloadProgress({
      isDownloading: true,
      current: 0,
      total: categoryCount || posts.length || 0,
    })

    try {
      const downloaded = await batchDownloadCategoryPosts({
        siteUrl,
        siteId,
        categoryId,
        batchSize: Infinity,
        onProgress: (prog) => {
          setDownloadProgress({
            isDownloading: true,
            current: prog.currentLoaded,
            total: prog.totalInBatch,
          })
        },
      })

      if (downloaded.length > 0) {
        setPosts((prev) => {
          const map = new Map(prev.map((p) => [String(p.id), p]))
          for (const item of downloaded) {
            map.set(String(item.id), { ...item, isDownloaded: true })
          }
          return Array.from(map.values())
        })
      }
    } catch (err) {
      console.error("Download all error:", err)
    } finally {
      setDownloadProgress({
        isDownloading: false,
        current: 0,
        total: 0,
      })
    }
  }

  const handleToggleHidePost = (postId: string | number) => {
    const idStr = String(postId)
    setHiddenPostIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr],
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

  const allDownloaded = posts.length > 0 && posts.every((p) => p.isDownloaded)

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

        <Pressable
          onPress={handleRefresh}
          disabled={refreshing || downloadProgress.isDownloading}
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

      {/* Top Action Bar (Folo Style: Orange Download Button + Hidden Posts Pill) */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: theme.background,
            borderBottomColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.actionRow}>
          {/* Download all button */}
          <Pressable
            onPress={handleDownloadAll}
            disabled={downloadProgress.isDownloading || allDownloaded}
            style={[
              styles.downloadAllBtn,
              allDownloaded
                ? { backgroundColor: "rgba(34, 197, 94, 0.15)", borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.3)" }
                : downloadProgress.isDownloading
                ? { backgroundColor: "rgba(255, 92, 0, 0.2)" }
                : { backgroundColor: theme.accent },
            ]}
          >
            {downloadProgress.isDownloading ? (
              <>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.downloadAllText, { color: theme.accent }]}>
                  Đang tải {downloadProgress.current}/{downloadProgress.total} bài...
                </Text>
              </>
            ) : allDownloaded ? (
              <>
                <CheckFilledIcon width={15} height={15} color="#22C55E" />
                <Text style={[styles.downloadAllText, { color: "#22C55E" }]}>
                  Đã tải toàn bộ ({posts.length} bài)
                </Text>
              </>
            ) : (
              <>
                <Download2CuteFiIcon width={15} height={15} color="#FFFFFF" />
                <Text style={styles.downloadAllText}>
                  Tải về toàn bộ danh mục ({categoryCount || posts.length} bài)
                </Text>
              </>
            )}
          </Pressable>

          {/* Toggle hidden posts button */}
          {hiddenCount > 0 ? (
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
          ) : null}
        </View>
      </View>

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

                    {/* Nút Ẩn / Bỏ ẩn bài viết */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.()
                        handleToggleHidePost(item.id)
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

                  {/* Bottom info row: Date & Offline badge */}
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

                    {item.isDownloaded ? (
                      <View style={[styles.offlineBadge, { backgroundColor: theme.successBg }]}>
                        <CheckFilledIcon width={11} height={11} color="#22C55E" />
                        <Text style={[styles.offlineText, { color: theme.success }]}>
                          Offline
                        </Text>
                      </View>
                    ) : null}
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
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
    marginHorizontal: 8,
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  downloadAllBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  downloadAllText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  hiddenPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 9,
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
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: "600",
  },
})
