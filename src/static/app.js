document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const adminMenuButton = document.getElementById("admin-menu-button");
  const adminModal = document.getElementById("admin-modal");
  const adminModalClose = document.getElementById("admin-modal-close");
  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("login-status");
  let adminToken = sessionStorage.getItem("adminToken");
  let adminUsername = sessionStorage.getItem("adminUsername");

  function updateAdminUi() {
    const isAdmin = Boolean(adminToken);
    document.querySelectorAll(".delete-btn, .register-btn").forEach((button) => {
      button.classList.toggle("hidden", !isAdmin);
    });
    if (!isAdmin) {
      document.querySelectorAll(".registration-form").forEach((form) => {
        form.classList.add("hidden");
      });
      document.querySelectorAll(".register-btn").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    }
    adminMenuButton.title = isAdmin
      ? `Logged in as ${adminUsername}. Click to log out.`
      : "Teacher login";
  }

  adminMenuButton.addEventListener("click", async () => {
    if (adminToken) {
      try {
        await fetch("/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }
      adminToken = null;
      adminUsername = null;
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminUsername");
      updateAdminUi();
      return;
    }
    adminModal.classList.remove("hidden");
    document.getElementById("username").focus();
  });

  adminModalClose.addEventListener("click", () => {
    adminModal.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        adminToken = result.token;
        adminUsername = result.username;
        sessionStorage.setItem("adminToken", adminToken);
        sessionStorage.setItem("adminUsername", adminUsername);
        loginForm.reset();
        adminModal.classList.add("hidden");
        loginStatus.classList.add("hidden");
        updateAdminUi();
      } else {
        loginStatus.textContent = result.detail || "Invalid login";
        loginStatus.className = "error";
        loginStatus.classList.remove("hidden");
      }
    } catch (error) {
      loginStatus.textContent = "Unable to connect to the login service.";
      loginStatus.className = "error";
      loginStatus.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        const registrationForm = document.createElement("form");
        registrationForm.id = `registration-form-${activitiesList.children.length}`;
        registrationForm.className = "registration-form hidden";
        registrationForm.dataset.activity = name;
        registrationForm.innerHTML = `
          <div class="form-group">
            <label>
              Student Email:
              <input type="email" name="email" required placeholder="student@mergington.edu" />
            </label>
          </div>
          <button type="submit">Register Student</button>
        `;
        registrationForm.addEventListener("submit", handleSignup);

        const registerButton = document.createElement("button");
        registerButton.type = "button";
        registerButton.className = "register-btn hidden";
        registerButton.textContent = "Register student";
        registerButton.setAttribute("aria-expanded", "false");
        registerButton.setAttribute("aria-controls", registrationForm.id);
        registerButton.addEventListener("click", () => {
          const isOpening = registrationForm.classList.contains("hidden");
          registrationForm.classList.toggle("hidden");
          registerButton.setAttribute("aria-expanded", String(isOpening));
          if (isOpening) {
            registrationForm.querySelector("input").focus();
          }
        });

        activityCard.append(registerButton, registrationForm);
        activitiesList.appendChild(activityCard);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
      updateAdminUi();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.currentTarget;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const email = form.querySelector('input[name="email"]').value;
    const activity = form.dataset.activity;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  }

  // Initialize app
  fetchActivities();
});
