import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { useTheme } from "@/src/theme/ThemeContext";
import { useRole } from "@/src/contexts/RoleContext";
import { Crown, Shield, FileText, Vote, Edit3, Plus, Lock, X } from "lucide-react-native";

interface Rule {
  id: string;
  label: string;
  value: string;
  editable: boolean;
}

interface Threshold {
  id: string;
  label: string;
  value: string;
  editable: boolean;
}

interface Proposal {
  id: string;
  title: string;
  proposer: string;
  votesFor: number;
  totalVoters: number;
  status: "Open" | "Passed" | "Rejected";
}

const INITIAL_RULES: Rule[] = [
  { id: "r1", label: "Contribution amount", value: "K 500 weekly", editable: true },
  { id: "r2", label: "Loan interest", value: "5% per month", editable: true },
  { id: "r3", label: "Loan max", value: "3× member savings", editable: true },
  { id: "r4", label: "Late penalty", value: "K 50 per missed cycle", editable: true },
  { id: "r5", label: "Quorum for approval", value: "60% of voting members", editable: true },
  { id: "r6", label: "Share-out frequency", value: "Annually (December)", editable: false },
];

const INITIAL_THRESHOLDS: Threshold[] = [
  { id: "t1", label: "Loan approval", value: "60%", editable: true },
  { id: "t2", label: "Withdrawal", value: "50% + Treasurer", editable: true },
  { id: "t3", label: "Rule change", value: "75%", editable: true },
  { id: "t4", label: "Removing a member", value: "80% + Chairperson", editable: true },
];

const INITIAL_PROPOSALS: Proposal[] = [
  { id: "p1", title: "Lower interest rate to 4%", proposer: "John Mwale", votesFor: 5, totalVoters: 12, status: "Open" },
  { id: "p2", title: "Add monthly contribution option", proposer: "Mwansa Tembo", votesFor: 8, totalVoters: 12, status: "Open" },
];

const ADMINS = [
  { name: "Gilbert (you)", role: "Chairperson", icon: Crown, color: "primary" as const },
  { name: "Chisomo Banda", role: "Treasurer", icon: Shield, color: "warning" as const },
  { name: "Natasha Phiri", role: "Secretary", icon: FileText, color: "info" as const },
];

type EditTarget =
  | { kind: "rule"; id: string }
  | { kind: "threshold"; id: string }
  | { kind: "propose" }
  | null;

export default function Governance() {
  const { colors } = useTheme();
  const { role, can } = useRole();
  const canEditRules = can("edit.rules");
  const canPropose = can("propose.rule");

  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [thresholds, setThresholds] = useState<Threshold[]>(INITIAL_THRESHOLDS);
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);

  const [edit, setEdit] = useState<EditTarget>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");

  const openEditRule = (r: Rule) => {
    setDraft(r.value);
    setEdit({ kind: "rule", id: r.id });
  };
  const openEditThreshold = (t: Threshold) => {
    setDraft(t.value);
    setEdit({ kind: "threshold", id: t.id });
  };
  const openPropose = () => {
    setDraft("");
    setEdit({ kind: "propose" });
  };

  const closeModal = () => {
    setEdit(null);
    setDraft("");
  };

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const save = () => {
    if (!edit) return;
    const value = draft.trim();
    if (!value) return;
    if (edit.kind === "rule") {
      setRules((prev) => prev.map((r) => (r.id === edit.id ? { ...r, value } : r)));
      flashToast("Rule updated");
    } else if (edit.kind === "threshold") {
      setThresholds((prev) => prev.map((t) => (t.id === edit.id ? { ...t, value } : t)));
      flashToast("Threshold updated");
    } else if (edit.kind === "propose") {
      const newProp: Proposal = {
        id: `p${Date.now()}`,
        title: value,
        proposer: `${role === "Chairperson" ? "Gilbert (you)" : role + " (you)"}`,
        votesFor: 1,
        totalVoters: 12,
        status: "Open",
      };
      setProposals((prev) => [newProp, ...prev]);
      flashToast("Proposal submitted");
    }
    closeModal();
  };

  const modalTitle =
    edit?.kind === "rule"
      ? "Edit rule"
      : edit?.kind === "threshold"
        ? "Edit threshold"
        : edit?.kind === "propose"
          ? "New proposal"
          : "";

  const modalLabel =
    edit?.kind === "rule"
      ? rules.find((r) => r.id === edit.id)?.label
      : edit?.kind === "threshold"
        ? thresholds.find((t) => t.id === edit.id)?.label
        : "Describe your proposal";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="governance-screen"
    >
      <ScreenHeader title="Governance" subtitle="Group rules & voting" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Admin roles */}
        <Text style={[styles.label, { color: colors.textMuted }]}>ADMIN ROLES</Text>
        <Card padding={0}>
          {ADMINS.map((a, i) => {
            const Icon = a.icon;
            return (
              <View
                key={i}
                style={[
                  styles.adminRow,
                  i < ADMINS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.adminIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.textMain, fontWeight: "600" }}>{a.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{a.role}</Text>
                </View>
                <StatusBadge label={a.role} variant={a.color} />
              </View>
            );
          })}
        </Card>

        {/* Rules */}
        <View style={styles.sectionHead}>
          <Text style={[styles.label, { color: colors.textMuted }]}>GROUP RULES</Text>
          {canPropose ? (
            <Pressable onPress={openPropose} testID="governance-propose-btn">
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                Propose change
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Card padding={0}>
          {rules.map((r, i) => {
            const isEditable = r.editable && canEditRules;
            return (
              <Pressable
                key={r.id}
                onPress={isEditable ? () => openEditRule(r) : undefined}
                disabled={!isEditable}
                testID={`governance-rule-row-${r.id}`}
                style={({ pressed }) => [
                  styles.ruleRow,
                  i < rules.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  pressed && isEditable && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
                    {r.label.toUpperCase()}
                  </Text>
                  <Text style={{ color: colors.textMain, fontWeight: "600", marginTop: 4 }}>
                    {r.value}
                  </Text>
                </View>
                {isEditable ? (
                  <Pressable
                    onPress={() => openEditRule(r)}
                    testID={`governance-edit-${r.id}`}
                    style={{ padding: 6 }}
                    hitSlop={10}
                  >
                    <Edit3 size={16} color={colors.primary} />
                  </Pressable>
                ) : r.editable ? (
                  <Lock size={14} color={colors.textMuted} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>

        {/* Voting settings */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>VOTING THRESHOLDS</Text>
        <Card padding={0}>
          {thresholds.map((t, i) => {
            const isEditable = t.editable && canEditRules;
            return (
              <Pressable
                key={t.id}
                onPress={isEditable ? () => openEditThreshold(t) : undefined}
                disabled={!isEditable}
                testID={`governance-threshold-row-${t.id}`}
                style={({ pressed }) => [
                  styles.thresholdRow,
                  i < thresholds.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  pressed && isEditable && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Vote size={16} color={colors.primary} />
                <Text style={{ color: colors.textMain, marginLeft: 10, flex: 1, fontWeight: "500" }}>
                  {t.label}
                </Text>
                <Text style={{ color: colors.textMain, fontWeight: "700", marginRight: 8 }}>
                  {t.value}
                </Text>
                {isEditable ? (
                  <Edit3 size={14} color={colors.primary} />
                ) : (
                  <Lock size={12} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}
        </Card>

        {/* Open proposals */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>
          OPEN PROPOSALS ({proposals.length})
        </Text>
        {proposals.map((p) => (
          <Card key={p.id} padding={16} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMain, fontWeight: "700", flex: 1, marginRight: 10 }}>
                {p.title}
              </Text>
              <StatusBadge label={p.status} variant={p.status === "Open" ? "warning" : "success"} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
              Proposed by {p.proposer} · {p.votesFor}/{p.totalVoters} voted
            </Text>
          </Card>
        ))}

        <View style={{ height: 16 }} />
        {canPropose ? (
          <Button
            label="New proposal"
            icon={<Plus size={18} color="#fff" />}
            onPress={openPropose}
            testID="governance-new-proposal-btn"
          />
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceSecondary,
              padding: 14,
              borderRadius: 14,
              gap: 10,
            }}
          >
            <Lock size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>
              Your role ({role}) cannot create new proposals.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <Modal
        visible={edit !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBg}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHead}>
              <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: "700" }}>
                {modalTitle}
              </Text>
              <Pressable onPress={closeModal} hitSlop={10} testID="governance-modal-close">
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.3, marginBottom: 8 }}>
              {(modalLabel ?? "").toUpperCase()}
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              multiline={edit?.kind === "propose"}
              placeholder={
                edit?.kind === "propose"
                  ? "e.g. Reduce loan interest to 4% per month"
                  : "Enter new value"
              }
              placeholderTextColor={colors.textMuted}
              testID="governance-modal-input"
              style={[
                styles.modalInput,
                {
                  color: colors.textMain,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  minHeight: edit?.kind === "propose" ? 84 : 48,
                  textAlignVertical: edit?.kind === "propose" ? "top" : "center",
                },
              ]}
            />
            {edit?.kind === "propose" ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
                Members vote on your proposal. It passes when {thresholds.find((t) => t.id === "t3")?.value ?? "75%"} approve.
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={closeModal}
                size="md"
                fullWidth={false}
                style={{ flex: 1, marginRight: 8 }}
                testID="governance-modal-cancel"
              />
              <Button
                label={edit?.kind === "propose" ? "Submit" : "Save"}
                onPress={save}
                size="md"
                fullWidth={false}
                disabled={!draft.trim()}
                style={{ flex: 1, marginLeft: 8 }}
                testID="governance-modal-save"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast */}
      {toast ? (
        <View style={[styles.toast, { backgroundColor: colors.textMain }]} pointerEvents="none">
          <Text style={{ color: colors.textInverse, fontWeight: "600", fontSize: 13 }}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  adminRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  adminIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 8,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  thresholdRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
  },
  modalActions: { flexDirection: "row", marginTop: 18 },
  toast: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
});
