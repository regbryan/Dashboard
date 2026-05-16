import { Config } from "@remotion/cli/config";

/**
 * Remotion CLI / Studio config. Kept lean — we use defaults for
 * everything except codec (h264 for IG compatibility) and the
 * concurrency cap (don't saturate the machine during local dev).
 *
 * Lambda gets its own config when we wire it up.
 */
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setConcurrency(2);
Config.setEntryPoint("./remotion/index.ts");
