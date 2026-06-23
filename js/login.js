document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = 'http://127.0.0.1:8080';

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const submitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

    let isAccountFormLocked = false;
    const urlParams = new URLSearchParams(window.location.search);

    const lockoutExpiry = localStorage.getItem('lockout_expiry');
    if (lockoutExpiry && Date.now() < parseInt(lockoutExpiry, 10)) {
        isAccountFormLocked = true;
        const remainingSeconds = Math.floor((parseInt(lockoutExpiry, 10) - Date.now()) / 1000);
        disableFormPermanently(remainingSeconds);
    } else {
        localStorage.removeItem('lockout_expiry');
    }

    if (urlParams.has('expired') || urlParams.has('timeout')) {
        alert("Your session has expired.");
    }

    if (urlParams.has('logout')) {
        alert("You have successfully logged out.");
    }

    if (urlParams.has('error') && window.location.search.includes('locked')) {
        isAccountFormLocked = true;
        alert('Your account has been locked due to multiple failed login attempts.');
        const urlTime = parseInt(urlParams.get('time'), 10) || 60;
        localStorage.setItem('lockout_expiry', Date.now() + (urlTime * 1000));
        disableFormPermanently(urlTime); 
    } else if (urlParams.has('error')) {
        alert('Incorrect email or password.');
    }

    if (urlParams.toString()) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (isAccountFormLocked) {
                alert('This login form is locked. Please wait for the timer or contact support.');
                return;
            }

            const emailValue = emailInput ? emailInput.value.trim() : '';
            const passwordValue = passwordInput ? passwordInput.value.trim() : '';

            if (!emailValue) return alert('The email address is required.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return alert('Please enter a valid email address.');
            if (!passwordValue) return alert('Password is required.');
            if (passwordValue.length < 8 || passwordValue.length > 12) return alert('Password must be between 8 and 12 characters.');

            setLoadingState(true);

            try {
                const params = new URLSearchParams();
                params.append('email', emailValue);
                params.append('password', passwordValue);

                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params,
                    credentials: 'include'
                });

                if (response.redirected) {
                    const redirectUrl = new URL(response.url);
                    if (redirectUrl.searchParams.has('locked')) {
                        alert('Your account has been locked due to multiple failed login attempts.');
                        isAccountFormLocked = true;
                        const redirectTime = parseInt(redirectUrl.searchParams.get('time'), 10) || 60;
                        localStorage.setItem('lockout_expiry', Date.now() + (redirectTime * 1000));
                        disableFormPermanently(redirectTime);
                        return;
                    }
                    if (redirectUrl.searchParams.has('error') || redirectUrl.href.includes('failure')) {
                        alert('Incorrect email or password.');
                        setLoadingState(false);
                        return;
                    }
                    window.location.replace('index.html');
                    return;
                }

                if (response.status === 429) {
                    let waitTime = 60;
                    try {
                        const data = await response.json();
                        waitTime = parseInt(data.retryAfterSeconds, 10) || 60;
                        alert(data.message || "Too many requests.");
                    } catch {
                        alert("Too many requests. Please wait.");
                    }
                    isAccountFormLocked = true;
                    localStorage.setItem('lockout_expiry', Date.now() + (waitTime * 1000));
                    disableFormPermanently(waitTime);
                    return;
                }

                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();

                    if (response.status === 423 || data.status === "LOCKED" || data.status === "BLOCKED") {
                        alert(data.message || 'Your account has been locked due to multiple failed login attempts.');
                        isAccountFormLocked = true;
                        const retryAfterSeconds = parseInt(data.retryAfterSeconds, 10) || 60; 
                        localStorage.setItem('lockout_expiry', Date.now() + (retryAfterSeconds * 1000));
                        disableFormPermanently(retryAfterSeconds);
                        return;
                    }

                    if (response.status === 401 || data.status === "ERROR") {
                        alert(data.message || 'Incorrect email or password.');
                        setLoadingState(false);
                        return;
                    }

                    if (data.status === "MFA_REQUIRED" || data.redirect?.includes('verify-code')) {
                        window.location.replace('mfa-page.html');
                        return;
                    }

                    if (data.status === "SUCCESS") {
                        window.location.replace('index.html');
                        return;
                    }

                    if (data.redirect) {
                        const localPath = data.redirect.replace(/^\//, '').replace(/\/$/, '') + '.html';
                        window.location.replace(localPath);
                        return;
                    }
                }

                if (response.ok) {
                    window.location.replace('index.html'); 
                    return;
                }

                if (response.status === 423) {
                    alert('Your account has been locked.');
                    isAccountFormLocked = true;
                    const fallbackSeconds = 60; 
                    localStorage.setItem('lockout_expiry', Date.now() + (fallbackSeconds * 1000));
                    disableFormPermanently(fallbackSeconds);
                } else {
                    alert('Incorrect email or password.');
                    setLoadingState(false);
                }

            } catch (error) {
                console.error('Authentication error:', error);
                alert('There was a connection problem with the server.');
                setLoadingState(false);
            }
        });
    }

    const forgotPasswordLink = document.querySelector('a[href="forgot-password.html"]');
    const registerLink = document.querySelector('a[href="register.html"]');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'forgot-password.html';
        });
    }

    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }

    function setLoadingState(isLoading) {
        if (!submitButton) return;
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.dataset.originalText = submitButton.innerHTML;
            submitButton.innerHTML = `Processing...`;
        } else {
            if (!isAccountFormLocked) {
                submitButton.disabled = false;
                if (submitButton.dataset.originalText) {
                    submitButton.innerHTML = submitButton.dataset.originalText;
                }
            }
        }
    }

    function disableFormPermanently(initialSeconds) {
        if (!submitButton) return;
        
        if (emailInput) emailInput.disabled = true;
        if (passwordInput) passwordInput.disabled = true;
        submitButton.disabled = true;
        submitButton.style.backgroundColor = '#6c757d'; 
        submitButton.style.borderColor = '#6c757d';

        let remainingTime = initialSeconds;

        const initialMinutes = Math.floor(remainingTime / 60);
        const initialSecondsCount = remainingTime % 60;
        submitButton.innerHTML = `Try again in ${initialMinutes}:${initialSecondsCount < 10 ? '0' : ''}${initialSecondsCount}`;

        const countdownTimer = setInterval(() => {
            remainingTime--;
            
            if (remainingTime <= 0) {
                clearInterval(countdownTimer);
                
                isAccountFormLocked = false; 
                localStorage.removeItem('lockout_expiry');
                
                if (emailInput) emailInput.disabled = false;
                if (passwordInput) passwordInput.disabled = false;
                submitButton.disabled = false;
                
                if (submitButton.dataset.originalText) {
                    submitButton.innerHTML = submitButton.dataset.originalText;
                } else {
                    submitButton.innerHTML = 'Sign In'; 
                }
                
                submitButton.style.backgroundColor = ''; 
                submitButton.style.borderColor = '';
            } else {
                const minutes = Math.floor(remainingTime / 60);
                const visualSeconds = remainingTime % 60;
                submitButton.innerHTML = `Try again in ${minutes}:${visualSeconds < 10 ? '0' : ''}${visualSeconds}`;
            }
        }, 1000);
    }
});

window.app = {};