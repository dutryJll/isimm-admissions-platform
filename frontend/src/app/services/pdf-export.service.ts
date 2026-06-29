import { Injectable } from '@angular/core';

declare const html2canvas: any;
declare const jsPDF: any;

export interface PdfExportOptions {
  filename?: string;
  embedQr?: boolean;
  verificationBaseUrl?: string;
  verificationId?: string;
  verificationUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  constructor() {}

  private async computeSha256Base64(data: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', data);
    // base64
    const u8 = new Uint8Array(hash);
    let binary = '';
    for (let i = 0; i < u8.byteLength; i++) {
      binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
  }

  async generatePdfFromElement(el: HTMLElement, options?: PdfExportOptions): Promise<Blob | null> {
    if (!el) return null;
    const filename = options?.filename || 'document.pdf';

    // ensure html2canvas + jsPDF available (added in package.json). If not, fallback to window.print
    if (typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
      // fallback: open print window
      const w = window.open('', '_blank');
      if (!w) return null;
      w.document.write('<html><head><title>' + filename + '</title>');
      w.document.write('</head><body>');
      w.document.write(el.outerHTML);
      w.document.write('</body></html>');
      w.document.close();
      w.focus();
      w.print();
      return null;
    }

    // Render element to canvas
    const canvas = await html2canvas(el as HTMLElement, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate image size to fit page width while preserving ratio
    const imgProps = (pdf as any).getImageProperties(imgData);
    const imgWidthMM = pageWidth;
    const imgHeightMM = (imgProps.height * imgWidthMM) / imgProps.width;

    let y = 10; // top margin
    pdf.setFontSize(11);

    // Add header (simple, left and right logos can be passed as inline <img> in DOM)
    // For now we render the whole element as an image then add footer + QR
    pdf.addImage(imgData, 'PNG', 5, y, imgWidthMM - 10, imgHeightMM);

    // Footer: page numbering and simple ISO code
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.text(`Page ${i} / ${pageCount}`, pageWidth - 40, pageHeight - 8);
      pdf.setFontSize(8);
      pdf.text('Conforme ISO - ISIMM', 10, pageHeight - 8);
    }

    // If embed QR: compute hash and generate QR code data url using qrcode lib
    if (options?.embedQr) {
      try {
        // compute SHA-256 of PDF binary
        const pdfBlob = pdf.output('arraybuffer');
        const hashBase64 = await this.computeSha256Base64(pdfBlob as ArrayBuffer);
        let qrPayload = `sha256:${hashBase64}`;

        if (options.verificationBaseUrl && options.verificationId) {
          qrPayload = `${options.verificationBaseUrl}?id=${encodeURIComponent(options.verificationId)}&hash=${encodeURIComponent(hashBase64)}`;
        } else if (options.verificationUrl) {
          qrPayload = `${options.verificationUrl}${options.verificationUrl.includes('?') ? '&' : '?'}hash=${encodeURIComponent(hashBase64)}`;
        }
        // dynamic import qrcode (should be available from dependency)
        // @ts-ignore
        const QRCode = (await import('qrcode')).default;
        const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 120 });
        // place QR bottom-left
        pdf.addImage(qrDataUrl, 'PNG', 10, pageHeight - 40, 30, 30);
      } catch (e) {
        console.warn('QR embed failed', e);
      }
    }

    // Save file
    const blob = pdf.output('blob');
    // trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return blob;
  }
}
