import Image from "next/image";

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-4 py-4 border-b-2 border-surface bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-2">
        <Image src="/brand/logo-symbol.svg" alt="Joops Symbol" width={32} height={32} />
        <Image src="/brand/logo-wordmark.svg" alt="JOOPS" width={100} height={30} className="mt-1" />
      </div>
      <button className="flex items-center gap-2 px-3 py-1.5 border-2 border-muted rounded-sm text-sm hover:border-primary hover:text-primary transition-colors bg-surface">
        <Image src="/ui/icon-language.svg" alt="Language" width={18} height={18} className="opacity-80" />
        <span className="font-mono">EN</span>
      </button>
    </header>
  );
}
