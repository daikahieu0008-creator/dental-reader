import React, { useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import { AiCuteReIcon } from "../icons/ai_cute_re"
import { SendPlaneCuteFiIcon } from "../icons/send_plane_cute_fi"
import { summarizeMedicalArticle } from "../services/gemini"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: number
}

export function ChatAIScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Xin chào Bác sĩ! Tôi là trợ lý AI chuyên ngành Răng Hàm Mặt. Bác sĩ cần hỗ trợ tra cứu phác đồ, triệu chứng, dược lý hay tóm tắt tài liệu nha khoa nào hôm nay?",
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userText = input.trim()
    setInput("")

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      const prompt = `Bạn là Trợ lý AI Nha khoa chuyên sâu hỗ trợ bác sĩ Răng Hàm Mặt. Hãy trả lời câu hỏi chuyên môn sau đây một cách súc tích, chuẩn y khoa, dẫn chứng phân loại nếu có:\n\n${userText}`
      const response = await summarizeMedicalArticle(prompt, "Nha khoa lâm sàng")
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        text: response.summary || "Không nhận được phản hồi từ AI.",
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: "assistant",
          text: `Lỗi kết nối Gemini: ${err.message || "Vui lòng kiểm tra API Key trong Cài đặt."}`,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const quickPrompts = [
    "Phác đồ điều trị viêm quanh cuống cấp",
    "Chỉ định và chống chỉ định nhổ răng 8 ngầm",
    "Quy trình bôi keo dán nha khoa thế hệ 7",
    "Phân loại gãy xương hàm dưới theo Dingman",
  ]

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBox}>
            <AiCuteReIcon width={20} height={20} color="#FF5C00" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Chat AI Nha Khoa</Text>
            <Text style={styles.headerSub}>Trực tuyến • Gemini 2.5 Flash</Text>
          </View>
        </View>
      </View>

      {/* Message List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isUser = item.role === "user"
          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {!isUser && (
                <View style={styles.aiAvatar}>
                  <Text style={{ fontSize: 13 }}>🩺</Text>
                </View>
              )}
              <View style={styles.messageTextWrapper}>
                <Text
                  style={[
                    styles.messageText,
                    isUser ? styles.userText : styles.assistantText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          )
        }}
        ListFooterComponent={
          messages.length === 1 ? (
            <View style={styles.quickPromptsContainer}>
              <Text style={styles.quickPromptsTitle}>Gợi ý câu hỏi lâm sàng:</Text>
              {quickPrompts.map((q, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickPromptButton}
                  onPress={() => setInput(q)}
                >
                  <Text style={styles.quickPromptText}>💡 {q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FF5C00" />
              <Text style={styles.loadingText}>Gemini đang phân tích y khoa...</Text>
            </View>
          ) : null
        }
      />

      {/* Input row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Hỏi về bệnh học, vật liệu, ca lâm sàng..."
          placeholderTextColor="#71717A"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <SendPlaneCuteFiIcon width={20} height={20} color={input.trim() ? "#FFFFFF" : "#71717A"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    backgroundColor: "#121214",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 92, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 12,
    color: "#22C55E",
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    flexDirection: "row",
    marginBottom: 14,
    maxWidth: "88%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#FF5C00",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#18181B",
    borderColor: "#27272A",
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#27272A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 2,
  },
  messageTextWrapper: {
    flexShrink: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#F4F4F5",
  },
  quickPromptsContainer: {
    marginTop: 16,
  },
  quickPromptsTitle: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  quickPromptButton: {
    backgroundColor: "#18181B",
    borderColor: "#27272A",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  quickPromptText: {
    color: "#E4E4E7",
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 13,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#121214",
    borderTopWidth: 1,
    borderTopColor: "#27272A",
  },
  input: {
    flex: 1,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 20,
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 90,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF5C00",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#27272A",
  },
})
