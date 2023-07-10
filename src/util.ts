import { Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { TextlintRuleSeverityLevel } from '@textlint/types';
import { Editor, MarkdownView, Plugin, TFile } from 'obsidian';

const getActiveView = (plugin: Plugin) => {
  return plugin.app.workspace.getActiveViewOfType(MarkdownView);
};

export const getAbstractFile = (plugin: Plugin, path: string) => {
  return plugin.app.vault.getAbstractFileByPath(path);
};

export const readVaultFile = async (plugin: Plugin, path: string) => {
  return await plugin.app.vault.adapter.read(path);
};

const parseTextlintrcInCodeBlock = (text: string) => {
  const regex = /```json:textlintrc.json([^`]*)```/;
  const matched = text.match(regex);
  if (!matched) return '';
  return matched[1].trim();
};

// Support only json format
export const readTextlintrc = async (plugin: Plugin, path: string) => {
  const file = getAbstractFile(plugin, path);
  if (!file) {
    throw new Error(`File not found. path: ${path}`);
  }
  // @ts-expect-error 2339
  if (file.extension === 'json') {
    const json = await readVaultFile(plugin, path);
    try {
      JSON.parse(json);
    } catch (e) {
      throw new Error(`Cannot parse textlintrc.json path: ${path}`);
    }
    return json;
  }
  // @ts-expect-error 2339
  if (file.extension === 'md') {
    const text = await readVaultFile(plugin, path);
    const json = parseTextlintrcInCodeBlock(text);
    if (!json) {
      throw new Error(`Cannot parse textlinrc code block in markdown. path: ${path}`);
    }
    try {
      JSON.parse(json);
    } catch (e) {
      throw new Error(`Cannot parse textlintrc.json path: ${path}`);
    }
    return json;
  }
  return '';
};

export const getActiveFile = (plugin: Plugin) => {
  return plugin.app.workspace.getActiveFile();
};

export const getActiveEditor = (plugin: Plugin) => {
  const view = getActiveView(plugin);
  return view?.editor;
};

export const getEditorView = (editor: Editor) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor as any).cm as EditorView;
};

export const getActiveEditorView = (plugin: Plugin) => {
  const editor = getActiveEditor(plugin);
  if (!editor) return;
  return getEditorView(editor);
};

export const isIgnoredFile = (file: TFile, folders: string[]) => {
  for (const folder of folders) {
    if (folder.length > 0 && file.path.startsWith(folder)) {
      return true;
    }
  }
  return false;
};

export const textlintSeverityToDiagnosticSeverity = (severity: TextlintRuleSeverityLevel) => {
  return ['info', 'warning', 'error'][severity] as Diagnostic['severity'];
};

export const diagnosticSeverityToTextlintSeverity = (severity: Diagnostic['severity']) => {
  return { hint: 0, info: 0, warning: 1, error: 2 }[severity] as TextlintRuleSeverityLevel;
};
