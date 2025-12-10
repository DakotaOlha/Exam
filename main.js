process.env.LANG = "uk_UA.UTF-8";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sql = require("mssql");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const os = require("os");
const ExcelJS = require("exceljs");

app.disableHardwareAcceleration();

// Налаштування підключення до бази даних з SQL Server Authentication
const dbConfig = {
    server: "localhost",
    database: "Adresses",
    user: "ElectronUser",
    password: "SecurePass123!",
    port: 1433,
    options: {
        enableArithAbort: true,
        trustServerCertificate: true,
        encrypt: false,
        instanceName: "SQLEXPRESS",
        useUTC: false,
        charset: "UTF-8",
        collation: "Cyrillic_General_CI_AS",
    },
    requestTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    mainWindow.loadFile("index.html");

    if (process.argv.includes("--dev")) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers для роботи з БД

// Отримати всі вулиці
ipcMain.handle("get-streets", async () => {
    try {
        console.log("Спроба підключення до БД з конфігурацією:", {
            server: dbConfig.server,
            database: dbConfig.database,
            user: dbConfig.user,
        });
        const pool = await sql.connect(dbConfig);
        console.log("Підключення успішне!");
        const result = await pool.request().query("SELECT * FROM Streets ORDER BY NameStreet");
        await pool.close();
        return { success: true, data: result.recordset };
    } catch (err) {
        console.error("Помилка підключення:", err);
        return { success: false, error: err.message };
    }
});

// Отримати будинки на вулиці
ipcMain.handle("get-houses", async (event, streetId) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input("streetId", sql.Int, streetId)
            .query("SELECT * FROM Houses WHERE StreetID = @streetId ORDER BY HouseNumber");
        await pool.close();
        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Отримати квартири в будинку
ipcMain.handle("get-apartments", async (event, houseId) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input("houseId", sql.Int, houseId)
            .query("SELECT * FROM Apartments WHERE HouseID = @houseId ORDER BY ApartmentNumber");
        await pool.close();
        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Отримати студентів
ipcMain.handle("get-students", async (event, filters) => {
    try {
        const pool = await sql.connect(dbConfig);
        let query = `
      SELECT 
        st.StudentID,
        st.FullName,
        st.DateOfBirth,
        st.Gender,
        st.Comments,
        s.NameStreet,
        h.HouseNumber,
        a.ApartmentNumber,
        a.ApartmentID
      FROM Students st
      JOIN Apartments a ON st.ApartmentID = a.ApartmentID
      JOIN Houses h ON a.HouseID = h.HouseID
      JOIN Streets s ON h.StreetID = s.StreetID
    `;

        const conditions = [];
        const request = pool.request();

        if (filters.streetId) {
            conditions.push("s.StreetID = @streetId");
            request.input("streetId", sql.Int, filters.streetId);
        }

        if (filters.searchText) {
            conditions.push("st.FullName LIKE @searchText");
            request.input("searchText", sql.NVarChar, `%${filters.searchText}%`);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY st.FullName";

        const result = await request.query(query);
        await pool.close();
        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Додати вулицю
ipcMain.handle("add-street", async (event, name) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool
            .request()
            .input("name", sql.NVarChar, name)
            .query("INSERT INTO Streets (NameStreet) VALUES (@name)");
        await pool.close();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Додати будинок
ipcMain.handle("add-house", async (event, houseNumber, streetId) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool
            .request()
            .input("houseNumber", sql.NVarChar, houseNumber)
            .input("streetId", sql.Int, streetId)
            .query("INSERT INTO Houses (HouseNumber, StreetID) VALUES (@houseNumber, @streetId)");
        await pool.close();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Додати квартиру
ipcMain.handle("add-apartment", async (event, apartmentNumber, houseId) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool
            .request()
            .input("apartmentNumber", sql.Int, apartmentNumber)
            .input("houseId", sql.Int, houseId)
            .query(
                "INSERT INTO Apartments (ApartmentNumber, HouseID) VALUES (@apartmentNumber, @houseId)"
            );
        await pool.close();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Додати студента
ipcMain.handle("add-student", async (event, student) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool
            .request()
            .input("fullName", sql.NVarChar, student.fullName)
            .input("dateOfBirth", sql.Date, student.dateOfBirth)
            .input("gender", sql.NVarChar, student.gender)
            .input("comments", sql.NVarChar, student.comments || null)
            .input("apartmentId", sql.Int, student.apartmentId)
            .query(`INSERT INTO Students (FullName, DateOfBirth, Gender, Comments, ApartmentID) 
              VALUES (@fullName, @dateOfBirth, @gender, @comments, @apartmentId)`);
        await pool.close();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Видалити студента
ipcMain.handle("delete-student", async (event, studentId) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input("studentId", sql.Int, studentId).execute("sp_DeleteStudent");
        await pool.close();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Підрахувати будинки на вулиці
ipcMain.handle("count-houses", async (event, streetName) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input("streetName", sql.NVarChar, `%${streetName}%`)
            .execute("sp_CountHousesOnStreet");
        await pool.close();
        return { success: true, count: result.recordset[0].HouseCount };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Звіт студентів за вулицею
ipcMain.handle("get-students-report", async (event, streetName) => {
    try {
        const pool = await sql.connect(dbConfig);
        let query = "SELECT * FROM vw_StudentsByStreet";
        const request = pool.request();

        if (streetName) {
            query += " WHERE NameStreet LIKE @streetName";
            request.input("streetName", sql.NVarChar, `%${streetName}%`);
        }

        query += " ORDER BY NameStreet, HouseNumber, ApartmentNumber";

        const result = await request.query(query);
        await pool.close();
        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Генерація PDF звіту
ipcMain.handle("generate-pdf-report", async () => {
    try {
        const pool = await sql.connect(dbConfig);

        // Отримуємо всі дані студентів згруповані за вулицями
        const result = await pool.request().query(`
            SELECT 
                s.NameStreet,
                h.HouseNumber,
                a.ApartmentNumber,
                st.FullName,
                st.DateOfBirth,
                st.Gender,
                st.Comments
            FROM Students st
            JOIN Apartments a ON st.ApartmentID = a.ApartmentID
            JOIN Houses h ON a.HouseID = h.HouseID
            JOIN Streets s ON h.StreetID = s.StreetID
            ORDER BY s.NameStreet, h.HouseNumber, a.ApartmentNumber
        `);

        await pool.close();

        const students = result.recordset;

        // Групуємо студентів за вулицями
        const streetGroups = {};
        students.forEach((student) => {
            if (!streetGroups[student.NameStreet]) {
                streetGroups[student.NameStreet] = [];
            }
            streetGroups[student.NameStreet].push(student);
        });

        // Створюємо PDF
        const doc = new PDFDocument({
            size: "A4",
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        // Шлях до файлу
        const desktopPath = path.join(os.homedir(), "Desktop");
        const fileName = `Zvit_Studenty_${new Date().toISOString().split("T")[0]}.pdf`;
        const filePath = path.join(desktopPath, fileName);

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Реєструємо шрифт для підтримки кирилиці
        const fontPath = path.join(__dirname, "fonts", "DejaVuSans.ttf");
        const fontBoldPath = path.join(__dirname, "fonts", "DejaVuSans-Bold.ttf");

        // Перевіряємо чи є шрифти, якщо ні - використовуємо стандартні
        let hasCustomFont = false;
        try {
            if (fs.existsSync(fontPath)) {
                doc.registerFont("DejaVuSans", fontPath);
                if (fs.existsSync(fontBoldPath)) {
                    doc.registerFont("DejaVuSans-Bold", fontBoldPath);
                }
                hasCustomFont = true;
            }
        } catch (e) {
            console.log("Використовуємо стандартні шрифти");
        }

        // Заголовок документа
        doc.fontSize(20)
            .font(hasCustomFont ? "DejaVuSans-Bold" : "Helvetica-Bold")
            .text("Звіт про студентів за адресами", { align: "center" });

        doc.fontSize(12)
            .font(hasCustomFont ? "DejaVuSans" : "Helvetica")
            .text(`Дата створення: ${new Date().toLocaleDateString("uk-UA")}`, { align: "center" });

        doc.moveDown(2);

        // Виводимо студентів по вулицях
        Object.keys(streetGroups)
            .sort()
            .forEach((streetName, index) => {
                const studentsOnStreet = streetGroups[streetName];

                // Перевіряємо чи потрібна нова сторінка
                if (doc.y > 650) {
                    doc.addPage();
                }

                // Назва вулиці
                doc.fontSize(16)
                    .font(hasCustomFont ? "DejaVuSans-Bold" : "Helvetica-Bold")
                    .fillColor("#667eea")
                    .text(streetName, { underline: true });

                doc.moveDown(0.5);
                doc.fontSize(10)
                    .font(hasCustomFont ? "DejaVuSans" : "Helvetica")
                    .fillColor("#000000")
                    .text(`Кількість студентів: ${studentsOnStreet.length}`);

                doc.moveDown(0.5);

                // Таблиця студентів
                studentsOnStreet.forEach((student, idx) => {
                    if (doc.y > 700) {
                        doc.addPage();
                    }

                    const address = `${student.HouseNumber}, кв. ${student.ApartmentNumber}`;
                    const dob = new Date(student.DateOfBirth).toLocaleDateString("uk-UA");

                    doc.fontSize(9)
                        .font(hasCustomFont ? "DejaVuSans-Bold" : "Helvetica-Bold")
                        .text(`${idx + 1}. ${student.FullName}`, { continued: false });

                    doc.fontSize(8)
                        .font(hasCustomFont ? "DejaVuSans" : "Helvetica")
                        .fillColor("#666666")
                        .text(`   Адреса: ${address}`, { continued: true })
                        .text(` | Дата народження: ${dob}`, { continued: true })
                        .text(` | Стать: ${student.Gender}`);

                    if (student.Comments) {
                        doc.text(`   Коментар: ${student.Comments}`);
                    }

                    doc.fillColor("#000000");
                    doc.moveDown(0.3);
                });

                doc.moveDown(1);

                // Лінія-розділювач між вулицями
                if (index < Object.keys(streetGroups).length - 1) {
                    doc.strokeColor("#cccccc")
                        .lineWidth(1)
                        .moveTo(50, doc.y)
                        .lineTo(545, doc.y)
                        .stroke();
                    doc.moveDown(1);
                }
            });

        // Додаємо нову сторінку для статистики
        doc.addPage();

        // Статистика
        doc.fontSize(18)
            .font(hasCustomFont ? "DejaVuSans-Bold" : "Helvetica-Bold")
            .fillColor("#667eea")
            .text("Статистика", { align: "center" });

        doc.moveDown(2);

        // Загальна кількість
        doc.fontSize(14)
            .fillColor("#000000")
            .text(`Загальна кількість студентів: ${students.length}`);

        doc.moveDown(1);

        // Таблиця по вулицях
        doc.fontSize(12)
            .font(hasCustomFont ? "DejaVuSans-Bold" : "Helvetica-Bold")
            .text("Розподіл студентів за вулицями:");

        doc.moveDown(0.5);

        const sortedStreets = Object.keys(streetGroups).sort();
        sortedStreets.forEach((streetName, idx) => {
            const count = streetGroups[streetName].length;
            const percentage = ((count / students.length) * 100).toFixed(1);

            doc.fontSize(10)
                .font(hasCustomFont ? "DejaVuSans" : "Helvetica")
                .text(`${idx + 1}. ${streetName}: ${count} студентів (${percentage}%)`);

            doc.moveDown(0.3);
        });

        // Завершуємо документ
        doc.end();

        // Чекаємо завершення запису
        await new Promise((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", reject);
        });

        return {
            success: true,
            filePath: filePath,
            fileName: fileName,
        };
    } catch (err) {
        console.error("Помилка генерації PDF:", err);
        return { success: false, error: err.message };
    }
});
