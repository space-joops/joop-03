# 데이터 모델 (Supabase) — 초안

> ⚠️ **필수 규칙**: 이 프로젝트는 space-joops의 다른 프로젝트와 **공유하는 Supabase 프로젝트 `jd-04`** 를 씁니다. 모든 테이블·뷰·함수·버킷에 **`joop_03_` 접두사**를 붙여 충돌을 막습니다. ([infra.md](../infra.md) 참조)
>
> 이 문서는 **개념 스키마 초안**입니다. 실제 마이그레이션은 각 마일스톤에서 작성하며, 그때 컬럼 타입·인덱스·RLS를 확정합니다.

## 인증 주체

Supabase Auth의 `auth.users`를 신원의 근원으로 쓰고, 게임 프로필은 `joop_03_profiles`로 확장합니다(1:1). → [ADR-0004](./adr/0004-auth-invite.md)

## 테이블 개요

| 테이블 | 용도 | 도입 마일스톤 |
|---|---|---|
| `joop_03_profiles` | 사용자 게임 프로필 | M0/M2 |
| `joop_03_joops` | 줍스(로봇) 개체 | **M1** |
| `joop_03_debris_events` | 쓰레기 수거 이벤트(랭킹 소스) | **M1** |
| `joop_03_rankings_weekly` | 주간 랭킹/등락(뷰 또는 집계) | **M1** |
| `joop_03_invite_codes` | 초대 코드 | M2 |
| `joop_03_launch_vehicles` | 실 발사체 리스트 | M3 |
| `joop_03_launch_bookings` | 발사 청약·선별 | M3 |
| `joop_03_items` | 아이템 정의 | M6 |
| `joop_03_inventory` | 사용자 인벤토리 | M6 |
| `joop_03_upgrades` | 업그레이드 상태 | M6 |
| `joop_03_friendships` | 친구 관계 | M7 |
| `joop_03_game_config` | 운영 파라미터(key-value) | M1~(읽기), **M8(편집 UI 완료)** |

## M1 필수 테이블 (첫 화면)

### `joop_03_joops`
| 컬럼 | 타입(초안) | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK→auth.users | M1 시드는 null 허용(NPC 줍스) |
| `name` | text **unique** | FR-2.3 유니크 이름 |
| `color` | text | hex |
| `orbit_radius` | numeric | 궤도 반경(고도 정규화) |
| `orbit_inclination` | numeric | 궤도 경사(도) |
| `orbit_raan` | numeric | 승교점 경도(도) |
| `orbit_phase0` | numeric | 기준시각 초기 위상(rad) |
| `orbit_angular_velocity` | numeric | 각속도(rad/s) |
| `status` | text | `ground`\|`queued`\|`launching`\|`orbit` |
| `level` | int | 지상 미니게임 레벨 |
| `total_collected` | bigint | 누적 수거량(비정규화 캐시) |
| `created_at` | timestamptz | |

궤도 파라미터의 의미와 좌표 공식은 [orbit-model](./orbit-model.md) 참조. 첫 화면 시드는 `owner_id` 없는 100개 개체 + `status='orbit'`.

### `joop_03_debris_events`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigint PK | |
| `joop_id` | uuid FK→joop_03_joops | |
| `amount` | int | 수거 조각 수 |
| `occurred_at` | timestamptz | 주간 집계 기준 |

랭킹과 누적 청소량(FR-1.5/1.6)의 근거 데이터. `total_collected`는 이 이벤트의 캐시.

### `joop_03_rankings_weekly`
주간 순위와 등락(FR-1.7)을 위한 **뷰 또는 물리 집계 테이블**. 초안: `(joop_id, week, rank, prev_rank, collected_in_week)`. 성능에 따라 뷰→집계 테이블로 승격.

### `joop_03_game_config`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `key` | text PK | 예: `orbital_tick_seconds` |
| `value` | jsonb | 예: `10` |
| `updated_at` | timestamptz | |

M1은 `orbital_tick_seconds`(기본 10)를 읽기 전용으로 사용(FR-1.3/10.1). 편집 UI는 M8에서
`/admin/config`로 구현했습니다.

- 알려진 키의 라벨·타입·허용범위·폴백은 코드(`lib/config-specs.ts`)에 두고 서버에서 검증합니다.
  jsonb라 자유 편집이 가능하지만 오타 하나가 게임을 망가뜨리기 때문입니다.
- 조회는 `lib/game-config.ts`로 일원화되어 있습니다(`React.cache`).
- ⚠️ **공유 jd-04라 다른 워크스페이스가 넣은 키가 있을 수 있습니다.** 레지스트리에 없는 키는
  관리자 화면에서 읽기 전용으로 노출됩니다(숨기면 존재를 모르게 되므로).
- ⚠️ `minigame_max_debris_per_run` × `minigame_xp_per_debris`가 한 판 최대 XP이고
  `joop_03_joops.xp`는 int4입니다. 두 키의 상한은 함께 조정해야 합니다.

## RLS 방향 (초안)

- **공개 읽기**(첫 화면): `joop_03_joops`, `joop_03_debris_events`(집계), `joop_03_rankings_weekly` 는 **anon SELECT 허용**. 단, 이메일 등 민감 컬럼은 프로필에서 분리.
- **쓰기는 서버만**: 좌표/수거 이벤트 생성·집계는 `service_role`(서버 route/Server Action)에서만. anon 쓰기 금지.
- **본인 데이터**: `joop_03_profiles`, `joop_03_inventory` 등은 `auth.uid() = owner_id` 정책.
- 초대코드·청약 등 민감 로직은 서버에서 검증(→ 각 ADR/마일스톤).

## 시드 데이터 (M1)

- 줍스 100개(다양한 궤도 파라미터·색·이름) + 과거 `debris_events` 일부(랭킹·주간 등락이 비어 보이지 않게). 시드 스크립트는 M1 구현 시 `supabase/seed` 또는 마이그레이션에 포함.
