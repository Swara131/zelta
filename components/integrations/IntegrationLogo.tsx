import type { ReactElement } from "react";

interface IntegrationLogoProps {
  logoKey: string;
  className?: string;
}

export default function IntegrationLogo({ logoKey, className = "h-10 w-10" }: IntegrationLogoProps) {
  const logos: Record<string, ReactElement> = {
    "google-workspace": (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.059 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
    ),
    "microsoft-entra": (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect fill="#0078D4" width="22" height="22" x="4" y="4" rx="1" />
        <rect fill="#0078D4" width="22" height="22" x="26" y="4" rx="1" opacity="0.85" />
        <rect fill="#0078D4" width="22" height="22" x="4" y="26" rx="1" opacity="0.7" />
        <rect fill="#0078D4" width="22" height="22" x="26" y="26" rx="1" opacity="0.55" />
      </svg>
    ),
    okta: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="#007DC1" />
        <circle cx="24" cy="24" r="8" fill="white" />
      </svg>
    ),
    slack: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="#E01E5A" d="M10 24c0-2.2 1.8-4 4-4h4v8h-4c-2.2 0-4-1.8-4-4z" />
        <path fill="#36C5F0" d="M14 10c-2.2 0-4 1.8-4 4v4h8v-4c0-2.2-1.8-4-4-4z" />
        <path fill="#2EB67D" d="M38 24c0 2.2-1.8 4-4 4h-4v-8h4c2.2 0 4 1.8 4 4z" />
        <path fill="#ECB22E" d="M34 38c2.2 0 4-1.8 4-4v-4h-8v4c0 2.2 1.8 4 4 4z" />
        <path fill="#E01E5A" d="M24 34h-4c-2.2 0-4-1.8-4-4v-4h8v4c0 2.2-1.8 4-4 4z" transform="rotate(90 20 30)" />
        <path fill="#36C5F0" d="M24 14h4c2.2 0 4 1.8 4 4v4h-8v-4c0-2.2 1.8-4 4-4z" transform="rotate(90 26 18)" />
      </svg>
    ),
    "microsoft-teams": (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect fill="#5059C9" width="48" height="48" rx="6" />
        <circle cx="30" cy="16" r="6" fill="white" opacity="0.9" />
        <rect fill="white" opacity="0.9" x="10" y="22" width="16" height="18" rx="2" />
        <rect fill="#7B83EB" x="28" y="24" width="12" height="16" rx="2" />
      </svg>
    ),
    github: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="currentColor" className="text-zinc-100" d="M24 4C12.954 4 4 12.954 4 24c0 8.821 5.732 16.292 13.678 18.93.999.183 1.365-.434 1.365-.966 0-.474-.017-1.732-.027-3.398-5.565 1.212-6.739-2.684-6.739-2.684-.909-2.308-2.219-2.922-2.219-2.922-1.814-1.24.137-1.215.137-1.215 2.006.141 3.059 2.060 3.059 2.060 1.782 3.053 4.674 2.171 5.812 1.66.18-1.29.697-2.171 1.268-2.671-4.443-.506-9.115-2.222-9.115-9.908 0-2.188.781-3.978 2.064-5.379-.207-.506-.895-2.547.196-5.308 0 0 1.683-.539 5.518 2.054A19.205 19.205 0 0 1 24 12.934a19.18 19.18 0 0 1 5.022.678c3.835-2.593 5.517-2.054 5.517-2.054 1.092 2.761.404 4.802.197 5.308 1.284 1.401 2.063 3.191 2.063 5.379 0 7.698-4.678 9.396-9.132 9.892.717.618 1.356 1.839 1.356 3.706 0 2.675-.024 4.829-.024 5.486 0 .534.364 1.158 1.376.96A20.047 20.047 0 0 0 44 24c0-11.046-8.954-20-20-20z" />
      </svg>
    ),
    aws: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="#FF9900" d="M14 32c8 6 20 6 28 0l-3.5-2.5c-6.5 4.5-15 4.5-21 0L14 32z" />
        <path fill="#FF9900" d="M12 24c0-8 5.5-14 14-14s14 6 14 14-5.5 14-14 14-14-6-14-14zm14-10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10z" opacity="0.9" />
        <text x="24" y="28" textAnchor="middle" fill="#FF9900" fontSize="8" fontWeight="bold" fontFamily="Arial">aws</text>
      </svg>
    ),
    azure: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="#0078D4" d="M8 36L24 8l16 28H8z" />
        <path fill="#50E6FF" d="M24 8l8 20H16L24 8z" opacity="0.8" />
      </svg>
    ),
    "google-cloud": (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path fill="#EA4335" d="M24 8l14 8v16l-14 8-14-8V16z" opacity="0.9" />
        <path fill="#4285F4" d="M24 8v16l14-8V16L24 8z" />
        <path fill="#34A853" d="M24 24v16l14-8V24l-14 0z" />
        <path fill="#FBBC05" d="M24 24L10 16v8l14 8V24z" />
        <path fill="#4285F4" d="M10 32V24l14 8-14 0z" opacity="0.7" />
      </svg>
    ),
    splunk: (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect fill="#65A637" width="48" height="48" rx="6" />
        <text x="24" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">splunk</text>
        <text x="24" y="38" textAnchor="middle" fill="white" fontSize="6" fontFamily="Arial" opacity="0.8">{">"}</text>
      </svg>
    ),
  };

  return (
    <div className="flex shrink-0 items-center justify-center">
      {logos[logoKey] ?? (
        <div className={`${className} rounded-lg bg-white/10`} />
      )}
    </div>
  );
}
