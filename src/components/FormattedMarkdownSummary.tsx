import React, { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { colors } from "../theme/colors"

interface FormattedMarkdownSummaryProps {
  content: string
}

// Parse inline text with **bold** and (X.Y) notation
function parseInlineSpans(text: string, baseKey: string, theme: typeof colors.dark) {
  // Regex to match **bold** or reference numbers like (1.2) or (5.10)
  const regex = /(\*\*.*?\*\*|\(\d+\.\d+\))/g
  const parts = text.split(regex)

  return parts.map((part, index) => {
    const key = `${baseKey}-${index}`

    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2)
      return (
        <Text key={key} style={[styles.boldText, { color: theme.text }]}>
          {boldText}
        </Text>
      )
    }

    if (/^\(\d+\.\d+\)$/.test(part)) {
      return (
        <Text
          key={key}
          style={[styles.refNumber, { color: theme.aiPurpleLight }]}
        >
          {" "}{part}
        </Text>
      )
    }

    return (
      <Text key={key} style={[styles.regularSpan, { color: theme.text }]}>
        {part}
      </Text>
    )
  })
}

export function FormattedMarkdownSummary({ content }: FormattedMarkdownSummaryProps) {
  const theme = colors.dark

  const renderedElements = useMemo(() => {
    if (!content) return null

    const lines = content.split("\n")
    const elements: React.ReactNode[] = []

    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine.trim()
      const key = `line-${lineIndex}`

      // Empty line -> small vertical spacing
      if (!line) {
        elements.push(<View key={key} style={styles.emptySpacing} />)
        return
      }

      // Horizontal separator: --- or ***
      if (line === "---" || line === "***" || line === "___") {
        elements.push(
          <View
            key={key}
            style={[styles.separatorLine, { backgroundColor: theme.separator }]}
          />,
        )
        return
      }

      // Heading 1: # ...
      if (line.startsWith("# ")) {
        const title = line.replace(/^#\s+/, "")
        elements.push(
          <View key={key} style={styles.h1Container}>
            <Text style={[styles.h1Text, { color: theme.text }]}>
              {parseInlineSpans(title, `${key}-h1`, theme)}
            </Text>
          </View>,
        )
        return
      }

      // Heading 2: ## Phần X...
      if (line.startsWith("## ")) {
        const title = line.replace(/^##\s+/, "")
        elements.push(
          <View
            key={key}
            style={[
              styles.h2Box,
              {
                backgroundColor: theme.aiPurpleBg,
                borderColor: theme.aiPurpleBorder,
              },
            ]}
          >
            <Text style={[styles.h2Text, { color: theme.aiPurpleLight }]}>
              {parseInlineSpans(title, `${key}-h2`, theme)}
            </Text>
          </View>,
        )
        return
      }

      // Heading 3: ### ...
      if (line.startsWith("### ")) {
        const title = line.replace(/^###\s+/, "")
        elements.push(
          <View key={key} style={styles.h3Row}>
            <View style={[styles.h3Bar, { backgroundColor: theme.accent }]} />
            <Text style={[styles.h3Text, { color: theme.text }]}>
              {parseInlineSpans(title, `${key}-h3`, theme)}
            </Text>
          </View>,
        )
        return
      }

      // Bullet points: - ... or * ...
      if (/^[-*]\s+/.test(line)) {
        const itemText = line.replace(/^[-*]\s+/, "")
        elements.push(
          <View key={key} style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: theme.aiPurpleLight }]}>•</Text>
            <Text style={[styles.bulletBody, { color: theme.text }]}>
              {parseInlineSpans(itemText, `${key}-li`, theme)}
            </Text>
          </View>,
        )
        return
      }

      // Numbered items: 1. ... or 2. ...
      const numMatch = line.match(/^(\d+)\.\s+(.*)/)
      if (numMatch) {
        const num = numMatch[1]
        const itemText = numMatch[2]
        elements.push(
          <View key={key} style={styles.numRow}>
            <Text style={[styles.numPrefix, { color: theme.accent }]}>
              {num}.
            </Text>
            <Text style={[styles.numBody, { color: theme.text }]}>
              {parseInlineSpans(itemText, `${key}-num`, theme)}
            </Text>
          </View>,
        )
        return
      }

      // Regular paragraph
      elements.push(
        <Text key={key} style={[styles.paragraphText, { color: theme.text }]}>
          {parseInlineSpans(line, `${key}-p`, theme)}
        </Text>,
      )
    })

    return elements
  }, [content, theme])

  return <View style={styles.container}>{renderedElements}</View>
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  emptySpacing: {
    height: 8,
  },
  separatorLine: {
    marginVertical: 12,
    height: 1,
  },
  h1Container: {
    marginBottom: 8,
  },
  h1Text: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
  },
  h2Box: {
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  h2Text: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  h3Row: {
    marginTop: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  h3Bar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  h3Text: {
    fontSize: 15,
    fontWeight: "700",
  },
  bulletRow: {
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
    fontWeight: "700",
  },
  bulletBody: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  numRow: {
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 4,
  },
  numPrefix: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 24,
    marginRight: 6,
  },
  numBody: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  paragraphText: {
    marginVertical: 3,
    fontSize: 15,
    lineHeight: 24,
  },
  regularSpan: {
    fontSize: 15,
    lineHeight: 24,
  },
  boldText: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 24,
  },
  refNumber: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 24,
  },
})
