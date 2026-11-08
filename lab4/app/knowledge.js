
const KNOWLEDGE_URL = "./data/bg3-knowledge.json";

let knowledgeBase = null;

// Завантаження бази знань
export async function loadKnowledgeBase() {
    if (knowledgeBase) {
        return knowledgeBase;
    }

    const response = await fetch(KNOWLEDGE_URL);

    if (!response.ok) {
        throw new Error(
            `Не вдалося завантажити базу знань: ${response.status}`
        );
    }

    knowledgeBase = await response.json();

    if (!Array.isArray(knowledgeBase)) {
        throw new Error("Неправильний формат бази знань.");
    }

    return knowledgeBase;
}

// Пошук відповідних записів
export async function searchKnowledge(query, limit = 3) {
    const data = await loadKnowledgeBase();

    const words = query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(word => word.length > 2);

    if (words.length === 0) {
        return [];
    }

    const results = data.map(entry => {
        const searchableText = [
            entry.title,
            entry.content,
            ...(entry.tags || [])
        ].join(" ").toLowerCase();

        let score = 0;

        for (const word of words) {
            if (entry.title.toLowerCase().includes(word)) {
                score += 3;
            }

            if ((entry.tags || []).some(tag =>
                tag.toLowerCase().includes(word)
            )) {
                score += 2;
            }

            if (entry.content.toLowerCase().includes(word)) {
                score += 1;
            }
        }

        return { entry, score };
    });

    return results
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(result => result.entry);
}

// Формування контексту для моделі
export function formatKnowledgeContext(entries) {
    if (!entries.length) {
        return "У локальній базі знань не знайдено відповідної інформації.";
    }

    return entries.map(entry => `
Тема: ${entry.title}
Категорія: ${entry.category}
Інформація: ${entry.content}
Джерело: ${entry.source}
Посилання: ${entry.sourceUrl}
`).join("\n---\n");
}
