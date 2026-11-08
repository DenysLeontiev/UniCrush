import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../environments/environment.development';

@Component({
  selector: 'app-share-modal',
  imports: [],
  templateUrl: './share-modal.html',
  styleUrl: './share-modal.scss'
})
export class ShareModal {

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<ShareModal>
  ) {}

  public async shareContent(): Promise<void> {
    const shareData = {
      text: `Свапай та коментуй викладачів: ${environment.siteUrl}/home`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        this.dialogRef.close();
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.text);
        alert('Посилання скопійовано в буфер обміну!');
        this.dialogRef.close();
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  }
}
