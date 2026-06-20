import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messageService = inject(MessageService);

  success(summary: string, detail: string): void {
    this.messageService.add({ severity: 'success', summary, detail });
  }

  error(summary: string, detail: string): void {
    this.messageService.add({ severity: 'error', summary, detail, life: 5000 });
  }

  info(summary: string, detail: string): void {
    this.messageService.add({ severity: 'info', summary, detail });
  }
}
