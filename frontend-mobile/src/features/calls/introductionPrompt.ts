const topics = new Set(["coffee", "food", "walk", "study"]);
export const introductionPromptKey = (topic?: string | null): string => `hello.prompt.${topic && topics.has(topic) ? topic : "general"}`;
