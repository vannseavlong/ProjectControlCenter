import { baseConfig } from "@pcc/config/eslint";
import nextConfig from "eslint-config-next";

const config = [...baseConfig, ...nextConfig];

export default config;
