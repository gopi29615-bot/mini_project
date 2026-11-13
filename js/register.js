const registerForm = document.getElementById("registerForm");


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const username =
                document.getElementById("username")
                .value.trim();

            const email =
                document.getElementById("email")
                .value.trim();

            const phone =
                document.getElementById("phone")
                .value.trim();

            const password =
                document.getElementById("password")
                .value;

            const confirmPassword =
                document.getElementById("confirmPassword")
                .value;

            const message =
                document.getElementById("registerMessage");


            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const usernamePattern = /^[A-Za-z0-9_]{3,20}$/;
            const phonePattern = /^\+?[0-9()\s-]+$/;
            const passwordPattern = /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?!.*\d.*\d)[A-Za-z0-9]+$/;

            function showError(text, field) {
                message.textContent = text;
                message.className = "message error";
                alert(text);
                field.focus();
            }

            /*Validation fields */

            if (
                username === "" ||
                email === "" ||
                phone === "" ||
                password === "" ||
                confirmPassword === ""
            ) {

                showError("Please fill all fields.", document.getElementById("username"));

                return;
            }


            if (!usernamePattern.test(username)) {
                showError(
                    "Username must be 3-20 characters using letters, numbers, or underscores.",
                    document.getElementById("username")
                );

                return;
            }


            if (!emailPattern.test(email)) {
                showError("Please enter a valid email address.", document.getElementById("email"));

                return;
            }


            const phoneDigits = phone.replace(/\D/g, "");
            if (!phonePattern.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
                showError(
                    "Please enter a valid phone number with 10 to 15 digits.",
                    document.getElementById("phone")
                );

                return;
            }


            if (!passwordPattern.test(password)) {
                showError(
                    "Password must be at least 8 characters with uppercase and lowercase letters and exactly one number.",
                    document.getElementById("password")
                );

                return;
            }


            /* Confirm password */

            if (password !== confirmPassword) {
                showError(
                    "Passwords do not match.",
                    document.getElementById("confirmPassword")
                );

                return;
            }


            /* Save user */

            const user = {

                username: username,

                email: email,

                phone: phone,

                password: password

            };


            localStorage.setItem(
                "libraryUser",
                JSON.stringify(user)
            );


            message.textContent =
                "Registration successful!";

            message.className =
                "message success";

            alert("Registration successful!");

            registerForm.reset();

        }
    );

}