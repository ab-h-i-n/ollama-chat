import { getInstanceStatus } from "@/lib/aws";
import { OpenAI } from "openai";

const HF_MODEL = "moonshotai/Kimi-K2.5:novita";

async function generateTitleCloud(message: string): Promise<string> {
  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN,
  });

  const response = await client.chat.completions.create({
    model: HF_MODEL,
    messages: [
      {
        role: "user",
        content: `Generate a short title (3-6 words, no quotes, no punctuation at the end) for a chat that starts with this message: "${message}"`,
      },
    ],
    max_tokens: 30,
  });

  return response.choices[0]?.message?.content?.trim() || message.slice(0, 40);
}

async function generateTitleLocal(
  message: string,
  ip: string,
  model: string
): Promise<string> {
  const response = await fetch(`http://${ip}:11434/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `Generate a short title (3-6 words, no quotes, no punctuation at the end) for a chat that starts with this message: "${message}"`,
      stream: false,
    }),
  });

  if (!response.ok) {
    return message.slice(0, 40);
  }

  const data = await response.json();
  return (data.response || message.slice(0, 40))
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\n/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const { message, provider } = await req.json();

  try {
    let title: string;

    if (provider === "cloud") {
      if (!process.env.HF_TOKEN) {
        return Response.json({ title: message.slice(0, 40) });
      }
      title = await generateTitleCloud(message);
    } else {
      const status = await getInstanceStatus();
      if (
        typeof status === "string" ||
        status.state !== "running" ||
        !status.publicIp
      ) {
        return Response.json({ title: message.slice(0, 40) });
      }
      const model = process.env.OLLAMA_MODEL || "dolphin-llama3:8b";
      title = await generateTitleLocal(message, status.publicIp, model);
    }

    // Clean up and limit length
    title = title
      .replace(/^["']|["']$/g, "")
      .replace(/\n/g, " ")
      .trim();

    if (title.length > 50) {
      title = title.slice(0, 47) + "...";
    }

    return Response.json({ title: title || message.slice(0, 40) });
  } catch {
    return Response.json({ title: message.slice(0, 40) });
  }
}
