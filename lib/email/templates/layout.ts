import { getAppUrl } from "../env";

interface LayoutOptions {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  accentColor?: string;
}

/** Responsive HTML email shell (table layout for client compatibility). */
export function emailLayout({
  preheader,
  title,
  bodyHtml,
  ctaLabel,
  ctaHref,
  accentColor = "#6366f1",
}: LayoutOptions): string {
  const appUrl = getAppUrl();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background: #0f1117; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; max-width: 0; overflow: hidden; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .content-pad { padding: 24px 20px !important; }
      .cta-btn { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span class="preheader">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 0 20px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#f4f4f5;letter-spacing:-0.02em;">ApprovalLayer</span>
            </td>
          </tr>
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:${accentColor};"></td>
                </tr>
                <tr>
                  <td class="content-pad" style="padding:32px 36px;">
                    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#fafafa;">${escapeHtml(title)}</h1>
                    ${bodyHtml}
                    ${
                      ctaLabel && ctaHref
                        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                      <tr>
                        <td>
                          <a href="${escapeHtml(ctaHref)}" class="cta-btn" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
                        </td>
                      </tr>
                    </table>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                Sent by <a href="${escapeHtml(appUrl)}" style="color:#a5b4fc;text-decoration:none;">ApprovalLayer</a><br />
                Agent action governance &amp; approval workflows
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#52525b;">&copy; ${year} ApprovalLayer</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };
  const color = colors[severity.toLowerCase()] ?? "#6366f1";
  return `<span style="display:inline-block;background:${color}22;color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:4px 10px;border-radius:999px;border:1px solid ${color}44;">${escapeHtml(severity)}</span>`;
}

export function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #27272a;">
      <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#71717a;">${escapeHtml(label)}</p>
      <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#e4e4e7;">${escapeHtml(value)}</p>
    </td>
  </tr>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#d4d4d8;">${escapeHtml(text)}</p>`;
}
