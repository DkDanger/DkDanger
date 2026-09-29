import type { Config } from '@netlify/functions'
import OpenAI from 'openai'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 8_000

function error(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export default async (req: Request) => {
  if (req.method !== 'POST') return error('Method not allowed.', 405)

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return error('Send a valid JSON request.', 400)
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return error('Add a message to start the conversation.', 400)
  }

  const messages = body.messages.slice(-MAX_MESSAGES)
  const isValid = messages.every(
    (message): message is ChatMessage =>
      typeof message === 'object' &&
      message !== null &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0 &&
      message.content.length <= MAX_MESSAGE_LENGTH,
  )

  if (!isValid) return error('One or more messages are invalid or too long.', 400)

  try {
    const openai = new OpenAI()
    const stream = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'developer',
          content:
            'You are Rana, a thoughtful general-purpose assistant. Be clear, practical, and concise. Use formatting only when it improves readability. Never claim to have completed actions you cannot perform.',
        },
        ...messages,
      ],
      stream: true,
    })

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content
              if (text) controller.enqueue(encoder.encode(text))
            }
          } catch {
            controller.enqueue(encoder.encode('\n\nThe response was interrupted. Please try again.'))
          } finally {
            controller.close()
          }
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  } catch (cause) {
    console.error('Chat request failed', cause instanceof Error ? cause.message : 'Unknown error')
    return error('The assistant is unavailable right now. Please try again.', 502)
  }
}

export const config: Config = {
  path: '/api/chat',
  method: 'POST',
}
