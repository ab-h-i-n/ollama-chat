import { getInstanceStatus } from "@/lib/aws";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Get the current IP of the EC2 instance
  const status = await getInstanceStatus();
  
  if (typeof status === "string" || status.state !== "running" || !status.publicIp) {
    return new Response("EC2 instance is not running", { status: 503 });
  }

  const model = process.env.OLLAMA_MODEL || "dolphin-llama3:8b"; 

  try {
    const response = await fetch(`http://${status.publicIp}:11434/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      return new Response(`Ollama API error: ${response.statusText}`, { status: response.status });
    }

    if (!response.body) {
      return new Response("No response body from Ollama", { status: 500 });
    }

    // Create a TransformStream to process the NDJSON from Ollama
    // Each line is a JSON object with { message: { content: "text" }, done: boolean }
    const stream = new ReadableStream({
        async start(controller) {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

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
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

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
        }
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Failed to generate response. Ensure Ollama is running on port 11434.", { status: 500 });
  }
}
