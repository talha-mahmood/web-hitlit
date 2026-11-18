// "45 seconds ago" / "2 hours ago" / "1 day ago" — each unit only rolls over
// once a full one of the next unit up has elapsed (e.g. 29 hours reads as
// "1 day ago", not "1 day 5 hours ago"; 48 hours reads as "2 days ago").
export function formatCommunityTimeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));

  if (diffSec < 60) {
    return `${diffSec} second${diffSec === 1 ? "" : "s"} ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}
