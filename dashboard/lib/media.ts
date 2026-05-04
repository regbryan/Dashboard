// Detect whether a media URL points to a video the dashboard should render
// with a <video> tag instead of <img>. Reels are stored as .mp4 in
// post-images/<brand>/reels/. Image posts are .png. We only need to peek at
// the extension; query strings and fragments are stripped first so a URL
// like "/x.mp4?token=..." still resolves correctly.
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}
