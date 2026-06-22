import { Config } from "@remotion/cli/config";

// Output/codec defaults for Remotion Studio and the M5 render pipeline.
Config.setVideoImageFormat("jpeg");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
