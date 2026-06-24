document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = 'http://127.0.0.1:8080';

    const form = document.getElementById('otpForm');
    const codeInput = document.getElementById('otpCode');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;

    const resendLink = document.getElementById('resendCodeLink');
    const timerText = document.getElementById('otpTimerText');
    const expiryTimerDisplay = document.getElementById('otpExpiryTimer');

    if (!form || !codeInput) return;

    let isMfaFormLocked = false;
    let otpCountdownInterval = null; 

    startOtpExpiryTimer(120); 

    const mfaExpiry = localStorage.getItem('mfa_lockout_expiry');
    if (mfaExpiry && Date.now() < parseInt(mfaExpiry, 10)) {
        const remainingSeconds = Math.floor((parseInt(mfaExpiry, 10) - Date.now()) / 1000);
        disableMfaForm(remainingSeconds);
    } else {
        localStorage.removeItem('mfa_lockout_expiry');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isMfaFormLocked) {
            alert('Action denied. Your account is currently locked due to security policy.');
            return;
        }

        const codeValue = codeInput.value.trim();
        if (!codeValue || !/^\d{6}$/.test(codeValue)) {
            return alert("The code must be exactly 6 digits.");
        }

        try {
            const urlWithParam = `${API_BASE_URL}/auth/validate-otp?code=${encodeURIComponent(codeValue)}`;
            const response = await fetch(urlWithParam, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include' 
            });

            if (response.status === 302) {
                window.location.href = "/login.html";
                return;
            }

            if (response.status === 423) {
                const data = await response.json();
                handleLockoutAction(data.lockDurationSeconds || 900);
                return;
            }

            let data = {};
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            }

            if (response.ok && data.status === "SUCCESS") {
                alert("Code verified successfully!");
                localStorage.removeItem('mfa_lockout_expiry');
                window.location.href = 'index.html'; 

            } else if (data.status === "BLOCKED") {
                handleLockoutAction(data.lockDurationSeconds || 900);

            } else if (data.status === "EXPIRED") {
                alert("The verification code has expired. Use the 'Resend Code' link.");

            } else if (data.status === "WRONG_CODE") {
                alert(`Incorrect code. Attempts left: ${data.remainingAttempts}`);
                codeInput.value = '';
                codeInput.focus();
            } else {
                alert(data.message || "Invalid verification code.");
            }

        } catch (err) {
            console.error("Fetch error:", err);
            alert("Connection error with the server.");
        }
    });

    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();

            if (isMfaFormLocked) {
                alert("You cannot request a new code because you are currently locked out.");
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/mfa/resend`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    alert("A fresh verification code has been dispatched to your email.");
                    startOtpExpiryTimer(120); 
                } else if (response.status === 423) {
                    alert("Action denied. You cannot resend codes because you are currently castigated.");
                    window.location.reload();
                } else {
                    let errorData = {};
                    try { errorData = await response.json(); } catch(e) {}
                    alert(errorData.message || "Could not resend code.");
                }
            } catch (err) {
                console.error("Resend error:", err);
                alert("Unable to communicate with the authorization server.");
            }
        });
    }

    function startOtpExpiryTimer(durationSeconds) {
        if (otpCountdownInterval) clearInterval(otpCountdownInterval);
        let remaining = durationSeconds;

        const render = (rem) => {
            const mins = Math.floor(rem / 60);
            const secs = rem % 60;
            if (expiryTimerDisplay) {
                expiryTimerDisplay.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
        };
        render(remaining);

        otpCountdownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(otpCountdownInterval);
                if (expiryTimerDisplay) expiryTimerDisplay.textContent = "00:00";
            } else {
                render(remaining);
            }
        }, 1000);
    }

    function handleLockoutAction(seconds) {
        alert("Your verification has been locked due to consecutive failed OTP attempts. You cannot request more codes right now.");
        localStorage.setItem('mfa_lockout_expiry', Date.now() + (seconds * 1000));
        disableMfaForm(seconds);
    }

    function disableMfaForm(seconds) {
        isMfaFormLocked = true;

        if (codeInput) codeInput.disabled = true;
        
        if (resendLink) {
            resendLink.style.color = '#475569';
            resendLink.style.pointerEvents = 'none';
            resendLink.style.textDecoration = 'none';
        }

        if (!submitButton) return;
        submitButton.disabled = true;
        submitButton.style.backgroundColor = '#475569'; 

        let remaining = seconds;
        const countdown = setInterval(() => {
            remaining--;
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            submitButton.innerHTML = `Try again in ${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (remaining <= 0) {
                clearInterval(countdown);
                isMfaFormLocked = false;
                localStorage.removeItem('mfa_lockout_expiry');
                
                if (codeInput) codeInput.disabled = false;
                if (resendLink) {
                    resendLink.style.color = '';
                    resendLink.style.pointerEvents = 'auto';
                    resendLink.style.textDecoration = '';
                }
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '';
                submitButton.innerHTML = 'Verify Code';
                startOtpExpiryTimer(120);
            }
        }, 1000);
    }
});
window.app = {};