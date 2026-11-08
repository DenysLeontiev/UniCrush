import { Pipe, PipeTransform } from '@angular/core';

/**
 * lpnu.ua lists institutes as "Архітектури та дизайну інститут" (and sometimes without the word).
 * Turn both into "Інститут архітектури та дизайну", keeping the rest of the casing (proper names).
 */
@Pipe({
  name: 'instituteRename'
})
export class InstituteRenamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const name = (value ?? '').trim().replace(/\s+/g, ' ');
    if (!name) return '';

    if (/^інститут\s/i.test(name)) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }

    const rest = name.replace(/\s*інститут$/i, '');
    return `Інститут ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
  }
}
