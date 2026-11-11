/*!
 * JSON 工坊 JSON Studio — 界面逻辑
 * Copyright (c) 2026 深维工坊工作室 Deep Dimension Workshop
 * Released under the MIT License.
 */
(function () {
  'use strict';

  var Core = window.JsonCore;
  var byId = function (id) { return document.getElementById(id); };

  var el = {
    source: byId('source'),
    charCount: byId('char-count'),
    parseState: byId('parse-state'),
    indentChips: byId('indent-chips'),
    stats: byId('stats'),
    modeTabs: byId('mode-tabs'),
    copyBtn: byId('copy-btn'),
    downloadBtn: byId('download-btn'),
    sampleBtn: byId('sample-btn'),
    clearBtn: byId('clear-btn'),
    preview: byId('preview'),
    outputNote: byId('output-note'),
    actionNote: byId('action-note')
  };

  var state = {
    mode: 'format',
    indent: 2,
    output: '',
    parsed: null,
    timer: 0,
    flashTimer: 0
  };

  var SAMPLE = [
    '[',
    '  { "id": 1, "name": "Ada", "lang": "English", "active": true },',
    '  { "id": 2, "name": "Grace", "lang": "English", "active": true },',
    '  { "id": 3, "name": "Linus", "lang": "Swedish", "active": false }',
    ']'
  ].join('\n');

  function flash(message) {
    el.actionNote.textContent = message;
    window.clearTimeout(state.flashTimer);
    state.flashTimer = window.setTimeout(function () {
      el.actionNote.textContent = '';
    }, 2200);
  }

  function byteLength(text) {
    try { return new Blob([text]).size; }
    catch (err) { return text.length; }
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function statCell(label, value) {
    var box = document.createElement('div');
    box.className = 'stat';
    var b = document.createElement('b');
    b.textContent = value;
    var span = document.createElement('span');
    span.textContent = label;
    box.appendChild(b);
    box.appendChild(span);
    return box;
  }

  function renderStats(parsed) {
    el.stats.innerHTML = '';

    if (!parsed || !parsed.ok) {
      el.stats.appendChild(statCell('根类型', '—'));
      el.stats.appendChild(statCell('节点数', '—'));
      el.stats.appendChild(statCell('最大深度', '—'));
      el.stats.appendChild(statCell('顶层数量', '—'));
      return;
    }

    var info = Core.stats(parsed.value, el.source.value.length);
    var topCount = info.type === 'array' ? info.items : info.keys;

    el.stats.appendChild(statCell('根类型', Core.labelOfType(info.type)));
    el.stats.appendChild(statCell('节点数', String(info.nodes)));
    el.stats.appendChild(statCell('最大深度', String(info.depth)));
    el.stats.appendChild(statCell(info.type === 'array' ? '元素个数' : '顶层键数', String(topCount)));
  }

  function renderEmpty() {
    el.preview.textContent = '';
    el.preview.className = 'preview';
    el.parseState.textContent = '等待输入';
    el.parseState.className = '';
    el.outputNote.textContent = '等待输入';
    el.downloadBtn.disabled = true;
    state.output = '';
    state.parsed = null;
  }

  function renderError(error) {
    el.preview.className = 'preview is-error';
    el.preview.textContent = '';

    var title = document.createElement('div');
    title.className = 'error-title';
    title.textContent = '第 ' + error.line + ' 行 第 ' + error.column + ' 列：' + error.message;

    var body = document.createElement('div');
    body.className = 'error-body';
    body.textContent = error.snippet || '';

    var hint = document.createElement('div');
    hint.className = 'error-hint';
    hint.textContent = '检查这一行附近是否缺少逗号、引号或括号。';

    el.preview.appendChild(title);
    if (error.snippet) el.preview.appendChild(body);
    el.preview.appendChild(hint);

    el.parseState.textContent = '格式有问题';
    el.parseState.className = 'is-bad';
    el.outputNote.textContent = '第 ' + error.line + ' 行 第 ' + error.column + ' 列';
    el.downloadBtn.disabled = true;
    state.output = '';
    state.parsed = null;
  }

  function buildOutput(parsed) {
    if (state.mode === 'csv') {
      var result = Core.toCsv(parsed.value);
      if (!result.ok) {
        return { ok: false, message: result.error };
      }
      return { ok: true, text: result.csv, note: '表格 · ' + result.csv.split('\n').length + ' 行' };
    }

    if (state.mode === 'minify') {
      return { ok: true, text: Core.minify(parsed.value), note: '压缩 · 单行' };
    }

    var value = state.mode === 'sort' ? Core.sortValue(parsed.value) : parsed.value;
    var indent = state.indent === 'tab' ? '\t' : state.indent;
    return { ok: true, text: Core.format(value, indent), note: '格式化 · ' + (state.indent === 'tab' ? 'Tab' : state.indent + ' 空格缩进') };
  }

  function render() {
    var source = el.source.value;
    el.charCount.textContent = source.length.toLocaleString('zh-CN') + ' 字符';

    if (!source.trim()) {
      renderEmpty();
      renderStats(null);
      return;
    }

    var parsed = Core.parse(source);
    state.parsed = parsed;
    renderStats(parsed);

    if (!parsed.ok) {
      renderError(parsed.error);
      return;
    }

    el.parseState.textContent = '格式正确';
    el.parseState.className = 'is-ok';

    var built = buildOutput(parsed);
    if (!built.ok) {
      el.preview.className = 'preview is-error';
      el.preview.textContent = '';
      var title = document.createElement('div');
      title.className = 'error-title';
      title.textContent = built.message;
      var hint = document.createElement('div');
      hint.className = 'error-hint';
      hint.textContent = '当前内容是' + Core.labelOfType(Core.typeOf(parsed.value)) + '，可以先确认结构。';
      el.preview.appendChild(title);
      el.preview.appendChild(hint);
      el.outputNote.textContent = built.message;
      el.downloadBtn.disabled = true;
      state.output = '';
      return;
    }

    el.preview.className = 'preview';
    el.preview.textContent = built.text;
    state.output = built.text;
    el.downloadBtn.disabled = false;
    el.outputNote.textContent = built.note + ' · ' + formatSize(byteLength(built.text));
  }

  function schedule() {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(render, 150);
  }

  function switchMode(mode) {
    state.mode = mode;
    var buttons = el.modeTabs.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-mode') === mode;
      buttons[i].classList.toggle('active', active);
      buttons[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    render();
  }

  function download() {
    if (!state.output) return;
    var extension = state.mode === 'csv' ? 'csv' : 'json';
    var text = state.mode === 'csv' ? '\uFEFF' + state.output : state.output;
    var blob = new Blob([text], { type: state.mode === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'data.' + extension;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    flash('已保存 ' + a.download);
  }

  function copy() {
    if (!state.output) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.output).then(function () {
        flash('已复制到剪贴板');
      }, legacyCopy);
    } else {
      legacyCopy();
    }

    function legacyCopy() {
      var box = document.createElement('textarea');
      box.value = state.output;
      box.style.position = 'fixed';
      box.style.top = '0';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(box);
      flash(ok ? '已复制到剪贴板' : '复制没有成功，请手动选择内容');
    }
  }

  el.source.addEventListener('input', schedule);
  el.copyBtn.addEventListener('click', copy);
  el.downloadBtn.addEventListener('click', download);

  el.modeTabs.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-mode]');
    if (!btn) return;
    switchMode(btn.getAttribute('data-mode'));
  });

  el.indentChips.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-indent]');
    if (!btn) return;
    var value = btn.getAttribute('data-indent');
    state.indent = value === 'tab' ? 'tab' : parseInt(value, 10);

    var buttons = el.indentChips.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i] === btn);
    }
    render();
  });

  el.sampleBtn.addEventListener('click', function () {
    el.source.value = SAMPLE;
    render();
    flash('已载入示例');
  });

  el.clearBtn.addEventListener('click', function () {
    el.source.value = '';
    render();
  });

  render();
})();
