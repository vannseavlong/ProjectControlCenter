/** Shared Tailwind preset — apps/web pulls this in via `presets: [require("@pcc/config/tailwind")]`. */
const preset = {
  theme: {
    extend: {
      colors: {
        status: {
          up: "#22c55e",
          down: "#ef4444",
          sleeping: "#eab308",
          unknown: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};

export default preset;
