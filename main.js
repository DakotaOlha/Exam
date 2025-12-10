process.env.LANG = "uk_UA.UTF-8";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sql = require("mssql");

app.disableHardwareAcceleration();

// Налаштування підключення до бази даних з SQL Server Authentication
const dbConfig = {
    server: "localhost",
    database: "Adresses",
    user: "ElectronUser",
    password: "SecurePass123!",
    port: 1433, // Явно вказуємо порт
    options: {
        enableArithAbort: true,
        trustServerCertificate: true,
        encrypt: false,
        instanceName: "SQLEXPRESS",
        // Додаємо підтримку українських символів
        useUTC: false,
        charset: "UTF-8",
        collation: "Cyrillic_General_CI_AS",
    },
    // Важливо для правильного відображення кирилиці
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
