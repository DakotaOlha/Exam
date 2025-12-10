// Глобальні змінні
let streets = [];
let houses = [];
let apartments = [];
let students = [];
let allHouses = [];
let allApartments = [];

// Ініціалізація при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    loadInitialData();
});

// Налаштування вкладок
function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Оновити кнопки
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    // Оновити контент
    document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
    });
    document.getElementById(tabName).classList.add("active");

    // Завантажити дані для конкретної вкладки
    if (tabName === "students") {
        loadStudents();
    } else if (tabName === "streets") {
        loadStreets();
    } else if (tabName === "houses") {
        loadHousesTab();
    } else if (tabName === "apartments") {
        loadApartmentsTab();
    } else if (tabName === "reports") {
        loadReportsTab();
    }
}

// Завантаження початкових даних
async function loadInitialData() {
    await loadStreets();
    await loadStudents();
}

// Показати повідомлення
function showMessage(elementId, message, isSuccess = true) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${isSuccess ? "success" : "error"} show`;

    setTimeout(() => {
        messageEl.classList.remove("show");
    }, 3000);
}

// ==================== СТУДЕНТИ ====================

async function loadStudents() {
    const filters = {
        streetId: document.getElementById("filter-street")?.value || null,
        searchText: document.getElementById("search-student")?.value || null,
    };

    const result = await window.db.getStudents(filters);

    if (result.success) {
        students = result.data;
        renderStudentsTable();
    } else {
        showMessage("students-message", "Помилка завантаження студентів: " + result.error, false);
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById("students-tbody");

    if (students.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align: center;">Студенти не знайдені</td></tr>';
        return;
    }

    tbody.innerHTML = students
        .map(
            (student) => `
        <tr id="student-row-${student.StudentID}">
            <td>${student.StudentID}</td>
            <td>${student.FullName}</td>
            <td>${new Date(student.DateOfBirth).toLocaleDateString("uk-UA")}</td>
            <td>${student.Gender}</td>
            <td>${student.NameStreet}, ${student.HouseNumber}, кв. ${student.ApartmentNumber}</td>
            <td>${student.Comments || "-"}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteStudent(${
                    student.StudentID
                })">Видалити</button>
            </td>
        </tr>
    `
        )
        .join("");
}

async function filterStudents() {
    const streetId = document.getElementById("filter-street")?.value || null;
    const searchText =
        document.getElementById("search-student")?.value?.trim().toLowerCase() || null;

    // Завантажуємо всіх студентів без фільтрації на сервері
    const result = await window.db.getStudents({ streetId });

    if (result.success) {
        students = result.data;
        renderStudentsTable();

        // Якщо є пошуковий текст, знаходимо та виділяємо найкращий збіг
        if (searchText && students.length > 0) {
            // Шукаємо студента, чиє ім'я найкраще відповідає пошуковому запиту
            let bestMatch = null;
            let bestScore = -1;

            students.forEach((student) => {
                const fullName = student.FullName.toLowerCase();

                // Точний збіг на початку імені має найвищий пріоритет
                if (fullName.startsWith(searchText)) {
                    const score = 1000 - fullName.length; // Коротші імена мають вищий пріоритет
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = student;
                    }
                }
                // Збіг у будь-якому місці імені
                else if (fullName.includes(searchText)) {
                    const score = 500 - fullName.indexOf(searchText);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = student;
                    }
                }
            });

            // Якщо знайдено збіг, виділяємо його
            if (bestMatch) {
                highlightRow(`student-row-${bestMatch.StudentID}`);
            }
        }
    } else {
        showMessage("students-message", "Помилка завантаження студентів: " + result.error, false);
    }
}

function highlightRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.classList.add("highlight");
        row.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
            row.classList.remove("highlight");
        }, 2000);
    }
}

function showAddStudentForm() {
    document.getElementById("add-student-form").style.display = "block";
    loadStreetsForStudent();
}

function hideAddStudentForm() {
    document.getElementById("add-student-form").style.display = "none";
    clearStudentForm();
}

function clearStudentForm() {
    document.getElementById("student-name").value = "";
    document.getElementById("student-dob").value = "";
    document.getElementById("student-gender").value = "";
    document.getElementById("student-street").value = "";
    document.getElementById("student-house").innerHTML =
        '<option value="">Спочатку оберіть вулицю...</option>';
    document.getElementById("student-apartment").innerHTML =
        '<option value="">Спочатку оберіть будинок...</option>';
    document.getElementById("student-comments").value = "";
}

async function loadStreetsForStudent() {
    const result = await window.db.getStreets();
    if (result.success) {
        const select = document.getElementById("student-street");
        select.innerHTML =
            '<option value="">Оберіть вулицю...</option>' +
            result.data
                .map((s) => `<option value="${s.StreetID}">${s.NameStreet}</option>`)
                .join("");
    }
}

async function loadHousesForStudent() {
    const streetId = document.getElementById("student-street").value;
    const houseSelect = document.getElementById("student-house");
    const apartmentSelect = document.getElementById("student-apartment");

    if (!streetId) {
        houseSelect.innerHTML = '<option value="">Спочатку оберіть вулицю...</option>';
        apartmentSelect.innerHTML = '<option value="">Спочатку оберіть будинок...</option>';
        return;
    }

    const result = await window.db.getHouses(streetId);
    if (result.success) {
        houseSelect.innerHTML =
            '<option value="">Оберіть будинок...</option>' +
            result.data
                .map((h) => `<option value="${h.HouseID}">${h.HouseNumber}</option>`)
                .join("");
        apartmentSelect.innerHTML = '<option value="">Спочатку оберіть будинок...</option>';
    }
}

async function loadApartmentsForStudent() {
    const houseId = document.getElementById("student-house").value;
    const apartmentSelect = document.getElementById("student-apartment");

    if (!houseId) {
        apartmentSelect.innerHTML = '<option value="">Спочатку оберіть будинок...</option>';
        return;
    }

    const result = await window.db.getApartments(houseId);
    if (result.success) {
        apartmentSelect.innerHTML =
            '<option value="">Оберіть квартиру...</option>' +
            result.data
                .map((a) => `<option value="${a.ApartmentID}">${a.ApartmentNumber}</option>`)
                .join("");
    }
}

async function addStudent() {
    const student = {
        fullName: document.getElementById("student-name").value,
        dateOfBirth: document.getElementById("student-dob").value,
        gender: document.getElementById("student-gender").value,
        comments: document.getElementById("student-comments").value,
        apartmentId: document.getElementById("student-apartment").value,
    };

    if (!student.fullName || !student.dateOfBirth || !student.gender || !student.apartmentId) {
        showMessage("students-message", "Будь ласка, заповніть всі обов'язкові поля", false);
        return;
    }

    const result = await window.db.addStudent(student);

    if (result.success) {
        showMessage("students-message", "Студента успішно додано!", true);
        hideAddStudentForm();
        await loadStudents();
    } else {
        showMessage("students-message", "Помилка додавання студента: " + result.error, false);
    }
}

async function deleteStudent(studentId) {
    if (!confirm("Ви впевнені, що хочете видалити цього студента?")) {
        return;
    }

    const result = await window.db.deleteStudent(studentId);

    if (result.success) {
        showMessage("students-message", "Студента успішно видалено!", true);
        await loadStudents();
    } else {
        showMessage("students-message", "Помилка видалення студента: " + result.error, false);
    }
}

// ==================== ВУЛИЦІ ====================

async function loadStreets() {
    const result = await window.db.getStreets();

    if (result.success) {
        streets = result.data;
        renderStreetsTable();
        updateStreetSelects();
    } else {
        showMessage("streets-message", "Помилка завантаження вулиць: " + result.error, false);
    }
}

function renderStreetsTable() {
    const tbody = document.getElementById("streets-tbody");

    if (streets.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="2" style="text-align: center;">Вулиці не знайдені</td></tr>';
        return;
    }

    tbody.innerHTML = streets
        .map(
            (street) => `
        <tr>
            <td>${street.StreetID}</td>
            <td>${street.NameStreet}</td>
        </tr>
    `
        )
        .join("");
}

function updateStreetSelects() {
    const selects = [
        "filter-street",
        "house-street",
        "filter-house-street",
        "apartment-street",
        "filter-apartment-street",
        "report-street",
    ];

    selects.forEach((selectId) => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            const options = streets
                .map((s) => `<option value="${s.StreetID}">${s.NameStreet}</option>`)
                .join("");

            if (
                selectId === "filter-street" ||
                selectId === "filter-house-street" ||
                selectId === "filter-apartment-street" ||
                selectId === "report-street"
            ) {
                select.innerHTML = '<option value="">Всі вулиці</option>' + options;
            } else {
                select.innerHTML = '<option value="">Оберіть вулицю...</option>' + options;
            }

            select.value = currentValue;
        }
    });
}

async function addStreet() {
    const name = document.getElementById("new-street-name").value.trim();

    if (!name) {
        showMessage("streets-message", "Введіть назву вулиці", false);
        return;
    }

    const result = await window.db.addStreet(name);

    if (result.success) {
        showMessage("streets-message", "Вулицю успішно додано!", true);
        document.getElementById("new-street-name").value = "";
        await loadStreets();
    } else {
        showMessage("streets-message", "Помилка додавання вулиці: " + result.error, false);
    }
}

// ==================== БУДИНКИ ====================

async function loadHousesTab() {
    await loadStreets();
    await loadAllHouses();
}

async function loadAllHouses() {
    // Завантажуємо всі будинки для всіх вулиць
    allHouses = [];
    for (const street of streets) {
        const result = await window.db.getHouses(street.StreetID);
        if (result.success) {
            allHouses.push(
                ...result.data.map((h) => ({
                    ...h,
                    StreetName: street.NameStreet,
                }))
            );
        }
    }
    renderHousesTable(allHouses);
}

function renderHousesTable(housesToRender) {
    const tbody = document.getElementById("houses-tbody");

    if (housesToRender.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="3" style="text-align: center;">Будинки не знайдені</td></tr>';
        return;
    }

    tbody.innerHTML = housesToRender
        .map(
            (house) => `
        <tr>
            <td>${house.HouseID}</td>
            <td>${house.HouseNumber}</td>
            <td>${house.StreetName}</td>
        </tr>
    `
        )
        .join("");
}

async function filterHouses() {
    const streetId = document.getElementById("filter-house-street").value;

    if (!streetId) {
        renderHousesTable(allHouses);
        return;
    }

    const filtered = allHouses.filter((h) => h.StreetID == streetId);
    renderHousesTable(filtered);
}

async function addHouse() {
    const streetId = document.getElementById("house-street").value;
    const houseNumber = document.getElementById("new-house-number").value.trim();

    if (!streetId || !houseNumber) {
        showMessage("houses-message", "Заповніть всі поля", false);
        return;
    }

    const result = await window.db.addHouse(houseNumber, streetId);

    if (result.success) {
        showMessage("houses-message", "Будинок успішно додано!", true);
        document.getElementById("new-house-number").value = "";
        await loadAllHouses();
    } else {
        showMessage("houses-message", "Помилка додавання будинку: " + result.error, false);
    }
}

// ==================== КВАРТИРИ ====================

async function loadApartmentsTab() {
    await loadStreets();
    await loadAllApartments();
}

async function loadAllApartments() {
    allApartments = [];
    for (const street of streets) {
        const housesResult = await window.db.getHouses(street.StreetID);
        if (housesResult.success) {
            for (const house of housesResult.data) {
                const apartmentsResult = await window.db.getApartments(house.HouseID);
                if (apartmentsResult.success) {
                    allApartments.push(
                        ...apartmentsResult.data.map((a) => ({
                            ...a,
                            HouseNumber: house.HouseNumber,
                            StreetName: street.NameStreet,
                            StreetID: street.StreetID,
                        }))
                    );
                }
            }
        }
    }
    renderApartmentsTable(allApartments);
}

function renderApartmentsTable(apartmentsToRender) {
    const tbody = document.getElementById("apartments-tbody");

    if (apartmentsToRender.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align: center;">Квартири не знайдені</td></tr>';
        return;
    }

    tbody.innerHTML = apartmentsToRender
        .map(
            (apt) => `
        <tr>
            <td>${apt.ApartmentID}</td>
            <td>${apt.ApartmentNumber}</td>
            <td>${apt.HouseNumber}</td>
            <td>${apt.StreetName}</td>
        </tr>
    `
        )
        .join("");
}

async function loadHousesForApartment() {
    const streetId = document.getElementById("apartment-street").value;
    const houseSelect = document.getElementById("apartment-house");

    if (!streetId) {
        houseSelect.innerHTML = '<option value="">Спочатку оберіть вулицю...</option>';
        return;
    }

    const result = await window.db.getHouses(streetId);
    if (result.success) {
        houseSelect.innerHTML =
            '<option value="">Оберіть будинок...</option>' +
            result.data
                .map((h) => `<option value="${h.HouseID}">${h.HouseNumber}</option>`)
                .join("");
    }
}

async function loadHousesForFilter() {
    const streetId = document.getElementById("filter-apartment-street").value;
    const houseSelect = document.getElementById("filter-apartment-house");

    if (!streetId) {
        houseSelect.innerHTML = '<option value="">Всі будинки</option>';
        renderApartmentsTable(allApartments);
        return;
    }

    const result = await window.db.getHouses(streetId);
    if (result.success) {
        houseSelect.innerHTML =
            '<option value="">Всі будинки</option>' +
            result.data
                .map((h) => `<option value="${h.HouseID}">${h.HouseNumber}</option>`)
                .join("");
    }

    filterApartments();
}

function filterApartments() {
    const streetId = document.getElementById("filter-apartment-street").value;
    const houseId = document.getElementById("filter-apartment-house").value;

    let filtered = allApartments;

    if (streetId) {
        filtered = filtered.filter((a) => a.StreetID == streetId);
    }

    if (houseId) {
        filtered = filtered.filter((a) => a.HouseID == houseId);
    }

    renderApartmentsTable(filtered);
}

async function addApartment() {
    const houseId = document.getElementById("apartment-house").value;
    const apartmentNumber = document.getElementById("new-apartment-number").value;

    if (!houseId || !apartmentNumber) {
        showMessage("apartments-message", "Заповніть всі поля", false);
        return;
    }

    const result = await window.db.addApartment(apartmentNumber, houseId);

    if (result.success) {
        showMessage("apartments-message", "Квартиру успішно додано!", true);
        document.getElementById("new-apartment-number").value = "";
        await loadAllApartments();
    } else {
        showMessage("apartments-message", "Помилка додавання квартири: " + result.error, false);
    }
}

// ==================== ЗВІТИ ====================

async function loadReportsTab() {
    await loadStreets();
    await loadStudentsReport();
}

async function countHousesOnStreet() {
    const streetName = document.getElementById("count-street-name").value.trim();

    if (!streetName) {
        document.getElementById("house-count-result").innerHTML =
            '<div class="message error show">Введіть назву вулиці</div>';
        return;
    }

    const result = await window.db.countHouses(streetName);

    if (result.success) {
        document.getElementById("house-count-result").innerHTML = `
            <div class="stat-card">
                <div class="number">${result.count}</div>
                <div class="label">будинків на вулиці "${streetName}"</div>
            </div>
        `;
    } else {
        document.getElementById(
            "house-count-result"
        ).innerHTML = `<div class="message error show">Помилка: ${result.error}</div>`;
    }
}

async function loadStudentsReport() {
    const streetName = document.getElementById("report-street").value
        ? streets.find((s) => s.StreetID == document.getElementById("report-street").value)
              ?.NameStreet
        : null;

    const result = await window.db.getStudentsReport(streetName);

    if (result.success) {
        renderReportTable(result.data);
    }
}

function renderReportTable(data) {
    const tbody = document.getElementById("report-tbody");

    if (data.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="5" style="text-align: center;">Дані не знайдені</td></tr>';
        return;
    }

    tbody.innerHTML = data
        .map(
            (row) => `
        <tr>
            <td>${row.NameStreet}</td>
            <td>${row.HouseNumber}</td>
            <td>${row.ApartmentNumber}</td>
            <td>${row.FullName}</td>
            <td>${new Date(row.DateOfBirth).toLocaleDateString("uk-UA")}</td>
        </tr>
    `
        )
        .join("");
}
