/** Strip markdown from coach/AI responses for plain-text UI. */
export function formatAiPlainText(text) {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/(?<!\n)\*([^*\n]+)\*/g, '$1');
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/^[\-\*]\s+/gm, '• ');
  cleaned = cleaned.replace(/!{2,}/g, '.');
  cleaned = cleaned.replace(/[!@#$%^&]{2,}/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}
