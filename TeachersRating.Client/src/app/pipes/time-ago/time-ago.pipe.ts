import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];

/** "щойно", "5 хв", "3 год", "2 дн", then "12 лист" / "12 лист 2024". */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'щойно';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} хв`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} год`;
    if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} дн`;

    const sameYear = date.getFullYear() === new Date().getFullYear();
    return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ' ' + date.getFullYear()}`;
  }
}
