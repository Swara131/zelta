export type ComparisonWinner = "zelta" | "others" | "tie";

export interface WhyZeltaComparisonRow {
  feature: string;
  others: string;
  zelta: string;
  winner: ComparisonWinner;
}

export interface WhyZeltaTestimonial {
  id: string;
  quote: string;
  attribution: string;
}

export const WHY_ZELTA_HEADLINE = "Why Wave vs Others";
export const WHY_ZELTA_LEAD =
  "Enterprise agent governance without enterprise setup. Built for founders who need control today — especially in India.";

export const WHY_ZELTA_COMPARISON_ROWS: WhyZeltaComparisonRow[] = [
  {
    feature: "Setup time",
    others: "2 days",
    zelta: "2 mins",
    winner: "zelta",
  },
  {
    feature: "Setup complexity",
    others: "7 steps",
    zelta: "1 step",
    winner: "zelta",
  },
  {
    feature: "Risk scoring",
    others: "Rules",
    zelta: "AI",
    winner: "zelta",
  },
  {
    feature: "Approvals",
    others: "Email",
    zelta: "Email + WhatsApp + SMS",
    winner: "zelta",
  },
  {
    feature: "Learning loop",
    others: "No",
    zelta: "Yes",
    winner: "zelta",
  },
  {
    feature: "India pricing",
    others: "$500",
    zelta: "₹3k",
    winner: "zelta",
  },
  {
    feature: "Support",
    others: "Slack",
    zelta: "Email",
    winner: "tie",
  },
];

export const WHY_ZELTA_TESTIMONIALS: WhyZeltaTestimonial[] = [
  {
    id: "d2c-founder",
    quote:
      "Used [competitor] for 3 months. Switched to Wave. So much easier.",
    attribution: "Founder, D2C brand",
  },
];

export function formatComparisonWinner(winner: ComparisonWinner): string {
  switch (winner) {
    case "zelta":
      return "⭐ Wave";
    case "others":
      return "Others";
    case "tie":
      return "🤝 Tie";
  }
}

export function winnerAriaLabel(winner: ComparisonWinner): string {
  switch (winner) {
    case "zelta":
      return "Wave wins";
    case "others":
      return "Others win";
    case "tie":
      return "Tie";
  }
}
