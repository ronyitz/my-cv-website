import { Injectable } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  /** Sends the conversation to the server and calls onChunk as the answer streams in. */
  async ask(messages: ChatMessage[], onChunk: (text: string) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? 'Something went wrong. Please try again.');
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(value);
    }
  }
}
