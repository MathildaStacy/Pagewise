/** Finite numeric checks for teaching examples; no JavaScript evaluation or symbolic claims. */
export function evaluateArithmetic(expression: string): number {
  if (!expression.trim() || expression.length > 200)
    throw new Error('表达式需要 1–200 个字符');
  const tokens = expression.match(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/^]/gi,
  );
  if (!tokens || tokens.join('') !== expression.replace(/\s/g, ''))
    throw new Error('只支持数字、括号、+ - * / ^');
  let index = 0;
  function primary(): number {
    const token = tokens![index++];
    if (token === '(') {
      const value = sum();
      if (tokens![index++] !== ')') throw new Error('括号没有配对');
      return value;
    }
    if (!token || !/^(?:\d|\.)/.test(token)) throw new Error('缺少数字');
    return Number(token);
  }
  // ^ binds tighter than a leading sign and associates to the right: -2^2 = -4, 2^3^2 = 512.
  function power(): number {
    const value = primary();
    if (tokens![index] !== '^') return value;
    index++;
    return value ** unary();
  }
  function unary(): number {
    const sign = tokens![index];
    if (sign !== '+' && sign !== '-') return power();
    index++;
    const value = unary();
    return sign === '-' ? -value : value;
  }
  function product(): number {
    let value = unary();
    while (tokens![index] === '*' || tokens![index] === '/') {
      const operator = tokens![index++];
      const right = unary();
      if (operator === '/' && right === 0) throw new Error('不能除以零');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens![index] === '+' || tokens![index] === '-') {
      const operator = tokens![index++];
      const right = product();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }
  const value = sum();
  if (index !== tokens.length) throw new Error('表达式不完整');
  if (!Number.isFinite(value)) throw new Error('结果不是有限实数');
  return value;
}
