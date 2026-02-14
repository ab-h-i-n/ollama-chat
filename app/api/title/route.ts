import { getInstanceStatus } from "@/lib/aws";

export async function POST(req: Request) {
  const { message } = await req.json();

  const status = await getInstanceStatus();

  if (typeof status === "string" || status.state !== "running" || !status.publicIp) {
    return Response.json({ title: message.slice(0, 40) });
  }

  const model = process.env.OLLAMA_MODEL || "dolphin-llama3:8b";

  try {
    const response = await fetch(`http://${status.publicIp}:11434/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `Generate a short title (3-6 words, no quotes, no punctuation at the end) for a chat that starts with this message: "${message}"`,
        stream: false,
      }),
    });

    if (!response.ok) {
      return Response.json({ title: message.slice(0, 40) });
    }

    const data = await response.json();
    // Clean up the title - remove quotes, trim, limit length
    let title = (data.response || message.slice(0, 40))
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*$/gi, "")
      .replace(/^["']|["']$/g, "")
      .replace(/\n/g, " ")
      .trim();

    // Limit to reasonable length
    if (title.length > 50) {
      title = title.slice(0, 47) + "...";
    }

    return Response.json({ title: title || message.slice(0, 40) });
  } catch {
    return Response.json({ title: message.slice(0, 40) });
  }
}
