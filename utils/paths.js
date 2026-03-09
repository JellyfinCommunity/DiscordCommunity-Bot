import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const DATA_FILE = path.join(DATA_DIR, 'data.json');
export const POSTED_ITEMS_FILE = path.join(DATA_DIR, 'postedItems.json');
export const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
