export type OnboardingRole =
  | "founder"
  | "small_business"
  | "developer"
  | "marketer"
  | "student"
  | "freelancer"
  | "other";

export type OnboardingGoal =
  | "create_agents"
  | "automate_work"
  | "monitor_agents"
  | "both"
  | "exploring";

export type OnboardingFamiliarity =
  | "new"
  | "used_ai"
  | "simple_automations"
  | "built_agents"
  | "experienced_developer";

export type OnboardingFirstBuild =
  | "marketing"
  | "sales"
  | "research"
  | "support"
  | "social"
  | "data"
  | "custom";

export interface ZeltaOnboardingResponses {
  role?: OnboardingRole;
  goal?: OnboardingGoal;
  familiarity?: OnboardingFamiliarity;
  firstBuild?: OnboardingFirstBuild;
  customIdea?: string;
}

export interface UserOnboardingState {
  completed: boolean;
  completedAt: string | null;
  responses: ZeltaOnboardingResponses;
}
