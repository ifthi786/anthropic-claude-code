import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

let _client = null

function getClient() {
  if (_client) return _client
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in your .env file.')
  // dangerouslyAllowBrowser: acceptable here — dev/internal tool, key is user-owned
  _client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return _client
}

/**
 * Send a chat message and stream back the assistant reply.
 *
 * @param {{role:'user'|'assistant', content:string}[]} history  Full conversation history
 * @param {string} systemPrompt                                   Built by contextBuilder
 * @param {(chunk: string) => void} onChunk                       Called for each streamed text delta
 * @param {AbortSignal} [signal]                                  Optional abort signal
 * @returns {Promise<string>}  The complete assistant message text
 */
export async function sendMessage(history, systemPrompt, onChunk, signal) {
  const client = getClient()

  const stream = await client.messages.stream(
    {
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type:          'text',
          text:          systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: history.map(m => ({ role: m.role, content: m.content })),
    },
    { signal },
  )

  let fullText = ''

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const chunk = event.delta.text
      fullText += chunk
      onChunk(chunk)
    }
  }

  return fullText
}

/**
 * Friendly error message for display in the chat UI.
 * @param {unknown} err
 * @returns {string}
 */
export function formatApiError(err) {
  if (err?.name === 'AbortError') return null  // user cancelled — no UI error needed

  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate limit reached. Please wait a moment and try again.'
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Invalid API key. Check your VITE_ANTHROPIC_API_KEY in .env.'
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return 'Anthropic API is overloaded. Please try again in a few seconds.'
    return `API error ${err.status}: ${err.message}`
  }
  if (err?.message?.includes('VITE_ANTHROPIC_API_KEY')) {
    return err.message
  }
  return `Unexpected error: ${err?.message ?? String(err)}`
}
