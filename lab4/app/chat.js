const OLLAMA_URL = "http://localhost:11434/api/chat";

const MODEL = "gemma3:4b-it-q4_K_M";

const SETTINGS = {
    temperature: 0.3,
    num_predict: 1200,
    num_ctx: 4096
};

export async function streamChat(messages, onDelta, signal) {
    const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: messages,
            stream: true,
            options: SETTINGS
        }),
        signal
    });

    if (!response.ok) {
        throw new Error(`Помилка Ollama: ${response.status}`);
    }

    if (!response.body) {
        throw new Error("Не вдалося отримати потік відповіді.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let result = "";

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value, {
                stream: true
            });

            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;

                const data = JSON.parse(line);

                if (data.error) {
                    throw new Error(data.error);
                }

                const content = data.message?.content;

                if (content) {
                    result += content;
                    onDelta(content);
                }

                if (data.done) {
                    return result;
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return result;
}
