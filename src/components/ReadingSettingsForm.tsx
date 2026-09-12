"use client";

import {
  ALIGN_LABELS,
  FONT_LABELS,
  PROFILE_LABELS,
} from "@/lib/profiles";
import type {
  AppSettings,
  ReadingFont,
  ReadingProfile,
  RefreshProfile,
  TextAlign,
} from "@/lib/types";

export function ReadingSettingsForm({
  settings,
  onChange,
  compact = false,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "settings-form compact" : "settings-form"}>
      <label className="field">
        <span>Theme</span>
        <select
          value={settings.profile}
          onChange={(e) =>
            onChange({ profile: e.target.value as ReadingProfile })
          }
        >
          {(Object.keys(PROFILE_LABELS) as ReadingProfile[]).map((key) => (
            <option key={key} value={key}>
              {PROFILE_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Font</span>
        <select
          value={settings.font}
          onChange={(e) => onChange({ font: e.target.value as ReadingFont })}
        >
          {(Object.keys(FONT_LABELS) as ReadingFont[]).map((key) => (
            <option key={key} value={key}>
              {FONT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Alignment</span>
        <select
          value={settings.align}
          onChange={(e) => onChange({ align: e.target.value as TextAlign })}
        >
          {(Object.keys(ALIGN_LABELS) as TextAlign[]).map((key) => (
            <option key={key} value={key}>
              {ALIGN_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Size {settings.fontSize}%</span>
        <input
          type="range"
          min={80}
          max={200}
          step={4}
          value={settings.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>Line height {settings.lineHeight.toFixed(2)}</span>
        <input
          type="range"
          min={1.2}
          max={2.2}
          step={0.05}
          value={settings.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>Margins</span>
        <input
          type="range"
          min={0}
          max={18}
          value={settings.margin}
          onChange={(e) => onChange({ margin: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>Spacing {settings.letterSpacing.toFixed(2)}em</span>
        <input
          type="range"
          min={-0.02}
          max={0.12}
          step={0.01}
          value={settings.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>Page refresh</span>
        <select
          value={settings.refresh}
          onChange={(e) =>
            onChange({ refresh: e.target.value as RefreshProfile })
          }
        >
          <option value="paper">Instant</option>
          <option value="kindle">Kindle</option>
          <option value="eink">E-Ink flash</option>
          <option value="ghosting">Ghosting</option>
        </select>
      </label>

      <label className="field check">
        <input
          type="checkbox"
          checked={settings.hyphenate}
          onChange={(e) => onChange({ hyphenate: e.target.checked })}
        />
        <span>Hyphenate justified text</span>
      </label>

      <label className="field check">
        <input
          type="checkbox"
          checked={settings.wakeLock}
          onChange={(e) => onChange({ wakeLock: e.target.checked })}
        />
        <span>Keep screen awake while reading</span>
      </label>

      <label className="field check">
        <input
          type="checkbox"
          checked={settings.volumeKeys}
          onChange={(e) => onChange({ volumeKeys: e.target.checked })}
        />
        <span>Volume keys turn pages (Android)</span>
      </label>
    </div>
  );
}
