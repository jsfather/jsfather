'use client';
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal, useFormStatus } from 'react-dom';
import { Check, Copy, X, Trash2 } from 'lucide-react';
import type { ActionState } from '@/actions';

type Props = {
  trigger: string;
  confirmation: string;
  description: string;
  inputLabel?: string;
  action?: (state: ActionState, form: FormData) => Promise<ActionState>;
  onConfirm?: () => void;
  children?: ReactNode;
  disabled?: boolean;
  iconOnly?: boolean;
};
export function ConfirmationDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={props.iconOnly ? 'icon-button' : 'button danger'}
        disabled={props.disabled}
        aria-label={props.trigger}
        onClick={() => setOpen(true)}
      >
        {props.iconOnly ? <Trash2 size={16} /> : props.trigger}
      </button>
      {open &&
        createPortal(
          <ConfirmationModal
            {...props}
            close={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}
function ConfirmationModal({ close, ...props }: Props & { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId(),
    description = useId();
  const [state, action] = useActionState(
    props.action ??
      (async (_state: ActionState, form: FormData) => {
        if (form.get('confirmation') !== props.confirmation)
          return { error: 'Enter the exact confirmation text.' };
        props.onConfirm?.();
        return { success: 'Removed.' };
      }),
    {},
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (state.success) close();
  }, [state.success, close]);
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onClose={close}
    >
      <form action={action} onSubmit={(event) => event.stopPropagation()}>
        <ConfirmationBody
          {...props}
          close={close}
          dialog={dialog}
          titleId={title}
          descriptionId={description}
          state={state}
        />
      </form>
    </dialog>
  );
}
function ConfirmationBody({
  close,
  dialog,
  titleId,
  descriptionId,
  state,
  ...props
}: Props & {
  close: () => void;
  dialog: React.RefObject<HTMLDialogElement | null>;
  titleId: string;
  descriptionId: string;
  state: ActionState;
}) {
  const { pending } = useFormStatus();
  const [value, setValue] = useState(''),
    [copied, setCopied] = useState(false),
    [copyMessage, setCopyMessage] = useState('');
  const text = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  useEffect(() => {
    const element = dialog.current;
    const cancel = (event: Event) => {
      if (pending) event.preventDefault();
    };
    element?.addEventListener('cancel', cancel);
    return () => element?.removeEventListener('cancel', cancel);
  }, [pending, dialog]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.confirmation);
      setCopied(true);
      setCopyMessage('');
    } catch {
      if (text.current) {
        const range = document.createRange();
        range.selectNodeContents(text.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopyMessage('Text selected. Press Ctrl+C or ⌘C to copy.');
    }
  }
  return (
    <>
      <button
        type="button"
        className="icon-button confirmation-close"
        aria-label="Close confirmation"
        disabled={pending}
        onClick={close}
      >
        <X size={22} />
      </button>
      <h2 id={titleId}>Are you absolutely sure?</h2>
      <p id={descriptionId} className="muted confirmation-description">
        {props.description}
      </p>
      <div className="confirmation-instruction">
        <span>To confirm, type</span>
        <div className="confirmation-copy">
          <code ref={text} dir="auto">
            {props.confirmation}
          </code>
          <button
            type="button"
            className={`icon-button confirmation-copy-button${copied ? ' is-copied' : ''}`}
            aria-label={copied ? 'Confirmation text copied' : 'Copy confirmation text'}
            onClick={copy}
          >
            {copied ? <Check size={18} key="check" /> : <Copy size={18} key="copy" />}
          </button>
        </div>
        <span>in the box below:</span>
      </div>
      {copyMessage && (
        <span className="field-hint" role="status">
          {copyMessage}
        </span>
      )}
      <label className="field">
        <span>{props.inputLabel ?? 'Confirmation text'}</span>
        {props.confirmation.includes('\n') ? (
          <textarea
            autoFocus
            name="confirmation"
            required
            autoComplete="off"
            rows={3}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter the text to confirm"
            disabled={pending}
          />
        ) : (
          <input
            autoFocus
            name="confirmation"
            required
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter the text to confirm"
            disabled={pending}
          />
        )}
      </label>
      {props.children}
      {state.error && (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      )}
      <div className="confirmation-actions">
        <button type="button" className="button secondary" disabled={pending} onClick={close}>
          Cancel
        </button>
        <button
          type="submit"
          className="button danger"
          disabled={pending || value !== props.confirmation}
        >
          {pending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </>
  );
}
