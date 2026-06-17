/**
 * Safe Formula Parser — Attendify Payroll Engine
 *
 * Evaluates arithmetic expressions with named variables.
 * Supports: +, -, *, /, (, ), numbers, variable names.
 *
 * NEVER uses eval(). Pure recursive-descent AST parser.
 *
 * Usage:
 *   import { parseFormula } from './formulaParser.js';
 *   parseFormula('basic * 0.4 + hra', { basic: 50000, hra: 20000 })
 *   // → 40000
 */

/**
 * Tokenise the expression string into token objects.
 * @param {string} expr
 * @returns {{ type: string, value: string|number }[]}
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number (integer or decimal)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    // Identifier (variable name like "basic", "hra", "ctc")
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i++];
      }
      tokens.push({ type: 'IDENT', value: name });
      continue;
    }

    // Operators and parentheses
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    throw new Error(`Invalid character in formula: '${ch}'`);
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

/**
 * Recursive descent parser + evaluator.
 * Grammar:
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → NUMBER | IDENT | '(' expr ')' | '-' factor
 */
class Parser {
  constructor(tokens, variables) {
    this.tokens = tokens;
    this.pos = 0;
    this.variables = variables;
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }

  expect(type, value) {
    const tok = this.consume();
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(`Formula parse error: expected ${value ?? type}, got '${tok.value}'`);
    }
    return tok;
  }

  parseExpr() {
    let left = this.parseTerm();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.consume().value;
      const right = this.parseFactor();
      if (op === '/' && right === 0) throw new Error('Division by zero in formula');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  parseFactor() {
    const tok = this.peek();

    // Unary minus
    if (tok.type === 'OP' && tok.value === '-') {
      this.consume();
      return -this.parseFactor();
    }

    // Parenthesised expression
    if (tok.type === 'OP' && tok.value === '(') {
      this.consume();
      const val = this.parseExpr();
      this.expect('OP', ')');
      return val;
    }

    // Number literal
    if (tok.type === 'NUMBER') {
      this.consume();
      return tok.value;
    }

    // Variable reference
    if (tok.type === 'IDENT') {
      this.consume();
      const varName = tok.value.toLowerCase();
      if (!(varName in this.variables)) {
        // Unknown variable = 0 (component not yet computed)
        return 0;
      }
      return Number(this.variables[varName]) || 0;
    }

    throw new Error(`Unexpected token in formula: '${tok.value}'`);
  }
}

/**
 * Parse and evaluate a formula expression safely.
 *
 * @param {string} expression  - Formula string e.g. "basic * 0.4"
 * @param {Object} variables   - Map of variable names (lowercase) to numeric values
 * @returns {number}           - Computed result (never NaN — falls back to 0)
 */
export function parseFormula(expression, variables = {}) {
  if (!expression || typeof expression !== 'string') return 0;

  // Normalise variable keys to lowercase
  const vars = {};
  for (const [k, v] of Object.entries(variables)) {
    vars[k.toLowerCase()] = Number(v) || 0;
  }

  try {
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, vars);
    const result = parser.parseExpr();

    if (!isFinite(result)) return 0;
    return Math.round(result * 100) / 100; // Round to 2dp
  } catch (err) {
    console.error(`[formulaParser] Error evaluating "${expression}":`, err.message);
    return 0;
  }
}

/**
 * Validate a formula expression without evaluating it.
 * Returns { valid: boolean, error?: string }
 */
export function validateFormula(expression) {
  try {
    // Use dummy variables to validate syntax
    parseFormula(expression, { basic: 1, hra: 1, ctc: 1, gross: 1 });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
