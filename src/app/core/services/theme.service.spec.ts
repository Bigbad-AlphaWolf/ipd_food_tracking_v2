import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    service = TestBed.inject(ThemeService);
  });

  it('enables dark mode', () => {
    service.setDarkMode(true);

    expect(service.isDarkMode()).toBeTrue();
    expect(document.body.classList.contains('app-dark')).toBeTrue();
    expect(localStorage.getItem('food-tracker-theme')).toBe('dark');
  });

  it('toggles back to light mode', () => {
    service.setDarkMode(true);
    service.toggle();

    expect(service.isDarkMode()).toBeFalse();
    expect(document.body.classList.contains('app-dark')).toBeFalse();
    expect(localStorage.getItem('food-tracker-theme')).toBe('light');
  });
});
