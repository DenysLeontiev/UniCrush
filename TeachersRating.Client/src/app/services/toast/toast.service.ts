import { Injectable, signal } from '@angular/core';

/** Tiny bottom toast, rendered once in the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, durationMs = 2200): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
