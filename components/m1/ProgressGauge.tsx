export default function ProgressGauge({ percent = 62, total = 1284000 }) {
  // Generate segments for the gauge bar
  const totalSegments = 20;
  const filledSegments = Math.round((percent / 100) * totalSegments);

  return (
    <div className="panel-bezel p-5 mx-4 flex flex-col gap-3 rounded-md bg-surface">
      <div className="flex justify-between items-end">
        <h2 className="text-sm font-body text-muted uppercase tracking-wider">
          Total Cleaned
        </h2>
        <span className="font-display text-2xl text-primary crt-glow-primary">
          {percent}%
        </span>
      </div>
      
      {/* Cassette Futurism style segmented progress bar */}
      <div className="flex gap-[2px] h-6">
        {Array.from({ length: totalSegments }).map((_, i) => (
          <div 
            key={i}
            className={`flex-1 ${i < filledSegments ? 'bg-primary' : 'bg-background border border-muted/30'}`}
            style={{
              boxShadow: i < filledSegments ? '0 0 5px rgba(57, 255, 20, 0.5)' : 'none'
            }}
          />
        ))}
      </div>

      <div className="flex justify-between items-center mt-1">
        <span className="font-mono text-xl text-secondary crt-glow-secondary">
          {total.toLocaleString()}
        </span>
        <span className="text-xs text-muted">Debris Collected</span>
      </div>
    </div>
  );
}
