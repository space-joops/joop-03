import packageJson from "../package.json";

export function VersionBadge() {
  return (
    <div
      title={`joop-03 v${packageJson.version}`}
      className="fixed bottom-2 right-2 z-50 select-none rounded bg-black/5 px-2 py-1 font-mono text-[10px] text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
    >
      v{packageJson.version}
    </div>
  );
}
