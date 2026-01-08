// Toggle password visibility (robust selector and safe DOM checks)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
        toggle.addEventListener('click', togglePassword);
        toggle.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') togglePassword.call(toggle, e); });
    });

    function togglePassword(e) {
        const toggle = this;
        const row = toggle.closest('.form-row');
        if (!row) return;
        const pwd = row.querySelector('input');
        if (!pwd) return;

        const icon = toggle.querySelector('i');
        const text = toggle.querySelector('.text-muted');

        if (pwd.type === 'password') {
            pwd.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
            if (text) text.innerText = 'Hide';
            toggle.setAttribute('aria-pressed', 'true');
        } else {
            pwd.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
            if (text) text.innerText = 'Show';
            toggle.setAttribute('aria-pressed', 'false');
        }
    }

    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const form = e.target;
            const loginButton = form.querySelector('button[type="submit"]');
            const usernameInput = form.querySelector('#usr');
            const passwordInput = form.querySelector('#pwd');

            // Reset previous error styles
            if (usernameInput) usernameInput.style.borderColor = '';
            if (passwordInput) passwordInput.style.borderColor = '';
            if (loginButton) {
                loginButton.disabled = true;
                loginButton.textContent = 'Logging in...';
            }

            const data = new FormData(form);

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: data,
                    credentials: 'same-origin'
                });

                let result;
                try { result = await response.json(); } catch { result = null; }

                if (result && result.home_page) {
                    window.location.href = result.home_page;
                } else {
                    if (loginButton) loginButton.textContent = 'Invalid Login. Try Again.';
                    if (loginButton) loginButton.disabled = false;
                    if (usernameInput) usernameInput.style.borderColor = 'red';
                    if (passwordInput) passwordInput.style.borderColor = 'red';
                    setTimeout(() => {
                        if (loginButton) loginButton.textContent = 'Login';
                        if (usernameInput) usernameInput.style.borderColor = '';
                        if (passwordInput) passwordInput.style.borderColor = '';
                    }, 3000);
                }
            } catch (err) {
                if (loginButton) loginButton.textContent = 'Invalid Login. Try Again.';
                if (loginButton) loginButton.disabled = false;
                if (usernameInput) usernameInput.style.borderColor = 'red';
                if (passwordInput) passwordInput.style.borderColor = 'red';
                setTimeout(() => {
                    if (loginButton) loginButton.textContent = 'Login';
                    if (usernameInput) usernameInput.style.borderColor = '';
                    if (passwordInput) passwordInput.style.borderColor = '';
                }, 3000);
            }
        });
    }

    // Hide chat widget if present
    const chat = document.getElementById('chat-bubble');
    if (chat) chat.style.display = 'none';
});

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const loginButton = form.querySelector('button[type="submit"]');
    const usernameInput = form.querySelector('#usr');
    const passwordInput = form.querySelector('#pwd');

    // Reset previous error styles
    usernameInput.style.borderColor = '';
    passwordInput.style.borderColor = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    const data = new FormData(form);

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: data,
            credentials: 'same-origin'
        });

        let result;
        try {
            result = await response.json();
        } catch {
            result = null;
        }

        if (result && result.home_page) {
            // Successful login
            window.location.href = result.home_page;
        } else {
            // Invalid login
            loginButton.textContent = 'Invalid Login. Try Again.';
            loginButton.disabled = false;

            // Highlight inputs with red border
            usernameInput.style.borderColor = 'red';
            passwordInput.style.borderColor = 'red';

            // Revert button and borders after 3 seconds
            setTimeout(() => {
                loginButton.textContent = 'Login';
                usernameInput.style.borderColor = '';
                passwordInput.style.borderColor = '';
            }, 3000);
        }
    } catch (err) {
        // Network/server error
        loginButton.textContent = 'Invalid Login. Try Again.';
        loginButton.disabled = false;
        usernameInput.style.borderColor = 'red';
        passwordInput.style.borderColor = 'red';

        setTimeout(() => {
            loginButton.textContent = 'Login';
            usernameInput.style.borderColor = '';
            passwordInput.style.borderColor = '';
        }, 3000);
    }
});


document.addEventListener("DOMContentLoaded", function() {
    const chat = document.getElementById("chat-bubble");
    if(chat) chat.style.display = "none";
});

