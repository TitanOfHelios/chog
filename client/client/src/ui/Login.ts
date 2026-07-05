import { CONFIG } from '../config';
import { t, onLangChange } from '../i18n';
import { LangMenu } from './LangMenu';
import { loadPlateManifest, type PlateOption } from '../character/plateManifest';
import { renderPlateThumbnails } from '../character/PlateThumbnails';

export class Login {
  private screen = document.getElementById('loginScreen')!;
  private card = document.querySelector('.loginCard') as HTMLElement;
  private msg = document.getElementById('loginMsg')!;
  private joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
  private nameInput = document.getElementById('nameInput') as HTMLInputElement;
  private titleEl = document.getElementById('loginTitle')!;
  private descEl = document.getElementById('loginDesc')!;
  private nameLabelEl = document.getElementById('nameLabel')!;
  private plateSection = document.getElementById('plateSection')!;
  private plateLabelEl = document.getElementById('plateLabel')!;
  private plateGrid = document.getElementById('plateGrid')!;
  private creditsEl = document.getElementById('credits')!;

  private plates: PlateOption[] = [];
  private selectedPlateId: string | undefined = undefined;
  private plateCards = new Map<string | 'none', HTMLElement>();

  onJoin: ((name: string, url: string, plateId?: string) => void) | null = null;

  constructor() {
    const langMenu = new LangMenu();
    this.card.appendChild(langMenu.root);

    this.applyTexts();
    onLangChange(() => this.applyTexts());

    this.joinBtn.addEventListener('click', () => {
      const name = this.nameInput.value.trim();
      if (!name) {
        this.setMsg(t('nameRequired'), 'error');
        return;
      }
      // Sunucu adresi artık kullanıcıya gösterilmiyor; kökteki .env
      // içindeki VITE_WS_URL değeri build zamanında otomatik kullanılır.
      const url = CONFIG.DEFAULT_WS_URL;
      this.joinBtn.disabled = true;
      this.setMsg(t('connecting'), 'info');
      this.onJoin?.(name, url, this.selectedPlateId);
    });

    void this.initPlatePicker();
    this.initCredits();
  }

  /** .env'deki VITE_CREDITS_TEXT/VITE_CREDITS_URL varsa giriş ekranının
   * altında küçük, sade bir satır olarak gösterir. Boşsa hiç görünmez. */
  private initCredits(): void {
    const text = CONFIG.CREDITS_TEXT;
    if (!text) return;
    this.creditsEl.style.display = 'block';
    if (CONFIG.CREDITS_URL) {
      const link = document.createElement('a');
      link.href = CONFIG.CREDITS_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = text;
      this.creditsEl.appendChild(link);
    } else {
      this.creditsEl.textContent = text;
    }
  }

  /** client/public/assets/plate/manifest.json'daki plakaları yükler ve
   * seçim ızgarasını doldurur. Hiç plaka yoksa alan tamamen gizli kalır. */
  private async initPlatePicker(): Promise<void> {
    this.plates = await loadPlateManifest();
    if (this.plates.length === 0) return;

    this.plateSection.style.display = 'block';
    this.plateGrid.innerHTML = '';
    this.plateCards.clear();

    // "Plakasız" seçeneği her zaman ilk sırada durur.
    const noneCard = this.buildCard('none', t('plateNone'), true);
    this.plateGrid.appendChild(noneCard);
    this.plateCards.set('none', noneCard);
    this.selectCard('none');

    for (const option of this.plates) {
      const card = this.buildCard(option.id, option.label, false);
      this.plateGrid.appendChild(card);
      this.plateCards.set(option.id, card);
    }

    // İlk plaka varsayılan olarak seçili gelsin (görsel tercihi belli olsun diye).
    if (this.plates[0]) this.selectCard(this.plates[0].id);

    // Önizleme görüntüleri hazır oldukça kartlara tek tek işlenir
    // (hepsini beklemeye gerek yok, kullanıcı bu sırada isim de yazabilir).
    renderPlateThumbnails(this.plates, (id, dataUrl) => {
      const card = this.plateCards.get(id);
      if (!card) return;
      const slot = card.querySelector('.plateCardMedia');
      if (!slot) return;
      if (dataUrl) {
        slot.innerHTML = '';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = card.dataset.label || id;
        slot.appendChild(img);
      } else {
        slot.textContent = '⚠';
      }
    });
  }

  private buildCard(id: string, label: string, isNone: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = 'plateCard' + (isNone ? ' plateCardNone' : '');
    card.dataset.label = label;

    const media = document.createElement('div');
    media.className = 'plateCardMedia';
    media.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    if (isNone) {
      media.textContent = '—';
    } else {
      const spinner = document.createElement('div');
      spinner.className = 'plateSpinner';
      media.appendChild(spinner);
    }
    card.appendChild(media);

    const labelEl = document.createElement('div');
    labelEl.className = 'plateCardLabel';
    labelEl.textContent = label;
    card.appendChild(labelEl);

    card.addEventListener('click', () => this.selectCard(id));
    return card;
  }

  private selectCard(id: string): void {
    this.selectedPlateId = id === 'none' ? undefined : id;
    for (const [cardId, el] of this.plateCards) {
      el.classList.toggle('selected', cardId === id);
    }
  }

  private applyTexts(): void {
    this.titleEl.textContent = t('loginTitle');
    this.descEl.textContent = t('loginDesc');
    this.nameLabelEl.textContent = t('nameLabel');
    this.nameInput.placeholder = t('namePlaceholder');
    this.joinBtn.textContent = t('joinBtn');
    this.plateLabelEl.textContent = t('plateLabel');
    const noneCard = this.plateCards.get('none');
    if (noneCard) {
      noneCard.dataset.label = t('plateNone');
      const labelEl = noneCard.querySelector('.plateCardLabel');
      if (labelEl) labelEl.textContent = t('plateNone');
    }
  }

  setMsg(text: string, kind: 'info' | 'error' = 'error'): void {
    this.msg.style.color = kind === 'info' ? '#e9d8ff' : '#ffb0a0';
    this.msg.textContent = text;
  }

  allowRetry(): void {
    this.joinBtn.disabled = false;
  }

  hide(): void {
    this.screen.style.display = 'none';
    document.getElementById('hud')!.style.display = 'block';
  }
}
