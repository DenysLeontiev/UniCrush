import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { environment } from '../../../environments/environment.development';
import { ToastService } from '../../services/toast/toast.service';

@Component({
  selector: 'app-share-modal',
  imports: [FontAwesomeModule],
  templateUrl: './share-modal.html'
})
export class ShareModal {
  private sheetRef = inject(MatBottomSheetRef<ShareModal>);
  private toast = inject(ToastService);

  readonly url = `${environment.siteUrl}/home`;
  readonly displayUrl = this.url.replace(/^https?:\/\//, '');
  readonly text = 'ЮніКраш — свайпай викладачів політехніки, дивись краш дня і пиши анонімні коментарі 💘';
  readonly canNativeShare = typeof navigator.share === 'function';

  readonly telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(this.url)}&text=${encodeURIComponent(this.text)}`;

  async share(): Promise<void> {
    try {
      await navigator.share({ title: 'ЮніКраш', text: this.text, url: this.url });
      this.sheetRef.dismiss();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await this.copy();
      }
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
      this.toast.show('Посилання скопійовано ✨');
      this.sheetRef.dismiss();
    } catch {
      this.toast.show(this.url, 4000);
    }
  }

  close(): void {
    this.sheetRef.dismiss();
  }
}
