export default function Loading() {
  return (
    <div aria-label="Loading your university" role="status">
      <div className="loading-line" style={{ width: '30%', height: 32 }} />
      <div className="loading-line" style={{ width: '45%', marginTop: 16 }} />
      <div className="skeleton-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="loading-card" />
        ))}
      </div>
    </div>
  );
}
