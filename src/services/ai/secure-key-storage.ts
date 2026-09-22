/**
 * Secure Storage Manager for Gemini API Key
 * Uses expo-secure-store on device (hardware-backed keystore/keychain).
 * Never saves API keys in plaintext or hardcoded in source.
 */

const SECURE_KEY_ALIAS = "dental_gemini_api_key_v1"

let memoryKeyCache: string | null = null

export async function getStoredGeminiApiKey(): Promise<string | null> {
  if (memoryKeyCache) return memoryKeyCache

  try {
    // Dynamic import to allow test runners / node environments without crashing
    const SecureStore = await import("expo-secure-store")
    const key = await SecureStore.getItemAsync(SECURE_KEY_ALIAS)
    if (key) {
      memoryKeyCache = key.trim()
      return memoryKeyCache
    }
  } catch (error) {
    // If running in environment without expo-secure-store (e.g. node test)
    return memoryKeyCache
  }
  return null
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const cleanKey = apiKey.trim()
  memoryKeyCache = cleanKey

  try {
    const SecureStore = await import("expo-secure-store")
    await SecureStore.setItemAsync(SECURE_KEY_ALIAS, cleanKey)
  } catch (error) {
    // Fallback in memory
  }
}

export async function deleteGeminiApiKey(): Promise<void> {
  memoryKeyCache = null
  try {
    const SecureStore = await import("expo-secure-store")
    await SecureStore.deleteItemAsync(SECURE_KEY_ALIAS)
  } catch (error) {
    // Fallback in memory
  }
}

export async function hasGeminiApiKey(): Promise<boolean> {
  const key = await getStoredGeminiApiKey()
  return !!key && key.length > 5
}
