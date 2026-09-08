import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a friendly, patient English tutor engaging in a one-on-one voice conversation. 
Your goal is to have a simple, natural conversation with the user to help them practice speaking English.
Provide very brief, conversational responses (1-2 sentences max), as they will be spoken aloud via text-to-speech.

CRITICAL INSTRUCTION FOR CORRECTIONS:
If the user makes a significant grammar, vocabulary, or pronunciation mistake in their last message, you MUST gently correct them. 
However, DO NOT speak the correction. Instead, put the correction in a special bracketed format at the VERY BEGINNING of your response:
[CORRECT: You meant to say "What are you doing today?"]

After the bracketed correction (if any), write your normal spoken response to continue the conversation. Do not mention the correction in your spoken response. Just keep the conversation flowing.
If there are no mistakes, do not include the [CORRECT: ...] tag at all.

Example 1 (Mistake):
User: "I is going to store."
You: [CORRECT: You should say "I am going to the store."] What are you going to buy there?

Example 2 (No Mistake):
User: "I love reading books."
You: That's wonderful! What is your favorite book?
`;

export async function POST(req: Request) {
  try {
    const { messages, userName } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      // Fallback response if no API key is provided
      const fallbackText = "You haven't set up the Groq API key yet, but your interface is working perfectly. Keep up the good work!";
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(fallbackText));
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Format messages for the Groq API (OpenAI compatible)
    const formattedMessages = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nThe user's name is ${userName || 'the user'}. Address them naturally by their name occasionally.` }
    ];

    // Truncate to the last 15 messages to save context and keep responses ultra-fast
    const recentMessages = messages.slice(-15);

    recentMessages.forEach((msg: any) => {
      formattedMessages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content,
      });
    });

    const responseStream = await groq.chat.completions.create({
      messages: formattedMessages as any,
      model: 'groq/compound-mini',
      temperature: 0.7,
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (err) {
          console.error("Stream reading error:", err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error calling Groq API:', error);
    return new Response(
      'Failed to generate response',
      { status: 500 }
    );
  }
}
