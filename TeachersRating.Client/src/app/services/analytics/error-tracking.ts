import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';
import { AnalyticsService } from './analytics.service';

/** Sends uncaught JS errors to analytics (and still logs them to the console). */
@Injectable()
export class TrackingErrorHandler extends ErrorHandler {
  // Resolved lazily: the ErrorHandler is created before the router/analytics exist.
  private injector = inject(Injector);

  override handleError(error: unknown): void {
    super.handleError(error);
    try {
      const err = error as { message?: string; rejection?: { message?: string } };
      const message = err?.rejection?.message ?? err?.message ?? String(error);
      this.injector.get(AnalyticsService).trackError(`js: ${message}`);
    } catch {
      /* never throw from the error handler */
    }
  }
}

/** Reports failed API calls (network errors and 5xx) — ids stripped so the same error groups together. */
export const errorTrackingInterceptor: HttpInterceptorFn = (req, next) => {
  const analytics = inject(AnalyticsService);

  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) return;
        if (req.url.includes('/track') || req.url.includes('/admin')) return;
        if (error.status !== 0 && error.status < 500) return;

        const path = req.url
          .replace(/^https?:\/\/[^/]+/, '')
          .split('?')[0]
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

        analytics.trackError(`api ${error.status || 'network'} ${req.method} ${path}`);
      },
    }),
  );
};
