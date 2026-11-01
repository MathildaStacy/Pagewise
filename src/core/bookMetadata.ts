/** Download-file metadata sometimes repeats the filename and archive suffix after `.pdf --`. */
export const cleanBookTitle = (title: string) =>
  title.replace(/[._](?:pdf|epub)\s+--\s+.+$/iu, '').trim();

export const cleanBookAuthor = (author: string | null) =>
  /^(?:unknown|未知)$/iu.test(author?.trim() ?? '') ? '' : author ?? '';
