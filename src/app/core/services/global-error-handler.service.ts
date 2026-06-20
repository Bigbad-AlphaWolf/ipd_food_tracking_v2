import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable()
export class GlobalErrorHandlerService implements ErrorHandler {
  private readonly toastService = inject(ToastService);

  handleError(error: unknown): void {
    console.error(error);
    this.toastService.error('Unexpected error', 'Something went wrong. Please try again.');
  }
}
