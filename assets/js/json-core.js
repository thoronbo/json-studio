/*!
 * JSON 工坊 JSON Studio — 核心处理
 * Copyright (c) 2026 深维工坊工作室 Deep Dimension Workshop
 * Released under the MIT License.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JsonCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 解析与报错定位
   * ------------------------------------------------------------------ */

  function describeError(message) {
    var text = String(message || '');
    if (/Unexpected end of (JSON )?input/i.test(text)) {
      return '内容在结尾处中断了，可能少了右括号、右方括号或引号。';
    }
    if (/Expected ',' or \}/i.test(text)) {
      return '对象的两个属性之间少了逗号，或者缺少右花括号。';
    }
    if (/Expected ',' or \]/i.test(text)) {
      return '数组的两个元素之间少了逗号，或者缺少右方括号。';
    }
    if (/Expected ':'/i.test(text)) {
      return '属性名后面少了冒号。';
    }
    if (/property name/i.test(text)) {
      return '这里需要一个用双引号包起来的属性名。';
    }
    if (/Unterminated string/i.test(text)) {
      return '字符串缺少结束的双引号。';
    }
    if (/Bad control character/i.test(text)) {
      return '字符串里出现了未转义的控制字符。';
    }
    if (/Unexpected token/i.test(text)) {
      return '这里出现了一个多余的字符。';
    }
    if (/Unexpected non-whitespace character/i.test(text)) {
      return '有效内容已经结束，后面还有多余的字符。';
    }
    return text || '内容不是有效的 JSON。';
  }

  function locate(text, position) {
    var line = 1;
    var column = 1;
    var limit = Math.min(position, text.length);
    for (var i = 0; i < limit; i++) {
      if (text.charAt(i) === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return { line: line, column: column };
  }

  function snippet(text, line, column) {
    var lines = text.split('\n');
    var index = Math.max(0, line - 1);
    var from = Math.max(0, index - 1);
    var to = Math.min(lines.length - 1, index + 1);
    var width = String(to + 1).length;
    var out = [];

    for (var i = from; i <= to; i++) {
      var prefix = String(i + 1);
      while (prefix.length < width) prefix = ' ' + prefix;
      out.push(prefix + ' | ' + lines[i].replace(/\t/g, '  '));
      if (i === index) {
        var caret = new Array(Math.max(0, column)).join(' ');
        out.push(new Array(width + 1).join(' ') + ' | ' + caret + '^');
      }
    }
    return out.join('\n');
  }

  /* ------------------------------------------------------------------ *
   * 语法扫描：在解析失败后给出准确位置
   * ------------------------------------------------------------------ */

  function scan(text) {
    var n = text.length;
    var i = 0;

    function fail(message) {
      throw { position: i, message: message };
    }

    function skip() {
      while (i < n) {
        var c = text.charAt(i);
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
        else break;
      }
    }

    function literal(word) {
      if (text.substr(i, word.length) !== word) fail('这里的值应该写成 ' + word + '。');
      i += word.length;
    }

    function string() {
      i++;
      while (i < n) {
        var c = text.charAt(i);
        if (c === '"') { i++; return; }
        if (c === '\\') {
          i++;
          var escape = text.charAt(i);
          if (escape === 'u') {
            var hex = text.substr(i + 1, 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('这里的转义写法不完整。');
            i += 5;
            continue;
          }
          if ('"\\/bfnrt'.indexOf(escape) < 0) fail('这里有一个无法识别的转义。');
          i++;
          continue;
        }
        if (c === '\n' || c === '\r') fail('字符串缺少结束的双引号。');
        i++;
      }
      fail('字符串缺少结束的双引号。');
    }

    function number() {
      var start = i;
      if (text.charAt(i) === '-') i++;
      var digits = 0;
      while (i < n && text.charAt(i) >= '0' && text.charAt(i) <= '9') { i++; digits++; }
      if (!digits) { i = start; fail('这里应该是一个数字。'); }
      if (text.charAt(i) === '.') {
        i++;
        var decimals = 0;
        while (i < n && text.charAt(i) >= '0' && text.charAt(i) <= '9') { i++; decimals++; }
        if (!decimals) fail('小数点后面还需要数字。');
      }
      if (text.charAt(i) === 'e' || text.charAt(i) === 'E') {
        i++;
        if (text.charAt(i) === '+' || text.charAt(i) === '-') i++;
        var exponent = 0;
        while (i < n && text.charAt(i) >= '0' && text.charAt(i) <= '9') { i++; exponent++; }
        if (!exponent) fail('指数部分还需要数字。');
      }
    }

    function value() {
      skip();
      if (i >= n) fail('内容在这里结束了，可能少了值或右括号。');
      var c = text.charAt(i);
      if (c === '{') return object();
      if (c === '[') return array();
      if (c === '"') return string();
      if (c === 't') return literal('true');
      if (c === 'f') return literal('false');
      if (c === 'n') return literal('null');
      if (c === '-' || (c >= '0' && c <= '9')) return number();
      fail('这里出现了一个多余的字符 “' + c + '”。');
    }

    function object() {
      i++;
      skip();
      if (text.charAt(i) === '}') { i++; return; }
      while (true) {
        skip();
        if (text.charAt(i) !== '"') fail('这里需要一个用双引号包起来的属性名。');
        string();
        skip();
        if (text.charAt(i) !== ':') fail('属性名后面少了冒号。');
        i++;
        value();
        skip();
        if (text.charAt(i) === ',') { i++; continue; }
        if (text.charAt(i) === '}') { i++; return; }
        fail('对象的属性之间少了逗号，或者缺少右花括号。');
      }
    }

    function array() {
      i++;
      skip();
      if (text.charAt(i) === ']') { i++; return; }
      while (true) {
        value();
        skip();
        if (text.charAt(i) === ',') { i++; continue; }
        if (text.charAt(i) === ']') { i++; return; }
        fail('数组的元素之间少了逗号，或者缺少右方括号。');
      }
    }

    try {
      value();
      skip();
      if (i < n) fail('有效内容已经结束，后面还有多余的字符。');
      return { ok: true, position: i };
    } catch (err) {
      if (err && typeof err.position === 'number') {
        return { ok: false, position: err.position, message: err.message };
      }
      return { ok: false, position: i, message: '内容不是有效的 JSON。' };
    }
  }

  function parse(text) {
    var source = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    if (!source.trim()) {
      return { ok: false, error: { message: '还没有内容。', line: 1, column: 1, snippet: '' } };
    }

    try {
      return { ok: true, value: JSON.parse(source) };
    } catch (err) {
      var detail = String(err && err.message ? err.message : err);
      var scanned = scan(source);
      var position = scanned.ok ? source.length : scanned.position;
      var message = scanned.ok ? describeError(detail) : scanned.message;
      var pos = locate(source, position);
      return {
        ok: false,
        error: {
          message: message,
          detail: detail,
          line: pos.line,
          column: pos.column,
          snippet: snippet(source, pos.line, pos.column)
        }
      };
    }
  }

  /* ------------------------------------------------------------------ *
   * 输出
   * ------------------------------------------------------------------ */

  function format(value, indent) {
    return JSON.stringify(value, null, indent);
  }

  function minify(value) {
    return JSON.stringify(value);
  }

  function sortValue(value) {
    if (Array.isArray(value)) {
      return value.map(sortValue);
    }
    if (value && typeof value === 'object') {
      var keys = Object.keys(value).sort();
      var out = {};
      for (var i = 0; i < keys.length; i++) out[keys[i]] = sortValue(value[keys[i]]);
      return out;
    }
    return value;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function cellValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(value) {
    var lines = [];

    if (Array.isArray(value)) {
      if (!value.length) return { ok: true, csv: '' };

      var allObjects = value.every(isPlainObject);
      if (allObjects) {
        var headers = [];
        for (var i = 0; i < value.length; i++) {
          var keys = Object.keys(value[i]);
          for (var k = 0; k < keys.length; k++) {
            if (headers.indexOf(keys[k]) < 0) headers.push(keys[k]);
          }
        }
        lines.push(headers.map(csvCell).join(','));
        for (var r = 0; r < value.length; r++) {
          var cells = [];
          for (var h = 0; h < headers.length; h++) {
            cells.push(csvCell(cellValue(value[r][headers[h]])));
          }
          lines.push(cells.join(','));
        }
        return { ok: true, csv: lines.join('\n') };
      }

      var flat = value.every(function (item) {
        return item === null || typeof item !== 'object';
      });

      if (flat) {
        for (var f = 0; f < value.length; f++) lines.push(csvCell(value[f]));
        return { ok: true, csv: lines.join('\n') };
      }

      for (var m = 0; m < value.length; m++) lines.push(csvCell(cellValue(value[m])));
      return { ok: true, csv: lines.join('\n') };
    }

    if (isPlainObject(value)) {
      lines.push('key,value');
      var names = Object.keys(value);
      for (var n = 0; n < names.length; n++) {
        lines.push(csvCell(names[n]) + ',' + csvCell(cellValue(value[names[n]])));
      }
      return { ok: true, csv: lines.join('\n') };
    }

    return { ok: false, error: '只有对象或数组才能转成表格。' };
  }

  /* ------------------------------------------------------------------ *
   * 统计
   * ------------------------------------------------------------------ */

  function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function stats(value, sourceLength) {
    var result = {
      type: typeOf(value),
      nodes: 0,
      depth: 0,
      keys: 0,
      items: 0,
      scalars: 0,
      sourceLength: sourceLength || 0
    };

    function walk(node, depth) {
      result.nodes++;
      if (depth > result.depth) result.depth = depth;

      if (Array.isArray(node)) {
        if (depth === 1) result.items = node.length;
        for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
        return;
      }
      if (node && typeof node === 'object') {
        var keys = Object.keys(node);
        if (depth === 1) result.keys = keys.length;
        for (var k = 0; k < keys.length; k++) walk(node[keys[k]], depth + 1);
        return;
      }
      result.scalars++;
    }

    walk(value, 1);
    return result;
  }

  function labelOfType(type) {
    var map = {
      object: '对象',
      array: '数组',
      string: '字符串',
      number: '数字',
      boolean: '布尔值',
      null: '空值'
    };
    return map[type] || type;
  }

  return {
    parse: parse,
    format: format,
    minify: minify,
    sortValue: sortValue,
    toCsv: toCsv,
    stats: stats,
    typeOf: typeOf,
    labelOfType: labelOfType,
    describeError: describeError,
    locate: locate
  };
});
