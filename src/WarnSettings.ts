class WarnSettings {
  /**
   * Stores warned settings for each context.
   * It's a WeakMap where the keys are objects (contexts) and the values are Sets of strings (settings).
   */
  private warnedSettings: WeakMap<object, Set<string>>;

  constructor() {
    this.warnedSettings = new WeakMap();
  }

  /**
   * Warn only once for each context and setting
   * @param {object} context - The context object.
   * @param {string} setting - The setting to check.
   * @returns {boolean} - Returns true if the setting has been warned for this context.
   */
  hasBeenWarned(context: object, setting: string): boolean {
    return (
      (this.warnedSettings.has(context) &&
        this.warnedSettings.get(context)?.has(setting)) ??
      false
    );
  }

  /**
   * Mark a setting as warned for a specific context.
   * @param {object} context - The context object.
   * @param {string} setting - The setting to mark as warned.
   * @returns {void}
   */
  markSettingAsWarned(context: object, setting: string): void {
    if (!this.warnedSettings.has(context)) {
      this.warnedSettings.set(context, new Set<string>());
    }

    this.warnedSettings.get(context)?.add(setting);
  }
}

export default WarnSettings;
