/**
 * 本地 LLM 介接層（Ollama）
 *
 * 依「資料不得出內網」的限制，所有推論都打到內網自架的模型服務，
 * 不呼叫任何公有雲 API。
 *
 * 這一層刻意做成薄封裝：日後將模型從開發機的 Ollama 換成
 * GPU 伺服器上的 vLLM，只需改這個檔案，其餘商業邏輯不動。
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b-instruct";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  /** 要求模型輸出合法 JSON */
  json?: boolean;
  temperature?: number;
  /** 逾時毫秒數，語音面試場景需要較短的逾時 */
  timeoutMs?: number;
};

export class LLMError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

/** 呼叫本地模型並取得純文字回覆 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { json = false, temperature = 0.2, timeoutMs = 120_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        format: json ? "json" : undefined,
        options: { temperature },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new LLMError(
        `本地模型回應錯誤 (${res.status})：${detail.slice(0, 300)}`
      );
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (!content) throw new LLMError("本地模型未回傳內容");
    return content;
  } catch (err) {
    if (err instanceof LLMError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LLMError(`本地模型逾時（${timeoutMs}ms）`, err);
    }
    throw new LLMError(
      `無法連線到本地模型 ${OLLAMA_URL}。請確認 Ollama 已啟動，且已下載模型 ${MODEL}。`,
      err
    );
  } finally {
    clearTimeout(timer);
  }
}

/** 呼叫本地模型並解析為 JSON 物件 */
export async function chatJson<T>(
  messages: ChatMessage[],
  options: Omit<ChatOptions, "json"> = {}
): Promise<T> {
  const raw = await chat(messages, { ...options, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 小型模型偶爾會在 JSON 前後夾帶說明文字，嘗試擷取最外層物件
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* 落到下方拋錯 */
      }
    }
    throw new LLMError(`模型輸出非合法 JSON：${raw.slice(0, 300)}`);
  }
}

/** 檢查本地模型服務是否就緒，供設定頁與健康檢查使用 */
export async function checkLLM(): Promise<{
  ok: boolean;
  model: string;
  url: string;
  message: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, model: MODEL, url: OLLAMA_URL, message: `服務回應 ${res.status}` };
    }
    const data = (await res.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((m) => m.name);
    const loaded = names.some((n) => n === MODEL || n.startsWith(MODEL.split(":")[0]));
    return {
      ok: loaded,
      model: MODEL,
      url: OLLAMA_URL,
      message: loaded
        ? "模型已就緒"
        : `服務已啟動，但找不到模型 ${MODEL}。請執行：ollama pull ${MODEL}`,
    };
  } catch {
    return {
      ok: false,
      model: MODEL,
      url: OLLAMA_URL,
      message: `無法連線到 ${OLLAMA_URL}，請確認 Ollama 已啟動`,
    };
  }
}
