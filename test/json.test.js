/*!
 * JSON 工坊 JSON Studio — 核心处理测试
 * Copyright (c) 2026 深维工坊工作室 Deep Dimension Workshop
 * Released under the MIT License.
 *
 * 运行：node test/json.test.js
 */
'use strict';

var assert = require('assert');
var core = require('../assets/js/json-core.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL ' + name);
    console.log('       ' + err.message);
  }
}

function group(name) { console.log('\n' + name); }

group('解析');

test('合法对象', function () {
  var result = core.parse('{"a":1,"b":[true,null]}');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.value.a, 1);
  assert.strictEqual(result.value.b.length, 2);
});

test('空内容给出提示', function () {
  var result = core.parse('   ');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.message.length > 0);
});

test('缺少逗号时定位到第三行', function () {
  var result = core.parse('{\n  "a": 1\n  "b": 2\n}');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.line >= 2, '行号应指向问题附近，实际 ' + result.error.line);
  assert.ok(result.error.snippet.indexOf('^') > -1, '应包含插入符');
});

test('内容中断时给出易懂的说明', function () {
  var result = core.parse('{"a": 1');
  assert.strictEqual(result.ok, false);
  assert.ok(/结尾|括号/.test(result.error.message));
});

test('多行内容的行列定位准确', function () {
  var result = core.parse('{\n  "a": 1,\n  "b": ,\n}');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.line, 3);
});

test('定位函数按换行累加行号', function () {
  var pos = core.locate('abc\ndef\nghi', 6);
  assert.strictEqual(pos.line, 2);
  assert.strictEqual(pos.column, 3);
});

group('输出格式');

test('按两空格缩进', function () {
  var text = core.format({ a: 1 }, 2);
  assert.strictEqual(text, '{\n  "a": 1\n}');
});

test('按制表符缩进', function () {
  var text = core.format({ a: 1 }, '\t');
  assert.strictEqual(text, '{\n\t"a": 1\n}');
});

test('压缩成单行', function () {
  assert.strictEqual(core.minify({ a: 1, b: [2, 3] }), '{"a":1,"b":[2,3]}');
});

test('递归按字母排序键', function () {
  var sorted = core.sortValue({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] });
  assert.deepStrictEqual(Object.keys(sorted), ['a', 'list', 'z']);
  assert.deepStrictEqual(Object.keys(sorted.a), ['b', 'y']);
  assert.deepStrictEqual(Object.keys(sorted.list[0]), ['c', 'd']);
});

test('排序不改变数组顺序', function () {
  var sorted = core.sortValue([{ b: 1, a: 2 }, { d: 3, c: 4 }]);
  assert.strictEqual(sorted.length, 2);
  assert.strictEqual(sorted[0].a, 2);
});

group('转成表格');

test('对象数组生成表头', function () {
  var result = core.toCsv([{ name: 'Ada', age: 36 }, { name: 'Linus', age: 54 }]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.csv, 'name,age\nAda,36\nLinus,54');
});

test('字段不统一时合并所有列并留空', function () {
  var result = core.toCsv([{ a: 1 }, { b: 2 }]);
  assert.strictEqual(result.csv, 'a,b\n1,\n,2');
});

test('含逗号与引号的单元格正确转义', function () {
  var result = core.toCsv([{ text: '你好, "世界"' }]);
  assert.strictEqual(result.csv, 'text\n"你好, ""世界"""');
});

test('嵌套对象写成 JSON 文本', function () {
  var result = core.toCsv([{ id: 1, tags: { a: true } }]);
  assert.ok(result.csv.indexOf('"{""a"":true}"') > -1);
});

test('标量数组每个元素一行', function () {
  var result = core.toCsv([1, 2, 3]);
  assert.strictEqual(result.csv, '1\n2\n3');
});

test('单个对象转成两列', function () {
  var result = core.toCsv({ a: 1, b: 'x' });
  assert.strictEqual(result.csv, 'key,value\na,1\nb,x');
});

test('标量无法转成表格', function () {
  var result = core.toCsv('text');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.length > 0);
});

group('统计');

test('统计节点、深度与顶层键数', function () {
  var value = { a: 1, b: { c: [1, 2, { d: 3 }] } };
  var info = core.stats(value, 100);
  assert.strictEqual(info.type, 'object');
  assert.strictEqual(info.keys, 2);
  assert.strictEqual(info.depth, 5);
  assert.strictEqual(info.nodes, 8);
});

test('数组记录元素个数', function () {
  var info = core.stats([1, 2, 3], 10);
  assert.strictEqual(info.type, 'array');
  assert.strictEqual(info.items, 3);
  assert.strictEqual(info.depth, 2);
});

test('类型名称转成中文', function () {
  assert.strictEqual(core.labelOfType('array'), '数组');
  assert.strictEqual(core.labelOfType('null'), '空值');
  assert.strictEqual(core.labelOfType('boolean'), '布尔值');
});

test('识别根类型', function () {
  assert.strictEqual(core.typeOf(null), 'null');
  assert.strictEqual(core.typeOf([]), 'array');
  assert.strictEqual(core.typeOf({}), 'object');
  assert.strictEqual(core.typeOf('x'), 'string');
});

/* ------------------------------------------------------------------ */

console.log('\n' + passed + ' 通过，' + failed + ' 失败');
if (failed > 0) process.exitCode = 1;
