import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useChat } from '../chat/useChat'
import { contextLabel } from '../chat/contextBuilder'

// ─── Quick-prompt templates ───────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Summarise findings',   text: 'Give me a concise executive summary of the key findings from this project analysis.' },
  { label: 'Top overpriced items', text: 'Which items are most overpriced and what is the total estimated overpayment?' },
  { label: 'Negotiation strategy', text: 'Based on the deviations, which categories should I prioritise in contract negotiations?' },
  { label: 'Category breakdown',   text: 'Break down the cost deviations by category and highlight the worst-performing ones.' },
  { label: 'Unmatched items',      text: 'What are the unmatched items and how should I handle them in the procurement process?' },
  { label: 'Market context',       text: 'How do these rates compare to typical UAE construction market rates for similar projects?' },
]

// ─── Markdown renderer (lightweight, no extra deps) ──────────────────────────

function renderMarkdown(text) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h4 key={key++} className="font-semibold text-slate-800 mt-3 mb-1 text-sm">{inlineMarkdown(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={key++} className="font-semibold text-slate-800 mt-3 mb-1 text-sm">{inlineMarkdown(line.slice(3))}</h3>)
    } else if (line.startsWith('# ')) {
      elements.push(<h3 key={key++} className="font-semibold text-slate-800 mt-2 mb-1 text-sm">{inlineMarkdown(line.slice(2))}</h3>)
    }
    // Bullet list
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={i} className="ml-3 list-disc">{inlineMarkdown(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={key++} className="space-y-0.5 my-1">{items}</ul>)
      continue
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} className="ml-3 list-decimal">{inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={key++} className="space-y-0.5 my-1">{items}</ol>)
      continue
    }
    // Horizontal rule
    else if (line === '---' || line === '***') {
      elements.push(<hr key={key++} className="my-2 border-slate-200" />)
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />)
    }
    // Regular paragraph
    else {
      elements.push(<p key={key++} className="leading-relaxed">{inlineMarkdown(line)}</p>)
    }

    i++
  }

  return elements
}

function inlineMarkdown(text) {
  // Bold **text** and *italic*, inline code `code`
  const parts = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0, m

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} className="bg-slate-100 text-navy-700 font-mono text-xs px-1 py-0.5 rounded">{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && message.streaming

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={[
        'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5',
        isUser ? 'bg-navy-500 text-white' : 'bg-gold-100 text-gold-700',
      ].join(' ')}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={[
        'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
        isUser
          ? 'bg-navy-500 text-white rounded-tr-sm'
          : message.isError
            ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
            : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-sm',
      ].join(' ')}>
        {isEmpty ? (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose-like">{renderMarkdown(message.content)}</div>
        )}
        {message.streaming && message.content && (
          <span className="inline-block w-1 h-3 bg-gold-400 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ChatbotPanel() {
  const { analysisContext } = useApp()
  const { messages, isStreaming, error, sendUserMessage, clearChat, abortStream } = useChat(analysisContext)

  const [input,      setInput]      = useState('')
  const [minimised,  setMinimised]  = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    sendUserMessage(input)
    setInput('')
    setShowPrompts(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleQuickPrompt(text) {
    sendUserMessage(text)
    setShowPrompts(false)
  }

  const ctxLabel = contextLabel(analysisContext)
  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  return (
    <div className={[
      'flex flex-col border-l border-slate-200 bg-white transition-all duration-300',
      minimised ? 'w-12' : 'w-80 lg:w-96',
    ].join(' ')}>

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-navy-500 text-white shrink-0">
        <button
          onClick={() => setMinimised(v => !v)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title={minimised ? 'Expand chat' : 'Minimise chat'}
        >
          <ChatIcon minimised={minimised} />
        </button>

        {!minimised && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">AI Procurement Analyst</p>
              <p className="text-xs text-navy-200 truncate mt-0.5">{ctxLabel}</p>
            </div>
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="p-1 rounded hover:bg-white/10 transition-colors text-navy-200 hover:text-white"
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>

      {minimised && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-slate-400 [writing-mode:vertical-lr] rotate-180 select-none">
            AI Chat
          </span>
        </div>
      )}

      {!minimised && (
        <>
          {/* ── API key warning ───────────────────────────────────────────── */}
          {!hasApiKey && (
            <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-700">
              <strong>Setup required:</strong> Add <code className="font-mono">VITE_ANTHROPIC_API_KEY</code> to your <code className="font-mono">.env</code> file to enable the AI assistant.
            </div>
          )}

          {/* ── Messages area ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <WelcomeState
                hasData={!!analysisContext?.hasAnalysis}
                onPrompt={handleQuickPrompt}
              />
            )}
            {messages.map((m, i) => (
              <MessageBubble key={m.timestamp ?? i} message={m} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Error banner ──────────────────────────────────────────────── */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border-t border-red-200 text-xs text-red-600 flex justify-between items-center shrink-0">
              <span>{error}</span>
              <button onClick={() => {}} className="ml-2 underline">dismiss</button>
            </div>
          )}

          {/* ── Quick prompts toggle ──────────────────────────────────────── */}
          {showPrompts && (
            <div className="px-2 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
              <p className="text-xs text-slate-500 mb-1.5 px-1">Quick questions</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp.label}
                    onClick={() => handleQuickPrompt(qp.text)}
                    disabled={isStreaming}
                    className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-navy-300 hover:text-navy-600 transition-colors disabled:opacity-40"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Input row ─────────────────────────────────────────────────── */}
          <div className="px-3 py-2.5 border-t border-slate-200 shrink-0 flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowPrompts(v => !v)}
                title="Quick prompts"
                className={[
                  'p-1.5 rounded-lg transition-colors',
                  showPrompts ? 'text-navy-500 bg-navy-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                <SparkleIcon />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder={isStreaming ? 'Responding…' : 'Ask about this project…'}
                disabled={isStreaming}
                className="flex-1 resize-none text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-300 disabled:bg-slate-50 disabled:text-slate-400 max-h-32 overflow-auto"
                style={{ minHeight: '34px' }}
              />

              {isStreaming ? (
                <button
                  onClick={abortStream}
                  title="Stop"
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title="Send"
                  className="p-1.5 bg-navy-500 text-white rounded-lg hover:bg-navy-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <SendIcon />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Powered by Claude · Enter to send · Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Welcome state ────────────────────────────────────────────────────────────

function WelcomeState({ hasData, onPrompt }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-40 text-center gap-3 py-4">
      <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
        <span className="text-lg">🤖</span>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">AI Procurement Analyst</p>
        <p className="text-xs text-slate-400 mt-1 max-w-52">
          {hasData
            ? 'Ask me anything about this project\'s BOQ analysis, rates, or recommendations.'
            : 'Load benchmark data and upload a project BOQ to enable context-aware analysis.'}
        </p>
      </div>
      {hasData && (
        <div className="flex flex-wrap gap-1.5 justify-center max-w-64">
          {QUICK_PROMPTS.slice(0, 3).map(qp => (
            <button
              key={qp.label}
              onClick={() => onPrompt(qp.text)}
              className="text-xs bg-navy-50 border border-navy-100 rounded-full px-2.5 py-1 text-navy-600 hover:bg-navy-100 transition-colors"
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChatIcon({ minimised }) {
  return minimised ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}
