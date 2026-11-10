import { generateText, isStepCount, Output, type LanguageModel, type ModelMessage } from "ai";
import type { Stage2Agent, Stage2Input, Stage2Result, ToolContext } from "../ports";
import type { ProposedAction } from "../types";
import { STAGE2_JSON_FORMAT, STAGE2_SYSTEM, buildPrompt } from "./prompt";
import { Stage2OutputSchema } from "./schema";
import { buildTools } from "./tools";

export type Stage2OutputMode = "native" | "json-text";
export type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

type Options = { model: string; outputMode: Stage2OutputMode; timeoutMs?: number; languageModel?: LanguageModel; providerOptions?: ProviderOptions };

const MAX_STEPS = 5;
const MAX_OUTPUT_TOKENS = 600;
const RETRY_MESSAGE = 'Balasan tadi bukan JSON yang valid. Balas ulang HANYA dengan satu objek JSON {"action": {...}} sesuai aturan.';

type Run = {
  steps: { toolResults: { toolName: string; output: unknown }[] }[];
  totalUsage: { inputTokens: number | undefined; outputTokens: number | undefined };
};

function parseJsonAction(text: string): ProposedAction | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = Stage2OutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data.action : null;
  } catch {
    return null;
  }
}

const sum = (values: (number | undefined)[]) => (values.some((v) => v !== undefined) ? values.reduce<number>((total, v) => total + (v ?? 0), 0) : null);

export function createStage2Agent({ model, outputMode, timeoutMs = 12_000, languageModel, providerOptions }: Options): Stage2Agent {
  const instructions = outputMode === "json-text" ? STAGE2_SYSTEM + STAGE2_JSON_FORMAT : STAGE2_SYSTEM;

  return {
    model,
    async propose(input: Stage2Input, tools: ToolContext): Promise<Stage2Result> {
      const signal = AbortSignal.timeout(timeoutMs);
      const common = {
        model: languageModel ?? model,
        instructions,
        tools: buildTools(tools),
        stopWhen: isStepCount(MAX_STEPS),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: signal,
        providerOptions,
      };
      const runs: Run[] = [];
      let action: ProposedAction | null;

      if (outputMode === "native") {
        const result = await generateText({ ...common, prompt: buildPrompt(input), output: Output.object({ schema: Stage2OutputSchema }) });
        runs.push(result);
        action = result.output.action;
      } else {
        const messages: ModelMessage[] = [{ role: "user", content: buildPrompt(input) }];
        const first = await generateText({ ...common, messages });
        runs.push(first);
        action = parseJsonAction(first.text);
        if (!action) {
          const retry = await generateText({
            ...common,
            messages: [...messages, ...first.response.messages, { role: "user", content: RETRY_MESSAGE }],
          });
          runs.push(retry);
          action = parseJsonAction(retry.text);
        }
        if (!action) throw new Error("Stage-2 model returned no valid action");
      }

      const toolResults = runs.flatMap((run) => run.steps.flatMap((step) => step.toolResults));
      return {
        action,
        model,
        inputTokens: sum(runs.map((run) => run.totalUsage.inputTokens)),
        outputTokens: sum(runs.map((run) => run.totalUsage.outputTokens)),
        toolNames: toolResults.map((result) => result.toolName),
        toolOutputs: toolResults.map((result) => result.output),
      };
    },
  };
}
