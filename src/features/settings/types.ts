import type { ServiceForm, TeachPrefs } from '@app/usecases/settings';
export type { TeachPrefs } from '@app/usecases/settings';
export interface SettingStatus {
  loading: boolean;
  saving: boolean;
  error?: string;
  notice?: string;
}
export interface MeState extends SettingStatus {
  groups: {
    key: string;
    title: string;
    subtitle: string;
    tone: 'neutral' | 'stuck' | 'bad';
  }[][];
}
export interface MeIntents {
  open(key: string): void;
  refresh(): void;
}
export interface MineruState extends SettingStatus {
  token: string;
  tokenLabel: string;
  expiresOn: string;
  expiresHint: string;
  expired: boolean;
  model: 'vlm' | 'pipeline';
  confirmUpload: boolean;
  quotaLabel: string;
  quotaRatio: number;
}
export interface MineruIntents {
  back(): void;
  setToken(value: string): void;
  setExpiresOn(value: string): void;
  setModel(value: string): void;
  setConfirmUpload(value: boolean): void;
  saveToken(): void;
  testConnection(): void;
  refresh(): void;
}
export interface AIState extends SettingStatus {
  demo?: boolean;
  providers: { id: string; name: string; meta: string }[];
  options: { key: string; label: string }[];
  teach: string;
  tidy: string;
  usage: { title: string; detail: string }[];
  month: string;
}
export interface AIIntents {
  back(): void;
  add(): void;
  edit(id: string): void;
  assign(purpose: 'teach' | 'tidy', key: string): void;
  refresh(): void;
}
export interface AIEditState extends SettingStatus {
  title: string;
  form: ServiceForm;
  keyLabel: string;
  errors: Partial<
    Record<'name' | 'baseUrl' | 'model' | 'key' | 'price', string>
  >;
  canDelete: boolean;
  confirmDelete: boolean;
  demo?: boolean;
  busy?: 'models' | 'test';
  models?: { id: string; label: string; selected: boolean }[];
}
export interface AIEditIntents {
  back(): void;
  field<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]): void;
  save(): void;
  remove(): void;
  confirmRemove(): void;
  closeOverlay(): void;
  testConnection(): void;
  readModels(): void;
  toggleModel(id: string): void;
}
export interface PrefsState extends SettingStatus {
  prefs: TeachPrefs;
}
export interface PrefsIntents {
  back(): void;
  set<K extends keyof TeachPrefs>(key: K, value: TeachPrefs[K]): void;
  refresh(): void;
}
export interface StorageState extends SettingStatus {
  books: { id: string; title: string; meta: string }[];
}
export interface StorageIntents {
  back(): void;
  clean(id: string): void;
  exportBackup(): void;
  restoreBackup(): void;
  refresh(): void;
}
export interface AboutState extends SettingStatus {
  demo: boolean;
  development: boolean;
  version: string;
}
export interface AboutIntents {
  back(): void;
  demo(): void;
  gallery(): void;
  exportLogs(): void;
}
