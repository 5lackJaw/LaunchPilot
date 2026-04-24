export const interviewQuestions = [
  {
    id: "best_customer",
    prompt: "Who is the best-fit customer for this product?",
    helper: "Name the type of person or company that should care first.",
    examples: ["Solo SaaS founders", "Developer tool teams", "Agencies managing client launches"],
  },
  {
    id: "pain",
    prompt: "What painful job are they trying to get done?",
    helper: "Describe the practical problem, not the feature category.",
    examples: ["They need qualified launch traffic", "They do not know what content to write", "They need review before posting"],
  },
  {
    id: "difference",
    prompt: "What makes this meaningfully different?",
    helper: "Use plain language. Avoid broad claims like all-in-one or AI-powered.",
    examples: ["Built for solo developers", "Approval-first automation", "Uses the product brief as memory"],
  },
  {
    id: "proof",
    prompt: "What proof or credibility can the system mention?",
    helper: "Examples, numbers, shipped products, user feedback, or constraints that make the claim believable.",
    examples: ["Used on two prior launches", "Built by an indie founder", "Early users cut review time"],
  },
  {
    id: "tone",
    prompt: "What should the product sound like in public?",
    helper: "This will guide generated content, outreach, and community replies.",
    examples: ["Direct and technical", "Calm and practical", "Opinionated but not loud"],
  },
] as const;

export type InterviewQuestionId = (typeof interviewQuestions)[number]["id"];
