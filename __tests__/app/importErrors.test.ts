import { importError, ImportInputError } from '@app/usecases/importErrors';

it.each([
  ['ENAMETOOLONG (File name too long)', '文件名过长'],
  ['ENOENT (No such file or directory)', '找不到这个文件'],
  ['EACCES (Permission denied)', '允许访问'],
  ['ENOSPC (No space left on device)', '存储空间不足'],
  ['Password required or incorrect password', '密码保护'],
  ['Unexpected native failure', '无法读取这份文件'],
])(
  'turns %s into an actionable message without the native path',
  (native, expected) => {
    const result = importError(
      Object.assign(
        new Error(
          `/data/user/0/com.pagewise/cache/${'%E4%B9%A6'.repeat(
            100,
          )}.pdf: ${native}`,
        ),
        { code: 'file' },
      ),
    );
    expect(result.message).toContain(expected);
    expect(result.message).not.toMatch(/\/data|%E4|com\.pagewise|sk-/u);
    expect(result.message.length).toBeLessThan(80);
  },
);
it('accepts native code-only errors and retains app-owned input guidance', () => {
  expect(importError({ code: 'ENOENT' }).code).toBe('not_found');
  const error = new ImportInputError('文件是空的，请重新选择');
  expect(importError(error)).toBe(error);
  expect(importError(null).code).toBe('unreadable');
});
