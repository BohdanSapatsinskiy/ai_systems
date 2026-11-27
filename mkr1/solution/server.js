
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const DATA = path.join(ROOT, "data");
const DATABASE = path.join(DATA, "bd.json");
const CATEGORIES = path.join(DATA, "categories.json");
const IMAGES = path.join(ROOT, "images");
const PORT = 3000;

// Підготовка папок і бази даних
function initializeFolders() {
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.mkdirSync(DATA, { recursive: true });
    fs.mkdirSync(IMAGES, { recursive: true });

    if (!fs.existsSync(DATABASE)) {
        fs.writeFileSync(
            DATABASE,
            JSON.stringify({ products: [] }, null, 4),
            "utf8"
        );
    }
}

initializeFolders();

// Відправлення JSON-відповіді
function sendJSON(res, status, data) {
    if (res.headersSent || res.destroyed) return;

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8"
    });

    res.end(JSON.stringify(data));
}

// Читання та перевірка JSON із POST-запиту
function readJSONBody(req, maxSize = 20000) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;

        req.on("data", chunk => {
            size += chunk.length;

            if (size > maxSize) {
                tooLarge = true;
                return;
            }

            if (!tooLarge) {
                chunks.push(chunk);
            }
        });

        req.on("end", () => {
            if (tooLarge) {
                const error = new Error("Занадто великий запит");
                error.status = 413;
                return reject(error);
            }

            const body = Buffer.concat(chunks).toString("utf8");

            if (!body.trim()) {
                const error = new Error("Отримано порожній запит");
                error.status = 400;
                return reject(error);
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                const error = new Error("Некоректний формат JSON");
                error.status = 400;
                reject(error);
            }
        });

        req.on("aborted", () => {
            const error = new Error("Запит було перервано");
            error.status = 400;
            reject(error);
        });

        req.on("error", error => {
            reject(error);
        });
    });
}

// CSV-парсер із підтримкою лапок, ком і переносів рядків
function parseCSV(content) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            field += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && next === "\n") i++;

            row.push(field);

            if (row.some(value => value.trim() !== "")) {
                rows.push(row);
            }

            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (insideQuotes) {
        throw new Error("CSV містить незакриті лапки");
    }

    row.push(field);

    if (row.some(value => value.trim() !== "")) {
        rows.push(row);
    }

    return rows;
}

// Отримання списку CSV-файлів
function getCSVFiles(res) {
    fs.readdir(UPLOADS, (error, files) => {
        if (error) {
            return sendJSON(res, 500, {
                error: "Не вдалося прочитати папку uploads"
            });
        }

        const csvFiles = files.filter(file =>
            path.extname(file).toLowerCase() === ".csv"
        );

        sendJSON(res, 200, csvFiles);
    });
}

// Імпорт товарів із CSV
async function importCSV(req, res) {
    try {
        const data = await readJSONBody(req, 10000);
        const file = data.file || data.filename;

        if (
            typeof file !== "string" ||
            path.basename(file) !== file ||
            path.extname(file).toLowerCase() !== ".csv"
        ) {
            return sendJSON(res, 400, {
                error: "Некоректна назва CSV-файлу"
            });
        }

        const filePath = path.join(UPLOADS, file);

        if (
            !fs.existsSync(filePath) ||
            !fs.statSync(filePath).isFile()
        ) {
            return sendJSON(res, 404, {
                error: "CSV-файл не знайдено"
            });
        }

        const csvContent = fs.readFileSync(filePath, "utf8")
            .replace(/^\uFEFF/, "");

        const rows = parseCSV(csvContent);

        if (rows.length < 2) {
            return sendJSON(res, 400, {
                error: "CSV-файл не містить товарів"
            });
        }

        const headers = rows[0].map(value =>
            value.trim().toLowerCase()
        );

        const nameIndex = headers.indexOf("name");
        const photoIndex = headers.indexOf("photo");

        if (nameIndex === -1 || photoIndex === -1) {
            return sendJSON(res, 400, {
                error: "CSV повинен містити поля name та photo"
            });
        }

        const products = [];
        let skipped = 0;

        for (const row of rows.slice(1)) {
            const name = (row[nameIndex] || "").trim();
            const photo = (row[photoIndex] || "").trim();

            if (!name || !photo) {
                skipped++;
                continue;
            }

            if (
                path.basename(photo) !== photo ||
                !/\.(jpg|jpeg|png|webp)$/i.test(photo)
            ) {
                skipped++;
                continue;
            }

            const photoPath = path.join(UPLOADS, photo);

            if (
                !fs.existsSync(photoPath) ||
                !fs.statSync(photoPath).isFile()
            ) {
                skipped++;
                continue;
            }

            products.push({
                name,
                photo,
                imageUrl: `/uploads/${encodeURIComponent(photo)}`
            });
        }

        sendJSON(res, 200, {
            success: true,
            products,
            added: products.length,
            skipped,
            total: rows.length - 1
        });

    } catch (error) {
        console.error("Помилка імпорту CSV:", error);

        sendJSON(res, error.status || 500, {
            error: error.message || "Не вдалося обробити CSV-файл"
        });
    }
}

// MIME-типи файлів
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
};

// Збереження підтвердженого товару
async function confirmProduct(req, res) {
    let copiedPhotoPath = null;
    let tempDatabasePath = null;

    try {
        const data = await readJSONBody(req, 20000);

        const name = data.name;
        const photo = data.photo;
        const attributes = data.attributes;

        // Перевірка назви та фотографії
        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof photo !== "string" ||
            path.basename(photo) !== photo ||
            !/\.(jpg|jpeg|png|webp)$/i.test(photo)
        ) {
            return sendJSON(res, 400, {
                error: "Некоректні дані товару"
            });
        }

        // Перевірка атрибутів
        if (
            !attributes ||
            typeof attributes !== "object" ||
            Array.isArray(attributes)
        ) {
            return sendJSON(res, 400, {
                error: "Некоректні атрибути товару"
            });
        }

        // Перевірка наявності categories.json
        if (!fs.existsSync(CATEGORIES)) {
            return sendJSON(res, 500, {
                error: "Файл data/categories.json не знайдено"
            });
        }

        const categoriesData = JSON.parse(
            fs.readFileSync(CATEGORIES, "utf8")
        );

        if (!Array.isArray(categoriesData.categories)) {
            return sendJSON(res, 500, {
                error: "Некоректна структура categories.json"
            });
        }

        // Перевірка значень атрибутів
        const validatedAttributes = {};

        for (const category of categoriesData.categories) {
            const value = Object.prototype.hasOwnProperty.call(
                attributes,
                category.name
            )
                ? attributes[category.name]
                : null;

            if (
                value !== null &&
                (
                    typeof value !== "string" ||
                    !category.subcategories.includes(value)
                )
            ) {
                return sendJSON(res, 400, {
                    error: `Недозволене значення атрибута: ${category.name}`
                });
            }

            validatedAttributes[category.name] = value;
        }

        // Перевірка фотографії в uploads
        const sourcePhoto = path.join(UPLOADS, photo);

        if (
            !fs.existsSync(sourcePhoto) ||
            !fs.statSync(sourcePhoto).isFile()
        ) {
            return sendJSON(res, 404, {
                error: "Фотографію не знайдено в uploads"
            });
        }

        // Читання бази даних
        if (!fs.existsSync(DATABASE)) {
            fs.writeFileSync(
                DATABASE,
                JSON.stringify({ products: [] }, null, 4),
                "utf8"
            );
        }

        const database = JSON.parse(
            fs.readFileSync(DATABASE, "utf8")
        );

        if (!Array.isArray(database.products)) {
            database.products = [];
        }

        // Перевірка дубліката
        const duplicate = database.products.some(product =>
            product.name === name.trim() &&
            product.sourcePhoto === photo
        );

        if (duplicate) {
            return sendJSON(res, 409, {
                error: "Цей товар уже додано до бази"
            });
        }

        // Створення унікальної назви фотографії
        const extension = path.extname(photo);
        const baseName = path.basename(photo, extension);

        let imageName = photo;
        let counter = 1;

        while (fs.existsSync(path.join(IMAGES, imageName))) {
            imageName = `${baseName}_${counter}${extension}`;
            counter++;
        }

        copiedPhotoPath = path.join(IMAGES, imageName);

        // Копіювання фотографії
        fs.copyFileSync(sourcePhoto, copiedPhotoPath);

        // Створення ID
        const nextId = database.products.reduce(
            (max, product) =>
                Math.max(max, Number(product.id) || 0),
            0
        ) + 1;

        // Додавання товару
        database.products.push({
            id: nextId,
            name: name.trim(),
            photo: imageName,
            sourcePhoto: photo,
            attributes: validatedAttributes
        });

        // Безпечний запис бази через тимчасовий файл
        tempDatabasePath = DATABASE + ".tmp";

        fs.writeFileSync(
            tempDatabasePath,
            JSON.stringify(database, null, 4),
            "utf8"
        );

        fs.renameSync(tempDatabasePath, DATABASE);
        tempDatabasePath = null;

        copiedPhotoPath = null;

        sendJSON(res, 200, {
            success: true,
            message: "Товар успішно збережено",
            id: nextId,
            total: database.products.length
        });

    } catch (error) {
        // Видалення тимчасових файлів у разі помилки
        try {
            if (
                copiedPhotoPath &&
                fs.existsSync(copiedPhotoPath)
            ) {
                fs.unlinkSync(copiedPhotoPath);
            }

            if (
                tempDatabasePath &&
                fs.existsSync(tempDatabasePath)
            ) {
                fs.unlinkSync(tempDatabasePath);
            }
        } catch (cleanupError) {
            console.error("Помилка очищення:", cleanupError);
        }

        console.error("Помилка збереження товару:", error);

        sendJSON(res, error.status || 500, {
            error: error.message || "Помилка під час збереження товару"
        });
    }
}

// HTTP-сервер
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Список CSV-файлів
    if (
        req.method === "GET" &&
        url.pathname === "/api/csv-files"
    ) {
        return getCSVFiles(res);
    }

    // Імпорт CSV
    if (
        req.method === "POST" &&
        url.pathname === "/api/import"
    ) {
        return importCSV(req, res);
    }

    // Збереження товару
    if (
        req.method === "POST" &&
        url.pathname === "/api/confirm-product"
    ) {
        return confirmProduct(req, res);
    }

    // Статичні файли
    let requestedPath;

    try {
        requestedPath = decodeURIComponent(url.pathname);
    } catch {
        return sendJSON(res, 400, {
            error: "Некоректна адреса файлу"
        });
    }

    if (requestedPath === "/") {
        requestedPath = "/index.html";
    }

    const filePath = path.resolve(ROOT, "." + requestedPath);

    if (
        filePath !== ROOT &&
        !filePath.startsWith(ROOT + path.sep)
    ) {
        return sendJSON(res, 403, {
            error: "Доступ заборонено"
        });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJSON(res, 405, {
            error: "Метод не підтримується"
        });
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            return sendJSON(res, 404, {
                error: "Файл не знайдено"
            });
        }

        const ext = path.extname(filePath).toLowerCase();

        res.writeHead(200, {
            "Content-Type":
                mimeTypes[ext] || "application/octet-stream"
        });

        if (req.method === "HEAD") {
            return res.end();
        }

        res.end(content);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("Product AI успішно запущено!");
    console.log(`Адреса: http://localhost:${PORT}`);
    console.log("--------------------------------");
});
