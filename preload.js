const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("db", {
    getStreets: () => ipcRenderer.invoke("get-streets"),
    getHouses: (streetId) => ipcRenderer.invoke("get-houses", streetId),
    getApartments: (houseId) => ipcRenderer.invoke("get-apartments", houseId),
    getStudents: (filters) => ipcRenderer.invoke("get-students", filters),
    addStreet: (name) => ipcRenderer.invoke("add-street", name),
    addHouse: (houseNumber, streetId) => ipcRenderer.invoke("add-house", houseNumber, streetId),
    addApartment: (apartmentNumber, houseId) =>
        ipcRenderer.invoke("add-apartment", apartmentNumber, houseId),
    addStudent: (student) => ipcRenderer.invoke("add-student", student),
    deleteStudent: (studentId) => ipcRenderer.invoke("delete-student", studentId),
    countHouses: (streetName) => ipcRenderer.invoke("count-houses", streetName),
    getStudentsReport: (streetName) => ipcRenderer.invoke("get-students-report", streetName),
    generatePdfReport: () => ipcRenderer.invoke("generate-pdf-report"),
});
