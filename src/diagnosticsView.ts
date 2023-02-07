import { Diagnostic, diagnosticCount } from '@codemirror/lint';
import { StateEffect } from '@codemirror/state';
import { TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';
import { TextlintMessage, TextlintRuleSeverityLevel } from '@textlint/types';
import { ItemView, Platform } from 'obsidian';
import TextlintPlugin from './main';
import { getActiveEditor, textlintSeverityToDiagnosticSeverity } from './util';

export const TEXTLINT_DIAGNOSTICS_EXTENSION = 'textlint.diagnostics';
export const VIEW_TYPE_TEXTLINT_DIAGNOSTICS = 'textlint-diagnostics-view';

export const diagnosticsViewEffect = StateEffect.define<TextlintWorkerCommandResponseLint['result']>();
export const resetDiagnosticsViewEffect = StateEffect.define();

const PREFIX = 'textlint-plugin-diagnostics-view';

const CONTENT_ID = PREFIX + '-content';
const MESSAGE_CONTAINER_ID = PREFIX + '-content-message-container';

const DIAGNOSTICS_CONTAINER_ID = PREFIX + '-diagnostics-container';
const DIAGNOSTICS_COUNT_ID = PREFIX + '-content-header-metadata-count';
const DIAGNOSTICS_DETAIL_INFO_ID = '-content-header-metadata-severity-info';
const DIAGNOSTICS_DETAIL_WARNING_ID = '-content-header-metadata-severity-warning';
const DIAGNOSTICS_DETAIL_ERROR_ID = '-content-header-metadata-severity-error';

const composeContentHeader = (contentEl: HTMLElement, title: string) => {
  const header = document.createElement('div');
  header.id = PREFIX + '-content-header';

  const children = [];

  const diagnostics = composeContentHeaderDiagnostics(header);
  if (diagnostics) children.push(diagnostics);

  header.setChildrenInPlace(children);
  return header;
};

const composeContentHeaderDiagnostics = (headerEl: HTMLElement) => {
  const container = document.createElement('div');
  container.addClass(PREFIX + '-content-header-metadata-container');
  container.id = DIAGNOSTICS_CONTAINER_ID;

  const count = document.createElement('span');
  count.id = DIAGNOSTICS_COUNT_ID;

  const severityContainer = document.createElement('div');
  severityContainer.addClass(PREFIX + '-content-header-metadata-severity-container');

  function getSeverityItem(severity: Diagnostic['severity'], id: string) {
    const el = document.createElement('span');
    el.id = id;
    el.addClass(PREFIX + '-content-header-metadata-severity-item');
    el.addClass('textlint-plugin-severity-' + severity);
    return el;
  }
  const info = getSeverityItem('info', DIAGNOSTICS_DETAIL_INFO_ID);
  const warning = getSeverityItem('warning', DIAGNOSTICS_DETAIL_WARNING_ID);
  const error = getSeverityItem('error', DIAGNOSTICS_DETAIL_ERROR_ID);

  severityContainer.setChildrenInPlace([error, warning, info]);
  container.setChildrenInPlace([count, severityContainer]);

  return container;
};

const setDiagnosticsMetadata = (count: {
  0: number; // info
  1: number; // warning
  2: number; // error
}) => {
  const countEl = document.querySelector(`#${DIAGNOSTICS_COUNT_ID}`);
  if (countEl) {
    countEl.textContent = `count: ${count[0] + count[1] + count[2]}`;
  }
  const infoEl = document.querySelector(`#${DIAGNOSTICS_DETAIL_INFO_ID}`);
  if (infoEl) {
    infoEl.textContent = `💡${count[0]}`;
  }
  const warningEl = document.querySelector(`#${DIAGNOSTICS_DETAIL_WARNING_ID}`);
  if (warningEl) {
    warningEl.textContent = `⚠️ ${count[1]}`;
  }
  const errorEl = document.querySelector(`#${DIAGNOSTICS_DETAIL_ERROR_ID}`);
  if (errorEl) {
    errorEl.textContent = `❗${count[2]}`;
  }
};

export class TextlintDiagnosticView extends ItemView {
  getViewType() {
    return VIEW_TYPE_TEXTLINT_DIAGNOSTICS;
  }

  getIcon() {
    return 'file-type';
  }

  getDisplayText() {
    return 'textlint diagnostics';
  }

  async onClose() {
    this.containerEl.empty();
  }

  async onOpen() {
    const el = this.contentEl;
    el.id = CONTENT_ID;

    const header = composeContentHeader(el, this.getDisplayText());
    const messageContainer = document.createElement('div');
    messageContainer.id = MESSAGE_CONTAINER_ID;

    el.setChildrenInPlace([header, messageContainer]);
  }

  static setTextlintDiagnostics(plugin: TextlintPlugin, messages: TextlintMessage[]) {
    const el = document.querySelector(`#${MESSAGE_CONTAINER_ID}`);
    if (!el) return;
    el.setChildrenInPlace([]);

    const msgs = messages.slice().filter((m) => m.severity >= plugin.settings.minimumSeverityInDiagnosticsView);

    const count: {
      0: number; // info
      1: number; // warning
      2: number; // error
    } = {
      0: 0,
      1: 0,
      2: 0,
    };

    if (msgs.length === 0) {
      setDiagnosticsMetadata(count);
      const div = document.createElement('div');
      div.textContent = 'No Errors! 🎉';
      el.appendChild(div);
      return;
    }

    msgs
      .sort((a, b) => b.severity - a.severity)
      .forEach((d) => {
        count[d.severity]++;
        const item = TextlintDiagnosticView.createDiagnosticItemElement(plugin, d);
        el.appendChild(item);
        setDiagnosticsMetadata(count);
      });
  }

  static createDiagnosticItemElement(plugin: TextlintPlugin, d: TextlintMessage): HTMLElement {
    const container = document.createElement('div');
    container.addClass(PREFIX + '-content-message-item-container');
    container.onClickEvent((ev) => {
      const leaf = plugin.app.workspace.getMostRecentLeaf();
      if (!leaf) return;

      if (Platform.isMobile) {
        plugin.app.workspace.rightSplit.collapse();
      }
      plugin.app.workspace.setActiveLeaf(leaf);

      const editor = getActiveEditor(plugin);
      if (!editor) return;

      editor.setCursor({ line: d.loc.start.line - 1, ch: d.loc.start.column - 1 });
    });

    // const messageContainer = document.createElement('div');
    // messageContainer.addClass(PREFIX + '-content-message-item-message-container');
    //
    const message = document.createElement('span');
    message.textContent = d.message;

    message.addClasses([
      PREFIX + '-content-message-item-message',
      `textlint-plugin-severity-${textlintSeverityToDiagnosticSeverity(d.severity)}`,
    ]);
    container.appendChild(message);

    const messageFooter = document.createElement('div');
    messageFooter.addClass(PREFIX + '-content-message-item-footer');

    const loc = document.createElement('span');
    loc.textContent = `[${d.loc.start.line}, ${d.loc.start.column}]`;
    loc.addClass(PREFIX + '-content-message-item-loc');

    const rule = document.createElement('span');
    rule.textContent = d.ruleId;
    rule.addClass(PREFIX + '-content-message-item-rule');

    messageFooter.setChildrenInPlace([rule, loc]);

    container.appendChild(message);
    container.appendChild(messageFooter);
    return container;
  }
}
