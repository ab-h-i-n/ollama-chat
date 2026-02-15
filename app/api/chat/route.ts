import { getInstanceStatus } from "@/lib/aws";
import { OpenAI } from "openai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const HF_MODEL = "moonshotai/Kimi-K2.5:novita";

function getHFClient() {
  return new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN,
  });
}

async function handleCloudChat(messages: { role: string; content: string; images?: string[] }[]) {
  const client = getHFClient();

  // Build messages with multimodal content when images are present
  const formattedMessages = messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === "user") {
      // Multimodal message with images
      const content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [];

      // Add images first
      for (const img of m.images) {
        content.push({
          type: "image_url" as const,
          image_url: { url: img },
        });
      }

      // Add text content
      if (m.content) {
        content.push({ type: "text" as const, text: m.content });
      } else {
        content.push({ type: "text" as const, text: "Describe this image." });
      }

      return {
        role: m.role as "user" | "assistant" | "system",
        content,
      };
    }

    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    };
  });

  const stream = await client.chat.completions.create({
    model: HF_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: formattedMessages as any,
    stream: true,
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(content);
          }
        }
      } catch (err) {
        console.error("HF stream error:", err);
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleLocalChat(messages: { role: string; content: string }[]) {
  const status = await getInstanceStatus();

  if (
    typeof status === "string" ||
    status.state !== "running" ||
    !status.publicIp
  ) {
    return new Response("EC2 instance is not running", { status: 503 });
  }

  const model = process.env.OLLAMA_MODEL || "dolphin-llama3:8b";

  const response = await fetch(`http://${status.publicIp}:11434/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    return new Response(`Ollama API error: ${response.statusText}`, {
      status: response.status,
    });
  }

  if (!response.body) {
    return new Response("No response body from Ollama", { status: 500 });
  }

  // Create a TransformStream to process the NDJSON from Ollama
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer) {
              try {
                const json = JSON.parse(buffer);
                if (json.message?.content) {
                  controller.enqueue(json.message.content);
                }
              } catch (e) {
                console.error("Error parsing final buffer", e);
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                controller.enqueue(json.message.content);
              }
            } catch (e) {
              console.error("Error parsing JSON line", e);
            }
          }
        }
      } catch (err) {
        console.error("Stream error", err);
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const { messages, provider } = await req.json();

  try {
    if (provider === "cloud") {
      if (!process.env.HF_TOKEN) {
        return new Response("HF_TOKEN not configured", { status: 500 });
      }
      return await handleCloudChat(messages);
    } else {
      return await handleLocalChat(messages);
    }
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      "Failed to generate response.",
      { status: 500 }
    );
  }
}
