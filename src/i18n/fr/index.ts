// French dictionaries, one file per area of the application (English source string → French). One French translation per
// key across the files (src/i18n/completeness.test.ts checks it).
import auth from './auth.json';
import shell from './shell.json';
import shipping from './shipping.json';

const FILES: Record<string, Record<string, string>> = { auth, shell, shipping };

export const FR_FILES = FILES;
export const FR_DICT: Record<string, string> = Object.assign({}, ...Object.values(FILES));
