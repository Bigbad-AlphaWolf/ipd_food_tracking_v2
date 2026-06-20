import { DOCUMENT } from '@angular/common';
import { Injectable, RendererFactory2, computed, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);
  private readonly darkMode = signal(false);

  readonly isDarkMode = computed(() => this.darkMode());

  constructor() {
    const stored = this.document.defaultView?.localStorage.getItem('food-tracker-theme');
    this.setDarkMode(stored === 'dark');
  }

  toggle(): void {
    this.setDarkMode(!this.darkMode());
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);

    if (enabled) {
      this.renderer.addClass(this.document.body, 'app-dark');
      this.document.defaultView?.localStorage.setItem('food-tracker-theme', 'dark');
      return;
    }

    this.renderer.removeClass(this.document.body, 'app-dark');
    this.document.defaultView?.localStorage.setItem('food-tracker-theme', 'light');
  }
}
