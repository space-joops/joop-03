import Image from "next/image";

export default function RankingList() {
  const rankings = [
    { rank: 1, name: "Orbita", score: "1,245K", change: "up", diff: 2 },
    { rank: 2, name: "Dusty", score: "980K", change: "down", diff: 1 },
    { rank: 3, name: "Nova", score: "812K", change: "same", diff: 0 },
  ];

  return (
    <div className="panel-bezel p-5 mx-4 mt-4 mb-4 rounded-md bg-surface flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-muted/30 pb-2">
        <h2 className="text-sm font-body text-muted uppercase tracking-wider">
          System Rankings
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Weekly Trend</span>
          {/* Sparkline Placeholder */}
          <div className="flex items-end h-4 gap-[1px]">
            <div className="w-1.5 h-1 bg-secondary opacity-50"></div>
            <div className="w-1.5 h-2 bg-secondary opacity-70"></div>
            <div className="w-1.5 h-1.5 bg-secondary opacity-60"></div>
            <div className="w-1.5 h-3 bg-secondary opacity-90"></div>
            <div className="w-1.5 h-4 bg-secondary crt-glow-secondary"></div>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {rankings.map((user) => (
          <li key={user.rank} className="flex justify-between items-center font-mono text-sm">
            <div className="flex items-center gap-3">
              <span className="w-4 text-muted">{user.rank}.</span>
              <span className="text-fg truncate max-w-[100px]">{user.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-secondary">{user.score}</span>
              <span className="w-8 flex justify-end items-center gap-1">
                {user.change === 'up' && <Image src="/ui/arrow-up.svg" alt="Up" width={12} height={12} />}
                {user.change === 'down' && <Image src="/ui/arrow-down.svg" alt="Down" width={12} height={12} />}
                <span className={user.change === 'up' ? 'text-success' : user.change === 'down' ? 'text-danger' : 'text-muted'}>
                  {user.change !== 'same' ? user.diff : '-'}
                </span>
              </span>
            </div>
          </li>
        ))}
        {/* User's own ranking placeholder (if logged in) */}
        <li className="flex justify-between items-center font-mono text-sm mt-2 pt-2 border-t border-dashed border-muted/50 text-primary">
          <div className="flex items-center gap-3">
            <span className="w-4">37.</span>
            <span className="truncate max-w-[100px]">You</span>
          </div>
          <div className="flex items-center gap-3">
            <span>20K</span>
            <span className="w-8 flex justify-end items-center gap-1 text-success">
              <Image src="/ui/arrow-up.svg" alt="Up" width={12} height={12} />
              5
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}
