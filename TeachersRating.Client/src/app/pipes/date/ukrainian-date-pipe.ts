import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ukrainianDate'
})
export class UkrainianDatePipe implements PipeTransform {
  transform(value: unknown, format: string = 'd MMMM yyyy, HH:mm'): string | null {
    if (!value) return null;
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    } else {
      return null;
    }

    const months = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    // Default format: 9 грудня 2025, 14:05
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  }
}
