import { Component, viewChild } from '@angular/core';
import { Chat } from './chat/chat';
import { profile } from './profile';

const PASTELS = ['peach', 'pink', 'lime', 'yellow', 'sky', 'mint', 'lavender', 'periwinkle'];
const SKILL_ICONS: Record<string, string> = {
  Backend: '⚙️',
  Databases: '🗄️',
  Frontend: '🎨',
  'AI Integration': '✨',
  'Testing & CI/CD': '✅',
  Programming: '👨‍💻',
  'DevOps & Tools': '🐳',
  'AI-Assisted Development': '🤖',
};

@Component({
  selector: 'app-root',
  imports: [Chat],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly chat = viewChild.required(Chat);

  protected readonly p = profile;
  protected readonly year = new Date().getFullYear();
  protected readonly skillCount = profile.skills.reduce((n, g) => n + g.items.length, 0);

  /** Cycles through the pastel colors so neighbouring cards differ. */
  protected pastel(i: number): string {
    return `var(--${PASTELS[i % PASTELS.length]})`;
  }

  protected skillIcon(group: string): string {
    return SKILL_ICONS[group] ?? '💡';
  }

  protected openChat(): void {
    this.chat().focus();
  }
}
