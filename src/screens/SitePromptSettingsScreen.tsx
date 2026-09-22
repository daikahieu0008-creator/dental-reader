import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import { ArrowLeftCuteReIcon } from "../icons/arrow_left_cute_re"
import { CheckFilledIcon } from "../icons/check_filled"
import { Refresh2CuteReIcon } from "../icons/refresh_2_cute_re"
import { DEFAULT_DENTAL_PROMPT } from "../services/ai/gemini-service"
import type { SiteMetadata } from "../services/site-scraper/types"
import { getSiteCustomPrompt, saveSiteCustomPrompt } from "../storage/database"
import { colors } from "../theme/colors"

interface SitePromptSettingsScreenProps {
  site: SiteMetadata
  onBack: () => void
}

export function SitePromptSettingsScreen({ site, onBack }: SitePromptSettingsScreenProps) {
  const theme = colors.dark

  const [promptValue, setPromptValue] = useState(DEFAULT_DENTAL_PROMPT)
  const [loading, setLoading] = useState(true)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadPrompt()
  }, [site.id])

  const loadPrompt = async () => {
    try {
      const stored = await getSiteCustomPrompt(site.id)
      if (stored && stored.trim()) {
        setPromptValue(stored)
      } else {
        setPromptValue(DEFAULT_DENTAL_PROMPT)
      }
    } catch (err) {
      console.error("Error loading custom prompt:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await saveSiteCustomPrompt(site.id, promptValue.trim())
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onBack()
      }, 700)
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể lưu prompt: " + (err?.message || "Lỗi không xác định"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = () => {
    Alert.alert(
      "Khôi phục prompt mặc định",
      "Bạn có muốn đặt lại prompt tóm tắt chuyên môn Răng Hàm Mặt mặc định cho trang web này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Khôi phục",
          onPress: () => {
            setPromptValue(DEFAULT_DENTAL_PROMPT)
          },
        },
      ],
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <ArrowLeftCuteReIcon width={20} height={20} color={theme.text} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Cài đặt Prompt AI</Text>
        </Pressable>

        <Pressable onPress={handleResetDefault} style={styles.resetBtn} hitSlop={10}>
          <Refresh2CuteReIcon width={16} height={16} color={theme.textSecondary} />
          <Text style={[styles.resetText, { color: theme.textSecondary }]}>Mặc định</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Information Card */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.aiPurpleBg,
                borderColor: theme.aiPurpleBorder,
              },
            ]}
          >
            <Text style={[styles.infoTitle, { color: theme.aiPurpleLight }]}>
              💡 Prompt tóm tắt cho: {site.name}
            </Text>
            <Text style={[styles.infoDesc, { color: theme.textSecondary }]}>
              Prompt này sẽ tự động áp dụng cho tất cả bài viết thuộc toàn bộ các danh mục của trang web này. Bạn có thể chỉnh sửa nội dung bên dưới theo nhu cầu.
            </Text>
          </View>

          {/* Prompt Editor Box */}
          <View
            style={[
              styles.editorCard,
              {
                backgroundColor: theme.secondaryCard,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ padding: 40 }} />
            ) : (
              <TextInput
                value={promptValue}
                onChangeText={setPromptValue}
                multiline={true}
                textAlignVertical="top"
                placeholder="Nhập prompt tùy chỉnh cho website..."
                placeholderTextColor={theme.textMuted}
                style={[styles.editorInput, { color: theme.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.saveBtn,
              savedSuccess
                ? { backgroundColor: theme.success }
                : { backgroundColor: theme.accent },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : savedSuccess ? (
              <>
                <CheckFilledIcon width={18} height={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Đã lưu cấu hình thành công!</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>Lưu Prompt cho website này</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "500",
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  editorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  editorInput: {
    minHeight: 380,
    fontSize: 14,
    lineHeight: 22,
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
})
