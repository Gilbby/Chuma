import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { storage } from "@/src/utils/storage";
import { Role } from "@/src/data/mock";

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
}

const STORAGE_KEY = "chuma.demo.role";

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

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>("Chairperson");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, "Chairperson");
      if (saved === "Chairperson" || saved === "Treasurer" || saved === "Secretary" || saved === "Member") {
        setRoleState(saved);
      }
    })();
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    storage.setItem(STORAGE_KEY, r);
  };

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      can: (p: Permission) => RULES[role].includes(p),
      description: DESCRIPTIONS[role],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
};
