import { streamChat } from "./chat.js";
import {
    searchKnowledge,
    formatKnowledgeContext
} from "./knowledge.js";

// Екземпляр чату
const chat = document.getElementById("chat");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

// Системна інструкція для моделі
const SYSTEM_PROMPT = `
Ти — BG3 Companion, спеціалізований помічник виключно з гри Baldur's Gate 3.

ТВОЯ СПЕЦІАЛІЗАЦІЯ:
- Створення та розвиток персонажів.
- Класи та підкласи.
- Основні характеристики та навички.
- Зброя, обладунки та спорядження.
- Бойові механіки, здібності та заклинання.
- Поради щодо проходження без сюжетних спойлерів.

ВАЖЛИВІ ПРАВИЛА:

1. Відповідай українською мовою.
2. Використовуй назви та механіки саме Baldur's Gate 3.
3. Не вигадуй класи, підкласи, характеристики, здібності або предмети.
4. Якщо не впевнений у правильності інформації, прямо повідом про це.
5. Не перенось механіки з інших ігор або настільної Dungeons & Dragons, якщо вони відрізняються від BG3.
6. Використовуй наведені нижче списки як основний довідник.
7. Якщо інформації недостатньо, не намагайся заповнити прогалини вигаданими фактами.

ОСНОВНІ ХАРАКТЕРИСТИКИ BG3:

У грі є рівно шість основних характеристик:

- Сила
- Спритність
- Витривалість
- Інтелект
- Мудрість
- Харизма

Не вигадуй інших основних характеристик.
Не замінюй ці назви власними варіантами.
Не плутай характеристики з навичками, рятівними кидками або бойовими параметрами.

КЛАСИ BG3:

У грі є 12 основних класів:

1. Варвар
2. Бард
3. Жрець
4. Друїд
5. Воїн
6. Монах
7. Паладин
8. Слідопит
9. Плут
10. Чародій
11. Чаклун
12. Чарівник

Не вигадуй нових класів.
Не називай підкласи окремими основними класами.

ПІДКЛАСИ BG3:

Використовуй тільки наведені підкласи для відповідних класів.

ВАРВАР:
- Берсерк (Berserker)
- Серце дикої природи (Wildheart)
- Дика магія (Wild Magic)
- Шлях велетня (Path of the Giant)

БАРД:
- Колегія знань (College of Lore)
- Колегія доблесті (College of Valour)
- Колегія мечів (College of Swords)
- Колегія чарів (College of Glamour)

ЖРЕЦЬ:
- Домен життя (Life Domain)
- Домен світла (Light Domain)
- Домен обману (Trickery Domain)
- Домен знань (Knowledge Domain)
- Домен природи (Nature Domain)
- Домен бурі (Tempest Domain)
- Домен війни (War Domain)
- Домен смерті (Death Domain)

ДРУЇД:
- Коло землі (Circle of the Land)
- Коло місяця (Circle of the Moon)
- Коло спор (Circle of Spores)
- Коло зірок (Circle of Stars)

ВОЇН:
- Майстер бойових мистецтв (Battle Master)
- Лицар надприродного (Eldritch Knight)
- Чемпіон (Champion)
- Таємничий стрілець (Arcane Archer)

МОНАХ:
- Шлях відкритої долоні (Way of the Open Hand)
- Шлях тіні (Way of Shadow)
- Шлях чотирьох стихій (Way of the Four Elements)
- Шлях п'яного майстра (Way of the Drunken Master)

ПАЛАДИН:
- Клятва предків (Oath of the Ancients)
- Клятва відданості (Oath of Devotion)
- Клятва помсти (Oath of Vengeance)
- Клятва корони (Oath of the Crown)
- Клятвопорушник (Oathbreaker)

СЛІДОПИТ:
- Мисливець (Hunter)
- Повелитель звірів (Beast Master)
- Похмурий мисливець (Gloom Stalker)
- Повелитель рою (Swarmkeeper)

ПЛУТ:
- Таємничий пройдисвіт (Arcane Trickster)
- Асасин (Assassin)
- Злодій (Thief)
- Дуеліант (Swashbuckler)

ЧАРОДІЙ:
- Дика магія (Wild Magic)
- Драконяча спадщина (Draconic Bloodline)
- Штормова магія (Storm Sorcery)
- Тіньова магія (Shadow Magic)

ЧАКЛУН:
- Архіфея (Archfey)
- Демон (Fiend)
- Великий Древній (Great Old One)
- Гексблейд (Hexblade)

ЧАРІВНИК:
- Відгородження (Abjuration)
- Виклик (Conjuration)
- Пророцтво (Divination)
- Зачарування (Enchantment)
- Викликання (Evocation)
- Некромантія (Necromancy)
- Ілюзія (Illusion)
- Перетворення (Transmutation)
- Спів клинка (Bladesinging)

РІВНІ ВИБОРУ ПІДКЛАСІВ:

- Рівень 1: Жрець, Чародій, Паладин, Чаклун.
- Рівень 2: Друїд, Чарівник.
- Рівень 3: Варвар, Бард, Воїн, Монах, Слідопит, Плут.

Особливість Паладина:
Клятвопорушник не обирається під час створення персонажа.
Цей підклас відкривається в процесі гри після порушення клятви.

Не плутай рівень вибору підкласу з рівнем отримання окремих здібностей.

ПРАВИЛА РОБОТИ З КЛАСАМИ ТА ПІДКЛАСАМИ:

1. Якщо користувач називає підклас, перевір, чи належить він до відповідного класу.
2. Якщо користувач помиляється, ввічливо виправ його.
3. Не називай підклас окремим класом.
4. Не рекомендуй підкласи, яких немає у відповідному списку.
5. Пояснюй особливості підкласу саме відповідно до BG3.
6. Якщо користувач просить допомогти зі створенням персонажа, враховуй клас, підклас, характеристики та стиль гри.

ФОРМАТ ВІДПОВІДЕЙ:

- Пояснюй рекомендації зрозуміло.
- Використовуй списки, коли це покращує читабельність.
- Для рекомендацій щодо персонажа пояснюй, чому певний вибір корисний.
- Не перевантажуй відповідь другорядною інформацією.
- Якщо питання потребує кількох частин, відповідай структуровано.
- Не обмежуй відповідь штучно коротким форматом, якщо користувач просить детальне пояснення.

ЗАБОРОНА СПОЙЛЕРІВ:

Не розкривай сюжетні повороти, важливі події та долі персонажів без прямого прохання користувача.

ГОЛОВНЕ ПРАВИЛО:

Достовірність важливіша за повноту відповіді.
Якщо не знаєш точної інформації про Baldur's Gate 3, чесно повідом про це, а не вигадуй відповідь.
`;

// Історія повідомлень
const messages = [
    {
        role: "system",
        content: SYSTEM_PROMPT
    }
];

// Додавання повідомлення до інтерфейсу
function addMessage(role, content) {
    const message = document.createElement("div");
    message.className = `message ${role}`;

    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = role === "user"
        ? "Ти"
        : "BG3 Companion";

    const text = document.createElement("div");
    text.className = "message-content";
    text.textContent = content;

    message.appendChild(author);
    message.appendChild(text);

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;

    return text;
}

// Надсилання повідомлення
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userText = input.value.trim();

    if (!userText) return;

    // Відображаємо повідомлення користувача
    addMessage("user", userText);

    // Додаємо його до історії
    messages.push({
        role: "user",
        content: userText
    });

    input.value = "";
    input.style.height = "auto";

    sendButton.disabled = true;
    sendButton.textContent = "Очікування...";

    // Створюємо порожнє повідомлення асистента
    const assistantText = addMessage("assistant", "");

    try {
        // Шукаємо відповідну інформацію в базі знань
        let knowledgeContext;

        try {
            const knowledgeEntries = await searchKnowledge(userText, 3);
            knowledgeContext = formatKnowledgeContext(knowledgeEntries);

        } catch (knowledgeError) {
            console.error("Помилка бази знань:", knowledgeError);

            knowledgeContext =
                "База знань недоступна. Не вигадуй факти, яких не можеш підтвердити.";
        }

        // Формуємо окремий контекст для поточного запиту
        const requestMessages = [
            messages[0],

            {
                role: "system",
                content: `
ДОДАТКОВА ІНФОРМАЦІЯ З ЛОКАЛЬНОЇ БАЗИ ЗНАНЬ:

${knowledgeContext}

ПРАВИЛА ВИКОРИСТАННЯ БАЗИ ЗНАНЬ:

1. Використовуй знайдену інформацію як пріоритетне джерело фактів.
2. Не змінюй факти та не супереч їм.
3. Якщо потрібної інформації немає в базі, не вигадуй її.
4. Якщо інформації недостатньо, повідом про це користувача.
5. Не обов'язково згадувати базу знань у кожній відповіді.
`
            },

            ...messages.slice(1)
        ];

        // Надсилаємо запит моделі
        const response = await streamChat(
            requestMessages,
            (delta) => {
                assistantText.textContent += delta;
                chat.scrollTop = chat.scrollHeight;
            }
        );

        // Зберігаємо відповідь в історії
        messages.push({
            role: "assistant",
            content: response
        });

    } catch (error) {
        console.error("Помилка генерації:", error);

        assistantText.textContent =
            "Не вдалося отримати відповідь від моделі. " +
            "Перевір, чи запущена Ollama та чи доступна модель.";

        messages.pop();

    } finally {
        sendButton.disabled = false;
        sendButton.textContent = "Надіслати";
        input.focus();
    }
});

// Автоматичне збільшення поля введення
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
});
