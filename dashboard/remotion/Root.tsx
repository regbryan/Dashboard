import { Composition } from "remotion";
import { ensureFontsLoaded } from "./lib/fonts";
import { QuoteCard } from "./compositions/QuoteCard";
import { StatsReel } from "./compositions/StatsReel";
import { ProductReveal } from "./compositions/ProductReveal";
import type {
  QuoteCardProps,
  StatsReelProps,
  ProductRevealProps,
  VideoBrandKit,
} from "./types";

/**
 * Default sample brand kit shown when previewing in Remotion Studio.
 * The /api/render-reel route overrides these defaultProps with real
 * brand data from Supabase.
 */
const sampleBrandKit: VideoBrandKit = {
  slug: "sample",
  name: "SocialPulse",
  handle: "socialpulse",
  archetype: "Sage",
  colors: {
    primary: "1a1a2e",
    secondary: "13121f",
    accent: "c084fc",
    background: "0a0a14",
    foreground: "f4f4f5",
  },
  fonts: {
    display: "Plus Jakarta Sans",
    body: "Inter",
  },
};

export const RemotionRoot = () => {
  ensureFontsLoaded();
  return (
    <>
      <Composition
        id="QuoteCard"
        component={QuoteCard}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          brandKit: sampleBrandKit,
          quote:
            "The best content doesn't interrupt. It earns the next second of attention.",
          attribution: "SocialPulse",
        }}
      />

      <Composition
        id="StatsReel"
        component={StatsReel}
        durationInFrames={360}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          brandKit: sampleBrandKit,
          headline: "What the data actually says",
          stat: "94%",
          statLabel:
            "of homeowners who skip annual HVAC service face a major repair within 18 months.",
          footer: "Source: AHRI homeowner survey, 2024",
        }}
      />

      <Composition
        id="ProductReveal"
        component={ProductReveal}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          brandKit: sampleBrandKit,
          headline: "Spring tune-up season is here",
          subhead:
            "Catch small issues before they turn into July-afternoon emergencies.",
          imageUrl:
            "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1080",
          cta: "Book service",
        }}
      />
    </>
  );
};
