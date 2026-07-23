// Shared PDF / CSV export helpers.
//
// Every export in the app funnels through here so the branding, the print /
// share plumbing and the platform differences live in exactly one place.
// On native we render to a file and hand it to the share sheet; on web there
// is no share sheet, so we open the browser print dialog (PDF) or trigger a
// file download (CSV).

import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatZMW } from "@/src/utils/currency";
import { TxnItem } from "@/src/types";
import type { Statement } from "@/src/services/statement";

/** Chuma mark, inlined so generated PDFs stay self-contained (no network). */
export const CHUMA_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALIAAACgCAYAAAColDb4AAAACXBIWXMAAAsSAAALEgHS3X78AAALQUlEQVR4nO2dT4wbVx3Hvx7ylyasKUQFQhRHiSgClDVIVEiuyCwVviC65m6R4URvuMeKQ50TR5IzBxzJByQ4bEBcLKFMDhaRkGC3CAQVIbZKBGlatIaoabZlzOHN7E4cz/93njdvvh/Jysb2m3nr/fjN7/3em/dq8/kcpBqMhi0TgAmgCaDue2kXgA1g0O6Od1deMQnUKLLejIatDgDvsRbx9hmAXrs7HuRcLelQZA0ZDVtNABaEvGdTHOJauzvuSa1UzlBkTZAg7yLfaXfHWxKOsxIocokZDVsNCHktyJHXzwxAoywx86GiK0CS4crbgZB3PcdTrQHoAejneA5pUOQSMBq26hDy9pCvvIuURmSGForik7cDYLPAqpQiVmaLrBi+dNnlouvi0gFAkUk0CXO9q8YsugJxYGhREL50mQX15F3ky+3ueLvoSoTBFnmFuBmHHuTleleFCYAiV5kVpsvypAPgatGVCIMi50CB6bK8uFR0BaJgjCwJhdJleaF0Go4tckYUTJflhQmF03AUOQXuvF4LaqbL8sIsugJhMLSISQ6zy8rIx1WdRMQWOYScZ5eVkQ6AQdGVWAZFXkCTdFlemKDI6uLLOFgoQaqpQMyiKxBEpWPk0bBlQd90WV4oOVwtu0U2cXCHbt39GQAm7sNjF+FDnmbIa1sRZUNRfIJOGTDh+/wdx2lAXMn87AKwDcNYmfBZRW7gQIqwS3LWy/UtCIG38OQXIhZuxsGb40B5s2HCHa52Jb4b9EbHcWYQf7O+YRiTPCuVVmRPjLwGAbwPwHb/TZzyYbosN/xhWCPivWsQjlx2HOcahNC5pO+Sxsh1iG9jHgJ78nqPxPgyDj1Q3jzZaHfHdlSLvIQdAGYeMidpkb0cosxLs0x5LTBdtio6EDHwxHGc64jfsK0DsB3HkS5zXJH7AF6XeN6pe8y0YYPuE3RUx/T9nPQKvQ7RIHYk1idWaDGAvFDiFoTAdprCTJcpxf5wteM4aXK4G4Zh2LIqE9UiDyBP4leRYnI202XKYuIgHNxB8rCuh5QN2jLCRJaZldhAgkqX7H62qtLEgcgTJBd503GcuqxYOUhkE8CPZZwAwBXElHg0bPXAjENZ8Au4hXThXhOSWuVlItchd2JI0mNNkGLQg6wUu90d+8PELaS7rcuEJJGXdfb6kJuhqEk8FlEUx3HqOBiAAsQwtr/VNiFaYH+oeMUwjL6M8y+K3ECyBHesc0g+HikxjuNYEJ3+NUgU2Vj4v5SDLiA1X0jKjWEYA4gGc0fqcX0/15HP0LOVwzFJiXEzFSYkLvriF9mSddAFNqH44h5k9RiGsWsYhrS7sv0x8jbynaswhchg2BHvi3qdkKfwRG5AfiePVJspDlKp2xANVG4T7T2Re5A3AEJIEN5VeQDJYwVejNwMfRchcjgLMUZxFyJDVpd1YK9Fzjs+JmQZU4j0bOaQwxO5urdSk6KZQUIqzkD0fVeE5MkaREewkeUgFJmowBoyTlRbHKImpCguIcOgHEUmKtFPW5AiE5U4i5SpYIpMVMNKU4giE9Uw0xSiyEQ1Ug3MUWSiImbSAgYU39GSVJLEczAMpFiyipCcSZy5YGhBtIAiEy2gyEQLKDLRAopMtIAiEy2gyEQLKDLRAopMVGSStABFJipiJy1AkYlqXEeKFln2XtREbbxlrFTD25vcRsq1/zyRZ+CmM7oxxcEG9N5DWzyRt5F943NSPJ68A2gu7iIMLfTA20l2UGw1ioMil5sZxEqqg4LrUTgUubzcgLjjmDdGgCKXkRmEwNK2LdABilwudiAkjuzIjYatBg72tvNuHSprh95LG9oABu3ueLL4Bm9ZWRvl/SWrwg6EmKGhxGjYspBuF9IycQOA1e6O9z8LilwOIiV2Be6jOvt4zwA0vdaZoYX6hEo8GrbqEPFy1RqiNYjfuwlwroXqeB27IImbELFj1ST2WHevRBRZcSwEdOxciW1wakEHoMgqcw0BKTZK/ASbADt7qjKFiP2eCincmHgCSuznHFtkNekjOEOxBUq8SIMiq4e3O+hTjIatHnjlXApFVo/+sifdkGLpa4R5ZNUIbI0hRusShRT/+o+BybtzvLXr7D93pm7gS58BThzVa49QiqwWQVmKOoTIsXjjXg2/+vMe3vj3B4Hv+dpzR/DyFw/j/Ck9hKbIajEIeN5CjNb44eMahr/7H27eez/yRLfv7+H2/T1869xxfPeFWqJKqghFVocZgme1WVGFHz6u4Ue/eYy//ffDRCf99d1HeG/vGF55sdzdJa/27AkXj73sSXc6ZuRMtp/89oPEEnvcvPc+fv6HcocY5f4a6kVQa2xGFbx9t4bb9/cynfwXbz7CnQflDTEosjoEiRy5n8bP/vhISgV++afgzqHqUGR1CBrJCxX5zoMa/vnICXtLbG7f38PDx+VslSmy+oSK/Jf7cmPbv78j9XArgyKrQ1BoEZp2e/c9uSL/9W05rfuqocjqkOq2/rdm6TIVukGRS86ZNQ4FABRZJcw0hY4flluJM/VyKlHOWleLWdiLX/ms3D9h4xPMWpBsBG0kHroYy/lTc3z6uJw/48VnD+NTH2Nnj2QjKM0WuarQy88fl1KBb3/hiJTjFAFFVofUIn/j+TkuPpstWN44fQwXT5d3vgVFVocgkWMtVviDrx/BhZPpMhgXTh5C96sfSVVWFSiyOpwF0Fh80l3f7EZU4RNH53jtpaOJW+aN08fw2ktHS3/HiIElHx4pjE7A84M4hU8cneOH3zyM7zefiewAXjh5CK++8AxeedEovcSAWNfCBHCz6IoQAGKdt6UhxmjY2kbCFTbvPKjh9/8QWYg33/kQn/vkIXz0cA2ff66mzS1OLhscFlKLdYgr5GTJaz0kbHDOn5rj/CkvL+wPObSSGABjZBXpL3uy3R3biBErVxWKrB6XEdxvsSCWDCALUGQ16S970s1gdBAxbF1BdimymlxGQKev3R1vQ0wwoswu7e54myKryyDoBcr8BLcAhhYqs46Qtd5cmZsQKbsqswVQZNV5HSGLs7S740m7O24CuLKyGqnF/lp5FFl9riLiBtR2d9wHcA7A9VVUSBFmADreFmW1+XzeAHC30CqRKGYQMXHcjSJ7ENkNXbcqm0JIvP95eFsv6DfUox8zCDntuAXcvUY6EC16A+XeRHIH4otst7vjweKLFLl8fA8xJxFVCcbI5eOnED31oFujKglFLiebEBOLrGKroQ4UubysQbTONlIuJaATjJH1YQoxgLKFlKsWlRmKrCc3IIS2sXxus3ZQZP2ZQsi8jdW31BPE+yKZEOnBBsQAUKwbbv1QZKIi55DwSsLOHlERK2kBiky0gCITLaDIREXMpAUoMtECikxUxE5agCITLaDIRAsoMtECiky0gCITLaDIRAsoMtECiky0gCITFYlcv2MRT2SuuUtUIvENAJ7IE7n1ICQTqVtkW249CEnNFBlaZFtqVQhJj52mkF9kLhpNVMBOU8iftUh85yohkpkhpYd+kQdSqkJIelIvLuMtB+BhA7gkoUKEpCHxMgAeiwMi/aw1ISQl15EhDbzYIgOied/MUCFCkjKDWIx8kvYAy4aoe2AGg6yWPjIOyi0TeQKuu0tWxw2I9d4yETRpaAvAtawHJySCHUhqNJfFyH4GENvJEiKbzHGxn6hpnBaqtXcbWQ07EKsJTWQdMM58ZAvV3VmTyMeTOPEMtzDiTqzvA9gAsxkkG9cgwgnpC44nuUPEhlhRnJ1AkpQdiIawl9cJkt7qtAtRmarte0zSsQOxwWUTOU8VjspaRNGA2CLWQrm3hyXymEJIexWS4+Awsorspw4RxDfdB3fmrA7bC4+V838sEwGs6fl+MwAAAABJRU5ErkJggg==";

const BODY_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Render HTML to a PDF and hand it to the user. Native gets the share sheet
 * (save to Files, WhatsApp, email); web gets the browser print dialog, which
 * is the only way to produce a file there.
 */
export async function printOrShareHtml(html: string, dialogTitle: string) {
  try {
    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Sharing unavailable", "Your device cannot share files right now.");
    }
  } catch (e) {
    Alert.alert("Export failed", "Could not generate the PDF. Please try again.");
  }
}

// Remember the folder the user picked for downloads so we prompt only once.
const SAF_DIR_KEY = "chuma:downloadDirUri";

/** A previously-granted Android folder to download into, or prompt for one. */
async function androidDownloadDir(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(SAF_DIR_KEY);
  if (saved) return saved;
  const perm =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await AsyncStorage.setItem(SAF_DIR_KEY, perm.directoryUri);
  return perm.directoryUri;
}

/**
 * Generate a PDF from HTML and DOWNLOAD it to the device — as opposed to
 * printOrShareHtml, which opens the share sheet.
 *
 * Android: writes the file into a folder the user picks once via the Storage
 * Access Framework (e.g. Downloads), with a readable name. The grant is
 * remembered so later downloads save straight there without prompting.
 * iOS: has no folder picker, so the file goes to the share sheet whose
 * "Save to Files" is the platform's save flow — named properly, not a UUID.
 * Web: the browser print dialog is the only way to produce a file.
 */
export async function savePdf(html: string, baseName: string, dialogTitle: string) {
  try {
    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (Platform.OS === "android") {
      const dir = await androidDownloadDir();
      if (dir) {
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            dir,
            baseName,
            "application/pdf"
          );
          await FileSystem.writeAsStringAsync(destUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert("Downloaded", `${baseName}.pdf was saved to your chosen folder.`);
          return;
        } catch {
          // The saved grant may be stale (folder deleted / permission revoked):
          // forget it so the next download re-prompts, and share this one.
          await AsyncStorage.removeItem(SAF_DIR_KEY);
        }
      }
      // Folder picker dismissed → fall through to the share sheet so the export
      // isn't lost.
    }

    // iOS + Android fallback: rename the temp file so "Save to Files" / share
    // targets show a readable name instead of the print module's UUID.
    let shareUri = uri;
    try {
      const named = `${FileSystem.cacheDirectory}${baseName}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: named });
      shareUri = named;
    } catch {
      // keep the original temp uri
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, {
        mimeType: "application/pdf",
        dialogTitle,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Save unavailable", "Your device cannot save files right now.");
    }
  } catch (e) {
    Alert.alert("Export failed", "Could not generate the PDF. Please try again.");
  }
}

/**
 * DOWNLOAD a CSV to the device — same flow as savePdf.
 *
 * Android: writes it into the folder the user picked once via the Storage
 * Access Framework (remembered across downloads), with a readable name.
 * iOS: no folder picker, so it goes to the share sheet as a real .csv file
 * (named properly) whose "Save to Files" is the platform's save flow.
 * Web: a direct browser download.
 */
export async function saveCsv(csv: string, baseName: string, dialogTitle: string) {
  try {
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (Platform.OS === "android") {
      const dir = await androidDownloadDir();
      if (dir) {
        try {
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            dir,
            baseName,
            "text/csv"
          );
          await FileSystem.writeAsStringAsync(destUri, csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert("Downloaded", `${baseName}.csv was saved to your chosen folder.`);
          return;
        } catch {
          // Stale grant (folder deleted / permission revoked): forget it so the
          // next download re-prompts, and share this one.
          await AsyncStorage.removeItem(SAF_DIR_KEY);
        }
      }
      // Folder picker dismissed → fall through to the share sheet.
    }

    // iOS + Android fallback: write a real .csv file and share it (not raw text).
    const fileUri = `${FileSystem.cacheDirectory}${baseName}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle,
        UTI: "public.comma-separated-values-text",
      });
    } else {
      Alert.alert("Save unavailable", "Your device cannot save files right now.");
    }
  } catch (e) {
    Alert.alert("Export failed", "Could not export the CSV. Please try again.");
  }
}

/** Quote a CSV field — commas, quotes and newlines all need escaping. */
function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Escape untrusted text before it goes into generated HTML. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─── Transaction list (Transactions tab, Reports) ────────────────────────────

export async function exportTransactionsPdf(data: TxnItem[]) {
  const rows = data
    .map(
      (t) => `
        <tr>
          <td>${esc(t.date)}</td>
          <td style="text-transform:capitalize">${esc(t.type)}</td>
          <td>${esc(t.groupName)}</td>
          <td>${t.direction === "out" ? "-" : "+"}${formatZMW(Math.abs(t.amount))}</td>
          <td style="text-transform:capitalize">${esc(t.status)}</td>
        </tr>`
    )
    .join("");
  const html = `
    <html><head><meta charset="utf-8" /><style>
      body { font-family: ${BODY_FONT}; padding: 32px; color: #111; }
      h1 { font-size: 22px; color: #0A5C36; margin-bottom: 4px; }
      p { font-size: 12px; color: #666; margin: 0 0 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #0A5C36; color: white; padding: 10px 12px; text-align: left; }
      td { padding: 9px 12px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .footer { margin-top: 24px; font-size: 11px; color: #999; }
    </style></head>
    <body>
      <h1>Chuma — Transaction History</h1>
      <p>Generated on ${fmtDate(new Date())} · ${data.length} transactions</p>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Group</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footer">This is an auto-generated export from the Chuma app.</p>
    </body></html>`;
  await savePdf(
    html,
    `Chuma-Transactions-${new Date().toISOString().slice(0, 10)}`,
    "Save your transactions"
  );
}

export async function exportTransactionsCsv(data: TxnItem[]) {
  const header = "Date,Type,Group,Amount,Status,Note\n";
  const rows = data
    .map((t) =>
      [
        t.date,
        t.type,
        t.groupName,
        t.direction === "out" ? -t.amount : t.amount,
        t.status,
        t.note ?? "",
      ]
        .map(csvCell)
        .join(",")
    )
    .join("\n");
  await saveCsv(
    header + rows,
    `Chuma-Transactions-${new Date().toISOString().slice(0, 10)}`,
    "Save your transactions"
  );
}

// ─── Account statement ───────────────────────────────────────────────────────

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatZMW(Math.abs(n))}`;

export function statementTitle(s: Statement) {
  return `${fmtDate(s.period.from)} – ${fmtDate(s.period.to)}`;
}

export async function exportStatementPdf(s: Statement) {
  const ledgerRows = s.lines
    .map(
      (l) => `
        <tr>
          <td>${fmtDate(l.date)}</td>
          <td>${esc(l.description)}${l.groupName ? `<span class="muted"> · ${esc(l.groupName)}</span>` : ""}</td>
          <td class="num ${l.delta < 0 ? "neg" : "pos"}">${signed(l.delta)}</td>
          <td class="num">${formatZMW(l.balance)}</td>
        </tr>`
    )
    .join("");

  const activityRows = s.activity
    .map(
      (a) => `
        <tr>
          <td>${fmtDate(a.date)}</td>
          <td>${esc(a.description)}${a.groupName ? `<span class="muted"> · ${esc(a.groupName)}</span>` : ""}</td>
          <td class="num ${a.direction === "out" ? "neg" : "pos"}">${a.direction === "out" ? "−" : "+"}${formatZMW(a.amount)}</td>
          <td style="text-transform:capitalize">${esc(a.status)}</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>
  @page { margin: 22px; }
  body { font-family: ${BODY_FONT}; color: #111827; background: #fff; }
  .wrap { max-width: 720px; margin: 0 auto; }
  .header { background: #0A5C36; color: #fff; padding: 24px 26px; border-radius: 16px 16px 0 0; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .logo { width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.45); display: inline-flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
  .label { font-size: 10px; font-weight: 600; letter-spacing: 1.4px; color: rgba(255,255,255,0.75); text-transform: uppercase; }
  .period { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .who { margin-top: 14px; font-size: 12px; color: rgba(255,255,255,0.85); line-height: 18px; }
  .body { border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 16px 16px; padding: 22px 26px; }
  .summary { display: flex; gap: 10px; margin-bottom: 22px; }
  .box { flex: 1; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px 14px; }
  .box .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #6B7280; }
  .box .v { font-size: 16px; font-weight: 700; margin-top: 4px; color: #064E3B; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #F3F5F4; color: #374151; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pos { color: #059669; }
  .neg { color: #B91C1C; }
  .muted { color: #9CA3AF; }
  tfoot td { font-weight: 700; border-top: 2px solid #E5E7EB; border-bottom: 0; color: #064E3B; }
  .empty { padding: 14px 10px; color: #9CA3AF; font-size: 12px; }
  .foot { margin-top: 26px; text-align: center; color: #9CA3AF; font-size: 10px; line-height: 16px; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">
        <span class="logo"><img src="${CHUMA_LOGO_DATA_URI}" style="width:22px;height:22px;" /></span>
        <span class="brand-name">Chuma</span>
      </div>
      <div class="label">Savings statement</div>
      <div class="period">${statementTitle(s)}</div>
      <div class="who">
        ${esc(s.member.name)} · ${esc(s.member.phone)}<br />
        ${s.group ? `${esc(s.group.name)} · ${esc(s.group.role)}` : "All groups"}<br />
        Statement no. ${esc(s.statementId)} · issued ${fmtDate(s.generatedAt)}
      </div>
    </div>
    <div class="body">
      <div class="summary">
        <div class="box"><div class="k">Opening balance</div><div class="v">${formatZMW(s.openingBalance)}</div></div>
        <div class="box"><div class="k">Savings in</div><div class="v">+${formatZMW(s.savingsIn)}</div></div>
        <div class="box"><div class="k">Savings out</div><div class="v">−${formatZMW(s.savingsOut)}</div></div>
        <div class="box"><div class="k">Closing balance</div><div class="v">${formatZMW(s.closingBalance)}</div></div>
      </div>

      <h2>Savings account</h2>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead>
        <tbody>
          <tr><td>${fmtDate(s.period.from)}</td><td class="muted">Opening balance</td><td class="num muted">—</td><td class="num">${formatZMW(s.openingBalance)}</td></tr>
          ${ledgerRows || `<tr><td colspan="4" class="empty">No savings movement in this period.</td></tr>`}
        </tbody>
        <tfoot><tr><td colspan="3">Closing balance</td><td class="num">${formatZMW(s.closingBalance)}</td></tr></tfoot>
      </table>

      <h2>All activity</h2>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Status</th></tr></thead>
        <tbody>${activityRows || `<tr><td colspan="4" class="empty">No transactions in this period.</td></tr>`}</tbody>
        <tfoot>
          <tr><td colspan="2">Money in</td><td class="num pos">+${formatZMW(s.totals.moneyIn)}</td><td></td></tr>
          <tr><td colspan="2">Money out</td><td class="num neg">−${formatZMW(s.totals.moneyOut)}</td><td></td></tr>
          <tr><td colspan="2">Net</td><td class="num">${signed(s.totals.net)}</td><td></td></tr>
        </tfoot>
      </table>

      <div class="foot">
        This is an official Chuma statement. The balance shown is your savings
        stake in the group; loans, repayments, penalties and fees are listed
        under All activity and do not change it.<br />
        Verify at chuma.app · Community Chuma, Digitally.
      </div>
    </div>
  </div>
</body></html>`;

  await savePdf(
    html,
    `Chuma-Statement-${new Date(s.period.from).toISOString().slice(0, 10)}`,
    `Chuma statement · ${statementTitle(s)}`
  );
}

export async function exportStatementCsv(s: Statement) {
  const meta = [
    ["Chuma savings statement"],
    ["Statement no.", s.statementId],
    ["Member", s.member.name, s.member.phone],
    ["Group", s.group ? s.group.name : "All groups"],
    ["Period", fmtDate(s.period.from), fmtDate(s.period.to)],
    ["Opening balance", s.openingBalance],
    ["Savings in", s.savingsIn],
    ["Savings out", s.savingsOut],
    ["Closing balance", s.closingBalance],
    ["Money in", s.totals.moneyIn],
    ["Money out", s.totals.moneyOut],
    [],
    ["Date", "Description", "Group", "Amount", "Direction", "Status", "Balance"],
  ];
  const rows = s.activity.map((a) => {
    const line = s.lines.find((l) => l.id === a.id);
    return [
      new Date(a.date).toISOString().slice(0, 10),
      a.description,
      a.groupName,
      a.direction === "out" ? -a.amount : a.amount,
      a.direction,
      a.status,
      line ? line.balance : "",
    ];
  });
  const csv = [...meta, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  await saveCsv(
    csv,
    `Chuma-Statement-${new Date(s.period.from).toISOString().slice(0, 10)}`,
    "Save your statement"
  );
}
