import * as Print from "expo-print";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Renders `html` to a PDF (via the device's print engine, same as
// react-native's other "export as PDF" flows), saves it in the app's cache
// directory as "Match Report.pdf", then opens the native share sheet so the
// user can save it to Files/Drive, email it, etc. — the same pattern
// exportCsv.ts already uses for CSV exports, just for a PDF instead.
export async function generateAndShareMatchReport(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const isAvailable = await Sharing.isAvailableAsync();
  const destination = new File(Paths.cache, "Match Report.pdf");
  // printToFileAsync's own output file already lives in the cache dir with a
  // generated name — copy it to our own "Match Report.pdf" so the filename
  // the user sees (in the share sheet, or on disk) is the one they asked for.
  const source = new File(uri);
  if (destination.exists) destination.delete();
  await source.copy(destination);

  if (!isAvailable) {
    throw new Error("Sharing isn't available on this device.");
  }

  await Sharing.shareAsync(destination.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Match Report",
    UTI: "com.adobe.pdf",
  });
}
