import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import {
  ADMIN_PHONE,
  ADMIN_ZALO_URL,
  type GeminiModelInfo,
  ModelFallbackManager,
  PINNED_MODEL_ID,
} from "../services/ai/model-fallback-manager"
import {
  deleteGeminiApiKey,
  getStoredGeminiApiKey,
  saveGeminiApiKey,
} from "../services/ai/secure-key-storage"
import { colors } from "../theme/colors"

interface GeminiSettingsScreenProps {
  onBack?: () => void
}

export function GeminiSettingsScreen({ onBack }: GeminiSettingsScreenProps) {
  const theme = colors.dark

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [models, setModels] = useState<GeminiModelInfo[]>([])
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadKeyAndModels()
  }, [])

  const loadKeyAndModels = async () => {
    const savedKey = await getStoredGeminiApiKey()
    if (savedKey) {
      setApiKey(savedKey)
    }
    const manager = new ModelFallbackManager()
    setModels([...manager.getModels()])
  }

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập Gemini API Key của bạn.")
      return
    }
    setIsSaving(true)
    try {
      await saveGeminiApiKey(apiKey.trim())
      setTestResult({ success: true, message: "Đã lưu API Key bảo mật trên thiết bị!" })
    } catch (err: any) {
      setTestResult({ success: false, message: `Lỗi khi lưu key: ${err.message}` })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearKey = async () => {
    Alert.alert("Xác nhận", "Bạn có chắc chắn muốn xoá API Key khỏi thiết bị?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          await deleteGeminiApiKey()
          setApiKey("")
          setTestResult(null)
        },
      },
    ])
  }

  const handleFetchRemoteModels = async () => {
    const keyToUse = apiKey.trim()
    if (!keyToUse) {
      Alert.alert("Yêu cầu", "Vui lòng nhập API Key trước khi cập nhật danh sách model.")
      return
    }

    setIsFetchingModels(true)
    setTestResult(null)

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`
      const res = await fetch(url)
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error?.message || `HTTP ${res.status}`)
      }

      const data = await res.json()
      const rawList = data?.models || []
      const filtered = ModelFallbackManager.filterAndSortRemoteModels(rawList)

      setModels(filtered)
      setTestResult({
        success: true,
        message: `Đã cập nhật thành công ${filtered.length} model hợp lệ từ Gemini!`,
      })
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Không thể lấy danh sách model: ${err.message}`,
      })
    } finally {
      setIsFetchingModels(false)
    }
  }

  // Move model up (cannot move above another model if it's pinned)
  const moveModelUp = (index: number) => {
    if (index <= 0) return
    const targetModel = models[index]
    if (targetModel.id === PINNED_MODEL_ID) {
      Alert.alert(
        "Model Cố Định",
        "Gemini 3.5 Flash Lite được khoá cố định ở vị trí đáy làm chốt chặn cuối cùng, không thể chuyển lên trên.",
      )
      return
    }

    const next = [...models]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setModels(next)
  }

  // Move model down (cannot move below the pinned model)
  const moveModelDown = (index: number) => {
    // If the next item is the pinned model, prevent moving past it
    if (index >= models.length - 2) {
      Alert.alert(
        "Model Cố Định",
        "Gemini 3.5 Flash Lite luôn luôn nằm ở vị trí cuối cùng trong chuỗi ưu tiên fallback.",
      )
      return
    }

    const next = [...models]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setModels(next)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={[styles.backText, { color: theme.accentLight }]}>← Quay lại</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.text }]}>Cài Đặt Gemini AI</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* API Key Box */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>1. Khóa API Cá Nhân (Gemini API Key)</Text>
          <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
            Key được lưu trong phân vùng bảo mật phần cứng của thiết bị (Secure Store), gửi thẳng tới Google và không bao giờ đi qua máy chủ bên ngoài.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.secondaryCard,
                  color: theme.text,
                  borderColor: theme.separator,
                },
              ]}
              placeholder="Dán mã API Key (AIzaSy...)"
              placeholderTextColor={theme.textMuted}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.eyeBtn, { backgroundColor: theme.secondaryCard }]}
              onPress={() => setShowKey(!showKey)}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {showKey ? "Ẩn" : "Hiện"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accent }]}
              onPress={handleSaveKey}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.actionBtnText}>Lưu Khóa API</Text>
              )}
            </TouchableOpacity>

            {apiKey.length > 0 && (
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: theme.danger }]}
                onPress={handleClearKey}
              >
                <Text style={{ color: theme.danger, fontWeight: "600" }}>Xoá Key</Text>
              </TouchableOpacity>
            )}
          </View>

          {testResult && (
            <View
              style={[
                styles.resultBanner,
                {
                  backgroundColor: testResult.success ? theme.successBg : theme.dangerBg,
                  borderColor: testResult.success ? theme.success : theme.danger,
                },
              ]}
            >
              <Text
                style={{
                  color: testResult.success ? theme.success : theme.danger,
                  fontSize: 13,
                }}
              >
                {testResult.message}
              </Text>
            </View>
          )}
        </View>

        {/* Priority Model Ordering */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>2. Thứ Tự Ưu Tiên Model</Text>
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                Hệ thống sẽ gọi model từ trên xuống dưới. Khi gặp lỗi 429 hoặc quá tải, tự động chuyển sang model kế tiếp.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: theme.aiPurpleBg, borderColor: theme.aiPurpleBorder }]}
            onPress={handleFetchRemoteModels}
            disabled={isFetchingModels}
          >
            {isFetchingModels ? (
              <ActivityIndicator size="small" color={theme.aiPurpleLight} />
            ) : (
              <Text style={{ color: theme.aiPurpleLight, fontWeight: "600", fontSize: 13 }}>
                🔄 Cập nhật danh sách từ Google API (≥ 3.5)
              </Text>
            )}
          </TouchableOpacity>

          {/* Model Items */}
          <View style={styles.modelList}>
            {models.map((item, idx) => {
              const isPinned = item.id === PINNED_MODEL_ID
              const rpdDisplay = item.rpd !== null ? `${item.rpd}` : "?"

              return (
                <View
                  key={item.id}
                  style={[
                    styles.modelCard,
                    {
                      backgroundColor: isPinned ? "rgba(2, 132, 199, 0.12)" : theme.secondaryCard,
                      borderColor: isPinned ? theme.accent : theme.separator,
                    },
                  ]}
                >
                  <View style={styles.modelInfoCol}>
                    <View style={styles.modelTitleRow}>
                      <Text style={[styles.modelIndex, { color: theme.textMuted }]}>
                        #{idx + 1}
                      </Text>
                      <Text
                        style={[
                          styles.modelName,
                          { color: isPinned ? theme.accentLight : theme.text },
                        ]}
                      >
                        {item.name}
                      </Text>
                      {isPinned && (
                        <View style={[styles.pinnedBadge, { backgroundColor: theme.accentBg }]}>
                          <Text style={[styles.pinnedBadgeText, { color: theme.accentLight }]}>
                            🔒 Cố định đáy
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.modelSubtitle, { color: theme.textSecondary }]}>
                      RPD: <Text style={{ fontWeight: "700", color: theme.text }}>({rpdDisplay})</Text> • Phiên bản: {item.version}
                    </Text>
                  </View>

                  {!isPinned ? (
                    <View style={styles.orderControls}>
                      <TouchableOpacity
                        style={[styles.orderBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                        onPress={() => moveModelUp(idx)}
                        disabled={idx === 0}
                      >
                        <Text style={[styles.orderBtnText, { color: theme.text }]}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.orderBtn,
                          { opacity: idx >= models.length - 2 ? 0.3 : 1 },
                        ]}
                        onPress={() => moveModelDown(idx)}
                        disabled={idx >= models.length - 2}
                      >
                        <Text style={[styles.orderBtnText, { color: theme.text }]}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.lockBox}>
                      <Text style={{ fontSize: 16 }}>🛡️</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {/* Admin Support & Zalo */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>3. Hỗ Trợ Kỹ Thuật Dự Án</Text>
          <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
            Khi mọi model đều cạn quota hoặc gặp lỗi chưa rõ nguyên nhân, bác sĩ có thể gửi thông tin báo cáo cho admin để được trợ giúp ngay.
          </Text>

          <TouchableOpacity
            style={[styles.zaloBtn, { backgroundColor: "#0068FF" }]}
            onPress={() => Linking.openURL(ADMIN_ZALO_URL)}
          >
            <Text style={styles.zaloBtnText}>💬 Mở Zalo Admin ({ADMIN_PHONE})</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardHeaderRow: {
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  eyeBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modelList: {
    gap: 10,
  },
  modelCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelInfoCol: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  modelIndex: {
    fontSize: 13,
    fontWeight: "700",
  },
  modelName: {
    fontSize: 15,
    fontWeight: "700",
  },
  pinnedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pinnedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modelSubtitle: {
    fontSize: 12,
  },
  orderControls: {
    flexDirection: "row",
    gap: 6,
  },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  lockBox: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  zaloBtn: {
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  zaloBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
})
