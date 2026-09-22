import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import { ADMIN_PHONE, ADMIN_ZALO_URL } from "../services/ai/model-fallback-manager"
import {
  buildTelegramDeepLink,
  DEFAULT_TELEGRAM_BOT_USERNAME,
  searchBooksOffline,
} from "../services/telegram/telegram-service"
import type { TelegramBook } from "../storage/database"
import { colors } from "../theme/colors"

interface TelegramLibraryScreenProps {
  onBack?: () => void
}

export function TelegramLibraryScreen({ onBack }: TelegramLibraryScreenProps) {
  const theme = colors.dark

  const [searchQuery, setSearchQuery] = useState("")
  const [books, setBooks] = useState<TelegramBook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<TelegramBook | null>(null)

  useEffect(() => {
    handleSearch("")
  }, [])

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    try {
      const results = await searchBooksOffline(query)
      setBooks(results)
    } catch (err) {
      console.error("Error searching books:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBookPress = (book: TelegramBook) => {
    setSelectedBook(book)
  }

  const handleOpenTelegram = async () => {
    if (!selectedBook) return
    const link = buildTelegramDeepLink(DEFAULT_TELEGRAM_BOT_USERNAME, selectedBook.fileId)

    try {
      const canOpen = await Linking.canOpenURL(link)
      if (canOpen) {
        await Linking.openURL(link)
      } else {
        // Fallback or Telegram not installed
        Alert.alert(
          "Cần ứng dụng Telegram",
          "Thiết bị của bạn chưa cài Telegram hoặc không thể mở đường dẫn. Bạn có muốn mở web Telegram hoặc liên hệ Admin qua Zalo?",
          [
            { text: "Để sau", style: "cancel" },
            {
              text: "Zalo Admin",
              onPress: () => Linking.openURL(ADMIN_ZALO_URL),
            },
            {
              text: "Mở Link Web",
              onPress: () => Linking.openURL(link),
            },
          ],
        )
      }
    } catch {
      Linking.openURL(link)
    }
  }

  const renderBookItem = ({ item }: { item: TelegramBook }) => (
    <TouchableOpacity
      style={[styles.bookCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={() => handleBookPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.bookRow}>
        <View style={[styles.bookCoverIcon, { backgroundColor: theme.secondaryCard }]}>
          <Text style={{ fontSize: 26 }}>📚</Text>
        </View>

        <View style={styles.bookInfoCol}>
          <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.bookAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
            ✍️ {item.author}
          </Text>

          {item.caption ? (
            <Text style={[styles.bookCaption, { color: theme.textMuted }]} numberOfLines={2}>
              {item.caption}
            </Text>
          ) : null}

          <View style={styles.bookMetaRow}>
            <View style={[styles.sizeBadge, { backgroundColor: theme.accentBg }]}>
              <Text style={[styles.sizeBadgeText, { color: theme.accentLight }]}>
                {item.sizeMb} MB
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.textMuted }]}>{item.postDate}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={[styles.backText, { color: theme.accentLight }]}>← Quay lại</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Thư Viện PDF Nha Khoa</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Tìm kiếm ngoại tuyến 100% qua SQLite FTS5
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.cardBorder,
            },
          ]}
          placeholder="Tìm sách (Nội nha, Chỉnh nha, Nha chu, Implant, Tác giả)..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={(txt) => {
            setSearchQuery(txt)
            handleSearch(txt)
          }}
        />
      </View>

      {/* Book List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ color: theme.textMuted, marginTop: 10 }}>Đang tra cứu cơ sở dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.fileId}
          renderItem={renderBookItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                Không tìm thấy tài liệu phù hợp.
              </Text>
              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: theme.secondaryCard, borderColor: theme.separator }]}
                onPress={() => Linking.openURL(ADMIN_ZALO_URL)}
              >
                <Text style={{ color: theme.accentLight, fontSize: 13, fontWeight: "600" }}>
                  💬 Yêu cầu thêm sách qua Zalo Admin ({ADMIN_PHONE})
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Telegram Confirmation Modal / Bottom Sheet */}
      {selectedBook && (
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.accent }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📖 Tải Giáo Trình Qua Telegram</Text>

            <Text style={[styles.modalBookName, { color: theme.accentLight }]}>
              {selectedBook.title}
            </Text>

            <View style={[styles.noticeBox, { backgroundColor: theme.secondaryCard }]}>
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                Hệ thống sẽ chuyển sang Telegram Bot (@{DEFAULT_TELEGRAM_BOT_USERNAME}) để gửi file PDF ({selectedBook.sizeMb} MB) trực tiếp vào tin nhắn cho bạn.
              </Text>
              <Text style={[styles.noticeSub, { color: theme.textMuted }]}>
                * Bạn chỉ cần bấm "Start / Bắt đầu" trong Telegram nếu đây là lần đầu tương tác với Bot.
              </Text>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.separator }]}
                onPress={() => setSelectedBook(null)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOpenBtn, { backgroundColor: "#2AABEE" }]}
                onPress={handleOpenTelegram}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Mở Telegram Ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    fontSize: 17,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
  },
  searchContainer: {
    padding: 14,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 12,
  },
  bookCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  bookRow: {
    flexDirection: "row",
    gap: 12,
  },
  bookCoverIcon: {
    width: 60,
    height: 80,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bookInfoCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 13,
    marginBottom: 4,
  },
  bookCaption: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  bookMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sizeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  requestBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
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
    borderWidth: 1.5,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalBookName: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 12,
  },
  noticeBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  noticeSub: {
    fontSize: 11,
    fontStyle: "italic",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOpenBtn: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
})
