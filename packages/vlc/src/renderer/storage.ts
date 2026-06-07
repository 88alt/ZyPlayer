import JSON5 from 'json5';

export default class Storage {
  private name: string;
  private settings: Record<string, any>;

  constructor() {
    this.name = 'vlc_settings';
    this.settings = {};
  }

  get(): Record<string, any>;
  get(key: string): any;
  get(key?: string): any {
    try {
      const storage: Record<string, any> = JSON5.parse(window.localStorage.getItem(this.name)!) || {};
      return key ? storage[key] : storage;
    } catch {
      return key ? this.settings[key] : this.settings;
    }
  }

  set(key: string, value: any): void {
    try {
      const storage = Object.assign({}, this.get(), {
        [key]: value,
      });
      window.localStorage.setItem(this.name, JSON.stringify(storage));
    } catch {
      this.settings[key] = value;
    }
  }

  del(key: string): void {
    try {
      const storage = this.get();
      delete storage[key];
      window.localStorage.setItem(this.name, JSON.stringify(storage));
    } catch {
      delete this.settings[key];
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(this.name);
    } catch {
      this.settings = {};
    }
  }
}
