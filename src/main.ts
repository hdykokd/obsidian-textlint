import { Notice, Plugin, TFile } from 'obsidian';
import { debounce } from 'lodash-es';
import { Diagnostic, lintGutter, setDiagnostics } from '@codemirror/lint';
import { EditorView, tooltips, ViewUpdate } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';
import { WorkerManager } from './textlint/worker';
import { runLint } from './textlint/linter';
import { getTheme } from './theme';
import { DEFAULT_SETTINGS, TextlingPluginSettingTab, TextlintConfig, TextlintPluginSettings } from './settings';
import {
  diagnosticSeverityToTextlintSeverity,
  getActiveEditorView,
  getActiveFile,
  isIgnoredFile,
  readTextlintrc,
} from './util';
import {
  TextlintDiagnosticView,
  TEXTLINT_DIAGNOSTICS_EXTENSION,
  VIEW_TYPE_TEXTLINT_DIAGNOSTICS,
} from './diagnosticsView';
import { resetTextlintResponseEffect, textlintResponseEffect, textlintResponseField } from './textlint/responseField';
import { getDiagnostics } from './cm/diagnostics';
import defaultTextlintrc from '../dist/textlintrc_default.json';

export default class TextlintPlugin extends Plugin {
  settings: TextlintPluginSettings;
  private isEnabled = true;
  private workerManager: WorkerManager;
  private effects: {
    textlintResponse: typeof textlintResponseEffect;
    resetTextlintResponse: typeof resetTextlintResponseEffect;
  } = {
    textlintResponse: textlintResponseEffect,
    resetTextlintResponse: resetTextlintResponseEffect,
  };
  private watchers: {
    textlintResponseWatcher: NodeJS.Timer | null;
  } = {
    textlintResponseWatcher: null,
  };
  defaultConfig: TextlintConfig = {
    folder: '/',
    textlintrc: JSON.stringify(defaultTextlintrc),
    textlintrcPath: '',
  };
  private sortedConfigs: TextlintConfig[] = [];

  async onload() {
    console.log('[Obsidian textlint] loading...');

    this.isEnabled = true;
    this.workerManager = new WorkerManager();
    this.watchers = {
      textlintResponseWatcher: null,
    };

    this.app.workspace.onLayoutReady(async () => {
      // getAbstractFile() でfileが取得できない場合があるので読み込みを待つ
      await this.loadSettings();

      this.registerWorkers();
      this.registerEditorExtensions();
      this.registerEvents();
      this.registerEditorExtension(textlintResponseField);
      this.registerDiagnosticsViewExtension();
      this.addCommands();
      this.setWachers();

      this.addSettingTab(new TextlingPluginSettingTab(this.app, this));
    });

    console.log('[Obsidian textlint] loaded');
  }

  async onunload() {
    console.log('[Obsidian textlint] unloading...');

    this.isEnabled = false;
    this.resetState();
    this.clearWatchers();
    this.workerManager.terminate();
    this.sortedConfigs = [];

    console.log('[Obsidian textlint] unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    for (const c of structuredClone(this.settings.textlintConfigs)) {
      try {
        if (!c.folder) {
          console.log("[textlint]: folder is empty. use '/' as default");
          c.folder = '/';
        }
        this.sortedConfigs.push(c);
      } catch (e) {
        new Notice('[textlint] Cannot read textlintrc. error: ', e.message);
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  addCommands() {
    this.addCommand({
      id: 'obsidian-textlint-run-lint',
      name: 'Run textlint lint',
      editorCallback: () => {
        this.runLint();
      },
    });
  }

  registerDiagnosticsViewExtension() {
    this.registerView(VIEW_TYPE_TEXTLINT_DIAGNOSTICS, (leaf) => {
      return new TextlintDiagnosticView(leaf);
    });
    this.registerExtensions([TEXTLINT_DIAGNOSTICS_EXTENSION], VIEW_TYPE_TEXTLINT_DIAGNOSTICS);
    this.addCommand({
      id: 'obsidian-textlint-show-diagnostics',
      name: 'Show textlint diagnostics',
      editorCallback: async () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TEXTLINT_DIAGNOSTICS);
        if (leaves[0]) {
          return this.app.workspace.revealLeaf(leaves[0]);
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        await leaf.setViewState({
          type: VIEW_TYPE_TEXTLINT_DIAGNOSTICS,
          active: true,
        });
        this.app.workspace.revealLeaf(leaf);
      },
    });
  }

  registerEvents() {
    if (this.settings.lintOnSaved) {
      // @ts-expect-error
      const editorSaveCommand = this.app.commands?.commands?.['editor:save-file'];
      if (editorSaveCommand && editorSaveCommand?.callback) {
        // clone to avoid overwriting other plugin's implementation
        const originalCallback = editorSaveCommand.callback.bind({});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const saveCallback = (...args: any[]) => {
          originalCallback(...args);
          this.runLint();
        };
        editorSaveCommand.callback = saveCallback;
      }
    }

    if (this.settings.lintOnActiveFileChanged) {
      this.registerEvent(
        this.app.workspace.on('active-leaf-change', () => {
          this.runLint();
        }),
      );
    }
  }

  registerEditorExtensions() {
    const extensions = [
      tooltips({ parent: document.body, position: 'fixed' }),
      this.getLintOnTextChangedExtension(),
      this.getLintGutterExtension(),
      getTheme(),
    ].filter((v) => v) as Extension[];

    this.registerEditorExtension(extensions);
  }

  getLintOnTextChangedExtension() {
    if (!this.settings.lintOnTextChanged) return;

    // paste は update.docChanged が false
    this.registerEvent(
      this.app.workspace.on('editor-paste', () => {
        this.runLint();
      }),
    );

    return EditorView.updateListener.of((update: ViewUpdate) => {
      if (this.isEnabled && update.docChanged) {
        this.runLint();
      }
    });
  }

  getLintGutterExtension() {
    const filter = (diagnostics: Diagnostic[]) => {
      if (!this.settings.showGutter) {
        return [];
      }
      return diagnostics.filter(
        (d) => diagnosticSeverityToTextlintSeverity(d.severity) >= this.settings.minimumSeverityToShowGutter,
      );
    };
    return lintGutter({ hoverTime: 100, tooltipFilter: filter, markerFilter: filter });
  }

  getWorker(filepath: TFile['path']) {
    const folder = this.getConfiguredFolderName(filepath);
    return this.workerManager.getWorker(folder);
  }

  getConfiguredFolderName(filepath: string) {
    let folder = '/';
    for (const c of this.sortedConfigs) {
      if (filepath.startsWith(c.folder)) {
        folder = c.folder;
        break;
      }
    }
    return folder;
  }

  runLint = debounce(() => {
    if (!this.isEnabled) return;
    const cm = getActiveEditorView(this);
    if (!cm) return;

    const file = getActiveFile(this);
    if (!file) return;
    if (isIgnoredFile(file, this.settings.foldersToIgnore)) return;
    //
    const worker = this.getWorker(file.path);
    const data = cm.state.doc.toJSON().join('\n');

    runLint(worker, data);
  }, 200);

  private async registerWorkers() {
    this.registerWorker(this.defaultConfig.folder, this.defaultConfig.textlintrc);
    for (const c of this.sortedConfigs) {
      this.registerWorker(c.folder, c.textlintrc);
    }
  }

  private registerWorker(folder: string, textlintrc: string) {
    this.workerManager.registerWorker(folder, textlintrc, { 'lint:result': this.processLintCallback.bind(this) });
  }

  private setWachers() {
    this.watchers.textlintResponseWatcher = this.setTextlintResponseWatcher();
  }

  private clearWatchers() {
    Object.values(this.watchers).forEach((watcher) => {
      if (watcher) {
        clearInterval(watcher);
      }
    });
  }

  private setTextlintResponseWatcher() {
    let lastUpdateTime: number;
    let processing = false;

    const process = () => {
      const cm = getActiveEditorView(this);
      if (!cm) return;

      let textlintResponse;
      try {
        textlintResponse = cm.state.field(textlintResponseField);
        if (lastUpdateTime === textlintResponse.lastUpdateTime) return;

        const { messages } = textlintResponse.response;
        TextlintDiagnosticView.setTextlintDiagnostics(this, messages);
        const diagnostics = getDiagnostics(this, messages);
        cm.dispatch(setDiagnostics(cm.state, diagnostics));
        lastUpdateTime = textlintResponse.lastUpdateTime;
      } catch (e) {
        console.log('[textlint] error occurred in linting :', e);
        lastUpdateTime = new Date().getTime();
        return;
      }
    };

    return setInterval(() => {
      if (processing) return;
      processing = true;
      process();
      processing = false;
    }, 200);
  }

  private resetState() {
    const cm = getActiveEditorView(this);
    if (!cm) return;

    cm.dispatch({
      effects: [this.effects.resetTextlintResponse.of(null)],
    });
  }

  private processLintCallback(result: TextlintWorkerCommandResponseLint['result']) {
    const cm = getActiveEditorView(this);
    if (!cm) return;

    if (result.messages) {
      const effects = [this.effects.textlintResponse.of(result)];
      cm.dispatch({ effects });
    }

    return;
  }
}
