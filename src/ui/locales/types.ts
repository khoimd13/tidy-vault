import type { strings } from './en';

export type Key = keyof typeof strings;

/**
 * One interface language. `{name}` placeholders in strings and templates must be kept as they
 * are (tests check this).
 */
export interface Locale {
  /** Short code, stored as the person's choice. */
  code: string;
  /** The language's name in that language, shown in the picker. */
  name: string;
  /** For Intl number and date formatting. */
  locale: string;
  /**
   * Category names are lowercased inside a sentence ("18 screenshots"); true keeps them as
   * written (German capitalises nouns).
   */
  keepCase?: boolean;
  strings: Record<Key, string>;
  /** Category names by id (see shared/categories.ts); missing ones show in English. */
  categories: Record<string, string>;
  /** The AI's English descriptions (see shared/categories.ts), in this language. */
  prompts: Record<string, string>;
  /** The classifier's fixed English reasons, in this language. */
  reasons: Record<string, string>;
  /** The classifier's reasons that carry a value. */
  templates: {
    /** {what}: one of `prompts`. */
    looksLike: string;
    onlySeconds: string;
    longVideo: string;
    fromYear: string;
    similarMinutes: string;
    similarSameDay: string;
    /** {when}: an English phrase the classifier made (rare). */
    similarOther: string;
  };
}
