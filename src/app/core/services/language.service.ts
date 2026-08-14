import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'en' | 'fr';

const DEFAULT_LANGUAGE: AppLanguage = 'fr';
const STORAGE_KEY = 'food-tracker.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly translateService = inject(TranslateService);

  readonly supportedLanguages: AppLanguage[] = ['en', 'fr'];
  readonly currentLanguage = computed<AppLanguage>(
    () => (this.translateService.currentLang() ?? this.translateService.fallbackLang() ?? DEFAULT_LANGUAGE) as AppLanguage
  );

  constructor() {
    this.translateService.addLangs(this.supportedLanguages);
    void firstValueFrom(this.translateService.use(this.resolveInitialLanguage()));

    effect(() => {
      const language = this.currentLanguage();
      this.document.documentElement.lang = language;
      this.storeLanguage(language);
    });
  }

  setLanguage(language: AppLanguage): void {
    if (language === this.currentLanguage()) {
      return;
    }

    void firstValueFrom(this.translateService.use(language));
  }

  private resolveInitialLanguage(): AppLanguage {
    const storedLanguage = this.readStoredLanguage();

    if (storedLanguage) {
      return storedLanguage;
    }

    const browserLanguage = globalThis.navigator?.language?.slice(0, 2).toLowerCase();
    return this.isSupportedLanguage(browserLanguage) ? browserLanguage : DEFAULT_LANGUAGE;
  }

  private readStoredLanguage(): AppLanguage | null {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY)?.toLowerCase();
      return this.isSupportedLanguage(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  private storeLanguage(language: AppLanguage): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage failures and keep language in memory.
    }
  }

  private isSupportedLanguage(language: string | null | undefined): language is AppLanguage {
    return language === 'en' || language === 'fr';
  }
}
