import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import {
  fetchWordPressCategories,
  fetchWordPressSiteInfo,
} from "../services/site-scraper/wordpress"
import type { SiteCategory, SiteMetadata } from "../services/site-scraper/types"
import {
  getCategories,
  getSites,
  saveCategories,
  saveSite,
} from "../storage/database"
import { DEFAULT_PRESET_SITES } from "../storage/index"
import { colors } from "../theme/colors"

interface HomeScreenProps {
  onSelectCategory: (category: SiteCategory, site: SiteMetadata) => void
  onOpenGeminiSettings: () => void
  onOpenTelegramLibrary: () => void
}

export function HomeScreen({
  onSelectCategory,
  onOpenGeminiSettings,
  onOpenTelegramLibrary,
}: HomeScreenProps) {
  const theme = colors.dark

  const [activeSite, setActiveSite] = useState<SiteMetadata>(DEFAULT_PRESET_SITES[0])
  const [categories, setCategories] = useState<SiteCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // Add Site Modal
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false)
  const [newSiteUrl, setNewSiteUrl] = useState("")
  const [isAddingSite, setIsAddingSite] = useState(false)
  const [addSiteError, setAddSiteError] = useState<string | null>(null)

  useEffect(() => {
    loadCategoriesForSite(activeSite)
  }, [activeSite.id])

  const loadCategoriesForSite = async (site: SiteMetadata) => {
    setIsLoadingCategories(true)
    try {
      // 1. Try loading from local SQLite database first
      const localCats = await getCategories(site.id)
      if (localCats.length > 0) {
        setCategories(localCats)
        setIsLoadingCategories(false)
        return
      }

      // 2. If not in DB, fetch from WordPress REST API
      const remoteCats = await fetchWordPressCategories(site.id, site.url)
      setCategories(remoteCats)
      await saveCategories(site.id, remoteCats)
      await saveSite(site)
    } catch (err) {
      console.error("Error loading categories:", err)
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const handleAddSite = async () => {
    if (!newSiteUrl.trim()) return
    setIsAddingSite(true)
    setAddSiteError(null)

    try {
      const info = await fetchWordPressSiteInfo(newSiteUrl.trim())
      const newSite: SiteMetadata = {
        id: `site_${Date.now()}`,
        name: info.name,
        url: newSiteUrl.trim(),
        description: info.description,
        favicon: info.favicon,
        type: "wordpress",
        createdAt: Date.now(),
      }

      await saveSite(newSite)
      setActiveSite(newSite)
      setIsAddSiteModalOpen(false)
      setNewSiteUrl("")
    } catch (err: any) {
      setAddSiteError(err.message || "Không thể phát hiện trang WordPress hoặc RSS.")
    } finally {
      setIsAddingSite(false)
    }
  }

  const renderCategoryItem = ({ item }: { item: SiteCategory }) => (
    <TouchableOpacity
      style={[
        styles.catCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        },
      ]}
      onPress={() => onSelectCategory(item, activeSite)}
      activeOpacity={0.7}
    >
      <View style={styles.catLeftRow}>
        <View style={[styles.catIconBox, { backgroundColor: theme.accentBg }]}>
          <Text style={{ fontSize: 18 }}>🦷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.catName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.catSub, { color: theme.textMuted }]}>
            Chuyên khoa Răng Hàm Mặt
          </Text>
        </View>
      </View>

      <View style={[styles.countBadge, { backgroundColor: theme.secondaryCard }]}>
        <Text style={[styles.countText, { color: theme.accentLight }]}>
          {item.count || 0} bài
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>›</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.logoIconBox, { backgroundColor: theme.accentBg }]}>
            <Text style={{ fontSize: 20 }}>🩺</Text>
          </View>
          <View>
            <Text style={[styles.appName, { color: theme.text }]}>DentalAI Reader</Text>
            <Text style={[styles.appSub, { color: theme.accentLight }]}>
              Trình đọc & Tóm tắt Nha khoa Ngoại tuyến
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Navigation Cards */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: theme.card, borderColor: theme.aiPurpleBorder }]}
          onPress={onOpenGeminiSettings}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>⚡</Text>
          <Text style={[styles.quickCardTitle, { color: theme.text }]}>Cài Đặt Gemini</Text>
          <Text style={[styles.quickCardDesc, { color: theme.aiPurpleLight }]}>
            Key & Thứ tự Model
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={onOpenTelegramLibrary}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>📚</Text>
          <Text style={[styles.quickCardTitle, { color: theme.text }]}>Thư Viện PDF</Text>
          <Text style={[styles.quickCardDesc, { color: theme.accentLight }]}>
            Sách Nha Khoa Offline
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Site Banner */}
      <View style={[styles.siteBanner, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.siteInfoRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.siteTagRow}>
              <Text style={[styles.siteName, { color: theme.text }]}>{activeSite.name}</Text>
              <View style={[styles.siteTypeBadge, { backgroundColor: theme.successBg }]}>
                <Text style={[styles.siteTypeText, { color: theme.success }]}>WordPress</Text>
              </View>
            </View>
            <Text style={[styles.siteUrl, { color: theme.textMuted }]}>{activeSite.url}</Text>
          </View>

          <TouchableOpacity
            style={[styles.addSiteIconBtn, { backgroundColor: theme.secondaryCard }]}
            onPress={() => setIsAddSiteModalOpen(true)}
          >
            <Text style={{ fontSize: 16 }}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Chuyên Mục Nha Khoa ({categories.length})
        </Text>
        <Text style={[styles.sectionHint, { color: theme.textMuted }]}>
          Nhấn để tải & đọc bài viết
        </Text>
      </View>

      {/* Category List */}
      {isLoadingCategories ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ color: theme.textMuted, marginTop: 10 }}>Đang nạp 19 danh mục...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategoryItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Add Site Modal */}
      <Modal
        visible={isAddSiteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddSiteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Thêm Website Răng Hàm Mặt Mới</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Hỗ trợ tự động nhận diện WordPress REST API hoặc RSS Feed bài viết.
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.secondaryCard,
                  color: theme.text,
                  borderColor: theme.separator,
                },
              ]}
              placeholder="https://trangwebnhakhoa.com"
              placeholderTextColor={theme.textMuted}
              value={newSiteUrl}
              onChangeText={setNewSiteUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {addSiteError && (
              <Text style={{ color: theme.danger, fontSize: 12, marginBottom: 10 }}>
                {addSiteError}
              </Text>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.separator, borderWidth: 1 }]}
                onPress={() => setIsAddSiteModalOpen(false)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Huỷ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.accent }]}
                onPress={handleAddSite}
                disabled={isAddingSite}
              >
                {isAddingSite ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: "#FFF", fontWeight: "700" }}>Thêm Trang</Text>
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
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 18,
    fontWeight: "800",
  },
  appSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickNavRow: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
  },
  quickCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  quickCardDesc: {
    fontSize: 11,
    fontWeight: "600",
  },
  siteBanner: {
    marginHorizontal: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  siteInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  siteTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  siteName: {
    fontSize: 16,
    fontWeight: "700",
  },
  siteTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  siteTypeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  siteUrl: {
    fontSize: 12,
  },
  addSiteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHint: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 8,
  },
  catCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  catIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  catSub: {
    fontSize: 11,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
})
