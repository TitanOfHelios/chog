import type { ClientMessage, ServerMessage } from '../types';

type Listener<T> = (payload: T) => void;

interface GameClientEvents {
  welcome: { id: string; arenaRadius: number; tickMs: number };
  players: { players: import('../types').PlayerState[] };
  state: { players: import('../types').PlayerMove[]; serverTime: number };
  coin: { coin: import('../types').CoinState };
  caught: { id: string; name: string; score: number };
  joined: { id: string; name: string };
  left: { id: string; name: string };
  open: void;
  close: void;
  error: void;
  latency: { ms: number };
}

/**
 * "Daha iyi multiplayer" için: otomatik yeniden bağlanma (üstel geri
 * çekilme), round-trip gecikme ölçümü ve tipli olay aboneliği sağlayan
 * ince bir WebSocket sarmalayıcısı.
 */
export class GameClient {
  private ws: WebSocket | null = null;
  private url = '';
  private name = '';
  private plateId: string | undefined = undefined;
  private listeners: { [K in keyof GameClientEvents]?: Listener<GameClientEvents[K]>[] } = {};
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingSentAt = 0;

  on<K extends keyof GameClientEvents>(event: K, cb: Listener<GameClientEvents[K]>): void {
    const map = this.listeners as Record<string, Listener<unknown>[]>;
    (map[event] ??= []).push(cb as Listener<unknown>);
  }

  private emit<K extends keyof GameClientEvents>(event: K, payload: GameClientEvents[K]): void {
    const map = this.listeners as Record<string, Listener<unknown>[]>;
    map[event]?.forEach((cb) => cb(payload));
  }

  connect(url: string, name: string, plateId?: string): void {
    this.url = url;
    this.name = name;
    this.plateId = plateId;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }

  private openSocket(): void {
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.emit('error', undefined);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.send({ type: 'join', name: this.name, plateId: this.plateId });
      this.emit('open', undefined);
      this.startPing();
    };

    socket.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      this.handleMessage(msg);
    };

    socket.onerror = () => this.emit('error', undefined);

    socket.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.emit('close', undefined);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempt - 1), 8000);
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.lastPingSentAt = performance.now();
      this.send({ type: 'ping', t: this.lastPingSentAt });
    }, 4000);
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.emit('welcome', msg);
        break;
      case 'players':
        this.emit('players', msg);
        break;
      case 'state':
        this.emit('state', msg);
        break;
      case 'coin':
        this.emit('coin', msg);
        break;
      case 'caught':
        this.emit('caught', msg);
        break;
      case 'joined':
        this.emit('joined', msg);
        break;
      case 'left':
        this.emit('left', msg);
        break;
      case 'pong': {
        const rtt = performance.now() - msg.t;
        this.emit('latency', { ms: rtt });
        break;
      }
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  get isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
