import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import { CachedImage } from "../components/CachedImage"
import { MingcuteRightLineIcon } from "../icons/mingcute_right_line"
import { StarCuteFiIcon } from "../icons/star_cute_fi"
import { StarCuteReIcon } from "../icons/star_cute_re"
import { World2CuteReIcon } from "../icons/world_2_cute_re"
import { fetchWordPressSiteInfo } from "../services/site-scraper/wordpress"
import type { SiteMetadata } from "../services/site-scraper/types"
import {
  deleteSite,
  getSites,
  saveSite,
  toRoman,
  toggleSiteStarred,
} from "../storage/database"
import { DEFAULT_PRESET_SITES } from "../storage/index"
import { colors } from "../theme/colors"

interface HomeScreenProps {
  onSelectSite: (site: SiteMetadata) => void
}

export function HomeScreen({ onSelectSite }: HomeScreenProps) {
  const theme = colors.dark

  const [sites, setSites] = useState<SiteMetadata[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Add Site Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newSiteUrl, setNewSiteUrl] = useState("")
  const [isAddingSite, setIsAddingSite] = useState(false)
  const [addSiteError, setAddSiteError] = useState<string | null>(null)

  useEffect(() => {
    loadSites()
  }, [])

  const loadSites = async () => {
    try {
      let localSites = await getSites()
      if (localSites.length === 0) {
        // Seed initial preset site
        for (const preset of DEFAULT_PRESET_SITES) {
          await saveSite(preset)
        }
        localSites = await getSites()
      }
      setSites(localSites)
    } catch (err) {
      console.error("Error loading sites:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadSites()
  }

  const handleToggleStar = async (siteId: string) => {
    await toggleSiteStarred(siteId)
    await loadSites()
  }

  const handleAddSite = async () => {
    if (!newSiteUrl.trim()) return
    setIsAddingSite(true)
    setAddSiteError(null)

    try {
      const formattedUrl = newSiteUrl.trim().startsWith("http")
        ? newSiteUrl.trim()
        : `https://${newSiteUrl.trim()}`

      const info = await fetchWordPressSiteInfo(formattedUrl)
      const newSite: SiteMetadata = {
        id: `site_${Date.now()}`,
        name: info.name || formattedUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
        url: formattedUrl,
        description: info.description || "",
        favicon: info.favicon,
        type: "wordpress",
        createdAt: Date.now(),
        categoryCount: 0,
        postCount: 0,
        starredOrder: 0,
      }

      await saveSite(newSite)
      await loadSites()
      setIsAddModalOpen(false)
      setNewSiteUrl("")
    } catch (err: any) {
      setAddSiteError(err.message || "Không thể kết nối đến trang WordPress hoặc RSS.")
    } finally {
      setIsAddingSite(false)
    }
  }

  const filteredSites = sites.filter((site) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      site.name.toLowerCase().includes(q) ||
      site.url.toLowerCase().includes(q) ||
      (site.description && site.description.toLowerCase().includes(q))
    )
  })

  const renderSiteCard = ({ item }: { item: SiteMetadata }) => {
    const isStarred = (item.starredOrder || 0) > 0
    const romanNumeral = isStarred ? toRoman(item.starredOrder || 0) : ""

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => onSelectSite(item)}
        activeOpacity={0.7}
      >
        {/* Left: White Squircle Avatar with real site logo */}
        <View style={styles.avatarContainer}>
          <CachedImage
            uri={item.favicon}
            style={styles.avatarImage}
            resizeMode="cover"
            fallback={<World2CuteReIcon width={24} height={24} color="#18181B" />}
          />
        </View>

        {/* Middle: Site Info */}
        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.siteTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {item.type === "wordpress" ? "WP" : "RSS"}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitleText}>
            {item.categoryCount || 0} danh mục • {item.postCount || 0} bài
          </Text>
        </View>

        {/* Right: Star & Chevron */}
        <View style={styles.rightActionsRow}>
          <TouchableOpacity
            style={styles.starButton}
            onPress={() => handleToggleStar(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
          >
            {isStarred ? (
              <View style={styles.starredBadgeBox}>
                <StarCuteFiIcon width={22} height={22} color="#F59E0B" />
                {romanNumeral ? (
                  <Text style={styles.romanNumeralText}>{romanNumeral}</Text>
                ) : null}
              </View>
            ) : (
              <StarCuteReIcon width={22} height={22} color="#52525B" />
            )}
          </TouchableOpacity>

          <MingcuteRightLineIcon width={18} height={18} color="#71717A" />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Search & Add Header */}
      <View style={styles.headerContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm trang web..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={{ color: "#71717A", fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonIcon}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Section Subtitle */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TRANG WEB ĐÃ THEO DÕI</Text>
        <Text style={styles.sectionCount}>{filteredSites.length} trang</Text>
      </View>

      {/* Site List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF5C00" />
          <Text style={styles.loadingText}>Đang tải trang web...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSites}
          keyExtractor={(item) => item.id}
          renderItem={renderSiteCard}
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
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🌐</Text>
              <Text style={styles.emptyTitle}>Chưa có trang web nào</Text>
              <Text style={styles.emptySub}>
                Nhấn nút ＋ phía trên để thêm trang WordPress hoặc RSS nha khoa
              </Text>
            </View>
          }
        />
      )}

      {/* Add Site Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm trang web mới</Text>
            <Text style={styles.modalSubtitle}>
              Hỗ trợ tự động nhận diện REST API của WordPress và RSS Feed
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="VD: tuhocrhm.com hoặc https://..."
              placeholderTextColor="#71717A"
              value={newSiteUrl}
              onChangeText={setNewSiteUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {addSiteError ? (
              <Text style={styles.modalError}>{addSiteError}</Text>
            ) : null}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsAddModalOpen(false)
                  setAddSiteError(null)
                  setNewSiteUrl("")
                }}
                disabled={isAddingSite}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !newSiteUrl.trim() && styles.confirmButtonDisabled,
                ]}
                onPress={handleAddSite}
                disabled={!newSiteUrl.trim() || isAddingSite}
              >
                {isAddingSite ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Thêm trang</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FF5C00",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonIcon: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
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
    gap: 10,
  },
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 72,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  siteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  typeBadge: {
    backgroundColor: "rgba(255, 92, 0, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF5C00",
  },
  subtitleText: {
    fontSize: 13,
    color: "#A1A1AA",
    marginTop: 4,
  },
  rightActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
  },
  starButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  starredBadgeBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  romanNumeralText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#F59E0B",
    marginTop: -2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 12,
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalError: {
    color: "#EF4444",
    fontSize: 13,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#27272A",
  },
  cancelButtonText: {
    color: "#E4E4E7",
    fontWeight: "600",
    fontSize: 14,
  },
  confirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FF5C00",
  },
  confirmButtonDisabled: {
    backgroundColor: "rgba(255, 92, 0, 0.4)",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
})
