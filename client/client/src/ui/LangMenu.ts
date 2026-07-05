import { getLang, setLang, onLangChange, type Lang } from '../i18n';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

/**
 * Açılır dil seçim menüsü: bir buton (mevcut dili gösterir) + tıklanınca
 * açılan bir liste (Türkçe / English). Hem giriş ekranına hem HUD'a
 * eklenebilir; `root` elemanını istediğiniz konteynere append edin.
 */
export class LangMenu {
  readonly root = document.createElement('div');
  private btn = document.createElement('button');
  private panel = document.createElement('div');
  private isOpen = false;

  constructor() {
    this.root.className = 'langMenu';
    this.btn.className = 'langMenuBtn';
    this.btn.type = 'button';
    this.panel.className = 'langMenuPanel';

    for (const l of LANGS) {
      const item = document.createElement('div');
      item.className = 'langMenuItem';
      item.dataset.lang = l.code;
      const flag = document.createElement('span');
      flag.className = 'langFlag';
      flag.textContent = l.flag;
      const label = document.createElement('span');
      label.textContent = l.label;
      item.append(flag, label);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setLang(l.code);
        this.close();
      });
      this.panel.appendChild(item);
    }

    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isOpen) this.close();
      else this.openMenu();
    });
    document.addEventListener('click', () => this.close());
    this.panel.addEventListener('click', (e) => e.stopPropagation());

    this.root.append(this.btn, this.panel);
    this.refresh();
    onLangChange(() => this.refresh());
  }

  private openMenu(): void {
    this.isOpen = true;
    this.panel.classList.add('show');
  }

  private close(): void {
    this.isOpen = false;
    this.panel.classList.remove('show');
  }

  private refresh(): void {
    const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[0];
    this.btn.textContent = '';
    const flag = document.createElement('span');
    flag.className = 'langFlag';
    flag.textContent = current.flag;
    const code = document.createElement('span');
    code.className = 'langCode';
    code.textContent = current.code.toUpperCase();
    this.btn.append(flag, code);

    for (const child of Array.from(this.panel.children)) {
      (child as HTMLElement).classList.toggle('active', (child as HTMLElement).dataset.lang === getLang());
    }
  }
}
