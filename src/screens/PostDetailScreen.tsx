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
  type AdminErrorReport,
} from "../services/ai/model-fallback-manager"
import {
  type ChatMessage,
  chatAboutArticleWithGemini,
  DEFAULT_DENTAL_PROMPT,
  globalModelFallbackManager,
  stripHtml,
  summarizeArticleWithGemini,
} from "../services/ai/gemini-service"
import {
  type VerificationResult,
  verifySummaryNumbers,
} from "../services/ai/quality-checker"
import type { SitePost } from "../services/site-scraper/types"
import { updatePostSummary } from "../storage/database"
import { readArticleHtml } from "../storage/file-storage"
import { colors } from "../theme/colors"

interface PostDetailScreenProps {
  post: SitePost
  siteName?: string
  onBack: () => void
}

export function PostDetailScreen({ post, siteName, onBack }: PostDetailScreenProps) {
  const theme = colors.dark

  const [rawHtml, setRawHtml] = useState("")
  const [cleanText, setCleanText] = useState("")
  const [isLoadingArticle, setIsLoadingArticle] = useState(true)

  // AI Summary State
  const [summary, setSummary] = useState<string>((post as any).geminiSummary || "")
  const [modelUsed, setModelUsed] = useState<string>((post as any).modelUsed || "")
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [adminReport, setAdminReport] = useState<AdminErrorReport | null>(null)
  const [verification, setVerification] = useState<VerificationResult | null>(null)

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Chat Q&A State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isAnswering, setIsAnswering] = useState(false)

  useEffect(() => {
    loadArticleContent()
  }, [post.id])

  const loadArticleContent = async () => {
    setIsLoadingArticle(true)
    try {
      let html = post.content || ""
      const htmlPath = (post as any).htmlPath
      if (!html && htmlPath) {
        html = await readArticleHtml(htmlPath)
      }
      setRawHtml(html)
      const text = stripHtml(html) || post.excerpt || post.title
      setCleanText(text)

      // If summary already exists in DB, perform verification check
      if ((post as any).geminiSummary) {
        const verif = verifySummaryNumbers((post as any).geminiSummary, text)
        setVerification(verif)
      }
    } catch (err: any) {
      console.error("Error loading article html:", err)
    } finally {
      setIsLoadingArticle(false)
    }
  }

  // Generate AI Summary
  const handleSummarize = async (forcedModel?: string) => {
    if (isSummarizing) return
    setIsSummarizing(true)
    setSummaryError(null)
    setAdminReport(null)

    try {
      const result = await summarizeArticleWithGemini({
        title: post.title,
        content: rawHtml || post.content || cleanText,
        excerpt: post.excerpt,
        siteName: siteName || "Tự học RHM",
        forcedModelId: forcedModel,
      })

      setSummary(result.text)
      setModelUsed(result.modelUsed)

      // Perform quality verification check against original article
      const verif = verifySummaryNumbers(result.text, cleanText)
      setVerification(verif)

      // Persist to local database
      await updatePostSummary(post.id, result.text, result.modelUsed, verif.isConsistent)
    } catch (err: any) {
      setSummaryError(err.message || "Lỗi tóm tắt bài viết")
      if (err.report) {
        setAdminReport(err.report)
      }
    } finally {
      setIsSummarizing(false)
    }
  }

  // Native Vietnamese TTS
  const handleToggleTTS = async () => {
    try {
      const Speech = await import("expo-speech")
      if (isSpeaking) {
        await Speech.stop()
        setIsSpeaking(false)
      } else {
        const textToRead = summary
          ? `Bản tóm tắt bài viết: ${post.title}. ${summary}`
          : `${post.title}. ${cleanText.slice(0, 3000)}`

        setIsSpeaking(true)
        Speech.speak(textToRead, {
          language: "vi-VN",
          rate: 0.95,
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        })
      }
    } catch {
      Alert.alert("Thông báo", "Tính năng đọc giọng nói khả dụng trên thiết bị di động.")
    }
  }

  // Send Follow-up Chat Question
  const handleSendQuestion = async (predefinedQuestion?: string) => {
    const questionText = predefinedQuestion || chatInput.trim()
    if (!questionText || isAnswering) return

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: questionText,
      createdAt: Date.now(),
    }

    setChatHistory((prev) => [...prev, userMsg])
    if (!predefinedQuestion) setChatInput("")
    setIsAnswering(true)

    try {
      const answer = await chatAboutArticleWithGemini({
        title: post.title,
        content: cleanText,
        summary: summary || "(Chưa có bản tóm tắt)",
        history: chatHistory,
        question: questionText,
      })

      const botMsg: ChatMessage = {
        id: `m_${Date.now()}`,
        role: "model",
        text: answer,
        createdAt: Date.now(),
      }
      setChatHistory((prev) => [...prev, botMsg])
    } catch (err: any) {
      Alert.alert("Lỗi AI", err.message || "Không thể trả lời câu hỏi lúc này.")
    } finally {
      setIsAnswering(false)
    }
  }

  // Copy Admin Error details to clipboard
  const handleCopyAdminReport = async () => {
    if (!adminReport) return
    try {
      const Clipboard = await import("expo-clipboard")
      await Clipboard.setStringAsync(adminReport.formattedCopyText)
      Alert.alert(
        "Đã sao chép",
        "Thông tin lỗi đã được chép vào bộ nhớ tạm. Bác sĩ có thể dán vào tin nhắn gửi cho Admin.",
      )
    } catch {
      Alert.alert("Thông báo", adminReport.formattedCopyText)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={[styles.backText, { color: theme.accentLight }]}>← Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.headerRightControls}>
          <TouchableOpacity
            style={[
              styles.ttsBtn,
              { backgroundColor: isSpeaking ? theme.accent : theme.secondaryCard },
            ]}
            onPress={handleToggleTTS}
          >
            <Text style={{ fontSize: 13, color: isSpeaking ? "#FFF" : theme.text }}>
              {isSpeaking ? "⏹ Dừng đọc" : "🔊 Nghe đọc"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Article Meta */}
        <View style={styles.articleHeader}>
          <Text style={[styles.title, { color: theme.text }]}>{post.title}</Text>
          <View style={styles.metaRow}>
            {post.author ? (
              <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                Tác giả: {post.author}
              </Text>
            ) : null}
            {post.publishedAt ? (
              <Text style={[styles.dateText, { color: theme.textMuted }]}>
                {post.publishedAt.slice(0, 10)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Gemini AI Summary Card */}
        <View
          style={[
            styles.aiCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.aiPurpleBorder,
            },
          ]}
        >
          <View style={styles.aiCardHeader}>
            <View style={styles.aiBadgeRow}>
              <Text style={[styles.aiTitle, { color: theme.aiPurpleLight }]}>
                ✦ Tóm Tắt Chuyên Sâu Nha Khoa
              </Text>
              {modelUsed ? (
                <View style={[styles.modelBadge, { backgroundColor: theme.aiPurpleBg }]}>
                  <Text style={[styles.modelBadgeText, { color: theme.aiPurpleLight }]}>
                    {modelUsed}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.resummarizeBtn, { backgroundColor: theme.secondaryCard }]}
              onPress={() => handleSummarize()}
              disabled={isSummarizing}
            >
              {isSummarizing ? (
                <ActivityIndicator size="small" color={theme.accentLight} />
              ) : (
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                  {summary ? "Tóm tắt lại" : "Bắt đầu tóm tắt"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Verification check result */}
          {verification && (
            <View
              style={[
                styles.verifBanner,
                {
                  backgroundColor: verification.isConsistent
                    ? theme.successBg
                    : theme.warningBg,
                  borderColor: verification.isConsistent ? theme.success : theme.warning,
                },
              ]}
            >
              <Text
                style={{
                  color: verification.isConsistent ? theme.success : theme.warning,
                  fontSize: 12,
                  lineHeight: 16,
                }}
              >
                {verification.isConsistent
                  ? "✓ Đã đối chiếu số liệu lâm sàng & đơn vị hoàn toàn khớp với bài gốc."
                  : verification.warningMessage}
              </Text>
            </View>
          )}

          {/* Text Disclaimer */}
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            * Lưu ý: Bản tóm tắt dựa trên phần chữ của bài viết, không bao gồm hình ảnh hoặc bảng biểu minh hoạ dạng ảnh.
          </Text>

          {/* Summary Content */}
          {summary ? (
            <View style={[styles.summaryBox, { backgroundColor: theme.secondaryCard }]}>
              <Text style={[styles.summaryText, { color: theme.text }]}>{summary}</Text>
            </View>
          ) : !isSummarizing && !summaryError ? (
            <View style={styles.emptySummaryBox}>
              <Text style={[styles.emptySummaryText, { color: theme.textSecondary }]}>
                Chưa có bản tóm tắt cho bài viết này. Hãy nhấn nút phía trên để tạo bản tóm lược lâm sàng 4 phần theo chuẩn Răng Hàm Mặt.
              </Text>
            </View>
          ) : null}

          {/* Admin Error Card (If all models failed) */}
          {summaryError && (
            <View style={[styles.errorCard, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
              <Text style={[styles.errorTitle, { color: theme.danger }]}>⚠️ Không thể tạo bản tóm tắt</Text>
              <Text style={[styles.errorMsg, { color: theme.text }]}>{summaryError}</Text>

              {adminReport && (
                <View style={styles.adminActionRow}>
                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: "#0068FF" }]}
                    onPress={() => Linking.openURL(ADMIN_ZALO_URL)}
                  >
                    <Text style={styles.adminBtnText}>💬 Zalo Admin ({ADMIN_PHONE})</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.adminBtn, { backgroundColor: theme.secondaryCard, borderWidth: 1, borderColor: theme.separator }]}
                    onPress={handleCopyAdminReport}
                  >
                    <Text style={[styles.adminBtnText, { color: theme.text }]}>📋 Sao chép lỗi</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Follow-up Chat Q&A */}
        {summary ? (
          <View style={[styles.chatCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.chatSectionTitle, { color: theme.text }]}>
              💬 Hỏi Đáp Chuyên Sâu Theo Ngữ Cảnh
            </Text>
            <Text style={[styles.chatDesc, { color: theme.textSecondary }]}>
              Đặt câu hỏi để AI giải thích sâu hơn từng phần [X.Y] hoặc mở rộng ứng dụng lâm sàng dựa trên toàn văn bài viết.
            </Text>

            {/* Quick Prompts */}
            <View style={styles.quickPromptRow}>
              <TouchableOpacity
                style={[styles.quickChip, { backgroundColor: theme.secondaryCard }]}
                onPress={() => handleSendQuestion("Giải thích sâu hơn các lưu ý lâm sàng trong bài")}
              >
                <Text style={[styles.quickChipText, { color: theme.accentLight }]}>
                  💡 Giải thích ứng dụng lâm sàng
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChip, { backgroundColor: theme.secondaryCard }]}
                onPress={() => handleSendQuestion("Chỉ định và chống chỉ định được nhắc tới là gì?")}
              >
                <Text style={[styles.quickChipText, { color: theme.accentLight }]}>
                  📋 Chỉ định & chống chỉ định
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            {chatHistory.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.chatBubble,
                  msg.role === "user"
                    ? [styles.userBubble, { backgroundColor: theme.accentBg, borderColor: theme.accent }]
                    : [styles.botBubble, { backgroundColor: theme.secondaryCard, borderColor: theme.separator }],
                ]}
              >
                <Text
                  style={[
                    styles.chatRoleLabel,
                    { color: msg.role === "user" ? theme.accentLight : theme.aiPurpleLight },
                  ]}
                >
                  {msg.role === "user" ? "Bác sĩ:" : "Trợ lý AI:"}
                </Text>
                <Text style={[styles.chatBubbleText, { color: theme.text }]}>{msg.text}</Text>
              </View>
            ))}

            {isAnswering && (
              <View style={styles.answeringBox}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.answeringText, { color: theme.textMuted }]}>
                  AI đang đối chiếu với bài viết để trả lời...
                </Text>
              </View>
            )}

            {/* Chat Input */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={[
                  styles.chatInput,
                  {
                    backgroundColor: theme.secondaryCard,
                    color: theme.text,
                    borderColor: theme.separator,
                  },
                ]}
                placeholder="Đặt câu hỏi về bài viết..."
                placeholderTextColor={theme.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: theme.accent }]}
                onPress={() => handleSendQuestion()}
                disabled={isAnswering || !chatInput.trim()}
              >
                <Text style={styles.sendBtnText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Full Article Content */}
        <View style={[styles.contentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.contentHeader, { color: theme.text }]}>📖 Toàn Văn Bài Viết Gốc</Text>
          {isLoadingArticle ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
              {cleanText}
            </Text>
          )}
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
    justifyContent: "space-between",
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerRightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ttsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
    gap: 16,
  },
  articleHeader: {
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  authorText: {
    fontSize: 13,
  },
  dateText: {
    fontSize: 13,
  },
  aiCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  aiBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  modelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  resummarizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 10,
  },
  summaryBox: {
    padding: 14,
    borderRadius: 10,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptySummaryBox: {
    padding: 14,
    alignItems: "center",
  },
  emptySummaryText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  errorCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorMsg: {
    fontSize: 13,
    marginBottom: 10,
  },
  adminActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  adminBtn: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  chatCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  chatSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  chatDesc: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  quickPromptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chatBubble: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  botBubble: {
    alignSelf: "flex-start",
    maxWidth: "95%",
  },
  chatRoleLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  chatBubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  answeringBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  answeringText: {
    fontSize: 12,
  },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  chatInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  sendBtn: {
    width: 60,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    color: "#FFF",
    fontWeight: "700",
  },
  contentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  contentHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 24,
  },
})
