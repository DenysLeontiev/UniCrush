import { Directive, ElementRef, OnDestroy, OnInit, inject, output } from '@angular/core';

/** Emits when the element scrolls into view (used for infinite scroll). */
@Directive({ selector: '[appInView]' })
export class InViewDirective implements OnInit, OnDestroy {
  readonly appInView = output<void>();

  private el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) this.appInView.emit();
      },
      { rootMargin: '400px 0px' }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
