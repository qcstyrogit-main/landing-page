document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('reset-form');
    const emailInput = document.getElementById('email');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email) {
                if (window.frappe && frappe.msgprint) frappe.msgprint('Please enter your email.');
                else alert('Please enter your email.');
                return;
            }

            if (window.frappe && frappe.call) {
                frappe.call({
                    method: 'frappe.core.doctype.user.user.reset_password',
                    args: { user: email },
                    callback: function(r) {
                        if (r && r.message) {
                            frappe.msgprint('Password reset email sent.');
                        } else {
                            frappe.msgprint('If the email exists, a reset link was sent.');
                        }
                    }
                });
            } else {
                // Fallback: show confirmation
                alert('If the email exists, a reset link was sent.');
            }
        });
    }

    const backBtn = document.querySelector('.back-login');
    if (backBtn) {
        backBtn.addEventListener('click', function() { window.location.href = '/login'; });
    }
});
