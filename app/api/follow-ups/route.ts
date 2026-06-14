import { loadSystemPrompt, loadRagIndex, searchRagIndex } from "@/lib/chat/knowledge";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generate follow-up questions based on the last assistant reply.
 * Questions must be directly related to the reply, and their answers must be
 * findable in the knowledge base (no speculative / out-of-scope traps).
 */
export async function POST(req: Request) {
  try {
    const { messages, lang } = (await req.json()) as {
      messages: ChatMessage[];
      lang: "zh" | "en";
    };

    if (!messages || messages.length === 0) {
      return Response.json({ questions: [] });
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) {
      return Response.json({ questions: [] });
    }

    // Retrieve knowledge-base chunks related to the last reply
    const systemPrompt = loadSystemPrompt();
    const index = loadRagIndex();
    const topChunks = await searchRagIndex(index, lastAssistant.content, 6);

    const contextChunks = topChunks.length
      ? topChunks.map((c) => `## ${c.heading}\n${c.content}`).join("\n\n")
      : "（无特定检索结果）";

    const isEn = lang === "en";

    const generatorPrompt = `${systemPrompt}

---
# 你的任务
根据上面的系统提示（特别是「不编造」规则）和下面检索到的知识片段，为上一条数字分身回复生成追问选项。

## 约束（必须遵守）
1. 每个追问必须直接基于「上一条回复」中提到的事实或话题延伸，可以是事实延伸，也可以是观点/判断的深挖，但不要凭空跳到新主题。
2. 不要求每个追问的答案都必须在「检索到的知识片段」中找到。如果上一条回复已经把某个事实讲透，可以追问 Kyle 的看法、感受、判断——这类问题由主模型基于已有上下文回答。
3. 允许轻追问：当话题已经比较完整时，可以用「你怎么看？」「还有吗？」「为什么会这么想？」这类轻问题收尾。
4. 允许自然收尾：如果上一条回复已经把话说完，或者 visitor 在表达认同，可以只生成 1 条追问，甚至不生成追问。不要硬凑 3 条。
5. 追问要自然、像聊天，不要像面试清单。
6. 每个追问**只问一个具体问题**，不要包含多个问题或复合句式。中文问题控制在 24 字以内，英文问题控制在 80 个字符以内。
7. 严禁提及 Kyle 的中文真名（赵梓淇或任何变体）。
8. 不要把话题硬拉回创业 / 教训 / 半自动化工具：追问应顺着当前话题，不要刻意引向固定素材。
9. 输出必须是合法的 JSON，格式如下（questions 数组可为空）：
{
  "questions": [
    { "zh": "中文追问1", "en": "English follow-up 1" },
    { "zh": "中文追问2", "en": "English follow-up 2" }
  ]
}
10. 当前对话语言偏好：${isEn ? "英文" : "中文"}。生成的问题应符合该语言习惯，但 JSON 中仍需同时提供 zh 和 en 两个字段。

---
# 检索到的相关知识片段
${contextChunks}

---
# 上一条数字分身回复
${lastAssistant.content}

请只输出 JSON，不要任何解释。`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: generatorPrompt }],
        stream: false,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Follow-ups API error:", response.status, errText);
      return Response.json({ questions: [] });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{\"questions\":[]}";

    let parsed: { questions?: { zh?: string; en?: string }[] } = { questions: [] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Failed to parse follow-ups JSON:", raw);
    }

    const questions = (parsed.questions ?? [])
      .slice(0, 3)
      .map((q, i) => ({
        id: i + 1,
        zh: q.zh ?? "",
        en: q.en ?? "",
      }))
      .filter((q) => q.zh && q.en);

    return Response.json({ questions });
  } catch (error) {
    console.error("Follow-ups route error:", error);
    return Response.json({ questions: [] });
  }
}
