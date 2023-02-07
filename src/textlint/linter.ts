import { TextlintWorker, WorkerManager } from './worker';

let lintTimer: ReturnType<typeof setTimeout>;

export const runLint = (worker: TextlintWorker, text: string) => {
  clearTimeout(lintTimer);
  lintTimer = setTimeout(() => {
    run(worker, text);
  }, 100);
};

const run = (worker: TextlintWorker, text: string) => {
  WorkerManager.postLintTextToWorker(worker, text);
};
