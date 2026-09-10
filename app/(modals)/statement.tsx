import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { ScreenHeader, ErrorState, ExportSheet } from "@/src/components/common";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { SkeletonGroup } from "@/src/components/ui";
import { getGroups } from "@/src/services/groups";
import {
  getStatement,
  Statement,
  StatementActivity,
  StatementScope,
} from "@/src/services/statement";
import { exportStatementPdf, exportStatementCsv } from "@/src/utils/exports";
import { formatZMW } from "@/src/utils/currency";
import { movementLabel, statementCopy, statementFlavourFor } from "@/src/utils/statementCopy";
import { Group, Role } from "@/src/types";
import { Download, Calendar, ChevronDown, ChevronRight, Check } from "lucide-react-native";
import { useAsyncEffect } from "@/src/hooks/useAsyncEffect";

// ─── Period presets ──────────────────────────────────────────────────────────
// A statement always covers a closed range. `to` is pushed to the last
// millisecond of its day so a transaction made this afternoon still lands
// inside "This month".

type PresetKey = "this-month" | "last-month" | "3months" | "year" | "custom";

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function presetRange(key: Exclude<PresetKey, "custom">): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "this-month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "last-month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "3months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: endOfDay(now) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "3months", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

/**
 * The roles that may read the group's own book.
 *
 * A member statement is your money; a group statement is everyone's, which
 * is an officer's job and nobody else's. The API enforces this — the toggle
 * below only avoids offering a door that would be shut. In a group where you
 * are just a member there is no toggle at all: a control that can only ever
 * fail is worse than no control.
 */
const OFFICER_ROLES: Role[] = ["Chairperson", "Treasurer", "Secretary"];

const fmtDay = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtMonth = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** The trailing 24 calendar months, newest first — the custom-range choices. */
function recentMonths(count = 24): Date[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));
}

export default function StatementScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string }>();

  const [preset, setPreset] = useState<PresetKey>("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [groupId, setGroupId] = useState<string | null>(params.groupId ?? null);
  // What the toggle has been set to BY HAND, and for which group+role. The
  // scope itself is derived from this below rather than stored: an officer's
  // default is on, and a default that lives in state has to be re-synced
  // every time the group changes, which is a render cascade waiting to
  // happen. A stale choice (different key) simply stops applying.
  const [scopeChoice, setScopeChoice] = useState<{
    key: string;
    scope: StatementScope;
  } | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  // Your role in a group arrives with this list, and the toggle's default
  // depends on it — so a statement scoped to a group waits for it rather than
  // fetching the member view and immediately replacing it.
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);

  useEffect(() => {
    // A statement is the record of what happened, so a group that has since
    // been deleted still belongs in the picker — closing a group never takes
    // its history with it.
    getGroups({ includeClosed: true })
      .then(setGroups)
      .catch(() => setGroups([]))
      // Even a failure settles the question — without the list nobody is an
      // officer, so the statement is the member view and should load.
      .finally(() => setGroupsLoaded(true));
  }, []);

  const scopedGroup = groupId ? groups.find((g) => g.id === groupId) : undefined;
  const groupLabel = groupId ? scopedGroup?.name ?? "Selected group" : "All groups";

  // Your role in the group currently in view. The group book is always about
  // ONE group, so "All groups" holds no role and offers no toggle.
  const roleHere = scopedGroup?.yourRole;
  const officerHere = !!roleHere && OFFICER_ROLES.includes(roleHere);

  /**
   * An officer opening a group they run wants the group's book — that is the
   * job they opened it for — so the toggle starts on, and stays wherever they
   * put it until the group, or their role in it, changes underneath them.
   *
   * The key carries the role as well as the group because the role arrives a
   * moment after the group does; keying on both means a choice made under one
   * role stops applying the instant the answer changes, and the default takes
   * over again without anything having to re-sync it.
   */
  const defaultKey = `${groupId ?? ""}:${roleHere ?? ""}`;
  const scope: StatementScope =
    scopeChoice?.key === defaultKey
      ? scopeChoice.scope
      : officerHere
        ? "group"
        : "member";
  const forGroup = scope === "group";
  const setScope = (next: StatementScope) =>
    setScopeChoice({ key: defaultKey, scope: next });

  const load = useCallback(async () => {
    // Wait for the groups list: your role in the group decides which of the
    // two statements to fetch, and asking before it lands would show the
    // member view for a beat before replacing it.
    if (!groupsLoaded) return;
    setLoading(true);
    setError(false);
    try {
      setStatement(
        await getStatement({ from: range.from, to: range.to, groupId, scope })
      );
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, groupId, scope, groupsLoaded]);

  useAsyncEffect(load);

  // Settled money only, matching the export. A statement answers "what do I
  // have and how did it get there" — a payment that might still fail belongs to
  // the question "did my payment go through", which the Transactions tab and
  // the payment's own receipt answer. Printing the two side by side invites the
  // pending one being counted as though it had landed.
  const activity = useMemo(
    () => (statement?.activity ?? []).filter((a) => a.status === "completed"),
    [statement]
  );

  // A church group's money is given, not saved. Same figures, different words —
  // see statementCopy. Scoped to one group it follows that group; across all of
  // them only an all-project-fund member gets the giving wording.
  const flavour = statementFlavourFor(
    groupId
      ? [statement?.group?.groupType ?? scopedGroup?.groupType]
      : groups.map((g) => g.groupType)
  );
  const copy = statementCopy(flavour, scope);
  const periodLabel = `${fmtDay(range.from)} – ${fmtDay(range.to)}`;

  const choosePreset = (key: PresetKey) => {
    if (key === "custom") {
      setCustomStart(null);
      setPeriodPickerOpen(true);
      return;
    }
    setPreset(key);
    setRange(presetRange(key));
  };

  // Two taps: first month = start, second = end (inclusive). Tapping the same
  // month twice gives that single month.
  const chooseMonth = (month: Date) => {
    if (!customStart) {
      setCustomStart(month);
      return;
    }
    const [a, b] = customStart <= month ? [customStart, month] : [month, customStart];
    const to = endOfDay(new Date(b.getFullYear(), b.getMonth() + 1, 0));
    const now = new Date();
    setRange({ from: a, to: to > now ? endOfDay(now) : to });
    setPreset("custom");
    setCustomStart(null);
    setPeriodPickerOpen(false);
  };

  const months = useMemo(() => recentMonths(), []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="statement-screen"
    >
      <ScreenHeader
        title={forGroup ? "Group statement" : "Statement"}
        subtitle={periodLabel}
        rightAction={
          <Pressable
            onPress={() => setExportOpen(true)}
            disabled={!statement}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: statement ? 1 : 0.4,
            }}
            testID="statement-export-btn"
          >
            <Download size={18} color={colors.primary} />
          </Pressable>
        }
      />

      {/* Scope: whose money, which group, which period */}
      <View style={styles.scopeRow}>
        <Pressable
          onPress={() => setGroupPickerOpen(true)}
          style={[styles.scopeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="statement-group-btn"
        >
          <Text style={[styles.scopeText, { color: colors.textMain }]} numberOfLines={1}>
            {groupLabel}
          </Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </Pressable>

        {/* Officers only, and only in the group they hold the role in. Off is
            your own money; on is the book you keep for everyone. */}
        {officerHere ? (
          <View
            style={[
              styles.toggleRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            testID="statement-scope-row"
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.toggleLabel, { color: colors.textMain }]}>
                View as {roleHere}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {forGroup
                  ? "The whole group's money"
                  : "Showing your own money"}
              </Text>
            </View>
            <Switch
              value={forGroup}
              onValueChange={(on) => setScope(on ? "group" : "member")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
              testID="statement-scope-toggle"
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {PRESETS.map((item) => {
          const active = item.key === preset;
          return (
            <Pressable
              key={item.key}
              onPress={() => choosePreset(item.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              testID={`statement-preset-${item.key}`}
            >
              {item.key === "custom" ? (
                <Calendar size={13} color={active ? "#fff" : colors.textMuted} />
              ) : null}
              <Text
                numberOfLines={1}
                style={[styles.chipText, { color: active ? "#fff" : colors.textMain }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={4} height={110} />
        </View>
      ) : error || !statement ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Balance summary */}
          <Card padding={18} testID="statement-summary">
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {copy.balanceLabel.toUpperCase()}
            </Text>
            <Text style={[styles.balance, { color: colors.textMain }]}>
              {formatZMW(statement.closingBalance)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {forGroup
                ? `Everyone in ${statement.group?.name ?? "the group"}`
                : statement.group?.name ?? "Across all your groups"}{" "}
              · as at {fmtDay(statement.period.to)}
            </Text>
            {forGroup && roleHere ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                Pulled by you as {roleHere}
              </Text>
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <SummaryRow
              k={copy.openingLabel}
              v={formatZMW(statement.openingBalance)}
              colors={colors}
            />
            <SummaryRow
              k={copy.inLabel}
              v={`+${formatZMW(statement.savingsIn)}`}
              tint={colors.success}
              colors={colors}
            />
            {copy.outLabel ? (
              <SummaryRow
                k={copy.outLabel}
                v={`−${formatZMW(statement.savingsOut)}`}
                tint={statement.savingsOut > 0 ? colors.danger : undefined}
                colors={colors}
              />
            ) : null}
            <SummaryRow
              k={copy.closingLabel}
              v={formatZMW(statement.closingBalance)}
              bold
              colors={colors}
            />
          </Card>

          {/* Every movement in the period. On screen this IS the statement:
              what it was, when, and which way the money went. Anything more —
              reference, method, fees, the running balance behind a line — is a
              tap away on the receipt, or in the export. */}
          <SectionTitle colors={colors}>{copy.activityTitle.toUpperCase()}</SectionTitle>
          <Card padding={0}>
            {activity.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  No completed transactions in this period.
                </Text>
              </View>
            ) : (
              activity.map((a, i) => (
                <ActivityRow
                  key={a.id}
                  item={a}
                  label={movementLabel(copy, a)}
                  // One group's book names the payer; a member's statement
                  // across several groups names the group.
                  meta={forGroup ? a.memberName ?? "" : statement.group ? "" : a.groupName}
                  colors={colors}
                  last={i === activity.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: "/receipt",
                      params: {
                        amount: String(a.amount),
                        type: a.type === "combined" ? "contribution" : a.type,
                        group: a.groupName,
                        date: fmtDay(a.date),
                        note: a.note,
                        status: a.status,
                        direction: a.direction,
                        // Every line here has settled, so it has a real receipt
                        // number; the id fallback is belt and braces.
                        ...(a.receiptId ? { txnId: a.receiptId } : { id: a.id }),
                      },
                    })
                  }
                />
              ))
            )}
          </Card>

          <Text style={[styles.note, { color: colors.textMuted }]}>
            Statement no. {statement.statementId} · issued {fmtDay(statement.generatedAt)}.
            {"\n"}{copy.footnote}
          </Text>
        </ScrollView>
      )}

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export statement"
        subtitle={periodLabel}
        pdfHint="Bank-style statement, ready to print or share"
        csvHint="Spreadsheet format, opens in Excel or Sheets"
        onPdf={() => statement && exportStatementPdf(statement, flavour)}
        onCsv={() => statement && exportStatementCsv(statement, flavour)}
      />

      {/* Group scope picker */}
      <Modal
        visible={groupPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGroupPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setGroupPickerOpen(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.textMain }]}>Statement for</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <Card padding={0}>
              <PickerRow
                label="All groups"
                selected={groupId === null}
                onPress={() => {
                  setGroupId(null);
                  setGroupPickerOpen(false);
                }}
                colors={colors}
                testID="statement-group-all"
              />
              {groups.map((g) => (
                <PickerRow
                  key={g.id}
                  label={g.name}
                  selected={groupId === g.id}
                  onPress={() => {
                    setGroupId(g.id);
                    setGroupPickerOpen(false);
                  }}
                  colors={colors}
                  testID={`statement-group-${g.id}`}
                />
              ))}
            </Card>
          </ScrollView>
          <Button
            label="Cancel"
            variant="ghost"
            style={{ marginTop: 16 }}
            onPress={() => setGroupPickerOpen(false)}
          />
        </View>
      </Modal>

      {/* Custom period picker — pick a start month, then an end month */}
      <Modal
        visible={periodPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPeriodPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setPeriodPickerOpen(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.background, maxHeight: "70%", paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.textMain }]}>
            {customStart ? "Pick the last month" : "Pick the first month"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>
            {customStart
              ? `From ${fmtMonth(customStart)} to…`
              : "Choose the month your statement should start"}
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <Card padding={0}>
              {months.map((m) => (
                <PickerRow
                  key={m.toISOString()}
                  label={fmtMonth(m)}
                  selected={!!customStart && m.getTime() === customStart.getTime()}
                  onPress={() => chooseMonth(m)}
                  colors={colors}
                  testID={`statement-month-${m.getFullYear()}-${m.getMonth() + 1}`}
                />
              ))}
            </Card>
          </ScrollView>
          <Button
            label="Cancel"
            variant="ghost"
            style={{ marginTop: 16 }}
            onPress={() => {
              setCustomStart(null);
              setPeriodPickerOpen(false);
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>["colors"];

const SectionTitle: React.FC<{ children: React.ReactNode; colors: Colors }> = ({
  children,
  colors,
}) => <Text style={[styles.section, { color: colors.textMuted }]}>{children}</Text>;

/**
 * One movement, the way a phone should show it: what it was, when, and a
 * colour that says which way the money went — green in, red out. Everything a
 * receipt carries (reference, method, fees, network charge) is a tap away
 * rather than crammed into a row read standing up on a bus.
 */
const ActivityRow: React.FC<{
  item: StatementActivity;
  label: string;
  /** Who paid, or which group — whichever the current view leaves open. */
  meta: string;
  colors: Colors;
  last?: boolean;
  onPress: () => void;
}> = ({ item, label, meta, colors, last, onPress }) => {
  // Every line the statement lists has settled, so the amount always earns its
  // colour and there is no status to caveat it with.
  return (
    <Pressable
      onPress={onPress}
      testID={`statement-activity-${item.id}`}
      style={({ pressed }) => [
        styles.activityRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.textMain, fontWeight: "600", fontSize: 13 }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {fmtShort(item.date)}
          {meta ? ` · ${meta}` : ""}
        </Text>
      </View>
      <Text
        style={{
          color: item.direction === "in" ? colors.success : colors.danger,
          fontWeight: "700",
          fontSize: 13,
          marginLeft: 12,
        }}
      >
        {item.direction === "in" ? "+" : "−"}
        {formatZMW(item.amount)}
      </Text>
      <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </Pressable>
  );
};

const SummaryRow: React.FC<{
  k: string;
  v: string;
  colors: Colors;
  tint?: string;
  bold?: boolean;
}> = ({ k, v, colors, tint, bold }) => (
  <View style={styles.summaryRow}>
    <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: bold ? "700" : "400" }}>
      {k}
    </Text>
    <Text
      style={{
        color: tint ?? colors.textMain,
        fontSize: bold ? 15 : 13,
        fontWeight: bold ? "800" : "600",
      }}
    >
      {v}
    </Text>
  </View>
);

const PickerRow: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: Colors;
  testID?: string;
}> = ({ label, selected, onPress, colors, testID }) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    }}
  >
    <Text
      style={{
        color: colors.textMain,
        fontSize: 14,
        fontWeight: selected ? "700" : "500",
      }}
    >
      {label}
    </Text>
    {selected ? <Check size={18} color={colors.primary} /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  scopeRow: { paddingHorizontal: 20, marginBottom: 10 },
  scopeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  scopeText: { fontSize: 14, fontWeight: "600", flex: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: "600" },
  chipScroll: { flexGrow: 0, height: 44, marginBottom: 8 },
  chipRow: { paddingHorizontal: 20, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 8,
    flexShrink: 0,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  balance: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 },
  divider: { height: 1, marginVertical: 14 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  note: { fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
});
