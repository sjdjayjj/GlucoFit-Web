import { upstreamFetchJson } from "@/lib/upstream-fetch";
import { extractJson } from "@/lib/ai-client";

/**
 * 语音/口语餐食解析 (v2.2)：
 * 前端经 Web Speech API 转写出的口语描述 → BYOK LLM → 结构化饮食打卡 JSON。
 * AI 凭证仍由前端传入（BYOK），服务器不留存。
 */

const VOICE_PARSE_PROMPT = `你是一位控糖饮食记录助手。用户会用口语描述一餐（可能包含进食内容、顺序、是否走动、餐后精神状态）。
请解析为纯 JSON（不得包含 Markdown 标记），字段规范：
{"mealType": "breakfast" | "lunch" | "dinner" | "snack",
"foodSummary": string,
"followedSequence": boolean,
"avoidedRefinedCarb": boolean,
"postMealActivity": boolean,
"energyReaction": "energetic" | "normal" | "food_coma",
"calories": number,
"carbsG": number,
"proteinG": number,
"fatG": number}
判断依据：
- mealType：按描述的时间词（早/午/晚/加餐）推断，无法判断按当前餐次常识推断
- followedSequence：提及先吃蔬菜/蛋白后吃主食为 true；先吃主食/混着吃为 false；未提及默认 false
- avoidedRefinedCarb：出现白米饭、白面条、白面包、含糖饮料、甜点等精制碳水为 false；明确粗粮/杂粮/无糖为 true；未提及默认 false
- postMealActivity：提及散步/走路/运动为 true，明确说"没去散步/没运动"为 false
- energyReaction：提到困、累、昏沉、想睡为 food_coma；提到精神好为 energetic；否则 normal
- calories/carbsG/proteinG/fatG：按常见份量合理估算数值`;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      text?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    } | null;
    const text = body?.text?.trim();
    if (!text) {
      return Response.json({ error: "缺少转写文本" }, { status: 400 });
    }
    if (!body?.baseUrl || !body?.apiKey || !body?.model) {
      return Response.json(
        { error: "请先在设置中配置 AI 模型后再使用语音解析" },
        { status: 400 }
      );
    }

    let url = String(body.baseUrl).replace(/\/+$/, "");
    if (!/\/chat\/completions$/.test(url)) url += "/chat/completions";

    const res = await upstreamFetchJson(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${body.apiKey}` },
      body: JSON.stringify({
        model: body.model,
        messages: [
          { role: "system", content: VOICE_PARSE_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.1,
      }),
      timeoutMs: 120_000,
    });

    const data = res.data as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message || `AI 服务返回 ${res.status}` },
        { status: 502 }
      );
    }
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson<Record<string, unknown>>(raw);
    if (!parsed?.foodSummary) {
      return Response.json(
        { error: "未能从描述中解析出餐食信息，请换个说法或手动填写" },
        { status: 422 }
      );
    }
    return Response.json({ parsed });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return Response.json(
      {
        error:
          err?.name === "TimeoutError"
            ? "AI 解析超时，请重试"
            : err?.message || "语音解析失败",
      },
      { status: 500 }
    );
  }
}
