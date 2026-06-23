(function () {
    const browserMove = window.performance && 
                       window.performance.getEntriesByType("navigation")[0]?.type === "back_forward";
    if (browserMove) {
        window.location.reload(true);
    }
})();

const API = "http://127.0.0.1:8080/api/payments";

function parseAmount(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value).trim());
    return isNaN(parsed) ? 0 : parsed;
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[m]);
}

function parseStringToDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isPastDate(dateStr) {
    const inputDate = parseStringToDate(dateStr);
    if (!inputDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inputDate < today;
}

function isMoreThanOneYearFuture(dateStr) {
    const inputDate = parseStringToDate(dateStr);
    if (!inputDate) return false;

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    maxDate.setHours(0, 0, 0, 0);

    return inputDate > maxDate;
}

let inactivityTimeout;

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);

    inactivityTimeout = setTimeout(() => {
        alert("Your session has expired due to inactivity.");
        window.location.replace("login.html?timeout");
    }, 300000);
}

document.addEventListener("DOMContentLoaded", async () => {
    await checkAdminRole();
    await loadData();
    handleAuthAlerts();

    resetInactivityTimer();

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);

    document.getElementById('btn-save').addEventListener('click', save);

    const blockedLink = document.getElementById('blocked-link');
    if (blockedLink) {
        blockedLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace("blocked-users.html");
        });
    }

    initLogoutHandler();
});

async function checkAdminRole() {
    try {
        const res = await fetch('http://127.0.0.1:8080/api/users/is-admin', {
            credentials: 'include'
        });

        if (res.status === 401 || res.status === 403 || res.redirected) {
            window.location.replace("login.html?expired");
            return;
        }

        if (!res.ok) throw new Error("Error de permisos en servidor");

        const isAdmin = await res.json();
        const blockedLink = document.getElementById('blocked-link');

        if (blockedLink) {
            blockedLink.style.display = isAdmin ? "inline-block" : "none";
        }

    } catch (err) {
        console.error("Sesión inválida detectada en checkAdminRole, redirigiendo...");
        window.location.replace("login.html?expired");
    }
}

function handleAuthAlerts() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('logout')) alert("Logout successful.");

    if (params.toString()) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function loadData() {
    try {
        const res = await fetch(API, {
            credentials: 'include'
        });

        if (res.status === 401 || res.status === 403 || res.redirected) {
            window.location.replace("login.html?expired");
            return;
        }

        if (!res.ok) throw new Error("Error al obtener tabla de pagos");

        const data = await res.json();
        const table = document.getElementById("tableBody");

        table.innerHTML = data.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHTML(p.client)}</td>
                <td>$${parseAmount(p.amount).toFixed(2)}</td>
                <td>${escapeHTML(p.status)}</td>
                <td>${escapeHTML(p.date)}</td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Error en loadData, vaciando interfaz y redirigiendo de forma segura:", err);
        const table = document.getElementById("tableBody");
        if (table) table.innerHTML = ""; 
        window.location.replace("login.html?expired");
    } finally {
        document.getElementById("loading")?.remove();
    }
}

async function save() {
    const client = document.getElementById("client").value.trim();
    const amount = document.getElementById("amount").value.trim();

    const day = document.getElementById("day").value.trim();
    const month = document.getElementById("month").value.trim();
    const year = document.getElementById("year").value.trim();

    if (!client || !amount || !day || !month || !year) {
        return alert("Fill all fields");
    }

    const parsedAmount = parseInt(amount, 10);
    const date = `${day.padStart(2,'0')}-${month.padStart(2,'0')}-${year}`;

    if (isPastDate(date)) return alert("No past dates");
    if (isMoreThanOneYearFuture(date)) return alert("Max 1 year ahead");

    try {
        const response = await fetch(`${API}/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ client, amount: parsedAmount, date })
        });

        if (response.status === 401 || response.status === 403 || response.redirected) {
            window.location.replace("login.html?expired");
            return;
        }

        await loadData();
    } catch (err) {
        console.error("Error al guardar pago:", err);
        window.location.replace("login.html?expired");
    }
}

function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    const newLogoutBtn = logoutBtn.cloneNode(true);
    if (logoutBtn.parentNode) {
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    }

    newLogoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!confirm("Are you sure you want to log out?")) return;

        try {
            await fetch('http://127.0.0.1:8080/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error("Error al invalidar sesión en backend:", err);
        }

        window.location.replace("login.html?logout");
    });
}

window.app = { loadData, save };