import React, { useEffect, useState } from "react"
import { StatusBar } from "expo-status-bar"
import { SafeAreaView, StyleSheet, View } from "react-native"

import { BottomNavBar, type TabKey } from "./src/components/BottomNavBar"
import { CategoryPostsScreen } from "./src/screens/CategoryPostsScreen"
import { ChatAIScreen } from "./src/screens/ChatAIScreen"
import { GeminiSettingsScreen } from "./src/screens/GeminiSettingsScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PostDetailScreen } from "./src/screens/PostDetailScreen"
import { SiteCategoriesScreen } from "./src/screens/SiteCategoriesScreen"
import { SitePromptSettingsScreen } from "./src/screens/SitePromptSettingsScreen"
import { TelegramLibraryScreen } from "./src/screens/TelegramLibraryScreen"
import type { SiteCategory, SiteMetadata, SitePost } from "./src/services/site-scraper/types"
import { initDatabase } from "./src/storage/database"
import { colors } from "./src/theme/colors"

type ScreenType =
  | "tab_root"
  | "site_categories"
  | "category_posts"
  | "post_detail"
  | "site_prompt_settings"

export default function App() {
  const theme = colors.dark

  const [activeTab, setActiveTab] = useState<TabKey>("sites")
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("tab_root")
  const [previousScreenForPrompt, setPreviousScreenForPrompt] = useState<ScreenType>("site_categories")
  const [selectedSite, setSelectedSite] = useState<SiteMetadata | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SiteCategory | null>(null)
  const [selectedPost, setSelectedPost] = useState<SitePost | null>(null)

  useEffect(() => {
    initDatabase().catch((err) => {
      console.error("Database init error:", err)
    })
  }, [])

  const handleSelectSite = (site: SiteMetadata) => {
    setSelectedSite(site)
    setCurrentScreen("site_categories")
  }

  const handleSelectCategory = (category: SiteCategory, site: SiteMetadata) => {
    setSelectedCategory(category)
    setSelectedSite(site)
    setCurrentScreen("category_posts")
  }

  const handleSelectPost = (post: SitePost) => {
    setSelectedPost(post)
    setCurrentScreen("post_detail")
  }

  const handleOpenPromptSettings = (site: SiteMetadata, fromScreen: ScreenType) => {
    setSelectedSite(site)
    setPreviousScreenForPrompt(fromScreen)
    setCurrentScreen("site_prompt_settings")
  }

  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab)
    setCurrentScreen("tab_root")
  }

  const isStackScreen = currentScreen !== "tab_root"

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      <View style={styles.mainContent}>
        {/* TAB ROOT SCREENS */}
        {!isStackScreen && activeTab === "sites" && (
          <HomeScreen onSelectSite={handleSelectSite} />
        )}

        {!isStackScreen && activeTab === "chat" && <ChatAIScreen />}

        {!isStackScreen && activeTab === "pdf" && <TelegramLibraryScreen />}

        {!isStackScreen && activeTab === "settings" && <GeminiSettingsScreen />}

        {/* STACK CHILD SCREENS */}
        {currentScreen === "site_categories" && selectedSite && (
          <SiteCategoriesScreen
            site={selectedSite}
            onBack={() => setCurrentScreen("tab_root")}
            onSelectCategory={handleSelectCategory}
            onOpenPromptSettings={(site) =>
              handleOpenPromptSettings(site, "site_categories")
            }
            onSiteDeleted={() => setCurrentScreen("tab_root")}
          />
        )}

        {currentScreen === "category_posts" && selectedCategory && selectedSite && (
          <CategoryPostsScreen
            siteUrl={selectedSite.url}
            siteId={selectedSite.id}
            site={selectedSite}
            categoryId={String(selectedCategory.id)}
            categoryName={selectedCategory.name}
            categoryCount={selectedCategory.count}
            onBack={() => setCurrentScreen("site_categories")}
            onSelectPost={handleSelectPost}
            onOpenPromptSettings={(site) =>
              handleOpenPromptSettings(site, "category_posts")
            }
          />
        )}

        {currentScreen === "post_detail" && selectedPost && (
          <PostDetailScreen
            post={selectedPost}
            site={selectedSite}
            siteName={selectedSite?.name}
            onBack={() => setCurrentScreen("category_posts")}
            onOpenPromptSettings={(site) =>
              handleOpenPromptSettings(site, "post_detail")
            }
          />
        )}

        {currentScreen === "site_prompt_settings" && selectedSite && (
          <SitePromptSettingsScreen
            site={selectedSite}
            onBack={() =>
              setCurrentScreen(previousScreenForPrompt || "site_categories")
            }
          />
        )}
      </View>

      {/* 4-Tab Bottom Navigation Bar shown on tab root */}
      {!isStackScreen && (
        <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
})
