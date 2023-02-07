import { EditorView } from '@codemirror/view';

export const getTheme = () => {
  // return EditorView.theme();
  return EditorView.theme({
    '.cm-tooltip': {
      backgroundColor: 'var(--background-primary)',
    },
    '.cm-lintRange': { paddingBottom: '0' },
    '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '1px solid var(--color-red)' },
    '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '1px solid var(--color-orange)' },
    '.cm-lintRange-info': { backgroundImage: 'none', borderBottom: '1px solid var(--color-cyan)' },
  });
};
