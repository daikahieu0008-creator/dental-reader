import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Book6CuteReIcon } from "../icons/book_6_cute_re"
import { Comment2CuteReIcon } from "../icons/comment_2_cute_re"
import { Home5CuteFiIcon } from "../icons/home_5_cute_fi"
import { Home5CuteReIcon } from "../icons/home_5_cute_re"
import { Settings1CuteReIcon } from "../icons/settings_1_cute_re"

export type TabKey = "sites" | "chat" | "pdf" | "settings"

interface BottomNavBarProps {
  activeTab: TabKey
  onSelectTab: (tab: TabKey) => void
}

export function BottomNavBar({ activeTab, onSelectTab }: BottomNavBarProps) {
  const insets = useSafeAreaInsets()
  const activeColor = "#FF5C00"
  const inactiveColor = "#71717A"

  const tabs: { key: TabKey; label: string; renderIcon: (isActive: boolean) => React.ReactNode }[] = [
    {
      key: "sites",
      label: "Trang web",
      renderIcon: (isActive) =>
        isActive ? (
          <Home5CuteFiIcon width={22} height={22} color={activeColor} />
        ) : (
          <Home5CuteReIcon width={22} height={22} color={inactiveColor} />
        ),
    },
    {
      key: "chat",
      label: "Chat AI",
      renderIcon: (isActive) => (
        <Comment2CuteReIcon width={22} height={22} color={isActive ? activeColor : inactiveColor} />
      ),
    },
    {
      key: "pdf",
      label: "Thư viện PDF",
      renderIcon: (isActive) => (
        <Book6CuteReIcon width={22} height={22} color={isActive ? activeColor : inactiveColor} />
      ),
    },
    {
      key: "settings",
      label: "Cài đặt",
      renderIcon: (isActive) => (
        <Settings1CuteReIcon width={22} height={22} color={isActive ? activeColor : inactiveColor} />
      ),
    },
  ]

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrapper}>{tab.renderIcon(isActive)}</View>
              <Text style={[styles.tabLabel, { color: isActive ? activeColor : inactiveColor }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121214",
    borderTopWidth: 1,
    borderTopColor: "#27272A",
  },
  tabBar: {
    flexDirection: "row",
    height: 54,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  iconWrapper: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
})
