import fs from 'fs';
import path from 'path';

const file = 'packages/arcade-engine/src/components/ArcadeGame.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Next.js and app imports
content = content.replace(/import Link from "next\/link";\n/g, '');
content = content.replace(/import \{ useRouter \} from "next\/navigation";\n/g, '');
content = content.replace(/import \{\n  claimAdDockReward,\n  payShadowEntry,\n  submitArcadeResult,\n  type ArcadeRankingDelta,\n\} from "@\/app\/\[lang\]\/joop\/arcade\/actions";\n/g, '');
content = content.replace(/import \{ getAdDock, parseAdDocks, readAdDockSnapshot, recordAdDock \} from "@\/lib\/ad-docks";\n/g, '');
content = content.replace(/import \{ ChangeIndicator, RankingList \} from "@\/components\/ranking-list";\n/g, 'import { ChangeIndicator } from "./ChangeIndicator";\n');
content = content.replace(/import type \{ Dictionary \} from "@\/lib\/i18n\/dictionaries";\n/g, 'type Dictionary = any;\n');
content = content.replace(/import type \{ Locale \} from "@\/lib\/i18n\/config";\n/g, 'type Locale = any;\n');
content = content.replace(/import \{ trackArcadeCompleted \} from "@\/lib\/analytics";\n/g, '');

// 2. Fix internal imports
content = content.replace(/@\/lib\/arcade/g, '../core/arcade');
content = content.replace(/@\/lib\/minigame/g, '../core/minigame');
content = content.replace(/@\/lib\/debris-kinds/g, '../core/debris-kinds');
content = content.replace(/@\/components\/debris-icon/g, './DebrisIcon');
content = content.replace(/@\/components\/sound-toggle/g, './SoundToggle');
content = content.replace(/@\/lib\/sound/g, '../core/sound');
content = content.replace(/@\/components\/joop-sprite/g, './JoopSprite');
content = content.replace(/@\/lib\/joop-sprite/g, '../core/joop-sprite');
content = content.replace(/@\/lib\/ad-satellites/g, '../core/ad-satellites');

// 3. Define ArcadeRankingDelta
content = content.replace(/type Phase =/g, 'export type ArcadeRankingDelta = { rankBefore: number | null; rankAfter: number | null; };\ntype Phase =');

// 4. Update Props to include callbacks
content = content.replace(/export function ArcadeGame\(\{\n  lang,\n  dict,\n  color,\n  name,\n  config,\n  altitudeKm,\n  shadowGate,\n\}\: \{/g, `export interface ArcadeGameProps {
  lang: string;
  dict: any;
  color: string;
  name: string;
  config?: any;
  altitudeKm?: number;
  shadowGate?: ShadowGate;
  assetsBaseUrl?: string;
  onPayShadowEntry?: () => Promise<{ ok: boolean; xpLeft: number; error?: string }>;
  onSubmitArcadeResult?: (collected: number) => Promise<{ ok: boolean; collected: number; totalCollected: number; ranking?: ArcadeRankingDelta; error?: string }>;
  onClaimAdDockReward?: (id: string) => Promise<{ ok: boolean; code?: string }>;
  onMapClick?: () => void;
  getAdDock?: (id: string) => any;
  recordAdDock?: (id: string, code?: string) => void;
  getAdDockSnapshot?: () => string;
}

export function ArcadeGame({
  lang,
  dict,
  color,
  name,
  config,
  altitudeKm,
  shadowGate,
  assetsBaseUrl = "",
  onPayShadowEntry,
  onSubmitArcadeResult,
  onClaimAdDockReward,
  onMapClick,
  getAdDock,
  recordAdDock,
  getAdDockSnapshot,
}: ArcadeGameProps) {`);

// 5. Replace server action calls
content = content.replace(/const res = await payShadowEntry\(\);/g, 'if (!onPayShadowEntry) throw new Error("Missing onPayShadowEntry");\n      const res = await onPayShadowEntry();');
content = content.replace(/const res = await submitArcadeResult\(summary\.collected\);/g, 'if (!onSubmitArcadeResult) throw new Error("Missing onSubmitArcadeResult");\n      const res = await onSubmitArcadeResult(summary.collected);');
content = content.replace(/claimAdDockReward\(id\)/g, '(onClaimAdDockReward ? onClaimAdDockReward(id) : Promise.resolve({ ok: false }))');
content = content.replace(/recordAdDock\(/g, 'if (recordAdDock) recordAdDock(');
content = content.replace(/const existing = getAdDock\(id\);/g, 'const existing = getAdDock ? getAdDock(id) : null;');
content = content.replace(/parseAdDocks\(readAdDockSnapshot\(\)\)/g, '(getAdDockSnapshot ? [] : []) /* simplify for now, pass dockedBrands as prop later if needed, or just let engine assume empty on mount */');
content = content.replace(/trackArcadeCompleted/g, '// trackArcadeCompleted (handled outside now)');

// 6. Fix <Link href={`/${lang}/joop/map`}> to a <button> with onMapClick
content = content.replace(/<Link\n\s*href=\{\`\/\$\{lang\}\/joop\/map\`\}\n\s*className="absolute left-2 bottom-\[calc\(env\(safe-area-inset-bottom\)\+6\.5rem\)\] rounded-md border px-2\.5 py-1 font-mono text-\[10px\] uppercase tracking-widest"\n\s*style=\{\{ \.\.\.ghostStyle, background: "color-mix\(in srgb, var\(--color-bg\) 70%, transparent\)" \}\}\n\s*>\n\s*\{a\.toMap\}\n\s*<\/Link>/g, `<button
              onClick={() => onMapClick?.()}
              className="absolute left-2 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ ...ghostStyle, background: "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}
            >
              {a.toMap}
            </button>`);

// 7. Fix assets baseUrl
content = content.replace(/\["magnet", "\/game\/item-magnet\.svg"\]/g, '["magnet", `${assetsBaseUrl}/item-magnet.svg`]');

fs.writeFileSync(file, content);
