const handleLogin = async (email, password) => {
  try {
    const response = await fetch("http://localhost:4000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      // Spara den riktiga JWT-token från backenden i webbläsaren
      localStorage.setItem("token", data.token);
      console.log("Inloggad framgångsrikt!");
    } else {
      console.error("Inloggning misslyckades:", data.message);
    }
  } catch (error) {
    console.error("Fel vid anrop till login:", error);
  }
};