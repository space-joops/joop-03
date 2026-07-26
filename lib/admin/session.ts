import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// 관리자 세션 = 환경변수 비밀번호로 로그인하고, HMAC 서명된 httpOnly 쿠키로 유지한다.
//
// 왜 Supabase Auth 가 아닌가: 게임 사용자는 전부 익명 세션(signInAnonymously)이라
// "이 사람이 관리자다"를 식별할 수단이 없고, ADR-0004 의 정식 로그인 수단은 아직 미정이다.
// 운영자는 게임 플레이어가 아니므로 신원 체계를 아예 분리하는 편이 단순하고 안전하다.
// 관리자가 여러 명이 되면 joop_03_admins 테이블 + 개인 계정으로 승격한다.

export const ADMIN_COOKIE = "joop_03_admin";
/** 쿠키를 /admin 으로 스코프해 게임 페이지 요청에는 아예 실려가지 않게 한다. */
export const ADMIN_COOKIE_PATH = "/admin";

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12시간
const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

export type AdminSession = { v: 1; iat: number; exp: number };

type AdminConfig = { password: string; secret: string; ttlSeconds: number };

let warned = false;

/**
 * 관리자 설정을 읽는다. 하나라도 없거나 너무 짧으면 null → 콘솔 전체가 잠긴다(fail-closed).
 *
 * ⚠️ 모듈 최상단이 아니라 함수 안에서 읽는다. 최상단에서 throw 하면 이 모듈을 import 하는
 *    빌드 자체가 깨진다.
 */
function getAdminConfig(): AdminConfig | null {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";

  if (password.length < MIN_PASSWORD_LENGTH || secret.length < MIN_SECRET_LENGTH) {
    if (!warned) {
      warned = true;
      console.error(
        "[admin] ADMIN_PASSWORD(12자 이상)/ADMIN_SESSION_SECRET(32자 이상)이 설정되지 않아 관리자 콘솔이 잠깁니다.",
      );
    }
    return null;
  }

  const ttl = Number(process.env.ADMIN_SESSION_TTL_SECONDS);
  return {
    password,
    secret,
    ttlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS,
  };
}

/**
 * 서명 키 = HMAC(SECRET, sha256(PASSWORD)).
 *
 * SECRET 에서 키 엔트로피를 얻으므로 비밀번호가 약해도 서명은 안전하고, 동시에
 * 비밀번호를 바꾸면 키가 바뀌어 기존 세션이 전부 무효화된다. 쿠키에는 비밀번호에서
 * 유도된 값이 실리지 않으므로 쿠키가 유출돼도 비밀번호를 역산할 수 없다.
 */
function deriveKey(cfg: AdminConfig): Buffer {
  const passwordHash = createHash("sha256").update(cfg.password, "utf8").digest("hex");
  return createHmac("sha256", cfg.secret).update(`joop-03/admin/v1|${passwordHash}`).digest();
}

/** 길이가 달라도 예외가 나지 않고 길이 자체도 유출하지 않는 문자열 비교. */
function safeEqualUtf8(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export type PasswordCheck = "ok" | "invalid" | "config";

export function verifyPassword(input: string): PasswordCheck {
  const cfg = getAdminConfig();
  if (!cfg) return "config";
  return safeEqualUtf8(input, cfg.password) ? "ok" : "invalid";
}

/** `v1.<payload>.<signature>` — 서명 대상에 버전 접두사를 포함해 포맷 혼동을 막는다. */
function signAdminToken(): string | null {
  const cfg = getAdminConfig();
  if (!cfg) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSession = { v: 1, iat: now, exp: now + cfg.ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", deriveKey(cfg)).update(`v1.${encoded}`).digest("base64url");

  return `v1.${encoded}.${signature}`;
}

/**
 * 토큰 검증. 어떤 입력에도 예외를 던지지 않고 실패는 전부 null 이다
 * (레이아웃 렌더 중 500 이 뜨면 안 된다).
 */
export function verifyAdminToken(token: string): AdminSession | null {
  const cfg = getAdminConfig();
  if (!cfg) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, encoded, signature] = parts;

  const expected = createHmac("sha256", deriveKey(cfg)).update(`v1.${encoded}`).digest();
  const actual = Buffer.from(signature, "base64url");
  // timingSafeEqual 은 길이가 다르면 throw 하므로 먼저 막는다.
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload?.v !== 1 || typeof payload.exp !== "number") return null;
    // 만료는 쿠키의 maxAge 가 아니라 서명된 exp 만 신뢰한다(maxAge 는 클라가 조작 가능).
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload as AdminSession;
  } catch {
    return null;
  }
}

/** 로그인 성공 시 쿠키 발급. Server Action / Route Handler 에서만 호출 가능. */
export async function setAdminCookie(): Promise<boolean> {
  const token = signAdminToken();
  if (!token) return false;

  const session = verifyAdminToken(token);
  if (!session) return false;

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_COOKIE_PATH,
    maxAge: session.exp - Math.floor(Date.now() / 1000),
  });
  return true;
}

/**
 * 로그아웃.
 * ⚠️ delete() 는 기본 path("/")로 지우려 해서 /admin 스코프 쿠키가 안 지워진다.
 *    반드시 같은 path 로 빈 값 + maxAge 0 을 심어야 한다.
 */
export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_COOKIE_PATH,
    maxAge: 0,
  });
}

export async function readAdminCookie(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
