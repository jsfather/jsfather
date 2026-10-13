'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2 } from 'lucide-react';

const subscribeSupport = () => () => {};
const speechSupport = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function WordPronunciation({
  word,
  ipa,
  persian,
}: {
  word: string;
  ipa: string;
  persian: string;
}) {
  const supported = useSyncExternalStore(subscribeSupport, speechSupport, () => null);
  const [error, setError] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    return () => {
      if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);
  function speak(slow: boolean) {
    if (!supported) return;
    setError('');
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(word);
    const voices = window.speechSynthesis.getVoices();
    speech.voice =
      voices.find((v) => /^en[-_]US$/i.test(v.lang)) ??
      voices.find((v) => /^en\b/i.test(v.lang)) ??
      null;
    speech.lang = speech.voice?.lang ?? 'en-US';
    speech.rate = slow ? 0.65 : 0.9;
    speech.onend = () => {
      if (utterance.current === speech) utterance.current = null;
    };
    speech.onerror = (event) => {
      if (utterance.current === speech) utterance.current = null;
      if (event.error !== 'canceled' && event.error !== 'interrupted')
        setError('English audio is unavailable on this device. Use the pronunciation guide.');
    };
    utterance.current = speech;
    window.speechSynthesis.speak(speech);
  }
  return (
    <div className="word-pronunciation">
      {ipa && (
        <div className="word-pronunciation-line">
          <span className="word-pronunciation-label">English · US IPA</span>
          <span lang="en" dir="ltr" className="word-pronunciation-ipa">
            {ipa}
          </span>
        </div>
      )}
      {persian && (
        <div className="word-pronunciation-line" lang="fa" dir="rtl">
          <span className="word-pronunciation-label">تلفظ فارسی (تقریبی)</span>
          <span className="word-pronunciation-persian" title="بخش داخل «» را با تأکید بخوانید.">
            {persian}
          </span>
        </div>
      )}
      <div className="word-pronunciation-actions">
        <button
          type="button"
          disabled={!supported}
          aria-label={`Listen to ${word} in English`}
          onClick={() => speak(false)}
        >
          <Volume2 size={14} aria-hidden="true" /> Listen <span lang="fa">بشنوید</span>
        </button>
        <button
          type="button"
          disabled={!supported}
          aria-label={`Listen slowly to ${word} in English`}
          onClick={() => speak(true)}
        >
          Slow <span lang="fa">آهسته</span>
        </button>
      </div>
      {supported === false && <p className="field-hint">Audio is not supported in this browser.</p>}
      {error && (
        <p role="status" className="field-hint">
          {error}
        </p>
      )}
    </div>
  );
}

export function PronunciationHelp() {
  return (
    <details className="pronunciation-help">
      <summary>Pronunciation guide · راهنمای تلفظ</summary>
      <p>
        IPA shows US English pronunciation. Different pronunciations are separated by ·. Audio uses
        the English voices available on your device.
      </p>
      <p lang="fa" dir="rtl">
        آوانویسی فارسی تقریبی است. بخش داخل «» را با تأکید بخوانید؛ خط «ـ» مرز هجاها را نشان می‌دهد.
        برای صدای دقیق به تلفظ انگلیسی گوش دهید. «ث» نمایندهٔ th بی‌صدا و «ذ» نمایندهٔ th صدادار
        است: نوک زبان بین دندان‌ها قرار می‌گیرد. برای w لب‌ها را گرد کنید و دندان‌ها را به لب نزنید.
      </p>
    </details>
  );
}
