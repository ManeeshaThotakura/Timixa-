import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  private http = inject(HttpClient);
  private swPush = inject(SwPush);
  private api = `${environment.apiUrl}/push`;

  private attempted = false;

  /** Subscribes this browser to web push and registers it with the backend. */
  enable(): void {
    if (this.attempted) return;
    this.attempted = true;
    if (!this.swPush.isEnabled) return; // dev mode / unsupported browser

    this.http.get<{ publicKey: string }>(`${this.api}/public-key`).subscribe({
      next: ({ publicKey }) => {
        this.swPush.requestSubscription({ serverPublicKey: publicKey })
          .then(sub => this.register(sub))
          .catch(() => { /* permission denied — user can retry after reload */ this.attempted = false; });
      },
      error: () => { this.attempted = false; },
    });
  }

  private register(sub: PushSubscription): void {
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.['p256dh'] || !json.keys?.['auth']) return;
    this.http.post(`${this.api}/subscriptions`, {
      endpoint: json.endpoint,
      p256dh: json.keys['p256dh'],
      auth: json.keys['auth'],
    }).subscribe();
  }
}
