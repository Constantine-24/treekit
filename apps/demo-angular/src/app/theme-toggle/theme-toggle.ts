import { Component, signal } from '@angular/core';
import { applyTheme, currentTheme, restoreTheme, Theme } from 'demo-shared';

/** Light/dark switch. Follows the OS until clicked; the choice is shared with the other apps. */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="ghost"
      [attr.aria-label]="'Switch to ' + next() + ' theme'"
      (click)="toggle()"
    >
      {{ next() === 'dark' ? 'Dark' : 'Light' }}
    </button>
  `,
})
export class ThemeToggle {
  private readonly _theme = signal<Theme>(currentTheme());

  /** The theme a click switches to. */
  protected readonly next = () => (this._theme() === 'dark' ? 'light' : 'dark');

  constructor() {
    restoreTheme();
  }

  protected toggle(): void {
    const theme = this.next();
    applyTheme(theme);
    this._theme.set(theme);
  }
}
