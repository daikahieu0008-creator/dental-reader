import React, { useEffect, useState } from "react"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView, StyleSheet, View } from "react-native"

import { CategoryPostsScreen } from "./src/screens/CategoryPostsScreen"
import { GeminiSettingsScreen } from "./src/screens/GeminiSettingsScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PostDetailScreen } from "./src/screens/PostDetailScreen"
import { TelegramLibraryScreen } from "./src/screens/TelegramLibraryScreen"
import type { SiteCategory, SiteMetadata, SitePost } from "./src/services/site-scraper/types"
import { initDatabase } from "./src/storage/database"
import { colors } from "./src/theme/colors"

type ScreenType =
  | "home"
  | "category_posts"
  | "post_detail"
  | "gemini_settings"
  | "telegram_library"

export default function App() {
  const theme = colors.dark

  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home")
  const [selectedSite, setSelectedSite] = useState<SiteMetadata | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SiteCategory | null>(null)
  const [selectedPost, setSelectedPost] = useState<SitePost | null>(null)

  useEffect(() => {
    initDatabase().catch((err) => {
      console.error("Database init error:", err)
    })
  }, [])

  const handleSelectCategory = (category: SiteCategory, site: SiteMetadata) => {
    setSelectedCategory(category)
    setSelectedSite(site)
    setCurrentScreen("category_posts")
  }

  const handleSelectPost = (post: SitePost) => {
    setSelectedPost(post)
    setCurrentScreen("post_detail")
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {currentScreen === "home" && (
        <HomeScreen
          onSelectCategory={handleSelectCategory}
          onOpenGeminiSettings={() => setCurrentScreen("gemini_settings")}
          onOpenTelegramLibrary={() => setCurrentScreen("telegram_library")}
        />
      )}

      {currentScreen === "category_posts" && selectedCategory && selectedSite && (
        <CategoryPostsScreen
          siteUrl={selectedSite.url}
          siteId={selectedSite.id}
          categoryId={String(selectedCategory.id)}
          categoryName={selectedCategory.name}
          onBack={() => setCurrentScreen("home")}
          onSelectPost={handleSelectPost}
        />
      )}

      {currentScreen === "post_detail" && selectedPost && (
        <PostDetailScreen
          post={selectedPost}
          siteName={selectedSite?.name}
          onBack={() => setCurrentScreen("category_posts")}
        />
      )}

      {currentScreen === "gemini_settings" && (
        <GeminiSettingsScreen onBack={() => setCurrentScreen("home")} />
      )}

      {currentScreen === "telegram_library" && (
        <TelegramLibraryScreen onBack={() => setCurrentScreen("home")} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
