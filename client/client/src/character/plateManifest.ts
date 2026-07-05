import { CONFIG } from '../config';

export interface PlateOption {
  id: string;
  file: string;
  label: string;
}

/**
 * client/public/assets/plate/manifest.json dosyasını okur.
 * Dosya yoksa, boşsa veya bozuksa sessizce boş dizi döner — bu durumda
 * hem login ekranındaki plaka seçimi hem de oyun içi 3D plaka
 * kullanılmaz, isimler sade yazı etiketiyle gösterilir. Yani plaka
 * eklemek/eklememek hiçbir şeyi bozmaz.
 */
export async function loadPlateManifest(): Promise<PlateOption[]> {
  try {
    const res = await fetch(plateManifestUrl());
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const options: PlateOption[] = [];
    for (const entry of data) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        entry.id.trim() &&
        typeof entry.file === 'string' &&
        entry.file.trim()
      ) {
        options.push({
          id: entry.id.trim(),
          file: entry.file.trim(),
          label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : entry.id.trim(),
        });
      }
    }
    return options;
  } catch {
    return [];
  }
}

export function plateFileUrl(option: PlateOption): string {
  return CONFIG.PLATE_FOLDER.replace(/\/$/, '') + '/' + option.file.replace(/^\//, '');
}

function plateManifestUrl(): string {
  return CONFIG.PLATE_FOLDER.replace(/\/$/, '') + '/manifest.json';
}
