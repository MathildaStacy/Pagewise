/** Only these app-owned messages may be shown by file intake screens. */
export class ImportInputError extends Error {
  constructor(message: string, readonly code = 'invalid_input') {
    super(message);
    this.name = 'ImportInputError';
  }
}

export function importError(error: unknown): ImportInputError {
  if (error instanceof ImportInputError) return error;
  const native = error && typeof error === 'object' ? error : {};
  const detail = [
    'code' in native ? String(native.code) : '',
    'message' in native ? String(native.message) : '',
  ].join(' ');
  if (/ENAMETOOLONG|file name too long/iu.test(detail))
    return new ImportInputError(
      '文件名过长，请缩短文件名后重新选择。',
      'name_too_long',
    );
  if (/ENOENT|no such file|not found|does not exist/iu.test(detail))
    return new ImportInputError(
      '找不到这个文件，请确认文件已下载到本机，再重新选择。',
      'not_found',
    );
  if (/EACCES|EPERM|permission|SecurityException/iu.test(detail))
    return new ImportInputError(
      '无法读取这个文件，请重新选择并允许访问，或先保存到“下载”文件夹。',
      'permission',
    );
  if (/ENOSPC|no space left|disk.*full/iu.test(detail))
    return new ImportInputError(
      '本机存储空间不足，请释放一些空间后重新导入。',
      'no_space',
    );
  if (/password|encrypted|加密|密码/iu.test(detail))
    return new ImportInputError(
      '这份文件需要密码，请先解除密码保护，再重新导入。',
      'encrypted',
    );
  return new ImportInputError(
    '无法读取这份文件，请确认它能正常打开，并已完整下载，再重新选择 PDF 或 EPUB。',
    'unreadable',
  );
}
