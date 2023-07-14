import { Diagnostic } from '@codemirror/lint';
import { StateEffect } from '@codemirror/state';
import { TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';
import { TextlintMessage } from '@textlint/types';
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
const MESSAGE_CONTENT_HEADER_ID = PREFIX + '-content-header';

const DIAGNOSTICS_CONTAINER_ID = PREFIX + '-diagnostics-container';
const DIAGNOSTICS_COUNT_ID = PREFIX + '-content-header-metadata-count';
const DIAGNOSTICS_DETAIL_INFO_ID = '-content-header-metadata-severity-info';
const DIAGNOSTICS_DETAIL_WARNING_ID = '-content-header-metadata-severity-warning';
const DIAGNOSTICS_DETAIL_ERROR_ID = '-content-header-metadata-severity-error';

type DiagnosticsCount = {
  0: number; // info
  1: number; // warning
  2: number; // error
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
    this.contentEl.empty();
  }

  async onOpen() {
    this.contentEl.id = CONTENT_ID;
    this.createContainerEl();
  }

  private createContainerEl() {
    const header = this.createContentHeaderEl();
    const messageContainer = this.createMessageContainerEl();
    this.contentEl.setChildrenInPlace([header, messageContainer]);
    this.setDiagnosticsMetadata();
  }
  private createContentHeaderEl() {
    const header = this.contentEl.createEl('div');
    header.id = MESSAGE_CONTENT_HEADER_ID;
    const container = header.createEl('div');
    container.addClass(PREFIX + '-content-header-metadata-container');
    container.id = DIAGNOSTICS_CONTAINER_ID;

    const count = this.contentEl.createEl('span');
    count.id = DIAGNOSTICS_COUNT_ID;
    const severityContainer = this.createSeverityContainerEl();
    container.setChildrenInPlace([count, severityContainer]);
    return header;
  }
  private createSeverityContainerEl() {
    const severityContainer = this.contentEl.createEl('div');
    severityContainer.addClass(PREFIX + '-content-header-metadata-severity-container');

    function createSeverityItem(severity: Diagnostic['severity'], id: string) {
      const el = severityContainer.createEl('span');
      el.id = id;
      el.addClass(PREFIX + '-content-header-metadata-severity-item');
      el.addClass('textlint-plugin-severity-' + severity);
      return el;
    }
    const info = createSeverityItem('info', DIAGNOSTICS_DETAIL_INFO_ID);
    const warning = createSeverityItem('warning', DIAGNOSTICS_DETAIL_WARNING_ID);
    const error = createSeverityItem('error', DIAGNOSTICS_DETAIL_ERROR_ID);

    severityContainer.setChildrenInPlace([info, warning, error]);
    return severityContainer;
  }
  private createMessageContainerEl() {
    const messageContainer = this.contentEl.createEl('div');
    messageContainer.id = MESSAGE_CONTAINER_ID;
    return messageContainer;
  }

  clear() {
    this.setDiagnosticsMetadata();
    const messageContainer = this.contentEl.querySelector(`#${MESSAGE_CONTAINER_ID}`);
    if (messageContainer) {
      messageContainer.empty();
    }
  }

  setDiagnosticsMetadata(count: DiagnosticsCount = { 0: 0, 1: 0, 2: 0 }) {
    const countEl = this.contentEl.querySelector(`#${DIAGNOSTICS_COUNT_ID}`);
    if (countEl) {
      countEl.textContent = `count: ${count[0] + count[1] + count[2]}`;
    }
    const infoEl = this.contentEl.querySelector(`#${DIAGNOSTICS_DETAIL_INFO_ID}`);
    if (infoEl) {
      infoEl.textContent = `💡${count[0]}`;
    }
    const warningEl = this.contentEl.querySelector(`#${DIAGNOSTICS_DETAIL_WARNING_ID}`);
    if (warningEl) {
      warningEl.textContent = `⚠️ ${count[1]}`;
    }
    const errorEl = this.contentEl.querySelector(`#${DIAGNOSTICS_DETAIL_ERROR_ID}`);
    if (errorEl) {
      errorEl.textContent = `❗${count[2]}`;
    }
  }
  setTextlintDiagnostics(plugin: TextlintPlugin, messages: TextlintMessage[]) {
    if (!this.contentEl.querySelector(`#${MESSAGE_CONTAINER_ID}`)) {
      this.createContainerEl();
    }
    const el = this.contentEl.querySelector(`#${MESSAGE_CONTAINER_ID}`);
    if (!el) return;
    el.setChildrenInPlace([]);

    const msgs = messages.slice().filter((m) => m.severity >= plugin.settings.minimumSeverityInDiagnosticsView);
    if (msgs.length === 0) {
      return this.clear();
    }

    const count: DiagnosticsCount = {
      0: 0,
      1: 0,
      2: 0,
    };

    msgs
      .sort((a, b) => b.severity - a.severity)
      .forEach((d) => {
        count[d.severity]++;
        const item = this.createDiagnosticItemElement(plugin, d);
        el.appendChild(item);
      });

    this.setDiagnosticsMetadata(count);
  }

  private createDiagnosticItemElement(plugin: TextlintPlugin, d: TextlintMessage): HTMLElement {
    const container = this.contentEl.createEl('div');
    container.addClass(PREFIX + '-content-message-item-container');
    container.onClickEvent(() => {
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

    const message = this.contentEl.createEl('span');
    message.textContent = d.message;

    message.addClasses([
      PREFIX + '-content-message-item-message',
      `textlint-plugin-severity-${textlintSeverityToDiagnosticSeverity(d.severity)}`,
    ]);
    container.appendChild(message);

    const messageFooter = this.contentEl.createEl('div');
    messageFooter.addClass(PREFIX + '-content-message-item-footer');

    const loc = this.contentEl.createEl('span');
    loc.textContent = `[${d.loc.start.line}, ${d.loc.start.column}]`;
    loc.addClass(PREFIX + '-content-message-item-loc');

    const rule = this.contentEl.createEl('span');
    rule.textContent = d.ruleId;
    rule.addClass(PREFIX + '-content-message-item-rule');

    messageFooter.setChildrenInPlace([rule, loc]);

    container.appendChild(message);
    container.appendChild(messageFooter);
    return container;
  }
}
