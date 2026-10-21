export type WordReviewCounts = {
  shown: number | null;
  successful: number | null;
  failed: number | null;
};

export function VocabularyReviewCounts({ counts }: { counts?: WordReviewCounts | null }) {
  return (
    <dl className="vocabulary-review-counts" aria-label="Your history for this word">
      <div>
        <dt>Shown in practice</dt>
        <dd>{counts?.shown ?? 0}</dd>
      </div>
      <div>
        <dt>Successful</dt>
        <dd>{counts?.successful ?? 0}</dd>
      </div>
      <div>
        <dt>Failed</dt>
        <dd>{counts?.failed ?? 0}</dd>
      </div>
    </dl>
  );
}
