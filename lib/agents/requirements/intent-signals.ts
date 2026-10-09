export interface IntentSignals {
  wantsSchedule: boolean;
  scheduleKind: "daily" | "weekly" | "unspecified" | null;
  wantsEmail: boolean;
  wantsWhatsApp: boolean;
  wantsSlack: boolean;
  wantsCrm: boolean;
  wantsDatabase: boolean;
  wantsWebSearch: boolean;
  wantsDecision: boolean;
  wantsApproval: boolean;
  wantsFiles: boolean;
  wantsApi: boolean;
  wantsOutput: boolean;
  wantsCompany: boolean;
  wantsContact: boolean;
  wantsMeeting: boolean;
  outputChannelSpecified: boolean;
}

/** Language hints only. Workflow and tools override these. */
export function extractIntentSignals(text: string): IntentSignals {
  const t = text.toLowerCase();

  const wantsEmail =
    /\b(email me|send me an email|send an email|mail me|to my inbox|email the|email a)\b/.test(t) ||
    /\bemail (the )?(report|summary|digest)\b/.test(t);

  const wantsWhatsApp = /\bwhatsapp\b/.test(t);
  const wantsSlack = /\bslack\b/.test(t);
  const wantsCrm =
    /\bcrm\b/.test(t) ||
    /\bcustomer records?\b/.test(t) ||
    /\b(create|update|sync) (a )?lead\b/.test(t);
  const wantsDatabase = /\b(database|store this|save (it |this )?to (the )?db)\b/.test(t);
  const wantsWebSearch =
    /\b(latest|research|search the (web|internet)|find (the )?(latest|news)|competitors?)\b/.test(t);
  const wantsDecision =
    /\b(decide|approve|reject|classify|determine whether|should be automatically)\b/.test(t);
  const wantsApproval = /\b(ask me before|needs? approval|only after i approve|wait for (me|approval))\b/.test(
    t
  );
  const wantsFiles = /\b(pdf|upload(ed)? files?|spreadsheet|csv)\b/.test(t);
  const wantsApi = /\b(call (this |an )?api|webhook|http request)\b/.test(t);

  const daily = /\b(every morning|each morning|daily|every day|at \d{1,2}\s?(am|pm))\b/.test(t);
  const weekly = /\b(every monday|each week|weekly|every week)\b/.test(t);
  const wantsSchedule = daily || weekly || /\b(on a schedule|recurring)\b/.test(t);

  const wantsCompany = /\bcompan(y|ies)\b/.test(t) && /\bbriefs?\b/.test(t);
  const wantsContact = /\bcontact\b/.test(t) && /\bbriefs?\b/.test(t);
  const wantsMeeting = /\bmeeting\b/.test(t);

  const wantsOutput =
    /\b(send|email|notify|report|summary|digest|give me|show me|deliver|briefs?)\b/.test(t);
  const outputChannelSpecified = wantsEmail || wantsWhatsApp || wantsSlack;

  return {
    wantsSchedule,
    scheduleKind: weekly ? "weekly" : daily ? "daily" : wantsSchedule ? "unspecified" : null,
    wantsEmail,
    wantsWhatsApp,
    wantsSlack,
    wantsCrm,
    wantsDatabase,
    wantsWebSearch,
    wantsDecision,
    wantsApproval,
    wantsFiles,
    wantsApi,
    wantsOutput,
    wantsCompany,
    wantsContact,
    wantsMeeting,
    outputChannelSpecified,
  };
}
