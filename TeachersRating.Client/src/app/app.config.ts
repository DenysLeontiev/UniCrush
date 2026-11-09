import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TrackingErrorHandler, errorTrackingInterceptor } from './services/analytics/error-tracking';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faArrowUpRightFromSquare,
  faChevronRight,
  faCircleExclamation,
  faComment,
  faComments,
  faCopy,
  faCrown,
  faFaceFrownOpen,
  faFire,
  faHeart,
  faHeartCrack,
  faHouse,
  faLink,
  faMagnifyingGlass,
  faMoon,
  faPaperPlane,
  faPlay,
  faReply,
  faRotateLeft,
  faRotateRight,
  faScaleBalanced,
  faShareNodes,
  faShuffle,
  faSliders,
  faSun,
  faTrophy,
  faUserSecret,
  faWifi,
  faXmark,
  faLock,
  faRightFromBracket,
  faEye,
  faEyeSlash,
  faTrash,
  faUsers,
  faGlobe,
} from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        // A transition interrupted by another navigation is fine; don't report it as an error.
        onViewTransitionCreated: ({ transition }) => {
          transition.ready.catch(() => {});
          transition.finished.catch(() => {});
          transition.updateCallbackDone.catch(() => {});
        },
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withComponentInputBinding()
    ),
    provideHttpClient(withInterceptors([errorTrackingInterceptor])),
    { provide: ErrorHandler, useClass: TrackingErrorHandler },
    {
      provide: FaIconLibrary,
      useFactory: () => {
        const library = new FaIconLibrary();
        // Only the icons the app uses (keeps the bundle small).
        library.addIcons(
          faArrowLeft,
          faArrowRight,
          faArrowUpRightFromSquare,
          faChevronRight,
          faCircleExclamation,
          faComment,
          faComments,
          faCopy,
          faCrown,
          faFaceFrownOpen,
          faFire,
          faHeart,
          faHeartCrack,
          faHouse,
          faLink,
          faMagnifyingGlass,
          faMoon,
          faPaperPlane,
          faPlay,
          faReply,
          faRotateLeft,
          faRotateRight,
          faScaleBalanced,
          faShareNodes,
          faShuffle,
          faSliders,
          faSun,
          faTrophy,
          faUserSecret,
          faWifi,
          faXmark,
          faLock,
          faRightFromBracket,
          faEye,
          faEyeSlash,
          faTrash,
          faUsers,
          faGlobe,
          faTelegram,
        );
        return library;
      }
    }
  ]
};
