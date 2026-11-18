import { downloadBlob } from "@/lib/download";

function escapeCsvCell(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

// Web version: same CSV content as the app, downloaded as a file instead of
// handed to the share sheet. The BOM makes Excel open UTF-8 text correctly.
export async function exportCsv(filename: string, rows: string[][]): Promise<void> {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), filename);
}
