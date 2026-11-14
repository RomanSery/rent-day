/** What people may pick as the subject on the Contact Us page. */
export const CONTACT_SUBJECTS: Record<string, string> = {
  general: "General",
  feedback: "Feedback / Suggestions",
  questions: "Questions",
  bugs: "Bug Report",
  other: "Other",
};

/** A message sent from the Contact Us page, as admins see it. */
export interface ContactMessage {
  readonly id: string;
  /** ISO time it was received */
  readonly createdAt: string;
  /** the address they want an answer at */
  readonly email: string;
  readonly name: string;
  /** a key of CONTACT_SUBJECTS */
  readonly subject: string;
  readonly message: string;
  /** their account, when they were signed in */
  readonly userId?: string;
  readonly username?: string;
}
