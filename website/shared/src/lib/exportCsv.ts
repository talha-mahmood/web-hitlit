import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

function escapeCsvCell(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

// Writes `rows` (first row is the header) to a CSV file in the cache
// directory, then opens the native share sheet so the admin can save it,
// email it, or open it directly in Excel/Sheets.
export async function exportCsv(filename: string, rows: string[][]): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing isn't available on this device.");
  }

  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const file = new File(Paths.cache, filename);
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export to Excel/Sheets",
    UTI: "public.comma-separated-values-text",
  });
}
