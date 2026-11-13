// ===============================
// DIGITAL LIBRARY LOGIN
// ===============================

if (sessionStorage.getItem("libraryLoggedIn") === "true") {
    window.location.href = "dashbord.html";
}

const loginForm = document.getElementById("loginForm");
const forgotPasswordModal = document.getElementById("forgotPasswordModal");


function closeForgotPasswordModal() {

    if (forgotPasswordModal) {
        forgotPasswordModal.classList.add("hidden");
        forgotPasswordModal.setAttribute("aria-hidden", "true");
    }

}


// Login Form Submit
if (loginForm) {

    loginForm.addEventListener("submit", function (event) {

        // Prevent page refresh
        event.preventDefault();


        // Get input values
        const username =
            document.getElementById("username").value.trim();

        const normalizedUsername = username.toLowerCase();
        const password =
            document.getElementById("password").value;

        const message =
            document.getElementById("message");

        const loginButton =
            document.getElementById("loginButton");


        // ===============================
        // Empty Field Validation
        // ===============================

        if (username === "" && password === "") {

            message.textContent =
                "Please enter username and password.";

            message.className =
                "message error";

            alert(message.textContent);
            return;
        }


        if (username === "") {

            message.textContent =
                "Please enter username.";

            message.className =
                "message error";

            alert(message.textContent);
            return;
        }


        if (password === "") {

            message.textContent =
                "Please enter password.";

            message.className =
                "message error";

            alert(message.textContent);
            return;
        }

        if (password.trim() === "") {
            message.textContent =
                "Please enter password.";

            message.className =
                "message error";

            alert(message.textContent);
            return;
        }


        // ===============================
        // Login Credentials
        // ===============================

        let registeredUser = null;

        try {
            registeredUser = JSON.parse(
                localStorage.getItem("libraryUser") || "null"
            );
        } catch (error) {
            console.error("Unable to read the saved library account.", error);
            registeredUser = null;
        }

        const isDefaultLogin =
            normalizedUsername === "admin" && password === "0831";

        const isRegisteredUser =
            registeredUser &&
            normalizedUsername === String(registeredUser.username || "").toLowerCase() &&
            password === registeredUser.password;


        // ===============================
        // Check Login
        // ===============================

        if (isDefaultLogin || isRegisteredUser) {

            if (loginButton) {
                loginButton.disabled = true;
                loginButton.textContent = "Logging in...";
            }

            // Save login status
            sessionStorage.setItem(
                "libraryLoggedIn",
                "true"
            );


            // Success message
            message.textContent =
                "Login successful! Redirecting...";

            message.className =
                "message success";

            alert(message.textContent);

            // Go to Dashboard
            setTimeout(function () {
                window.location.href =
                    "dashbord.html";

            }, 500);


        } else {

            // Wrong username/password
            message.textContent =
                "Incorrect username or password.";

            message.className =
                "message error";

            alert(message.textContent);

        }

    });

}


// ===============================
// Reset Login Form
// ===============================

function resetForm() {

    const form =
        document.getElementById("loginForm");

    const message =
        document.getElementById("message");


    if (form) {
        form.reset();
    }


    if (message) {

        message.textContent = "";

        message.className =
            "message";

    }

    const loginButton =
        document.getElementById("loginButton");

    if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }

}


// Open the reset-password modal
function forgotPassword() {

    if (forgotPasswordModal) {
        forgotPasswordModal.classList.remove("hidden");
        forgotPasswordModal.setAttribute("aria-hidden", "false");

        const closeButton = forgotPasswordModal.querySelector(".close-modal");
        if (closeButton) closeButton.focus();
    }

}


if (forgotPasswordModal) {
    forgotPasswordModal.addEventListener("click", function (event) {
        if (event.target === forgotPasswordModal) {
            closeForgotPasswordModal();
        }
    });
}

