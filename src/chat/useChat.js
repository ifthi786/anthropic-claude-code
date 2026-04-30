import { useState, useCallback, useRef, useEffect } from 'react'
import { sendMessage, formatApiError } from './chatAPI'
import { buildSystemPrompt } from './contextBuilder'

const STORAGE_KEY = 'aldar_chat_history'
const MAX_HISTORY = 40  // messages kept in localStorage

function loadPersistedHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistHistory(messages) {
  try {
    // Keep only the last MAX_HISTORY messages to avoid quota issues
    const trimmed = messages.slice(-MAX_HISTORY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch { /* quota exceeded — silently skip */ }
}

/**
 * useChat — manages conversation state, streaming, and localStorage persistence.
 *
 * @param {import('../analysis/StorageManager').ChatbotContext | null} analysisContext
 * @returns {{
 *   messages: Message[],
 *   isStreaming: boolean,
 *   error: string|null,
 *   sendUserMessage: (text: string) => void,
 *   clearChat: () => void,
 *   abortStream: () => void,
 * }}
 */
export function useChat(analysisContext) {
  const [messages,    setMessages]    = useState(() => loadPersistedHistory())
  const [isStreaming, setIsStreaming] = useState(false)
  const [error,       setError]       = useState(null)

  const abortRef = useRef(null)

  // Persist whenever messages change
  useEffect(() => {
    persistHistory(messages)
  }, [messages])

  const sendUserMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return
    setError(null)

    const userMsg = { role: 'user', content: text.trim(), timestamp: Date.now() }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    // Placeholder for the streaming assistant reply
    const placeholderId = Date.now()
    setMessages(prev => [...prev, {
      role:      'assistant',
      content:   '',
      timestamp: placeholderId,
      streaming: true,
    }])

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const systemPrompt = buildSystemPrompt(analysisContext)

      // Build history in API format (exclude placeholder)
      const history = messages
        .concat(userMsg)
        .filter(m => m.role && m.content)
        .map(m => ({ role: m.role, content: m.content }))

      await sendMessage(
        history,
        systemPrompt,
        (chunk) => {
          setMessages(prev => prev.map(m =>
            m.timestamp === placeholderId
              ? { ...m, content: m.content + chunk }
              : m
          ))
        },
        abortController.signal,
      )

      // Mark streaming done
      setMessages(prev => prev.map(m =>
        m.timestamp === placeholderId
          ? { ...m, streaming: false }
          : m
      ))
    } catch (err) {
      const msg = formatApiError(err)
      if (msg) {
        setError(msg)
        // Replace placeholder with error marker
        setMessages(prev => prev.map(m =>
          m.timestamp === placeholderId
            ? { ...m, content: `⚠ ${msg}`, streaming: false, isError: true }
            : m
        ))
      } else {
        // Aborted — remove placeholder
        setMessages(prev => prev.filter(m => m.timestamp !== placeholderId))
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, isStreaming, analysisContext])

  const abortStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { messages, isStreaming, error, sendUserMessage, clearChat, abortStream }
}
