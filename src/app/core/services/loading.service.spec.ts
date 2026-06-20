import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    service = TestBed.inject(LoadingService);
  });

  it('tracks pending operations', () => {
    expect(service.isLoading()).toBeFalse();

    service.start();
    expect(service.isLoading()).toBeTrue();

    service.stop();
    expect(service.isLoading()).toBeFalse();
  });

  it('does not drop below zero', () => {
    service.stop();
    expect(service.isLoading()).toBeFalse();
  });
});
