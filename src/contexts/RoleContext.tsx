import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import { storage } from "@/src/utils/storage";
import { getToken } from "@/src/utils/authToken";
import { getCurrentUser } from "@/src/utils/currentUser";
import { getGroups } from "@/src/services/groups";
import { Role } from "@/src/types";

type Permission =
  | "approve.loan"
  | "approve.withdrawal"
  | "approve.rule"
  | "approve.shareout"
  | "edit.rules"
  | "disburse.loan"
  | "remove.member"
  | "propose.rule"
  | "vote";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  can: (p: Permission) => boolean;
  description: string;
  /** True while the first server derivation is still in flight. */
  loading: boolean;
  /** Re-read the role from the user's group memberships. */
  refresh: () => Promise<void>;
  /** Whether this account may use the demo role switcher. */
  isTester: boolean;
}

const STORAGE_KEY = "chuma.demo.role";

/** The seeded account allowed to override its role by hand (see profile.tsx). */
export const TESTER_PHONE = "260975988642";

const ROLES: Role[] = ["Chairperson", "Treasurer", "Secretary", "Member"];

/** Most senior first — a user's app-wide role is the best one they hold anywhere. */
const SENIORITY: Role[] = ["Chairperson", "Treasurer", "Secretary", "Member"];

const RULES: Record<Role, Permission[]> = {
  Chairperson: [
    "approve.loan",
    "approve.withdrawal",
    "approve.rule",
    "approve.shareout",
    "edit.rules",
    "remove.member",
    "propose.rule",
    "vote",
  ],
  Treasurer: ["approve.loan", "approve.withdrawal", "disburse.loan", "propose.rule", "vote"],
  Secretary: ["approve.loan", "approve.rule", "propose.rule", "vote"],
  Member: ["propose.rule", "vote"],
};

const DESCRIPTIONS: Record<Role, string> = {
  Chairperson: "Final say on loans, rules, share-outs and member removal.",
  Treasurer: "Co-signs withdrawals, disburses approved loans, owns financial reports.",
  Secretary: "Keeps records, sends reminders, manages the member roster.",
  Member: "Saves, borrows, repays and votes on proposals.",
};

const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);

const digitsOf = (phone?: string) => String(phone ?? "").replace(/\D/g, "");

/** Highest role held across every group the user is an active member of. */
function highestRole(roles: Role[]): Role {
  for (const r of SENIORITY) if (roles.includes(r)) return r;
  return "Member";
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>("Member");
  const [loading, setLoading] = useState(true);
  const [isTester, setIsTester] = useState(false);
  // Guards against two refreshes (mount + tab layout) racing to set the role.
  const inFlight = useRef<Promise<void> | null>(null);

  const derive = useCallback(async () => {
    try {
      const user = await getCurrentUser<{ phone?: string }>();
      const tester = digitsOf(user?.phone) === TESTER_PHONE;
      setIsTester(tester);

      // The demo switcher is a testing tool: only the seeded account's manual
      // override survives. Everyone else follows their real memberships.
      if (tester) {
        const saved = await storage.getItem<string>(STORAGE_KEY, "");
        if (isRole(saved)) {
          setRoleState(saved);
          return;
        }
      }

      // Logged out (welcome / OTP screens) — no call, so no 401 redirect loop.
      const token = await getToken();
      if (!token) {
        setRoleState("Member");
        return;
      }

      const groups = await getGroups();
      setRoleState(highestRole(groups.map((g) => g.yourRole).filter(isRole)));
    } catch {
      // Offline or a failed fetch must not escalate privileges — stay a Member.
      setRoleState("Member");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const p = derive().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = p;
    return p;
  }, [derive]);

  useEffect(() => {
    refresh();
    // Re-derive on foreground so a promotion made elsewhere lands without a
    // reinstall (roles change rarely, so this is cheap enough).
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Manual override, testers only — persisted so it survives a reload.
  const setRole = useCallback(
    (r: Role) => {
      if (!isTester) return;
      setRoleState(r);
      storage.setItem(STORAGE_KEY, r);
    },
    [isTester],
  );

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      can: (p: Permission) => RULES[role].includes(p),
      description: DESCRIPTIONS[role],
      loading,
      refresh,
      isTester,
    }),
    [role, setRole, loading, refresh, isTester],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
};
