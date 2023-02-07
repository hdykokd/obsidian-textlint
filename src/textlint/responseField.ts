import { EditorState, StateEffect, StateField, Transaction } from '@codemirror/state';
import { TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';

type State = {
  lastUpdateTime: number;
  response: TextlintWorkerCommandResponseLint['result'];
};

const getDefaultState = (): State => {
  return {
    lastUpdateTime: new Date().getTime(),
    response: { filePath: '', messages: [] },
  };
};

export const textlintResponseEffect = StateEffect.define<State['response']>();
export const resetTextlintResponseEffect = StateEffect.define();

export const textlintResponseField = StateField.define<State>({
  create(state: EditorState): State {
    return getDefaultState();
  },
  update(oldValue: State, transaction: Transaction): State {
    let response = oldValue;

    for (const effect of transaction.effects) {
      if (effect.is(resetTextlintResponseEffect)) {
        response = getDefaultState();
      }
      if (effect.is(textlintResponseEffect)) {
        response = {
          lastUpdateTime: new Date().getTime(),
          response: effect.value,
        };
      }
    }
    return response;
  },
});
