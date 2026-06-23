document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = 'http://127.0.0.1:8080';

    const form = document.getElementById('otpForm');
    const codeInput = document.getElementById('otpCode');

    if (!form || !codeInput) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const codeValue = codeInput.value.trim();

        if (!codeValue) {
            return alert("Verification code is required.");
        }

        if (!/^\d{6}$/.test(codeValue)) {
            return alert("The code must be exactly 6 digits.");
        }

        try {
            
            const urlWithParam = `${API_BASE_URL}/auth/validate-otp?code=${encodeURIComponent(codeValue)}`;

            const response = await fetch(urlWithParam, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json' 
                },
                credentials: 'include' 
            });

            if (response.status === 302) {
                window.location.href = "/login.html";
                return;
            }

            let data = {};
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                console.log(await response.text());
            }

            if (response.ok && data.status === "SUCCESS") {
                alert("Code verified successfully!");
                window.location.href = 'index.html'; 

            } else if (data.status === "BLOCKED") {
                alert("Account locked.");
                window.location.href = 'login.html?error=locked';

            } else if (data.status === "EXPIRED") {
                alert("Code expired.");
                window.location.href = 'login.html?expired=true';

            } else if (data.status === "WRONG_CODE") {
                alert(`Incorrect code. Attempts left: ${data.remainingAttempts}`);

            } else {
                alert(data.message || "Invalid verification code.");
            }

        } catch (err) {
            console.error("Fetch error:", err);
            alert("Connection error with the server.");
        }
    });
});

window.app = {};