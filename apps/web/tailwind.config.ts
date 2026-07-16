import type { Config } from "tailwindcss";
import basePreset from "@pcc/config/tailwind";

const config: Config = {
  presets: [basePreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
