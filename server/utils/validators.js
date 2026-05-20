/**
 * 验证正整数输入
 * @param {any} value
 * @param {string} fieldName
 * @returns {{valid: boolean, value?: number, message?: string}}
 */
function validatePositiveInteger(value, fieldName) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return { valid: false, message: `${fieldName} 必须是有效的正整数` };
  }
  // 防止超大值（SQL 注入或溢出攻击）
  if (num > Number.MAX_SAFE_INTEGER) {
    return { valid: false, message: `${fieldName} 超出允许范围` };
  }
  return { valid: true, value: num };
}

module.exports = { validatePositiveInteger };
