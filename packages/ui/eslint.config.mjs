import { baseConfig } from "@pcc/config/eslint";
import { reactConfig } from "@pcc/config/eslint-react";

const config = [...baseConfig, ...reactConfig];

export default config;
