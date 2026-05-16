/**
 * Font loader for Remotion compositions. We can't dynamically
 * import any font Google Fonts has — `@remotion/google-fonts/*`
 * uses package subpath exports, so each font has to be referenced
 * by literal subpath. This file hard-codes the curated pairs that
 * brand kits are allowed to choose between.
 *
 * If a brand's font isn't in this map, we fall back to Inter (body)
 * and Plus Jakarta Sans (display) which are both pre-registered.
 *
 * Called once from RemotionRoot at module load — Remotion
 * automatically waits for `delayRender()`-style font promises
 * before the first frame renders.
 */
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

let loaded = false;

export function ensureFontsLoaded() {
  if (loaded) return;
  loaded = true;
  loadJakarta();
  loadInter();
}
