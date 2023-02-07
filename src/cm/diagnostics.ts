import { Diagnostic } from '@codemirror/lint';
import { TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';
import TextlintPlugin from '../main';
import { getActiveEditor, getEditorView, textlintSeverityToDiagnosticSeverity } from '../util';

export const getDiagnostics = (
  plugin: TextlintPlugin,
  messages: TextlintWorkerCommandResponseLint['result']['messages'],
): Diagnostic[] => {
  const editor = getActiveEditor(plugin);
  if (!editor) return [];

  const cm = getEditorView(editor);

  const diagnostics: Diagnostic[] = [];

  messages.forEach((message) => {
    if (message.severity < plugin.settings.minimumSeverityInEditingView) return;

    const [from, to] = message.range;
    const diagnostic: Diagnostic = {
      from,
      to,
      severity: textlintSeverityToDiagnosticSeverity(message.severity),
      source: '[textlint] ' + message.ruleId,
      message: `${message.message} [${message.loc.start.line}, ${message.loc.start.column}]`,
      renderMessage: () => {
        // diagnostic.actionsだとfixした後もdiagnosticが消えなくて変なので自前で作る
        // しかし微妙
        const item = document.createElement('span');
        item.setText(message.message);
        item.style.display = 'flex';
        item.style.flexDirection = 'row';

        const fix = message.fix;
        if (fix) {
          const fixBtn = document.createElement('button');
          fixBtn.style.marginLeft = '0.5em';
          fixBtn.setText('Fix');
          const [from, to] = fix.range;

          const oldText = cm.state.sliceDoc(from, to);
          fixBtn.onClickEvent(() => {
            fixBtn.setText('Fixing...');
            fixBtn.setAttribute('disabled', '');
            const changes = { changes: { from, to, insert: fix.text } };
            cm.dispatch(changes);

            setTimeout(() => {
              if (cm.state.sliceDoc(from, to) !== oldText) {
                fixBtn.setText('Fixed!');
                item.parentElement?.parentElement?.remove();
              } else {
                fixBtn.setText('Fix');
                fixBtn.removeAttribute('disabled');
              }
            }, 1000);
          });
          item.appendChild(fixBtn);
        }
        return item;
      },
    };
    diagnostics.push(diagnostic);
  });
  return diagnostics;
};
