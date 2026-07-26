import { requireAdmin } from "@/lib/admin/auth";
import { getGameConfigRows } from "@/lib/game-config";
import {
  CONFIG_SPECS,
  CONFIG_SPEC_BY_KEY,
  coerceConfigNumber,
  type ConfigGroup,
} from "@/lib/config-specs";
import { AdminConfigForm, type ConfigFieldView } from "@/components/admin/config-form";
import {
  mutedTextClass,
  panelClass,
  panelStyle,
  tableClass,
  tdClass,
  thClass,
  cellBorderStyle,
  formatDateTime,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const GROUPS: ConfigGroup[] = ["orbital", "minigame", "space", "launch"];

export default async function AdminConfigPage() {
  await requireAdmin();

  const rows = await getGameConfigRows();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const fields: ConfigFieldView[] = CONFIG_SPECS.map((spec) => {
    const row = byKey.get(spec.key);
    return {
      spec,
      value: row ? coerceConfigNumber(spec, row.value) : spec.fallback,
      unset: !row,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  // 레지스트리에 없는 키 — 숨기면 존재 자체를 모르게 되므로 읽기 전용으로 드러낸다.
  const unknown = rows.filter((r) => !CONFIG_SPEC_BY_KEY.has(r.key));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-lg font-semibold text-[var(--color-fg)]">게임 설정</h1>
        <p className={`mt-1 ${mutedTextClass}`}>
          운영 파라미터를 조정합니다(FR-10.1 / FR-10.2). &ldquo;재시작 시 반영&rdquo; 항목은 진행
          중인 게임에는 적용되지 않고, 플레이어가 화면에 다시 들어와야 반영됩니다.
        </p>
      </div>

      {GROUPS.map((group) => (
        <AdminConfigForm
          key={group}
          group={group}
          fields={fields.filter((f) => f.spec.group === group)}
        />
      ))}

      {unknown.length > 0 && (
        <details className={panelClass} style={panelStyle}>
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
            레지스트리에 없는 키 ({unknown.length})
          </summary>
          <p className={`mt-3 ${mutedTextClass}`}>
            코드가 참조하지 않는 값일 수 있습니다. 화면에서 편집하려면 lib/config-specs.ts 에
            스펙을 추가하세요.
          </p>
          <table className={`mt-3 ${tableClass}`}>
            <thead>
              <tr>
                <th className={thClass} style={cellBorderStyle}>
                  키
                </th>
                <th className={thClass} style={cellBorderStyle}>
                  값
                </th>
                <th className={thClass} style={cellBorderStyle}>
                  수정
                </th>
              </tr>
            </thead>
            <tbody>
              {unknown.map((r) => (
                <tr key={r.key}>
                  <td className={tdClass} style={cellBorderStyle}>
                    {r.key}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {JSON.stringify(r.value)}
                  </td>
                  <td className={tdClass} style={cellBorderStyle}>
                    {formatDateTime(r.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
