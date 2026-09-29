const form = document.querySelector('#chat-form')
const input = document.querySelector('#prompt')
const intro = document.querySelector('#intro')
const conversation = document.querySelector('#conversation')
const sendButton = form.querySelector('.send')
const messages = []
let busy = false

function resizeInput() {
  input.style.height = 'auto'
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`
}

function addMessage(role, content = '', extraClass = '') {
  const article = document.createElement('article')
  article.className = `message ${role} ${extraClass}`.trim()
  const label = document.createElement('div')
  label.className = 'message-role'
  label.textContent = role === 'user' ? 'You' : 'Rana'
  const text = document.createElement('div')
  text.className = 'message-content'
  text.textContent = content
  article.append(label, text)
  conversation.append(article)
  return { article, text }
}

async function submitMessage(value) {
  const content = value.trim()
  if (!content || busy) return

  busy = true
  sendButton.disabled = true
  intro.hidden = true
  conversation.classList.add('active')
  messages.push({ role: 'user', content })
  addMessage('user', content)
  input.value = ''
  resizeInput()

  const reply = addMessage('assistant', '', 'streaming')
  reply.article.scrollIntoView({ behavior: 'smooth', block: 'center' })

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Something went wrong. Please try again.')
    }

    if (!response.body) throw new Error('The response could not be read.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      fullText += decoder.decode(chunk, { stream: true })
      reply.text.textContent = fullText
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }

    if (!fullText.trim()) throw new Error('Rana returned an empty response. Please try again.')
    messages.push({ role: 'assistant', content: fullText })
  } catch (error) {
    reply.article.classList.add('error')
    reply.text.textContent = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
  } finally {
    reply.article.classList.remove('streaming')
    busy = false
    sendButton.disabled = false
    input.focus()
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  submitMessage(input.value)
})

input.addEventListener('input', resizeInput)
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    form.requestSubmit()
  }
})

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt
    resizeInput()
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })
})

document.querySelector('#new-chat').addEventListener('click', () => {
  if (busy) return
  messages.length = 0
  conversation.replaceChildren()
  conversation.classList.remove('active')
  intro.hidden = false
  input.value = ''
  resizeInput()
  input.focus()
})
