/** Database block sequences are non-negative safe integers; serialized refs are canonical. */
export type BlockRef = `b${number}`;
export function blockRef(seq: number): BlockRef {
  if (!Number.isSafeInteger(seq) || seq < 0)
    throw new Error('内容块序号必须是非负安全整数');
  return `b${seq}`;
}
export function parseBlockRef(value: string): number | null {
  if (!/^b\d+$/.test(value)) return null;
  const seq = Number(value.slice(1));
  return Number.isSafeInteger(seq) ? seq : null;
}
export function isBlockRef(value: string): value is BlockRef {
  return parseBlockRef(value) !== null;
}
