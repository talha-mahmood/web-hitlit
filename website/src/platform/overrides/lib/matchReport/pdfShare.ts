// Web version: renders the same report HTML the app prints to PDF in a
// hidden iframe and opens the browser's print dialog, where "Save as PDF"
// produces the file (title "Match Report" becomes the default filename).
export async function generateAndShareMatchReport(html: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error("Couldn't prepare the report for printing.");
  }
  doc.open();
  doc.write(html.includes("<title>") ? html : html.replace("<head>", "<head><title>Match Report</title>"));
  doc.close();

  await new Promise<void>((resolve) => {
    const images = Array.from(doc.images);
    if (images.every((img) => img.complete)) return resolve();
    let pending = images.length;
    const done = () => (--pending <= 0 ? resolve() : undefined);
    images.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    setTimeout(resolve, 3000);
  });

  const win = iframe.contentWindow;
  win.focus();
  win.print();
  setTimeout(() => iframe.remove(), 60_000);
}
