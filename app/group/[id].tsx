import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Linking,
  Alert,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Button } from "@/src/components/ui/Button";
import { SkeletonGroup } from "@/src/components/ui";
import { ErrorState } from "@/src/components/common";
import {
  getGroupById,
  inviteMember,
  resendInvite,
  cancelInvite,
  requestMemberRemoval,
  requestGroupDeletion,
  addGroupProject,
  updateGroupProject,
} from "@/src/services/groups";
import type { Role } from "@/src/types";
import { getApprovals } from "@/src/services/approvals";
import { getGroupTransactions } from "@/src/services/transactions";
import { getLoans } from "@/src/services/loans";
import { formatZMW } from "@/src/utils/currency";
import { formatDate } from "@/src/utils/date";
import {
  phoneKey,
  invitedAgo,
  inviteDisplayName,
  pendingInvites,
} from "@/src/utils/invites";
import { isGroupLocked, getMonthsOwed, getAmountOwed } from "@/src/services/groupFees";
import {
  Member,
  Group,
  GroupProject,
  Approval,
  TxnItem,
  Loan,
  isProjectFundType,
} from "@/src/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import {
  Users,
  Calendar,
  TrendingUp,
  Wallet,
  ChevronRight,
  Crown,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Scale,
  CircleDollarSign,
  Phone,
  AlertTriangle,
  UserMinus,
  ShieldCheck,
  UserPlus,
  Plus,
  Lock,
  ArrowLeft,
  Send,
  X,
  Clock,
  History,
  Target,
  Trash2,
  Pencil,
} from "lucide-react-native";
import { useAsyncEffect } from "@/src/hooks/useAsyncEffect";

type TabKey =
  | "members"
  | "projects"
  | "contributions"
  | "loans"
  | "approvals"
  | "reports"
  | "governance";

const TAB_KEYS: TabKey[] = [
  "members",
  "projects",
  "contributions",
  "loans",
  "approvals",
  "reports",
  "governance",
];

// A project deadline is an ISO date the API stores as a Date. Compared against
// the start of today so a deadline of today itself never reads as passed.
const formatProjectDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// The form works in plain "YYYY-MM-DD" days, which is what the API is sent and
// what it stores (UTC midnight) — so a day never shifts on the way through.
const toISODay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const parseISODay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatISODay = (day: string) =>
  parseISODay(day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const projectOverdue = (p: { deadline?: string | null; status?: string }) => {
  if (!p.deadline || p.status === "completed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(p.deadline) < today;
};

export default function GroupDetails() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [rawTab, setTab] = useState<TabKey>(
    TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "members"
  );
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Member");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  // memberId of the pending invite currently being resent / cancelled
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  // member row id whose removal is being proposed
  const [removingId, setRemovingId] = useState<string | null>(null);
  // true while a group deletion is being requested
  const [deletingGroup, setDeletingGroup] = useState(false);
  // Project form (project-fund groups; Chairperson only). One form serves both
  // adding and editing: `projectFormFor` is null when closed, "new" when adding,
  // and the project's id when editing that project.
  const [projectFormFor, setProjectFormFor] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectTarget, setProjectTarget] = useState("");
  // "YYYY-MM-DD", or "" for no deadline.
  const [projectDeadline, setProjectDeadline] = useState("");
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupApprovals, setGroupApprovals] = useState<Approval[]>([]);
  const [groupTxn, setGroupTxn] = useState<TxnItem[]>([]);
  const [groupLoans, setGroupLoans] = useState<Loan[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const g = await getGroupById(id);
      if (g) {
        setGroup(g);
        const a = await getApprovals({ groupId: id });
        setGroupApprovals(a);
        try {
          const [txns, lns] = await Promise.all([
            getGroupTransactions(id),
            getLoans({ groupId: id }),
          ]);
          setGroupTxn(txns);
          setGroupLoans(lns);
        } catch {
          setGroupTxn([]);
          setGroupLoans([]);
        }
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useAsyncEffect(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /** Re-fetch the group without flashing the skeleton (used after invite actions). */
  const refreshGroup = useCallback(async () => {
    if (!id) return;
    try {
      const g = await getGroupById(id);
      if (g) setGroup(g);
    } catch {
      // keep showing what we have; the next pull-to-refresh will surface errors
    }
  }, [id]);

  // Someone who was invited but hasn't accepted is NOT a member of the group:
  // they have no savings, owe no contribution and can't be given a loan. Keep
  // the two lists apart everywhere so a pending invite never reads as a member.
  const activeMembers = useMemo(
    () => (group?.members ?? []).filter((m: any) => m.status !== "pending"),
    [group]
  );
  const pendingMembers = useMemo(() => pendingInvites(group), [group]);

  // People who have left. Their row is kept so the group keeps its record of
  // what they saved and contributed — removal ends a membership, it does not
  // erase a history.
  const formerMembers = useMemo(
    () => group?.formerMembers ?? [],
    [group]
  );

  const onResendInvite = useCallback(
    async (member: Member) => {
      setBusyInviteId(member.id);
      try {
        await resendInvite(id, member.id);
        Alert.alert(
          "Invite resent",
          `We've sent the invitation to ${member.phone} again. They'll also see it in the Chuma app once they sign up with this number.`
        );
        await refreshGroup();
      } catch (e: any) {
        Alert.alert("Could not resend", e?.message || "Please try again.");
      } finally {
        setBusyInviteId(null);
      }
    },
    [id, refreshGroup]
  );

  const onCancelInvite = useCallback(
    (member: Member) => {
      Alert.alert(
        "Cancel invitation",
        `Withdraw the invitation sent to ${member.name || member.phone}?`,
        [
          { text: "Keep it", style: "cancel" },
          {
            text: "Cancel invite",
            style: "destructive",
            onPress: async () => {
              setBusyInviteId(member.id);
              try {
                await cancelInvite(id, member.id);
                await refreshGroup();
              } catch (e: any) {
                Alert.alert("Could not cancel", e?.message || "Please try again.");
              } finally {
                setBusyInviteId(null);
              }
            },
          },
        ]
      );
    },
    [id, refreshGroup]
  );

  /** Member row ids with a removal already waiting on the other admins. */
  const removalPending = useMemo(
    () =>
      new Set(
        groupApprovals
          .filter((a) => a.type === "member-removal" && a.status === "pending")
          .map((a: any) => String(a.refId))
      ),
    [groupApprovals]
  );

  /**
   * Propose a removal. This never removes anyone on its own — it opens a vote
   * for the group's other admins, and the member's savings are refunded to
   * their wallet if it carries. Say both things plainly before asking.
   */
  const onRemoveMember = useCallback(
    (member: Member) => {
      const savings = member.savings || 0;
      const owed = member.loanActive || 0;
      Alert.alert(
        "Propose removal",
        `Remove ${member.name} from ${group?.name ?? "this group"}?

The group's other admins vote on this. ${member.name} does not. If it carries, their ${formatZMW(savings)} in savings is refunded to their mobile wallet${owed > 0 ? ` after ${formatZMW(owed)} clears their outstanding loan` : ""}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Propose removal",
            style: "destructive",
            onPress: async () => {
              setRemovingId(member.id);
              try {
                const res = await requestMemberRemoval(id, member.id);
                setSheetVisible(false);
                await load();
                Alert.alert(
                  "Removal proposed",
                  `${res.requiredApprovals} of ${res.eligibleVoters} other admin${res.eligibleVoters === 1 ? "" : "s"} must approve. ${formatZMW(res.refund)} would be refunded to ${member.name}.`
                );
              } catch (e: any) {
                Alert.alert("Could not propose removal", e?.message || "Please try again.");
              } finally {
                setRemovingId(null);
              }
            },
          },
        ]
      );
    },
    [group?.name, id, load]
  );

  /**
   * Delete the group. Two things have to be said before anyone taps yes, and
   * both are said here rather than in a toast afterwards:
   *
   *   1. Records survive. Closing a group never takes its history with it —
   *      contributions, receipts, penalties and statements all stay readable,
   *      which is the whole reason this is a close and not a delete.
   *   2. It may not happen now. With other admins in the group this is a
   *      proposal they vote on, exactly like a member removal. Alone, it is
   *      final the moment it is confirmed.
   */
  const onDeleteGroup = useCallback(
    (groupName: string, alone: boolean) => {
      Alert.alert(
        alone ? "Delete group" : "Propose deletion",
        `Delete ${groupName}?

${alone ? "This cannot be undone." : "The group's other admins vote on this first."} The group closes for everyone and leaves your list of groups.

Its records are kept: every contribution, receipt, penalty and statement stays in the app and can still be opened from Transactions.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: alone ? "Delete group" : "Propose deletion",
            style: "destructive",
            onPress: async () => {
              setDeletingGroup(true);
              try {
                const res = await requestGroupDeletion(id);
                if (res.deleted) {
                  router.replace("/(tabs)/groups");
                  Alert.alert(
                    "Group deleted",
                    `${groupName} is closed. Its records stay in the app — open Transactions or a statement to see them.`
                  );
                  return;
                }
                await load();
                Alert.alert(
                  "Deletion proposed",
                  `${res.requiredApprovals} of ${res.eligibleVoters} other admin${res.eligibleVoters === 1 ? "" : "s"} must approve. Nothing changes until they do.`
                );
              } catch (e: any) {
                Alert.alert("Could not delete group", e?.message || "Please try again.");
              } finally {
                setDeletingGroup(false);
              }
            },
          },
        ]
      );
    },
    [id, load, router]
  );

  const closeProjectForm = useCallback(() => {
    setProjectFormFor(null);
    setDeadlinePickerOpen(false);
    setProjectError("");
    setProjectName("");
    setProjectTarget("");
    setProjectDeadline("");
  }, []);

  const openAddProject = useCallback(() => {
    setProjectFormFor("new");
    setDeadlinePickerOpen(false);
    setProjectError("");
    setProjectName("");
    setProjectTarget("");
    setProjectDeadline("");
  }, []);

  // Editing starts from what the project already is, so an untouched field is
  // saved back exactly as it was.
  const openEditProject = useCallback((p: GroupProject) => {
    setProjectFormFor(p.id);
    setDeadlinePickerOpen(false);
    setProjectError("");
    setProjectName(p.name);
    setProjectTarget(p.targetAmount ? String(p.targetAmount) : "");
    setProjectDeadline(p.deadline ? String(p.deadline).slice(0, 10) : "");
  }, []);

  const onSaveProject = useCallback(async () => {
    const name = projectName.trim();
    if (!name) {
      setProjectError("Give the project a name");
      return;
    }
    const target = parseFloat(projectTarget) || 0;
    if (projectTarget.trim() && target <= 0) {
      setProjectError("Goal must be more than 0, or leave it blank");
      return;
    }
    const editingId = projectFormFor && projectFormFor !== "new" ? projectFormFor : null;
    const fields = {
      name,
      targetAmount: target > 0 ? target : null,
      deadline: projectDeadline || null,
    };
    setSavingProject(true);
    setProjectError("");
    try {
      if (editingId) await updateGroupProject(id, editingId, fields);
      else await addGroupProject(id, fields);
      closeProjectForm();
      await refreshGroup();
    } catch (e: any) {
      setProjectError(
        e?.message ||
          (editingId
            ? "Could not save the changes. Please try again."
            : "Could not add the project. Please try again.")
      );
    } finally {
      setSavingProject(false);
    }
  }, [
    id,
    projectFormFor,
    projectName,
    projectTarget,
    projectDeadline,
    closeProjectForm,
    refreshGroup,
  ]);

  const cycleStatus = useMemo(() =>
    (group?.members ?? []).filter((m: any) => m.status !== "pending").map((m, i) => {
      const seed = (i * 7) % 10;
      const status: "paid" | "overdue" | "pending" =
        seed < 6 ? "paid" : seed < 8 ? "overdue" : "pending";
      return { member: m, status };
    }),
    [group]
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={5} height={80} />
        </View>
      </SafeAreaView>
    );
  }
  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <ErrorState onRetry={load} />
      </SafeAreaView>
    );
  }

  const locked = group.feeStatus?.locked ?? isGroupLocked(group);
  // A group still waiting on its registration fee owes exactly month 1. The
  // server's monthsOwed reads 0 there (feePaidThrough was stamped at creation),
  // so the amount has to come from the fee itself or the overlay offers "K0".
  const awaitingFirstPayment = group.status === "pending-payment";
  const monthsOwed = awaitingFirstPayment ? 1 : (group.feeStatus?.monthsOwed ?? getMonthsOwed(group));
  const amountOwed = awaitingFirstPayment
    ? (group.monthlyFee ?? group.registrationFee ?? 0)
    : (group.feeStatus?.amountOwed ?? getAmountOwed(group));
  // Privileges inside a group follow the user's role IN THIS GROUP, not their
  // app-wide menu role — a global Chairperson is only a Member here if that's
  // how they joined this group.
  const effectiveRole = group.yourRole;
  const canPayFee =
    effectiveRole === "Chairperson" ||
    effectiveRole === "Treasurer";
  // Resending or withdrawing an invite is an admin action — same set the API
  // enforces on /invite (requireGroupAdmin).
  const isAdmin = effectiveRole !== "Member";
  // Deleting is the group's most destructive act, so the app says up front
  // whether it takes a vote. An admin looking at a group whose only admin is
  // them has nobody to ask, and the API closes it on the spot.
  const adminCount = (group.members ?? []).filter(
    (m) => m.status === "active" && m.role !== "Member"
  ).length;
  const soloAdmin = adminCount <= 1;
  // A deletion the other admins are still voting on. The group works normally
  // meanwhile — the vote can fail — but nobody should propose it twice.
  const deletionPending = group.status === "deletion-pending";

  // Church-style group: gives toward named projects. No cycle, no dues, no
  // loans, no penalties and no share-out — so none of that is shown here.
  const isProjectFund = isProjectFundType(group.groupType);
  const projects = group.projects ?? [];
  const activeProjects = projects.filter((p) => p.status === "active");
  const totalRaised = projects.reduce((sum, p) => sum + p.collected, 0);
  // Opening a project — and renaming one, or moving its goal or deadline —
  // decides what members' money can be given toward, so it is the
  // Chairperson's call. The API enforces the same on both routes.
  const canManageProjects = isProjectFund && effectiveRole === "Chairperson";

  // Closing a church group ends what the congregation is giving toward, so it
  // is the Chairperson alone who may start it — a Treasurer or Secretary does
  // not see the danger zone at all. Every other group type keeps the older
  // rule, where any admin may propose it and the rest vote.
  const canDeleteGroup = isProjectFund ? effectiveRole === "Chairperson" : isAdmin;

  // What each person has given to a church group is between them and the
  // leadership — a congregation reads its neighbours' giving as a ranking, and
  // it is not what the tab is for. Admins still see every figure, because
  // reconciling the money is their job. Every other group type is a savings
  // club where members pool and share out together, so who saved what stays
  // open to all of them.
  const canSeeMemberMoney = !isProjectFund || isAdmin;

  // A tab arriving in the URL can name one this group's type does not offer:
  // "projects" belongs to a project fund, "loans" and "contributions" to
  // everything else. Falling back here beats rendering a body with no matching
  // tab in the bar.
  //
  // A project fund has no Giving tab of its own: giving IS the projects, so the
  // list of them and the button to give toward one belong on the same tab. A
  // link still pointing at "contributions" lands there rather than nowhere.
  const tab: TabKey =
    (rawTab === "projects" && !isProjectFund) ||
    (rawTab === "loans" && isProjectFund) ||
    (rawTab === "approvals" && !isAdmin)
      ? "members"
      : rawTab === "contributions" && isProjectFund
        ? "projects"
        : rawTab;

  const paidCount = cycleStatus.filter((c) => c.status === "paid").length;
  const overdueCount = cycleStatus.filter((c) => c.status === "overdue").length;
  const pendingCount = cycleStatus.filter((c) => c.status === "pending").length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="group-details-screen"
    >
      <ScreenHeader
        title={group.name}
        subtitle={`${group.memberCount} members`}
        rightAction={
          // Inviting is an admin action the API refuses for members
          // (requireGroupAdmin), so it is not offered to them here either.
          tab === "members" && isAdmin ? (
            <Pressable
              style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
              onPress={() => setInviteOpen((v) => !v)}
              testID="members-invite-btn"
            >
              <Plus size={18} color="#fff" strokeWidth={2.4} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial overview */}
        <View style={{ paddingHorizontal: 20 }}>
          <Card padding={20} style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
            {/* Their own figure leads: "where do I stand in this group" is what
                most people open it to find out. The group's total sits under it
                as context, not as the headline. */}
            <Text style={styles.heroLabel}>
              {isProjectFund ? "You have given" : "Your savings"}
            </Text>
            <Text style={styles.heroAmount}>{formatZMW(group.yourSavings ?? 0)}</Text>
            <View style={styles.heroYouRow}>
              <Text style={styles.heroYouLabel}>
                {isProjectFund ? "Church total raised" : "Total group savings"}
              </Text>
              <Text style={styles.heroYouValue}>{formatZMW(group.totalSavings)}</Text>
            </View>
            <View style={styles.heroRow}>
              {/* A church group never lends and holds nothing back for a
                  share-out, so a wallet figure would only repeat the total
                  raised. It shows what it is raising for instead. */}
              {isProjectFund ? (
                <HeroStat label="Projects" value={String(activeProjects.length)} />
              ) : (
                <>
                  <HeroStat label="Wallet" value={formatZMW(group.walletBalance, { compact: true })} />
                  <View style={styles.divider} />
                  <HeroStat label="Loans out" value={formatZMW(group.loanCirculation, { compact: true })} />
                </>
              )}
              <View style={styles.divider} />
              <HeroStat label="Members" value={String(group.memberCount)} />
            </View>
          </Card>
        </View>

        {/* Rules summary */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          {isProjectFund ? (
            <Card padding={16}>
              <RuleRow
                icon={<CircleDollarSign size={18} color={colors.primary} />}
                label="Giving"
                value="Any amount, any time"
                colors={colors}
              />
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
              <RuleRow
                icon={<Target size={18} color={colors.primary} />}
                label="Open projects"
                value={
                  activeProjects.length === 1
                    ? activeProjects[0].name
                    : `${activeProjects.length} projects`
                }
                colors={colors}
              />
            </Card>
          ) : (
          <Card padding={16}>
            <RuleRow
              icon={<CircleDollarSign size={18} color={colors.primary} />}
              label="Contribution"
              value={`${formatZMW(group.contributionAmount)} · ${group.contributionFrequency}`}
              colors={colors}
            />
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <RuleRow
              icon={<TrendingUp size={18} color={colors.primary} />}
              label="Loan interest"
              value={`${group.loanInterestRate}% / month · up to ${group.loanMaxMultiplier}x savings`}
              colors={colors}
            />
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <RuleRow
              icon={<Calendar size={18} color={colors.primary} />}
              label="Share-out"
              value={formatDate(group.shareOutDate) || "Not set"}
              colors={colors}
            />
          </Card>
          )}
        </View>

        {/* Cycle progress — a project-fund group has no cycle; progress is per
            project, on the Projects tab. */}
        {!isProjectFund && (
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Card padding={16}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                Contribution cycle
              </Text>
              <Text style={[styles.cardValue, { color: colors.textMain }]}>
                {Math.round(group.cycleProgress * 100)}% complete
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar progress={group.cycleProgress} />
            </View>
          </Card>
        </View>
        )}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {(isProjectFund
            ? ([
                { k: "members", label: "Members" },
                { k: "projects", label: "Projects" },
                { k: "approvals", label: "Approvals" },
                { k: "reports", label: "Reports" },
                { k: "governance", label: "Governance" },
              ] as { k: TabKey; label: string }[])
            : ([
                { k: "members", label: "Members" },
                { k: "contributions", label: "Contributions" },
                { k: "loans", label: "Loans" },
                { k: "approvals", label: "Approvals" },
                { k: "reports", label: "Reports" },
                { k: "governance", label: "Governance" },
              ] as { k: TabKey; label: string }[])
          )
            // Voting is an admin duty — the API refuses a member's vote outright
            // ("Only group admins can vote on approvals"), so a member opening
            // this tab could only watch. Showing it offered a decision they were
            // never able to make.
            .filter((t) => t.k !== "approvals" || isAdmin)
            .map((t) => {
            const active = tab === t.k;
            return (
              <Pressable
                key={t.k}
                onPress={() => setTab(t.k)}
                style={[
                  styles.tab,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  },
                ]}
                testID={`group-tab-${t.k}`}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? "#fff" : colors.textMain },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab content */}
        {tab === "members" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Card padding={0}>
              {activeMembers.slice(0, 12).map((m, i, arr) => (
                <View key={m.userId ?? m.id ?? m.phone ?? String(i)}>
                  <Pressable
                    onPress={() => { setSelectedMember(m); setSheetVisible(true); }}
                    testID={`member-row-${m.userId ?? m.id ?? m.phone}`}
                  >
                    <MemberRow
                      member={m}
                      colors={colors}
                      removalPending={removalPending.has(String(m.id))}
                      showMoney={canSeeMemberMoney}
                    />
                  </Pressable>
                  {i < Math.min(arr.length, 12) - 1 && (
                    <View style={[styles.sep, { backgroundColor: colors.border, marginHorizontal: 16 }]} />
                  )}
                </View>
              ))}
            </Card>
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              Showing {Math.min(activeMembers.length, 12)} of {group.memberCount} member
              {group.memberCount === 1 ? "" : "s"}
            </Text>

            {/* Invited, not yet joined. Kept out of the members list above so the
                group's headcount and savings never count someone who hasn't
                accepted — and so an admin can chase or withdraw the invite.
                Admins only: an unanswered invite is theirs to chase, and an
                ordinary member has nothing to do about it. */}
            {isAdmin && pendingMembers.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <Clock size={14} color={colors.textMuted} />
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 1.2,
                      marginLeft: 6,
                    }}
                  >
                    PENDING INVITES ({pendingMembers.length})
                  </Text>
                </View>
                <Card padding={0}>
                  {pendingMembers.map((m, i) => (
                    <View key={m.id ?? m.phone ?? String(i)}>
                      <PendingInviteRow
                        member={m}
                        colors={colors}
                        busy={busyInviteId === m.id}
                        canManage={isAdmin}
                        onResend={() => onResendInvite(m)}
                        onCancel={() => onCancelInvite(m)}
                      />
                      {i < pendingMembers.length - 1 && (
                        <View style={[styles.sep, { backgroundColor: colors.border, marginHorizontal: 16 }]} />
                      )}
                    </View>
                  ))}
                </Card>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  These people have been invited but haven&apos;t joined yet.
                  They don&apos;t count towards the group until they accept.
                </Text>
              </View>
            )}

            {/* Left the group. Kept on the record deliberately: their savings,
                contributions and every transaction they made stay in the
                group's books after they go. Read-only — nothing here removes
                or edits what they did. */}
            {formerMembers.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <UserMinus size={14} color={colors.textMuted} />
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 1.2,
                      marginLeft: 6,
                    }}
                  >
                    FORMER MEMBERS ({formerMembers.length})
                  </Text>
                </View>
                <Card padding={0}>
                  {formerMembers.map((m, i) => (
                    <View key={m.id ?? m.phone ?? String(i)}>
                      <FormerMemberRow member={m} colors={colors} showMoney={canSeeMemberMoney} />
                      {i < formerMembers.length - 1 && (
                        <View style={[styles.sep, { backgroundColor: colors.border, marginHorizontal: 16 }]} />
                      )}
                    </View>
                  ))}
                </Card>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  They no longer count towards the group, and their savings were
                  refunded when they left. Their contributions and transactions
                  stay in the group&apos;s records.
                </Text>
              </View>
            )}
          </View>
        )}

        {tab === "projects" && (
          <View style={{ paddingHorizontal: 20 }}>
            {/* One form, two jobs: it sits at the top of the tab when adding,
                and the same fields open in place under the project being
                edited. Both offer every field a project is created with. */}
            {projectFormFor === "new" && canManageProjects && (
              <ProjectForm
                title="NEW PROJECT"
                colors={colors}
                name={projectName}
                target={projectTarget}
                deadline={projectDeadline}
                error={projectError}
                saving={savingProject}
                pickerOpen={deadlinePickerOpen}
                setPickerOpen={setDeadlinePickerOpen}
                onChangeName={(t) => { setProjectName(t.slice(0, 80)); setProjectError(""); }}
                onChangeTarget={(t) => { setProjectTarget(t.replace(/[^0-9.]/g, "")); setProjectError(""); }}
                onChangeDeadline={(d) => { setProjectDeadline(d); setProjectError(""); }}
                onSubmit={onSaveProject}
                onCancel={closeProjectForm}
                submitLabel="Add project"
                style={{ marginBottom: 12 }}
              />
            )}

            {projects.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>No projects yet</Text>
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13, lineHeight: 20 }}>
                  {canManageProjects
                    ? "Add what the group is raising money for. Members pick a project every time they give."
                    : "The Chairperson hasn't opened a project yet. Members give toward a named project, so there is nothing to give to right now."}
                </Text>
              </Card>
            ) : (
              <Card padding={16}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  SAVING FOR
                </Text>
                {projects.map((p, i) => (
                  <View
                    key={p.id}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: i < projects.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                    testID={`project-row-${p.id}`}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, flex: 1 }}>
                        {p.name}
                      </Text>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                        {formatZMW(p.collected)}
                      </Text>
                      {/* An archived project is history — the API refuses to
                          edit one, so no pencil is offered for it. */}
                      {canManageProjects && p.status !== "archived" && (
                        <Pressable
                          onPress={() =>
                            projectFormFor === p.id ? closeProjectForm() : openEditProject(p)
                          }
                          hitSlop={10}
                          style={{ paddingLeft: 12 }}
                          testID={`project-edit-${p.id}`}
                        >
                          {projectFormFor === p.id ? (
                            <X size={16} color={colors.textMuted} />
                          ) : (
                            <Pencil size={16} color={colors.primary} />
                          )}
                        </Pressable>
                      )}
                    </View>
                    {p.targetAmount ? (
                      <View style={{ marginTop: 8 }}>
                        <ProgressBar progress={Math.min(1, p.collected / p.targetAmount)} />
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                          {Math.round((p.collected / p.targetAmount) * 100)}% of{" "}
                          {formatZMW(p.targetAmount)} goal
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        No goal set · raised so far
                      </Text>
                    )}
                    {p.deadline ? (
                      <Text
                        style={{
                          color: projectOverdue(p) ? colors.danger : colors.textMuted,
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {projectOverdue(p) ? "Deadline passed" : "Deadline"}{" "}
                        {formatProjectDeadline(p.deadline)}
                      </Text>
                    ) : null}

                    {projectFormFor === p.id && canManageProjects && (
                      <ProjectForm
                        title="EDIT PROJECT"
                        colors={colors}
                        name={projectName}
                        target={projectTarget}
                        deadline={projectDeadline}
                        error={projectError}
                        saving={savingProject}
                        pickerOpen={deadlinePickerOpen}
                        setPickerOpen={setDeadlinePickerOpen}
                        onChangeName={(t) => { setProjectName(t.slice(0, 80)); setProjectError(""); }}
                        onChangeTarget={(t) => { setProjectTarget(t.replace(/[^0-9.]/g, "")); setProjectError(""); }}
                        onChangeDeadline={(d) => { setProjectDeadline(d); setProjectError(""); }}
                        onSubmit={onSaveProject}
                        onCancel={closeProjectForm}
                        submitLabel="Save changes"
                        bare
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </View>
                ))}
                <View style={[styles.rowBetween, { marginTop: 14 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>
                    Total raised
                  </Text>
                  <Text style={{ color: colors.textMain, fontWeight: "800", fontSize: 15 }}>
                    {formatZMW(totalRaised)}
                  </Text>
                </View>
              </Card>
            )}

            {/* The only way to open a project, and the Chairperson's alone —
                it sits at the end of the list because that is where someone
                reading the projects looks for the way to add one. The API
                refuses everyone else too. */}
            {canManageProjects && projectFormFor !== "new" && (
              <Pressable
                onPress={openAddProject}
                style={[styles.addProjectBtn, { borderColor: colors.primary }]}
                testID="projects-add-inline-btn"
              >
                <Plus size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                  {projects.length === 0 ? "Add a project" : "Add another project"}
                </Text>
              </Pressable>
            )}

            <View style={{ height: 14 }} />
            <Button
              label="Give toward a project"
              onPress={() =>
                router.push({ pathname: "/contribute", params: { groupId: id } })
              }
              testID="group-give-btn"
            />
          </View>
        )}

        {tab === "contributions" && !isProjectFund && (
          <View style={{ paddingHorizontal: 20 }}>
            <Button
              label="Make a contribution"
              onPress={() =>
                router.push({ pathname: "/contribute", params: { groupId: id } })
              }
              testID="group-contribute-btn"
            />
            <View style={{ height: 16 }} />

            {/* Cycle status summary */}
            <Card padding={16} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <StatusSummaryCol count={paidCount} label="Paid" color={colors.success} />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <StatusSummaryCol count={overdueCount} label="Overdue" color={colors.danger} />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <StatusSummaryCol count={pendingCount} label="Pending" color={colors.warning} />
              </View>
            </Card>

            {/* Member grid */}
            <Card padding={16} style={{ marginBottom: 12 }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                CONTRIBUTION STATUS THIS CYCLE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {cycleStatus.map(({ member, status }, i) => {
                  const bg =
                    status === "paid"
                      ? colors.success
                      : status === "overdue"
                      ? colors.danger
                      : colors.warning;
                  const initials = member.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase();
                  const firstName = member.name.split(" ")[0];
                  return (
                    <View
                      key={member.userId ?? member.id ?? member.phone ?? String(i)}
                      style={{ width: 48, alignItems: "center" }}
                      testID={`contrib-chip-${member.userId ?? member.id ?? member.phone ?? i}`}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                          {initials}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 10,
                          marginTop: 4,
                          textAlign: "center",
                        }}
                        numberOfLines={1}
                      >
                        {firstName}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {/* Legend */}
              <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
                <LegendDot color={colors.success} label="Paid" colors={colors} />
                <LegendDot color={colors.danger} label="Overdue" colors={colors} />
                <LegendDot color={colors.warning} label="Pending" colors={colors} />
              </View>
              {effectiveRole !== "Member" && (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontStyle: "italic",
                    marginTop: 10,
                    lineHeight: 17,
                  }}
                >
                  Overdue members will be automatically flagged for a penalty at cycle end.
                </Text>
              )}
            </Card>

            <Card padding={16}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                THIS CYCLE
              </Text>
              {groupTxn
                .filter((t) => t.type === "contribution")
                .slice(0, 5)
                .map((t) => (
                  <View key={t.id} style={[styles.contribRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                        {t.note ?? "Contribution"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t.date}</Text>
                    </View>
                    <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                      {formatZMW(t.amount)}
                    </Text>
                  </View>
                ))}
            </Card>
          </View>
        )}

        {tab === "loans" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Button
              label="Request a loan"
              onPress={() => router.push("/loan")}
              testID="group-loan-btn"
            />
            <View style={{ height: 14 }} />
            {groupLoans.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>No active loans</Text>
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
                  No members currently have active loans in this group.
                </Text>
              </Card>
            ) : (
              <Card padding={16}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  ACTIVE LOANS IN GROUP
                </Text>
                <View style={{ marginTop: 8 }}>
                  {groupLoans.map((loan) => (
                    <LoanLine
                      key={loan.id}
                      name={loan.memberName}
                      amount={loan.principal}
                      balance={loan.outstanding}
                      colors={colors}
                    />
                  ))}
                </View>
              </Card>
            )}
          </View>
        )}

        {tab === "approvals" && (
          <View style={{ paddingHorizontal: 20 }}>
            {groupApprovals.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>No pending approvals</Text>
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
                  This group is all caught up.
                </Text>
              </Card>
            ) : (
              groupApprovals.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push("/approvals")}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginBottom: 12 }]}
                  testID={`group-approval-${a.id}`}
                >
                  <Card padding={16}>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                      {a.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {a.description}
                    </Text>
                    <View style={{ marginTop: 12 }}>
                      <ProgressBar
                        progress={a.votesFor / a.totalVoters}
                        color={colors.primary}
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                        {a.votesFor}/{a.totalVoters} approved
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
            <Button
              label="Open approval center"
              variant="outline"
              onPress={() => router.push("/approvals")}
            />
          </View>
        )}

        {tab === "reports" && (
          <View style={{ paddingHorizontal: 20 }}>
            {!isProjectFund && (
            <Pressable
              // The permanent record, and the first thing on the tab: "what did
              // we each get" is the question members bring here, and it is
              // answered by names and amounts, not by the analytics below it.
              onPress={() =>
                router.push({ pathname: "/share-out-history", params: { groupId: id } })
              }
              testID="group-shareout-history-btn"
            >
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <History size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Past share-outs
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Every distribution, and who got what
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
            )}
            {!isProjectFund && <View style={{ height: 12 }} />}
            <Pressable
              onPress={() => router.push({ pathname: "/reports", params: { groupId: id } })}
              testID="group-reports-btn"
            >
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <FileBarChart size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        View detailed reports
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Savings trends, loans and repayment rate
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
            <View style={{ height: 12 }} />
            <Pressable
              onPress={() => router.push({ pathname: "/statement", params: { groupId: id } })}
              testID="group-statement-btn"
            >
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <FileText size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        My statement
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Savings balance and activity for this group
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
            {/* A project-fund group never shares out — there is no pot to
                split and no forecast to make. */}
            {!isProjectFund && (
            <>
            <View style={{ height: 12 }} />
            <Pressable
              // Carry the group: the share-out screen resolves everything from
              // groupId, and without it lands on an empty projection.
              onPress={() => router.push({ pathname: "/share-out", params: { groupId: id } })}
              testID="group-shareout-btn"
            >
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <Wallet size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Share-out forecast
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        See projected member allocations
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
            </>
            )}
          </View>
        )}

        {tab === "governance" && (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Carry the group: governance falls back to the caller's first
                group otherwise, which is the wrong constitution to read. */}
            <Pressable
              onPress={() => router.push(`/governance?groupId=${group.id}`)}
              testID="group-governance-btn"
            >
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <Scale size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Group rules & voting
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Manage thresholds, propose changes
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>

            {/* Deleting the group. Admins only — the Chairperson alone in a
                church group, and the API refuses anyone else either way — and
                it says plainly that the records outlive the group, because that
                is the question anyone about to tap this is asking. */}
            {canDeleteGroup && (
              <>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.2,
                    marginTop: 22,
                    marginBottom: 8,
                  }}
                >
                  DANGER ZONE
                </Text>
                <Card padding={18}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.danger + "1A" }]}>
                      <Trash2 size={20} color={colors.danger} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Delete this group
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {soloAdmin
                          ? "Closes the group for everyone"
                          : "The group's other admins vote on it"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 19, marginTop: 12 }}>
                    Records are kept. Contributions, receipts, penalties and statements all
                    stay in the app and can still be opened from Transactions — deleting the
                    group only closes it, it never erases what happened in it.
                  </Text>
                  {(group.totalSavings ?? 0) > 0 || (group.loanCirculation ?? 0) > 0 ? (
                    <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 19, marginTop: 10 }}>
                      The group still holds money. Share out and settle any open loans first —
                      it cannot be deleted while savings or loans are still in it.
                    </Text>
                  ) : null}
                  <View style={{ marginTop: 14 }}>
                    <Button
                      label={
                        deletionPending
                          ? "Deletion awaiting votes"
                          : soloAdmin
                            ? "Delete group"
                            : "Propose deletion"
                      }
                      variant="danger"
                      size="md"
                      loading={deletingGroup}
                      disabled={deletingGroup || deletionPending}
                      onPress={() => onDeleteGroup(group.name, soloAdmin)}
                      testID="group-delete-btn"
                    />
                  </View>
                </Card>
              </>
            )}
          </View>
        )}
      </ScrollView>
      </View>

      <Modal
        visible={sheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setSheetVisible(false)}
          />
          <ScrollView
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "80%",
            }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />
            {selectedMember && (
              <>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Avatar name={selectedMember.name} size={52} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 18 }}>
                      {selectedMember.name}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <StatusBadge
                        label={selectedMember.role}
                        variant={
                          selectedMember.role === "Chairperson"
                            ? "primary"
                            : selectedMember.role === "Treasurer"
                              ? "warning"
                              : selectedMember.role === "Secretary"
                                ? "info"
                                : "neutral"
                        }
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                      {selectedMember.phone}
                    </Text>
                  </View>
                  <Pressable onPress={() => Linking.openURL(`tel:${selectedMember.phone}`)}>
                    <Phone size={20} color={colors.primary} />
                  </Pressable>
                </View>

                {/* The same rule as the members list: in a church group only the
                    leadership sees what one person has given. */}
                {canSeeMemberMoney && (
                  <>
                  {/* Savings */}
                  <Card padding={16} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                      SAVINGS IN THIS GROUP
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Total saved</Text>
                        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                          {formatZMW(selectedMember.savings)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Contributions</Text>
                        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                          {selectedMember.contributions}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Active loan</Text>
                        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                          {selectedMember.loanActive ? formatZMW(selectedMember.loanActive) : "None"}
                        </Text>
                      </View>
                    </View>
                  </Card>
                  </>
                )}

                {/* Loan progress */}
                {selectedMember.loanActive != null && selectedMember.loanActive > 0 && (
                  <Card padding={16} style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                      ACTIVE LOAN
                    </Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16, marginTop: 8 }}>
                      {formatZMW(selectedMember.loanActive)}
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <ProgressBar
                        progress={1 - selectedMember.loanActive / (selectedMember.loanActive * 1.5)}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                      {formatZMW(selectedMember.loanActive)} remaining
                    </Text>
                  </Card>
                )}

                {/* Their giving, transaction by transaction — held to the same
                    rule as the totals above. */}
                {canSeeMemberMoney && (
                  <>
                  {/* Recent activity */}
                  <Card padding={16} style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                      RECENT ACTIVITY
                    </Text>
                    {(() => {
                      const memberTxns = groupTxn.filter(
                        (t) => String(t.memberId) === String(selectedMember.userId ?? selectedMember.id)
                      );
                      const display = memberTxns.length > 0 ? memberTxns.slice(0, 3) : groupTxn.slice(0, 3);
                      if (display.length === 0) {
                        return (
                          <Text style={{ color: colors.textMuted, marginTop: 10, fontSize: 13 }}>
                            No recent activity
                          </Text>
                        );
                      }
                      return display.map((t) => (
                        <View
                          key={t.id}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.date}</Text>
                          <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 13 }}>
                            {formatZMW(t.amount)}
                          </Text>
                        </View>
                      ));
                    })()}
                  </Card>
                  </>
                )}

                {/* Admin actions */}
                {group.yourRole !== "Member" && (
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 20, marginBottom: 8 }}>
                      ADMIN ACTIONS
                    </Text>
                    {/* Nothing is due in a project-fund group, so there is no
                        obligation to breach and no penalty to issue. */}
                    {!isProjectFund && (
                    <Card padding={14} style={{ marginBottom: 10, backgroundColor: colors.surface }}>
                      <Pressable
                        style={{ flexDirection: "row", alignItems: "center" }}
                        onPress={() => {
                          setSheetVisible(false);
                          router.push({
                            pathname: "/record-violation",
                            params: {
                              groupId: group.id,
                              memberId: String(selectedMember.userId ?? selectedMember.id),
                              memberName: selectedMember.name,
                              groupName: group.name,
                            },
                          });
                        }}
                        testID="member-violation-btn"
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warning + "20", alignItems: "center", justifyContent: "center" }}>
                          <AlertTriangle size={20} color={colors.warning} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                            Record violation
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            Issue a manual penalty to this member
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textMuted} />
                      </Pressable>
                    </Card>
                    )}
                    {/* Removing someone moves their money, so it is a proposal,
                        not an action: the other admins vote and the savings are
                        refunded on the way out. Never removes anyone on tap. */}
                    <Card padding={14} style={{ backgroundColor: colors.surface }}>
                      {selectedMember.role !== "Member" ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                            <ShieldCheck size={20} color={colors.textMuted} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                              {selectedMember.role}s can&apos;t be removed
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                              Hand the role to someone else first
                            </Text>
                          </View>
                        </View>
                      ) : removalPending.has(String(selectedMember.id)) ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warning + "20", alignItems: "center", justifyContent: "center" }}>
                            <Clock size={20} color={colors.warning} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                              Removal awaiting approval
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                              The other admins decide in the approval center
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          style={{ flexDirection: "row", alignItems: "center", opacity: removingId === selectedMember.id ? 0.5 : 1 }}
                          disabled={removingId === selectedMember.id}
                          onPress={() => onRemoveMember(selectedMember)}
                          testID="member-remove-btn"
                        >
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.danger + "20", alignItems: "center", justifyContent: "center" }}>
                            <UserMinus size={20} color={colors.danger} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>
                              Propose removal
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                              Other admins vote · savings refunded on the way out
                            </Text>
                          </View>
                          <ChevronRight size={18} color={colors.danger} />
                        </Pressable>
                      )}
                    </Card>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={isAdmin && inviteOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => { setInviteOpen(false); setInvitePhone(""); setInviteRole("Member"); setInviteError(""); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => { setInviteOpen(false); setInvitePhone(""); setInviteRole("Member"); setInviteError(""); }}
          />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 18, marginBottom: 4 }}>
              Invite a member
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24, lineHeight: 18 }}>
              Enter their Zambian phone number and we&apos;ll send them an SMS invitation to join {group.name}.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 }}>
              PHONE NUMBER
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: inviteError ? colors.danger : colors.border,
                paddingHorizontal: 14,
                backgroundColor: colors.surface,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "600", marginRight: 8 }}>+260</Text>
              <TextInput
                placeholder="97X XXX XXX"
                keyboardType="phone-pad"
                maxLength={9}
                value={invitePhone}
                onChangeText={(t) => { setInvitePhone(t.replace(/\D/g, "").slice(0, 9)); setInviteError(""); }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  color: colors.textMain,
                  fontSize: 16,
                }}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 18, marginBottom: 12 }}>
              ROLE IN THIS GROUP
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {(["Member", "Treasurer", "Secretary"] as Role[]).map((r) => {
                // Treasurer and Secretary are single seats. Offering one that is
                // already filled would push a second holder onto the group.
                const taken =
                  r !== "Member" &&
                  (group.members ?? []).some(
                    (m: any) => m.status !== "removed" && m.role === r
                  );
                const active = inviteRole === r;
                return (
                  <Pressable
                    key={r}
                    disabled={taken}
                    onPress={() => { setInviteRole(r); setInviteError(""); }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      opacity: taken ? 0.45 : 1,
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                    testID={`invite-role-${r.toLowerCase()}`}
                  >
                    <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>
                      {r}
                      {taken ? " (filled)" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {inviteRole !== "Member" ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
                A {inviteRole.toLowerCase()} can vote on approvals for this group. They get the role
                once they accept the invite.
              </Text>
            ) : null}

            {inviteError ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>
                {inviteError}
              </Text>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 20, lineHeight: 18 }}>
                The invited person will receive an SMS and see your invitation in their Chuma app.
              </Text>
            )}
            <View style={{ height: inviteError ? 20 : 0 }} />
            <Button
              label="Send invite"
              loading={inviting}
              disabled={inviting}
              onPress={async () => {
                if (invitePhone.length < 9) {
                  setInviteError("Enter a 9-digit number after +260");
                  return;
                }
                // Catch it here as well as on the server, so the admin sees the
                // problem without waiting on a round trip.
                const existing = (group.members ?? []).find(
                  (m: any) =>
                    m.status !== "removed" && phoneKey(m.phone) === phoneKey(invitePhone)
                ) as any;
                if (existing) {
                  if (existing.status === "pending") {
                    // Already invited and still waiting — the useful action here
                    // is to send the invitation again, not to refuse outright.
                    Alert.alert(
                      "Already invited",
                      `${existing.name || "This number"} was invited but hasn't joined yet. Send the invitation again?`,
                      [
                        { text: "Not now", style: "cancel" },
                        {
                          text: "Resend",
                          onPress: async () => {
                            setInvitePhone("");
                            setInviteRole("Member");
                            setInviteError("");
                            setInviteOpen(false);
                            await onResendInvite(existing as Member);
                          },
                        },
                      ]
                    );
                    return;
                  }
                  setInviteError(
                    `${existing.name || "This number"} is already a member of this group.`
                  );
                  return;
                }
                const full = `+260${invitePhone}`;
                setInviting(true);
                setInviteError("");
                try {
                  // send the normalized phone with country code; backend also normalizes
                  await inviteMember(id, full, inviteRole);
                  Alert.alert(
                    "Invite sent",
                    `${full} has been invited as ${inviteRole === "Member" ? "a member" : `${inviteRole.toLowerCase()}`}. They'll see the invitation after signing up with this number.`
                  );
                  setInvitePhone("");
                  setInviteRole("Member");
                  setInviteOpen(false);
                  await load(); // refresh so the pending member shows in the members list
                } catch (e: any) {
                  setInviteError(e?.message || "Could not send invite. Please try again.");
                } finally {
                  setInviting(false);
                }
              }}
              testID="members-invite-send-btn"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {locked && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
            {/* Back icon — top left, respects status bar */}
            <Pressable
              onPress={() => router.back()}
              testID="group-locked-back-btn"
              style={{
                position: "absolute",
                top: insets.top + 12,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
            </Pressable>

            {/* Centered lock content */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: insets.bottom }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={32} color={colors.textMuted} />
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 16,
                }}
              >
                {awaitingFirstPayment ? "Not active yet" : "Group locked"}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 8,
                  paddingHorizontal: 32,
                  lineHeight: 21,
                }}
              >
                {awaitingFirstPayment
                  ? canPayFee
                    ? `${group.name} opens once its ${formatZMW(amountOwed)} registration fee is received. Nothing can be added or contributed until then.`
                    : "This group has not started yet — its registration fee is still being confirmed. Please check back soon."
                  : canPayFee
                    ? `This group is suspended because the monthly fee is unpaid. Pay ${formatZMW(amountOwed)} (${monthsOwed} month${monthsOwed === 1 ? "" : "s"}) to reactivate it.`
                    : "This group is suspended pending the monthly fee payment from the group admins. Please check back soon."}
              </Text>
              {canPayFee && (
                <View style={{ marginTop: 24 }}>
                  <Button
                    label={
                      awaitingFirstPayment
                        ? `Pay ${formatZMW(amountOwed)} registration fee`
                        : `Pay ${formatZMW(amountOwed)} now`
                    }
                    onPress={() => router.push(`/group-fee?groupId=${group.id}`)}
                    testID="group-pay-fee-btn"
                  />
                </View>
              )}
              {/* The other way out. A group created by mistake, or one whose
                  fee is never going to be paid, is otherwise a locked screen
                  the founder can do nothing with — and this overlay is the
                  only screen they can reach inside it. */}
              {isAdmin && (
                <Pressable
                  onPress={() => onDeleteGroup(group.name, soloAdmin)}
                  disabled={deletingGroup || deletionPending}
                  style={{ marginTop: 18, paddingVertical: 10, paddingHorizontal: 16 }}
                  testID="group-delete-locked-btn"
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 14,
                      fontWeight: "700",
                      textDecorationLine: "underline",
                      opacity: deletingGroup || deletionPending ? 0.5 : 1,
                    }}
                  >
                    {deletionPending ? "Deletion awaiting votes" : "Delete this group"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const StatusSummaryCol = ({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={{ color, fontSize: 24, fontWeight: "700" }}>{count}</Text>
    <Text style={{ color, fontSize: 12, fontWeight: "600", marginTop: 2 }}>{label}</Text>
  </View>
);

const LegendDot = ({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
  </View>
);

/**
 * The fields a project is made of — name, goal and deadline — used both to add
 * one and to edit one. The goal and the deadline are optional in the same way
 * they are at group creation: blank means "no goal set" and "collect for as
 * long as it takes", and clearing either one later says the same thing.
 *
 * `bare` drops the Card wrapper for the in-place edit form, which already sits
 * inside the projects card.
 */
const ProjectForm = ({
  title,
  colors,
  name,
  target,
  deadline,
  error,
  saving,
  pickerOpen,
  setPickerOpen,
  onChangeName,
  onChangeTarget,
  onChangeDeadline,
  onSubmit,
  onCancel,
  submitLabel,
  bare,
  style,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
  name: string;
  target: string;
  deadline: string;
  error: string;
  saving: boolean;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  onChangeName: (t: string) => void;
  onChangeTarget: (t: string) => void;
  onChangeDeadline: (day: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  bare?: boolean;
  style?: any;
}) => {
  const inputStyle = {
    color: colors.textMain,
    backgroundColor: colors.surfaceSecondary,
    borderColor: error ? colors.danger : colors.border,
  };

  const body = (
    <>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{title}</Text>
      <TextInput
        style={[styles.projectInput, inputStyle]}
        value={name}
        onChangeText={onChangeName}
        placeholder="e.g. Church building"
        placeholderTextColor={colors.textMuted}
        testID="project-name-input"
      />
      <View style={{ height: 10 }} />
      <TextInput
        style={[styles.projectInput, inputStyle]}
        value={target}
        onChangeText={onChangeTarget}
        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
        placeholder="Goal in Kwacha (optional)"
        placeholderTextColor={colors.textMuted}
        testID="project-target-input"
      />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.projectInput, styles.projectDeadlineBtn, inputStyle]}
          testID="project-deadline-input"
        >
          <Calendar size={16} color={deadline ? colors.primary : colors.textMuted} />
          <Text
            style={{
              color: deadline ? colors.textMain : colors.textMuted,
              fontSize: 15,
              marginLeft: 10,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {deadline ? formatISODay(deadline) : "Deadline (optional)"}
          </Text>
        </Pressable>
        {deadline ? (
          <Pressable
            onPress={() => onChangeDeadline("")}
            hitSlop={10}
            style={{ paddingLeft: 12 }}
            testID="project-deadline-clear"
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {pickerOpen && (
        <DateTimePicker
          value={deadline ? parseISODay(deadline) : startOfToday()}
          mode="date"
          minimumDate={startOfToday()}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onValueChange={(_e: unknown, date: Date) => {
            setPickerOpen(false);
            if (date) onChangeDeadline(toISODay(date));
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      )}

      {error ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>{error}</Text>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
          Leave the goal and deadline blank if the group is simply collecting until
          it&apos;s enough.
        </Text>
      )}

      <View style={{ height: 12 }} />
      <Button
        label={submitLabel}
        loading={saving}
        disabled={saving}
        onPress={onSubmit}
        testID="project-submit-btn"
      />
      <Pressable
        onPress={onCancel}
        disabled={saving}
        style={{ paddingVertical: 12, alignItems: "center" }}
        testID="project-cancel-btn"
      >
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
      </Pressable>
    </>
  );

  return bare ? (
    <View style={style}>{body}</View>
  ) : (
    <Card padding={16} style={style}>
      {body}
    </Card>
  );
};

const HeroStat = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", letterSpacing: 0.3 }}>
      {label}
    </Text>
    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 }}>{value}</Text>
  </View>
);

const RuleRow = ({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={styles.ruleRow}>
    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  </View>
);

const MemberRow = ({
  member,
  colors,
  removalPending,
  showMoney = true,
}: {
  member: Member;
  colors: ReturnType<typeof useTheme>["colors"];
  /** A removal for this member is waiting on the other admins' votes. */
  removalPending?: boolean;
  /** False hides what this person has put in — see canSeeMemberMoney. */
  showMoney?: boolean;
}) => {
  const roleVariant: "primary" | "warning" | "info" | "neutral" =
    member.role === "Chairperson"
      ? "primary"
      : member.role === "Treasurer"
        ? "warning"
        : member.role === "Secretary"
          ? "info"
          : "neutral";
  return (
    <View style={styles.memberRow}>
      <Avatar name={member.name} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
          {member.name}
        </Text>
        {showMoney ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {formatZMW(member.savings, { compact: true })} saved
            {removalPending ? " · removal pending" : ""}
          </Text>
        ) : null}
      </View>
      <StatusBadge
        label={removalPending ? "Removal pending" : member.role}
        variant={removalPending ? "warning" : roleVariant}
      />
    </View>
  );
};

/** One former member, as the group's record of them. Read-only by design. */
const FormerMemberRow = ({
  member,
  colors,
  showMoney = true,
}: {
  member: Member;
  colors: ReturnType<typeof useTheme>["colors"];
  /** False hides what they put in — see canSeeMemberMoney. */
  showMoney?: boolean;
}) => {
  const left = formatDate(member.exitedAt);
  const saved = member.exitSavings ?? 0;
  const cleared = member.exitLoanCleared ?? 0;
  return (
    <View style={styles.memberRow}>
      <Avatar name={member.name} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }}
          numberOfLines={1}
        >
          {member.name}
        </Text>
        {/* The number they were on the books under. Kept visible so the group
            can still identify and reach someone after they've gone — names
            repeat in a village, numbers don't. */}
        {member.phone ? (
          <Text
            style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}
            numberOfLines={1}
          >
            {member.phone}
          </Text>
        ) : null}
        {showMoney ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {formatZMW(saved, { compact: true })} saved · {member.contributions ?? 0}{" "}
            contribution{(member.contributions ?? 0) === 1 ? "" : "s"}
            {cleared > 0 ? ` · ${formatZMW(cleared, { compact: true })} to loan` : ""}
          </Text>
        ) : null}
        {left ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            Left {left}
          </Text>
        ) : null}
      </View>
      <StatusBadge label="Former" variant="neutral" />
    </View>
  );
};

const PendingInviteRow = ({
  member,
  colors,
  busy,
  canManage,
  onResend,
  onCancel,
}: {
  member: Member;
  colors: ReturnType<typeof useTheme>["colors"];
  busy: boolean;
  canManage: boolean;
  onResend: () => void;
  onCancel: () => void;
}) => {
  const ago = invitedAgo(member.lastInviteSentAt ?? member.invitedAt);
  const displayName = inviteDisplayName(member);
  return (
    // No avatar here, unlike a member row: an invitee often has no account yet,
    // so the circle is initials of a phone number — and the row needs the width
    // for the badge and the two actions.
    <View style={[styles.memberRow, { opacity: busy ? 0.5 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          Invited as {member.role}
          {ago ? ` · sent ${ago}` : ""}
        </Text>
      </View>
      <StatusBadge label="Pending" variant="warning" />
      {canManage && (
        <View style={{ flexDirection: "row", marginLeft: 8 }}>
          <Pressable
            onPress={onResend}
            disabled={busy}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: colors.primary + "1A",
              alignItems: "center",
              justifyContent: "center",
            }}
            testID={`invite-resend-${member.id}`}
          >
            <Send size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              marginLeft: 6,
              backgroundColor: colors.danger + "1A",
              alignItems: "center",
              justifyContent: "center",
            }}
            testID={`invite-cancel-${member.id}`}
          >
            <X size={16} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const LoanLine = ({
  name,
  amount,
  balance,
  colors,
}: {
  name: string;
  amount: number;
  balance: number;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.textMain, fontWeight: "600" }}>{name}</Text>
      <Text style={{ color: colors.textMain, fontWeight: "700" }}>{formatZMW(balance)}</Text>
    </View>
    <View style={{ marginTop: 8 }}>
      <ProgressBar progress={1 - balance / amount} />
    </View>
    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
      {formatZMW(balance)} remaining of {formatZMW(amount)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  heroLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500", letterSpacing: 0.3 },
  heroAmount: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 4, letterSpacing: -0.5 },
  // The group's total, sitting under the member's own headline figure:
  // pill-backed so the two never read as one running total.
  heroYouRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroYouLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  heroYouValue: { color: "#fff", fontSize: 13, fontWeight: "800", marginLeft: 10 },
  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  divider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 14 },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ruleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  iconSm: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: { height: 1, marginVertical: 4 },
  cardLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  cardValue: { fontSize: 13, fontWeight: "700" },
  tabsRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 },
  projectInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  projectDeadlineBtn: { flex: 1, flexDirection: "row", alignItems: "center" },
  addProjectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 14,
  },
  contribRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  helperText: { fontSize: 11, textAlign: "center", marginTop: 12 },
});
