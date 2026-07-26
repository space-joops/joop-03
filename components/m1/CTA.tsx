import Link from "next/link";

export default function CTA() {
  return (
    <div className="px-4 mt-auto mb-8">
      <Link href="/onboarding" className="w-full relative group block text-center">
        {/* Physical button shadow/bezel */}
        <div className="absolute inset-0 bg-primary/20 translate-y-1 rounded-sm border border-primary/50"></div>
        <div className="relative bg-surface border-2 border-primary text-primary font-display text-lg py-4 px-6 rounded-sm uppercase tracking-widest transition-transform active:translate-y-1 active:bg-primary active:text-background crt-glow-primary group-hover:bg-primary/10">
          Start with Invite Code
        </div>
      </Link>
    </div>
  );
}
