document.addEventListener("DOMContentLoaded", async function () {
    const form = document.getElementById("registerForm");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;

    const regexLetters = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const regexPhone = /^\d{10}$/;
    const regexEmailPattern = /^[A-Za-z0-9+_.-]+@(.+)$/;
    const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,12}$/;

    try {
        const keyResponse = await fetch('http://localhost:8080/api/users/recaptcha-key');
        if (keyResponse.ok) {
            const keyData = await keyResponse.json();
            
            console.log("reCAPTCHA Site Key received from the backend:", keyData.siteKey);

            const container = document.getElementById('recaptcha-container');
            
            if (container) {
                container.setAttribute('data-sitekey', keyData.siteKey);

                window.onloadRecaptchaCallback = function() {
                    if (typeof grecaptcha !== 'undefined') {
                        grecaptcha.render('recaptcha-container', {
                            'sitekey': keyData.siteKey,
                            'theme': 'light'
                        });
                    }
                };

                const oldScript = document.querySelector('script[src*="recaptcha/api.js"]');
                if (oldScript) oldScript.remove();

                const script = document.createElement('script');
                script.src = "https://www.google.com/recaptcha/api.js?onload=onloadRecaptchaCallback&render=explicit";
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        } else {
            console.error("The backend returned an error when requesting the key:", keyResponse.status);
        }
    } catch (err) {
        console.error("Critical error loading the reCAPTCHA configuration:", err);
    }
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", function () {
            const isPassword = passwordInput.getAttribute("type") === "password";
            passwordInput.setAttribute("type", isPassword ? "text" : "password");
        });
    }

    ["name", "lastname"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", function () {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
        });
    });

    const mobile = document.getElementById("mobileNumber");
    if (mobile) {
        mobile.addEventListener("input", function () {
            this.value = this.value.replace(/[^0-9]/g, "");
        });
    }

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            const name = document.getElementById("name").value.trim();
            const lastname = document.getElementById("lastname").value.trim();
            const mobileInput = document.getElementById("mobileNumber").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!name || !regexLetters.test(name)) return alert("Name is required.");
            if (!lastname || !regexLetters.test(lastname)) return alert("Last name is required.");

            if (!mobileInput) return alert("Phone number is required.");
            if (!regexPhone.test(mobileInput)) return alert("The phone number must contain exactly 10 numeric digits.");

            if (!email) return alert("Email address is required.");
            if (!regexEmailPattern.test(email)) return alert("The email address format is invalid.");

            if (!password) return alert("Password is required.");
            if (password.length < 8 || password.length > 12) return alert("Password must be between 8 and 12 characters.");
            if (!regexPassword.test(password)) {
                return alert("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).");
            }

            const captchaToken = (typeof grecaptcha !== "undefined") ? grecaptcha.getResponse() : "";
            if (!captchaToken) return alert("Please verify the reCAPTCHA.");

            setLoadingState(true);

            try {

                const res = await fetch("http://localhost:8080/api/users/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "g-recaptcha-response": captchaToken
                    },
                    body: JSON.stringify({
                        name,
                        lastname: lastname,
                        mobileNumber: mobileInput,
                        email: email.toLowerCase(),
                        password
                    })
                });

                if (res.status === 429) {
                    const data = await res.json().catch(() => ({}));
                    alert("Alert: " + (data.error || "Too many requests. Rate limit exceeded. Please try again in 1 minute."));
                    setLoadingState(false);
                    if (typeof grecaptcha !== "undefined") grecaptcha.reset();
                    return;
                }

                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    alert(data.message || "User registered successfully!");
                    form.reset();
                    window.location.href = "/register.html";
                } else {
                    alert(data.message || "Registration failed.");
                    setLoadingState(false);
                }

                if (typeof grecaptcha !== "undefined") grecaptcha.reset();

            } catch (err) {
                console.error(err);
                alert("Server connection error.");
                setLoadingState(false);
            }
        });
    }

    function setLoadingState(isLoading) {
        if (!submitButton) return;
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.dataset.originalText = submitButton.innerHTML;
            submitButton.innerHTML = `Processing...`;
        } else {
            submitButton.disabled = false;
            if (submitButton.dataset.originalText) {
                submitButton.innerHTML = submitButton.dataset.originalText;
            }
        }
    }
});