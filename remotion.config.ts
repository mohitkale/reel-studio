import { Config } from "@remotion/cli/config";

import { remotionWebpackOverride } from "./src/remotion/webpack-override";

// Output/codec defaults for Remotion Studio and the M5 render pipeline.
Config.setVideoImageFormat("jpeg");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.overrideWebpackConfig(remotionWebpackOverride);
