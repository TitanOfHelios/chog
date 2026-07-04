import { t, onLangChange } from '../i18n';
import { LangMenu } from './LangMenu';

export class Hud {
  private coinFill = document.getElementById('coinBarFill')!;
  private coinLabel = document.getElementById('coinBarLabel')!;
  private scoreVal = document.getElementById('scoreVal')!;
  private scoreLabelEl = document.getElementById('scoreLabel')!;
  private toastEl = document.getElementById('toast')!;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private lbBtn = document.getElementById('leaderboardBtn')!;
  private lbPanel = document.getElementById('leaderboardPanel')!;
  private lbTitle = document.getElementById('lbTitle')!;
  private lbList = document.getElementById('lbList')!;
  private connBadge = document.getElementById('connBadge')!;
  private titleEl = document.getElementById('title')!;
  private sprintBtnEl = document.getElementById('sprintBtn')!;
  private jumpBtnEl = document.getElementById('jumpBtn')!;
  private hudRoot = document.getElementById('hud')!;
  private leaderboardOpen = false;
  private lastCoinRemainingMs = 7000;
  private connected = true;

  constructor() {
    const langMenu = new LangMenu();
    langMenu.root.classList.add('hudLangMenu');
    this.hudRoot.appendChild(langMenu.root);

    this.lbBtn.addEventListener('click', () => {
      this.leaderboardOpen = !this.leaderboardOpen;
      this.lbPanel.style.display = this.leaderboardOpen ? 'block' : 'none';
    });

    this.applyTexts();
    onLangChange(() => this.applyTexts());
  }

  private applyTexts(): void {
    this.titleEl.textContent = t('hudTitle');
    this.scoreLabelEl.textContent = t('scoreLabel');
    this.lbBtn.textContent = t('leaderboardBtn');
    this.lbTitle.textContent = t('leaderboardTitle');
    this.sprintBtnEl.textContent = t('sprintBtn');
    this.jumpBtnEl.textContent = t('jumpBtn');
    this.coinLabel.textContent = t('coinLabel', { s: (this.lastCoinRemainingMs / 1000).toFixed(1) });
    this.connBadge.title = this.connected ? t('latencyTitle') : t('disconnectedTitle');
  }

  get isLeaderboardOpen(): boolean {
    return this.leaderboardOpen;
  }

  updateCoinTimer(endsAt: number, cycleMs = 7000): void {
    const remaining = Math.max(0, endsAt - Date.now());
    this.lastCoinRemainingMs = remaining;
    const pct = Math.max(0, Math.min(100, (remaining / cycleMs) * 100));
    this.coinFill.style.width = pct + '%';
    this.coinLabel.textContent = t('coinLabel', { s: (remaining / 1000).toFixed(1) });
  }

  updateScore(score: number): void {
    this.scoreVal.textContent = String(score);
  }

  showToast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }

  renderLeaderboard(entries: { id: string; name: string; score: number }[], myId: string | null): void {
    const sorted = [...entries].sort((a, b) => b.score - a.score).slice(0, 20);
    this.lbList.innerHTML = '';
    for (const p of sorted) {
      const row = document.createElement('div');
      row.className = 'lbRow' + (p.id === myId ? ' me' : '');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = String(p.score);
      row.append(nameSpan, scoreSpan);
      this.lbList.appendChild(row);
    }
  }

  setLatency(ms: number): void {
    this.connected = true;
    this.connBadge.classList.remove('warn', 'bad');
    if (ms > 300) this.connBadge.classList.add('bad');
    else if (ms > 120) this.connBadge.classList.add('warn');
    this.connBadge.title = t('latencyTitleMs', { ms: Math.round(ms) });
  }

  setDisconnected(): void {
    this.connected = false;
    this.connBadge.classList.add('bad');
    this.connBadge.title = t('disconnectedTitle');
  }
}
