import { Notice } from 'obsidian';
import type { TextlintResult } from '@textlint/types';
import type { TextlintWorkerCommandResponse, TextlintWorkerCommandResponseLint } from '@textlint/script-compiler';

// @ts-expect-error
import Worker from '../../dist/textlint-worker.worker.js';

export type TextlintWorker = Worker;

type WorkerResponseType = TextlintWorkerCommandResponseLint['command'];
// type WorkerResponseType = TextlintWorkerCommandResponseLint['command'] | TextlintWorkerCommandResponseFix['command'];
type WorkerResponseCallbacks = Record<WorkerResponseType, (result: TextlintResult) => void>;

export class WorkerManager {
  private workers: Record<string, TextlintWorker> = {};

  constructor() {}

  public terminate() {
    console.log('[textlint worker]: terminating...');
    Object.keys(this.workers).forEach((k) => {
      this.workers[k].terminate();
    });
    this.workers = {};
  }

  private newWorker(textlintrc: string): TextlintWorker {
    const worker = new Worker();
    try {
      worker.postMessage({
        command: 'merge-config',
        textlintrc: JSON.parse(textlintrc),
      });
      return worker;
    } catch (e) {
      new Notice('[textlint]: failed to merge-config. error:' + e.message);
    }
  }

  private registerOnmessageCallbacks(worker: TextlintWorker, callbacks: WorkerResponseCallbacks) {
    try {
      worker.onmessage = ({ data }: { data: TextlintWorkerCommandResponse }) => {
        if (data.command === 'error') {
          const msg = '[textlint worker]: failed to execute worker. error: ';
          console.error(msg, data);
          new Notice(msg + JSON.stringify(data.error));
        } else if (data.command === 'lint:result') {
          callbacks[data.command](data.result);
        }
        // else if (data.command === 'fix:result') {
        //   callbacks[data.command](data.result);
        // }
      };
    } catch (e) {
      console.log('[textlint worker]: failed to register worker.onmessage()', e);
    }
  }

  public registerWorker(folder: string, textlintrc: string, callbacks: WorkerResponseCallbacks) {
    if (!folder) {
      console.log('[textlint worker]: Could not register worker. folder is empty');
      return;
    }
    if (!textlintrc) {
      console.log('[textlint worker]: Could not register worker. textlintrc is empty');
      return;
    }
    const worker = this.newWorker(textlintrc);
    this.registerOnmessageCallbacks(worker, callbacks);
    this.workers[folder] = worker;
  }

  public getWorker(folder: string): TextlintWorker {
    const worker = this.workers[folder];
    if (!worker) {
      throw new Error('textlint worker is not registered');
    }
    return worker;
  }

  static postLintTextToWorker(worker: TextlintWorker, text: string) {
    try {
      worker.postMessage({
        command: 'lint',
        text: text,
        ext: '.md',
      });
    } catch (e) {
      console.log('[textlint worker]: failed to execute worker.postMessage(). command: "lint"', e);
    }
  }
}
