import { Diagnostic } from '@codemirror/lint';
import { TextlintRuleSeverityLevel } from '@textlint/types';
import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import TextlintPlugin from './main';
import { readTextlintrc } from './util';
import textlintVersions from '../dist/textlint_versions.json';
import textlintDefault from '../dist/textlintrc_default.json';

const SEVERITY_OPTIONS: Record<TextlintRuleSeverityLevel, Diagnostic['severity']> = {
  0: 'info',
  1: 'warning',
  2: 'error',
};

export type TextlintConfig = { folder: string; textlintrc: string; textlintrcPath: string };

export interface TextlintPluginSettings {
  lintOnActiveFileChanged: boolean;
  lintOnSaved: boolean;
  lintOnTextChanged: boolean;

  minimumSeverityInEditingView: TextlintRuleSeverityLevel;
  minimumSeverityInDiagnosticsView: TextlintRuleSeverityLevel;

  showGutter: boolean;
  minimumSeverityToShowGutter: TextlintRuleSeverityLevel;

  foldersToIgnore: string[];
  textlintConfigs: TextlintConfig[];
}

export const DEFAULT_SETTINGS: TextlintPluginSettings = {
  lintOnActiveFileChanged: true,
  lintOnSaved: true,
  lintOnTextChanged: true,

  minimumSeverityInEditingView: 1,
  minimumSeverityToShowGutter: 2,
  minimumSeverityInDiagnosticsView: 0,

  showGutter: true,

  foldersToIgnore: [],
  textlintConfigs: [],
};

export class TextlingPluginSettingTab extends PluginSettingTab {
  plugin: TextlintPlugin;

  textlintConfigs: TextlintConfig[] = [];

  constructor(app: App, plugin: TextlintPlugin) {
    super(app, plugin);
    this.plugin = plugin;

    this.textlintConfigs = this.plugin.settings.textlintConfigs;
  }

  saveTextlintConfig(config: TextlintConfig) {
    const idx = this.plugin.settings.textlintConfigs.findIndex((c) => c.folder === config.folder);
    this.plugin.settings.textlintConfigs[idx] = config;
    this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h1', { text: 'Obsidian textlint Settings' });

    new Setting(containerEl)
      .setName('Lint on saved')
      .setDesc('Require reload')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.lintOnSaved).onChange(async (v) => {
          this.plugin.settings.lintOnSaved = v;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Lint on active file changed')
      .setDesc('Require reload')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.lintOnActiveFileChanged).onChange(async (v) => {
          this.plugin.settings.lintOnActiveFileChanged = v;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Lint on text changed (Experimental)')
      .setDesc('Require reload')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.lintOnTextChanged).onChange(async (v) => {
          this.plugin.settings.lintOnTextChanged = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName('Minimum severity in editing view').addDropdown((dropdown) => {
      dropdown.addOptions(SEVERITY_OPTIONS);
      dropdown.setValue(String(this.plugin.settings.minimumSeverityInEditingView));
      dropdown.onChange(async (v: string) => {
        this.plugin.settings.minimumSeverityInEditingView = Number(v) as TextlintRuleSeverityLevel;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName('Show lint gutter').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.showGutter).onChange(async (v) => {
        this.plugin.settings.showGutter = v;
        await this.plugin.saveSettings();
        this.display();
      });
    });

    if (this.plugin.settings.showGutter) {
      new Setting(containerEl)
        .setName('Minimum severity to show lint gutter')
        .setDesc('Set a value equal to or greater than the value set in "Minimum severity in editing view".')
        .addDropdown((dropdown) => {
          dropdown.addOptions(SEVERITY_OPTIONS);
          dropdown.setValue(String(this.plugin.settings.minimumSeverityToShowGutter));
          dropdown.onChange(async (v: string) => {
            this.plugin.settings.minimumSeverityToShowGutter = Number(v) as TextlintRuleSeverityLevel;
            await this.plugin.saveSettings();
          });
        });
    }
    new Setting(containerEl).setName('Minimum severity for diagnostics view').addDropdown((dropdown) => {
      dropdown.addOptions(SEVERITY_OPTIONS);
      dropdown.setValue(String(this.plugin.settings.minimumSeverityInDiagnosticsView));
      dropdown.onChange(async (v: string) => {
        this.plugin.settings.minimumSeverityInDiagnosticsView = Number(v) as TextlintRuleSeverityLevel;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl)
      .setName('Folders to ignore lint')
      .setDesc('Enter folder paths separated by newlines')
      .addTextArea((textArea) => {
        textArea.setValue(this.plugin.settings.foldersToIgnore.join('\n')).onChange(async (value) => {
          this.plugin.settings.foldersToIgnore = value.split('\n');
          await this.plugin.saveSettings();
        });
      });

    // version info
    const moduleInfoEl = containerEl.createEl('h3', { text: 'textlint modules' });
    new Setting(moduleInfoEl)
      .addTextArea(async (textarea) => {
        textarea.setDisabled(true);
        textarea.inputEl.style.width = '300px';
        textarea.inputEl.style.height = '300px';
        textarea.setValue(JSON.stringify(textlintVersions, null, 2));
      })
      .setDesc('installed modules')
      .addButton((btn) => {
        btn.setButtonText('Copy').onClick(async () => {
          navigator.clipboard.writeText(JSON.stringify(textlintVersions, null, 2));
          new Notice('Copied to clipboard.');
        });
      });

    // worker default settings
    const defaultConfigEl = containerEl.createEl('h3', { text: 'textlint default config' });
    new Setting(defaultConfigEl)
      .addTextArea(async (textarea) => {
        textarea.setDisabled(true);
        textarea.inputEl.style.width = '300px';
        textarea.inputEl.style.height = '300px';
        textarea.setValue(JSON.stringify(textlintDefault, null, 2));
      })
      .setDesc('default textlintrc')
      .addButton((btn) => {
        btn.setButtonText('Copy').onClick(async () => {
          navigator.clipboard.writeText(JSON.stringify(textlintDefault, null, 2));
          new Notice('Copied to clipboard.');
        });
      });

    const configEl = containerEl.createEl('h3', { text: 'textlintrc override per folder' });

    const addConfigEl = (config: TextlintConfig, index: number) => {
      const el = configEl.createEl('div');
      el.style.border = '1px solid var(--background-modifier-border)';
      el.style.padding = '1em';
      el.style.marginBottom = '0.25em';

      const parse = async (path: string) => {
        try {
          const rc = await readTextlintrc(this.plugin, path);
          return rc;
        } catch (e) {
          new Notice(e.message);
          return 'Could not parse textlintrc.';
        }
      };
      new Setting(el)
        .addText((text) => {
          text.setValue(config.folder).onChange(async (v) => {
            config.folder = v;
            await this.plugin.saveSettings();
            this.saveTextlintConfig(config);
          });
        })
        .setName('folder');

      const textlintrc = new Setting(el)
        .addTextArea(async (textarea) => {
          textarea.inputEl.style.width = '300px';
          textarea.inputEl.style.height = '300px';
          if (config.textlintrc) {
            textarea.inputEl.value = JSON.stringify(JSON.parse(config.textlintrc), null, 2);
          }

          textarea.onChange((v) => {
            try {
              config.textlintrc = JSON.stringify(JSON.parse(v));
              this.saveTextlintConfig(config);
              new Notice('Saved');
            } catch (e) {
              new Notice(e.message);
            }
          });
        })
        .setName('textlintrc');

      new Setting(el)
        .addText((text) => {
          text.setValue(config.textlintrcPath).onChange(async (v) => {
            config.textlintrcPath = v;
            this.saveTextlintConfig(config);
          });
        })
        .setName('load json from file')
        .addButton((button) => {
          button.setButtonText('Load').onClick(async () => {
            new Notice('Load textlintrc from: ' + config.textlintrcPath);
            config.textlintrc = JSON.stringify(JSON.parse(await parse(config.textlintrcPath)));

            new Notice('textlintrc loaded.');
            this.saveTextlintConfig(config);

            if (textlintrc.controlEl.firstChild) {
              // @ts-expect-error
              textlintrc.controlEl.firstChild.value = JSON.stringify(JSON.parse(config.textlintrc), null, 2);
            }
          });
        });

      new Setting(el).addButton((button) => {
        button.setButtonText('Remove').onClick(async () => {
          this.plugin.settings.textlintConfigs.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        });
      });
    };

    this.textlintConfigs.forEach((c, i) => {
      addConfigEl(c, i);
    });

    const addBtn = new Setting(configEl).addButton((button) => {
      button.setButtonText('Add').onClick(async () => {
        this.textlintConfigs.push({ folder: '', textlintrcPath: '', textlintrc: '' });
        this.display();
      });
    });
    addBtn.settingEl.style.border = 'none';
  }
}
