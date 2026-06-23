const setupEye = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);

    if (!btn || !input) return;

    btn.addEventListener('click', function() {
        input.type = input.type === 'password' ? 'text' : 'password';
    });
};

document.addEventListener("DOMContentLoaded", function () {

    setupEye('togglePassword1', 'password');
    setupEye('togglePassword2', 'cpassword');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const hiddenInput = document.getElementById('reset-token');
    if (hiddenInput && token) {
        hiddenInput.value = token;
    }

    setupIdentityValidation();
    setupPasswordReset();

    if (urlParams.get("error") === "1") {
        alert("Invalid data. Please check your information.");
    }
});

function setupIdentityValidation() {
    const forgotForm = document.getElementById("forgotPasswordForm");
    if (!forgotForm) return;

    forgotForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const emailEl = document.getElementById("email");
        const mobileEl = document.getElementById("mobileNum");

        if (!emailEl || !mobileEl) {
            return alert("Error: Form elements could not be found in the DOM.");
        }

        const email = emailEl.value.trim();
        const mobileNum = mobileEl.value.trim();

        if (!email) {
            return alert("Email address is required.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return alert("Please enter a valid email address.");
        }
        if (!mobileNum) {
            return alert("Phone number is required.");
        }
        if (mobileNum.length !== 10 || !/^\d+$/.test(mobileNum)) {
            return alert("The phone number must contain exactly 10 numeric digits.");
        }

        const params = new URLSearchParams({ email, mobileNum });

        try {
            const response = await fetch("/forgotPassword", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && (data.success || data.redirectUrl)) {

                alert(data.message || "Identity verified successfully!");

                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                }
            } else {
                alert(data.message || "Data does not match our records.");
            }

        } catch (error) {
            console.error(error);
            alert("Connection error with the server.");
        }
    });
}

function setupPasswordReset() {
    const resetForm = document.getElementById('resetPasswordForm');
    if (!resetForm) return;

    resetForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const pass1 = document.getElementById('password');
        const pass2 = document.getElementById('cpassword');

        const tokenInput = document.getElementById('reset-token');

        if (!pass1 || !pass2 || !tokenInput) return;

        const v1 = pass1.value.trim();
        const v2 = pass2.value.trim();
        const tokenValue = tokenInput.value.trim();

        if (!tokenValue) {
            return alert('Error: Security token is missing or invalid.');
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,12}$/;

        if (!v1) return alert('Password is required.');

        if (!passwordRegex.test(v1)) {
            return alert(
                'The password does not meet the requirements:\n\n' +
                '• Between 8 and 12 characters\n' +
                '• One uppercase and one lowercase letter\n' +
                '• One number\n' +
                '• One special character (e.g., @$!%*?&_#.-)'
            );
        }

        if (v1 !== v2) return alert('Passwords do not match.');

        try {

            const params = new URLSearchParams({
                password: v1,
                cpassword: v2,
                token: tokenValue
            });

            const response = await fetch('/changePassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && (data.success || data.redirectUrl)) {
                alert(data.message || "Password changed successfully!");
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                }
            } else {
                alert(data.message || 'Error changing password.');
            }

        } catch (error) {
            console.error(error);
            alert('Connection error with the server.');
        }
    });
}


window.app = { setupIdentityValidation, setupPasswordReset };