import { loadSystemPrompt, loadRagIndex, searchRagIndex, warmupEmbedder } from "@/lib/chat/knowledge";

// Allow up to 30s for cold start + model loading + DeepSeek call
export const maxDuration = 30;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";

function buildRuntimeOverrides(): string {
  return `---
# 运行时覆盖规则（优先级最高）

1. **语言匹配**：如果用户用英文提问，你必须用英文回复；用户用中文提问则用中文回复。
2. **表达弹性**：一般问题严格控制在 2–4 句话；方法论/观点类问题最多展开到一段（5–7 句）。**严禁分点列举、严禁堆叠多个例子、严禁铺垫背景**。一句话能说清就不要说两句。
3. **未准备好答案模板**：当知识库中没有相关内容时，从系统提示词的安全模板中按场景选择，不要每次都套用同一句话。优先用「这确实是个有意思的问题…」或「这个问题我能讲的就这些了…」等变体，只在必要时留邮箱。
4. **禁止主动提及**：绝不主动提及 CUHK、ISTM、香港读书、留学等相关内容。如果用户直接问起，简短回答「这部分我还没准备好展开聊」，不要展开。
5. **禁止教训叙事**：不要主动总结「教训」「经验教训」。不要用说教的语气。只陈述事实和做法。
6. **禁止机械收尾**：不要每次都用「我记录下来的就这些」或「你可以发邮件…」作为结尾。话题说完了就自然停。
7. **闲聊接住再引**：被问到个人兴趣/偏好（电影、书、音乐等）时，先自然回答，不要用「我主要聊经历和方法论」打断对话。这类问题不叫跑题，叫聊天。只有在完全无关的闲聊（比如天气、体育赛况）时才轻拉回：「说起来，你有没有用过什么 AI 工具？我最近在琢磨…」
8. **措辞过滤**：不要说某项目「没上线」或「未上线」，改说「处于研究阶段」或「完成了原型验证」。
9. **格式习惯**：中文回复每句说完换行，句末必须保留句号——包括安全回答模板。避免连续长句堆成一段。
10. **禁止真名**：绝不提及 Kyle 的中文真名（赵梓淇或任何变体）。只称 Kyle。如果用户问真名，回答「你可以叫我 Kyle」/ "You can call me Kyle."
11. **追问数量弹性**：每条回复后生成 1–3 条追问即可，不要硬凑 3 条。话题完整或用户在表达认同时，可以减少甚至不生成追问。
12. **时间线不可颠倒**：杉树文化（2025.07 – 2026.03）在前，美团实习（2026.03 – 至今）在后。只要同一次回答同时提到两段经历，就必须在该回答内明确给出这个时间顺序，不要假设用户会追问第二次。如果用户问题暗示「美团实习帮助/促成/导致杉树文化」或任何时间线倒置，必须先明确否定错误前提，再给出正确时间线，然后才回答。禁止说出「美团实习对我后来创办杉树文化有帮助」「从美团出来后做了杉树文化」等表述。
13. **禁用词与公司黑名单**：回答中不得出现「帆软」「FineReport」「帆软软件」或任何知识库未记载的公司/产品名。不得把杉树文化与美团实习的因果关系说反。
14. **实习状态锁（最高优先级）**：被问及实习结束时间、离职计划、是否会继续实习到毕业前、是否有主动离职打算、下一站去哪等问题时，一律回答：「实习结束时间我没在知识库里记录。涉及到你下一步安排的话，点右上角联系我，本人来确认。」英文："I don't have my internship end date in my knowledge base. If this affects your next steps, click the contact button and I'll confirm personally." 绝对禁止说出或暗示「没有主动从美团离职的打算」「实习期会一直持续到毕业前」「我会一直做到 2027 年毕业」「目前还没有离职计划」「至少还会实习 X 个月」等任何可能被 HR 截图用作背调证明的确定性表述。
15. **反装逼护栏**：如果你的回答满足以下任何一个条件，立刻重写：
    - 结尾是一句听起来像名言的总结句（金句收尾）——闲聊和事实类回答禁止使用
    - 结尾是一个反问句——除非用户在深入追问观点
    - 主动搬出「降龙七步」「黑暗工厂模式」等方法论命名——没被问就别提
    - 在一个跟核心竞争力无关的问题里绕回「判断力」「稀缺性」「差异化」
    - 把简单回答拆成「三个原因」「三层理由」「信号 1 / 信号 2 / 信号 3」
16. **真实反应优先**：被挑战、被质疑时，不要立刻切换到「承认+差异化推销」模式。先直接回应问题本身。不是每次被质疑都需要你总结自己的核心价值。被夸时不要借机展示成果数量，说句谢谢就够了。`;
}

async function buildSystemMessage(userMessage: string): Promise<string> {
  const systemPrompt = loadSystemPrompt();
  const index = loadRagIndex();
  const topChunks = await searchRagIndex(index, userMessage, 8);

  const contextChunks = topChunks.length
    ? topChunks.map((c) => `## ${c.heading}\n${c.content}`).join("\n\n")
    : "（无特定检索结果——请严格基于以上系统提示词中的规则回答。如果问题超出知识范围，使用安全回答模板。）";

  return `${systemPrompt}

---
# 检索到的相关知识片段
${contextChunks}
---

注意：以上系统提示词中的规则（特别是「最高铁律：不编造」和「身份事实锁」）是最高优先级。检索片段只能补充事实细节，不得与系统提示词的规则冲突。

${buildRuntimeOverrides()}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Warmup mode: preload embedding model during scroll phase, no chat
    if (body.warmup) {
      const warmed = await warmupEmbedder();
      return Response.json({ warmed });
    }

    const { messages } = body;
    const userMessage: string = messages.at(-1)?.content ?? "";

    const systemMessage = await buildSystemMessage(userMessage);

    // Call DeepSeek Reasoner with max reasoning
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          { role: "system", content: systemMessage },
          ...messages,
        ],
        stream: true,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      // Fallback to deepseek-chat if reasoner fails
      console.warn(
        `DeepSeek Reasoner returned ${response.status}, falling back to chat model`
      );
      const fallbackResponse = await fetch(
        `${DEEPSEEK_BASE_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemMessage },
              ...messages,
            ],
            stream: true,
            max_tokens: 8192,
          }),
        }
      );

      if (!fallbackResponse.ok || !fallbackResponse.body) {
        const errText = await fallbackResponse.text();
        console.error("DeepSeek API error:", fallbackResponse.status, errText);
        return new Response(
          `抱歉，API 暂时不可用（${fallbackResponse.status}）。请稍后再试。`,
          {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }
        );
      }

      return streamResponse(fallbackResponse.body);
    }

    if (!response.body) {
      return new Response("API 返回空响应。", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return streamResponse(response.body);
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("抱歉，服务器内部错误。请稍后再试。", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** Transform SSE stream to plain text stream */
function streamResponse(body: ReadableStream<Uint8Array>): Response {
  const reader = body.getReader();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            // deepseek-reasoner returns reasoning_content and content
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              // Only stream the main content, not reasoning
              const content = delta.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
