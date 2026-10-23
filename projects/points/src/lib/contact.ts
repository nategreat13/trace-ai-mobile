export const CONTACT_TOPICS = ["Question", "Something's broken", "Idea", "Billing"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
