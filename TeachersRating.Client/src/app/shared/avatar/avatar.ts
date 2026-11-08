import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

// Visual styles for the avatar live in src/styles.scss (app-avatar).

/** lpnu.ua uses a generic placeholder for teachers without a photo. */
export function isDefaultPhoto(url: string | null | undefined): boolean {
  return !url || url.includes('defphoto');
}

/** "Прізвище Ім'я По-батькові" -> "ІП" */
export function teacherInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[1]?.[0] ?? '') + (words[0]?.[0] ?? '')).toUpperCase() || '?';
}


/** Round photo with optional story ring. Falls back to a monogram for lpnu.ua's default photo. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="avatar" [class.ring]="ring()" [class.square]="square()" [style.--size.px]="size()">
      <div class="inner">
        @if (showImage()) {
          <img [src]="src()" [alt]="name()" loading="lazy" decoding="async" (error)="failed.set(true)" draggable="false" />
        } @else {
          <span class="mono">{{ initials() }}</span>
        }
      </div>
    </div>
  `,
})
export class Avatar {
  readonly src = input<string | null | undefined>('');
  readonly name = input<string>('');
  readonly size = input<number>(48);
  readonly ring = input<boolean>(false);
  readonly square = input<boolean>(false);

  readonly failed = signal(false);

  readonly showImage = computed(() => !isDefaultPhoto(this.src()) && !this.failed());
  readonly initials = computed(() => teacherInitials(this.name()));
}
