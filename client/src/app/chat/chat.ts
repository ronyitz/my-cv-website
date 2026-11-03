import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMessage, ChatService } from './chat.service';

@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  private readonly chat = inject(ChatService);
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Scrolls the chat into view and puts the cursor in the question box. */
  focus(): void {
    this.input().nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.input().nativeElement.focus({ preventScroll: true });
  }

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected draft = '';

  protected readonly suggestions = [
    'What is the main tech stack?',
    'How much Angular experience?',
    'What backend work has been done?',
  ];

  async send(text = this.draft): Promise<void> {
    const question = text.trim();
    if (!question || this.busy()) return;

    this.draft = '';
    this.error.set('');
    this.busy.set(true);

    const history: ChatMessage[] = [...this.messages(), { role: 'user', content: question }];
    this.messages.set([...history, { role: 'assistant', content: '' }]);
    this.scrollToBottom();

    try {
      await this.chat.ask(history, (chunk) => {
        this.messages.update((list) => {
          const last = list.at(-1)!;
          return [...list.slice(0, -1), { ...last, content: last.content + chunk }];
        });
        this.scrollToBottom();
      });
    } catch (err) {
      // Drop the unanswered turn so the conversation stays valid for the next question.
      this.messages.set(history.slice(0, -1));
      this.draft = question;
      this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  reset(): void {
    this.messages.set([]);
    this.error.set('');
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.log().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }
}
