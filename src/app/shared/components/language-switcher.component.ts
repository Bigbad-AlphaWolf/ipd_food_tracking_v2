import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { AppLanguage, LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.css'
})
export class LanguageSwitcherComponent {
  readonly languageService = inject(LanguageService);
  readonly languages = this.languageService.supportedLanguages;
  readonly currentLanguage = this.languageService.currentLanguage;

  setLanguage(language: AppLanguage): void {
    this.languageService.setLanguage(language);
    console.log(language);

  }
}
