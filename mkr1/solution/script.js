// ==========================================
// НАЛАШТУВАННЯ ТА DOM-ЕЛЕМЕНТИ
// ==========================================

const csvSelect = document.getElementById("csvSelect");
const importButton = document.getElementById("importButton");
const fileInfo = document.getElementById("fileInfo");
const resultMessage = document.getElementById("resultMessage");

const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const OLLAMA_MODEL = "gemma3:4b-it-q4_K_M";

let importedProducts = [];
let categoriesData = null;

// Контейнер попереднього перегляду товарів
let previewContainer = document.getElementById("productPreview");

if (!previewContainer) {
    previewContainer = document.createElement("section");
    previewContainer.id = "productPreview";
    previewContainer.className = "product-preview";

    if (resultMessage?.parentElement) {
        resultMessage.insertAdjacentElement("afterend", previewContainer);
    } else {
        document.body.appendChild(previewContainer);
    }
}


// ==========================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==========================================

function showMessage(message, type = "") {
    if (!resultMessage) {
        console.log(message);
        return;
    }

    resultMessage.textContent = message;
    resultMessage.className = `result-message ${type}`.trim();
}

async function readJSONResponse(response) {
    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error("Сервер повернув некоректну відповідь");
    }

    if (!response.ok) {
        throw new Error(data.error || `Помилка сервера: ${response.status}`);
    }

    return data;
}


// ==========================================
// ЗАВАНТАЖЕННЯ КАТЕГОРІЙ
// ==========================================

async function loadCategories() {
    const response = await fetch("/data/categories.json");
    const data = await readJSONResponse(response);

    if (!Array.isArray(data.categories)) {
        throw new Error("Некоректний формат categories.json");
    }

    for (const category of data.categories) {
        if (
            typeof category.name !== "string" ||
            !Array.isArray(category.subcategories)
        ) {
            throw new Error("У categories.json є некоректна категорія");
        }
    }

    categoriesData = data;
    return categoriesData;
}


// ==========================================
// ЗАВАНТАЖЕННЯ СПИСКУ CSV-ФАЙЛІВ
// ==========================================

async function loadCSVFiles() {
    if (!csvSelect) {
        console.error('У HTML не знайдено елемент із id="csvSelect"');
        return;
    }

    try {
        const response = await fetch("/api/csv-files");
        const data = await readJSONResponse(response);

        const files = Array.isArray(data) ? data : data.files;

        if (!Array.isArray(files)) {
            throw new Error("Сервер повернув неправильний список CSV-файлів");
        }

        csvSelect.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = files.length
            ? "Оберіть CSV-файл"
            : "CSV-файлів не знайдено";

        csvSelect.appendChild(placeholder);

        files.forEach(file => {
            const option = document.createElement("option");

            option.value = file;
            option.textContent = file;

            csvSelect.appendChild(option);
        });

        if (importButton) {
            importButton.disabled = files.length === 0;
        }

        if (fileInfo) {
            fileInfo.textContent = files.length
                ? `Знайдено CSV-файлів: ${files.length}`
                : "Додайте CSV-файл до папки uploads.";
        }

    } catch (error) {
        console.error("Помилка завантаження CSV:", error);

        csvSelect.innerHTML =
            '<option value="">Помилка завантаження списку</option>';

        showMessage(error.message, "error");
    }
}


// ==========================================
// ВИБІР CSV-ФАЙЛУ
// ==========================================

if (csvSelect) {
    csvSelect.addEventListener("change", () => {
        const file = csvSelect.value;

        if (importButton) {
            importButton.disabled = !file;
        }

        if (fileInfo) {
            fileInfo.textContent = file
                ? `Обрано файл: ${file}`
                : "Оберіть файл для імпорту.";
        }

        importedProducts = [];
        previewContainer.innerHTML = "";

        showMessage("");
    });
}


// ==========================================
// ІМПОРТ ТОВАРІВ ІЗ CSV
// ==========================================

async function importProducts() {
    if (!csvSelect || !importButton) return;

    const file = csvSelect.value;

    if (!file) {
        showMessage("Спочатку оберіть CSV-файл.", "error");
        return;
    }

    importButton.disabled = true;

    const originalButtonText = importButton.textContent;

    importButton.textContent = "Завантаження...";
    previewContainer.innerHTML = "";

    try {
        const response = await fetch("/api/import", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                file,
                filename: file
            })
        });

        const data = await readJSONResponse(response);

        if (!Array.isArray(data.products)) {
            throw new Error("Сервер не повернув список товарів (products)");
        }

        importedProducts = data.products;

        displayProducts(importedProducts);

        const added = Number.isFinite(data.added)
            ? data.added
            : importedProducts.length;

        const skipped = Number.isFinite(data.skipped)
            ? data.skipped
            : 0;

        showMessage(
            `Імпорт завершено. Товарів: ${added}. Пропущено: ${skipped}.`,
            "success"
        );

    } catch (error) {
        console.error("Помилка імпорту:", error);

        showMessage(error.message, "error");

    } finally {
        importButton.disabled = !csvSelect.value;

        importButton.textContent =
            originalButtonText || "Завантажити товари для перевірки";
    }
}

if (importButton) {
    importButton.addEventListener("click", importProducts);
}


// ==========================================
// ВІДОБРАЖЕННЯ СПИСКУ ТОВАРІВ
// ==========================================

function displayProducts(products) {
    previewContainer.innerHTML = "";

    if (!Array.isArray(products) || products.length === 0) {
        previewContainer.textContent =
            "У вибраному CSV-файлі товарів не знайдено.";

        return;
    }

    products.forEach((product, index) => {
        const card = document.createElement("article");

        card.className = "product-card";
        card.dataset.productIndex = String(index);

        const image = document.createElement("img");

        image.className = "product-image";
        image.alt = product.name || "Фото товару";

        const imageUrl = product.imageUrl ||
            (product.photo
                ? `/uploads/${encodeURIComponent(product.photo)}`
                : "");

        if (imageUrl) {
            image.src = imageUrl;
        } else {
            image.alt = "Для товару не вказано фото";
        }

        const name = document.createElement("h3");

        name.className = "product-name";
        name.textContent = product.name || "Без назви";

        const analyzeButton = document.createElement("button");

        analyzeButton.type = "button";
        analyzeButton.className = "button";
        analyzeButton.textContent = "Проаналізувати товар";

        const result = document.createElement("div");

        result.className = "product-ai-result";

        analyzeButton.addEventListener("click", async () => {
            await processSingleProduct(
                product,
                result,
                analyzeButton
            );
        });

        card.append(image, name, analyzeButton, result);

        previewContainer.appendChild(card);
    });
}


// ==========================================
// ПЕРЕТВОРЕННЯ ФОТОГРАФІЇ В BASE64
// ==========================================

async function imageToBase64(imageUrl) {
    if (!imageUrl) {
        throw new Error("Для товару не вказано шлях до фотографії");
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(`Не вдалося завантажити фото: ${response.status}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || "");
            const commaIndex = result.indexOf(",");

            if (commaIndex === -1) {
                reject(new Error("Не вдалося прочитати фотографію"));
                return;
            }

            resolve(result.slice(commaIndex + 1));
        };

        reader.onerror = () => {
            reject(new Error("Помилка читання фотографії"));
        };

        reader.readAsDataURL(blob);
    });
}


// ==========================================
// ФОРМУВАННЯ ЗАПИТУ ДО ШІ
// ==========================================

function createProductPrompt(product) {
    const categoryList = categoriesData.categories.map(category => ({
        category: category.name,
        allowed_values: category.subcategories
    }));

    return `
Ти — помічник для класифікації косметичних товарів та засобів догляду за волоссям.

Проаналізуй назву товару та прикріплену фотографію.

Назва товару:
${product.name || "Не вказана"}

Доступні категорії та дозволені значення:
${JSON.stringify(categoryList, null, 2)}

Правила:
1. Визнач одне значення для кожної категорії.
2. Використовуй тільки значення зі списку allowed_values.
3. Не вигадуй нових категорій або значень.
4. Якщо інформації недостатньо, поверни null.
5. Враховуй і назву, і фотографію товару.
6. Не визначай об'єм лише за зовнішнім виглядом упаковки, якщо він не вказаний у назві або нечитабельний на етикетці.
7. Не додавай Markdown, пояснень або тексту поза JSON.

Поверни результат виключно у форматі:
{
  "attributes": {
    "Вид продукції": null,
    "Об'єм упаковки": null,
    "Бренд": null,
    "За призначенням": null,
    "За типом волосся": null
  }
}
`;
}


// ==========================================
// ПЕРЕВІРКА АТРИБУТІВ ВІД МОДЕЛІ
// ==========================================

function validateAttributes(attributes) {
    const validated = {};

    for (const category of categoriesData.categories) {
        const value = attributes?.[category.name];

        validated[category.name] =
            category.subcategories.includes(value)
                ? value
                : null;
    }

    return validated;
}


// ==========================================
// АНАЛІЗ ТОВАРУ ЧЕРЕЗ OLLAMA
// ==========================================

async function analyzeProduct(product) {
    if (!categoriesData) {
        throw new Error("Категорії ще не завантажені");
    }

    const imageUrl = product.imageUrl ||
        (product.photo
            ? `/uploads/${encodeURIComponent(product.photo)}`
            : "");

    const imageBase64 = await imageToBase64(imageUrl);

    const response = await fetch(OLLAMA_URL, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            model: OLLAMA_MODEL,

            messages: [
                {
                    role: "user",
                    content: createProductPrompt(product),
                    images: [imageBase64]
                }
            ],

            stream: false,
            format: "json",

            options: {
                temperature: 0.1,
                num_predict: 800,
                num_ctx: 4096
            }
        })
    });

    const data = await readJSONResponse(response);

    if (data.error) {
        throw new Error(data.error);
    }

    const content = data.message?.content;

    if (!content) {
        throw new Error("Модель не повернула результат");
    }

    let result;

    try {
        result = JSON.parse(content);
    } catch {
        console.error("Відповідь моделі:", content);

        throw new Error("Модель повернула некоректний JSON");
    }

    if (
        !result.attributes ||
        typeof result.attributes !== "object" ||
        Array.isArray(result.attributes)
    ) {
        throw new Error('У відповіді моделі відсутній об’єкт "attributes"');
    }

    return validateAttributes(result.attributes);
}


// ==========================================
// АНАЛІЗ ОКРЕМОГО ТОВАРУ
// ==========================================

async function processSingleProduct(
    product,
    resultContainer,
    analyzeButton
) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Аналіз...";

    resultContainer.textContent = "Gemma аналізує товар...";

    try {
        if (!categoriesData) {
            await loadCategories();
        }

        const attributes = await analyzeProduct(product);

        product.attributes = attributes;

        displayAttributes(
            resultContainer,
            attributes,
            product
        );

    } catch (error) {
        console.error("Помилка аналізу товару:", error);

        resultContainer.textContent =
            `Помилка аналізу: ${error.message}`;

    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Повторити аналіз";
    }
}


// ==========================================
// ВІДОБРАЖЕННЯ ТА РЕДАГУВАННЯ АТРИБУТІВ
// ==========================================

function displayAttributes(container, attributes, product) {
    container.innerHTML = "";

    const heading = document.createElement("h3");

    heading.textContent = "Перевірка атрибутів ШІ";

    container.appendChild(heading);

    const fields = document.createElement("div");

    fields.className = "attribute-fields";

    for (const category of categoriesData.categories) {
        const group = document.createElement("div");

        group.className = "attribute-field";

        const label = document.createElement("label");

        label.textContent = category.name;

        const select = document.createElement("select");

        select.dataset.category = category.name;

        const emptyOption = document.createElement("option");

        emptyOption.value = "";
        emptyOption.textContent = "Не визначено";

        select.appendChild(emptyOption);

        category.subcategories.forEach(value => {
            const option = document.createElement("option");

            option.value = value;
            option.textContent = value;

            select.appendChild(option);
        });

        select.value = attributes[category.name] || "";

        group.append(label, select);

        fields.appendChild(group);
    }

    container.appendChild(fields);

    const confirmButton = document.createElement("button");

    confirmButton.type = "button";
    confirmButton.className = "confirm-product";
    confirmButton.textContent = "Підтвердити товар";

    const status = document.createElement("p");

    status.className = "product-confirm-status";

    confirmButton.addEventListener("click", () => {
        confirmProduct(product, container);
    });

    container.append(confirmButton, status);
}


// ==========================================
// ПІДТВЕРДЖЕННЯ ТА ЗБЕРЕЖЕННЯ ТОВАРУ
// ==========================================

async function confirmProduct(product, container) {
    const selects = container.querySelectorAll("select");

    const confirmButton = container.querySelector(".confirm-product");
    const status = container.querySelector(".product-confirm-status");

    if (!confirmButton || !status) return;

    const attributes = {};

    selects.forEach(select => {
        attributes[select.dataset.category] =
            select.value || null;
    });

    confirmButton.disabled = true;
    confirmButton.textContent = "Збереження...";

    status.textContent = "";

    try {
        const response = await fetch("/api/confirm-product", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: product.name,
                photo: product.photo,
                attributes
            })
        });

        const data = await readJSONResponse(response);

        product.confirmed = true;
        product.attributes = attributes;

        status.textContent =
            data.message || "Товар успішно підтверджено!";

        status.className = "product-confirm-status success";

        confirmButton.textContent = "Підтверджено";

        selects.forEach(select => {
            select.disabled = true;
        });

    } catch (error) {
        console.error("Помилка збереження товару:", error);

        status.textContent = error.message;
        status.className = "product-confirm-status error";

        confirmButton.disabled = false;
        confirmButton.textContent = "Повторити збереження";
    }
}


// ==========================================
// ПЕРЕВІРКА ПІДКЛЮЧЕННЯ OLLAMA
// ==========================================

async function checkOllama() {
    const dot = document.getElementById("apiDot");
    const status = document.getElementById("apiStatus");

    function setStatus(online, message) {
        if (dot) {
            dot.className =
                `status-dot ${online ? "online" : "offline"}`;
        }

        if (status) {
            status.textContent = message;
        }
    }

    try {
        const response = await fetch(OLLAMA_TAGS_URL);

        if (!response.ok) {
            throw new Error("Ollama недоступна");
        }

        const data = await response.json();

        const models = data.models || [];

        const modelExists = models.some(
            model => model.name === OLLAMA_MODEL
        );

        if (modelExists) {
            setStatus(true, `Ollama підключено: ${OLLAMA_MODEL}`);
        } else {
            setStatus(false, `Модель ${OLLAMA_MODEL} не знайдена`);
        }

    } catch (error) {
        console.error("Помилка підключення до Ollama:", error);

        setStatus(false, "Ollama недоступна");
    }
}


// ==========================================
// ЗАПУСК ПРОГРАМИ
// ==========================================

async function initializeApp() {
    try {
        await loadCategories();

    } catch (error) {
        console.error("Помилка завантаження категорій:", error);

        showMessage(error.message, "error");
    }

    await Promise.all([
        loadCSVFiles(),
        checkOllama()
    ]);
}

initializeApp();