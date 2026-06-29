import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, from, timer, throwError } from 'rxjs';
import { filter, retryWhen, tap, takeUntil, switchMap, catchError } from 'rxjs/operators';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error',
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private wsUrl = '';

  private messageSubject = new Subject<WebSocketMessage>();
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED,
  );
  private destroy$ = new Subject<void>();

  // Config
  private readonly INITIAL_RECONNECT_DELAY_MS = 1000;
  private readonly MAX_RECONNECT_DELAY_MS = 30000;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private readonly MESSAGE_TIMEOUT_MS = 5000;

  private reconnectAttempts = 0;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

  public messages$: Observable<WebSocketMessage> = this.messageSubject.asObservable();
  public connectionStatus$: Observable<ConnectionStatus> =
    this.connectionStatusSubject.asObservable();

  constructor() {}

  /**
   * Start connection to given WebSocket URL and keep it alive with retries
   */
  public connect(url: string): Observable<void> {
    this.wsUrl = url;

    return from(this.attemptConnection()).pipe(
      retryWhen((errors) =>
        errors.pipe(
          tap((err) => {
            this.connectionStatusSubject.next(ConnectionStatus.ERROR);
          }),
          switchMap(() => {
            const delay = this.calculateBackoffDelay();
            return timer(delay).pipe(
              tap(() => this.connectionStatusSubject.next(ConnectionStatus.CONNECTING)),
            );
          }),
        ),
      ),
      catchError((error) => {
        console.error('WebSocket connection error:', error);
        this.connectionStatusSubject.next(ConnectionStatus.ERROR);
        return throwError(() => error);
      }),
      takeUntil(this.destroy$),
    );
  }

  private async attemptConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.connectionStatusSubject.next(ConnectionStatus.CONNECTING);
        this.ws = new WebSocket(this.wsUrl);
        const ws = this.ws as WebSocket;

        ws.onopen = () => {
          this.connectionStatusSubject.next(ConnectionStatus.CONNECTED);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        ws.onclose = () => {
          this.connectionStatusSubject.next(ConnectionStatus.DISCONNECTED);
          this.stopHeartbeat();
          reject(new Error('WebSocket closed'));
        };

        ws.onerror = (error: Event) => {
          console.error('WebSocket error:', error);
          this.connectionStatusSubject.next(ConnectionStatus.ERROR);
          this.stopHeartbeat();
          reject(error);
        };

        // If connection doesn't open within timeout, close and reject
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.MESSAGE_TIMEOUT_MS);
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      if (message.type === 'pong') {
        // heartbeat response
        return;
      }

      this.messageSubject.next(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error, data);
    }
  }

  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private calculateBackoffDelay(): number {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      this.MAX_RECONNECT_DELAY_MS,
    );

    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatusSubject.next(ConnectionStatus.DISCONNECTED);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  public getMessagesByType(type: string): Observable<WebSocketMessage> {
    return this.messages$.pipe(filter((m) => m.type === type));
  }
}
