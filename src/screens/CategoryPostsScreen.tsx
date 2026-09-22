import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import {
  batchDownloadCategoryPosts,
  type DownloadProgress,
  loadCategoryPostsInitial,
} from "../services/site-scraper/category-downloader"
import type { SitePost } from "../services/site-scraper/types"
import { getCategoryState } from "../storage/database"
import { colors } from "../theme/colors"

interface CategoryPostsScreenProps {
  siteUrl: string
  siteId: string
  categoryId: string
  categoryName: string
  onBack: () => void
  onSelectPost: (post: SitePost) => void
}

export function CategoryPostsScreen({
  siteUrl,
  siteId,
  categoryId,
  categoryName,
  onBack,
  onSelectPost,
}: CategoryPostsScreenProps) {
  const theme = colors.dark

  const [posts, setPosts] = useState<SitePost[]>([])
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)
  const [hideReadPosts, setHideReadPosts] = useState(false)
  const [readPostIds, setReadPostIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadInitialData()
  }, [siteId, categoryId])

  const loadInitialData = async () => {
    setIsLoadingInitial(true)
    try {
      const initialPosts = await loadCategoryPostsInitial({
        siteUrl,
        siteId,
        categoryId,
        onDeltaUpdated: (updatedPosts) => {
          setPosts(updatedPosts)
        },
      })
      setPosts(initialPosts)

      const state = await getCategoryState(siteId, categoryId)
      setIsCompleted(state.isCompleted)
    } catch (err: any) {
      console.error("Error loading initial posts:", err)
    } finally {
      setIsLoadingInitial(false)
    }
  }

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
          const map = new Map(prev.map((p) => [p.id, p]))
          for (const item of newItems) {
            map.set(item.id, item)
          }
          return Array.from(map.values())
        })
      }

      const state = await getCategoryState(siteId, categoryId)
      setIsCompleted(state.isCompleted)
    } catch (err: any) {
      console.error("Batch download error:", err)
    } finally {
      setIsBatchDownloading(false)
    }
  }

  const toggleReadStatus = (postId: string) => {
    setReadPostIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  const visiblePosts = posts.filter((p) => {
    if (hideReadPosts && readPostIds.has(p.id)) return false
    return true
  })

  const renderPostItem = ({ item }: { item: SitePost }) => {
    const isRead = readPostIds.has(item.id)
    const hasSummary = Boolean((item as any).geminiSummary)

    return (
      <TouchableOpacity
        style={[
          styles.postCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            opacity: isRead ? 0.6 : 1,
          },
        ]}
        onPress={() => {
          toggleReadStatus(item.id)
          onSelectPost(item)
        }}
        activeOpacity={0.8}
      >
        <View style={styles.postRow}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.secondaryCard }]}>
              <Text style={{ fontSize: 22 }}>🦷</Text>
            </View>
          )}

          <View style={styles.postContentCol}>
            <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>

            {item.excerpt ? (
              <Text style={[styles.postExcerpt, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.excerpt}
              </Text>
            ) : null}

            <View style={styles.postMetaRow}>
              {item.isDownloaded ? (
                <View style={[styles.badge, { backgroundColor: theme.successBg }]}>
                  <Text style={[styles.badgeText, { color: theme.success }]}>✓ Đã lưu máy</Text>
                </View>
              ) : null}

              {hasSummary ? (
                <View style={[styles.badge, { backgroundColor: theme.aiPurpleBg }]}>
                  <Text style={[styles.badgeText, { color: theme.aiPurpleLight }]}>✦ Đã tóm tắt</Text>
                </View>
              ) : null}

              {item.publishedAt ? (
                <Text style={[styles.dateText, { color: theme.textMuted }]}>
                  {item.publishedAt.slice(0, 10)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderFooter = () => {
    if (isLoadingInitial) return null

    return (
      <View style={styles.footerContainer}>
        {/* Batch download progress banner */}
        {downloadProgress && (
          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: theme.secondaryCard,
                borderColor: theme.separator,
              },
            ]}
          >
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, { color: theme.text }]}>
                {downloadProgress.statusText}
              </Text>
              <Text style={[styles.progressNumbers, { color: theme.accentLight }]}>
                {downloadProgress.currentLoaded} / {downloadProgress.totalInBatch}
              </Text>
            </View>
            <View style={[styles.progressBarTrack, { backgroundColor: theme.cardBorder }]}>
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
          <View style={[styles.completedBanner, { backgroundColor: theme.secondaryCard }]}>
            <Text style={[styles.completedText, { color: theme.success }]}>
              ✓ Đã tải về toàn bộ bài viết trong chuyên mục này ({posts.length} bài)
            </Text>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <Text style={[styles.footerHint, { color: theme.textMuted }]}>
              Tải thêm nội dung để đọc ngoại tuyến (không cần mạng):
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.loadBtn, { backgroundColor: theme.card, borderColor: theme.separator }]}
                onPress={() => handleBatchDownload(10)}
                disabled={isBatchDownloading}
              >
                <Text style={[styles.loadBtnText, { color: theme.text }]}>+ 10 bài</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadBtn, { backgroundColor: theme.card, borderColor: theme.separator }]}
                onPress={() => handleBatchDownload(50)}
                disabled={isBatchDownloading}
              >
                <Text style={[styles.loadBtnText, { color: theme.text }]}>+ 50 bài</Text>
              </TouchableOpacity>

              <TouchableOpacity
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
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={[styles.backText, { color: theme.accentLight }]}>← Danh mục</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            {posts.length} bài đã lưu trên máy
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.hideToggleBtn,
            { backgroundColor: hideReadPosts ? theme.accentBg : theme.secondaryCard },
          ]}
          onPress={() => setHideReadPosts(!hideReadPosts)}
        >
          <Text
            style={{
              color: hideReadPosts ? theme.accentLight : theme.textSecondary,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {hideReadPosts ? "Hiện bài đã xem" : "Ẩn đã xem"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {isLoadingInitial ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang tải 10 bài đầu tiên...
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: theme.textMuted, fontSize: 15 }}>
                Chưa có bài viết nào trong chuyên mục này.
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: 10,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
  },
  hideToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  postCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  postRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#1E293B",
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  postContentCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  postExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  footerContainer: {
    marginTop: 14,
    marginBottom: 32,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
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
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  completedText: {
    fontSize: 14,
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
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
})
