export const ROLE_LABELS = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'View only',
};

export function formatUpdatedAt(iso) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
