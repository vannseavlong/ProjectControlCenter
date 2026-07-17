import { defineTable, string, date } from "longcelot-sheet-db";

export default defineTable({
  name: "agents",
  actor: "admin",
  timestamps: true,
  columns: {
    agent_name: string().required(),
    assigned_project_id: string().ref("projects._id").required(),
    local_project_path: string().required(),
    brief: string(),
    status: string().enum(["active", "paused", "fired"]).default("active"),
    last_active: date(),
    // Populated from claude -p's --output-format json `session_id` field after the first
    // successful command, then passed back via --resume on every later command for this agent so
    // exploration/context carries over instead of restarting from zero each time (Tasks/agent-bridge.md).
    claude_session_id: string(),
    // Browser SpeechSynthesisVoice.voiceURI, set from the Agent Staff UI — voiceURIs are only
    // stable within the browser/OS they were picked on, which is fine for this single-user local
    // tool. voice_name is stored alongside purely for display (voiceURI isn't human-readable).
    voice_uri: string(),
    voice_name: string(),
  },
});
