import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { ArrowLeftCuteReIcon } from "../icons/arrow_left_cute_re"
import { CachedImage } from "../components/CachedImage"
import { Delete2CuteReIcon } from "../icons/delete_2_cute_re"
import { MingcuteRightLineIcon } from "../icons/mingcute_right_line"
import { Settings1CuteReIcon } from "../icons/settings_1_cute_re"
import { World2CuteReIcon } from "../icons/world_2_cute_re"
import { fetchWordPressCategories } from "../services/site-scraper/wordpress"
import type { SiteCategory, SiteMetadata } from "../services/site-scraper/types"
import {
  deleteSite,
  getCategories,
  saveCategories,
  saveSite,
} from "../storage/database"
import { colors } from "../theme/colors"

interface SiteCategoriesScreenProps {
  site: SiteMetadata
  onBack: () => void
  onSelectCategory: (category: SiteCategory, site: SiteMetadata) => void
  onOpenPromptSettings: (site: SiteMetadata) => void
  onSiteDeleted?: () => void
}

export function SiteCategoriesScreen({
  site,
  onBack,
  onSelectCategory,
  onOpenPromptSettings,
  onSiteDeleted,
}: SiteCategoriesScreenProps) {
  const theme = colors.dark

  const [categories, setCategories] = useState<SiteCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [site.id])

  const loadCategories = async () => {
    try {
      // 1. Try local SQLite DB
      const localCats = await getCategories(site.id)
      if (localCats.length > 0) {
        setCategories(localCats)
        setIsLoading(false)
        // Background refresh in case counts changed
        fetchRemoteCategories(false)
        return
      }

      // 2. Fetch from WordPress API
      await fetchRemoteCategories(true)
    } catch (err) {
      console.error("Error loading categories:", err)
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetchRemoteCategories = async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const remoteCats = await fetchWordPressCategories(site.id, site.url)
      setCategories(remoteCats)
      await saveCategories(site.id, remoteCats)

      // Calculate total posts and categories
      const totalPosts = remoteCats.reduce((sum, c) => sum + (c.count || 0), 0)
      const updatedSite: SiteMetadata = {
        ...site,
        categoryCount: remoteCats.length,
        postCount: totalPosts,
      }
      await saveSite(updatedSite)
    } catch (err) {
      console.error("Error fetching remote categories:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchRemoteCategories(false)
  }

  const handleDeleteSite = () => {
    Alert.alert(
      "Xóa trang web",
      `Bạn có chắc chắn muốn bỏ theo dõi "${site.name}" và xóa toàn bộ dữ liệu offline của trang này?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa trang",
          style: "destructive",
          onPress: async () => {
            await deleteSite(site.id)
            if (onSiteDeleted) onSiteDeleted()
            else onBack()
          },
        },
      ],
    )
  }

  const renderCategoryItem = ({ item }: { item: SiteCategory }) => (
    <TouchableOpacity
      style={styles.catCard}
      onPress={() => onSelectCategory(item, site)}
      activeOpacity={0.7}
    >
      <Text style={styles.catName} numberOfLines={1}>
        {item.name}
      </Text>

      <View style={styles.catCountBadge}>
        <Text style={styles.catCountText}>{item.count || 0} bài</Text>
        <MingcuteRightLineIcon width={16} height={16} color="#71717A" />
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeftCuteReIcon width={22} height={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {site.name}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => onOpenPromptSettings(site)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings1CuteReIcon width={22} height={22} color="#A1A1AA" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteSite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Delete2CuteReIcon width={22} height={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Site Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerTopRow}>
          <View style={styles.avatarContainer}>
            <CachedImage
              uri={site.favicon}
              style={styles.bannerAvatarImage}
              resizeMode="cover"
              fallback={<World2CuteReIcon width={26} height={26} color="#18181B" />}
            />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerSiteName} numberOfLines={1}>
              {site.name}
            </Text>
            <Text style={styles.bannerSiteUrl} numberOfLines={1}>
              {site.url.replace(/^https?:\/\//, "")}
            </Text>
            {site.description ? (
              <Text style={styles.bannerSiteDesc} numberOfLines={2}>
                {site.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Banner Badges */}
        <View style={styles.bannerBadgesRow}>
          <View style={styles.greenBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.greenBadgeText}>
              {categories.length} danh mục khả dụng
            </Text>
          </View>

          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {site.type === "wordpress" ? "WORDPRESS API" : "RSS FEED"}
            </Text>
          </View>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>DANH MỤC BÀI VIẾT</Text>
        <Text style={styles.sectionCount}>{categories.length} mục</Text>
      </View>

      {/* Categories List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF5C00" />
          <Text style={styles.loadingText}>Đang tải danh mục bài viết...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategoryItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF5C00"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📂</Text>
              <Text style={styles.emptyTitle}>Chưa tìm thấy danh mục</Text>
              <Text style={styles.emptySub}>
                Trang web này chưa cung cấp danh mục qua REST API hoặc đang bảo trì.
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    backgroundColor: "#121214",
  },
  headerButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginHorizontal: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bannerCard: {
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bannerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bannerSiteName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bannerSiteUrl: {
    fontSize: 13,
    color: "#71717A",
    marginTop: 2,
  },
  bannerSiteDesc: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 3,
  },
  bannerBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27272A",
    gap: 8,
  },
  greenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  greenBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  typeBadge: {
    backgroundColor: "rgba(255, 92, 0, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FF5C00",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717A",
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    color: "#71717A",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 58,
  },
  catName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 10,
  },
  catCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27272A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  catCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E4E4E7",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#A1A1AA",
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    color: "#71717A",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
})
